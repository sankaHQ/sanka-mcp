import {
  crmCreateReportTool,
  crmCreateViewTool,
  crmGetViewTool,
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
const createdView = (columns?: string[]) =>
  envelope({
    view: {
      view_id: 'view-1',
      title: 'Open deals',
      object_type: 'deal',
      ...(columns ? { column_field_ids: columns } : undefined),
    },
    filter: viewFilter({}),
  });
const createRequest = {
  method: 'POST',
  url: 'http://localhost:5000/api/v2/views',
  body: { object: 'deals', object_type: 'deals', name: 'Open deals', title: 'Open deals' },
};
const createRequestWithColumns = (columns: string[]) => ({
  ...createRequest,
  body: { ...createRequest.body, columns, column_field_ids: columns },
});
const rejected = () =>
  new Response(
    JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'invalid' }, meta: {} }),
    { status: 422, headers: { 'Content-Type': 'application/json' } },
  );
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
const viewURL = 'http://localhost:5000/api/v2/views/view-1';
const columnsURL = `${viewURL}/columns`;
const nameID = 'standard:name';
const emailID = 'standard:email';
// GET /api/v2/views/{view_id}, which the update reads back.
const savedView = (view: Record<string, unknown> = {}, filter: Record<string, unknown> = {}) =>
  envelope({
    view: {
      view_id: 'view-1',
      title: 'Open deals',
      mode: 'table',
      visibility: 'workspace',
      column_field_ids: [nameID, emailID],
      ...view,
    },
    filter: viewFilter(filter),
  });
const savedColumns = (fieldIDs: string[]) =>
  envelope({
    view_id: 'view-1',
    object_type: 'company',
    columns: fieldIDs.map((field_id, order) => ({ field_id, order })),
  });
const putColumns = (fieldIDs: string[]) => ({
  method: 'PUT',
  url: columnsURL,
  body: { column_field_ids: fieldIDs },
});

const viewCases: Array<{
  name: string;
  tool: McpTool;
  args: Record<string, unknown>;
  responses: Response[];
  expectedRequests: V2Request[];
  expectedResult: Record<string, unknown>;
  expectedText?: string;
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
    name: 'list_views sends language on the query param the route reads',
    tool: crmListViewsTool,
    args: { object: 'deals', language: 'ja' },
    responses: [envelope([{ view_id: 'view-1', label: 'デフォルト' }])],
    expectedRequests: [
      { method: 'GET', url: 'http://localhost:5000/api/v2/views?object_type=deals&language=ja' },
    ],
    expectedResult: { results: [{ view_id: 'view-1', label: 'デフォルト' }] },
  },
  {
    name: 'get_view sends language on the query param the route reads',
    tool: crmGetViewTool,
    args: { view_id: 'view-1', language: 'ja' },
    responses: [savedView()],
    expectedRequests: [{ method: 'GET', url: `${viewURL}?language=ja` }],
    expectedResult: { data: { view_id: 'view-1' } },
  },
  {
    name: 'create_view sends language on the query param the route reads',
    tool: crmCreateViewTool,
    args: { object: 'deals', name: 'Open deals', language: 'ja' },
    responses: [createdView()],
    expectedRequests: [{ ...createRequest, url: `${createRequest.url}?language=ja` }],
    expectedResult: { data: { view_id: 'view-1' } },
  },
  {
    name: 'create_view reads the columns back and accepts one saved under its canonical id',
    tool: crmCreateViewTool,
    args: { object: 'deals', name: 'Open deals', columns: ['name', emailID] },
    responses: [createdView([nameID, emailID]), savedColumns([nameID, emailID])],
    expectedRequests: [createRequestWithColumns(['name', emailID]), { method: 'GET', url: columnsURL }],
    expectedResult: { data: { view_id: 'view-1' } },
  },
  {
    name: 'create_view fails and names a column the API did not keep',
    tool: crmCreateViewTool,
    args: { object: 'deals', name: 'Open deals', columns: ['record_id', 'name'] },
    responses: [createdView([nameID]), savedColumns([nameID])],
    expectedRequests: [createRequestWithColumns(['record_id', 'name']), { method: 'GET', url: columnsURL }],
    expectedResult: {
      view_id: 'view-1',
      not_saved: { columns: ['record_id'] },
      record_preview: { columns: [nameID] },
    },
    expectedText: 'update_view and view_id view-1',
    isError: true,
  },
  {
    // A kanban view keeps no requested column, and its detail then lists the
    // object's defaults, here as many as were requested.
    name: 'create_view fails when the view lists as many default columns as were requested',
    tool: crmCreateViewTool,
    args: { object: 'deals', name: 'Open deals', view_type: 'kanban', columns: ['standard:a', 'standard:b'] },
    responses: [createdView([nameID, emailID]), savedColumns([])],
    expectedRequests: [
      {
        ...createRequest,
        body: {
          ...createRequestWithColumns(['standard:a', 'standard:b']).body,
          view_type: 'kanban',
          mode: 'kanban',
        },
      },
      { method: 'GET', url: columnsURL },
    ],
    expectedResult: { not_saved: { columns: ['standard:a', 'standard:b'] }, record_preview: { columns: [] } },
    isError: true,
  },
  {
    name: 'create_view names the view it created when its columns cannot be read back',
    tool: crmCreateViewTool,
    args: { object: 'deals', name: 'Open deals', columns: [nameID] },
    responses: [createdView([nameID]), rejected()],
    expectedRequests: [createRequestWithColumns([nameID]), { method: 'GET', url: columnsURL }],
    expectedResult: { view_id: 'view-1', columns_error: expect.any(String) },
    expectedText: 'get_view_columns and view_id view-1',
    isError: true,
  },
  {
    name: 'create_view fails for a dropped column even when its filters were saved',
    tool: crmCreateViewTool,
    args: {
      object: 'deals',
      name: 'Open deals',
      columns: ['record_id', 'name'],
      filters: [{ field: 'standard:stage', operator: 'in', value: ['open', 'won'] }],
    },
    responses: [createdView([nameID]), envelope({ filter: stageFilter }), savedColumns([nameID])],
    expectedRequests: [
      createRequestWithColumns(['record_id', 'name']),
      {
        method: 'PUT',
        url: filterURL,
        body: {
          expressions: [stageIn],
          sort_field_id: null,
          sort_direction: null,
          archive_mode: 'active',
          page_size: 50,
        },
      },
      { method: 'GET', url: columnsURL },
    ],
    expectedResult: {
      view_id: 'view-1',
      filter: stageFilter,
      not_saved: { columns: ['record_id'] },
      record_preview: { columns: [nameID] },
    },
    isError: true,
  },
  {
    name: 'create_view reports a dropped column beside rejected filters',
    tool: crmCreateViewTool,
    args: {
      object: 'deals',
      name: 'Open deals',
      columns: ['record_id', 'name'],
      filters: [{ field: 'standard:missing', value: 'x' }],
    },
    responses: [createdView([nameID]), rejected(), savedColumns([nameID])],
    expectedRequests: [
      createRequestWithColumns(['record_id', 'name']),
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
      { method: 'GET', url: columnsURL },
    ],
    expectedResult: { filter_saved: false, not_saved: { columns: ['record_id'] } },
    isError: true,
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
      savedView({}, stageFilter),
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
      { method: 'GET', url: viewURL },
    ],
    expectedResult: { filter: stageFilter },
  },
  {
    name: 'update_view saves columns on the columns route, which the view route ignores',
    tool: crmUpdateViewTool,
    args: { view_id: 'view-1', object: 'companies', view_type: 'table', columns: [nameID, emailID] },
    responses: [savedView(), savedColumns([nameID, emailID]), savedView()],
    expectedRequests: [
      { method: 'GET', url: viewURL },
      putColumns([nameID, emailID]),
      { method: 'GET', url: viewURL },
    ],
    expectedResult: {
      view_id: 'view-1',
      record_preview: { columns: [nameID, emailID], view_type: 'table' },
    },
  },
  {
    name: 'update_view sends a view type that differs from the saved one',
    tool: crmUpdateViewTool,
    args: { view_id: 'view-1', object: 'deals', view_type: 'kanban' },
    responses: [savedView(), savedView({ mode: 'kanban' }), savedView({ mode: 'kanban' })],
    expectedRequests: [
      { method: 'GET', url: viewURL },
      { method: 'PATCH', url: viewURL, body: { view_type: 'kanban', mode: 'kanban' } },
      { method: 'GET', url: viewURL },
    ],
    expectedResult: { record_preview: { view_type: 'kanban' } },
  },
  {
    name: 'update_view saves columns alone, without a view route request',
    tool: crmUpdateViewTool,
    args: { view_id: 'view-1', object: 'companies', column_field_ids: [nameID, emailID] },
    responses: [savedColumns([nameID, emailID]), savedView()],
    expectedRequests: [putColumns([nameID, emailID]), { method: 'GET', url: viewURL }],
    expectedResult: { record_preview: { columns: [nameID, emailID] } },
  },
  {
    name: 'update_view accepts a column the API saves under its canonical id',
    tool: crmUpdateViewTool,
    args: { view_id: 'view-1', object: 'companies', columns: ['name', emailID] },
    responses: [savedColumns([nameID, emailID]), savedView()],
    expectedRequests: [putColumns(['name', emailID]), { method: 'GET', url: viewURL }],
    expectedResult: { record_preview: { columns: [nameID, emailID] } },
  },
  {
    name: 'update_view fails when the API did not keep a requested column',
    tool: crmUpdateViewTool,
    args: { view_id: 'view-1', object: 'companies', columns: ['record_id', 'name'] },
    responses: [savedColumns([nameID]), savedView({ column_field_ids: [nameID] })],
    expectedRequests: [putColumns(['record_id', 'name']), { method: 'GET', url: viewURL }],
    expectedResult: { not_saved: { columns: ['record_id'] }, record_preview: { columns: [nameID] } },
    isError: true,
  },
  {
    name: 'update_view fails when the API kept the view private',
    tool: crmUpdateViewTool,
    args: { view_id: 'view-1', object: 'companies', is_private: false },
    responses: [savedView({ visibility: 'private' }), savedView({ visibility: 'private' })],
    expectedRequests: [
      { method: 'PATCH', url: viewURL, body: { is_private: false, visibility: 'workspace' } },
      { method: 'GET', url: viewURL },
    ],
    expectedResult: { not_saved: { visibility: 'workspace' }, record_preview: { is_private: true } },
    isError: true,
  },
  {
    name: 'update_view names what it saved when the columns are then rejected',
    tool: crmUpdateViewTool,
    args: { view_id: 'view-1', object: 'companies', name: 'Renamed', columns: ['standard:missing'] },
    responses: [
      savedView({ title: 'Renamed' }),
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Column field not found for view target',
            details: { field_ids: ['standard:missing'] },
          },
          meta: {},
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    ],
    expectedRequests: [
      { method: 'PATCH', url: viewURL, body: { name: 'Renamed', title: 'Renamed' } },
      putColumns(['standard:missing']),
    ],
    expectedResult: { view_id: 'view-1', saved: ['name, view type or visibility'] },
    isError: true,
  },
  {
    name: 'create_view reports the created view when its filters are rejected',
    tool: crmCreateViewTool,
    args: { object: 'deals', name: 'Open deals', filters: [{ field: 'standard:missing', value: 'x' }] },
    responses: [createdView(), rejected()],
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
    async ({ tool, args, responses, expectedRequests, expectedResult, expectedText, isError }) => {
      expect(validateToolArguments({ mcpTool: tool, args })).toBeUndefined();

      const { requests, result } = await sendThroughSDK({ tool, args, responses });

      expect(requests).toEqual(expectedRequests);
      expect(result.isError ?? false).toBe(isError ?? false);
      expect(result.structuredContent).toMatchObject(expectedResult);
      if (expectedText) {
        expect(JSON.stringify(result.content)).toContain(expectedText);
      }
    },
  );

  it.each([
    { name: 'empty columns', args: { columns: [] } },
    { name: 'form_data, which no route reads', args: { name: 'Renamed', form_data: { columns: [nameID] } } },
    { name: 'nothing to update', args: {} },
    { name: 'a blank name beside a real change', args: { name: '  ', columns: [nameID] } },
  ])('update_view fails without a request for $name', async ({ args }) => {
    const { requests, result } = await sendThroughSDK({
      tool: crmUpdateViewTool,
      args: { view_id: 'view-1', object: 'companies', ...args },
    });

    expect(requests).toEqual([]);
    expect(result.isError).toBe(true);
  });

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
