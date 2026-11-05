// Hand-written tools that run Sanka Flow Actions on companies as the connected person
// (sanka-api docs/specs/actions/mcp-flow-actions.md). The screen's routes sit outside the public
// developer OpenAPI contract, so the handlers call raw client paths. Only the Actions in
// FLOW_ACTIONS can run here: each company costs Sanka credit, so a new one is a decision.
import { createHash } from 'node:crypto';

import { envelopeData, readApiFailure, sessionWorkspace } from './desk-tools';
import { actionHistoryAppUrl } from './record-url-enrichment';
import { readRecord, readString, readStringArray } from './tool-factories';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpRequestContext, McpTool, ToolCallResult } from './types';
import { workflowWorkspaceHeaders } from './workflow-run-tools';

type ToolArgs = Record<string, unknown> | undefined;
type JsonRecord = Record<string, unknown>;

type FlowAction = {
  key: string;
  slug: string;
  label: string;
  // The form values this Action takes. Nothing else reaches its run: AI contact search has no
  // phone input, because personal numbers can need a do-not-call check before a CRM write.
  inputs: string[];
};

const FLOW_ACTIONS: Record<string, FlowAction> = {
  ai_contact_search: {
    key: 'ai_contact_search',
    slug: 'ai-contact-search',
    label: 'AI contact search',
    inputs: ['roles', 'description', 'country', 'max_people', 'find_emails', 'owner'],
  },
  find_company_details: {
    key: 'find_company_details',
    slug: 'find-company-details',
    label: 'Find company details',
    inputs: ['find_phone', 'find_address', 'country'],
  },
};
const FLOW_ACTION_INPUTS = [...new Set(Object.values(FLOW_ACTIONS).flatMap((action) => action.inputs))];

const previewPath = (action: FlowAction): string => `/api/v2/actions/${action.slug}/selection-preview`;
const EXECUTE_PATH = '/api/v2/workflows/form/action/execute';
const RUN_PATH = '/api/v2/action-history/runs';
const LISTS_PATH = '/api/v2/lists';
const VIEWS_PATH = '/api/v2/views';

const OBJECT_TYPE = 'company';
const UNFINISHED_STATUSES = new Set(['', 'queued', 'pending', 'running', 'in_progress']);
// A run's per-company rows in a result; a selection can hold hundreds.
const RESULT_ROW_LIMIT = 50;
// The same request within this window is one run, so a repeated call cannot bill twice.
const DERIVED_KEY_WINDOW_MS = 60 * 60 * 1000;
const LANGUAGES = ['en', 'ja'];
const COMPANY_LISTS_LIMIT = 100;

const ACTION_INPUT_PROPERTIES = {
  action: {
    type: 'string',
    enum: Object.keys(FLOW_ACTIONS),
    description:
      'ai_contact_search finds people at each company and, optionally, their work e-mails. find_company_details fills empty company Phone Number and Address fields.',
  },
  company_ids: {
    type: 'array',
    items: { type: 'string' },
    minItems: 1,
    description: 'Sanka company ids. Pass one of company_ids, view_id or list_id.',
  },
  view_id: { type: 'string', description: 'A saved company view from list_company_lists.' },
  list_id: { type: 'string', description: 'A company list from list_company_lists.' },
  roles: {
    type: 'array',
    items: {
      type: 'string',
      enum: ['it_leaders', 'systems_owners', 'finance', 'sales_leaders', 'executives'],
    },
    description: 'ai_contact_search: roles to find. Defaults to it_leaders.',
  },
  description: {
    type: 'string',
    maxLength: 300,
    description: "ai_contact_search: any other job title or person to find, in the person's words.",
  },
  country: {
    type: 'string',
    description:
      "Two-letter Google country such as au or jp. Leave it out to use each company's own country or website.",
  },
  max_people: {
    type: 'integer',
    enum: [3, 5, 10],
    description: 'ai_contact_search: people to keep per company. Defaults to 5.',
  },
  find_emails: {
    type: 'boolean',
    description: 'ai_contact_search: also look up work e-mails. Defaults to true.',
  },
  owner: {
    type: 'string',
    enum: ['me', 'company_owner'],
    description: 'ai_contact_search: owner of the contacts the person creates. Defaults to me.',
  },
  find_phone: {
    type: 'boolean',
    description: 'find_company_details: fill an empty Phone Number. Defaults to true.',
  },
  find_address: {
    type: 'boolean',
    description: 'find_company_details: fill an empty Address. Defaults to true.',
  },
  language: { type: 'string', enum: LANGUAGES, description: 'Language of error messages.' },
  expected_workspace_id: {
    type: 'string',
    description: 'Internal workspace UUID from current_workspace. Stops if the session has switched.',
  },
};

const RESULT_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    action: { type: 'string' },
    status: { type: 'string' },
    message: { type: 'string' },
    company_count: { type: 'integer' },
    run_id: { type: 'string' },
    action_history_url: { type: 'string' },
  },
};

const toolResult = (message: string, structuredContent: JsonRecord): ToolCallResult => ({
  content: [{ type: 'text', text: message }],
  structuredContent: { ...structuredContent, message },
});

const LIMIT_HINT =
  'Tell the person. Do not repeat the call, split the selection into several runs or look for another way around the limit.';

// What the model should do next. A daily limit answers 429, but waiting a moment does not lift it.
const ERROR_HINTS: Record<string, string> = {
  FEATURE_NOT_ENABLED:
    'This workspace does not have this Action. Tell the person a workspace admin can ask for it; do not try to get the same result with other tools.',
  WORKFLOW_ACTION_V2_DISABLED:
    'This workspace does not have this Action. Tell the person a workspace admin can ask for it; do not try to get the same result with other tools.',
  ACTION_SELECTION_LIMIT_EXCEEDED: `${LIMIT_HINT} The person can narrow the selection, for example to the companies they care about most.`,
  CONTACT_SEARCH_DAILY_LIMIT: `${LIMIT_HINT} It resets at 00:00 UTC.`,
  FIND_COMPANY_DETAILS_DAILY_LIMIT: `${LIMIT_HINT} It resets at 00:00 UTC.`,
  SANKA_CREDIT_INSUFFICIENT:
    'Tell the person the workspace is out of Sanka credit; an admin can add credit in workspace billing.',
  ACTION_SELECTION_RECORD_UNAVAILABLE:
    'At least one company is not one this person can see. Check the ids with query_records.',
  NOT_FOUND:
    'Only what the connected person can see is found here, and only the person who started a run can read it.',
  WORKSPACE_CONTEXT_MISMATCH:
    'The connection changed workspace. Check current_workspace, then retry once in the intended workspace.',
};
const NOT_RETRYABLE_CODES = new Set([
  'ACTION_SELECTION_LIMIT_EXCEEDED',
  'CONTACT_SEARCH_DAILY_LIMIT',
  'FIND_COMPANY_DETAILS_DAILY_LIMIT',
]);

// A 4xx answer with a code changes nothing; anything else is left to the server's error handling.
const apiErrorResult = (error: unknown, lead: string): ToolCallResult | undefined => {
  const failure = readApiFailure(error);
  if (!failure || (failure.status !== undefined && failure.status >= 500)) return undefined;
  const hint = ERROR_HINTS[failure.code];
  return {
    content: [
      { type: 'text', text: `${lead} (${failure.code}): ${failure.message}${hint ? ` ${hint}` : ''}` },
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
      ...(NOT_RETRYABLE_CODES.has(failure.code) ? { retryable: false } : undefined),
    },
  };
};

const NOT_RUN = 'No run was started and no credit was used';

const selectedAction = (args: ToolArgs): FlowAction | undefined =>
  FLOW_ACTIONS[readString(args?.['action']) ?? ''];

// The Action's own form values. A value of another Action is refused rather than dropped, so a
// request for something this Action does not do is never answered as if it had been done.
const actionInputs = (action: FlowAction, args: ToolArgs): { inputs?: JsonRecord; error?: string } => {
  const foreign = FLOW_ACTION_INPUTS.filter(
    (key) => args?.[key] !== undefined && !action.inputs.includes(key),
  );
  if (foreign.length > 0) {
    return { error: `${action.key} does not take ${foreign.join(', ')}. ${NOT_RUN}.` };
  }
  return {
    inputs: Object.fromEntries(
      action.inputs.filter((key) => args?.[key] !== undefined).map((key) => [key, args?.[key]]),
    ),
  };
};

const selectionBody = (args: ToolArgs): { body?: JsonRecord; error?: string } => {
  const recordIDs = readStringArray(args?.['company_ids']);
  const viewID = readString(args?.['view_id']);
  const listID = readString(args?.['list_id']);
  if ([recordIDs.length > 0, Boolean(viewID), Boolean(listID)].filter(Boolean).length !== 1) {
    return { error: `Pass exactly one of company_ids, view_id or list_id. ${NOT_RUN}.` };
  }
  return {
    body: {
      object_type: OBJECT_TYPE,
      ...(recordIDs.length > 0 ? { record_ids: recordIDs } : undefined),
      ...(viewID ? { view_id: viewID } : undefined),
      ...(listID ? { list_id: listID } : undefined),
    },
  };
};

const languageQuery = (args: ToolArgs): { lang?: string } => {
  const language = readString(args?.['language']);
  return language ? { lang: language } : {};
};

// Only a convenience: a run or a status must never fail because the link could not be built.
const historyUrl = async (reqContext: McpRequestContext): Promise<string | undefined> => {
  const code =
    readString(reqContext.auth?.oauth?.workspace_code) ??
    (await sessionWorkspace(reqContext).catch(() => undefined))?.code;
  return code ? actionHistoryAppUrl('companies', code) : undefined;
};

const derivedKey = (action: FlowAction, recordIDs: string[], inputs: JsonRecord): string => {
  const window = Math.floor(Date.now() / DERIVED_KEY_WINDOW_MS);
  const sorted = Object.fromEntries(Object.entries(inputs).sort(([a], [b]) => a.localeCompare(b)));
  const digest = createHash('sha256')
    .update(JSON.stringify([action.slug, [...recordIDs].sort(), sorted, window]))
    .digest('hex');
  return `mcp-${digest.slice(0, 40)}`;
};

const callPreview = async (
  reqContext: McpRequestContext,
  action: FlowAction,
  args: ToolArgs,
  selection: JsonRecord,
  inputs: JsonRecord,
  headers: Record<string, string> | undefined,
): Promise<JsonRecord> =>
  envelopeData(
    await reqContext.client.post(previewPath(action), {
      body: { ...selection, inputs },
      query: languageQuery(args),
      ...(headers ? { headers } : undefined),
      maxRetries: 0,
    }),
  );

const countOf = (preview: JsonRecord): number =>
  typeof preview['selected_count'] === 'number' ? preview['selected_count'] : 0;

// What the two tools need before they call the API.
const prepare = async (
  reqContext: McpRequestContext,
  args: ToolArgs,
): Promise<
  | { error: ToolCallResult }
  | {
      action: FlowAction;
      selection: JsonRecord;
      inputs: JsonRecord;
      headers: Record<string, string> | undefined;
    }
> => {
  const action = selectedAction(args);
  if (!action) {
    return { error: asErrorResult(`\`action\` must be one of ${Object.keys(FLOW_ACTIONS).join(', ')}.`) };
  }
  const { inputs, error: inputError } = actionInputs(action, args);
  if (!inputs) return { error: asErrorResult(inputError ?? NOT_RUN) };
  const { body: selection, error: selectionError } = selectionBody(args);
  if (!selection) return { error: asErrorResult(selectionError ?? NOT_RUN) };
  const binding = await workflowWorkspaceHeaders(reqContext, readString(args?.['expected_workspace_id']));
  if (binding.error) return { error: binding.error };
  return { action, selection, inputs, headers: binding.headers };
};

export const previewFlowActionTool: McpTool = {
  metadata: {
    resource: 'workflows',
    operation: 'read',
    tags: ['workflows', 'companies', 'contacts'],
    httpMethod: 'post',
    httpPath: '/api/v2/actions/{action_slug}/selection-preview',
    operationId: 'preview_action_selection_api_v2_actions__action_slug__selection_preview_post',
  },
  tool: {
    name: 'preview_flow_action',
    title: 'Preview a Sanka Flow Action',
    description:
      'Use this first when the person asks to find or enrich people, contacts or work e-mails for companies on their list (a rep\'s "leads" usually means those companies), or to fill in company phone numbers and addresses. Do not use deal or HubSpot tools for this unless they named HubSpot, and do not file a Desk ticket. action=ai_contact_search finds people at each company; find_company_details fills empty Phone Number and Address fields. Choose companies with company_ids, or a view_id or list_id from list_company_lists. This counts them and checks the Action is allowed; nothing runs and no credit is used. Then tell the person how many companies and that each one uses Sanka credit, and call run_flow_action only after they say yes. A ceiling, a daily limit or a workspace without the Action comes back as an error: tell the person and stop. Never split a selection or repeat calls to get around a limit.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: ACTION_INPUT_PROPERTIES,
    },
    outputSchema: RESULT_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Preview a Sanka Flow Action',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Preview a Sanka Flow Action' });
    if (authError) return authError;
    const prepared = await prepare(reqContext, args);
    if ('error' in prepared) return prepared.error;
    const { action, selection, inputs, headers } = prepared;
    try {
      const preview = await callPreview(reqContext, action, args, selection, inputs, headers);
      const count = countOf(preview);
      return toolResult(
        count === 0 ?
          `${action.label} has no companies to run on: this selection is empty for the connected person.`
        : `${action.label} would run on ${count} ${
            count === 1 ? 'company' : 'companies'
          }. Nothing has run and no credit was used. Each company uses Sanka credit: confirm this count with the person, then call run_flow_action with confirmed_company_count=${count}.`,
        {
          ok: true,
          status: count === 0 ? 'no_companies' : 'needs_confirmation',
          action: action.key,
          company_count: count,
          maximum_company_count: preview['maximum_selected_count'],
          inputs: preview['inputs'],
        },
      );
    } catch (error) {
      const result = apiErrorResult(error, `${action.label} cannot run on this selection`);
      if (result) return result;
      throw error;
    }
  },
};

export const runFlowActionTool: McpTool = {
  metadata: {
    resource: 'workflows',
    operation: 'write',
    tags: ['workflows', 'companies', 'contacts'],
    httpMethod: 'post',
    httpPath: EXECUTE_PATH,
    operationId: 'execute_workflow_action_form_api_v2_workflows_form_action_execute_post',
  },
  tool: {
    name: 'run_flow_action',
    title: 'Run a Sanka Flow Action',
    description:
      "Run a Sanka Flow Action as the connected person, after preview_flow_action and after the person confirmed the company count. Each company uses Sanka credit, so never run without that yes, and pass the count they confirmed as confirmed_company_count: nothing runs if the selection no longer has that many companies. Never loop, batch or split a selection to get around a ceiling or daily limit. ai_contact_search creates no contacts: the people stay in the run's Action history until the person picks them in Flow, so give them action_history_url and never say contacts were created. It looks up no phone numbers. find_company_details writes empty Phone Number and Address fields only, never overwrites, and has no review step. Runs finish in the background: read them with get_flow_action_run.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action', 'confirmed_company_count'],
      properties: {
        ...ACTION_INPUT_PROPERTIES,
        confirmed_company_count: {
          type: 'integer',
          minimum: 1,
          description: 'The company count from preview_flow_action that the person said yes to.',
        },
        idempotency_key: {
          type: 'string',
          minLength: 8,
          maxLength: 100,
          description:
            'A retry with the same key returns the first run. Left out, the same request within an hour is one run; pass a new key only when the person asks to run it again.',
        },
      },
    },
    outputSchema: RESULT_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Run a Sanka Flow Action',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Run a Sanka Flow Action' });
    if (authError) return authError;
    const confirmed = args?.['confirmed_company_count'];
    if (typeof confirmed !== 'number' || confirmed < 1) {
      return asErrorResult(
        `\`confirmed_company_count\` is required: call preview_flow_action and confirm the count with the person. ${NOT_RUN}.`,
      );
    }
    const prepared = await prepare(reqContext, args);
    if ('error' in prepared) return prepared.error;
    const { action, selection, inputs, headers } = prepared;
    try {
      // Read again here: a view or list can have changed since the person said yes.
      const preview = await callPreview(reqContext, action, args, selection, inputs, headers);
      const count = countOf(preview);
      if (count !== confirmed) {
        return {
          content: [
            {
              type: 'text',
              text: `The selection now has ${count} companies, not the ${confirmed} the person confirmed. ${NOT_RUN}. Confirm the new count with the person before running it.`,
            },
          ],
          isError: true,
          structuredContent: {
            ok: false,
            status: 'error',
            code: 'COMPANY_COUNT_CHANGED',
            company_count: count,
            confirmed_company_count: confirmed,
          },
        };
      }
      const recordIDs = readStringArray(preview['record_ids']);
      const formValues = readRecord(preview['inputs']) ?? {};
      const url = await historyUrl(reqContext);
      const key = readString(args?.['idempotency_key']) ?? derivedKey(action, recordIDs, formValues);
      const run = envelopeData(
        await reqContext.client.post(EXECUTE_PATH, {
          query: {
            action_id: action.slug,
            object_type: OBJECT_TYPE,
            page_group_type: OBJECT_TYPE,
            ...languageQuery(args),
          },
          body: {
            ...formValues,
            idempotency_key: key,
            selection: { mode: 'explicit', object_type: OBJECT_TYPE, record_ids: recordIDs },
          },
          ...(headers ? { headers } : undefined),
          maxRetries: 0,
        }),
      );
      const runID = readString(run['action_history_id']);
      const companies = `${count} ${count === 1 ? 'company' : 'companies'}`;
      const started =
        action.key === 'ai_contact_search' ?
          `Started ${action.label} on ${companies}. No contact is created until the person picks people in Action history.`
        : `Started ${action.label} on ${companies}. It fills empty fields only and never overwrites.`;
      return toolResult(
        [
          started,
          url ? `Action history: ${url}` : undefined,
          runID ? `Read progress with get_flow_action_run (run_id "${runID}").` : undefined,
        ]
          .filter(Boolean)
          .join(' '),
        {
          ok: true,
          status: readString(run['state']) ?? 'started',
          action: action.key,
          company_count: count,
          idempotency_key: key,
          ...(runID ? { run_id: runID } : undefined),
          ...(url ? { action_history_url: url } : undefined),
        },
      );
    } catch (error) {
      const result = apiErrorResult(error, NOT_RUN);
      if (result) return result;
      throw error;
    }
  },
};

const readRows = (value: unknown): JsonRecord[] =>
  Array.isArray(value) ? value.map(readRecord).filter((row): row is JsonRecord => Boolean(row)) : [];

const countRows = (rows: JsonRecord[], matches: (row: JsonRecord) => boolean): number =>
  rows.filter(matches).length;

// Counts, never the people: a run's people are its creator's until they pick them, and an AI
// client may repeat this where others can read it, such as a Slack channel.
const contactSearchResult = (output: JsonRecord): JsonRecord => {
  const rows = readRows(output['contact_search_companies']);
  const single = readRecord(output['contact_search']);
  const companies =
    rows.length > 0 ? rows
    : single ? [single]
    : [];
  const people = companies.flatMap((row) => readRows(row['candidates']));
  return {
    summary: {
      companies: companies.length,
      companies_failed: countRows(companies, (row) => readString(row['status']) === 'failed'),
      people_found: people.length,
      work_emails_found: countRows(people, (person) => readString(person['email_status']) === 'found'),
      already_in_flow: countRows(people, (person) => Boolean(readString(person['existing_contact_id']))),
      contacts_created: countRows(people, (person) => Boolean(readString(person['created_contact_id']))),
    },
    companies: companies.slice(0, RESULT_ROW_LIMIT).map((row) => {
      const company = readRecord(row['company']) ?? {};
      return {
        company_id: readString(company['id']),
        name: readString(company['name']),
        status: readString(row['status']),
        people_found: readRows(row['candidates']).length,
        ...(readString(row['error']) ? { error: readString(row['error']) } : undefined),
      };
    }),
  };
};

const companyDetailsResult = (output: JsonRecord): JsonRecord => {
  const rows = readRows(output['company_details']);
  const count = (status: string): number => countRows(rows, (row) => readString(row['status']) === status);
  return {
    summary: {
      companies: rows.length,
      filled: count('filled'),
      already_filled: count('already_filled'),
      not_found: count('not_found'),
      failed: count('failed'),
    },
    companies: rows
      .slice(0, RESULT_ROW_LIMIT)
      .map((row) =>
        Object.fromEntries(
          ['company_id', 'name', 'status', 'reason', 'phone_number', 'address']
            .map((key) => [key, readString(row[key])])
            .filter(([, value]) => value),
        ),
      ),
  };
};

const finishedMessage = (action: FlowAction, summary: JsonRecord, url: string | undefined): string => {
  if (action.key === 'ai_contact_search') {
    const link = url ? ` Give the person this link to pick who to add: ${url}` : '';
    return `${action.label} finished on ${summary['companies']} companies: ${summary['people_found']} people, ${summary['work_emails_found']} work e-mails, ${summary['companies_failed']} companies failed, ${summary['contacts_created']} contacts created so far. No contact is created until the person picks people in Action history.${link}`;
  }
  return `${action.label} finished on ${summary['companies']} companies: ${summary['filled']} filled, ${summary['already_filled']} already filled, ${summary['not_found']} not found, ${summary['failed']} failed.`;
};

export const getFlowActionRunTool: McpTool = {
  metadata: {
    resource: 'workflows',
    operation: 'read',
    tags: ['workflows', 'companies', 'contacts'],
    httpMethod: 'get',
    httpPath: `${RUN_PATH}/{run_id}`,
    operationId: 'get_member_action_run_api_v2_action_history_runs__action_history_id__get',
  },
  tool: {
    name: 'get_flow_action_run',
    title: 'Get a Sanka Flow Action run',
    description:
      'Read the status and result of a run started with run_flow_action, by its run_id, to tell the person when it is done. Only the person who started a run can read it. For ai_contact_search it returns how many people and work e-mails were found, not their names or addresses, which stay with the person in Flow: give them action_history_url to pick who to add. For find_company_details it returns what was filled for each company. If it has not finished, say so and offer to check again later; do not poll in a loop.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['run_id'],
      properties: {
        run_id: { type: 'string', description: 'The run_id from run_flow_action.' },
        expected_workspace_id: ACTION_INPUT_PROPERTIES.expected_workspace_id,
      },
    },
    outputSchema: RESULT_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get a Sanka Flow Action run',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Get a Sanka Flow Action run' });
    if (authError) return authError;
    const runID = readString(args?.['run_id']);
    if (!runID) return asErrorResult('`run_id` is required.');
    const binding = await workflowWorkspaceHeaders(reqContext, readString(args?.['expected_workspace_id']));
    if (binding.error) return binding.error;
    try {
      const run = envelopeData(
        await reqContext.client.get(`${RUN_PATH}/${encodeURIComponent(runID)}`, {
          ...(binding.headers ? { headers: binding.headers } : undefined),
        }),
      );
      const action = Object.values(FLOW_ACTIONS).find(
        (candidate) => candidate.slug === readString(run['action_slug']),
      );
      if (!action) return asErrorResult('This run is not one of the Actions these tools read.');
      const status = readString(run['status']) ?? '';
      const done = !UNFINISHED_STATUSES.has(status.toLowerCase());
      const output = readRecord(run['output_data']) ?? {};
      const result =
        action.key === 'ai_contact_search' ? contactSearchResult(output) : companyDetailsResult(output);
      const summary = readRecord(result['summary']) ?? {};
      const url = await historyUrl(reqContext);
      const failed = ['failed', 'error'].includes(status.toLowerCase());
      const failure = readString(run['error_message']) ?? readString(output['message']);
      const message =
        !done ? `${action.label} is still ${status || 'queued'}. Check again later.`
        : failed ? `${action.label} failed${failure ? `: ${failure}` : '.'}`
        : finishedMessage(action, summary, url);
      return toolResult(message, {
        ok: !failed,
        status,
        done,
        action: action.key,
        run_id: runID,
        company_count: output['selected_count'],
        ...result,
        ...(url ? { action_history_url: url } : undefined),
        created_at: run['created_at'],
        completed_at: run['completed_at'],
      });
    } catch (error) {
      const result = apiErrorResult(error, 'Could not read this run');
      if (result) return result;
      throw error;
    }
  },
};

export const listCompanyListsTool: McpTool = {
  metadata: {
    resource: 'companies',
    operation: 'read',
    tags: ['companies', 'lists', 'views'],
    httpMethod: 'get',
    httpPath: LISTS_PATH,
    operationId: 'list_lists_api_v2_lists_get',
  },
  tool: {
    name: 'list_company_lists',
    title: 'List company lists and views',
    description:
      "Find the person's company lists: the lists and saved company views they can see, each with its id and name, and how many companies a list holds. Pass mine=true for only their own lists, or search to match a name. A rep's list can be either kind: pass an item's id as list_id or view_id to preview_flow_action, as its kind says.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        mine: { type: 'boolean', description: "Only the connected person's own lists, without views." },
        search: { type: 'string', description: 'Text to match in the name.' },
      },
    },
    outputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        items: { type: 'array', items: { type: 'object', additionalProperties: true } },
        total: { type: 'integer' },
      },
    },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List company lists and views',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List company lists and views' });
    if (authError) return authError;
    const search = readString(args?.['search']);
    const mine = args?.['mine'] === true;
    try {
      const lists = await reqContext.client
        .get(LISTS_PATH, {
          query: {
            object_type: OBJECT_TYPE,
            page_size: COMPANY_LISTS_LIMIT,
            ...(mine ? { owner: 'me' } : undefined),
            ...(search ? { q: search } : undefined),
          },
        })
        .then(envelopeData)
        .catch((error: unknown): JsonRecord => {
          // A workspace without Lists still has saved views.
          if (readApiFailure(error)?.code === 'LISTS_NOT_ENABLED') return {};
          throw error;
        });
      const listItems = readRows(lists['items']).map((list) => ({
        kind: 'list',
        id: readString(list['id']),
        name: readString(list['name']),
        owner: readString(readRecord(list['owner'])?.['name']),
        company_count: list['member_count'],
      }));
      const views =
        mine ?
          []
        : await reqContext.client
            .get(VIEWS_PATH, { query: { object_type: 'companies' } })
            .then((response) => {
              const rows = readRecord(response)?.['data'];
              return readRows(rows);
            });
      const wanted = search?.toLowerCase();
      const viewItems = views
        .map((view) => ({
          kind: 'view',
          id: readString(view['view_id']),
          name: readString(view['label']) ?? readString(view['title']),
        }))
        .filter((view) => view.id && (!wanted || view.name?.toLowerCase().includes(wanted)));
      const items = [...listItems, ...viewItems];
      const lines = items.map(
        (item) =>
          `- ${item.name} (${item.kind}${
            'company_count' in item ? `, ${item.company_count} companies` : ''
          }, id ${item.id})`,
      );
      return {
        content: [
          {
            type: 'text',
            text: lines.length > 0 ? lines.join('\n') : 'No company lists or views were found.',
          },
        ],
        structuredContent: { items, total: items.length },
      };
    } catch (error) {
      const result = apiErrorResult(error, 'Could not read company lists');
      if (result) return result;
      throw error;
    }
  },
};

export const flowActionTools: McpTool[] = [
  previewFlowActionTool,
  runFlowActionTool,
  getFlowActionRunTool,
  listCompanyListsTool,
];
