// Hand-written tools for the requester routes of Sanka Desk, the managed IT service desk
// (sanka-api docs/specs/desk/console-and-mcp.md §4). An employee files and follows their own IT
// requests from their AI client, and asks for Desk Actions (the changes Sanka Bot and Desk
// Workflows make, such as hubspot_account_setup) with the rules of each integration and Desk's
// approvals. A workspace admin also starts published Desk Workflows that run an Action (run only,
// never saved here), as the requester of the Action ticket the run opens. The routes sit outside the public developer OpenAPI contract, so the handlers call raw
// client paths. There is no approve tool: an approval is decided by a person signed in to Sanka,
// and these tools write nothing but the caller's own request.
import { createHash } from 'node:crypto';

import { readRecord, readString } from './tool-factories';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpRequestContext, McpTool, ToolCallResult } from './types';

type ToolArgs = Record<string, unknown> | undefined;
type JsonRecord = Record<string, unknown>;

const MY_TICKETS_PATH = '/api/v2/desk/my/tickets';
const MY_ACTIONS_PATH = '/api/v2/desk/my/actions';
const MY_WORKFLOWS_PATH = '/api/v2/desk/my/workflows';
const APPROVALS_PATH = '/api/v2/desk/approvals';
const SESSION_PATH = '/api/v2/auth/session';

const TEXT_MAX_LENGTH = 4000;
const LIST_MAX_LIMIT = 50;
const STATE_FILTERS = ['open', 'closed', 'all'] as const;
// A ticket UUID, or its number with or without the leading hash.
const TICKET_REF_PATTERN =
  '^(#?[0-9]{1,18}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$';
const TICKET_REF = new RegExp(TICKET_REF_PATTERN);
const PLAN_HASH_PATTERN = '^[0-9a-f]{64}$';
const OPERATION_KEY_MAX_LENGTH = 64;
const CLIENT_NAME_MAX_LENGTH = 80;
const APPROVALS_MAX_LIMIT = 100;
const WORKFLOW_ID_PATTERN = '^[0-9a-fA-F-]{36}$';

// A create without client_key sends one derived from the request: the same text about the same
// subject within one clock hour is one request, so a retried call returns the first ticket. The API
// scopes the key to the caller (intake key `client:{user_id}:{client_key}`).
const DERIVED_KEY_WINDOW_MS = 60 * 60 * 1000;
// A returned ticket received this long before the call began was filed by an earlier call.
const EARLIER_FILING_MS = 60 * 1000;

export const DESK_TOOL_NAMES = ['desk_create_ticket', 'desk_get_ticket_status', 'desk_list_my_tickets'];
// In the order an Action request uses them; an ordinary IT request is the fallback.
export const DESK_ACTION_TOOL_NAMES = [
  'desk_list_actions',
  'desk_preview_action',
  'desk_run_action',
  'desk_get_ticket_status',
  'desk_list_my_approvals',
  'desk_create_ticket',
];
// Starting a published Desk Workflow, then following the Action ticket it opens.
export const DESK_WORKFLOW_TOOL_NAMES = [
  'desk_list_workflows',
  'desk_preview_workflow',
  'desk_run_workflow',
  'desk_list_my_tickets',
  'desk_get_ticket_status',
  'desk_list_my_approvals',
];

const ASK_TO_FILE = 'Create this ticket?';
const ASK_TO_RUN = 'Run this workflow?';
const OFFER_TICKET =
  'Tell the person why, do not retry, and offer to file an ordinary IT request with desk_create_ticket so their IT team can decide.';

const STATE_LABELS: Record<string, string> = {
  received: 'received, waiting for Desk to pick it up',
  awaiting_requester: 'waiting for the requester to answer',
  awaiting_approval: 'waiting for approval',
  scheduled: 'approved, waiting for the date it runs',
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

type ApiFailure = { code: string; message: string; details: unknown; status?: number; ctxID?: string };

// An SDK APIError carries the V2 envelope as `error`, and the envelope its `error` body.
export const readApiFailure = (error: unknown): ApiFailure | undefined => {
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
  DESK_ACTION_NOT_ALLOWED: `The rule of the integration this Action runs on does not let this person start it. ${OFFER_TICKET}`,
  DESK_ACTION_SURFACE_OFF: `This workspace does not let AI clients start Actions on this integration. ${OFFER_TICKET}`,
  DESK_PLAN_CHANGED: `The plan is no longer the one the person confirmed. Call desk_preview_action again, show the new preview, ask "${ASK_TO_FILE}" again, and run only with the new plan_hash after their yes.`,
  DESK_CREDITS_REQUIRED:
    "The workspace's Sanka Credits ran out. Tell the person how many it needs and that a workspace admin can add Sanka Credits (desk_preview_action gives the credits page as credits_url); the Action can be run again after that.",
  DESK_OPERATION_NOT_IN_CATALOG:
    'This Action is not offered in this workspace; desk_list_actions lists the ones that are. Otherwise offer desk_create_ticket.',
  DESK_INPUT_INVALID:
    "The inputs do not match the Action's inputs_schema from desk_list_actions. Fix them with the person, then preview again.",
  DESK_PROVIDER_NOT_READY: `The integration this Action runs on is not connected or not ready in this workspace. ${OFFER_TICKET}`,
};

// Where starting a Desk Workflow reads them differently.
const WORKFLOW_ERROR_HINTS: Record<string, string> = {
  DESK_ADMIN_REQUIRED:
    'Only a workspace admin can start a Desk Workflow. Tell the person and do not retry; for a change they need, offer desk_list_actions or desk_create_ticket.',
  DESK_WORKFLOW_NOT_STARTABLE:
    'Only a workflow that is on and runs a Desk Action on a schedule can be started here (desk_list_workflows lists them); others run from the Desk console.',
  DESK_WORKFLOW_NOTHING_TO_RUN:
    'A run started now would open no Action ticket (details.skip_reason). Tell the person; do not retry.',
  DESK_SCHEDULED_RUN_ACTIVE:
    'This workflow is already running. Do not start it again; its Action ticket appears in desk_list_my_tickets.',
  DESK_SCHEDULED_WORKFLOW_NOT_FOUND:
    'There is no such workflow here; desk_list_workflows lists the ones the person can start.',
  DESK_ACTION_SURFACE_OFF: `This workspace does not let AI clients or Desk Workflows start Actions on this integration. ${OFFER_TICKET}`,
  DESK_PLAN_CHANGED: `The workflow or its plan changed since the preview. Call desk_preview_workflow again, show the new preview, ask "${ASK_TO_RUN}" again, and run only with the new plan_hash after their yes.`,
};

// A 4xx answer with a code changes nothing; anything else is left to the server's error handling.
const deskErrorResult = (
  error: unknown,
  lead: string,
  hints?: Record<string, string>,
): ToolCallResult | undefined => {
  const failure = readApiFailure(error);
  if (!failure || (failure.status !== undefined && failure.status >= 500)) return undefined;
  const hint = hints?.[failure.code] ?? DESK_ERROR_HINTS[failure.code];
  return {
    content: [
      {
        type: 'text',
        text: `${lead} (${failure.code}): ${failure.message}${hint ? ` ${hint}` : ''}`,
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
export const envelopeData = (response: unknown): JsonRecord =>
  readRecord(readRecord(response)?.['data']) ?? {};

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

// Who a change waits for and where they decide it. Nothing here decides an approval.
const approvalLines = (pending: JsonRecord | undefined): string[] => {
  const approvers = readString(pending?.['approvers']);
  const expiresAt = readString(pending?.['expires_at']);
  const approvalUrl = readString(pending?.['approval_url']);
  return [
    `It waits for approval${approvers ? ` by ${approvers}` : ''}${
      expiresAt ? ` until ${expiresAt}` : ''
    }; these tools cannot approve anything.`,
    ...(approvalUrl ?
      [
        `Approval page: ${approvalUrl} (give it to the person to pass on, or to open if they are an approver; an approver decides there or in Slack).`,
      ]
    : []),
  ];
};

// The status of one request in a few lines: state, what Desk asks, its latest message and the page.
const describeTicket = (ticket: JsonRecord): string[] => {
  const question = readString(ticket['pending_question']);
  const latest = latestDeskMessage(ticket);
  const latestBody = readString(latest?.['body']);
  const actions = (Array.isArray(ticket['available_actions']) ? ticket['available_actions'] : []).filter(
    (action): action is string => typeof action === 'string',
  );
  const consoleUrl = readString(ticket['console_url']);
  // "reply", "reply or withdraw", "reply, withdraw or escalate".
  const actionList =
    actions.length > 1 ? `${actions.slice(0, -1).join(', ')} or ${actions[actions.length - 1]}` : actions[0];
  return [
    `${readString(ticket['reference']) ?? '?'} "${readString(ticket['title']) ?? ''}": ${stateLabel(
      ticket,
    )}.`,
    ...(question ? [`Desk asks: ${question}`] : []),
    ...(latestBody && latestBody !== question ?
      [`Latest from Desk (${readString(latest?.['created_at']) ?? '?'}): ${latestBody}`]
    : []),
    ...(ticket['waiting_on'] === 'approval' ? approvalLines(readRecord(ticket['pending_approval'])) : []),
    ...(ticket['state_reason'] === 'credits_required' ?
      [
        "The change was cancelled because the workspace's Sanka Credits ran out (DESK_CREDITS_REQUIRED), and the request went to the company's IT. Tell the person; a workspace admin can add Sanka Credits, then the Action can be run again.",
      ]
    : []),
    ...(actionList ?
      [`The requester can ${actionList} on the Desk page or where the request came from; these tools cannot.`]
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

// The same parts within one clock hour give the same key.
const hourlyClientKey = (parts: unknown[], now: number): string => {
  const window = Math.floor(now / DERIVED_KEY_WINDOW_MS);
  const digest = createHash('sha256')
    .update(JSON.stringify([...parts, window]))
    .digest('hex');
  return `mcp-${digest.slice(0, 40)}`;
};

const derivedClientKey = (text: string, subjectEmail: string | undefined, now: number): string => {
  const normalized = text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  return hourlyClientKey([normalized, subjectEmail?.toLowerCase() ?? ''], now);
};

type SessionWorkspace = { id?: string; code?: string; name?: string };

// The workspace this connection resolves to, read the way the Desk routes resolve it.
export const sessionWorkspace = async (reqContext: McpRequestContext): Promise<SessionWorkspace> => {
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
  // Desk Actions get their own scopes, so an organisation can connect an AI client read-only.
  resource?: 'desk_tickets' | 'desk_actions';
  destructive?: boolean;
  // How a refused call starts; by default "Nothing was filed" for writes.
  failureLead?: string;
  // Error hints that replace DESK_ERROR_HINTS for this tool.
  errorHints?: Record<string, string>;
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
    resource: definition.resource ?? 'desk_tickets',
    operation: definition.operation,
    tags: ['desk', definition.resource === 'desk_actions' ? 'it_actions' : 'it_requests'],
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
      destructiveHint: definition.destructive ?? false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: definition.title });
    if (authError) return authError;
    try {
      return await definition.run(reqContext, args);
    } catch (error) {
      const result = deskErrorResult(
        error,
        definition.failureLead ??
          (definition.operation === 'write' ? 'Nothing was filed' : 'Could not read Desk requests'),
        definition.errorHints,
      );
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
    "Read one of the connected user's own IT requests with Sanka Desk, their company's IT service desk, including those desk_run_action filed: its state, who it waits for, the question Desk asks, the latest messages and the Desk page link. While it waits for approval it gives the approval page (pending_approval.approval_url): give it to the person; never try to approve. state_reason credits_required means the Sanka Credits ran out and the change was cancelled: say so, and that a workspace admin can add credits. Pass the ticket as its UUID or number (#123). Answering, confirming, reopening and approving happen on the Desk page or where the request came from; these tools cannot do them. Requests filed by other people are not found.",
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

// --- Desk Actions --------------------------------------------------------------------------------

const ACCESS_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  description:
    "What the integration's rule lets this person do: run, request (always waits for an approver) or none (refused).",
  properties: {
    mode: { type: 'string', enum: ['run', 'request', 'none'] },
    reason: { type: 'string' },
    system: NULLABLE_STRING,
    approval_required: { type: 'boolean' },
    surface: { type: 'string' },
  },
};

const ACTION_LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          operation_key: { type: 'string' },
          purpose: { type: 'string' },
          not_for: { type: 'string' },
          done_by_hand: { type: 'string' },
          systems: { type: 'array', items: { type: 'string' } },
          executable: { type: 'boolean' },
          access: ACCESS_SCHEMA,
          inputs_schema: { type: 'object', additionalProperties: true },
        },
      },
    },
    message: { type: 'string' },
  },
};

const DECISIONS = ['will_run', 'needs_approval', 'proposal', 'no_approver', 'not_allowed'];

const PREVIEW_PROPERTIES = {
  operation_key: { type: 'string' },
  decision: { type: 'string', enum: DECISIONS },
  access: ACCESS_SCHEMA,
  preview: {
    type: ['object', 'null'],
    additionalProperties: true,
    description: 'The plan: summary, risk_tier, items, approvals with eligible_labels, no_approver.',
  },
  credits: {
    type: ['object', 'null'],
    additionalProperties: true,
    description: 'Sanka Credits it is quoted at (total) and what the workspace has (available).',
  },
  credits_short: { type: 'boolean' },
  credits_url: { type: 'string', description: 'Where a workspace admin adds Sanka Credits.' },
  plan_hash: { ...NULLABLE_STRING, description: 'Send it to desk_run_action after the person said yes.' },
  refusal: { type: ['object', 'null'], additionalProperties: true },
};

const PREVIEW_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: { ...PREVIEW_PROPERTIES, message: { type: 'string' } },
};

const RUN_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    ticket: { type: 'object', properties: DETAIL_PROPERTIES, additionalProperties: true },
    preview: { type: 'object', properties: PREVIEW_PROPERTIES, additionalProperties: true },
    client_key: { type: 'string', description: 'The idempotency key sent; reuse it to retry this run.' },
    workspace_id: { type: 'string' },
    message: { type: 'string' },
  },
};

const APPROVALS_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: { type: 'string' },
          operation_key: { type: 'string' },
          risk_tier: { type: 'string' },
          summary: { type: 'string' },
          expires_at: { type: 'string' },
          ticket: { type: 'object', additionalProperties: true },
          approval_url: { ...NULLABLE_STRING, description: 'Where the approver decides it.' },
        },
      },
    },
    total: { type: 'integer' },
    message: { type: 'string' },
  },
};

const OPERATION_KEY_SCHEMA = {
  type: 'string',
  minLength: 1,
  maxLength: OPERATION_KEY_MAX_LENGTH,
  description: 'The Action, from desk_list_actions, such as hubspot_account_setup.',
};

const INPUTS_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  description: "The Action's inputs, matching its inputs_schema from desk_list_actions.",
};

const records = (value: unknown): JsonRecord[] =>
  (Array.isArray(value) ? value : []).map(readRecord).filter((item): item is JsonRecord => Boolean(item));

const strings = (value: unknown): string[] =>
  (Array.isArray(value) ? value : []).filter((item): item is string => typeof item === 'string');

const actionLine = (action: JsonRecord): string => {
  const access = readRecord(action['access']);
  const schema = readRecord(action['inputs_schema']);
  const required = new Set(strings(schema?.['required']));
  const inputs = Object.keys(readRecord(schema?.['properties']) ?? {}).map((name) =>
    required.has(name) ? `${name}*` : name,
  );
  const systems = strings(action['systems']);
  return [
    `- ${readString(action['operation_key']) ?? '?'}: ${readString(action['purpose']) ?? ''}`,
    ...(systems.length > 0 ? [`on ${systems.join(', ')}`] : []),
    `you may: ${readString(access?.['mode']) ?? '?'}`,
    action['executable'] === false ? 'Desk prepares it and IT carries it out' : 'automatic',
    ...(inputs.length > 0 ? [`inputs: ${inputs.join(', ')}`] : []),
  ].join(' · ');
};

const creditsLine = (preview: JsonRecord, billing = 'billed like Sanka Bot'): string | undefined => {
  const credits = readRecord(preview['credits']);
  if (!credits) return undefined;
  const line = `Sanka Credits: ${String(credits['total'] ?? '?')}, ${billing} (the workspace has ${String(
    credits['available'] ?? '?',
  )}).`;
  if (preview['credits_short'] !== true) return line;
  return `${line} That is not enough: tell the person the Sanka Credits ran out and that a workspace admin can add them at ${
    readString(preview['credits_url']) ?? 'the credits page'
  }. Filed now, the change is cancelled when Desk takes the credits before the first change.`;
};

// What would happen if the person files the Action now.
const decisionLine = (preview: JsonRecord): string => {
  const plan = readRecord(preview['preview']);
  const approvals = records(plan?.['approvals']).map((approval) => {
    const labels = strings(approval['eligible_labels']);
    return `${readString(approval['slot']) ?? '?'}${labels.length > 0 ? ` (${labels.join(', ')})` : ''}`;
  });
  switch (preview['decision']) {
    case 'will_run':
      return 'Once filed, Desk makes this change without waiting for anyone.';
    case 'needs_approval':
      return `Once filed, it waits for approval by ${approvals.join(
        ' and ',
      )}; an approver decides it in Sanka, never these tools.`;
    case 'proposal':
      return "Once filed, Desk prepares it and the company's IT carries it out.";
    case 'no_approver':
      return "Nobody could approve it, so once filed it goes to the company's IT.";
    default:
      return '';
  }
};

const previewLines = (preview: JsonRecord, billing?: string): string[] => {
  const plan = readRecord(preview['preview']);
  const reasons = strings(plan?.['risk_reasons']);
  const credits = creditsLine(preview, billing);
  return [
    `${readString(preview['operation_key']) ?? '?'}: ${readString(plan?.['summary']) ?? ''}`,
    ...records(plan?.['items']).map(
      (item) =>
        `- ${readString(item['system']) ?? '?'} ${readString(item['action']) ?? '?'} (${
          readString(item['execution_mode']) ?? 'automatic'
        })`,
    ),
    `Risk ${readString(plan?.['risk_tier']) ?? '?'}${reasons.length > 0 ? ` (${reasons.join(', ')})` : ''}.`,
    decisionLine(preview),
    ...(credits ? [credits] : []),
  ];
};

export const deskListActionsTool = defineDeskTool({
  name: 'desk_list_actions',
  title: 'List the Sanka Desk Actions I can ask for',
  description:
    "List the Sanka Desk Actions the connected person can ask for in this workspace: the changes Sanka Bot and Desk Workflows make in the company's systems, such as setting up or removing a HubSpot, Salesforce, Google, Okta, Microsoft 365, Slack or Sanka Flow account, giving access, assigning a license, a Gmail setting or a Google Calendar change (sharing a calendar, a meeting room, handing over meetings, scheduling an interview). Each has its purpose, what it is not for, the systems it touches, whether Desk makes the change or IT carries it out, what the integration's rule lets this person do (access.mode run, request = always waits for an approver, none = refused) and the JSON Schema of its inputs. Pick the Action that fits, then call desk_preview_action; when none fits or the mode is none, offer to file an ordinary IT request with desk_create_ticket.",
  operation: 'read',
  resource: 'desk_actions',
  failureLead: 'Could not read Desk Actions',
  httpMethod: 'get',
  httpPath: MY_ACTIONS_PATH,
  operationId: 'list_my_desk_actions_api_v2_desk_my_actions_get',
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  outputSchema: ACTION_LIST_OUTPUT_SCHEMA,
  run: async (reqContext) => {
    const data = envelopeData(await reqContext.client.get(MY_ACTIONS_PATH));
    const items = records(data['items']);
    const lines =
      items.length > 0 ?
        [
          `${items.length} Desk Actions the person can ask for here (* = required input):`,
          ...items.map(actionLine),
          'Preview the one that fits with desk_preview_action before filing anything.',
        ]
      : [
          'No Desk Actions are offered to this person here. Offer to file an IT request with desk_create_ticket.',
        ];
    return ticketResult(data, lines);
  },
});

export const deskPreviewActionTool = defineDeskTool({
  name: 'desk_preview_action',
  title: 'Preview a Sanka Desk Action',
  description: `Preview a Sanka Desk Action from desk_list_actions with its inputs, as the connected person, with nothing filed and nothing changed: the integration's rule (decision will_run, needs_approval, proposal, no_approver or not_allowed), the planned changes, the risk, who would approve it, the Sanka Credits it costs (billed like Sanka Bot) against what the workspace has, and the plan_hash. Show the preview to the person and ask "${ASK_TO_FILE}"; call desk_run_action only after their yes. When credits_short is true, tell them first that the workspace's Sanka Credits ran out and that a workspace admin can add them at credits_url. When the decision is not_allowed, give the refusal's reason and offer to file an ordinary IT request with desk_create_ticket instead.`,
  operation: 'read',
  resource: 'desk_actions',
  failureLead: 'Could not preview the Desk Action',
  httpMethod: 'post',
  httpPath: `${MY_ACTIONS_PATH}/preview`,
  operationId: 'preview_my_desk_action_api_v2_desk_my_actions_preview_post',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['operation_key', 'inputs'],
    properties: { operation_key: OPERATION_KEY_SCHEMA, inputs: INPUTS_SCHEMA },
  },
  outputSchema: PREVIEW_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const operationKey = readString(args?.['operation_key']);
    const inputs = readRecord(args?.['inputs']);
    if (!operationKey || !inputs) {
      return asErrorResult(
        '`operation_key` and `inputs` are required: pick the Action from desk_list_actions.',
      );
    }
    const preview = envelopeData(
      await reqContext.client.post(`${MY_ACTIONS_PATH}/preview`, {
        body: { operation_key: operationKey, inputs },
      }),
    );
    if (preview['decision'] === 'not_allowed') {
      const refusal = readRecord(preview['refusal']);
      return ticketResult(preview, [
        `${operationKey} is not allowed for this person here (${readString(refusal?.['code']) ?? '?'}): ${
          readString(refusal?.['message']) ?? ''
        }`,
        `Nothing was filed. ${OFFER_TICKET}`,
      ]);
    }
    return ticketResult(preview, [
      ...previewLines(preview),
      `Nothing was filed. Show this to the person and ask "${ASK_TO_FILE}". Only after their yes, call desk_run_action with the same operation_key and inputs, plan_hash "${
        readString(preview['plan_hash']) ?? ''
      }" and confirmed: true.`,
    ]);
  },
});

export const deskRunActionTool = defineDeskTool({
  name: 'desk_run_action',
  title: 'File a Sanka Desk Action the person confirmed',
  description: `File a Sanka Desk Action as a Desk ticket for the connected person, after desk_preview_action and only after the person answered yes to "${ASK_TO_FILE}" with the preview in front of them. Pass the same operation_key and inputs, the preview's plan_hash and confirmed: true. Sanka Bot then plans it with Desk's approvals, and it is billed like Sanka Bot in Sanka Credits. Nothing is filed when the rule refuses it (DESK_ACTION_NOT_ALLOWED, DESK_ACTION_SURFACE_OFF: say why and offer desk_create_ticket) or when the plan changed (DESK_PLAN_CHANGED: preview again and ask again). When it needs approval, give the person the approval page from desk_get_ticket_status; never try to approve. Follow it with desk_get_ticket_status; a run later cancelled for DESK_CREDITS_REQUIRED means the Sanka Credits ran out: tell the person a workspace admin can add them. Retrying with the same client_key returns the first ticket.`,
  operation: 'write',
  resource: 'desk_actions',
  destructive: true,
  httpMethod: 'post',
  httpPath: `${MY_ACTIONS_PATH}/run`,
  operationId: 'run_my_desk_action_api_v2_desk_my_actions_run_post',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['operation_key', 'inputs', 'plan_hash', 'confirmed'],
    properties: {
      operation_key: OPERATION_KEY_SCHEMA,
      inputs: INPUTS_SCHEMA,
      plan_hash: {
        type: 'string',
        pattern: PLAN_HASH_PATTERN,
        description: 'The plan_hash of the preview the person confirmed.',
      },
      confirmed: {
        type: 'boolean',
        const: true,
        description: `true only after the person answered yes to "${ASK_TO_FILE}" with the preview shown.`,
      },
      client_key: {
        type: 'string',
        minLength: 8,
        maxLength: 100,
        description: 'Idempotency key. A retry with the same key returns the first ticket.',
      },
      client_name: {
        type: 'string',
        maxLength: CLIENT_NAME_MAX_LENGTH,
        description: 'The AI client asking, such as Claude or Codex, for the ticket note.',
      },
    },
  },
  outputSchema: RUN_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const startedAt = Date.now();
    if (args?.['confirmed'] !== true) {
      return asErrorResult(
        `Nothing was filed: \`confirmed\` must be true, and only after the person answered yes to "${ASK_TO_FILE}" with the preview from desk_preview_action.`,
      );
    }
    const operationKey = readString(args?.['operation_key']);
    const inputs = readRecord(args?.['inputs']);
    const planHash = readString(args?.['plan_hash']);
    if (!operationKey || !inputs || !planHash || !new RegExp(PLAN_HASH_PATTERN).test(planHash)) {
      return asErrorResult(
        'Nothing was filed: pass the operation_key, inputs and plan_hash of the preview the person confirmed (desk_preview_action).',
      );
    }
    const clientName = readString(args?.['client_name']);
    const clientKey =
      readString(args?.['client_key']) ?? hourlyClientKey(['desk-action', operationKey, planHash], startedAt);

    // MCP writes name their workspace: the API refuses a mismatch with 409 and files nothing.
    const workspace = await sessionWorkspace(reqContext);
    if (!workspace.id) {
      return asErrorResult(
        'No Sanka workspace is selected for this connection, so nothing was filed. Pick one with list_workspaces and switch_workspace, then retry.',
      );
    }
    const data = envelopeData(
      await reqContext.client.post(`${MY_ACTIONS_PATH}/run`, {
        body: {
          operation_key: operationKey,
          inputs,
          plan_hash: planHash,
          confirmed: true,
          client_key: clientKey,
          ...(clientName ? { client_name: clientName } : undefined),
        },
        headers: { 'X-Sanka-MCP': 'true', 'X-Sanka-Expected-Workspace-ID': workspace.id },
        maxRetries: 0,
      }),
    );
    const ticket = readRecord(data['ticket']) ?? {};
    const preview = readRecord(data['preview']) ?? {};
    const reference = readString(ticket['reference']) ?? readString(ticket['id']) ?? '?';
    const receivedAt = Date.parse(readString(ticket['received_at']) ?? '');
    const desk = `the IT service desk of ${workspace.name ?? workspace.code ?? workspace.id}`;
    const credits = preview['credits_short'] === true ? creditsLine(preview) : undefined;
    return ticketResult(
      data,
      [
        receivedAt < startedAt - EARLIER_FILING_MS ?
          `${operationKey} was already filed with ${desk} as ${reference}; Desk returned it instead of filing a duplicate.`
        : `Filed ${operationKey} with ${desk} as ${reference}.`,
        decisionLine(preview),
        ...(credits ? [credits] : []),
        ...describeTicket(ticket),
        `Follow it with desk_get_ticket_status (ticket "${reference}"); it gives the approval page while the change waits for approval.`,
      ].filter(Boolean),
      { ok: true, status: 'filed', client_key: clientKey, workspace_id: workspace.id },
    );
  },
});

export const deskListMyApprovalsTool = defineDeskTool({
  name: 'desk_list_my_approvals',
  title: 'List the Sanka Desk approvals waiting for me',
  description:
    "List the Sanka Desk approvals waiting for the connected person's decision, newest first: the request, the Action, its risk, when the approval expires and its approval page (approval_url). This tool cannot approve or reject anything, and no tool can: the person decides on the approval page in Sanka or with the Slack buttons, so give them the link.",
  operation: 'read',
  resource: 'desk_actions',
  failureLead: 'Could not read Desk approvals',
  httpMethod: 'get',
  httpPath: APPROVALS_PATH,
  operationId: 'list_desk_approvals_api_v2_desk_approvals_get',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: APPROVALS_MAX_LIMIT,
        description: `Approvals to return, up to ${APPROVALS_MAX_LIMIT} (default 25).`,
      },
    },
  },
  outputSchema: APPROVALS_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const query: Record<string, string | number> = { status: 'pending', approver: 'me' };
    const limit = args?.['limit'];
    if (typeof limit === 'number' && Number.isInteger(limit)) query['page_size'] = limit;
    const data = envelopeData(await reqContext.client.get(APPROVALS_PATH, { query }));
    const items = records(data['items']);
    const total = typeof data['total'] === 'number' ? data['total'] : items.length;
    const lines =
      items.length > 0 ?
        [
          `${items.length} of ${total} Desk approvals wait for this person:`,
          ...items.map((item) => {
            const ticket = readRecord(item['ticket']);
            const number = ticket?.['number'];
            return [
              `- ${typeof number === 'number' ? `#${number}` : '?'} "${readString(ticket?.['title']) ?? ''}"`,
              readString(item['operation_key']) ?? '?',
              `risk ${readString(item['risk_tier']) ?? '?'}`,
              ...(readString(ticket?.['requester_email']) ?
                [`for ${readString(ticket?.['requester_email'])}`]
              : []),
              `expires ${readString(item['expires_at']) ?? '?'}`,
              `approval page ${readString(item['approval_url']) ?? '?'}`,
            ].join(' · ');
          }),
          'The person decides on the approval page or in Slack; these tools cannot approve or reject.',
        ]
      : ['No Desk approvals wait for this person.'];
    return ticketResult(data, lines);
  },
});

// --- Desk Workflows --------------------------------------------------------------------------------

const WORKFLOW_BILLING = "billed as the workflow's Action";
const SKIP_REASONS: Record<string, string> = {
  kill_switch: 'a kill switch stops every Desk Workflow in this workspace',
  no_matches: 'no ticket meets its conditions now',
  earlier_ticket_open: 'the Action ticket of an earlier run is still open',
};

const WORKFLOW_ID_SCHEMA = {
  type: 'string',
  pattern: WORKFLOW_ID_PATTERN,
  description: 'The workflow id, from desk_list_workflows.',
};

const WORKFLOW_PREVIEW_PROPERTIES = {
  workflow_id: { type: 'string' },
  name: { type: 'string' },
  decision: { type: 'string', enum: [...DECISIONS, 'nothing_to_run'] },
  skip_reason: {
    ...NULLABLE_STRING,
    description: 'Why a run would open nothing: kill_switch, no_matches, earlier_ticket_open.',
  },
  open_ticket_id: NULLABLE_STRING,
  matched: { type: 'integer' },
  action: {
    type: ['object', 'null'],
    properties: PREVIEW_PROPERTIES,
    additionalProperties: true,
    description: "The Action ticket's plan with the person as requester.",
  },
  plan_hash: { ...NULLABLE_STRING, description: 'Send it to desk_run_workflow after the person said yes.' },
};

const WORKFLOW_LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          has_conditions: { type: 'boolean' },
          ticket_steps: { type: 'array', items: { type: 'string' } },
          action: { type: 'object', additionalProperties: true, properties: { access: ACCESS_SCHEMA } },
          last_run: { type: ['object', 'null'], additionalProperties: true },
        },
      },
    },
    stopped: { type: 'boolean', description: 'A kill switch stops every workflow.' },
    message: { type: 'string' },
  },
};

const WORKFLOW_PREVIEW_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: { ...WORKFLOW_PREVIEW_PROPERTIES, message: { type: 'string' } },
};

const WORKFLOW_RUN_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    run: { type: 'object', additionalProperties: true, description: 'The run: id, status, trigger.' },
    preview: {
      type: ['object', 'null'],
      properties: WORKFLOW_PREVIEW_PROPERTIES,
      additionalProperties: true,
    },
    replayed: { type: 'boolean', description: 'client_key returned a run an earlier call started.' },
    client_key: { type: 'string', description: 'The idempotency key sent; reuse it to retry this run.' },
    workspace_id: { type: 'string' },
    message: { type: 'string' },
  },
};

const workflowLine = (workflow: JsonRecord): string => {
  const action = readRecord(workflow['action']);
  const access = readRecord(action?.['access']);
  const lastRun = readRecord(workflow['last_run']);
  const steps = strings(workflow['ticket_steps']);
  return [
    `- "${readString(workflow['name']) ?? '?'}" (id ${readString(workflow['id']) ?? '?'})`,
    `runs ${readString(action?.['operation_key']) ?? '?'} with ${JSON.stringify(action?.['inputs'] ?? {})}`,
    `you may: ${readString(access?.['mode']) ?? '?'}${
      access?.['approval_required'] === true ? ' (always waits for an approver)' : ''
    }`,
    ...(workflow['has_conditions'] === true ? ['only when a ticket meets its conditions'] : []),
    ...(steps.length > 0 ? [`also ${steps.join(', ')} on those tickets`] : []),
    ...(lastRun ? [`last run ${readString(lastRun['status']) ?? '?'}`] : []),
  ].join(' · ');
};

const readWorkflowId = (args: ToolArgs): string | undefined => {
  const workflowId = readString(args?.['workflow_id']);
  return workflowId && new RegExp(WORKFLOW_ID_PATTERN).test(workflowId) ? workflowId : undefined;
};

export const deskListWorkflowsTool = defineDeskTool({
  name: 'desk_list_workflows',
  title: 'List the Sanka Desk Workflows I can start',
  description:
    "List the published Sanka Desk Workflows the connected person can start (a workspace admin): each runs a Desk Action on a schedule, such as setting up a HubSpot account. Each has the Action with its saved inputs and what the integration's rule lets this person do (access.mode). Starting one makes the person the requester of the Action ticket it opens. Preview it with desk_preview_workflow before running anything. Workflows are built and changed only on the Desk console; members get DESK_ADMIN_REQUIRED.",
  operation: 'read',
  resource: 'desk_actions',
  failureLead: 'Could not read Desk Workflows',
  errorHints: WORKFLOW_ERROR_HINTS,
  httpMethod: 'get',
  httpPath: MY_WORKFLOWS_PATH,
  operationId: 'list_my_desk_workflows_api_v2_desk_my_workflows_get',
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  outputSchema: WORKFLOW_LIST_OUTPUT_SCHEMA,
  run: async (reqContext) => {
    const data = envelopeData(await reqContext.client.get(MY_WORKFLOWS_PATH));
    const items = records(data['items']);
    const lines =
      items.length > 0 ?
        [
          `${items.length} Desk Workflows the person can start here:`,
          ...items.map(workflowLine),
          ...(data['stopped'] === true ?
            ['A kill switch stops every workflow: a run now does nothing.']
          : []),
          'Preview the one they want with desk_preview_workflow before running it.',
        ]
      : ['No published Desk Workflow runs a Desk Action here. desk_list_actions lists the Actions instead.'];
    return ticketResult(data, lines);
  },
});

export const deskPreviewWorkflowTool = defineDeskTool({
  name: 'desk_preview_workflow',
  title: 'Preview a Sanka Desk Workflow run',
  description: `Preview what starting a Sanka Desk Workflow from desk_list_workflows would do now, with nothing started and nothing changed: whether it opens its Action ticket (decision nothing_to_run with skip_reason if not), and that ticket's plan with the connected person as requester: the integration's rule (not_allowed when it refuses), the changes, risk, approvers, Sanka Credits and the plan_hash. Show it to the person and ask "${ASK_TO_RUN}"; call desk_run_workflow only after their yes. On not_allowed, give the reason and offer desk_create_ticket. When credits_short is true, say the workspace's Sanka Credits ran out and a workspace admin can add them at credits_url.`,
  operation: 'read',
  resource: 'desk_actions',
  failureLead: 'Could not preview the Desk Workflow',
  errorHints: WORKFLOW_ERROR_HINTS,
  httpMethod: 'post',
  httpPath: `${MY_WORKFLOWS_PATH}/{workflow_id}/preview`,
  operationId: 'preview_my_desk_workflow_api_v2_desk_my_workflows__workflow_id__preview_post',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['workflow_id'],
    properties: { workflow_id: WORKFLOW_ID_SCHEMA },
  },
  outputSchema: WORKFLOW_PREVIEW_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const workflowId = readWorkflowId(args);
    if (!workflowId)
      return asErrorResult('`workflow_id` is required: pick the workflow from desk_list_workflows.');
    const preview = envelopeData(
      await reqContext.client.post(`${MY_WORKFLOWS_PATH}/${encodeURIComponent(workflowId)}/preview`),
    );
    const name = `"${readString(preview['name']) ?? workflowId}"`;
    const action = readRecord(preview['action']) ?? {};
    if (preview['decision'] === 'nothing_to_run') {
      const reason = readString(preview['skip_reason']) ?? '';
      return ticketResult(preview, [
        `Starting ${name} now would open no Action ticket: ${SKIP_REASONS[reason] ?? reason}.`,
        'Nothing was started. Tell the person; do not run it.',
      ]);
    }
    if (preview['decision'] === 'not_allowed') {
      const refusal = readRecord(action['refusal']);
      return ticketResult(preview, [
        `${name} may not be started by this person here (${readString(refusal?.['code']) ?? '?'}): ${
          readString(refusal?.['message']) ?? ''
        }`,
        `Nothing was started. ${OFFER_TICKET}`,
      ]);
    }
    return ticketResult(preview, [
      `Workflow ${name} would open this Action ticket, with the person as requester:`,
      ...previewLines(action, WORKFLOW_BILLING),
      `Nothing was started. Show this to the person and ask "${ASK_TO_RUN}". Only after their yes, call desk_run_workflow with workflow_id "${workflowId}", plan_hash "${
        readString(preview['plan_hash']) ?? ''
      }" and confirmed: true.`,
    ]);
  },
});

export const deskRunWorkflowTool = defineDeskTool({
  name: 'desk_run_workflow',
  title: 'Start a Sanka Desk Workflow the person confirmed',
  description: `Start a published Sanka Desk Workflow for the connected person (a workspace admin), after desk_preview_workflow and only after they answered yes to "${ASK_TO_RUN}" with the preview in front of them. Pass the workflow_id, the preview's plan_hash and confirmed: true. The run opens its Action ticket with the person as requester; the Action keeps the integration's rule and Desk's approvals and uses Sanka Credits. Nothing starts when the rule refuses it (say why and offer desk_create_ticket), when the preview changed (DESK_PLAN_CHANGED: preview again and ask again) or when it would open nothing. Find the ticket with desk_list_my_tickets and follow it with desk_get_ticket_status, which gives the approval page; never try to approve. Retrying with the same client_key returns the first run. This never changes the workflow.`,
  operation: 'write',
  resource: 'desk_actions',
  destructive: true,
  failureLead: 'Nothing was started',
  errorHints: WORKFLOW_ERROR_HINTS,
  httpMethod: 'post',
  httpPath: `${MY_WORKFLOWS_PATH}/{workflow_id}/run`,
  operationId: 'run_my_desk_workflow_api_v2_desk_my_workflows__workflow_id__run_post',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['workflow_id', 'plan_hash', 'confirmed'],
    properties: {
      workflow_id: WORKFLOW_ID_SCHEMA,
      plan_hash: {
        type: 'string',
        pattern: PLAN_HASH_PATTERN,
        description: 'The plan_hash of the preview the person confirmed.',
      },
      confirmed: {
        type: 'boolean',
        const: true,
        description: `true only after the person answered yes to "${ASK_TO_RUN}" with the preview shown.`,
      },
      client_key: {
        type: 'string',
        minLength: 8,
        maxLength: 100,
        description: 'Idempotency key. A retry with the same key returns the first run.',
      },
    },
  },
  outputSchema: WORKFLOW_RUN_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    if (args?.['confirmed'] !== true) {
      return asErrorResult(
        `Nothing was started: \`confirmed\` must be true, and only after the person answered yes to "${ASK_TO_RUN}" with the preview from desk_preview_workflow.`,
      );
    }
    const workflowId = readWorkflowId(args);
    const planHash = readString(args?.['plan_hash']);
    if (!workflowId || !planHash || !new RegExp(PLAN_HASH_PATTERN).test(planHash)) {
      return asErrorResult(
        'Nothing was started: pass the workflow_id and plan_hash of the preview the person confirmed (desk_preview_workflow).',
      );
    }
    const clientKey =
      readString(args?.['client_key']) ??
      hourlyClientKey(['desk-workflow', workflowId, planHash], Date.now());

    // MCP writes name their workspace: the API refuses a mismatch with 409 and starts nothing.
    const workspace = await sessionWorkspace(reqContext);
    if (!workspace.id) {
      return asErrorResult(
        'No Sanka workspace is selected for this connection, so nothing was started. Pick one with list_workspaces and switch_workspace, then retry.',
      );
    }
    const data = envelopeData(
      await reqContext.client.post(`${MY_WORKFLOWS_PATH}/${encodeURIComponent(workflowId)}/run`, {
        body: { plan_hash: planHash, confirmed: true, client_key: clientKey },
        headers: { 'X-Sanka-MCP': 'true', 'X-Sanka-Expected-Workspace-ID': workspace.id },
        maxRetries: 0,
      }),
    );
    const run = readRecord(data['run']) ?? {};
    const preview = readRecord(data['preview']);
    const action = readRecord(preview?.['action']);
    const name = readString(preview?.['name']) ?? workflowId;
    const credits = action?.['credits_short'] === true ? creditsLine(action, WORKFLOW_BILLING) : undefined;
    return ticketResult(
      data,
      [
        data['replayed'] === true ?
          `An earlier call already started this run (${readString(run['id']) ?? '?'}, ${
            readString(run['status']) ?? '?'
          }); nothing new was started.`
        : `Started "${name}" in ${workspace.name ?? workspace.code ?? workspace.id} (run ${
            readString(run['id']) ?? '?'
          }, ${readString(run['status']) ?? '?'}).`,
        ...(action ? [decisionLine(action)] : []),
        ...(credits ? [credits] : []),
        'Its Action ticket names the person as requester and appears in desk_list_my_tickets once the run opens it; follow it with desk_get_ticket_status, which gives the approval page while it waits.',
      ].filter(Boolean),
      { ok: true, status: 'started', client_key: clientKey, workspace_id: workspace.id },
    );
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
    return readApiFailure(error)?.code === 'DESK_NOT_ENABLED' ? 'not_enabled' : 'unknown';
  }
};

export const deskTools: McpTool[] = [
  deskCreateTicketTool,
  deskGetTicketStatusTool,
  deskListMyTicketsTool,
  deskListActionsTool,
  deskPreviewActionTool,
  deskRunActionTool,
  deskListMyApprovalsTool,
  deskListWorkflowsTool,
  deskPreviewWorkflowTool,
  deskRunWorkflowTool,
];
