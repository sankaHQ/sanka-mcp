import {
  crmCreateReportTool,
  crmCreateViewTool,
  crmListReportsTool,
  crmListViewsTool,
  crmUpdateReportTool,
  crmUpdateViewTool,
} from '../../packages/mcp-server/src/crm-tools';
import { validateToolArguments } from '../../packages/mcp-server/src/tool-argument-validator';
import { McpRequestContext, McpTool } from '../../packages/mcp-server/src/types';
import { envelope, sendThroughSDK, V2Request } from './crm/helpers';

// A view's filter record as GET/PUT /api/v2/views/{view_id}/filter and the view routes return it.
const viewFilter = (filter: Record<string, unknown>) => ({
  expressions: [],
  sort_field_id: null,
  sort_direction: null,
  archive_mode: 'active',
  page_size: 50,
  ...filter,
});
const createdView = () =>
  envelope({ view: { view_id: 'view-1', title: 'Open deals', object_type: 'deal' }, filter: viewFilter({}) });
const createRequest = {
  method: 'POST',
  url: 'http://localhost:5000/api/v2/views',
  body: { object: 'deals', object_type: 'deals', name: 'Open deals', title: 'Open deals' },
};
const filterURL = 'http://localhost:5000/api/v2/views/view-1/filter';
const stageIn = { field: { field_id: 'standard:stage' }, operator: 'in', value: ['open', 'won'] };
const amountID = 'custom_property:0b6c9d2e-5a4f-4c1e-9f3a-2d7e8b1c4a60';
const amountBetween = { field: { field_id: amountID }, operator: 'between', value: [100, 500] };
const sortedFilter = viewFilter({
  expressions: [stageIn, amountBetween],
  sort_field_id: 'standard:created_at',
  sort_direction: 'asc',
});
const stageFilter = viewFilter({
  expressions: [stageIn],
  sort_field_id: 'standard:amount',
  sort_direction: 'desc',
  page_size: 25,
});

const viewCases: Array<{
  name: string;
  tool: McpTool;
  args: Record<string, unknown>;
  responses: Response[];
  expectedRequests: V2Request[];
  expectedResult: Record<string, unknown>;
  isError?: boolean;
}> = [
  {
    name: 'list_views filters by object_type',
    tool: crmListViewsTool,
    args: { object: 'deals', workspace_id: 'workspace-1' },
    responses: [envelope([{ view_id: 'view-1', label: 'Open deals' }])],
    expectedRequests: [
      { method: 'GET', url: 'http://localhost:5000/api/v2/views?object_type=deals&workspace_id=workspace-1' },
    ],
    expectedResult: { results: [{ view_id: 'view-1', label: 'Open deals' }] },
  },
  {
    name: 'create_view saves filters and sort through the view filter route',
    tool: crmCreateViewTool,
    args: {
      object: 'deals',
      name: 'Open deals',
      filters: [
        { field: 'standard:stage', operator: 'in', value: ['open', 'won'] },
        { field: amountID, operator: 'between', value: 100, value2: 500 },
      ],
      sort_order_by: 'standard:created_at',
      sort_order_method: 'asc',
    },
    responses: [createdView(), envelope({ filter: sortedFilter })],
    expectedRequests: [
      createRequest,
      {
        method: 'PUT',
        url: filterURL,
        body: {
          expressions: [stageIn, amountBetween],
          sort_field_id: 'standard:created_at',
          sort_direction: 'asc',
          archive_mode: 'active',
          page_size: 50,
        },
      },
    ],
    expectedResult: { data: { view_id: 'view-1' }, filter: sortedFilter },
  },
  {
    name: 'update_view replaces only the filters and keeps the saved sort and page size',
    tool: crmUpdateViewTool,
    args: {
      view_id: 'view-1',
      object: 'deals',
      filters: [{ field: 'standard:stage', operator: 'in', value: ['open', 'won'] }],
    },
    responses: [
      envelope({
        filter: viewFilter({ sort_field_id: 'standard:amount', sort_direction: 'desc', page_size: 25 }),
      }),
      envelope({ filter: stageFilter }),
    ],
    expectedRequests: [
      { method: 'GET', url: filterURL },
      {
        method: 'PUT',
        url: filterURL,
        body: {
          expressions: [stageIn],
          sort_field_id: 'standard:amount',
          sort_direction: 'desc',
          archive_mode: 'active',
          page_size: 25,
        },
      },
    ],
    expectedResult: { filter: stageFilter },
  },
  {
    name: 'create_view reports the created view when its filters are rejected',
    tool: crmCreateViewTool,
    args: { object: 'deals', name: 'Open deals', filters: [{ field: 'standard:missing', value: 'x' }] },
    responses: [
      createdView(),
      new Response(
        JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'invalid' }, meta: {} }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    ],
    expectedRequests: [
      createRequest,
      {
        method: 'PUT',
        url: filterURL,
        body: {
          expressions: [{ field: { field_id: 'standard:missing' }, operator: 'equals', value: 'x' }],
          sort_field_id: null,
          sort_direction: null,
          archive_mode: 'active',
          page_size: 50,
        },
      },
    ],
    expectedResult: { data: { view_id: 'view-1' }, filter_saved: false },
    isError: true,
  },
];

describe('saved view and report tools', () => {
  it.each(viewCases)(
    '$name',
    async ({ tool, args, responses, expectedRequests, expectedResult, isError }) => {
      expect(validateToolArguments({ mcpTool: tool, args })).toBeUndefined();

      const { requests, result } = await sendThroughSDK({ tool, args, responses });

      expect(requests).toEqual(expectedRequests);
      expect(result.isError ?? false).toBe(isError ?? false);
      expect(result.structuredContent).toMatchObject(expectedResult);
    },
  );

  it('create_report posts a report metadata payload to the public reports endpoint', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      report_id: 'report-1',
    });
    const reqContext = {
      client: { public: { reports: { create } } },
    } as unknown as McpRequestContext;

    const result = await crmCreateReportTool.handler({
      reqContext,
      args: {
        name: 'Invoice Aging',
        description: 'Open invoices by customer',
        report_type: 'invoices',
        report_format: 'chart',
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        reportMetadata: {
          name: 'Invoice Aging',
          description: 'Open invoices by customer',
          reportType: { type: 'invoices' },
          reportFormat: 'chart',
        },
        createDefaultPanel: true,
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      ok: true,
      report_id: 'report-1',
    });
  });

  it('update_report does not request a default panel unless asked', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      report_id: 'report-1',
    });
    const reqContext = {
      client: { public: { reports: { update } } },
    } as unknown as McpRequestContext;

    await crmUpdateReportTool.handler({
      reqContext,
      args: {
        report_id: 'report-1',
        name: 'Invoice Aging Updated',
        workspace_id: 'workspace-1',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'report-1',
      {
        reportMetadata: {
          name: 'Invoice Aging Updated',
        },
        workspace_id: 'workspace-1',
      },
      undefined,
    );
  });

  it('list_reports requests the public reports endpoint', async () => {
    const list = jest.fn().mockResolvedValue([{ id: 'report-1', name: 'Invoice Aging' }]);
    const reqContext = {
      client: { public: { reports: { list } } },
    } as unknown as McpRequestContext;

    const result = await crmListReportsTool.handler({
      reqContext,
      args: {
        page: 2,
        limit: 5,
        workspace_id: 'workspace-1',
      },
    });

    expect(list).toHaveBeenCalledWith(
      {
        page: 2,
        limit: 5,
        workspace_id: 'workspace-1',
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      page: 2,
      count: 1,
      results: [{ id: 'report-1', name: 'Invoice Aging' }],
    });
  });
});
