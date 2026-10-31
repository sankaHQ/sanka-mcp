// Hand-written tools for the requester routes of Sanka Desk, the managed IT service desk
// (sanka-api docs/specs/desk/console-and-mcp.md §4). An employee files and follows their own IT
// requests from their AI client. The routes sit outside the public developer OpenAPI contract, so
// the handlers call raw client paths. There is no approve tool: the API has no requester approval
// route, and these tools write nothing but the caller's own request.
import { createHash } from 'node:crypto';

import { readRecord, readString } from './tool-factories';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpRequestContext, McpTool, ToolCallResult } from './types';

type ToolArgs = Record<string, unknown> | undefined;
type JsonRecord = Record<string, unknown>;

const MY_TICKETS_PATH = '/api/v2/desk/my/tickets';
const SESSION_PATH = '/api/v2/auth/session';

const TEXT_MAX_LENGTH = 4000;
const LIST_MAX_LIMIT = 50;
const STATE_FILTERS = ['open', 'closed', 'all'] as const;
// A ticket UUID, or its number with or without the leading hash.
const TICKET_REF_PATTERN =
  '^(#?[0-9]{1,18}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$';
const TICKET_REF = new RegExp(TICKET_REF_PATTERN);

// A create without client_key sends one derived from the request: the same text about the same
// subject within one clock hour is one request, so a retried call returns the first ticket. The API
// scopes the key to the caller (intake key `client:{user_id}:{client_key}`).
const DERIVED_KEY_WINDOW_MS = 60 * 60 * 1000;
// A returned ticket received this long before the call began was filed by an earlier call.
const EARLIER_FILING_MS = 60 * 1000;

export const DESK_TOOL_NAMES = ['desk_create_ticket', 'desk_get_ticket_status', 'desk_list_my_tickets'];

const STATE_LABELS: Record<string, string> = {
  received: 'received, waiting for Desk to pick it up',
  awaiting_requester: 'waiting for the requester to answer',
  awaiting_approval: 'waiting for approval',
  executing: 'being carried out',
  with_specialist: 'with an IT specialist',
  resolved_provisional: 'resolved, waiting for the requester to confirm or reopen',
  verified: 'closed as resolved',
  closed_not_billable: 'closed',
};

const NULLABLE_STRING = { type: ['string', 'null'] };

const TICKET_PROPERTIES = {
  id: { type: 'string', description: 'Ticket UUID.' },
  number: { type: ['integer', 'null'] },
  reference: { type: 'string', description: '"#123", or the id until a number is assigned.' },
  title: { type: 'string' },
  state: { type: 'string', enum: Object.keys(STATE_LABELS) },
  state_reason: { type: 'string' },
  status_group: { type: 'string', enum: ['open', 'closed'] },
  waiting_on: {
    type: 'string',
    enum: ['requester', 'approval', 'desk', 'none'],
    description: 'Who the ticket waits for.',
  },
  origin: {
    type: 'string',
    description: 'Where the request came from: slack, teams, email, console or mcp.',
  },
  received_at: { type: 'string' },
  updated_at: { type: 'string' },
  resolved_at: NULLABLE_STRING,
};

const DETAIL_PROPERTIES = {
  ...TICKET_PROPERTIES,
  pending_question: {
    ...NULLABLE_STRING,
    description: 'The open question when Desk waits for the requester.',
  },
  available_actions: {
    type: 'array',
    items: { type: 'string' },
    description: 'What the requester can do on the Desk page or where the request came from.',
  },
  messages: {
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'The latest 20 messages, oldest first.',
  },
  console_url: { type: 'string', description: 'The request on the Desk page.' },
  message: { type: 'string' },
};

const DETAIL_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: DETAIL_PROPERTIES,
};

const CREATE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    ...DETAIL_PROPERTIES,
    client_key: { type: 'string', description: 'The idempotency key sent; reuse it to retry this request.' },
    text: { type: 'string', description: 'The request text Desk recorded.' },
    workspace_id: { type: 'string' },
    workspace_code: { type: 'string' },
    workspace_name: { type: 'string' },
  },
};

const LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    items: {
      type: 'array',
      items: { type: 'object', properties: TICKET_PROPERTIES, additionalProperties: true },
    },
    state: { type: 'string', enum: [...STATE_FILTERS] },
    limit: { type: 'integer' },
    total: { type: 'integer' },
    message: { type: 'string' },
  },
};

type DeskFailure = { code: string; message: string; details: unknown; status?: number; ctxID?: string };

// An SDK APIError carries the V2 envelope as `error`, and the envelope its `error` body.
const readDeskFailure = (error: unknown): DeskFailure | undefined => {
  const layers: JsonRecord[] = [];
  for (let layer = readRecord(error); layer && layers.length < 3; layer = readRecord(layer['error'])) {
    layers.push(layer);
  }
  const body = layers.find((layer) => readString(layer['code']) && readString(layer['message']));
  if (!body) return undefined;
  const status = layers.map((layer) => layer['status']).find((value) => typeof value === 'number');
  const ctxID = layers.map((layer) => readString(readRecord(layer['meta'])?.['ctx_id'])).find(Boolean);
  return {
    code: readString(body['code']) ?? '',
    message: readString(body['message']) ?? '',
    details: body['details'] ?? {},
    ...(typeof status === 'number' ? { status } : undefined),
    ...(ctxID ? { ctxID } : undefined),
  };
};

// What the model should do next for the codes the Desk requester routes return.
const DESK_ERROR_HINTS: Record<string, string> = {
  DESK_NOT_ENABLED:
    'The Desk tools work only in workspaces with Sanka Desk switched on. Tell the user to raise the request with their IT team the usual way; do not file it with create_ticket instead.',
  DESK_REQUESTER_NOT_IN_DIRECTORY:
    'The company directory does not list this account as an active member, so Desk takes no requests from it. The user should contact their IT team.',
  DESK_REQUESTER_ACCOUNT_REQUIRED:
    'Filing Desk requests from an AI client needs a Sanka account in this workspace. The user should contact their IT team.',
  DESK_TICKET_NOT_FOUND:
    'Only requests the connected user filed can be read here; desk_list_my_tickets lists them.',
  WORKSPACE_CONTEXT_MISMATCH:
    'The connection changed workspace while filing. Check current_workspace, then retry once in the intended workspace.',
};

// A 4xx answer with a code changes nothing; anything else is left to the server's error handling.
const deskErrorResult = (error: unknown, write: boolean): ToolCallResult | undefined => {
  const failure = readDeskFailure(error);
  if (!failure || (failure.status !== undefined && failure.status >= 500)) return undefined;
  const hint = DESK_ERROR_HINTS[failure.code];
  return {
    content: [
      {
        type: 'text',
        text: `${write ? 'Nothing was filed' : 'Could not read Desk requests'} (${failure.code}): ${
          failure.message
        }${hint ? ` ${hint}` : ''}`,
      },
    ],
    isError: true,
    structuredContent: {
      ok: false,
      status: 'error',
      status_code: failure.status,
      code: failure.code,
      message: failure.message,
      details: failure.details,
      ctx_id: failure.ctxID,
    },
  };
};

// The V2 envelope's data.
const envelopeData = (response: unknown): JsonRecord => readRecord(readRecord(response)?.['data']) ?? {};

const stateLabel = (ticket: JsonRecord): string => {
  const state = readString(ticket['state']) ?? '';
  return STATE_LABELS[state] ?? state;
};

const ticketLine = (ticket: JsonRecord): string =>
  [
    `- ${readString(ticket['reference']) ?? '?'} "${readString(ticket['title']) ?? ''}"`,
    stateLabel(ticket),
    `received ${readString(ticket['received_at']) ?? '?'}`,
    `id ${readString(ticket['id']) ?? '?'}`,
  ].join(' · ');

const latestDeskMessage = (ticket: JsonRecord): JsonRecord | undefined =>
  (Array.isArray(ticket['messages']) ? ticket['messages'] : [])
    .map(readRecord)
    .filter((message): message is JsonRecord => message?.['direction'] === 'outbound')
    .pop();

// The status of one request in a few lines: state, what Desk asks, its latest message and the page.
const describeTicket = (ticket: JsonRecord): string[] => {
  const question = readString(ticket['pending_question']);
  const latest = latestDeskMessage(ticket);
  const latestBody = readString(latest?.['body']);
  const actions = (Array.isArray(ticket['available_actions']) ? ticket['available_actions'] : []).filter(
    (action): action is string => typeof action === 'string',
  );
  const consoleUrl = readString(ticket['console_url']);
  return [
    `${readString(ticket['reference']) ?? '?'} "${readString(ticket['title']) ?? ''}": ${stateLabel(
      ticket,
    )}.`,
    ...(question ? [`Desk asks: ${question}`] : []),
    ...(latestBody && latestBody !== question ?
      [`Latest from Desk (${readString(latest?.['created_at']) ?? '?'}): ${latestBody}`]
    : []),
    ...(ticket['waiting_on'] === 'approval' ?
      ['It waits for an approver; these tools cannot approve anything.']
    : []),
    ...(actions.length > 0 ?
      [
        `The requester can ${actions.join(
          ', ',
        )} on the Desk page or where the request came from; these tools cannot.`,
      ]
    : []),
    ...(consoleUrl ? [`Desk page: ${consoleUrl}`] : []),
  ];
};

const ticketResult = (data: JsonRecord, lines: string[], extra?: JsonRecord): ToolCallResult => {
  const message = lines.join('\n');
  return {
    content: [{ type: 'text', text: message }],
    structuredContent: { ...data, ...extra, message },
  };
};

const derivedClientKey = (text: string, subjectEmail: string | undefined, now: number): string => {
  const normalized = text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const window = Math.floor(now / DERIVED_KEY_WINDOW_MS);
  const digest = createHash('sha256')
    .update(JSON.stringify([normalized, subjectEmail?.toLowerCase() ?? '', window]))
    .digest('hex');
  return `mcp-${digest.slice(0, 40)}`;
};

type SessionWorkspace = { id?: string; code?: string; name?: string };

// The workspace this connection resolves to, read the way the Desk routes resolve it.
const sessionWorkspace = async (reqContext: McpRequestContext): Promise<SessionWorkspace> => {
  const data = envelopeData(await reqContext.client.get(SESSION_PATH));
  const workspace = readRecord(data['current_workspace']) ?? readRecord(data['workspace']);
  const id = readString(workspace?.['id']);
  const code = readString(workspace?.['code']);
  const name = readString(workspace?.['name']);
  return { ...(id ? { id } : undefined), ...(code ? { code } : undefined), ...(name ? { name } : undefined) };
};

type DeskToolDefinition = {
  name: string;
  title: string;
  description: string;
  operation: 'read' | 'write';
  httpMethod: 'get' | 'post';
  httpPath: string;
  operationId: string;
  inputSchema: McpTool['tool']['inputSchema'];
  outputSchema: McpTool['tool']['outputSchema'];
  run: (reqContext: McpRequestContext, args: ToolArgs) => Promise<ToolCallResult>;
};

const defineDeskTool = (definition: DeskToolDefinition): McpTool => ({
  metadata: {
    // Not `tickets`: Desk requests are not Flow ticket records and get no Flow record links.
    resource: 'desk_tickets',
    operation: definition.operation,
    tags: ['desk', 'it_requests'],
    httpMethod: definition.httpMethod,
    httpPath: definition.httpPath,
    operationId: definition.operationId,
  },
  tool: {
    name: definition.name,
    title: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: definition.title,
      readOnlyHint: definition.operation === 'read',
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: definition.title });
    if (authError) return authError;
    try {
      return await definition.run(reqContext, args);
    } catch (error) {
      const result = deskErrorResult(error, definition.operation === 'write');
      if (result) return result;
      throw error;
    }
  },
});

export const deskCreateTicketTool = defineDeskTool({
  name: 'desk_create_ticket',
  title: 'File an IT request with Sanka Desk',
  description:
    "File an IT request for the connected user with their company's IT service desk (Sanka Desk): access, accounts, login problems, a joiner or leaver, app settings or an IT question, in the user's own words. For a request about another person, such as a new hire or a leaver, pass their e-mail as subject_email. Desk may answer, ask follow-up questions or need approvals before anything changes; this tool cannot approve anything. Follow the request with desk_get_ticket_status or on the Desk page (console_url); Desk also posts status changes where a request came from, such as Slack or e-mail. Workspaces without Sanka Desk answer DESK_NOT_ENABLED; never file IT requests with create_ticket instead. To retry, pass the client_key of the first attempt; without one, the same text within the hour returns the first request instead of a duplicate.",
  operation: 'write',
  httpMethod: 'post',
  httpPath: MY_TICKETS_PATH,
  operationId: 'create_my_desk_ticket_api_v2_desk_my_tickets_post',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['text'],
    properties: {
      text: {
        type: 'string',
        minLength: 1,
        maxLength: TEXT_MAX_LENGTH,
        description: "The request in the requester's own words, with the details IT needs.",
      },
      subject_email: {
        type: 'string',
        format: 'email',
        maxLength: 320,
        description: 'E-mail of the person the request is about, when it is not the requester.',
      },
      client_key: {
        type: 'string',
        minLength: 8,
        maxLength: 100,
        description:
          'Idempotency key, such as a UUID you choose. A retry with the same key returns the first request.',
      },
    },
  },
  outputSchema: CREATE_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const startedAt = Date.now();
    const rawText = typeof args?.['text'] === 'string' ? args['text'] : '';
    const text = rawText.trim();
    if (!text) return asErrorResult("`text` is required: the request in the requester's own words.");
    if ([...text].length > TEXT_MAX_LENGTH) {
      return asErrorResult(`\`text\` must be at most ${TEXT_MAX_LENGTH} characters.`);
    }
    const subjectEmail = readString(args?.['subject_email']);
    const clientKey = readString(args?.['client_key']) ?? derivedClientKey(text, subjectEmail, startedAt);

    // MCP writes name their workspace: the API refuses a mismatch with 409 and files nothing.
    const workspace = await sessionWorkspace(reqContext);
    if (!workspace.id) {
      return asErrorResult(
        'No Sanka workspace is selected for this connection, so nothing was filed. Pick one with list_workspaces and switch_workspace, then retry.',
      );
    }
    const response = await reqContext.client.post(MY_TICKETS_PATH, {
      body: { text, ...(subjectEmail ? { subject_email: subjectEmail } : undefined), client_key: clientKey },
      headers: { 'X-Sanka-MCP': 'true', 'X-Sanka-Expected-Workspace-ID': workspace.id },
      maxRetries: 0,
    });
    const ticket = envelopeData(response);
    const reference = readString(ticket['reference']) ?? readString(ticket['id']) ?? '?';
    // The first inbound message is the request as Desk recorded it.
    const recordedText = (Array.isArray(ticket['messages']) ? ticket['messages'] : [])
      .map(readRecord)
      .find((message) => message?.['direction'] === 'inbound')?.['body'];
    const receivedAt = Date.parse(readString(ticket['received_at']) ?? '');
    const desk = `the IT service desk of ${workspace.name ?? workspace.code ?? workspace.id}`;
    const lead =
      receivedAt < startedAt - EARLIER_FILING_MS ?
        `This request was already filed with ${desk} as ${reference} at ${readString(
          ticket['received_at'],
        )}; Desk returned it instead of filing a duplicate.`
      : `Filed ${reference} with ${desk}.`;
    return ticketResult(
      ticket,
      [
        lead,
        ...describeTicket(ticket),
        `Desk may ask follow-up questions or need approvals; check progress with desk_get_ticket_status (ticket "${reference}").`,
      ],
      {
        ok: true,
        status: 'filed',
        client_key: clientKey,
        ...(typeof recordedText === 'string' ? { text: recordedText } : undefined),
        workspace_id: workspace.id,
        ...(workspace.code ? { workspace_code: workspace.code } : undefined),
        ...(workspace.name ? { workspace_name: workspace.name } : undefined),
      },
    );
  },
});

export const deskGetTicketStatusTool = defineDeskTool({
  name: 'desk_get_ticket_status',
  title: 'Get the status of a Sanka Desk request',
  description:
    "Read one of the connected user's own IT requests with Sanka Desk, their company's IT service desk: its state, who it waits for, the question Desk asks, the latest messages and the Desk page link. Pass the ticket as its UUID or number (#123). Answering, confirming, reopening and approving happen on the Desk page or where the request came from; these tools cannot do them. Requests filed by other people are not found.",
  operation: 'read',
  httpMethod: 'get',
  httpPath: `${MY_TICKETS_PATH}/{ticket}`,
  operationId: 'get_my_desk_ticket_api_v2_desk_my_tickets__ticket_ref__get',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['ticket'],
    properties: {
      ticket: {
        type: 'string',
        pattern: TICKET_REF_PATTERN,
        description: 'The request: its UUID or its number, such as #123.',
      },
    },
  },
  outputSchema: DETAIL_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const ticketRef = readString(args?.['ticket']);
    if (!ticketRef || !TICKET_REF.test(ticketRef)) {
      return asErrorResult(
        '`ticket` must be a Desk request UUID or number such as #123, from desk_list_my_tickets.',
      );
    }
    const response = await reqContext.client.get(`${MY_TICKETS_PATH}/${encodeURIComponent(ticketRef)}`);
    const ticket = envelopeData(response);
    return ticketResult(ticket, describeTicket(ticket));
  },
});

export const deskListMyTicketsTool = defineDeskTool({
  name: 'desk_list_my_tickets',
  title: 'List my Sanka Desk requests',
  description:
    "List the connected user's own IT requests with Sanka Desk, their company's IT service desk, newest first: number, title, state, who each waits for and where it came from (Slack, Teams, e-mail, the Desk page or an AI client). state picks open (the default), closed or all requests. Use desk_get_ticket_status for one request's questions and messages. Workspaces without Sanka Desk answer DESK_NOT_ENABLED.",
  operation: 'read',
  httpMethod: 'get',
  httpPath: MY_TICKETS_PATH,
  operationId: 'list_my_desk_tickets_api_v2_desk_my_tickets_get',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      state: {
        type: 'string',
        enum: [...STATE_FILTERS],
        description: 'open (the default), closed or all requests.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: LIST_MAX_LIMIT,
        description: `Requests to return, up to ${LIST_MAX_LIMIT} (default 20).`,
      },
    },
  },
  outputSchema: LIST_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const query: Record<string, string | number> = {};
    const state = readString(args?.['state']);
    if (state) query['state'] = state;
    const limit = args?.['limit'];
    if (typeof limit === 'number' && Number.isInteger(limit)) query['limit'] = limit;

    const data = envelopeData(await reqContext.client.get(MY_TICKETS_PATH, { query }));
    const items = (Array.isArray(data['items']) ? data['items'] : [])
      .map(readRecord)
      .filter((item): item is JsonRecord => Boolean(item));
    const total = typeof data['total'] === 'number' ? data['total'] : items.length;
    const scope = readString(data['state']) ?? state ?? 'open';
    const label = scope === 'all' ? 'Desk requests' : `${scope} Desk requests`;
    const lines =
      items.length > 0 ?
        [`${items.length} of ${total} ${label}:`, ...items.map(ticketLine)]
      : [`No ${label}.`];
    return ticketResult(data, lines);
  },
});

export type DeskAvailability = 'enabled' | 'not_enabled' | 'unknown';

/**
 * Whether Sanka Desk takes requests in this connection's workspace, from one read of the caller's
 * own open requests. `unknown` when the session is not connected or the read fails otherwise.
 */
export const readDeskAvailability = async (reqContext: McpRequestContext): Promise<DeskAvailability> => {
  if (reqContext.auth?.authMode === 'none') return 'unknown';
  try {
    await reqContext.client.get(MY_TICKETS_PATH, {
      query: { state: 'open', limit: 1 },
      maxRetries: 0,
      timeout: 5000,
    });
    return 'enabled';
  } catch (error) {
    return readDeskFailure(error)?.code === 'DESK_NOT_ENABLED' ? 'not_enabled' : 'unknown';
  }
};

export const deskTools: McpTool[] = [deskCreateTicketTool, deskGetTicketStatusTool, deskListMyTicketsTool];
