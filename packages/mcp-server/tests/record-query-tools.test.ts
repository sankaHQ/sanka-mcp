import { crmAggregateRecordsTool, crmQueryRecordsTool } from '../src/crm-tools';
import { McpRequestContext } from '../src/types';

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

    expect(post).toHaveBeenCalledWith('/v1/public/records/aggregate', {
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

    expect(post).toHaveBeenCalledWith('/v1/public/records/query', {
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
});
