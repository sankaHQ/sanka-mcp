// Hand-written tools for Sanka Support tickets (sanka-api docs/specs/manage-support/api.md and
// docs/specs/support-chat/api.md). Two audiences:
//
// - Customers read their own tickets in the connected workspace, plus tickets a teammate shared.
//   They see open/closed and who answered (Sanka AI or Sanka Support), never the internal status,
//   the assignee or a staff member's name. They cannot reply from an AI client.
// - Support admins (the Support console gate and the /manage/* gate, enforced by the API for every
//   Sanka MCP token) read and work every ticket. Their tools are listed only for them
//   (supportToolsForListing); the API refuses everyone else regardless.
import { createHash } from 'node:crypto';

import { envelopeData, readApiFailure } from './desk-tools';
import { readRecord, readString } from './tool-factories';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpRequestContext, McpTool, ToolCallResult } from './types';

type ToolArgs = Record<string, unknown> | undefined;
type JsonRecord = Record<string, unknown>;

const CUSTOMER_THREADS_PATH = '/api/v2/support/threads';
const ADMIN_PATH = '/api/v2/manage-support';
const ADMIN_ACCESS_PATH = `${ADMIN_PATH}/access`;
const SESSION_PATH = '/api/v2/auth/session';

const CUSTOMER_LIST_MAX = 50;
const ADMIN_LIST_MAX = 100;
const MESSAGES_DEFAULT = 30;
const MESSAGES_MAX = 200;
const REPLY_MAX_LENGTH = 20000;
const TITLE_MAX_LENGTH = 200;

const TICKET_STATES = ['open', 'closed'] as const;
const STATE_FILTERS = ['open', 'closed', 'all'] as const;
const INTERNAL_STATUSES = ['todo', 'doing', 'feature_pending', 'done', 'archived'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SUPPORT_CUSTOMER_TOOL_NAMES = ['support_list_my_tickets', 'support_get_my_ticket'];
export const SUPPORT_ADMIN_TOOL_NAMES = [
  'support_admin_list_tickets',
  'support_admin_get_ticket',
  'support_admin_list_agents',
  'support_admin_update_ticket',
  'support_admin_reply',
];
const ADMIN_TOOL_NAME_SET = new Set(SUPPORT_ADMIN_TOOL_NAMES);

// Who wrote a message, as the reader is allowed to know it.
const ROLE_LABELS: Record<string, string> = {
  user: 'customer',
  ai: 'Sanka AI',
  presentation: 'Sanka AI',
  human: 'Sanka Support',
};

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: { message: { type: 'string' } },
};

const result = (data: JsonRecord, lines: string[]): ToolCallResult => {
  const message = lines.join('\n');
  return { content: [{ type: 'text', text: message }], structuredContent: { ...data, message } };
};

const records = (value: unknown): JsonRecord[] =>
  (Array.isArray(value) ? value : []).map(readRecord).filter((item): item is JsonRecord => !!item);

const clampInt = (value: unknown, fallback: number, max: number): number =>
  typeof value === 'number' && Number.isInteger(value) ? Math.min(Math.max(value, 1), max) : fallback;

const pickEnum = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

const attachmentNames = (message: JsonRecord): string[] =>
  records(message['attachments'])
    .map((attachment) => readString(attachment['file_name']))
    .filter((name): name is string => !!name);

// The latest messages, oldest first, and whether earlier ones were left out.
const lastMessages = (messages: JsonRecord[], max: number) => ({
  messages: messages.slice(-max),
  omitted: Math.max(messages.length - max, 0),
});

// Whether Sanka (AI or Support) has answered, and who the ticket now waits for.
const replySummary = (messages: JsonRecord[]) => {
  const fromSanka = messages.filter((message) => readString(message['role']) !== 'user');
  const last = messages[messages.length - 1];
  const lastRole = readString(last?.['role']);
  return {
    replied_by_sanka_ai: fromSanka.some(
      (message) => ROLE_LABELS[readString(message['role']) ?? ''] === 'Sanka AI',
    ),
    replied_by_sanka_support: fromSanka.some((message) => readString(message['role']) === 'human'),
    last_reply_from: lastRole ? ROLE_LABELS[lastRole] ?? lastRole : null,
    waiting_on:
      !last ? 'sanka'
      : lastRole === 'user' ? 'sanka'
      : 'customer',
  };
};

type FailureCopy = { notFound: string; forbidden: string; write: boolean };

// A 4xx answer becomes a tool error the model can act on; anything else is left to the server.
const supportErrorResult = (error: unknown, copy: FailureCopy): ToolCallResult | undefined => {
  const failure = readApiFailure(error);
  const status = failure?.status ?? readRecord(error)?.['status'];
  if (typeof status !== 'number' || status >= 500) return undefined;
  const hint =
    status === 404 ? copy.notFound
    : status === 403 ? copy.forbidden
    : '';
  const prefix = copy.write ? 'Nothing was changed' : 'Could not read support tickets';
  const text = `${prefix} (${failure?.code || status}): ${failure?.message ?? 'Request refused.'}${
    hint ? ` ${hint}` : ''
  }`;
  return {
    content: [{ type: 'text', text }],
    isError: true,
    structuredContent: {
      ok: false,
      status: 'error',
      status_code: status,
      code: failure?.code,
      message: text,
      ctx_id: failure?.ctxID,
    },
  };
};

const CUSTOMER_NOT_FOUND =
  'Only tickets you opened, or that a teammate shared, in the connected workspace can be read. A ticket in another workspace needs switch_workspace first; support_list_my_tickets lists the ones you can read.';
const ADMIN_FORBIDDEN = 'Support admin tools need a Sanka account with Support console and /manage/* access.';

type SupportToolDefinition = {
  name: string;
  title: string;
  description: string;
  operation: 'read' | 'write';
  httpMethod: 'get' | 'post' | 'patch';
  httpPath: string;
  operationId: string;
  inputSchema: McpTool['tool']['inputSchema'];
  destructive?: boolean;
  idempotent?: boolean;
  failure: FailureCopy;
  run: (reqContext: McpRequestContext, args: ToolArgs) => Promise<ToolCallResult>;
};

const defineSupportTool = (definition: SupportToolDefinition): McpTool => ({
  metadata: {
    resource: 'support_tickets',
    operation: definition.operation,
    tags: ['support', ...(ADMIN_TOOL_NAME_SET.has(definition.name) ? ['support_admin'] : [])],
    httpMethod: definition.httpMethod,
    httpPath: definition.httpPath,
    operationId: definition.operationId,
  },
  tool: {
    name: definition.name,
    title: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: definition.title,
      readOnlyHint: definition.operation === 'read',
      destructiveHint: definition.destructive ?? false,
      ...(definition.idempotent !== undefined ? { idempotentHint: definition.idempotent } : undefined),
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: definition.title });
    if (authError) return authError;
    try {
      return await definition.run(reqContext, args);
    } catch (error) {
      const failure = supportErrorResult(error, definition.failure);
      if (failure) return failure;
      throw error;
    }
  },
});

// ---------------------------------------------------------------- customer tools

// What a customer may see of a ticket: no internal status, assignee or AI triage fields.
const customerTicket = (thread: JsonRecord): JsonRecord => ({
  id: readString(thread['id']),
  title: readString(thread['title']) ?? '',
  ticket_state: readString(thread['ticket_state']) ?? 'open',
  closed_at: thread['ticket_closed_at'] ?? null,
  channel: readString(thread['channel_label']) ?? readString(thread['primary_transport']) ?? null,
  shared_to_workspace: thread['shared_to_workspace'] === true,
  opened_by_you: thread['can_share'] === true,
  last_message_at: thread['last_message_at'] ?? null,
  updated_at: thread['updated_at'] ?? null,
  unread: thread['unread'] === true,
  ...(readString(thread['preview']) ? { preview: readString(thread['preview']) } : undefined),
});

const customerMessage = (message: JsonRecord): JsonRecord => {
  const role = readString(message['role']) ?? '';
  const author = readRecord(message['author']);
  return {
    id: readString(message['id']),
    from: ROLE_LABELS[role] ?? role,
    // Staff replies carry no author: customers see Sanka Support, not the person.
    ...(role === 'user' && author ?
      { author_name: readString(author['name']) || readString(author['email']) || null }
    : undefined),
    content: readString(message['content']) ?? '',
    created_at: message['created_at'] ?? null,
    ...(attachmentNames(message).length ? { attachments: attachmentNames(message) } : undefined),
  };
};

export const supportListMyTicketsTool = defineSupportTool({
  name: 'support_list_my_tickets',
  title: 'List my Sanka Support tickets',
  description:
    "List the Sanka Support tickets the connected user opened, plus tickets a teammate shared, in the connected workspace, newest first: id, title, open or closed, channel and whether there is an unread reply. Read only: replying is done in Sanka. Not for Sanka Desk IT requests (desk_*) or Flow ticket records. Use support_get_my_ticket for one ticket's conversation. Tickets in another workspace need switch_workspace first.",
  operation: 'read',
  httpMethod: 'get',
  httpPath: CUSTOMER_THREADS_PATH,
  operationId: 'list_support_threads_api_v2_support_threads_get',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      state: { type: 'string', enum: [...STATE_FILTERS], description: 'open (the default), closed or all.' },
      query: { type: 'string', maxLength: 200, description: 'Optional text in the title or latest message.' },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: CUSTOMER_LIST_MAX,
        description: `Tickets to return, up to ${CUSTOMER_LIST_MAX} (default 20).`,
      },
    },
  },
  failure: { notFound: CUSTOMER_NOT_FOUND, forbidden: CUSTOMER_NOT_FOUND, write: false },
  run: async (reqContext, args) => {
    const state = pickEnum(args?.['state'], STATE_FILTERS) ?? 'open';
    const query = readString(args?.['query']);
    const limit = clampInt(args?.['limit'], 20, CUSTOMER_LIST_MAX);
    const data = envelopeData(
      await reqContext.client.get(CUSTOMER_THREADS_PATH, { query: query ? { q: query } : {} }),
    );
    const tickets = records(data['threads'])
      .map(customerTicket)
      .filter((ticket) => state === 'all' || ticket['ticket_state'] === state)
      .slice(0, limit);
    const lines =
      tickets.length ?
        [
          `${tickets.length} ${state === 'all' ? '' : `${state} `}support ticket(s):`,
          ...tickets.map(
            (ticket) =>
              `- "${ticket['title']}" · ${ticket['ticket_state']}${
                ticket['unread'] ? ' · unread reply' : ''
              } · id ${ticket['id']}`,
          ),
        ]
      : [`No ${state === 'all' ? '' : `${state} `}support tickets in this workspace.`];
    return result({ tickets, state }, lines);
  },
});

export const supportGetMyTicketTool = defineSupportTool({
  name: 'support_get_my_ticket',
  title: 'Get my Sanka Support ticket',
  description:
    'Read one Sanka Support ticket the connected user can see: open or closed, whether Sanka AI or Sanka Support has replied, who it now waits for, its closing and reopening history and the conversation (latest messages first trimmed to max_messages). Read only. Pass the ticket id from support_list_my_tickets.',
  operation: 'read',
  httpMethod: 'get',
  httpPath: `${CUSTOMER_THREADS_PATH}/{thread_id}`,
  operationId: 'support_thread_detail_api_v2_support_threads__thread_id__get',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['ticket_id'],
    properties: {
      ticket_id: { type: 'string', description: 'The ticket id (a UUID) from support_list_my_tickets.' },
      max_messages: {
        type: 'integer',
        minimum: 1,
        maximum: MESSAGES_MAX,
        description: `Latest messages to include (default ${MESSAGES_DEFAULT}).`,
      },
    },
  },
  failure: { notFound: CUSTOMER_NOT_FOUND, forbidden: CUSTOMER_NOT_FOUND, write: false },
  run: async (reqContext, args) => {
    const ticketId = readString(args?.['ticket_id']);
    if (!ticketId || !UUID.test(ticketId)) {
      return asErrorResult('`ticket_id` must be a ticket id (UUID) from support_list_my_tickets.');
    }
    const max = clampInt(args?.['max_messages'], MESSAGES_DEFAULT, MESSAGES_MAX);
    const data = envelopeData(
      await reqContext.client.get(`${CUSTOMER_THREADS_PATH}/${encodeURIComponent(ticketId)}`),
    );
    const ticket = customerTicket(readRecord(data['thread']) ?? {});
    const allMessages = records(data['messages']);
    const summary = replySummary(allMessages);
    const { messages, omitted } = lastMessages(allMessages, max);
    const history = records(data['ticket_events']).map((event) => ({
      type: readString(event['type']),
      by: readString(event['by']),
      at: event['created_at'] ?? null,
    }));
    const lines = [
      `"${ticket['title']}" is ${ticket['ticket_state']}.`,
      summary.replied_by_sanka_support ? 'Sanka Support has replied.'
      : summary.replied_by_sanka_ai ? 'Sanka AI has replied; Sanka Support has not yet.'
      : 'No reply from Sanka yet.',
      summary.waiting_on === 'sanka' ? 'It waits for Sanka.' : 'The latest message is from Sanka.',
      `${messages.length} message(s)${omitted ? `, ${omitted} earlier omitted` : ''}.`,
    ];
    return result(
      {
        ticket: { ...ticket, ...summary },
        history,
        messages: messages.map(customerMessage),
        omitted_messages: omitted,
      },
      lines,
    );
  },
});

// ---------------------------------------------------------------- admin tools

type SessionUser = { id?: number; email?: string };

const sessionUser = async (reqContext: McpRequestContext): Promise<SessionUser> => {
  const user = readRecord(envelopeData(await reqContext.client.get(SESSION_PATH))['user']);
  const id = user?.['id'];
  const email = readString(user?.['email']);
  return {
    ...(typeof id === 'number' ? { id } : undefined),
    ...(email ? { email } : undefined),
  };
};

const adminListTicket = (row: JsonRecord): JsonRecord => ({
  id: readString(row['id']),
  title: readString(row['title']) ?? '',
  customer_title: readString(row['customer_title']) ?? '',
  status: readString(row['status']) ?? null,
  ticket_state: readString(row['ticket_state']) ?? 'open',
  category: readString(row['category']) ?? null,
  product: readString(row['thread_kind']) === 'ferry_message' ? 'ferry' : 'sanka',
  channel: readString(row['channel_label']) ?? readString(row['primary_transport']) ?? null,
  workspace: {
    code: row['workspace_short_id'] ? String(row['workspace_short_id']) : null,
    name: readString(row['workspace_name']) ?? null,
    plan: readString(row['workspace_subscription']) ?? null,
  },
  sender_email: readString(row['owner_email']) ?? null,
  assignee:
    row['assignee_email'] ? { name: row['assignee_name'] ?? null, email: row['assignee_email'] } : null,
  has_unread: row['has_unread'] === true,
  updated_at: row['updated_at'] ?? null,
});

const adminTicket = (detail: JsonRecord): JsonRecord => ({
  id: readString(detail['id']),
  title: readString(detail['title']) ?? '',
  customer_title: readString(detail['customer_title']) ?? '',
  status: readString(detail['status']) ?? null,
  ticket_state: readString(detail['ticket_state']) ?? 'open',
  closed_at: detail['ticket_closed_at'] ?? null,
  category: readString(detail['category']) ?? null,
  product: readString(detail['thread_kind']) === 'ferry_message' ? 'ferry' : 'sanka',
  channel: readString(detail['channel_label']) ?? readString(detail['primary_transport']) ?? null,
  source: readString(detail['source']) ?? null,
  source_ticket_id: readString(detail['source_external_id']) || (detail['source_bug_id'] ?? null),
  linear_issue_url: detail['linear_issue_url'] ?? null,
  workspace: {
    code: detail['workspace_short_id'] ? String(detail['workspace_short_id']) : null,
    name: readString(detail['workspace_name']) ?? null,
    plan: readString(detail['workspace_subscription']) ?? null,
  },
  sender: {
    name: readString(detail['owner_name']) ?? null,
    email: readString(detail['owner_email']) ?? null,
  },
  shared_to_workspace: detail['shared_to_workspace'] === true,
  escalated_at: detail['escalated_at'] ?? null,
  assignee:
    detail['assigned_support_user_email'] ?
      {
        user_id: detail['assigned_support_user_id'] ?? null,
        name: detail['assigned_support_user_name'] ?? null,
        email: detail['assigned_support_user_email'],
      }
    : null,
  ...(readString(detail['source_description']) ?
    { description: readString(detail['source_description']) }
  : undefined),
});

const adminMessage = (message: JsonRecord): JsonRecord => {
  const role = readString(message['role']) ?? '';
  return {
    id: readString(message['id']),
    from: ROLE_LABELS[role] ?? role,
    author_email: readString(message['author_email']) ?? null,
    content: readString(message['content']) ?? '',
    created_at: message['created_at'] ?? null,
    ...(attachmentNames(message).length ? { attachments: attachmentNames(message) } : undefined),
  };
};

const adminEvent = (event: JsonRecord): JsonRecord => {
  const type = readString(event['event_type']);
  return {
    type,
    ...(type === 'status_changed' ?
      { from: event['from_status'] ?? null, to: event['to_status'] ?? null }
    : undefined),
    ...(type === 'assignee_changed' ?
      { from: event['from_user_email'] ?? null, to: event['to_user_email'] ?? null }
    : undefined),
    ...(event['page_path'] ? { page: event['page_label'] || event['page_path'] } : undefined),
    by: event['actor_email'] ?? null,
    source: event['source'] ?? null,
    at: event['created_at'] ?? null,
  };
};

// Without a client_message_id, the same text to the same ticket is one reply, so a retried call
// cannot send it twice.
const derivedClientMessageId = (threadId: string, content: string): string => {
  const hex = createHash('sha256')
    .update(JSON.stringify(['mcp-support-reply', threadId, content]))
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(
    20,
    32,
  )}`;
};

const readTicketId = (args: ToolArgs): string | undefined => {
  const value = readString(args?.['ticket_id'])?.trim();
  return value && value.length <= 200 ? value : undefined;
};

const TICKET_ID_SCHEMA = {
  type: 'string',
  minLength: 1,
  maxLength: 200,
  description: 'The ticket: its id (UUID), external ticket id or numeric bug id.',
};

const adminDetail = async (reqContext: McpRequestContext, ticketId: string): Promise<JsonRecord> =>
  envelopeData(await reqContext.client.get(`${ADMIN_PATH}/threads/${encodeURIComponent(ticketId)}`));

const ADMIN_FAILURE_READ: FailureCopy = {
  notFound: 'No ticket has that id; support_admin_list_tickets can search by ticket_id or query.',
  forbidden: ADMIN_FORBIDDEN,
  write: false,
};
const ADMIN_FAILURE_WRITE: FailureCopy = { ...ADMIN_FAILURE_READ, write: true };

export const supportAdminListTicketsTool = defineSupportTool({
  name: 'support_admin_list_tickets',
  title: 'List Sanka Support tickets (admin)',
  description:
    'Support admins only. List Sanka Support tickets across all workspaces, most recently updated first, with internal status, open or closed, workspace, sender and assignee. Filter by ticket_state, status, assignee ("me", "unassigned", an email or a user id), workspace (code or name), ticket_id, product, handled_by and query. Page with next_cursor.',
  operation: 'read',
  httpMethod: 'get',
  httpPath: `${ADMIN_PATH}/threads`,
  operationId: 'list_manage_support_threads_api_v2_manage_support_threads_get',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ticket_state: {
        type: 'string',
        enum: [...STATE_FILTERS],
        description: 'open (the default), closed or all.',
      },
      status: { type: 'string', enum: [...INTERNAL_STATUSES], description: 'Internal status.' },
      assignee: { type: 'string', maxLength: 200, description: '"me", "unassigned", an email or a user id.' },
      workspace: { type: 'string', maxLength: 200, description: 'Workspace code or part of its name.' },
      ticket_id: {
        type: 'string',
        maxLength: 200,
        description: 'Ticket UUID, external ticket id or bug id.',
      },
      product: { type: 'string', enum: ['all', 'sanka', 'ferry'], description: 'Default all.' },
      handled_by: {
        type: 'string',
        enum: ['all', 'human', 'ai'],
        description: 'human: needs a person; ai: Sanka AI is handling it; all (the default).',
      },
      query: { type: 'string', maxLength: 200, description: 'Title, sender email, workspace or id.' },
      limit: { type: 'integer', minimum: 1, maximum: ADMIN_LIST_MAX, description: 'Default 25.' },
      cursor: { type: 'string', maxLength: 512, description: 'next_cursor from the previous page.' },
    },
  },
  failure: ADMIN_FAILURE_READ,
  run: async (reqContext, args) => {
    const query: Record<string, string | number> = {
      ticket_state: pickEnum(args?.['ticket_state'], STATE_FILTERS) ?? 'open',
      product: pickEnum(args?.['product'], ['all', 'sanka', 'ferry'] as const) ?? 'all',
      support: pickEnum(args?.['handled_by'], ['all', 'human', 'ai'] as const) ?? 'all',
      limit: clampInt(args?.['limit'], 25, ADMIN_LIST_MAX),
    };
    const status = pickEnum(args?.['status'], INTERNAL_STATUSES);
    if (status) query['status'] = status;
    let assignee = readString(args?.['assignee'])?.trim();
    if (assignee?.toLowerCase() === 'me') {
      const me = await sessionUser(reqContext);
      if (me.id === undefined) return asErrorResult('Could not resolve "me" to the connected Sanka user.');
      assignee = String(me.id);
    }
    if (assignee) query['assignee'] = assignee.toLowerCase() === 'unassigned' ? 'unassigned' : assignee;
    for (const [arg, param] of [
      ['workspace', 'workspace'],
      ['ticket_id', 'ticket_id'],
      ['query', 'q'],
      ['cursor', 'cursor'],
    ] as const) {
      const value = readString(args?.[arg])?.trim();
      if (value) query[param] = value;
    }
    const data = envelopeData(await reqContext.client.get(`${ADMIN_PATH}/threads`, { query }));
    const tickets = records(data['threads']).map(adminListTicket);
    const nextCursor = readString(data['next_cursor']) ?? null;
    const lines =
      tickets.length ?
        [
          `${tickets.length} ticket(s)${nextCursor ? '; more with next_cursor' : ''}:`,
          ...tickets.map((ticket) => {
            const workspace = readRecord(ticket['workspace']);
            const assigneeRecord = readRecord(ticket['assignee']);
            return `- "${ticket['title']}" · ${ticket['ticket_state']} · ${ticket['status'] ?? '-'} · ws ${
              workspace?.['code'] ?? '?'
            } · from ${ticket['sender_email'] ?? '?'} · ${
              assigneeRecord ? `assigned ${assigneeRecord['email']}` : 'unassigned'
            } · id ${ticket['id']}`;
          }),
        ]
      : ['No tickets match.'];
    return result({ tickets, next_cursor: nextCursor }, lines);
  },
});

export const supportAdminGetTicketTool = defineSupportTool({
  name: 'support_admin_get_ticket',
  title: 'Get a Sanka Support ticket (admin)',
  description:
    'Support admins only. Read one Sanka Support ticket by id, external ticket id or bug id: internal status, open or closed, workspace code, name and plan, sender, assignee, the conversation with staff names, and the status and assignee history.',
  operation: 'read',
  httpMethod: 'get',
  httpPath: `${ADMIN_PATH}/threads/{thread_id}`,
  operationId: 'manage_support_thread_detail_api_v2_manage_support_threads__thread_id__get',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['ticket_id'],
    properties: {
      ticket_id: TICKET_ID_SCHEMA,
      max_messages: {
        type: 'integer',
        minimum: 1,
        maximum: MESSAGES_MAX,
        description: `Latest messages to include (default ${MESSAGES_DEFAULT}).`,
      },
    },
  },
  failure: ADMIN_FAILURE_READ,
  run: async (reqContext, args) => {
    const ticketId = readTicketId(args);
    if (!ticketId) return asErrorResult('`ticket_id` is required.');
    const detail = await adminDetail(reqContext, ticketId);
    const ticket = adminTicket(detail);
    const allMessages = records(detail['messages']);
    const summary = replySummary(allMessages);
    const { messages, omitted } = lastMessages(
      allMessages,
      clampInt(args?.['max_messages'], MESSAGES_DEFAULT, MESSAGES_MAX),
    );
    const workspace = readRecord(ticket['workspace']);
    const sender = readRecord(ticket['sender']);
    const assignee = readRecord(ticket['assignee']);
    const lines = [
      `"${ticket['title']}" · ${ticket['ticket_state']} · status ${ticket['status'] ?? '-'}.`,
      `Workspace ${workspace?.['code'] ?? '?'} (${workspace?.['name'] ?? '?'}, ${
        workspace?.['plan'] || 'no plan'
      }); sender ${sender?.['email'] ?? '?'}; ${
        assignee ? `assigned to ${assignee['email']}` : 'unassigned'
      }.`,
      summary.waiting_on === 'sanka' ? 'The customer waits for Sanka.' : 'The latest message is from Sanka.',
      `${messages.length} message(s)${omitted ? `, ${omitted} earlier omitted` : ''}.`,
    ];
    return result(
      {
        ticket: { ...ticket, ...summary },
        messages: messages.map(adminMessage),
        omitted_messages: omitted,
        history: records(detail['events']).map(adminEvent),
      },
      lines,
    );
  },
});

const listAgents = async (reqContext: McpRequestContext): Promise<JsonRecord[]> =>
  records(envelopeData(await reqContext.client.get(`${ADMIN_PATH}/support-users`))['support_users']);

export const supportAdminListAgentsTool = defineSupportTool({
  name: 'support_admin_list_agents',
  title: 'List Sanka Support agents (admin)',
  description:
    'Support admins only. List the Sanka Support agents tickets can be assigned to: name, email, user id and whether they are active.',
  operation: 'read',
  httpMethod: 'get',
  httpPath: `${ADMIN_PATH}/support-users`,
  operationId: 'list_manage_support_users_api_v2_manage_support_support_users_get',
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  failure: ADMIN_FAILURE_READ,
  run: async (reqContext) => {
    const agents = (await listAgents(reqContext)).map((agent) => ({
      user_id: agent['user_id'] ?? null,
      name: readString(agent['user_name']) ?? null,
      email: readString(agent['user_email']) ?? null,
      active: agent['is_active'] === true,
    }));
    return result({ agents }, [
      `${agents.length} support agent(s):`,
      ...agents.map(
        (agent) => `- ${agent.name ?? '?'} <${agent.email ?? '?'}>${agent.active ? '' : ' (inactive)'}`,
      ),
    ]);
  },
});

// The support-user row an assignee argument names: "me", an email or a user id.
const resolveAgent = async (
  reqContext: McpRequestContext,
  assignee: string,
): Promise<JsonRecord | undefined> => {
  let wanted = assignee.trim().toLowerCase();
  if (wanted === 'me') {
    const me = await sessionUser(reqContext);
    if (me.id === undefined) return undefined;
    wanted = String(me.id);
  }
  return (await listAgents(reqContext)).find(
    (agent) =>
      String(agent['user_id'] ?? '') === wanted ||
      readString(agent['user_email'])?.toLowerCase() === wanted ||
      readString(agent['id'])?.toLowerCase() === wanted,
  );
};

export const supportAdminUpdateTicketTool = defineSupportTool({
  name: 'support_admin_update_ticket',
  title: 'Update a Sanka Support ticket (admin)',
  description:
    'Support admins only. Change a ticket\'s internal status, open or close it, assign it ("me", an agent email or user id, or "unassigned") or rename its internal title. Closing does not change the status and done does not close, as on the Support page. Assigning notifies the new assignee. Changes are recorded in the ticket history as made through MCP.',
  operation: 'write',
  httpMethod: 'patch',
  httpPath: `${ADMIN_PATH}/threads/{thread_id}`,
  operationId: 'patch_manage_support_thread_api_v2_manage_support_threads__thread_id__patch',
  idempotent: true,
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['ticket_id'],
    properties: {
      ticket_id: TICKET_ID_SCHEMA,
      status: { type: 'string', enum: [...INTERNAL_STATUSES], description: 'New internal status.' },
      ticket_state: { type: 'string', enum: [...TICKET_STATES], description: 'open or closed.' },
      assignee: {
        type: 'string',
        maxLength: 200,
        description: '"me", an agent email or user id, or "unassigned".',
      },
      title: { type: 'string', minLength: 1, maxLength: TITLE_MAX_LENGTH, description: 'Internal title.' },
    },
  },
  failure: ADMIN_FAILURE_WRITE,
  run: async (reqContext, args) => {
    const ticketId = readTicketId(args);
    if (!ticketId) return asErrorResult('`ticket_id` is required.');
    const body: JsonRecord = {};
    if (args?.['status'] !== undefined) {
      const status = pickEnum(args['status'], INTERNAL_STATUSES);
      if (!status) return asErrorResult(`\`status\` must be one of ${INTERNAL_STATUSES.join(', ')}.`);
      body['status'] = status;
    }
    if (args?.['ticket_state'] !== undefined) {
      const state = pickEnum(args['ticket_state'], TICKET_STATES);
      if (!state) return asErrorResult('`ticket_state` must be open or closed.');
      body['ticket_state'] = state;
    }
    const title = readString(args?.['title'])?.trim();
    if (args?.['title'] !== undefined) {
      if (!title || title.length > TITLE_MAX_LENGTH) {
        return asErrorResult(`\`title\` must be 1 to ${TITLE_MAX_LENGTH} characters.`);
      }
      body['title'] = title;
    }
    const assignee = readString(args?.['assignee'])?.trim();
    if (args?.['assignee'] !== undefined) {
      if (!assignee)
        return asErrorResult('`assignee` must be "me", an agent email or user id, or "unassigned".');
      if (assignee.toLowerCase() === 'unassigned') {
        body['support_user_id'] = '';
      } else {
        const agent = await resolveAgent(reqContext, assignee);
        if (!agent) {
          return asErrorResult(
            `No support agent matches "${assignee}". support_admin_list_agents lists who can be assigned.`,
          );
        }
        body['support_user_id'] = readString(agent['id']);
      }
    }
    if (!Object.keys(body).length) {
      return asErrorResult('Pass at least one of status, ticket_state, assignee or title.');
    }
    // PATCH takes the thread UUID; resolve external and bug ids first.
    const before = adminTicket(await adminDetail(reqContext, ticketId));
    const threadId = readString(before['id']);
    if (!threadId) return asErrorResult('The ticket could not be resolved.');
    const after = adminTicket(
      envelopeData(
        await reqContext.client.patch(`${ADMIN_PATH}/threads/${encodeURIComponent(threadId)}`, { body }),
      ),
    );
    const changes: string[] = [];
    if (before['status'] !== after['status']) changes.push(`status ${before['status']} → ${after['status']}`);
    if (before['ticket_state'] !== after['ticket_state']) {
      changes.push(`${after['ticket_state'] === 'closed' ? 'closed' : 'reopened'} the ticket`);
    }
    const beforeAssignee = readRecord(before['assignee'])?.['email'] ?? 'unassigned';
    const afterAssignee = readRecord(after['assignee'])?.['email'] ?? 'unassigned';
    if (beforeAssignee !== afterAssignee) changes.push(`assignee ${beforeAssignee} → ${afterAssignee}`);
    if (before['title'] !== after['title']) changes.push(`title "${after['title']}"`);
    return result({ ok: true, ticket: after }, [
      changes.length ?
        `Updated "${after['title']}": ${changes.join('; ')}.`
      : 'Nothing changed: the ticket already had those values.',
    ]);
  },
});

export const supportAdminReplyTool = defineSupportTool({
  name: 'support_admin_reply',
  title: 'Reply to a Sanka Support ticket (admin)',
  description:
    "Support admins only. Reply to a customer as Sanka Support; the reply is e-mailed or sent to the ticket's channel and cannot be unsent. Without confirm: true this only returns a preview with the ticket, the recipient and the latest customer message: show it to the user and send only after they approve. A reply reopens a closed ticket and moves todo to doing. Retrying with the same client_message_id never sends twice.",
  operation: 'write',
  httpMethod: 'post',
  httpPath: `${ADMIN_PATH}/threads/{thread_id}/reply`,
  operationId: 'reply_manage_support_thread_api_v2_manage_support_threads__thread_id__reply_post',
  idempotent: true,
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['ticket_id', 'content'],
    properties: {
      ticket_id: TICKET_ID_SCHEMA,
      content: { type: 'string', minLength: 1, maxLength: REPLY_MAX_LENGTH, description: 'The reply text.' },
      confirm: {
        type: 'boolean',
        description: 'true sends the reply; otherwise only a preview is returned.',
      },
      client_message_id: {
        type: 'string',
        pattern: '^[0-9a-fA-F-]{36}$',
        description:
          'A UUID you choose; a retry with the same value returns the first reply. Defaults to one derived from the ticket and text.',
      },
    },
  },
  failure: ADMIN_FAILURE_WRITE,
  run: async (reqContext, args) => {
    const ticketId = readTicketId(args);
    if (!ticketId) return asErrorResult('`ticket_id` is required.');
    const content = readString(args?.['content'])?.trim();
    if (!content) return asErrorResult('`content` is required.');
    if (content.length > REPLY_MAX_LENGTH) {
      return asErrorResult(`\`content\` must be at most ${REPLY_MAX_LENGTH} characters.`);
    }
    const clientMessageId = readString(args?.['client_message_id']);
    if (clientMessageId && !UUID.test(clientMessageId)) {
      return asErrorResult('`client_message_id` must be a UUID.');
    }
    const detail = await adminDetail(reqContext, ticketId);
    const ticket = adminTicket(detail);
    const threadId = readString(ticket['id']);
    if (!threadId) return asErrorResult('The ticket could not be resolved.');
    const sender = readRecord(ticket['sender']);
    const workspace = readRecord(ticket['workspace']);
    if (args?.['confirm'] !== true) {
      const lastCustomer = records(detail['messages'])
        .filter((message) => readString(message['role']) === 'user')
        .pop();
      return result(
        {
          ok: true,
          status: 'preview',
          sent: false,
          ticket,
          to: sender?.['email'] ?? null,
          content,
          last_customer_message: lastCustomer ? adminMessage(lastCustomer) : null,
        },
        [
          `Preview only; nothing was sent. Reply to "${ticket['title']}" (${ticket['ticket_state']}) for ${
            sender?.['email'] ?? 'the customer'
          } in workspace ${workspace?.['code'] ?? '?'}:`,
          content,
          'Show this to the user. Call again with confirm: true (and a client_message_id) to send it as Sanka Support.',
        ],
      );
    }
    const form = new FormData();
    form.append('content', content);
    const messageId = clientMessageId ?? derivedClientMessageId(threadId, content);
    form.append('client_message_id', messageId);
    const after = envelopeData(
      await reqContext.client.post(`${ADMIN_PATH}/threads/${encodeURIComponent(threadId)}/reply`, {
        body: form,
        maxRetries: 0,
      }),
    );
    return result(
      { ok: true, status: 'sent', sent: true, client_message_id: messageId, ticket: adminTicket(after) },
      [`Sent the reply to "${ticket['title']}" as Sanka Support (${sender?.['email'] ?? 'the customer'}).`],
    );
  },
});

export const supportTools: McpTool[] = [
  supportListMyTicketsTool,
  supportGetMyTicketTool,
  supportAdminListTicketsTool,
  supportAdminGetTicketTool,
  supportAdminListAgentsTool,
  supportAdminUpdateTicketTool,
  supportAdminReplyTool,
];

export const isSupportAdminTool = (name: string): boolean => ADMIN_TOOL_NAME_SET.has(name);

const ACCESS_CACHE_TTL_MS = 60_000;
const ACCESS_CACHE_MAX = 1000;
const accessCache = new Map<string, { admin: boolean; expiresAt: number }>();

// Whether the connected user may use the Support admin tools, cached briefly per API token. Any
// failure hides them: the API still refuses every admin call from anyone else.
export const readSupportAdminAccess = async (
  client: McpRequestContext['client'],
  cacheKey?: string,
): Promise<boolean> => {
  const key = cacheKey ? createHash('sha256').update(cacheKey).digest('hex') : undefined;
  const now = Date.now();
  const cached = key ? accessCache.get(key) : undefined;
  if (cached && cached.expiresAt > now) return cached.admin;
  let admin = false;
  try {
    admin = envelopeData(await client.get(ADMIN_ACCESS_PATH))['is_support_admin'] === true;
  } catch {
    return false;
  }
  if (key) {
    if (accessCache.size >= ACCESS_CACHE_MAX) accessCache.clear();
    accessCache.set(key, { admin, expiresAt: now + ACCESS_CACHE_TTL_MS });
  }
  return admin;
};

export const clearSupportAdminAccessCache = (): void => accessCache.clear();
