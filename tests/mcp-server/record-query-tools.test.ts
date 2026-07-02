import { crmAggregateRecordsTool, crmQueryRecordsTool } from '../../packages/mcp-server/src/crm-tools';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

describe('record query tools', () => {
  it('aggregate_records calls the server-side aggregate endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'companies',
      metrics: { count: 104 },
      groups: [],
      message: 'OK',
    });
    const reqContext = {
      client: { post },
    } as unknown as McpRequestContext;

    const result = await crmAggregateRecordsTool.handler({
      reqContext,
      args: {
        object_type: 'companies',
        filters: [{ field: 'address', operator: 'is_empty' }],
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/aggregate', {
      body: {
        object_type: 'companies',
        filters: [{ field: 'address', operator: 'is_empty' }],
        metrics: ['count'],
        limit: 25,
      },
    });
    expect(result.structuredContent).toMatchObject({
      object_type: 'companies',
      metrics: { count: 104 },
    });
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: 'aggregate_records count for companies: 104',
    });
  });

  it('aggregate_records forwards integration routing arguments', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'companies',
      scope: 'integration',
      provider: 'salesforce',
      channel_id: 'channel-1',
      metrics: { count: 12 },
      groups: [],
      message: 'OK',
    });
    const reqContext = {
      client: { post },
    } as unknown as McpRequestContext;

    const result = await crmAggregateRecordsTool.handler({
      reqContext,
      args: {
        object_type: 'companies',
        scope: 'integration',
        provider: 'salesforce',
        channel_id: 'channel-1',
        external_object_type: 'Account',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/aggregate', {
      body: {
        object_type: 'companies',
        scope: 'integration',
        provider: 'salesforce',
        channel_id: 'channel-1',
        external_object_type: 'Account',
        metrics: ['count'],
        limit: 25,
      },
    });
    expect(result.structuredContent).toMatchObject({
      scope: 'integration',
      provider: 'salesforce',
      channel_id: 'channel-1',
      metrics: { count: 12 },
    });
  });

  it('query_records projects only requested fields', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'companies',
      data: [{ id: 'company-1', name: 'Acme', address: '' }],
      page: 1,
      limit: 10,
      count: 1,
      total: 1,
      has_next: false,
      message: 'OK',
    });
    const reqContext = {
      client: { post },
    } as unknown as McpRequestContext;

    const result = await crmQueryRecordsTool.handler({
      reqContext,
      args: {
        object_type: 'companies',
        select: ['id', 'name', 'address'],
        filters: [{ field: 'address', operator: 'is_empty' }],
        limit: 10,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/query', {
      body: {
        object_type: 'companies',
        select: ['id', 'name', 'address'],
        filters: [{ field: 'address', operator: 'is_empty' }],
        page: 1,
        limit: 10,
      },
    });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      total: 1,
      results: [{ id: 'company-1', name: 'Acme', address: '' }],
    });
  });

  it('query_records normalizes the V2 envelope into the MCP result shape', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: [{ record_id: 'company-1', label: 'Acme', values: { 'standard:name': 'Acme' } }],
      meta: { ctx_id: 'ctx-query', pagination: { page: 2, page_size: 5, total: 7 } },
    });
    const reqContext = {
      client: { post },
    } as unknown as McpRequestContext;

    const result = await crmQueryRecordsTool.handler({
      reqContext,
      args: {
        object_type: 'companies',
        page: 2,
        limit: 5,
      },
    });

    expect(result.structuredContent).toMatchObject({
      object_type: 'companies',
      scope: 'sanka',
      count: 1,
      total: 7,
      page: 2,
      limit: 5,
      ctx_id: 'ctx-query',
      results: [{ record_id: 'company-1', label: 'Acme' }],
    });
  });

  it('query_records forwards integration routing arguments', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'companies',
      scope: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      data: [{ id: 'hs-1', name: 'Acme' }],
      page: 1,
      limit: 10,
      count: 1,
      total: 1,
      has_next: false,
      message: 'OK',
    });
    const reqContext = {
      client: { post },
    } as unknown as McpRequestContext;

    const result = await crmQueryRecordsTool.handler({
      reqContext,
      args: {
        object_type: 'companies',
        scope: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        select: ['id', 'name'],
        limit: 10,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/query', {
      body: {
        object_type: 'companies',
        scope: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        select: ['id', 'name'],
        page: 1,
        limit: 10,
      },
    });
    expect(result.structuredContent).toMatchObject({
      scope: 'integration',
      provider: 'hubspot',
      results: [{ id: 'hs-1', name: 'Acme' }],
    });
  });

  it('aggregate_records normalizes the V2 envelope into the MCP result shape', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        metrics: { count: 17 },
        groups: [],
        message: 'OK',
      },
      meta: { ctx_id: 'ctx-aggregate' },
    });
    const reqContext = {
      client: { post },
    } as unknown as McpRequestContext;

    const result = await crmAggregateRecordsTool.handler({
      reqContext,
      args: { object_type: 'companies' },
    });

    expect(result.structuredContent).toMatchObject({
      object_type: 'companies',
      scope: 'sanka',
      metrics: { count: 17 },
      ctx_id: 'ctx-aggregate',
    });
    expect(result.content[0]).toMatchObject({
      text: 'aggregate_records count for companies: 17',
    });
  });
});
