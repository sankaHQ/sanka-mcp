import {
  createGoalTool,
  deleteGoalTool,
  getGoalProgressTool,
  getGoalTool,
  listGoalMetricsTool,
  listGoalsTool,
  setGoalTargetsTool,
  updateGoalTool,
} from '../../packages/mcp-server/src/goals-tools';
import { validateToolArguments } from '../../packages/mcp-server/src/tool-argument-validator';
import type { McpTool } from '../../packages/mcp-server/src/types';
import { envelope, firstTextContent, sendThroughSDK, type V2Request } from './crm/helpers';

const GOAL_ID = '6f1d3c2a-5b7e-4c1d-9a2b-3c4d5e6f7a8b';
const GOALS = 'http://localhost:5000/api/v2/public/goals';

const aiko = { id: 12, label: 'Aiko Sato' };
const goal = {
  id: GOAL_ID,
  name: 'Enterprise deals',
  metric: 'custom',
  unit: 'money',
  source: 'deals',
  definition: { source: 'deals', measure: 'amount', date_field: 'closed_at', filters: [] },
  amount: null,
  currency: 'JPY',
  assignment: 'company_and_people',
  assignees: [aiko],
  version: 3,
  archived: false,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};
const months = Array.from({ length: 12 }, (_, index) => {
  const month = new Date(Date.UTC(2026, 3 + index, 1));
  return month.toISOString().slice(0, 10);
});
const detail = {
  goal,
  fiscal_year: 2027,
  fiscal_year_start_month: 4,
  months,
  rows: [
    { owner: null, targets: months.map(() => '1000000.00') },
    { owner: aiko, targets: months.map((_, index) => (index < 6 ? '400000.00' : null)) },
  ],
  can_edit: true,
};
const thisMonth = {
  key: 'month',
  start: '2026-10-01',
  end: '2026-10-31',
  actual: '250000.00',
  target: '1000000.00',
  expected: '161290.32',
};

const errorResponse = (status: number, code: string, message: string) =>
  new Response(
    JSON.stringify({ success: false, error: { code, message }, meta: { ctx_id: 'ctx-goal-error' } }),
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
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  text?: string[];
}> = [
  {
    name: 'list_goals pages through goals and summarizes this month for each',
    tool: listGoalsTool,
    args: { page: 2, limit: 1, language: 'ja' },
    responses: [
      envelope({
        items: [{ goal, this_month: thisMonth }],
        total: 3,
        can_edit: true,
        fiscal_year_start_month: 4,
        default_currency: 'JPY',
      }),
    ],
    requests: [{ method: 'GET', url: `${GOALS}?page=2&limit=1&language=ja` }],
    structuredContent: { total: 3, items: [{ goal, this_month: thisMonth }] },
    text: [
      'Found 3 active goals. Showing 1 on page 2; pass page=3 for more.',
      `goal_id ${GOAL_ID}, version 3`,
      'Aiko Sato (member 12)',
      'actual 250000.00, target 1000000.00, pace 161290.32',
    ],
  },
  {
    name: 'get_goal reads the monthly targets of one fiscal year',
    tool: getGoalTool,
    args: { goal_id: GOAL_ID, fiscal_year: 2027 },
    responses: [envelope(detail)],
    requests: [{ method: 'GET', url: `${GOALS}/${GOAL_ID}?fiscal_year=2027` }],
    structuredContent: detail,
    text: ['FY2027 targets for 2026-04, 2026-05', '- Aiko Sato (member 12): 400000.00, 400000.00'],
  },
  {
    name: 'create_goal posts a filtered custom goal for assigned people in the given workspace',
    tool: createGoalTool,
    args: {
      name: 'Enterprise deals',
      metric: 'custom',
      currency: 'JPY',
      definition: {
        source: 'deals',
        measure: 'amount',
        date_field: 'closed_at',
        filters: [{ field: { field_id: 'standard:case_status' }, operator: 'equals', value: 'closedwon' }],
      },
      assignment: 'people',
      assignee_ids: [12, 15],
      workspace_id: 'workspace-1',
    },
    responses: [envelope(goal)],
    requests: [
      {
        method: 'POST',
        url: `${GOALS}?workspace_id=workspace-1`,
        body: {
          name: 'Enterprise deals',
          metric: 'custom',
          currency: 'JPY',
          definition: {
            source: 'deals',
            measure: 'amount',
            date_field: 'closed_at',
            filters: [
              { field: { field_id: 'standard:case_status' }, operator: 'equals', value: 'closedwon' },
            ],
          },
          assignment: 'people',
          assignee_ids: [12, 15],
        },
      },
    ],
    structuredContent: { ok: true, status: 'created', goal_id: GOAL_ID, record: goal },
  },
  {
    name: 'update_goal sends the given expected_version with the changes',
    tool: updateGoalTool,
    args: { goal_id: GOAL_ID, expected_version: 3, name: 'Enterprise wins', assignee_ids: [12] },
    responses: [envelope({ ...goal, name: 'Enterprise wins', version: 4 })],
    requests: [
      {
        method: 'PATCH',
        url: `${GOALS}/${GOAL_ID}`,
        body: { expected_version: 3, name: 'Enterprise wins', assignee_ids: [12] },
      },
    ],
    structuredContent: { ok: true, status: 'updated', goal_id: GOAL_ID, record: { version: 4 } },
  },
  {
    name: 'update_goal reads the current version first when expected_version is omitted',
    tool: updateGoalTool,
    args: { goal_id: GOAL_ID, assignment: 'company', workspace_id: 'workspace-1' },
    responses: [envelope(detail), envelope({ ...goal, assignment: 'company', assignees: [], version: 4 })],
    requests: [
      { method: 'GET', url: `${GOALS}/${GOAL_ID}?workspace_id=workspace-1` },
      {
        method: 'PATCH',
        url: `${GOALS}/${GOAL_ID}?workspace_id=workspace-1`,
        body: { expected_version: 3, assignment: 'company' },
      },
    ],
    structuredContent: { status: 'updated', record: { assignment: 'company', version: 4 } },
  },
  {
    name: 'update_goal surfaces VERSION_CONFLICT and says nothing changed',
    tool: updateGoalTool,
    args: { goal_id: GOAL_ID, expected_version: 2, name: 'Enterprise wins' },
    responses: [errorResponse(409, 'VERSION_CONFLICT', 'Goal changed. Reload before saving.')],
    requests: [
      {
        method: 'PATCH',
        url: `${GOALS}/${GOAL_ID}`,
        body: { expected_version: 2, name: 'Enterprise wins' },
      },
    ],
    isError: true,
    structuredContent: { ok: false, status_code: 409, code: 'VERSION_CONFLICT', ctx_id: 'ctx-goal-error' },
    text: ['Nothing was changed (VERSION_CONFLICT): Goal changed. Reload before saving.', 'get_goal'],
  },
  {
    name: 'update_goal without a change sends nothing',
    tool: updateGoalTool,
    args: { goal_id: GOAL_ID, expected_version: 3 },
    responses: [],
    requests: [],
    isError: true,
    text: ['Pass at least one change'],
  },
  {
    name: 'delete_goal archives the goal',
    tool: deleteGoalTool,
    args: { goal_id: GOAL_ID },
    responses: [envelope({ ...goal, archived: true, version: 4 })],
    requests: [{ method: 'DELETE', url: `${GOALS}/${GOAL_ID}` }],
    structuredContent: { ok: true, status: 'archived', goal_id: GOAL_ID, record: { archived: true } },
  },
  {
    name: 'set_goal_targets reads the version, then writes company and person cells',
    tool: setGoalTargetsTool,
    args: {
      goal_id: GOAL_ID,
      fiscal_year: 2027,
      cells: [
        { owner_id: null, month: '2026-10-01', target: 1200000 },
        { owner_id: 12, month: '2026-10-01', target: '450000.50' },
        { month: '2026-11-01', target: null },
      ],
    },
    responses: [envelope(detail), envelope({ ...detail, goal: { ...goal, version: 4 } })],
    requests: [
      { method: 'GET', url: `${GOALS}/${GOAL_ID}` },
      {
        method: 'PUT',
        url: `${GOALS}/${GOAL_ID}/targets?fiscal_year=2027`,
        body: {
          expected_version: 3,
          cells: [
            { owner_id: null, month: '2026-10-01', target: 1200000 },
            { owner_id: 12, month: '2026-10-01', target: '450000.50' },
            { month: '2026-11-01', target: null },
          ],
        },
      },
    ],
    structuredContent: {
      ok: true,
      status: 'updated',
      goal_id: GOAL_ID,
      record: { version: 4 },
      fiscal_year: 2027,
      rows: detail.rows,
    },
    text: ['Saved 3 target cells', '- Company: 1000000.00'],
  },
  {
    name: 'get_goal_progress asks for one person over the last 12 months with per-person rows',
    tool: getGoalProgressTool,
    args: { goal_id: GOAL_ID, owner_id: 12, range: 'last_12_months', people_period: 'quarter' },
    responses: [
      envelope({
        goal,
        subject: 'owner:12',
        owner: aiko,
        as_of: '2026-10-05',
        fiscal_year: 2027,
        months: [{ month: '2026-10-01', actual: '250000.00', target: '400000.00' }],
        periods: [thisMonth],
        people_period: 'quarter',
        people: [
          { owner: aiko, actual: '250000.00', target: '400000.00', expected: '64516.13' },
          { owner: null, actual: '30000.00', target: null, expected: null },
        ],
        excluded_records: 2,
      }),
    ],
    requests: [
      {
        method: 'GET',
        url: `${GOALS}/${GOAL_ID}/progress?subject=owner%3A12&range=last_12_months&people_period=quarter`,
      },
    ],
    structuredContent: { subject: 'owner:12', excluded_records: 2 },
    text: [
      'Aiko Sato (member 12) as of 2026-10-05 (FY2027)',
      'Monthly actual/target: 2026-10 250000.00/400000.00',
      '- Unassigned: actual 30000.00, no target',
      '2 records in other currencies were left out.',
    ],
  },
  {
    name: 'get_goal_progress refuses subject=owner without owner_id',
    tool: getGoalProgressTool,
    args: { goal_id: GOAL_ID, subject: 'owner' },
    responses: [],
    requests: [],
    isError: true,
    text: ['`owner_id` is required'],
  },
  {
    name: 'list_goal_metrics reads the catalog in the requested language',
    tool: listGoalMetricsTool,
    args: { language: 'ja' },
    responses: [
      envelope({
        templates: [
          {
            key: 'orders',
            label: '受注件数',
            metric: 'custom',
            definition: { source: 'orders', measure: 'count', date_field: 'order_date', filters: [] },
            unit: 'count',
          },
        ],
        sources: [
          {
            key: 'projects',
            label: 'プロジェクト',
            measures: [{ key: 'count', label: '件数', unit: 'count' }],
            date_fields: [{ key: 'created_at', label: '作成日' }],
            default_date_field: 'created_at',
            has_owner: false,
            filter_object_type: 'project',
          },
        ],
      }),
    ],
    requests: [{ method: 'GET', url: `${GOALS}/metrics?language=ja` }],
    text: [
      '- orders "受注件数": metric custom, definition {"source":"orders","measure":"count"',
      '- projects "プロジェクト": measures count (count); date fields created_at (default created_at); no owner',
    ],
  },
];

describe('goal tools', () => {
  it.each(cases)(
    '$name',
    async ({ tool, args, responses, requests, isError = false, structuredContent, text = [] }) => {
      expect(validateToolArguments({ mcpTool: tool, args })).toBeUndefined();

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
});
