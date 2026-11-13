import {
  supportAdminGetTicketTool,
  supportAdminListTicketsTool,
  supportAdminReplyTool,
  supportAdminUpdateTicketTool,
  supportGetMyTicketTool,
  supportListMyTicketsTool,
} from '../../packages/mcp-server/src/support-tools';
import { validateToolArguments } from '../../packages/mcp-server/src/tool-argument-validator';
import type { McpTool } from '../../packages/mcp-server/src/types';
import { envelope, firstTextContent, sendThroughSDK, type V2Request } from './crm/helpers';

const API = 'http://localhost:5000/api/v2';
const THREAD_ID = '6f1d2c3b-4a59-4e8f-9d7c-1b2a3c4d5e6f';
const REPLY_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

// A customer's ticket as GET /support/threads returns it: internal status and AI triage included.
const customerThread = {
  id: THREAD_ID,
  title: 'Invoices do not export',
  status: 'feature_pending',
  ticket_state: 'open',
  ticket_closed_at: null,
  channel_label: 'Sanka',
  shared_to_workspace: false,
  needs_human: true,
  ai_confidence: 0.2,
  ai_escalation_reason: 'unsupported_feature',
  assigned_support_user: null,
  can_share: true,
  unread: true,
  last_message_at: '2026-11-12T10:00:00Z',
  updated_at: '2026-11-12T10:00:00Z',
};
const customerMessages = [
  {
    id: 'm1',
    role: 'user',
    author: { id: '7', name: 'Aiko', email: 'aiko@acme.test' },
    content: 'Export fails',
  },
  { id: 'm2', role: 'ai', author: null, content: 'Which format?' },
  { id: 'm3', role: 'human', author: null, content: 'We are fixing it.', attachments: [] },
];

const adminDetail = {
  id: THREAD_ID,
  title: 'Export bug (internal)',
  customer_title: 'Invoices do not export',
  status: 'doing',
  ticket_state: 'open',
  ticket_closed_at: null,
  thread_kind: 'support',
  channel_label: 'Sanka',
  source_bug_id: 1234,
  workspace_short_id: 10101010,
  workspace_name: 'Acme',
  workspace_subscription: 'enterprise',
  owner_email: 'aiko@acme.test',
  owner_name: 'Aiko',
  assigned_support_user_id: null,
  assigned_support_user_email: null,
  messages: [{ id: 'm1', role: 'user', author_email: 'aiko@acme.test', content: 'Export fails' }],
  events: [],
};
const boardCounts = { counts: { todo: 0, doing: 1, feature_pending: 0, done: 4 }, unread: 0, total: 5 };
const agents = {
  support_users: [
    { id: 'su-1', user_id: 95, user_email: 'ops@sanka.test', user_name: 'Ops', is_active: true },
  ],
};

const apiError = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ success: false, error: { code, message, details: {} } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Each row: the tool call, the requests it must send, the API answers and what the tool returns.
const cases: Array<{
  name: string;
  tool: McpTool;
  args: Record<string, unknown>;
  responses: Response[];
  requests: V2Request[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  text?: string[];
  /** Values the result must never carry. */
  absent?: string[];
}> = [
  {
    name: 'a customer lists closed tickets without internal status or AI triage',
    tool: supportListMyTicketsTool,
    args: { state: 'closed' },
    responses: [
      envelope({
        threads: [
          customerThread,
          { ...customerThread, id: 'closed-1', ticket_state: 'closed', status: 'done' },
        ],
      }),
    ],
    requests: [{ method: 'GET', url: `${API}/support/threads` }],
    structuredContent: { tickets: [{ id: 'closed-1', ticket_state: 'closed', opened_by_you: true }] },
    absent: ['"status"', 'done', 'unsupported_feature', 'ai_confidence'],
  },
  {
    name: 'a customer reads a ticket: Sanka Support replied, staff stay anonymous',
    tool: supportGetMyTicketTool,
    args: { ticket_id: THREAD_ID },
    responses: [envelope({ thread: customerThread, messages: customerMessages, ticket_events: [] })],
    requests: [{ method: 'GET', url: `${API}/support/threads/${THREAD_ID}` }],
    structuredContent: {
      ticket: { replied_by_sanka_support: true, last_reply_from: 'Sanka Support', waiting_on: 'customer' },
      messages: [
        { from: 'customer', author_name: 'Aiko' },
        { from: 'Sanka AI' },
        { from: 'Sanka Support', content: 'We are fixing it.' },
      ],
    },
    text: ['Sanka Support has replied.'],
    absent: ['feature_pending', 'author_email'],
  },
  {
    name: "a customer cannot read someone else's ticket",
    tool: supportGetMyTicketTool,
    args: { ticket_id: THREAD_ID },
    responses: [apiError(403, 'PERMISSION_DENIED', 'Forbidden')],
    requests: [{ method: 'GET', url: `${API}/support/threads/${THREAD_ID}` }],
    isError: true,
    text: ['Only tickets you opened'],
  },
  {
    name: 'an admin lists their In progress tickets under the board column counts',
    tool: supportAdminListTicketsTool,
    args: { assignee: 'me', status: 'In progress' },
    responses: [
      envelope({ user: { id: 95, email: 'ops@sanka.test' } }),
      envelope(boardCounts),
      envelope({ threads: [{ ...adminDetail, assignee_email: 'ops@sanka.test' }], next_cursor: null }),
    ],
    requests: [
      { method: 'GET', url: `${API}/auth/session` },
      {
        method: 'GET',
        url: `${API}/manage-support/threads/counts?ticket_state=open&product=all&support=all&assignee=95`,
      },
      {
        method: 'GET',
        url: `${API}/manage-support/threads?ticket_state=open&product=all&support=all&limit=25&status=doing&assignee=95`,
      },
    ],
    structuredContent: {
      board: { Open: 0, 'In progress': 1, 'Feature request or pending': 0, Done: 4 },
      total: 5,
      tickets: [
        {
          id: THREAD_ID,
          status: 'In progress',
          sender_email: 'aiko@acme.test',
          workspace_code: '10101010',
          assignee_email: 'ops@sanka.test',
        },
      ],
    },
    text: [
      'Open 0 · In progress 1 · Feature request or pending 0 · Done 4; 5 ticket(s).',
      'In progress:\n- ',
    ],
    absent: ['"doing"', 'enterprise'],
  },
  {
    name: 'limit 0 answers with the board column counts alone',
    tool: supportAdminListTicketsTool,
    args: { assignee: 'ops@sanka.test', ticket_state: 'all', limit: 0 },
    responses: [envelope(boardCounts)],
    requests: [
      {
        method: 'GET',
        url: `${API}/manage-support/threads/counts?ticket_state=all&product=all&support=all&assignee=ops%40sanka.test`,
      },
    ],
    structuredContent: { board: { Open: 0, Done: 4 }, total: 5 },
    absent: ['"tickets"'],
  },
  {
    name: 'a non-admin is refused the admin list',
    tool: supportAdminGetTicketTool,
    args: { ticket_id: '1234' },
    responses: [apiError(403, 'PERMISSION_DENIED', 'Support admin access is required')],
    requests: [{ method: 'GET', url: `${API}/manage-support/threads/1234` }],
    isError: true,
    text: ['Support admin tools need'],
  },
  {
    name: 'an admin moves, closes and assigns a ticket found by its bug id',
    tool: supportAdminUpdateTicketTool,
    args: {
      ticket_id: '1234',
      status: 'Feature request or pending',
      ticket_state: 'closed',
      assignee: 'OPS@sanka.test',
    },
    responses: [
      envelope(agents),
      envelope(adminDetail),
      envelope({
        ...adminDetail,
        status: 'feature_pending',
        ticket_state: 'closed',
        assigned_support_user_id: 95,
        assigned_support_user_email: 'ops@sanka.test',
      }),
    ],
    requests: [
      { method: 'GET', url: `${API}/manage-support/support-users` },
      { method: 'GET', url: `${API}/manage-support/threads/1234` },
      {
        method: 'PATCH',
        url: `${API}/manage-support/threads/${THREAD_ID}`,
        body: { status: 'feature_pending', ticket_state: 'closed', support_user_id: 'su-1' },
      },
    ],
    text: [
      'status In progress → Feature request or pending; closed the ticket; assignee unassigned → ops@sanka.test',
    ],
  },
  {
    name: 'an admin reply without confirm is only a preview',
    tool: supportAdminReplyTool,
    args: { ticket_id: THREAD_ID, content: 'Fixed, please retry.' },
    responses: [envelope(adminDetail)],
    requests: [{ method: 'GET', url: `${API}/manage-support/threads/${THREAD_ID}` }],
    structuredContent: { status: 'preview', sent: false, to: 'aiko@acme.test' },
    text: ['Preview only; nothing was sent.'],
  },
  {
    name: 'a confirmed admin reply is sent once as a form',
    tool: supportAdminReplyTool,
    args: { ticket_id: '1234', content: 'Fixed, please retry.', confirm: true, client_message_id: REPLY_ID },
    responses: [envelope(adminDetail), envelope(adminDetail)],
    requests: [
      { method: 'GET', url: `${API}/manage-support/threads/1234` },
      {
        method: 'POST',
        url: `${API}/manage-support/threads/${THREAD_ID}/reply`,
        multipart: { content: 'Fixed, please retry.', client_message_id: REPLY_ID },
      },
    ],
    structuredContent: { status: 'sent', sent: true, client_message_id: REPLY_ID },
  },
];

describe('Sanka Support tools', () => {
  it.each(cases)(
    '$name',
    async ({
      tool,
      args,
      responses,
      requests,
      isError = false,
      structuredContent,
      text = [],
      absent = [],
    }) => {
      expect(validateToolArguments({ mcpTool: tool, args })).toBeUndefined();

      const { requests: sent, result } = await sendThroughSDK({ tool, args, responses });

      expect(sent).toEqual(requests);
      expect(result.isError === true).toBe(isError);
      if (structuredContent) expect(result.structuredContent).toMatchObject(structuredContent);
      for (const fact of text) expect(firstTextContent(result)).toContain(fact);
      const serialized = JSON.stringify(result);
      for (const value of absent) expect(serialized).not.toContain(value);
    },
  );
});
