import {
  deskCreateTicketTool,
  deskGetTicketStatusTool,
  deskListMyTicketsTool,
} from '../../packages/mcp-server/src/desk-tools';
import { validateToolArguments } from '../../packages/mcp-server/src/tool-argument-validator';
import type { McpTool } from '../../packages/mcp-server/src/types';
import { envelope, firstTextContent, sendThroughSDK, type V2Request } from './crm/helpers';

const API = 'http://localhost:5000/api/v2';
const MY_TICKETS = `${API}/desk/my/tickets`;
const SESSION = `${API}/auth/session`;
const TICKET_ID = '0b6f9c2e-3d4a-4f5b-8c6d-7e8f9a0b1c2d';
// The tools run at this time; tickets in the rows were received 30 seconds earlier.
const NOW = Date.parse('2026-10-31T09:00:30Z');

const ticket = {
  id: TICKET_ID,
  number: 12,
  reference: '#12',
  title: 'Cannot log in to Slack',
  state: 'awaiting_requester',
  state_reason: 'needs_input',
  status_group: 'open',
  waiting_on: 'requester',
  origin: 'mcp',
  received_at: '2026-10-31T09:00:00Z',
  updated_at: '2026-10-31T09:00:20Z',
  resolved_at: null,
};
const detail = {
  ...ticket,
  operation_key: 'login_recovery',
  reopen_until: null,
  pending_question: 'Which Slack workspace is it?',
  available_actions: ['reply', 'withdraw'],
  messages: [
    {
      direction: 'inbound',
      author_kind: 'requester',
      body: 'I cannot log in to Slack',
      created_at: ticket.received_at,
    },
    {
      direction: 'outbound',
      author_kind: 'ai',
      body: 'Which Slack workspace is it?',
      created_at: ticket.updated_at,
    },
  ],
  console_url: `https://app.sanka.com/desk-console/10101010/tickets/${TICKET_ID}`,
};
const filed = {
  ...detail,
  state: 'received',
  state_reason: 'new',
  waiting_on: 'desk',
  pending_question: null,
};
const request = {
  text: 'I cannot log in to Slack',
  subject_email: 'new.hire@acme.test',
  client_key: 'retry-key-0001',
};
const filing: V2Request[] = [
  { method: 'GET', url: SESSION },
  {
    method: 'POST',
    url: MY_TICKETS,
    body: request,
    headers: { 'x-sanka-mcp': 'true', 'x-sanka-expected-workspace-id': 'ws-1' },
  },
];

const session = () => envelope({ current_workspace: { id: 'ws-1', code: '10101010', name: 'Acme' } });
const deskError = (status: number, code: string, message: string) =>
  new Response(
    JSON.stringify({ success: false, error: { code, message, details: {} }, meta: { ctx_id: 'ctx-desk' } }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );

// Each row: the tool call, the requests it must send, the API answers and what the tool returns.
const cases: Array<{
  name: string;
  tool: McpTool;
  args: Record<string, unknown>;
  responses: Response[];
  requests: V2Request[];
  schemaValid?: boolean;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  text?: string[];
}> = [
  {
    name: 'desk_list_my_tickets sends only the given filters and lists each request',
    tool: deskListMyTicketsTool,
    args: { state: 'closed', limit: 5 },
    responses: [
      envelope({
        items: [{ ...ticket, state: 'verified', status_group: 'closed', waiting_on: 'none' }],
        state: 'closed',
        limit: 5,
        total: 3,
      }),
    ],
    requests: [{ method: 'GET', url: `${MY_TICKETS}?state=closed&limit=5` }],
    structuredContent: { total: 3, state: 'closed' },
    text: [
      `1 of 3 closed Desk requests:\n- #12 "Cannot log in to Slack" · closed as resolved · received 2026-10-31T09:00:00Z · id ${TICKET_ID}`,
    ],
  },
  {
    name: 'desk_list_my_tickets without filters reads the open requests',
    tool: deskListMyTicketsTool,
    args: {},
    responses: [envelope({ items: [], state: 'open', limit: 20, total: 0 })],
    requests: [{ method: 'GET', url: MY_TICKETS }],
    text: ['No open Desk requests.'],
  },
  {
    name: 'desk_get_ticket_status reads a request by number and says what Desk asks',
    tool: deskGetTicketStatusTool,
    args: { ticket: '#12' },
    responses: [envelope(detail)],
    requests: [{ method: 'GET', url: `${MY_TICKETS}/%2312` }],
    structuredContent: detail,
    text: [
      '#12 "Cannot log in to Slack": waiting for the requester to answer.\nDesk asks: Which Slack workspace is it?',
      'The requester can reply, withdraw on the Desk page or where the request came from; these tools cannot.',
      `Desk page: ${detail.console_url}`,
    ],
  },
  {
    name: 'desk_get_ticket_status reads a request by UUID',
    tool: deskGetTicketStatusTool,
    args: { ticket: TICKET_ID },
    responses: [envelope(detail)],
    requests: [{ method: 'GET', url: `${MY_TICKETS}/${TICKET_ID}` }],
  },
  {
    name: 'desk_get_ticket_status refuses a ticket that is neither a UUID nor a number',
    tool: deskGetTicketStatusTool,
    args: { ticket: '../approvals' },
    responses: [],
    requests: [],
    schemaValid: false,
    isError: true,
  },
  {
    name: 'desk_get_ticket_status does not find a request filed by someone else',
    tool: deskGetTicketStatusTool,
    args: { ticket: '#13' },
    responses: [deskError(404, 'DESK_TICKET_NOT_FOUND', 'The Desk ticket was not found.')],
    requests: [{ method: 'GET', url: `${MY_TICKETS}/%2313` }],
    isError: true,
    structuredContent: { ok: false, status_code: 404, code: 'DESK_TICKET_NOT_FOUND' },
    text: ['Could not read Desk requests (DESK_TICKET_NOT_FOUND): The Desk ticket was not found.'],
  },
  {
    name: 'desk_create_ticket files in the session workspace with the given client_key',
    tool: deskCreateTicketTool,
    args: request,
    responses: [session(), envelope(filed)],
    requests: filing,
    structuredContent: {
      ok: true,
      status: 'filed',
      client_key: 'retry-key-0001',
      workspace_id: 'ws-1',
      id: TICKET_ID,
    },
    text: [
      'Filed #12 with the IT service desk of Acme.',
      'check progress with desk_get_ticket_status (ticket "#12")',
    ],
  },
  {
    name: 'desk_create_ticket says when Desk returned a request filed by an earlier call',
    tool: deskCreateTicketTool,
    args: request,
    responses: [session(), envelope({ ...filed, received_at: '2026-10-31T08:10:00Z' })],
    requests: filing,
    text: ['already filed with the IT service desk of Acme as #12 at 2026-10-31T08:10:00Z'],
  },
  {
    name: 'desk_create_ticket files nothing without a selected workspace',
    tool: deskCreateTicketTool,
    args: request,
    responses: [envelope({ current_workspace: null })],
    requests: [{ method: 'GET', url: SESSION }],
    isError: true,
    text: ['No Sanka workspace is selected for this connection, so nothing was filed.'],
  },
  ...[
    [
      'DESK_NOT_ENABLED',
      'Sanka Desk is not enabled for this workspace.',
      'do not file it with create_ticket',
    ],
    [
      'DESK_REQUESTER_NOT_IN_DIRECTORY',
      'This account cannot submit Sanka Desk requests.',
      'contact their IT team',
    ],
    ['DESK_REQUESTER_ACCOUNT_REQUIRED', 'A Sanka account is required.', 'needs a Sanka account'],
  ].map(([code = '', message = '', hint = '']) => ({
    name: `desk_create_ticket reports ${code} and files nothing`,
    tool: deskCreateTicketTool,
    args: request,
    responses: [session(), deskError(403, code, message)],
    requests: filing,
    isError: true,
    structuredContent: { ok: false, status_code: 403, code, message, ctx_id: 'ctx-desk' },
    text: [`Nothing was filed (${code}): ${message}`, hint],
  })),
  {
    name: 'desk_list_my_tickets reports DESK_NOT_ENABLED',
    tool: deskListMyTicketsTool,
    args: {},
    responses: [deskError(403, 'DESK_NOT_ENABLED', 'Sanka Desk is not enabled for this workspace.')],
    requests: [{ method: 'GET', url: MY_TICKETS }],
    isError: true,
    text: ['Could not read Desk requests (DESK_NOT_ENABLED): Sanka Desk is not enabled for this workspace.'],
  },
];

describe('Sanka Desk tools', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(cases)(
    '$name',
    async ({
      tool,
      args,
      responses,
      requests,
      schemaValid = true,
      isError = false,
      structuredContent,
      text = [],
    }) => {
      expect(validateToolArguments({ mcpTool: tool, args }) === undefined).toBe(schemaValid);

      const { requests: sent, result } = await sendThroughSDK({ tool, args, responses });

      expect(sent).toEqual(requests);
      expect(result.isError === true).toBe(isError);
      if (structuredContent) {
        expect(result.structuredContent).toMatchObject(structuredContent);
      }
      for (const fact of text) {
        expect(firstTextContent(result)).toContain(fact);
      }
    },
  );

  it('sends one client_key per request text and hour, so a retried create returns the first request', async () => {
    const clientKey = async (text: string, now: number) => {
      jest.spyOn(Date, 'now').mockReturnValue(now);
      const { requests } = await sendThroughSDK({
        tool: deskCreateTicketTool,
        args: { text },
        responses: [session(), envelope(filed)],
      });
      return (requests[1]?.body as { client_key?: string } | undefined)?.client_key;
    };
    const first = await clientKey('I cannot log in to Slack', NOW);

    expect(first).toMatch(/^mcp-[0-9a-f]{40}$/);
    expect(await clientKey('  I cannot log in   to Slack ', NOW + 10 * 60 * 1000)).toBe(first);
    expect(await clientKey('I cannot log in to Teams', NOW)).not.toBe(first);
    expect(await clientKey('I cannot log in to Slack', NOW + 60 * 60 * 1000)).not.toBe(first);
  });

  it('publishes the Desk tool names and input schemas', () => {
    const contract = (tool: McpTool) => [
      tool.tool.name,
      JSON.parse(
        JSON.stringify(tool.tool.inputSchema, (key, value) => (key === 'description' ? undefined : value)),
      ),
    ];

    expect([deskCreateTicketTool, deskGetTicketStatusTool, deskListMyTicketsTool].map(contract)).toEqual([
      [
        'desk_create_ticket',
        {
          type: 'object',
          additionalProperties: false,
          required: ['text'],
          properties: {
            text: { type: 'string', minLength: 1, maxLength: 4000 },
            subject_email: { type: 'string', format: 'email' },
            client_key: { type: 'string', minLength: 8, maxLength: 100 },
          },
        },
      ],
      [
        'desk_get_ticket_status',
        {
          type: 'object',
          additionalProperties: false,
          required: ['ticket'],
          properties: {
            ticket: {
              type: 'string',
              pattern:
                '^(#?[0-9]{1,18}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$',
            },
          },
        },
      ],
      [
        'desk_list_my_tickets',
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            state: { type: 'string', enum: ['open', 'closed', 'all'] },
            limit: { type: 'integer', minimum: 1, maximum: 50 },
          },
        },
      ],
    ]);
  });
});
