import type {
  GoalCreateParams,
  GoalData,
  GoalDetailData,
  GoalListParams,
  GoalMetricCatalog,
  GoalPeriodProgress,
  GoalProgressData,
  GoalRetrieveProgressParams,
  GoalSetTargetsParams,
  GoalUpdateParams,
} from 'sanka-sdk';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpRequestContext, McpTool, ToolCallResult } from './types';

type ToolArgs = Record<string, unknown> | undefined;

const GOALS_PATH = '/api/v2/public/goals';

const MEMBER_ID_HINT =
  'the numeric id of a list_employees row, not its record_id, or an owner or assignee id from a goal';

const WORKSPACE_PROPERTY = {
  workspace_id: {
    type: 'string',
    description: 'Optional internal workspace UUID. Omit to use the current authenticated workspace.',
  },
};

const LANGUAGE_PROPERTY = {
  language: { type: 'string', maxLength: 8, description: 'Optional label language, such as en or ja.' },
};

const GOAL_ID_PROPERTY = {
  goal_id: { type: 'string', minLength: 1, description: 'Goal UUID from list_goals.' },
};

const FISCAL_YEAR_SCHEMA = {
  type: 'integer',
  minimum: 2000,
  maximum: 2100,
  description:
    'Fiscal year, named by the calendar year it ends in: with an April start, FY2027 runs from April 2026 to March 2027. Defaults to the current fiscal year.',
};

const EXPECTED_VERSION_PROPERTY = {
  expected_version: {
    type: 'integer',
    minimum: 1,
    description:
      "The goal's version from list_goals or get_goal. The write fails with VERSION_CONFLICT if the goal changed since. Omit it to read the current version first.",
  },
};

const FILTER_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'does_not_contain',
  'starts_with',
  'ends_with',
  'in',
  'not_in',
  'is_empty',
  'is_not_empty',
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
  'between',
  'equal_or_after_today',
  'equal_or_before_today',
  'last_x_days',
  'more_than_x_days',
];

const DEFINITION_SCHEMA = {
  type: 'object',
  description:
    "Custom metric, for metric=custom only: one source object's active records, counted or summed by the month of one of their dates. Copy a template's definition from list_goal_metrics or build one from a source's keys.",
  properties: {
    source: {
      type: 'string',
      minLength: 1,
      maxLength: 64,
      description: 'Source object key from list_goal_metrics, such as deals, orders, invoices or tasks.',
    },
    measure: {
      type: 'string',
      minLength: 1,
      maxLength: 64,
      description:
        'Measure key of the source, such as count (the default) or total_before_tax. Its unit makes the goal a count, money or number goal.',
    },
    date_field: {
      type: 'string',
      minLength: 1,
      maxLength: 64,
      description: 'Date field key of the source that places each record in a month. Defaults to created_at.',
    },
    filters: {
      type: 'array',
      maxItems: 20,
      description:
        "Optional record filters, written like saved-view filters: a view's filter.expressions from get_view can be copied. Field ids belong to the source's filter_object_type.",
      items: {
        type: 'object',
        properties: {
          field: {
            type: 'object',
            properties: {
              field_id: {
                type: 'string',
                minLength: 1,
                description:
                  '`standard:<name>` for a standard field or `custom_property:<uuid>` for a custom property.',
              },
            },
            required: ['field_id'],
          },
          operator: { type: 'string', enum: FILTER_OPERATORS },
          value: {
            description:
              'Filter value as in saved views: an option value for choice fields, a list for in/not_in and [from, to] for between. Omit it for is_empty and is_not_empty.',
          },
        },
        required: ['field', 'operator'],
      },
    },
  },
  required: ['source'],
  additionalProperties: false,
};

const ASSIGNMENT_SCHEMA = {
  type: 'string',
  enum: ['company', 'people', 'company_and_people'],
  description:
    "Who the goal is for: company (one company target), people (the goal is the sum of its assigned people's targets and records) or company_and_people (a company target plus targets for assigned people).",
};

const AMOUNT_SCHEMA = {
  type: 'string',
  enum: ['before_tax', 'including_tax'],
  description: 'invoice_revenue goals only: add up invoice totals before tax (the default) or including tax.',
};

const LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    page: { type: 'integer', minimum: 1, description: 'Page number, from 1.' },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      description: 'Goals per page, up to 100 (the default).',
    },
    ...LANGUAGE_PROPERTY,
    ...WORKSPACE_PROPERTY,
  },
  additionalProperties: false,
};

const RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...GOAL_ID_PROPERTY,
    fiscal_year: FISCAL_YEAR_SCHEMA,
    ...LANGUAGE_PROPERTY,
    ...WORKSPACE_PROPERTY,
  },
  required: ['goal_id'],
  additionalProperties: false,
};

const CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200, description: 'Goal name.' },
    metric: {
      type: 'string',
      enum: ['deals_created', 'invoice_revenue', 'custom'],
      description:
        "A template's metric from list_goal_metrics: deals_created counts new deals, invoice_revenue adds up billed invoices by invoice date, and custom measures `definition`.",
    },
    amount: AMOUNT_SCHEMA,
    currency: {
      type: 'string',
      pattern: '^[A-Za-z]{3}$',
      description:
        'Currency code of a money goal, such as JPY. Defaults to the workspace currency; records in other currencies are left out.',
    },
    definition: DEFINITION_SCHEMA,
    assignment: {
      ...ASSIGNMENT_SCHEMA,
      description: `${ASSIGNMENT_SCHEMA.description} Defaults to company.`,
    },
    assignee_ids: {
      type: 'array',
      maxItems: 200,
      items: { type: 'integer', minimum: 1 },
      description: `Workspace member ids of the assigned people: ${MEMBER_ID_HINT}. Required for people and company_and_people; omit for company.`,
    },
    ...LANGUAGE_PROPERTY,
    ...WORKSPACE_PROPERTY,
  },
  required: ['name', 'metric'],
  additionalProperties: false,
};

const UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...GOAL_ID_PROPERTY,
    ...EXPECTED_VERSION_PROPERTY,
    name: { type: 'string', minLength: 1, maxLength: 200, description: 'New goal name.' },
    amount: AMOUNT_SCHEMA,
    definition: {
      ...DEFINITION_SCHEMA,
      description: `Replacement definition. ${DEFINITION_SCHEMA.description}`,
    },
    assignment: ASSIGNMENT_SCHEMA,
    assignee_ids: {
      type: 'array',
      maxItems: 200,
      items: { type: 'integer', minimum: 1 },
      description: `The complete list of assigned people after the update, as workspace member ids (${MEMBER_ID_HINT}). People left out lose their targets. Omit to keep the current people.`,
    },
    ...LANGUAGE_PROPERTY,
    ...WORKSPACE_PROPERTY,
  },
  required: ['goal_id'],
  additionalProperties: false,
};

const DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: { ...GOAL_ID_PROPERTY, ...WORKSPACE_PROPERTY },
  required: ['goal_id'],
  additionalProperties: false,
};

const SET_TARGETS_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...GOAL_ID_PROPERTY,
    ...EXPECTED_VERSION_PROPERTY,
    cells: {
      type: 'array',
      minItems: 1,
      maxItems: 5000,
      description:
        'Targets to write, at most one cell per person and month. Cells not listed keep their values.',
      items: {
        type: 'object',
        properties: {
          owner_id: {
            type: ['integer', 'null'] as any,
            minimum: 1,
            description: `Workspace member id of the person (${MEMBER_ID_HINT}). null or omitted is the company row.`,
          },
          month: {
            type: 'string',
            format: 'date',
            pattern: '^[0-9]{4}-(0[1-9]|1[0-2])-01$',
            description: 'First day of the month, YYYY-MM-01.',
          },
          target: {
            type: ['number', 'string', 'null'] as any,
            minimum: 0,
            pattern: '^[0-9]+(\\.[0-9]{1,2})?$',
            description:
              "The month's target: a count, an amount in the goal currency with up to 2 decimals, or a number. null clears the cell.",
          },
        },
        required: ['month', 'target'],
        additionalProperties: false,
      },
    },
    fiscal_year: {
      ...FISCAL_YEAR_SCHEMA,
      description: `Fiscal year whose targets the result shows; it does not limit the months written. ${FISCAL_YEAR_SCHEMA.description}`,
    },
    ...LANGUAGE_PROPERTY,
    ...WORKSPACE_PROPERTY,
  },
  required: ['goal_id', 'cells'],
  additionalProperties: false,
};

const PROGRESS_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...GOAL_ID_PROPERTY,
    subject: {
      type: 'string',
      enum: ['company', 'me', 'owner'],
      description:
        "Whose progress: company (the default; every record against the company target), me (the connected user's records and targets) or owner (one person, given by owner_id).",
    },
    owner_id: {
      type: 'integer',
      minimum: 1,
      description: `Workspace member id of the person for subject=owner (${MEMBER_ID_HINT}).`,
    },
    range: {
      type: 'string',
      enum: ['fiscal_year', 'last_12_months'],
      description:
        'Months to return: the fiscal year (the default) or the twelve months ending with this one.',
    },
    fiscal_year: FISCAL_YEAR_SCHEMA,
    people_period: {
      type: 'string',
      enum: ['month', 'quarter', 'half', 'year'],
      description:
        'Add one row per person, plus Unassigned, for the month, quarter, half or fiscal year containing today.',
    },
    ...LANGUAGE_PROPERTY,
    ...WORKSPACE_PROPERTY,
  },
  required: ['goal_id'],
  additionalProperties: false,
};

const METRICS_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: { ...LANGUAGE_PROPERTY, ...WORKSPACE_PROPERTY },
  additionalProperties: false,
};

const OBJECT_SCHEMA = { type: 'object', additionalProperties: true };
const ARRAY_OF_OBJECTS_SCHEMA = { type: 'array', items: OBJECT_SCHEMA };

const LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    items: {
      ...ARRAY_OF_OBJECTS_SCHEMA,
      description: "Each goal with this_month's actual, target and pace.",
    },
    total: { type: 'integer' },
    can_edit: { type: 'boolean' },
    fiscal_year_start_month: { type: 'integer' },
    default_currency: { type: 'string' },
  },
  additionalProperties: true,
};

const DETAIL_PROPERTIES = {
  fiscal_year: { type: 'integer' },
  fiscal_year_start_month: { type: 'integer' },
  months: { type: 'array', items: { type: 'string' } },
  rows: {
    ...ARRAY_OF_OBJECTS_SCHEMA,
    description: 'Targets aligned with months; owner null is the company row.',
  },
  can_edit: { type: 'boolean' },
};

const DETAIL_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: { goal: OBJECT_SCHEMA, ...DETAIL_PROPERTIES },
  additionalProperties: true,
};

const MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    goal_id: { type: 'string' },
    // `record` is the container the result normalizer reads returned fields from.
    record: { ...OBJECT_SCHEMA, description: 'The goal after the write, with its new version.' },
  },
  additionalProperties: true,
};

const TARGETS_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: { ...MUTATION_OUTPUT_SCHEMA.properties, ...DETAIL_PROPERTIES },
  additionalProperties: true,
};

const PROGRESS_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    goal: OBJECT_SCHEMA,
    subject: { type: 'string' },
    as_of: { type: 'string' },
    fiscal_year: { type: 'integer' },
    months: ARRAY_OF_OBJECTS_SCHEMA,
    periods: ARRAY_OF_OBJECTS_SCHEMA,
    people: ARRAY_OF_OBJECTS_SCHEMA,
    excluded_records: { type: 'integer' },
  },
  additionalProperties: true,
};

const METRICS_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: { templates: ARRAY_OF_OBJECTS_SCHEMA, sources: ARRAY_OF_OBJECTS_SCHEMA },
  additionalProperties: true,
};

const readString = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const readInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) ? value : undefined;

const readObject = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ?
    (value as Record<string, unknown>)
  : undefined;

// The arguments the caller passed, in `keys` order, for a request body.
const copyOwn = (args: ToolArgs, keys: string[]): Record<string, unknown> =>
  Object.fromEntries(keys.filter((key) => args?.[key] !== undefined).map((key) => [key, args?.[key]]));

const integerParam = <K extends string>(args: ToolArgs, key: K): { [P in K]?: number } => {
  const value = readInteger(args?.[key]);
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: number };
};

const workspaceParams = (args: ToolArgs): { workspace_id?: string } => {
  const workspaceID = readString(args?.['workspace_id']);
  return workspaceID ? { workspace_id: workspaceID } : {};
};

const contextParams = (args: ToolArgs): { language?: string; workspace_id?: string } => {
  const language = readString(args?.['language']);
  return { ...(language ? { language } : undefined), ...workspaceParams(args) };
};

const goals = (reqContext: McpRequestContext) => reqContext.client.public.goals;

// The expected_version a write sends: the caller's, or the goal's current version.
const expectedVersion = async (reqContext: McpRequestContext, goalID: string, args: ToolArgs) =>
  readInteger(args?.['expected_version']) ??
  (await goals(reqContext).retrieve(goalID, workspaceParams(args))).goal.version;

const label = (owner: { id: number; label: string } | null | undefined): string =>
  owner ? `${owner.label} (member ${owner.id})` : 'Company';

const describeGoal = (goal: GoalData): string => {
  const measured =
    goal.metric === 'custom' ?
      `custom: ${goal.definition.source} ${goal.definition.measure ?? 'count'} by ${
        goal.definition.date_field ?? 'created_at'
      }`
    : `${goal.metric}${goal.amount ? ` ${goal.amount}` : ''}`;
  const money = goal.unit === 'money' ? ` in ${goal.currency ?? 'the workspace currency'}` : '';
  const people = goal.assignees.length > 0 ? `: ${goal.assignees.map(label).join(', ')}` : '';
  return `"${goal.name}" (goal_id ${goal.id}, version ${goal.version}; ${measured}, ${goal.unit}${money}; for ${goal.assignment}${people})`;
};

const describePeriod = (period: GoalPeriodProgress): string =>
  `${period.key} ${period.start} to ${period.end}: actual ${period.actual}, ${
    period.target === null ? 'no target' : `target ${period.target}, pace ${period.expected}`
  }`;

const describeTargets = (detail: Pick<GoalDetailData, 'fiscal_year' | 'months' | 'rows'>): string =>
  [
    `FY${detail.fiscal_year} targets for ${detail.months.map((month) => month.slice(0, 7)).join(', ')}:`,
    ...detail.rows.map(
      (row) => `- ${label(row.owner)}: ${row.targets.map((target) => target ?? '-').join(', ')}`,
    ),
  ].join('\n');

// Codes the goals API returns for requests it refuses. A 4xx answer writes nothing.
const GOAL_ERROR_HINTS: Record<string, string> = {
  VERSION_CONFLICT:
    'The goal changed after that version was read. Read it again with get_goal, check the change still applies, then retry.',
  NOT_FOUND: 'Check goal_id with list_goals; archived goals and goals of other workspaces are not found.',
  VALIDATION_ERROR:
    'Correct the request as the message says; list_goal_metrics lists the valid templates, sources, measures and date fields.',
};

const goalErrorResult = (error: unknown, write: boolean): ToolCallResult | undefined => {
  // An SDK APIError carries the V2 envelope as `error`, and the envelope its `error` body.
  const candidates: Record<string, unknown>[] = [];
  let candidate = readObject(error);
  while (candidate && candidates.length < 3) {
    candidates.push(candidate);
    candidate = readObject(candidate['error']);
  }
  const apiError = candidates.find((entry) => readString(entry['code']) && readString(entry['message']));
  const statusCode = candidates
    .map((entry) => entry['status'])
    .find((status): status is number => typeof status === 'number');
  if (!apiError || (statusCode !== undefined && statusCode >= 500)) {
    return undefined;
  }
  const code = readString(apiError['code']) ?? '';
  const message = readString(apiError['message']) ?? '';
  const hint = GOAL_ERROR_HINTS[code];
  const meta = candidates.map((entry) => readObject(entry['meta'])).find(Boolean);
  return {
    content: [
      {
        type: 'text',
        text: `${write ? 'Nothing was changed' : 'Could not read goals'} (${code}): ${message}${
          hint ? ` ${hint}` : ''
        }`,
      },
    ],
    isError: true,
    structuredContent: {
      ok: false,
      status: 'error',
      status_code: statusCode,
      code,
      message,
      details: apiError['details'],
      ctx_id: readString(meta?.['ctx_id']),
    },
  };
};

type GoalToolDefinition = {
  name: string;
  title: string;
  description: string;
  operation: 'read' | 'write';
  httpMethod: 'get' | 'post' | 'patch' | 'put' | 'delete';
  httpPath: string;
  operationId: string;
  inputSchema: McpTool['tool']['inputSchema'];
  outputSchema: McpTool['tool']['outputSchema'];
  destructive?: boolean;
  run: (reqContext: McpRequestContext, args: ToolArgs) => Promise<ToolCallResult>;
};

const defineGoalTool = (definition: GoalToolDefinition): McpTool => ({
  metadata: {
    resource: 'goals',
    operation: definition.operation,
    tags: ['goals'],
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
      destructiveHint: definition.destructive === true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: definition.title });
    if (authError) return authError;
    try {
      return await definition.run(reqContext, args);
    } catch (error) {
      const result = goalErrorResult(error, definition.operation === 'write');
      if (result) return result;
      throw error;
    }
  },
});

const requireGoalID = (args: ToolArgs): string | undefined => readString(args?.['goal_id']);

const mutationResult = (
  status: string,
  text: string,
  goal: GoalData,
  extra?: Record<string, unknown>,
): ToolCallResult => ({
  content: [{ type: 'text', text }],
  structuredContent: { ok: true, status, goal_id: goal.id, record: goal, ...extra },
});

export const listGoalsTool = defineGoalTool({
  name: 'list_goals',
  title: 'List goals',
  description:
    "List the workspace's active goals (monthly targets for one metric, for the company and/or assigned people) with this month's actual, target and pace, plus the fiscal year start month and default currency. Use get_goal for a goal's monthly targets and get_goal_progress for its progress by month, period or person. Amounts are decimal strings.",
  operation: 'read',
  httpMethod: 'get',
  httpPath: GOALS_PATH,
  operationId: 'list_public_goals',
  inputSchema: LIST_INPUT_SCHEMA,
  outputSchema: LIST_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const page = readInteger(args?.['page']) ?? 1;
    const params: GoalListParams = {
      ...integerParam(args, 'page'),
      ...integerParam(args, 'limit'),
      ...contextParams(args),
    };
    const data = await goals(reqContext).list(params);
    const shown = data.items.length;
    const more =
      shown < data.total && shown > 0 ?
        ` Showing ${shown} on page ${page}; pass page=${page + 1} for more.`
      : '';
    return {
      content: [
        {
          type: 'text',
          text: [
            `Found ${data.total} active goals.${more} Fiscal year starts in month ${data.fiscal_year_start_month}; default currency ${data.default_currency}.`,
            ...data.items.map(
              ({ goal, this_month }) => `- ${describeGoal(goal)}. This ${describePeriod(this_month)}.`,
            ),
          ].join('\n'),
        },
      ],
      structuredContent: data as unknown as Record<string, unknown>,
    };
  },
});

export const getGoalTool = defineGoalTool({
  name: 'get_goal',
  title: 'Get goal',
  description:
    "Load one goal and its monthly targets for a fiscal year. `months` holds the fiscal year's twelve first-of-month dates, and each row (the company row with owner null, except on a people goal, then one row per assigned person, whose owner.id is their workspace member id) has twelve targets aligned with `months`, null where none is set. goal.version is the expected_version for update_goal and set_goal_targets.",
  operation: 'read',
  httpMethod: 'get',
  httpPath: `${GOALS_PATH}/{goal_id}`,
  operationId: 'get_public_goal',
  inputSchema: RETRIEVE_INPUT_SCHEMA,
  outputSchema: DETAIL_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const goalID = requireGoalID(args);
    if (!goalID) return asErrorResult('`goal_id` is required.');
    const detail = await goals(reqContext).retrieve(goalID, {
      ...integerParam(args, 'fiscal_year'),
      ...contextParams(args),
    });
    return {
      content: [{ type: 'text', text: `Goal ${describeGoal(detail.goal)}.\n${describeTargets(detail)}` }],
      structuredContent: detail as unknown as Record<string, unknown>,
    };
  },
});

export const createGoalTool = defineGoalTool({
  name: 'create_goal',
  title: 'Create goal',
  description:
    "Create a goal: one metric with monthly targets for the company, for assigned people, or both. Call list_goal_metrics first, then pass a template's metric (and, when that metric is custom, its definition) or a custom definition built from a source's measures, date fields and saved-view style filters. A money goal counts records in its currency (default: the workspace currency). assignment company takes no assignee_ids; people and company_and_people need assignee_ids, the workspace member ids that list_employees returns as each row's id. Set monthly targets afterwards with set_goal_targets.",
  operation: 'write',
  httpMethod: 'post',
  httpPath: GOALS_PATH,
  operationId: 'create_public_goal',
  inputSchema: CREATE_INPUT_SCHEMA,
  outputSchema: MUTATION_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const goal = await goals(reqContext).create({
      ...copyOwn(args, ['name', 'metric', 'amount', 'currency', 'definition', 'assignment', 'assignee_ids']),
      ...contextParams(args),
    } as unknown as GoalCreateParams);
    return mutationResult(
      'created',
      `Created goal ${describeGoal(goal)}. Set its monthly targets with set_goal_targets.`,
      goal,
    );
  },
});

const GOAL_UPDATE_FIELDS = ['name', 'amount', 'definition', 'assignment', 'assignee_ids'];

export const updateGoalTool = defineGoalTool({
  name: 'update_goal',
  title: 'Update goal',
  description:
    "Rename a goal, change an invoice_revenue goal's amount, replace a custom goal's definition, or change who it is for. assignee_ids is the complete list of assigned people (workspace member ids, the id of a list_employees row): anyone left out loses their targets, and assignment=company removes everyone, so confirm removals with the user first. expected_version guards against concurrent edits (VERSION_CONFLICT); omit it to use the goal's current version.",
  operation: 'write',
  httpMethod: 'patch',
  httpPath: `${GOALS_PATH}/{goal_id}`,
  operationId: 'update_public_goal',
  inputSchema: UPDATE_INPUT_SCHEMA,
  outputSchema: MUTATION_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const goalID = requireGoalID(args);
    if (!goalID) return asErrorResult('`goal_id` is required.');
    const changes = copyOwn(args, GOAL_UPDATE_FIELDS);
    if (Object.keys(changes).length === 0) {
      return asErrorResult(`Pass at least one change: ${GOAL_UPDATE_FIELDS.join(', ')}.`);
    }
    const goal = await goals(reqContext).update(goalID, {
      expected_version: await expectedVersion(reqContext, goalID, args),
      ...changes,
      ...contextParams(args),
    } as unknown as GoalUpdateParams);
    return mutationResult('updated', `Updated goal ${describeGoal(goal)}.`, goal);
  },
});

export const deleteGoalTool = defineGoalTool({
  name: 'delete_goal',
  title: 'Delete goal',
  description:
    'Archive a goal. It leaves list_goals, can no longer be read or edited here, and report panels that draw it show it as archived. There is no restore tool, so confirm with the user first.',
  operation: 'write',
  httpMethod: 'delete',
  httpPath: `${GOALS_PATH}/{goal_id}`,
  operationId: 'delete_public_goal',
  inputSchema: DELETE_INPUT_SCHEMA,
  outputSchema: MUTATION_OUTPUT_SCHEMA,
  destructive: true,
  run: async (reqContext, args) => {
    const goalID = requireGoalID(args);
    if (!goalID) return asErrorResult('`goal_id` is required.');
    const goal = await goals(reqContext).delete(goalID, workspaceParams(args));
    return mutationResult('archived', `Archived goal "${goal.name}" (goal_id ${goal.id}).`, goal);
  },
});

export const setGoalTargetsTool = defineGoalTool({
  name: 'set_goal_targets',
  title: 'Set goal targets',
  description:
    "Set or clear a goal's monthly targets. Each cell is one month (YYYY-MM-01) for the company row (owner_id null) or one person (owner_id: a workspace member id, the id of a list_employees row), and target null clears it; cells not listed keep their values. Targets are monthly: split a quarterly or yearly target across its months, which follow the workspace fiscal year (fiscal_year_start_month from list_goals). Giving a person a target assigns them and turns a company goal into company_and_people; a people goal takes no company cells. Omit expected_version to use the goal's current version.",
  operation: 'write',
  httpMethod: 'put',
  httpPath: `${GOALS_PATH}/{goal_id}/targets`,
  operationId: 'set_public_goal_targets',
  inputSchema: SET_TARGETS_INPUT_SCHEMA,
  outputSchema: TARGETS_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const goalID = requireGoalID(args);
    if (!goalID) return asErrorResult('`goal_id` is required.');
    const cells = (Array.isArray(args?.['cells']) ? args['cells'] : []) as GoalSetTargetsParams['cells'];
    const { goal, ...detail } = await goals(reqContext).setTargets(goalID, {
      expected_version: await expectedVersion(reqContext, goalID, args),
      cells,
      ...integerParam(args, 'fiscal_year'),
      ...contextParams(args),
    });
    return mutationResult(
      'updated',
      `Saved ${cells.length} target ${cells.length === 1 ? 'cell' : 'cells'} on goal ${describeGoal(
        goal,
      )}.\n${describeTargets(detail)}`,
      goal,
      detail,
    );
  },
});

export const getGoalProgressTool = defineGoalTool({
  name: 'get_goal_progress',
  title: 'Get goal progress',
  description:
    "Load a goal's target versus actual: monthly actual and target (no actual for future months), the month, quarter, half and fiscal year containing today with their actual, target and pace (expected: the targets of finished months plus today's share of this month's), and with people_period one row per person plus Unassigned. subject picks the company (every record), me, or one person (owner_id). excluded_records counts records in other currencies that a money goal leaves out.",
  operation: 'read',
  httpMethod: 'get',
  httpPath: `${GOALS_PATH}/{goal_id}/progress`,
  operationId: 'get_public_goal_progress',
  inputSchema: PROGRESS_INPUT_SCHEMA,
  outputSchema: PROGRESS_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const goalID = requireGoalID(args);
    if (!goalID) return asErrorResult('`goal_id` is required.');
    const subject = readString(args?.['subject']);
    const ownerID = readInteger(args?.['owner_id']);
    if (ownerID !== undefined && subject !== undefined && subject !== 'owner') {
      return asErrorResult('Pass owner_id only with subject=owner.');
    }
    if (subject === 'owner' && ownerID === undefined) {
      return asErrorResult('`owner_id` is required when subject is owner.');
    }
    const params = {
      ...(ownerID !== undefined ? { subject: `owner:${ownerID}` }
      : subject ? { subject }
      : undefined),
      ...copyOwn(args, ['range']),
      ...integerParam(args, 'fiscal_year'),
      ...copyOwn(args, ['people_period']),
      ...contextParams(args),
    } as GoalRetrieveProgressParams;
    const progress: GoalProgressData = await goals(reqContext).retrieveProgress(goalID, params);
    const months = progress.months
      .map((point) => `${point.month.slice(0, 7)} ${point.actual ?? '-'}/${point.target ?? '-'}`)
      .join(', ');
    const people = (progress.people ?? []).map(
      (person) =>
        `- ${person.owner ? label(person.owner) : 'Unassigned'}: actual ${person.actual}, ${
          person.target === null ? 'no target' : `target ${person.target}, pace ${person.expected}`
        }`,
    );
    return {
      content: [
        {
          type: 'text',
          text: [
            `Goal ${describeGoal(progress.goal)}, ${
              progress.owner ? label(progress.owner) : progress.subject
            } as of ${progress.as_of} (FY${progress.fiscal_year}):`,
            ...progress.periods.map((period) => `- ${describePeriod(period)}`),
            `Monthly actual/target: ${months}`,
            ...(people.length > 0 ? [`People this ${progress.people_period}:`, ...people] : []),
            ...(progress.excluded_records ?
              [`${progress.excluded_records} records in other currencies were left out.`]
            : []),
          ].join('\n'),
        },
      ],
      structuredContent: progress as unknown as Record<string, unknown>,
    };
  },
});

export const listGoalMetricsTool = defineGoalTool({
  name: 'list_goal_metrics',
  title: 'List goal metrics',
  description:
    'List what a goal can measure, to build create_goal input: templates (the deals_created and invoice_revenue presets and ready custom definitions) and, for each source object, its measures with their unit (count, money or number), the date fields that place a record in a month, the default date field, whether records have an owner (goals on objects without one are company-only) and filter_object_type, the object whose fields definition.filters can use.',
  operation: 'read',
  httpMethod: 'get',
  httpPath: `${GOALS_PATH}/metrics`,
  operationId: 'list_public_goal_metrics',
  inputSchema: METRICS_INPUT_SCHEMA,
  outputSchema: METRICS_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const catalog: GoalMetricCatalog = await goals(reqContext).listMetrics(contextParams(args));
    return {
      content: [
        {
          type: 'text',
          text: [
            'Templates:',
            ...catalog.templates.map(
              (template) =>
                `- ${template.key} "${template.label}": metric ${template.metric}${
                  template.metric === 'custom' ? `, definition ${JSON.stringify(template.definition)}` : ''
                } (${template.unit})`,
            ),
            'Sources:',
            ...catalog.sources.map(
              (source) =>
                `- ${source.key} "${source.label}": measures ${source.measures
                  .map((measure) => `${measure.key} (${measure.unit})`)
                  .join(', ')}; date fields ${source.date_fields
                  .map((field) => field.key)
                  .join(', ')} (default ${source.default_date_field}); ${
                  source.has_owner ? 'has owners' : 'no owner, company goals only'
                }; filters ${source.filter_object_type ?? 'none'}`,
            ),
          ].join('\n'),
        },
      ],
      structuredContent: catalog as unknown as Record<string, unknown>,
    };
  },
});

export const goalsTools: McpTool[] = [
  listGoalsTool,
  getGoalTool,
  createGoalTool,
  updateGoalTool,
  deleteGoalTool,
  setGoalTargetsTool,
  getGoalProgressTool,
  listGoalMetricsTool,
];
