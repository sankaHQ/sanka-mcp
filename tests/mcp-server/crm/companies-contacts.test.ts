import {
  crmCreateCompanyTool,
  crmCreateContactTool,
  crmCreatePropertyTool,
  crmDeleteCompanyTool,
  crmDeleteContactTool,
  crmGetCompanyPriceTableTool,
  crmGetCompanyTool,
  crmGetContactTool,
  crmListCompaniesTool,
  crmListContactsTool,
  crmListPropertiesTool,
  crmProspectCompaniesTool,
  crmScoreRecordTool,
  crmUpdateCompanyPriceTableItemTool,
  crmUpdateCompanyTool,
  crmUpdateContactTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { describeV2Requests, oauthContext, type V2RequestCase } from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'lists companies with structured content when authentication is present',
    tool: crmListCompaniesTool,
    args: { limit: 5, page: 2, search: 'Acme', language: 'en' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/companies?page=2&search=Acme&limit=5',
        headers: { 'accept-language': 'en' },
      },
    ],
  },
  {
    name: 'gets one company when authentication is present',
    tool: crmGetCompanyTool,
    args: { company_id: 'company-1', external_id: 'COMP-1' },
    expectedRequests: [
      { method: 'GET', url: 'http://localhost:5000/api/v2/companies/company-1?external_id=COMP-1' },
    ],
  },
  {
    name: 'creates a company',
    tool: crmCreateCompanyTool,
    args: {
      external_id: 'COMP-1',
      name: 'Acme',
      email: 'team@acme.com',
      billing_cycle: 'end',
      payment_cycle: 'nmonth_end',
      allowed_in_store: false,
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/companies',
        body: {
          properties: {
            billing_cycle: 'end',
            email: 'team@acme.com',
            external_id: 'COMP-1',
            name: 'Acme',
            payment_cycle: 'nmonth_end',
            allowed_in_store: false,
          },
        },
      },
    ],
  },
  {
    name: 'passes integration mutation arguments through create_company',
    tool: crmCreateCompanyTool,
    args: {
      target: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      external_object_type: 'companies',
      operation: 'create',
      dry_run: true,
      name: 'Acme',
      custom_fields: { segment: 'enterprise' },
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/companies',
        body: {
          channel_id: 'channel-1',
          external_object_type: 'companies',
          name: 'Acme',
          operation: 'create',
          provider: 'hubspot',
          target: 'integration',
          dry_run: true,
          custom_fields: { segment: 'enterprise' },
        },
      },
    ],
  },
  {
    name: 'updates a company',
    tool: crmUpdateCompanyTool,
    args: {
      company_id: 'company-1',
      phone_number: '+1-555-0100',
      billing_cycle: 'end',
      payment_cycle: 'net_30',
      url: 'https://acme.com',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/companies/company-1',
        body: {
          properties: {
            billing_cycle: 'end',
            payment_cycle: 'net_30',
            phone_number: '+1-555-0100',
            url: 'https://acme.com',
          },
        },
      },
    ],
  },
  {
    name: 'deletes a company',
    tool: crmDeleteCompanyTool,
    args: {
      company_id: 'company-1',
      external_id: 'COMP-1',
    },
    expectedRequests: [
      { method: 'DELETE', url: 'http://localhost:5000/api/v2/companies/company-1?external_id=COMP-1' },
    ],
  },
  {
    name: 'passes integration delete safety arguments through delete_company',
    tool: crmDeleteCompanyTool,
    args: {
      company_id: 'hs-1',
      target: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      external_id: 'hs-1',
      dry_run: true,
    },
    expectedRequests: [
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/companies/hs-1?channel_id=channel-1&dry_run=true&external_id=hs-1&provider=hubspot&target=integration',
      },
    ],
  },
  {
    name: 'lists contacts when authentication is present',
    tool: crmListContactsTool,
    args: { limit: 20 },
    expectedRequests: [{ method: 'GET', url: 'http://localhost:5000/api/v2/contacts?page=1&limit=20' }],
  },
  {
    name: 'gets one contact when authentication is present',
    tool: crmGetContactTool,
    args: { contact_id: 'contact-1', external_id: 'CONT-1' },
    expectedRequests: [
      { method: 'GET', url: 'http://localhost:5000/api/v2/contacts/contact-1?external_id=CONT-1' },
    ],
  },
  {
    name: 'creates a contact',
    tool: crmCreateContactTool,
    args: {
      external_id: 'CONT-1',
      name: 'Jane',
      last_name: 'Doe',
      allowed_in_store: true,
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/contacts',
        body: {
          properties: { external_id: 'CONT-1', last_name: 'Doe', name: 'Jane', allowed_in_store: true },
        },
      },
    ],
  },
  {
    name: 'passes integration mutation arguments through create_contact',
    tool: crmCreateContactTool,
    args: {
      target: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      external_object_type: 'contacts',
      operation: 'create',
      dry_run: true,
      name: 'Jane',
      email: 'jane@example.com',
      custom_fields: { lifecycle_stage: 'lead' },
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/contacts',
        body: {
          channel_id: 'channel-1',
          email: 'jane@example.com',
          external_object_type: 'contacts',
          name: 'Jane',
          operation: 'create',
          provider: 'hubspot',
          target: 'integration',
          dry_run: true,
          custom_fields: { lifecycle_stage: 'lead' },
        },
      },
    ],
  },
  {
    name: 'updates a contact',
    tool: crmUpdateContactTool,
    args: {
      contact_id: 'contact-1',
      email: 'jane@acme.com',
      company: 'Acme',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/contacts/contact-1',
        body: { properties: { company: 'Acme', email: 'jane@acme.com' } },
      },
    ],
  },
  {
    name: 'deletes a contact',
    tool: crmDeleteContactTool,
    args: {
      contact_id: 'contact-1',
      external_id: 'CONT-1',
    },
    expectedRequests: [
      { method: 'DELETE', url: 'http://localhost:5000/api/v2/contacts/contact-1?external_id=CONT-1' },
    ],
  },
  {
    name: 'passes integration delete safety arguments through delete_contact',
    tool: crmDeleteContactTool,
    args: {
      contact_id: 'hs-contact-1',
      target: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      external_object_type: 'contacts',
      dry_run: true,
    },
    expectedRequests: [
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/contacts/hs-contact-1?channel_id=channel-1&dry_run=true&external_object_type=contacts&provider=hubspot&target=integration',
      },
    ],
  },
  {
    name: 'prospects companies when authentication is present',
    tool: crmProspectCompaniesTool,
    args: {
      query: 'manufacturing companies in Tokyo',
      location: 'Tokyo',
      industry: 'Manufacturing',
      limit: 5,
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/prospect/companies',
        body: {
          query: 'manufacturing companies in Tokyo',
          location: 'Tokyo',
          industry: 'Manufacturing',
          limit: 5,
        },
      },
    ],
  },
  {
    name: 'scores a record when authentication is present',
    tool: crmScoreRecordTool,
    args: {
      object_type: 'company',
      record_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
      score_model_id: 'model-1',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/score',
        body: {
          object_type: 'company',
          record_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
          score_model_id: 'model-1',
        },
      },
    ],
  },
];

describe('CRM company and contact tools', () => {
  it('does not add provider-specific company tool names', async () => {
    const crmTools = await import('../../../packages/mcp-server/src/crm-tools');
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

  it('documents Sanka company cycle fields as standard company inputs', () => {
    const createPropertySchema = crmCreatePropertyTool.tool.inputSchema as any;
    const createCompanySchema = crmCreateCompanyTool.tool.inputSchema as any;
    const updateCompanySchema = crmUpdateCompanyTool.tool.inputSchema as any;

    expect(createCompanySchema.properties.billing_cycle.description).toContain('month-end closing');
    expect(createCompanySchema.properties.payment_cycle.description).toContain('nmonth_end');
    expect(updateCompanySchema.properties.billing_cycle.description).toContain('month-end closing');
    expect(updateCompanySchema.properties.payment_cycle.description).toContain('nmonth_end');
    expect(updateCompanySchema.properties.custom_fields.description).toContain(
      'Company billing_cycle and payment_cycle are standard company fields',
    );
    expect(createPropertySchema.properties.type.description).toContain('not by creating a custom property');
    expect(createPropertySchema.properties.custom_object_slug.description).toContain(
      'custom object slug/internal key',
    );
    expect(createPropertySchema.properties.custom_object.description).toContain(
      'Alias for custom_object_slug',
    );
    expect(createPropertySchema.properties.calculation_formula.description).toContain(
      'HubSpot calculation formula',
    );
    expect(crmCreatePropertyTool.tool.description).toContain(
      'Do not use this for company billing_cycle or payment_cycle',
    );
    expect(crmListPropertiesTool.tool.description).toContain('not a custom-property discovery flow');
  });

  it('routes integration list_companies through query_records', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'companies',
      scope: 'integration',
      provider: 'salesforce',
      channel_id: 'channel-1',
      count: 1,
      data: [{ id: 'sf-1', name: 'Acme', phone_number: '(415) 555-0100' }],
      message: 'OK',
      page: 1,
      total: 77,
    });
    const list = jest.fn();

    const result = await crmListCompaniesTool.handler({
      reqContext: {
        client: {
          post,
          public: {
            companies: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        scope: 'integration',
        provider: 'salesforce',
        channel_id: 'channel-1',
        limit: 5,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/query', {
      body: {
        object_type: 'companies',
        scope: 'integration',
        provider: 'salesforce',
        channel_id: 'channel-1',
        page: 1,
        limit: 5,
        select: ['id', 'name', 'url', 'phone_number', 'updated_at'],
      },
    });
    expect(list).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      scope: 'integration',
      provider: 'salesforce',
      channel_id: 'channel-1',
      total: 77,
      results: [{ id: 'sf-1', name: 'Acme', phone_number: '(415) 555-0100' }],
    });
  });

  it('passes integration dedupe arguments through update_company', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      provider: 'hubspot',
      operation: 'dedupe_apply',
      dry_run: true,
      external_id: 'primary',
      remote: {
        primary_external_id: 'primary',
        secondary_external_ids: ['dupe-1', 'dupe-2'],
      },
    });

    const result = await crmUpdateCompanyTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'primary',
        target: 'integration',
        provider: 'hubspot',
        operation: 'dedupe_apply',
        primary_external_id: 'primary',
        secondary_external_ids: ['dupe-1', 'dupe-2'],
        dry_run: true,
      },
    });

    expect(update).toHaveBeenCalledWith(
      'primary',
      {
        target: 'integration',
        provider: 'hubspot',
        operation: 'dedupe_apply',
        primary_external_id: 'primary',
        secondary_external_ids: ['dupe-1', 'dupe-2'],
        dry_run: true,
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      ok: true,
      status: 'dry_run',
      operation: 'dedupe_apply',
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: 'Company hubspot dedupe preview prepared: primary=primary merge_count=2.',
      }),
    );
  });

  it('gets company price table and maps search to q', async () => {
    const getPriceTable = jest.fn().mockResolvedValue({
      field_id: 'field-1',
      mode: 'company',
      company_price_percentage: 82,
      items: [
        {
          item_id: 'item-1',
          item_name: 'Widget',
          currency: 'USD',
          default_price: 300,
          discount_price: 246,
          discount_rate: 82,
          has_override: false,
        },
      ],
      pagination: {
        page: 1,
        page_size: 30,
        total_count: 1,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      },
      message: 'OK',
    });

    const result = await crmGetCompanyPriceTableTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { getPriceTable },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'company-1',
        field_ref: 'price-table',
        search: 'Widget',
      },
    });

    expect(getPriceTable).toHaveBeenCalledWith(
      'company-1',
      {
        field_ref: 'price-table',
        q: 'Widget',
        page: 1,
        page_size: 30,
      },
      undefined,
    );
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Loaded company price table for 1 items. Widget: default 300 USD, company price 246 USD.',
      },
    ]);
  });

  it('updates a company price table item override with clear_override', async () => {
    const updatePriceTableItem = jest.fn().mockResolvedValue({
      data: {
        item_id: 'item-1',
        deleted: true,
      },
      message: 'OK',
      ctx_id: 'ctx-1',
    });

    const result = await crmUpdateCompanyPriceTableItemTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { updatePriceTableItem },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'company-1',
        item_id: 'item-1',
        clear_override: true,
      },
    });

    expect(updatePriceTableItem).toHaveBeenCalledWith('company-1', 'item-1', {}, undefined);
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Deleted company price-table override for item item-1.',
      },
    ]);
  });

  it('clamps list_companies limit to the schema bounds', async () => {
    const list = jest.fn().mockResolvedValue({
      count: 0,
      data: [],
      message: 'ok',
      page: 1,
      total: 0,
      permission: 'edit',
    });
    const reqContext = {
      client: {
        public: {
          companies: { list },
        },
      } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    await crmListCompaniesTool.handler({ reqContext, args: { limit: 500 } });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }), undefined);

    list.mockClear();
    await crmListCompaniesTool.handler({ reqContext, args: { limit: 0 } });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }), undefined);
  });

  describeV2Requests(v2Requests);
});
