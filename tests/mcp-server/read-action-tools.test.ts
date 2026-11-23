import { getCapabilityGuidanceTool } from '../../packages/mcp-server/src/capability-guidance-tools';
import {
  getReadActionRunTool,
  listReadActionsTool,
  runReadActionTool,
} from '../../packages/mcp-server/src/read-action-tools';
import { normalizeToolCallResult } from '../../packages/mcp-server/src/tool-result-normalizer';
import { envelope, sendThroughSDK } from './crm/helpers';

const API = 'http://localhost:5000/api/v2';
const RUN_ID = '6f1c2a90-1b2c-4d3e-8f40-5a6b7c8d9e01';
const session = () => envelope({ current_workspace: { id: 'ws-1', code: '10101010' } });
const SESSION_READ = { method: 'GET', url: `${API}/auth/session` };
const BOUND = { 'x-sanka-expected-workspace-id': 'ws-1', 'x-sanka-mcp': 'true' };
const CONNECT_URL = 'https://flow.sanka.com/10101010/account/integrations';

const apiError = (status: number, code: string, message: string, details: unknown = {}) =>
  new Response(JSON.stringify({ success: false, error: { code, message, details } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const inputs = {
  object: 'deals',
  metric: 'sum',
  field: 'amount',
  group_by: 'dealstage',
  filters: [{ field: 'closedate', operator: 'between', value: ['2026-10-01', '2026-12-31'] }],
};
const runArgs = { action_key: 'hubspot:crm.aggregate', inputs };

const method = (overrides: Record<string, unknown> = {}) => ({
  filters: inputs.filters,
  query_sent: { filterGroups: [] },
  records_scanned: 412,
  complete: true,
  as_of: '2026-11-23T03:00:00Z',
  currency: 'JPY',
  identity: { provider: 'hubspot', account: '4455667', provider_user_id: '91' },
  ...overrides,
});

const run = (overrides: Record<string, unknown> = {}) => ({
  run_id: RUN_ID,
  action_key: 'hubspot:crm.aggregate',
  status: 'succeeded',
  created_at: new Date().toISOString(),
  finished_at: new Date().toISOString(),
  result: {
    object: 'deals',
    metric: 'sum',
    field: 'amount',
    groups: [{ key: 'closedwon', label: 'Closed won', count: 12, value: 4800000 }],
  },
  method: method(),
  credits_charged: 20,
  ...overrides,
});

const keyOf = async (args: Record<string, unknown>) => {
  const { requests } = await sendThroughSDK({
    tool: runReadActionTool,
    args,
    responses: [session(), envelope(run())],
  });
  return (requests[1]?.body as Record<string, unknown>)['client_key'];
};

describe('read Action tools', () => {
  afterEach(() => jest.restoreAllMocks());

  // The bug: the person is not told their CRM is not connected, or gets no link to connect it.
  it('list_read_actions gives each Action its price and a connect link when not connected', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: listReadActionsTool,
      args: {},
      responses: [
        envelope({
          actions: [
            {
              key: 'salesforce:crm.search',
              system: 'salesforce',
              kind: 'search',
              title: 'Search Salesforce',
              credits: 10,
              input_schema: { type: 'object', required: ['object'], properties: { object: {} } },
              connection: {
                connected: false,
                provider_slug: 'salesforce-user',
                connect_path: '/10101010/account/integrations',
              },
            },
          ],
        }),
      ],
    });

    expect(requests).toEqual([{ method: 'GET', url: `${API}/read-actions` }]);
    expect(result.structuredContent).toMatchObject({
      actions: [{ key: 'salesforce:crm.search', credits: 10, connect_url: CONNECT_URL }],
    });
    expect(JSON.stringify(result.content)).toContain(`not connected: connect at ${CONNECT_URL}`);
  });

  // The bug: a run is charged in another workspace, retried by the client, or its rows and method
  // are lost before they reach the model.
  it('run_read_action posts once in the bound workspace and returns the result with its method', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: runReadActionTool,
      args: runArgs,
      responses: [session(), envelope(run())],
    });

    expect(requests).toEqual([
      SESSION_READ,
      {
        method: 'POST',
        url: `${API}/read-actions/run`,
        body: runArgs,
        headers: BOUND,
      },
    ]);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      run_id: RUN_ID,
      groups: [{ key: 'closedwon', value: 4800000 }],
      method: { records_scanned: 412, complete: true },
      credits_charged: 20,
    });
    expect(JSON.stringify(result.content)).toContain('records scanned 412');
  });

  // The bug: a question asked again later is answered from an old run (a key that never changes),
  // or a retry with the person's own key is charged twice.
  it('sends no key for a new question and passes a given key through', async () => {
    expect(await keyOf(runArgs)).toBeUndefined();
    expect(await keyOf({ ...runArgs, client_key: 'person-asked-again-1' })).toBe('person-asked-again-1');
  });

  // The bug: an earlier identical run reads as fresh numbers, or a partial total as complete.
  it.each([
    [
      'an earlier identical run',
      run({ created_at: '2026-11-20T00:00:00Z' }),
      { reused: true },
      'call run_read_action again',
    ],
    [
      'an incomplete result',
      run({ method: method({ complete: false }) }),
      { method: { complete: false } },
      'INCOMPLETE',
    ],
  ])('run_read_action says when it returns %s', async (_name, response, structured, text) => {
    const { result } = await sendThroughSDK({
      tool: runReadActionTool,
      args: runArgs,
      responses: [session(), envelope(response)],
    });

    expect(result.structuredContent).toMatchObject(structured);
    expect(JSON.stringify(result.content)).toContain(text);
  });

  // The bug: a refusal reads as worth retrying, so the client loops, or the person is not told
  // what to do next. The SDK is allowed retries here: the tool must turn them off.
  it.each([
    [
      409,
      'READ_ACTION_CONNECT_REQUIRED',
      { connect_path: '/10101010/account/integrations' },
      'Personal integrations',
      { connect_url: CONNECT_URL },
    ],
    [402, 'READ_ACTION_CREDITS_REQUIRED', { required: 20, available: 5 }, 'workspace admin can add', {}],
    [422, 'READ_ACTION_TOO_BROAD', {}, 'narrow the filter', {}],
    [429, 'READ_ACTION_DAILY_LIMIT', {}, 'lifts the next day', {}],
    [502, 'READ_ACTION_PROVIDER_ERROR', {}, 'The CRM refused or failed', {}],
    [409, 'READ_ACTION_KEY_REUSED', {}, 'new client_key', {}],
    [403, 'FEATURE_DISABLED', {}, 'not available in this workspace', {}],
  ])('%i %s reaches the caller as final', async (status, code, details, text, structured) => {
    const { requests, result } = await sendThroughSDK({
      tool: runReadActionTool,
      args: runArgs,
      responses: [session(), apiError(status, code, 'Refused.', details)],
      maxRetries: 2,
    });
    const normalized = normalizeToolCallResult({ mcpTool: runReadActionTool, args: runArgs, result });

    expect(requests).toHaveLength(2);
    expect(normalized.isError).toBe(true);
    expect(normalized.structuredContent).toMatchObject({
      code,
      status_code: status,
      ...structured,
      remediation: { can_retry: false },
    });
    expect(JSON.stringify(normalized.content)).toContain(text);
  });

  // The bug: a failed run reads as an empty result.
  it('get_read_action_run reads a failed run as failed', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: getReadActionRunTool,
      args: { run_id: RUN_ID },
      responses: [
        envelope(
          run({
            status: 'failed',
            result: null,
            credits_charged: 0,
            error: { code: 'READ_ACTION_PROVIDER_ERROR', message: 'INVALID_FIELD: Amountt' },
          }),
        ),
      ],
    });

    expect(requests).toEqual([{ method: 'GET', url: `${API}/read-actions/runs/${RUN_ID}` }]);
    expect(result.structuredContent).toMatchObject({
      ok: false,
      run_id: RUN_ID,
      code: 'READ_ACTION_PROVIDER_ERROR',
      credits_charged: 0,
    });
    expect(JSON.stringify(result.content)).toContain('INVALID_FIELD: Amountt');
  });
});

describe("get_capability_guidance for the person's own CRM", () => {
  const familyFor = async (intent: string) => {
    const { requests, result } = await sendThroughSDK({ tool: getCapabilityGuidanceTool, args: { intent } });
    const guidance = (result.structuredContent as { guidance: Record<string, unknown> }).guidance;
    return { family: guidance['intent_family'], requests };
  };

  it.each([
    'Total my HubSpot deals by stage for this quarter',
    'How many Salesforce opportunities do I have closing this month?',
    'search my hubspot contacts at Acme',
    'Salesforceの商談をオーナー別に合計して',
  ])('routes "%s" to read Actions without asking Desk', async (intent) => {
    expect(await familyFor(intent)).toEqual({ family: 'crm_read_actions', requests: [] });
  });

  it.each([
    'How many deals do we have in Sanka?',
    'Create a HubSpot deal for Acme',
    "Summarize this month's HubSpot revenue",
    "I can't log in to my Salesforce account",
  ])('leaves "%s" to its own tools', async (intent) => {
    expect((await familyFor(intent)).family).not.toBe('crm_read_actions');
  });
});
