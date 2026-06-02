import * as crmTools from '../src/crm-tools';
import { crmCreateCompanyTool, crmDeleteCompanyTool, crmListCompaniesTool } from '../src/crm-tools';
import { McpRequestContext } from '../src/types';

describe('integration record routing tools', () => {
  it('list_companies forwards generic integration read arguments', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'companies',
      data: [{ external_id: '001000000000001AAA', name: 'Acme' }],
      count: 1,
      page: 1,
      total: 1,
      scope: 'integration',
      provider: 'salesforce',
      channel_id: 'channel-1',
      source_of_truth: 'salesforce',
      message: 'OK',
    });
    const reqContext = {
      client: { post, public: { companies: { list: jest.fn() } } },
    } as unknown as McpRequestContext;

    const result = await crmListCompaniesTool.handler({
      reqContext,
      args: {
        scope: 'integration',
        provider: 'salesforce',
        channel_id: 'channel-1',
        external_object_type: 'Account',
        limit: 5,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/records/query', {
      body: {
        object_type: 'companies',
        scope: 'integration',
        provider: 'salesforce',
        channel_id: 'channel-1',
        external_object_type: 'Account',
        page: 1,
        limit: 5,
        select: ['id', 'name', 'url', 'phone_number', 'updated_at'],
      },
    });
    expect(result.structuredContent).toMatchObject({
      scope: 'integration',
      provider: 'salesforce',
      channel_id: 'channel-1',
      source_of_truth: 'salesforce',
    });
  });

  it('create_company forwards generic target arguments', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      external_id: '001000000000002AAA',
      target: 'integration',
      provider: 'salesforce',
      channel_id: 'channel-1',
    });
    const reqContext = {
      client: { public: { companies: { create } } },
    } as unknown as McpRequestContext;

    await crmCreateCompanyTool.handler({
      reqContext,
      args: {
        target: 'integration',
        provider: 'salesforce',
        channel_id: 'channel-1',
        operation: 'upsert',
        dry_run: true,
        name: 'Acme',
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        target: 'integration',
        provider: 'salesforce',
        channel_id: 'channel-1',
        operation: 'upsert',
        dry_run: true,
        name: 'Acme',
      },
      undefined,
    );
  });

  it('delete_company forwards dry_run governance arguments', async () => {
    const deleteCompany = jest.fn().mockResolvedValue({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      provider: 'salesforce',
      unavailable_reason: undefined,
    });
    const reqContext = {
      client: { public: { companies: { delete: deleteCompany } } },
    } as unknown as McpRequestContext;

    await crmDeleteCompanyTool.handler({
      reqContext,
      args: {
        company_id: '001000000000003AAA',
        target: 'integration',
        provider: 'salesforce',
        channel_id: 'channel-1',
        operation: 'archive',
        dry_run: true,
      },
    });

    expect(deleteCompany).toHaveBeenCalledWith(
      '001000000000003AAA',
      {
        target: 'integration',
        provider: 'salesforce',
        channel_id: 'channel-1',
        operation: 'archive',
        dry_run: true,
      },
      undefined,
    );
  });

  it('does not add provider-specific company tool names', () => {
    const toolNames = Object.values(crmTools)
      .map((candidate) => {
        if (candidate && typeof candidate === 'object' && 'tool' in candidate) {
          return (candidate as { tool?: { name?: string } }).tool?.name;
        }
        return undefined;
      })
      .filter(Boolean);

    expect(toolNames).not.toContain('list_companies_salesforce');
    expect(toolNames).not.toContain('list_companies_hubspot');
    expect(toolNames).not.toContain('create_salesforce_company');
  });
});
