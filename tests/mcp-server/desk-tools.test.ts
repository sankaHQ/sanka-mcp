import { getCapabilityGuidanceTool } from '../../packages/mcp-server/src/capability-guidance-tools';
import {
  DESK_ACTION_TOOL_NAMES,
  DESK_WORKFLOW_TOOL_NAMES,
  deskCreateTicketTool,
  deskGetTicketStatusTool,
  deskListActionsTool,
  deskListMyApprovalsTool,
  deskListMyTicketsTool,
  deskListWorkflowsTool,
  deskPreviewActionTool,
  deskPreviewWorkflowTool,
  deskRunActionTool,
  deskRunWorkflowTool,
} from '../../packages/mcp-server/src/desk-tools';
import { validateToolArguments } from '../../packages/mcp-server/src/tool-argument-validator';
import type { McpTool } from '../../packages/mcp-server/src/types';
import { envelope, firstTextContent, sendThroughSDK, type V2Request } from './crm/helpers';

const API = 'http://localhost:5000/api/v2';
const MY_TICKETS = `${API}/desk/my/tickets`;
const SESSION = `${API}/auth/session`;
const MY_ACTIONS = `${API}/desk/my/actions`;
const PLAN_HASH = 'a'.repeat(64);
const APPROVAL_URL = 'https://desk.sanka.com/10101010/approvals/ap-1';
const CREDITS_URL = 'https://desk.sanka.com/10101010/workspace/billing';
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
const probe: V2Request = {
  method: 'GET',
  url: `${MY_TICKETS}?state=open&limit=1`,
  headers: { 'x-stainless-timeout': '5' },
};

const access = { mode: 'run', reason: 'no_rule', system: null, approval_required: false, surface: 'mcp' };
const action = {
  operation_key: 'hubspot_account_setup',
  purpose: 'Set up a HubSpot user',
  systems: ['hubspot'],
  executable: true,
  access,
  inputs_schema: { type: 'object', required: ['subject_email'], properties: { subject_email: {}, role: {} } },
};
const actionArgs = { operation_key: 'hubspot_account_setup', inputs: { subject_email: 'rina@acme.test' } };
const preview = {
  ...actionArgs,
  decision: 'needs_approval',
  access,
  preview: {
    summary: 'Create a HubSpot user for rina@acme.test',
    risk_tier: 'R2',
    risk_reasons: ['provisioning'],
    items: [{ system: 'hubspot', action: 'create_user', execution_mode: 'automatic' }],
    approvals: [{ slot: 'manager', eligible_labels: ['Mio Tanaka'] }],
  },
  credits: { currency: 'credits', total: 30, available: 100, sufficient: true, lines: [] },
  credits_short: false,
  credits_url: CREDITS_URL,
  plan_hash: PLAN_HASH,
  refusal: null,
};
const shortPreview = {
  ...preview,
  credits: { ...preview.credits, available: 10, sufficient: false },
  credits_short: true,
};
const runArgs = { ...actionArgs, plan_hash: PLAN_HASH, confirmed: true, client_name: 'Claude' };
const running = (body: Record<string, unknown>): V2Request[] => [
  { method: 'GET', url: SESSION },
  {
    method: 'POST',
    url: `${MY_ACTIONS}/run`,
    body,
    headers: { 'x-sanka-mcp': 'true', 'x-sanka-expected-workspace-id': 'ws-1' },
  },
];
const MY_WORKFLOWS = `${API}/desk/my/workflows`;
const WORKFLOW_ID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const workflow = {
  id: WORKFLOW_ID,
  name: 'Sales HubSpot setup',
  has_conditions: false,
  ticket_steps: [],
  action: { ...action, inputs: actionArgs.inputs },
  last_run: { status: 'succeeded' },
};
const workflowPreview = {
  workflow_id: WORKFLOW_ID,
  name: workflow.name,
  decision: 'needs_approval',
  skip_reason: null,
  action: preview,
  plan_hash: PLAN_HASH,
};
const workflowRunArgs = { workflow_id: WORKFLOW_ID, plan_hash: PLAN_HASH, confirmed: true };
const startingWorkflow = (clientKey: unknown): V2Request[] => [
  { method: 'GET', url: SESSION },
  {
    method: 'POST',
    url: `${MY_WORKFLOWS}/${WORKFLOW_ID}/run`,
    body: { plan_hash: PLAN_HASH, confirmed: true, client_key: clientKey },
    headers: { 'x-sanka-mcp': 'true', 'x-sanka-expected-workspace-id': 'ws-1' },
  },
];
const awaitingApproval = {
  ...filed,
  state: 'awaiting_approval',
  waiting_on: 'approval',
  available_actions: [],
  pending_approval: {
    approvers: 'their manager',
    expires_at: '2026-11-03T09:00:00Z',
    approval_url: APPROVAL_URL,
  },
};

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
      'The requester can reply or withdraw on the Desk page or where the request came from; these tools cannot.',
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
      text: 'I cannot log in to Slack',
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
  {
    name: 'get_capability_guidance sends IT requests to the Desk tools where Desk is on',
    tool: getCapabilityGuidanceTool,
    args: { intent: 'I cannot log in to Slack and need IT support' },
    responses: [envelope({ items: [], state: 'open', limit: 1, total: 0 })],
    requests: [probe],
    structuredContent: {
      guidance: {
        intent_family: 'sanka_desk_it_requests',
        sanka_desk: 'enabled',
        recommended_tools: ['desk_create_ticket', 'desk_get_ticket_status', 'desk_list_my_tickets'],
      },
    },
  },
  {
    name: 'desk_list_actions lists each Action with its mode and inputs',
    tool: deskListActionsTool,
    args: {},
    responses: [envelope({ items: [action] })],
    requests: [{ method: 'GET', url: MY_ACTIONS }],
    structuredContent: { items: [action] },
    text: [
      '- hubspot_account_setup: Set up a HubSpot user · on hubspot · you may: run · automatic · inputs: subject_email*, role',
    ],
  },
  {
    name: 'desk_preview_action files nothing and says the approvers, the credits shortfall and what to ask',
    tool: deskPreviewActionTool,
    args: actionArgs,
    responses: [envelope(shortPreview)],
    requests: [{ method: 'POST', url: `${MY_ACTIONS}/preview`, body: actionArgs }],
    structuredContent: { decision: 'needs_approval', credits_short: true, plan_hash: PLAN_HASH },
    text: [
      '- hubspot create_user (automatic)\nRisk R2 (provisioning).',
      'it waits for approval by manager (Mio Tanaka)',
      `Sanka Credits: 30, billed like Sanka Bot (the workspace has 10). That is not enough`,
      CREDITS_URL,
      `ask "Create this ticket?". Only after their yes, call desk_run_action with the same operation_key and inputs, plan_hash "${PLAN_HASH}" and confirmed: true.`,
    ],
  },
  {
    name: 'desk_preview_action gives the refusal and offers an ordinary IT request',
    tool: deskPreviewActionTool,
    args: actionArgs,
    responses: [
      envelope({
        ...preview,
        decision: 'not_allowed',
        preview: null,
        credits: null,
        plan_hash: null,
        refusal: { code: 'DESK_ACTION_NOT_ALLOWED', message: 'HubSpot is for admins.' },
      }),
    ],
    requests: [{ method: 'POST', url: `${MY_ACTIONS}/preview`, body: actionArgs }],
    text: [
      'hubspot_account_setup is not allowed for this person here (DESK_ACTION_NOT_ALLOWED): HubSpot is for admins.',
      'offer to file an ordinary IT request with desk_create_ticket',
    ],
  },
  {
    name: 'desk_run_action files the confirmed plan in the session workspace without a client retry',
    tool: deskRunActionTool,
    args: runArgs,
    responses: [session(), envelope({ ticket: filed, preview })],
    requests: running({ ...runArgs, client_key: expect.stringMatching(/^mcp-[0-9a-f]{40}$/) }),
    structuredContent: { ok: true, status: 'filed', workspace_id: 'ws-1', ticket: { id: TICKET_ID } },
    text: [
      'Filed hubspot_account_setup with the IT service desk of Acme as #12.',
      'it waits for approval by manager (Mio Tanaka)',
    ],
  },
  {
    name: 'desk_run_action says when the Sanka Credits do not cover the run',
    tool: deskRunActionTool,
    args: { ...runArgs, client_key: 'retry-key-0001' },
    responses: [session(), envelope({ ticket: filed, preview: shortPreview })],
    requests: running({ ...runArgs, client_key: 'retry-key-0001' }),
    text: ['That is not enough: tell the person the Sanka Credits ran out', CREDITS_URL],
  },
  {
    name: 'desk_run_action files nothing without the person confirming',
    tool: deskRunActionTool,
    args: { ...runArgs, confirmed: false },
    responses: [],
    requests: [],
    schemaValid: false,
    isError: true,
    text: ['Nothing was filed: `confirmed` must be true'],
  },
  ...[
    [
      409,
      'DESK_PLAN_CHANGED',
      'Call desk_preview_action again, show the new preview, ask "Create this ticket?" again',
    ],
    [403, 'DESK_ACTION_NOT_ALLOWED', 'offer to file an ordinary IT request with desk_create_ticket'],
    [403, 'DESK_ACTION_SURFACE_OFF', 'does not let AI clients start Actions on this integration'],
  ].map(([status = 0, code = '', hint = '']) => ({
    name: `desk_run_action reports ${code} and files nothing`,
    tool: deskRunActionTool,
    args: { ...runArgs, client_key: 'retry-key-0001' },
    responses: [session(), deskError(Number(status), String(code), 'Refused.')],
    requests: running({ ...runArgs, client_key: 'retry-key-0001' }),
    isError: true,
    structuredContent: { ok: false, status_code: status, code },
    text: [`Nothing was filed (${code}): Refused.`, String(hint)],
  })),
  {
    name: 'desk_get_ticket_status gives the approval page of a change waiting for approval',
    tool: deskGetTicketStatusTool,
    args: { ticket: '#12' },
    responses: [envelope(awaitingApproval)],
    requests: [{ method: 'GET', url: `${MY_TICKETS}/%2312` }],
    text: [
      'It waits for approval by their manager until 2026-11-03T09:00:00Z; these tools cannot approve anything.',
      `Approval page: ${APPROVAL_URL}`,
    ],
  },
  {
    name: 'desk_get_ticket_status says a change was cancelled because the Sanka Credits ran out',
    tool: deskGetTicketStatusTool,
    args: { ticket: '#12' },
    responses: [envelope({ ...filed, state: 'with_specialist', state_reason: 'credits_required' })],
    requests: [{ method: 'GET', url: `${MY_TICKETS}/%2312` }],
    text: ["cancelled because the workspace's Sanka Credits ran out (DESK_CREDITS_REQUIRED)"],
  },
  {
    name: 'desk_list_my_approvals reads only the approvals waiting for the caller, with their pages',
    tool: deskListMyApprovalsTool,
    args: { limit: 10 },
    responses: [
      envelope({
        items: [
          {
            id: 'ap-1',
            operation_key: 'hubspot_account_setup',
            risk_tier: 'R2',
            expires_at: '2026-11-03T09:00:00Z',
            ticket: { number: 12, title: 'Set up HubSpot', requester_email: 'rina@acme.test' },
            approval_url: APPROVAL_URL,
          },
        ],
        total: 1,
      }),
    ],
    requests: [{ method: 'GET', url: `${API}/desk/approvals?status=pending&approver=me&page_size=10` }],
    text: [
      `- #12 "Set up HubSpot" · hubspot_account_setup · risk R2 · for rina@acme.test · expires 2026-11-03T09:00:00Z · approval page ${APPROVAL_URL}`,
      'these tools cannot approve or reject',
    ],
  },
  {
    name: 'get_capability_guidance sends an account change to the Desk Actions where Desk is on',
    tool: getCapabilityGuidanceTool,
    args: { intent: 'Set up a HubSpot account for our new hire rina@acme.test' },
    responses: [envelope({ items: [], state: 'open', limit: 1, total: 0 })],
    requests: [probe],
    structuredContent: {
      guidance: { intent_family: 'sanka_desk_actions', recommended_tools: DESK_ACTION_TOOL_NAMES },
    },
  },
  {
    name: 'desk_list_workflows lists each workflow with its Action and the mode for the caller',
    tool: deskListWorkflowsTool,
    args: {},
    responses: [envelope({ items: [workflow], stopped: false })],
    requests: [{ method: 'GET', url: MY_WORKFLOWS }],
    text: [
      `- "Sales HubSpot setup" (id ${WORKFLOW_ID}) · runs hubspot_account_setup with {"subject_email":"rina@acme.test"} · you may: run · last run succeeded`,
    ],
  },
  {
    name: 'desk_preview_workflow starts nothing and says what to ask before running',
    tool: deskPreviewWorkflowTool,
    args: { workflow_id: WORKFLOW_ID },
    responses: [envelope(workflowPreview)],
    requests: [{ method: 'POST', url: `${MY_WORKFLOWS}/${WORKFLOW_ID}/preview` }],
    structuredContent: { decision: 'needs_approval', plan_hash: PLAN_HASH },
    text: [
      'it waits for approval by manager (Mio Tanaka)',
      `ask "Run this workflow?". Only after their yes, call desk_run_workflow with workflow_id "${WORKFLOW_ID}", plan_hash "${PLAN_HASH}" and confirmed: true.`,
    ],
  },
  {
    name: 'desk_preview_workflow says why a run would open nothing',
    tool: deskPreviewWorkflowTool,
    args: { workflow_id: WORKFLOW_ID },
    responses: [
      envelope({
        ...workflowPreview,
        decision: 'nothing_to_run',
        skip_reason: 'earlier_ticket_open',
        action: null,
        plan_hash: null,
      }),
    ],
    requests: [{ method: 'POST', url: `${MY_WORKFLOWS}/${WORKFLOW_ID}/preview` }],
    text: ['the Action ticket of an earlier run is still open', 'do not run it'],
  },
  {
    name: 'desk_run_workflow starts the confirmed run in the session workspace without a client retry',
    tool: deskRunWorkflowTool,
    args: workflowRunArgs,
    responses: [
      session(),
      envelope({ run: { id: 'run-1', status: 'running' }, preview: workflowPreview, replayed: false }),
    ],
    requests: startingWorkflow(expect.stringMatching(/^mcp-[0-9a-f]{40}$/)),
    structuredContent: { ok: true, status: 'started', workspace_id: 'ws-1', run: { id: 'run-1' } },
    text: ['Started "Sales HubSpot setup" in Acme (run run-1, running).', 'desk_list_my_tickets'],
  },
  {
    name: 'desk_run_workflow says when the key returned a run an earlier call started',
    tool: deskRunWorkflowTool,
    args: { ...workflowRunArgs, client_key: 'retry-key-0001' },
    responses: [
      session(),
      envelope({ run: { id: 'run-1', status: 'succeeded' }, preview: null, replayed: true }),
    ],
    requests: startingWorkflow('retry-key-0001'),
    text: ['An earlier call already started this run (run-1, succeeded); nothing new was started.'],
  },
  {
    name: 'desk_run_workflow starts nothing without the person confirming',
    tool: deskRunWorkflowTool,
    args: { ...workflowRunArgs, confirmed: false },
    responses: [],
    requests: [],
    schemaValid: false,
    isError: true,
    text: ['Nothing was started: `confirmed` must be true'],
  },
  ...[
    [
      409,
      'DESK_PLAN_CHANGED',
      'Call desk_preview_workflow again, show the new preview, ask "Run this workflow?" again',
    ],
    [403, 'DESK_ADMIN_REQUIRED', 'Only a workspace admin can start a Desk Workflow'],
    [409, 'DESK_WORKFLOW_NOTHING_TO_RUN', 'would open no Action ticket'],
  ].map(([status = 0, code = '', hint = '']) => ({
    name: `desk_run_workflow reports ${code} and starts nothing`,
    tool: deskRunWorkflowTool,
    args: { ...workflowRunArgs, client_key: 'retry-key-0001' },
    responses: [session(), deskError(Number(status), String(code), 'Refused.')],
    requests: startingWorkflow('retry-key-0001'),
    isError: true,
    structuredContent: { ok: false, status_code: status, code },
    text: [`Nothing was started (${code}): Refused.`, String(hint)],
  })),
  {
    name: 'get_capability_guidance sends starting a Desk Workflow to the workflow tools where Desk is on',
    tool: getCapabilityGuidanceTool,
    args: { intent: 'Run the Desk workflow "Sales HubSpot setup"' },
    responses: [envelope({ items: [], state: 'open', limit: 1, total: 0 })],
    requests: [probe],
    structuredContent: {
      guidance: { intent_family: 'sanka_desk_workflows', recommended_tools: DESK_WORKFLOW_TOOL_NAMES },
    },
  },
  {
    name: 'get_capability_guidance keeps the guidance of a workspace without Desk',
    tool: getCapabilityGuidanceTool,
    args: { intent: 'Create a Google Workspace account for the new hire' },
    responses: [deskError(403, 'DESK_NOT_ENABLED', 'Sanka Desk is not enabled for this workspace.')],
    requests: [probe],
    structuredContent: {
      guidance: { intent_family: 'directory_account_workflows', sanka_desk: 'not_enabled' },
    },
  },
  {
    name: 'get_capability_guidance leaves a Flow ticket about a login problem to the ticket tools',
    tool: getCapabilityGuidanceTool,
    args: { intent: 'Create a ticket: a customer cannot log in to our portal', object_type: 'ticket' },
    responses: [],
    requests: [],
    structuredContent: { guidance: { intent_family: 'general_sanka_capability' } },
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
    const actionKey = { type: 'string', minLength: 1, maxLength: 64 };
    const actionInputs = { type: 'object', additionalProperties: true };
    const workflowId = { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' };
    const contract = (tool: McpTool) => [
      tool.tool.name,
      JSON.parse(
        JSON.stringify(tool.tool.inputSchema, (key, value) => (key === 'description' ? undefined : value)),
      ),
    ];

    expect(
      [
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
      ].map(contract),
    ).toEqual([
      [
        'desk_create_ticket',
        {
          type: 'object',
          additionalProperties: false,
          required: ['text'],
          properties: {
            text: { type: 'string', minLength: 1, maxLength: 4000 },
            subject_email: { type: 'string', format: 'email', maxLength: 320 },
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
      ['desk_list_actions', { type: 'object', additionalProperties: false, properties: {} }],
      [
        'desk_preview_action',
        {
          type: 'object',
          additionalProperties: false,
          required: ['operation_key', 'inputs'],
          properties: { operation_key: actionKey, inputs: actionInputs },
        },
      ],
      [
        'desk_run_action',
        {
          type: 'object',
          additionalProperties: false,
          required: ['operation_key', 'inputs', 'plan_hash', 'confirmed'],
          properties: {
            operation_key: actionKey,
            inputs: actionInputs,
            plan_hash: { type: 'string', pattern: '^[0-9a-f]{64}$' },
            confirmed: { type: 'boolean', const: true },
            client_key: { type: 'string', minLength: 8, maxLength: 100 },
            client_name: { type: 'string', maxLength: 80 },
          },
        },
      ],
      [
        'desk_list_my_approvals',
        {
          type: 'object',
          additionalProperties: false,
          properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } },
        },
      ],
      ['desk_list_workflows', { type: 'object', additionalProperties: false, properties: {} }],
      [
        'desk_preview_workflow',
        {
          type: 'object',
          additionalProperties: false,
          required: ['workflow_id'],
          properties: { workflow_id: workflowId },
        },
      ],
      [
        'desk_run_workflow',
        {
          type: 'object',
          additionalProperties: false,
          required: ['workflow_id', 'plan_hash', 'confirmed'],
          properties: {
            workflow_id: workflowId,
            plan_hash: { type: 'string', pattern: '^[0-9a-f]{64}$' },
            confirmed: { type: 'boolean', const: true },
            client_key: { type: 'string', minLength: 8, maxLength: 100 },
          },
        },
      ],
    ]);
  });
});
