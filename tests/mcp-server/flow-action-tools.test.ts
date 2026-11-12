import { getCapabilityGuidanceTool } from '../../packages/mcp-server/src/capability-guidance-tools';
import {
  getFlowActionRunTool,
  listCompanyListsTool,
  previewFlowActionTool,
  runFlowActionTool,
} from '../../packages/mcp-server/src/flow-action-tools';
import { normalizeToolCallResult } from '../../packages/mcp-server/src/tool-result-normalizer';
import { validateToolArguments } from '../../packages/mcp-server/src/tool-argument-validator';
import { envelope, oauthContext, sendThroughSDK } from './crm/helpers';

const API = 'http://localhost:5000/api/v2';
const SEARCH_PREVIEW = `${API}/actions/ai-contact-search/selection-preview`;
const EXECUTE = `${API}/workflows/form/action/execute`;
const RUN_ID = '4c7d7eb2-b5b8-5b33-a6c6-1b74e7879830';
// Every Action call first reads the workspace the connection's API token names, then binds to it.
const session = () => envelope({ current_workspace: { id: 'ws-1', code: '10101010' } });
const SESSION_READ = { method: 'GET', url: `${API}/public/auth/session` };
const BOUND = { 'x-sanka-expected-workspace-id': 'ws-1', 'x-sanka-mcp': 'true' };
const auth = oauthContext({ workspace: { code: '10101010' } });

const preview = (overrides: Record<string, unknown> = {}) =>
  envelope({
    selected_count: 2,
    record_ids: ['c-1', 'c-2'],
    maximum_selected_count: 100,
    inputs: { roles: ['finance'], country: '', job_title_property: 'prop-title' },
    ...overrides,
  });
const started = () => envelope({ state: 'enqueued', action_history_id: RUN_ID });

const apiError = (status: number, code: string, message: string, details: unknown = {}) =>
  new Response(JSON.stringify({ success: false, error: { code, message, details } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const searchArgs = { action: 'ai_contact_search', company_ids: ['c-1', 'c-2'], roles: ['finance'] };

const person = (overrides: Record<string, unknown>) => ({
  id: 'p1',
  full_name: 'Avery Stone',
  email: 'avery@example.com',
  email_status: 'found',
  existing_contact_id: null,
  created_contact_id: null,
  ...overrides,
});

describe('Flow Action tools', () => {
  // The bug: a preview that starts a run, or sends a value the Action does not take.
  it('preview counts the selection with the Action inputs and starts nothing', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: previewFlowActionTool,
      args: { ...searchArgs, max_people: 3 },
      responses: [session(), preview()],
    });

    expect(requests).toEqual([
      SESSION_READ,
      {
        method: 'POST',
        url: SEARCH_PREVIEW,
        body: {
          object_type: 'company',
          record_ids: ['c-1', 'c-2'],
          inputs: { roles: ['finance'], max_people: 3 },
        },
        headers: BOUND,
      },
    ]);
    expect(result.structuredContent).toMatchObject({ status: 'needs_confirmation', company_count: 2 });
  });

  // The bug: a run on what the model sent rather than what was confirmed, or without the form
  // defaults, which lose the person's job title and LinkedIn link when they are picked.
  it('run sends the confirmed ids and the form values as an explicit selection', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: runFlowActionTool,
      args: { action: 'ai_contact_search', list_id: 'list-1', confirmed_company_count: 2 },
      responses: [session(), preview(), started()],
      context: { auth },
    });

    expect(requests[1]).toMatchObject({ url: SEARCH_PREVIEW, body: { list_id: 'list-1' } });
    expect(requests[2]).toEqual({
      method: 'POST',
      url: `${EXECUTE}?action_id=ai-contact-search&object_type=company&page_group_type=company`,
      body: {
        roles: ['finance'],
        country: '',
        job_title_property: 'prop-title',
        idempotency_key: expect.stringMatching(/^mcp-/),
        selection: { mode: 'explicit', object_type: 'company', record_ids: ['c-1', 'c-2'] },
      },
      headers: BOUND,
    });
    expect(result.structuredContent).toMatchObject({
      status: 'enqueued',
      company_count: 2,
      run_id: RUN_ID,
      action_history_url: 'https://flow.sanka.com/10101010/crm/companies/actions?action_tab=history',
    });
  });

  // The bug: the session read for the link fails after the run started, and the person is told
  // nothing ran, so they run it again.
  it('a run stands when the link cannot be built', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: runFlowActionTool,
      args: { ...searchArgs, confirmed_company_count: 2 },
      responses: [session(), preview(), new Response('', { status: 500 }), started()],
    });

    expect(requests.map((request) => request.url.split('?')[0])).toEqual([
      SESSION_READ.url,
      SEARCH_PREVIEW,
      `${API}/auth/session`,
      EXECUTE,
    ]);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ run_id: RUN_ID });
  });

  // The bug: a connection that switched workspace spends credit in the wrong one.
  it('stops when the connection workspace is not the expected one', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: runFlowActionTool,
      args: { ...searchArgs, confirmed_company_count: 2, expected_workspace_id: 'ws-2' },
      responses: [session()],
      context: { auth },
    });
    expect(result.isError).toBe(true);
    expect(requests).toEqual([SESSION_READ]);
  });

  // The bug: a repeated tool call bills the same companies twice.
  it('the same request is one run, and a different one is not', async () => {
    const keyOf = async (args: Record<string, unknown>) => {
      const { requests } = await sendThroughSDK({
        tool: runFlowActionTool,
        args: { ...args, confirmed_company_count: 2 },
        responses: [session(), preview(args['roles'] ? { inputs: { roles: args['roles'] } } : {}), started()],
        context: { auth },
      });
      return (requests[2]?.body as Record<string, unknown>)['idempotency_key'];
    };

    const first = await keyOf(searchArgs);
    expect(await keyOf(searchArgs)).toBe(first);
    expect(await keyOf({ ...searchArgs, roles: ['executives'] })).not.toBe(first);
  });

  it.each([
    // The bug: the selection grew after the person said yes, and more companies were billed.
    {
      name: 'the count changed since the person confirmed it',
      tool: runFlowActionTool,
      args: { ...searchArgs, confirmed_company_count: 3 },
      responses: [session(), preview()],
      requestCount: 2,
      text: 'not the 3 the person confirmed',
    },
    // The bug: a model runs without asking, when the schema is not enforced by its client.
    {
      name: 'no confirmed count',
      tool: runFlowActionTool,
      args: searchArgs,
      responses: [],
      requestCount: 0,
      text: 'confirmed_company_count',
    },
    // The bug: AI contact search answers a request for phone numbers it never looks up.
    {
      name: 'an input of the other Action',
      tool: previewFlowActionTool,
      args: { ...searchArgs, find_phone: true },
      responses: [],
      requestCount: 0,
      text: 'ai_contact_search does not take find_phone',
    },
    {
      name: 'two selections at once',
      tool: previewFlowActionTool,
      args: { ...searchArgs, view_id: 'view-1' },
      responses: [],
      requestCount: 0,
      text: 'exactly one of company_ids, view_id or list_id',
    },
    // The bug: an Action outside the allow-list reaches its run.
    {
      name: 'an Action outside the allow-list',
      tool: previewFlowActionTool,
      args: { action: 'send_email', company_ids: ['c-1'] },
      responses: [],
      requestCount: 0,
      text: 'must be one of ai_contact_search, find_company_details',
    },
  ])('refuses $name without running', async ({ tool, args, responses, requestCount, text }) => {
    const { requests, result } = await sendThroughSDK({ tool, args, responses });

    expect(result.isError).toBe(true);
    expect(requests).toHaveLength(requestCount);
    expect(JSON.stringify(result.content)).toContain(text);
  });

  // The bug: a 429 reads as worth retrying, so a model loops on a limit that lifts tomorrow.
  it.each([
    [422, 'ACTION_SELECTION_LIMIT_EXCEEDED', 'This selection has 200 records.'],
    [429, 'CONTACT_SEARCH_DAILY_LIMIT', 'This workspace has searched 1000 companies today.'],
    [429, 'FIND_COMPANY_DETAILS_DAILY_LIMIT', 'This workspace reached the limit.'],
  ])('%i %s reaches the caller as final', async (status, code, message) => {
    const { requests, result } = await sendThroughSDK({
      tool: runFlowActionTool,
      args: { ...searchArgs, confirmed_company_count: 2 },
      responses: [session(), apiError(status, code, message)],
    });
    const normalized = normalizeToolCallResult({
      mcpTool: runFlowActionTool,
      args: searchArgs,
      result,
    });

    expect(requests).toHaveLength(2);
    expect(normalized.isError).toBe(true);
    expect(normalized.structuredContent).toMatchObject({
      code,
      message,
      status_code: status,
      remediation: { can_retry: false },
    });
    expect(JSON.stringify(normalized.content)).toContain('Do not repeat the call');
  });

  // The bug: a workspace without the flag gets a raw error, and the model looks for another way.
  it('a workspace without the Action is told so', async () => {
    const { result } = await sendThroughSDK({
      tool: previewFlowActionTool,
      args: searchArgs,
      responses: [
        session(),
        apiError(403, 'FEATURE_NOT_ENABLED', 'AI contact search is not available in this workspace.'),
      ],
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: 'FEATURE_NOT_ENABLED', status_code: 403 });
    expect(JSON.stringify(result.content)).toContain('do not try to get the same result');
  });

  // The bug: a run's people reach a shared Slack channel, or 'done' reads as contacts created.
  it('a finished AI contact search reports counts and the link, never the people', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: getFlowActionRunTool,
      args: { run_id: RUN_ID },
      responses: [
        session(),
        envelope({
          id: RUN_ID,
          action_slug: 'ai-contact-search',
          status: 'partially_failed',
          output_data: {
            selected_count: 2,
            contact_search_companies: [
              {
                company: { id: 'c-1', name: 'Acme' },
                status: 'found',
                candidates: [
                  person({}),
                  person({ id: 'p2', email: '', email_status: 'not_found', existing_contact_id: 'k1' }),
                ],
              },
              { company: { id: 'c-2', name: 'Beta' }, status: 'failed', error: 'Provider failed' },
            ],
          },
        }),
      ],
      context: { auth },
    });

    expect(requests).toEqual([
      SESSION_READ,
      { method: 'GET', url: `${API}/action-history/runs/${RUN_ID}`, headers: BOUND },
    ]);
    expect(result.structuredContent).toMatchObject({
      done: true,
      company_count: 2,
      summary: {
        companies: 2,
        companies_failed: 1,
        people_found: 2,
        work_emails_found: 1,
        already_in_flow: 1,
        contacts_created: 0,
      },
      companies: [
        { company_id: 'c-1', people_found: 2 },
        { company_id: 'c-2', status: 'failed', error: 'Provider failed' },
      ],
      action_history_url: expect.stringContaining('/10101010/'),
    });
    expect(JSON.stringify(result)).not.toMatch(/Avery|avery@example\.com/);
    expect(JSON.stringify(result.content)).toContain('pick who to add');
  });

  it.each([
    [
      'still running',
      { action_slug: 'ai-contact-search', status: 'running', output_data: { processed_count: 1 } },
      { done: false, status: 'running' },
      'still running',
    ],
    // The bug: a run refused in the worker reads as finished with nobody found.
    [
      'failed in the worker',
      {
        action_slug: 'ai-contact-search',
        status: 'failed',
        output_data: { error_code: 'ACTION_SELECTION_LIMIT_EXCEEDED', message: 'Selected 150.' },
      },
      { done: true, ok: false },
      'failed: Selected 150.',
    ],
    [
      'Find company details',
      {
        action_slug: 'find-company-details',
        status: 'success',
        output_data: {
          company_details: [
            { company_id: 'c-1', name: 'Acme', status: 'filled', phone_number: '+61 2 5550 0100' },
            { company_id: 'c-2', name: 'Beta', status: 'already_filled' },
          ],
        },
      },
      { done: true, summary: { filled: 1, already_filled: 1 } },
      '1 filled, 1 already filled',
    ],
  ])('a run reads as %s', async (_name, run, structured, text) => {
    const { result } = await sendThroughSDK({
      tool: getFlowActionRunTool,
      args: { run_id: RUN_ID },
      responses: [session(), envelope(run)],
      context: { auth },
    });

    expect(result.structuredContent).toMatchObject(structured);
    expect(JSON.stringify(result.content)).toContain(text);
  });

  // The bug: a run of an Action outside the allow-list is reported through this tool.
  it('leaves a run of another Action alone', async () => {
    const { result } = await sendThroughSDK({
      tool: getFlowActionRunTool,
      args: { run_id: RUN_ID },
      responses: [session(), envelope({ action_slug: 'send-email', status: 'success' })],
    });

    expect(result.isError).toBe(true);
  });

  // The bug: a link built for a workspace the session does not hold, when OAuth names no code.
  it('reads the workspace for the link when the connection does not name it', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: getFlowActionRunTool,
      args: { run_id: RUN_ID },
      responses: [
        session(),
        envelope({ action_slug: 'ai-contact-search', status: 'success', output_data: {} }),
        envelope({ current_workspace: { id: 'ws-1', code: '55555555' } }),
      ],
    });

    expect(requests.map((request) => request.url)).toEqual([
      SESSION_READ.url,
      `${API}/action-history/runs/${RUN_ID}`,
      `${API}/auth/session`,
    ]);
    expect(result.structuredContent).toMatchObject({
      action_history_url: expect.stringContaining('/55555555/'),
    });
  });

  // The bug: a rep's list is a saved view, and Sanka AI only offers this tool.
  it.each([
    [
      'both kinds',
      envelope({ items: [{ id: 'l-1', name: 'Joel list', member_count: 200, owner: { name: 'Joel' } }] }),
      [
        { kind: 'list', id: 'l-1', name: 'Joel list', company_count: 200, owner: 'Joel' },
        { kind: 'view', id: 'v-1', name: 'Cez List' },
      ],
    ],
    [
      'the views where Lists are off',
      apiError(403, 'LISTS_NOT_ENABLED', 'Lists are not enabled for this workspace.'),
      [{ kind: 'view', id: 'v-1', name: 'Cez List' }],
    ],
  ])('list_company_lists returns %s', async (_name, lists, items) => {
    const { requests, result } = await sendThroughSDK({
      tool: listCompanyListsTool,
      args: {},
      responses: [lists, envelope([{ view_id: 'v-1', label: 'Cez List' }])],
    });

    expect(requests.map((request) => request.url)).toEqual([
      `${API}/lists?object_type=company&page_size=100`,
      `${API}/views?object_type=companies`,
    ]);
    expect(result.structuredContent).toMatchObject({ items, total: items.length });
  });

  it('takes the schema it publishes', () => {
    expect(
      validateToolArguments({
        mcpTool: runFlowActionTool,
        args: { ...searchArgs, confirmed_company_count: 2, max_people: 10, owner: 'company_owner' },
      }),
    ).toBeUndefined();
    expect(
      validateToolArguments({ mcpTool: runFlowActionTool, args: { ...searchArgs, mobile: true } }),
    ).toBeDefined();
  });
});

describe('get_capability_guidance for finding people', () => {
  const familyFor = async (intent: string) => {
    const { requests, result } = await sendThroughSDK({ tool: getCapabilityGuidanceTool, args: { intent } });
    const guidance = (result.structuredContent as { guidance: Record<string, unknown> }).guidance;
    return { family: guidance['intent_family'], requests };
  };

  // The bug (Desk #61): Sanka AI searched deals and HubSpot and stopped on "a channel_id is required".
  it.each([
    'Enrich my leads with contacts and email addresses associated with the company contact.',
    'Find people at the companies on my list',
    'look up work emails for my accounts',
    'fill in the phone numbers and addresses of my companies',
    'リストの企業の担当者とメールアドレスを探して',
    // Without this, "my account" reads as an IT request and Desk would be asked first.
    'find contacts for leads on my account list',
  ])('routes "%s" to the Flow Actions, without asking Desk', async (intent) => {
    expect(await familyFor(intent)).toEqual({ family: 'sanka_flow_actions', requests: [] });
  });

  it.each([
    'Enrich my HubSpot contacts with email addresses for each company',
    'Add a contact to the Acme company',
    'Build a workflow that finds contacts for new companies',
  ])('leaves "%s" to its own tools', async (intent) => {
    expect((await familyFor(intent)).family).not.toBe('sanka_flow_actions');
  });
});
