import {
  crmCreateReportTool,
  crmCreateViewTool,
  crmListReportsTool,
  crmListViewsTool,
  crmUpdateReportTool,
} from '../../packages/mcp-server/src/crm-tools';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

describe('saved view and report tools', () => {
  it('create_view posts a generic saved-view request to the public views endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: { view_id: 'view-1' },
      message: 'OK',
      ctx_id: 'ctx-1',
    });
    const reqContext = {
      client: { post },
    } as unknown as McpRequestContext;

    const result = await crmCreateViewTool.handler({
      reqContext,
      args: {
        object: 'orders',
        name: 'Orders Needing Invoice',
        view_type: 'list',
        columns: ['order_id', 'status'],
        filters: [{ field: 'status', operator: 'equals', value: 'draft' }],
        pagination: 50,
        language: 'en',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/views', {
      body: {
        object: 'orders',
        object_type: 'orders',
        name: 'Orders Needing Invoice',
        title: 'Orders Needing Invoice',
        view_type: 'list',
        mode: 'table',
        columns: ['order_id', 'status'],
        column_field_ids: ['order_id', 'status'],
        pagination: 50,
        filters: [{ field: 'status', operator: 'equals', value: 'draft' }],
      },
      query: {
        'Accept-Language': 'en',
      },
    });
    expect(result.structuredContent).toMatchObject({
      data: { view_id: 'view-1' },
      message: 'OK',
    });
  });

  it('list_views requests saved views for any supported object', async () => {
    const get = jest.fn().mockResolvedValue({
      data: [{ id: 'view-1', label: 'Orders Needing Invoice' }],
      message: 'OK',
    });
    const reqContext = {
      client: { get },
    } as unknown as McpRequestContext;

    const result = await crmListViewsTool.handler({
      reqContext,
      args: {
        object: 'orders',
        workspace_id: 'workspace-1',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/views', {
      query: {
        object: 'orders',
        workspace_id: 'workspace-1',
      },
    });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      results: [{ id: 'view-1', label: 'Orders Needing Invoice' }],
    });
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
