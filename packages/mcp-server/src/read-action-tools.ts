// Hand-written tools for read Actions: searches and totals in the connected person's own HubSpot
// or Salesforce, read with their own login from Personal integrations, so the CRM's own
// permissions decide which rows they see (sanka-api docs/specs/read-actions/README.md §7). Each
// completed run costs Sanka Credits; listing Actions and reading a run are free. The routes sit
// outside the public developer OpenAPI contract, so the handlers call raw client paths.
import { createHash } from 'node:crypto';

import { envelopeData, readApiFailure, sessionWorkspace } from './desk-tools';
import { appPathUrl } from './record-url-enrichment';
import { readRecord, readString } from './tool-factories';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpRequestContext, McpTool, ToolCallResult } from './types';

type ToolArgs = Record<string, unknown> | undefined;
type JsonRecord = Record<string, unknown>;

const ACTIONS_PATH = '/api/v2/read-actions';
const RUN_PATH = `${ACTIONS_PATH}/run`;
const RUNS_PATH = `${ACTIONS_PATH}/runs`;

export const READ_ACTION_TOOL_NAMES = ['list_read_actions', 'run_read_action', 'get_read_action_run'];

const ACTION_KEY_MAX_LENGTH = 100;
// A returned run created this long before the call began answered an earlier, identical call.
const EARLIER_RUN_MS = 60 * 1000;

const NOTHING_CHARGED = 'Nothing ran and no Sanka Credits were used';
const NO_RETRY = 'Do not repeat the call or split the question to get around it.';

// What the model should do next. Every code here is final for this call: a retry changes nothing.
const ERROR_HINTS: Record<string, string> = {
  READ_ACTION_CONNECT_REQUIRED:
    "This reads the person's own HubSpot or Salesforce, never the workspace's connection, and they have not connected theirs. Tell them to connect it under Personal integrations in their Sanka account settings (connect_url), then ask again.",
  READ_ACTION_CREDITS_REQUIRED:
    "The workspace's Sanka Credits ran out (details give the credits required and available). Tell the person a workspace admin can add Sanka Credits; run it again after that.",
  READ_ACTION_TOO_BROAD: `More records match than can be counted completely. Ask the person to narrow the filter (a date range, stage, owner or pipeline) and run again; never estimate the total. ${NO_RETRY}`,
  READ_ACTION_DAILY_LIMIT: `The person reached their daily limit of Sanka Credits for read Actions. Tell them it lifts the next day. ${NO_RETRY}`,
  READ_ACTION_KEY_REUSED:
    'This client_key was already used for a different question. Use a new client_key for a new question.',
  READ_ACTION_INPUT_INVALID:
    "The inputs do not match the Action's input_schema from list_read_actions. Fix what the details name and run again.",
  READ_ACTION_NOT_FOUND:
    'There is no such Action or run for this person: list_read_actions lists the Actions they can run, and only the person who ran a run can read it.',
  READ_ACTION_PROVIDER_ERROR:
    'The CRM refused or failed the request with the message above. Tell the person; if it names a field, fix the filter, otherwise try later.',
  FEATURE_DISABLED:
    "Read Actions are not available in this workspace. HubSpot or Salesforce data the workspace syncs can still be read with query_records or aggregate_records (scope=integration): say that it comes from the workspace's connection, not the person's own login.",
  WORKSPACE_CONTEXT_MISMATCH:
    'The connection changed workspace. Check current_workspace, then ask again in the intended workspace.',
};

// The app link for a connect path the API gives, such as /10101010/account/integrations.
const connectUrl = (value: unknown): string | undefined => {
  const path = readString(value);
  if (!path) return undefined;
  if (/^https:\/\//.test(path)) return path;
  return path.startsWith('/') ? appPathUrl(path) : undefined;
};

const records = (value: unknown): JsonRecord[] =>
  (Array.isArray(value) ? value : []).map(readRecord).filter((item): item is JsonRecord => Boolean(item));

const errorResult = (
  code: string,
  message: string,
  lead: string,
  extra: { details?: unknown; status?: number | undefined; ctxID?: string | undefined } = {},
): ToolCallResult => {
  const url = connectUrl(readRecord(extra.details)?.['connect_path']);
  const hint = ERROR_HINTS[code];
  return {
    content: [
      {
        type: 'text',
        text: `${lead} (${code}): ${message}${hint ? ` ${hint}` : ''}${url ? ` Connect: ${url}` : ''}`,
      },
    ],
    isError: true,
    structuredContent: {
      ok: false,
      status: 'error',
      status_code: extra.status,
      code,
      message,
      details: extra.details ?? {},
      ...(url ? { connect_url: url } : undefined),
      ctx_id: extra.ctxID,
      retryable: false,
    },
  };
};

// The read-Action codes are answered whatever their status (a provider error is a 502); any other
// 4xx with a code changes nothing; everything else is left to the server's error handling.
const apiErrorResult = (error: unknown, lead: string): ToolCallResult | undefined => {
  const failure = readApiFailure(error);
  if (!failure) return undefined;
  if (!ERROR_HINTS[failure.code] && (failure.status === undefined || failure.status >= 500)) return undefined;
  return errorResult(failure.code, failure.message, lead, failure);
};

const withApiErrors =
  (
    title: string,
    lead: string,
    run: (reqContext: McpRequestContext, args: ToolArgs) => Promise<ToolCallResult>,
  ) =>
  async ({
    reqContext,
    args,
  }: {
    reqContext: McpRequestContext;
    args: ToolArgs;
  }): Promise<ToolCallResult> => {
    const authError = requireAuthentication({ reqContext, toolTitle: title });
    if (authError) return authError;
    try {
      return await run(reqContext, args);
    } catch (error) {
      const result = apiErrorResult(error, lead);
      if (result) return result;
      throw error;
    }
  };

// JSON with every object's keys sorted, so the same question gives the same text.
const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    readRecord(item) ?
      Object.fromEntries(Object.entries(item as JsonRecord).sort(([a], [b]) => a.localeCompare(b)))
    : item,
  );

// The same Action with the same inputs is one run, at any time: a repeated call returns the first
// run and is not charged again. Values are not rewritten, so the key never joins two questions the
// API tells apart (it answers READ_ACTION_KEY_REUSED for one key with different inputs).
const derivedClientKey = (actionKey: string, inputs: JsonRecord): string =>
  `mcp-${createHash('sha256')
    .update(canonicalJson(['read-action', actionKey, inputs]))
    .digest('hex')
    .slice(0, 40)}`;

const identityLabel = (identity: JsonRecord | undefined): string | undefined => {
  const parts = [readString(identity?.['provider']), readString(identity?.['account'])].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : undefined;
};

const methodLine = (method: JsonRecord): string => {
  const identity = identityLabel(readRecord(method['identity']));
  return [
    `Method: filters ${JSON.stringify(method['filters'] ?? [])}`,
    `records scanned ${String(method['records_scanned'] ?? '?')}`,
    `complete ${String(method['complete'] ?? '?')}`,
    ...(readString(method['as_of']) ? [`as of ${readString(method['as_of'])}`] : []),
    ...(readString(method['currency']) ? [`currency ${readString(method['currency'])}`] : []),
    ...(identity ? [`read as ${identity}`] : []),
  ].join(' · ');
};

const resultLine = (result: JsonRecord): string => {
  const object = readString(result['object']) ?? 'records';
  const groups = records(result['groups']);
  if (groups.length > 0) return `${groups.length} groups of ${object}.`;
  if (typeof result['value'] === 'number') {
    const metric = [readString(result['metric']), readString(result['field'])].filter(Boolean).join(' of ');
    return `${metric || 'Value'} over ${object}: ${result['value']}.`;
  }
  const rows = records(result['rows']);
  const total = typeof result['total'] === 'number' ? `, ${result['total']} match in all` : '';
  const more = result['more'] === true ? '; more match than were returned' : '';
  return `${rows.length} ${object} returned${total}${more}.`;
};

// The run's result keys at the top level: `result` is the normalizer's own summary key.
const runContent = (run: JsonRecord): JsonRecord => {
  const result = readRecord(run['result']) ?? {};
  return {
    run_id: run['run_id'],
    action_key: run['action_key'],
    status: run['status'],
    created_at: run['created_at'],
    finished_at: run['finished_at'],
    credits_charged: run['credits_charged'],
    ...result,
    method: run['method'],
  };
};

const runResult = (
  run: JsonRecord,
  options: { failedIsError: boolean; startedAt?: number },
): ToolCallResult => {
  const actionKey = readString(run['action_key']) ?? 'The read Action';
  const runID = readString(run['run_id']);
  const status = readString(run['status']) ?? '';
  const failure = readRecord(run['error']);
  if (status === 'failed' || failure) {
    const code = readString(failure?.['code']) ?? 'READ_ACTION_FAILED';
    const result = errorResult(
      code,
      readString(failure?.['message']) ?? 'The run failed.',
      `${actionKey} failed and no Sanka Credits were used`,
      { details: failure?.['details'] },
    );
    const structured = { ...runContent(run), ...readRecord(result.structuredContent) };
    return options.failedIsError ?
        { ...result, structuredContent: structured }
      : { content: result.content, structuredContent: structured };
  }
  const content = runContent(run);
  if (status === 'running') {
    const message = `${actionKey} is still running. Read it with get_read_action_run (run_id "${
      runID ?? '?'
    }"); do not run it again.`;
    return {
      content: [{ type: 'text', text: message }],
      structuredContent: { ok: true, ...content, message },
    };
  }
  const result = readRecord(run['result']) ?? {};
  const method = readRecord(run['method']) ?? {};
  const createdAt = Date.parse(readString(run['created_at']) ?? '');
  const earlier =
    options.startedAt !== undefined && createdAt < options.startedAt - EARLIER_RUN_MS ?
      `This is the earlier run of the same question, from ${readString(
        run['created_at'],
      )}; nothing was charged for this call. To read the CRM again now, pass a new client_key.`
    : undefined;
  const message = [
    `${actionKey}: ${resultLine(result)}`,
    ...(earlier ? [earlier] : []),
    ...(method['complete'] === false ?
      [
        'The result is INCOMPLETE (method.complete is false): never give its numbers as complete totals; say they are partial or ask the person to narrow the filter.',
      ]
    : []),
    methodLine(method),
    `Sanka Credits charged${earlier ? ' when it first ran' : ''}: ${String(run['credits_charged'] ?? 0)}.`,
    "Give the method (filters, records scanned) with any number, and say these are the rows the person's own CRM login can see.",
    `Result: ${JSON.stringify(result)}`,
  ].join('\n');
  return {
    content: [{ type: 'text', text: message }],
    structuredContent: { ok: true, ...content, ...(earlier ? { reused: true } : undefined), message },
  };
};

const actionLine = (action: JsonRecord): string => {
  const connection = readRecord(action['connection']);
  const schema = readRecord(action['input_schema']);
  const required = new Set(
    (Array.isArray(schema?.['required']) ? schema['required'] : []).filter(
      (name): name is string => typeof name === 'string',
    ),
  );
  const inputs = Object.keys(readRecord(schema?.['properties']) ?? {}).map((name) =>
    required.has(name) ? `${name}*` : name,
  );
  const account = readString(connection?.['account_label']);
  const url = connectUrl(connection?.['connect_path']);
  return [
    `- ${readString(action['key']) ?? '?'}: ${readString(action['title']) ?? ''}`,
    `${String(action['credits'] ?? '?')} Sanka Credits a run`,
    connection?.['connected'] === true ?
      `connected${account ? ` as ${account}` : ''}`
    : `not connected${url ? `: connect at ${url}` : ''}`,
    ...(inputs.length > 0 ? [`inputs: ${inputs.join(', ')}`] : []),
  ].join(' · ');
};

const ACTION_KEY_SCHEMA = {
  type: 'string',
  minLength: 1,
  maxLength: ACTION_KEY_MAX_LENGTH,
  description: 'The Action key from list_read_actions, such as hubspot:crm.aggregate.',
};

const RUN_PROPERTIES = {
  run_id: { type: 'string' },
  action_key: { type: 'string' },
  status: { type: 'string', description: 'running, succeeded or failed.' },
  object: { type: 'string' },
  rows: { type: 'array', items: { type: 'object', additionalProperties: true } },
  total: { type: 'integer' },
  more: { type: 'boolean' },
  groups: { type: 'array', items: { type: 'object', additionalProperties: true } },
  value: { type: 'number' },
  method: {
    type: 'object',
    additionalProperties: true,
    description:
      'How it was produced: filters, query_sent, records_scanned, complete, as_of, currency, identity.',
  },
  credits_charged: { type: 'number' },
  client_key: { type: 'string', description: 'The idempotency key sent; reuse it to retry this run.' },
  reused: {
    type: 'boolean',
    description: 'The run was an earlier identical one; nothing was charged again.',
  },
  message: { type: 'string' },
};

const RUN_OUTPUT_SCHEMA = { type: 'object' as const, additionalProperties: true, properties: RUN_PROPERTIES };

const defineReadActionTool = (definition: {
  name: string;
  title: string;
  description: string;
  operation: 'read' | 'write';
  failureLead: string;
  httpMethod: 'get' | 'post';
  httpPath: string;
  operationId: string;
  inputSchema: McpTool['tool']['inputSchema'];
  outputSchema: McpTool['tool']['outputSchema'];
  run: (reqContext: McpRequestContext, args: ToolArgs) => Promise<ToolCallResult>;
}): McpTool => ({
  metadata: {
    resource: 'read_actions',
    operation: definition.operation,
    tags: ['read_actions', 'hubspot', 'salesforce'],
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
      // A run is idempotent by its client_key: the same key returns the first run.
      idempotentHint: true,
      // A run reads the person's CRM; the other two read Sanka.
      openWorldHint: definition.operation === 'write',
    },
  },
  handler: withApiErrors(definition.title, definition.failureLead, definition.run),
});

export const listReadActionsTool = defineReadActionTool({
  name: 'list_read_actions',
  title: "List read Actions for the person's own CRM",
  description:
    "List the read Actions the connected person can run on their own HubSpot or Salesforce: searches and totals (count, sum, average, min, max, grouped by stage, owner or month) on deals, opportunities, contacts, companies, accounts and leads. Each has its key, what it does, its price in Sanka Credits a run, the JSON Schema of its inputs and whether the person's own CRM login is connected (with the connect link when it is not). Free. Use it before run_read_action. Sanka's own records keep query_records and aggregate_records.",
  operation: 'read',
  failureLead: 'Could not list read Actions',
  httpMethod: 'get',
  httpPath: ACTIONS_PATH,
  operationId: 'list_read_actions_api_v2_read_actions_get',
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  outputSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      actions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
          properties: {
            key: { type: 'string' },
            system: { type: 'string' },
            kind: { type: 'string' },
            title: { type: 'string' },
            credits: { type: 'number', description: 'Sanka Credits a completed run costs.' },
            input_schema: { type: 'object', additionalProperties: true },
            connection: { type: 'object', additionalProperties: true },
            connect_url: { type: 'string', description: 'Where the person connects their own CRM login.' },
          },
        },
      },
      message: { type: 'string' },
    },
  },
  run: async (reqContext) => {
    const data = envelopeData(await reqContext.client.get(ACTIONS_PATH));
    const actions = records(data['actions']).map((action) => {
      const url = connectUrl(readRecord(action['connection'])?.['connect_path']);
      return url ? { ...action, connect_url: url } : action;
    });
    const message =
      actions.length > 0 ?
        [
          `${actions.length} read Actions on the person's own CRM (* = required input):`,
          ...actions.map(actionLine),
          'Each completed run costs the credits shown: tell the person the price the first time in a conversation. Run one with run_read_action; for one that is not connected, give the person its connect link.',
        ].join('\n')
      : 'No read Actions are available to this person here.';
    return {
      content: [{ type: 'text', text: message }],
      structuredContent: { ...data, actions, message },
    };
  },
});

export const runReadActionTool = defineReadActionTool({
  name: 'run_read_action',
  title: "Search or total the person's own CRM",
  description:
    "Run a read Action from list_read_actions on the connected person's own HubSpot or Salesforce, as their own login, so the CRM's permissions decide which rows they see. Pass its action_key and inputs matching its input_schema. Each completed run costs the Action's Sanka Credits, an empty result too; refusals and failures cost nothing. Tell the person the price the first time in a conversation. The result carries method (filters, the query sent, records scanned, complete, as_of): give it with any number, and never present a total as complete when method.complete is false. READ_ACTION_CONNECT_REQUIRED: give the connect link. READ_ACTION_CREDITS_REQUIRED: the Sanka Credits ran out and a workspace admin can add them. READ_ACTION_TOO_BROAD: ask the person to narrow the filter, never estimate. Without client_key, the same Action with the same inputs returns its first run and is not charged again: pass a new client_key only to read the CRM again, such as after the person connects or asks for fresh numbers. Never loop or split a question to get around a limit.",
  operation: 'write',
  failureLead: NOTHING_CHARGED,
  httpMethod: 'post',
  httpPath: RUN_PATH,
  operationId: 'run_read_action_api_v2_read_actions_run_post',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['action_key', 'inputs'],
    properties: {
      action_key: ACTION_KEY_SCHEMA,
      inputs: {
        type: 'object',
        additionalProperties: true,
        description: "The Action's inputs, matching its input_schema from list_read_actions.",
      },
      client_key: {
        type: 'string',
        minLength: 8,
        maxLength: 100,
        description:
          'Idempotency key. A retry with the same key and inputs returns the first run without charging again. Left out, one is derived from the action_key and inputs.',
      },
    },
  },
  outputSchema: RUN_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const startedAt = Date.now();
    const actionKey = readString(args?.['action_key']);
    const inputs = readRecord(args?.['inputs']);
    if (!actionKey || !inputs) {
      return asErrorResult(
        `\`action_key\` and \`inputs\` are required: pick the Action from list_read_actions. ${NOTHING_CHARGED}.`,
      );
    }
    const clientKey = readString(args?.['client_key']) ?? derivedClientKey(actionKey, inputs);
    // A run spends Sanka Credits, so it names its workspace: the API refuses a mismatch.
    const workspace = await sessionWorkspace(reqContext);
    if (!workspace.id) {
      return asErrorResult(
        `No Sanka workspace is selected for this connection. ${NOTHING_CHARGED}. Pick one with list_workspaces and switch_workspace, then ask again.`,
      );
    }
    const run = envelopeData(
      await reqContext.client.post(RUN_PATH, {
        body: { action_key: actionKey, inputs, client_key: clientKey },
        headers: { 'X-Sanka-MCP': 'true', 'X-Sanka-Expected-Workspace-ID': workspace.id },
        maxRetries: 0,
      }),
    );
    const result = runResult(run, { failedIsError: true, startedAt });
    return {
      ...result,
      structuredContent: { ...readRecord(result.structuredContent), client_key: clientKey },
    };
  },
});

export const getReadActionRunTool = defineReadActionTool({
  name: 'get_read_action_run',
  title: 'Get a read Action run',
  description:
    'Read a run started with run_read_action by its run_id: its status, result and method. Free. Only the person who ran it can read it, for 30 days. The result is what the CRM showed at method.as_of; to read the CRM again, call run_read_action with a new client_key. Never present a total as complete when method.complete is false.',
  operation: 'read',
  failureLead: 'Could not read this run',
  httpMethod: 'get',
  httpPath: `${RUNS_PATH}/{run_id}`,
  operationId: 'get_read_action_run_api_v2_read_actions_runs__run_id__get',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['run_id'],
    properties: { run_id: { type: 'string', minLength: 1, description: 'The run_id from run_read_action.' } },
  },
  outputSchema: RUN_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const runID = readString(args?.['run_id']);
    if (!runID) return asErrorResult('`run_id` is required.');
    const run = envelopeData(await reqContext.client.get(`${RUNS_PATH}/${encodeURIComponent(runID)}`));
    return runResult(run, { failedIsError: false });
  },
});

export const readActionTools: McpTool[] = [listReadActionsTool, runReadActionTool, getReadActionRunTool];
