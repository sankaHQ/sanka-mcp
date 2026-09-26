import {
  crmCapturePipelineSnapshotTool,
  crmComparePipelineSnapshotsTool,
  crmCreateDealTool,
  crmDeleteDealTool,
  crmGetDealTool,
  crmGetPipelineSnapshotBatchTool,
  crmListDealPipelinesTool,
  crmListDealsTool,
  crmListPipelineSnapshotBatchesTool,
  crmSyncPipelineSnapshotHubSpotPropertiesTool,
  crmUpdateDealTool,
} from '../../../packages/mcp-server/src/crm-tools';
import {
  describeV2Requests,
  firstTextContent,
  oauthContext,
  sendThroughSDK,
  type V2RequestCase,
} from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'gets one deal when authentication is present',
    tool: crmGetDealTool,
    args: { case_id: 'deal-1', external_id: 'EXT-1', language: 'en' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/deals/deal-1?external_id=EXT-1',
        headers: { 'accept-language': 'en' },
      },
    ],
  },
  {
    name: 'creates a Sanka deal for a company through the public deals route in the given workspace',
    tool: crmCreateDealTool,
    args: {
      external_id: 'DEAL-1',
      name: 'Acme renewal',
      case_status: 'opportunities',
      company_id: 'company-1',
      line_items: [{ item_name: 'Implementation', quantity: 2, unit_price: 150 }],
      workspace_id: 'workspace-1',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/deals?workspace_id=workspace-1',
        body: {
          properties: {
            name: 'Acme renewal',
            case_status: 'opportunities',
            company_id: 'company-1',
            external_id: 'DEAL-1',
            line_items: [{ item_name: 'Implementation', quantity: 2, unit_price: 150 }],
          },
        },
      },
    ],
  },
  {
    name: 'passes integration mutation arguments through create_deal',
    tool: crmCreateDealTool,
    args: {
      target: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      external_object_type: 'deals',
      operation: 'create',
      dry_run: true,
      name: 'New Signup: Verified Org',
      case_status: 'appointmentscheduled',
      custom_fields: { source: 'signup' },
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/deals',
        body: {
          channel_id: 'channel-1',
          external_object_type: 'deals',
          name: 'New Signup: Verified Org',
          operation: 'create',
          provider: 'hubspot',
          target: 'integration',
          dry_run: true,
          case_status: 'appointmentscheduled',
          custom_fields: { source: 'signup' },
        },
      },
    ],
  },
  {
    name: "updates a Sanka deal's contact by lookup external id through the public deals route",
    tool: crmUpdateDealTool,
    args: {
      case_id: 'deal-1',
      lookup_external_id: 'DEAL-1',
      contact_external_id: 'CONT-1',
      workspace_id: 'workspace-1',
    },
    expectedRequests: [
      {
        method: 'PUT',
        url: 'http://localhost:5000/api/v2/public/deals/deal-1?external_id=DEAL-1&workspace_id=workspace-1',
        body: { properties: { contact_external_id: 'CONT-1' } },
      },
    ],
  },
  {
    name: 'deletes a deal',
    tool: crmDeleteDealTool,
    args: {
      case_id: 'deal-1',
      external_id: 'DEAL-1',
    },
    expectedRequests: [
      { method: 'DELETE', url: 'http://localhost:5000/api/v2/deals/deal-1?external_id=DEAL-1' },
    ],
  },
  {
    name: 'passes integration delete safety arguments through delete_deal',
    tool: crmDeleteDealTool,
    args: {
      case_id: '21596739435',
      target: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      external_object_type: 'deals',
      dry_run: true,
    },
    expectedRequests: [
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/deals/21596739435?channel_id=channel-1&dry_run=true&external_object_type=deals&provider=hubspot&target=integration',
      },
    ],
  },
];

describe('CRM deal and pipeline tools', () => {
  it('lists deals with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'deal-1',
        deal_id: 101,
        name: 'Acme renewal',
        stage_label: 'Negotiation',
        pipeline_name: 'Sales',
      },
      {
        id: 'deal-2',
        deal_id: 102,
        name: 'Globex POC',
        stage_label: 'Discovery',
        pipeline_name: 'Sales',
      },
      {
        id: 'deal-3',
        deal_id: 103,
        name: 'Initech upsell',
        stage_label: 'Proposal',
        pipeline_name: 'Sales',
      },
    ]);

    const result = await crmListDealsTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, language: 'en', workspace_id: 'workspace-1' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 deals.',
      permission: undefined,
      results: [
        {
          id: 'deal-1',
          deal_id: 101,
          name: 'Acme renewal',
          stage_label: 'Negotiation',
          pipeline_name: 'Sales',
        },
        {
          id: 'deal-2',
          deal_id: 102,
          name: 'Globex POC',
          stage_label: 'Discovery',
          pipeline_name: 'Sales',
        },
      ],
    });
  });

  it('routes integration list_deals through query_records', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'deals',
      scope: 'integration',
      provider: 'salesforce',
      channel_id: 'channel-1',
      count: 1,
      data: [
        {
          id: '006000000000001AAA',
          name: 'Enterprise Renewal',
          amount: 100000,
          case_status: 'Proposal',
        },
      ],
      message: 'OK',
      page: 1,
      total: 7,
    });
    const list = jest.fn();

    const result = await crmListDealsTool.handler({
      reqContext: {
        client: {
          post,
          public: {
            deals: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        scope: 'integration',
        provider: 'salesforce',
        channel_id: 'channel-1',
        external_object_type: 'opportunity',
        search: 'Renewal',
        filters: [
          { field: 'stage', operator: 'equals', value: 'Closed Won' },
          { field: 'closedate', operator: 'greater_than_equal', value: '2026-05-18' },
        ],
        limit: 5,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/query', {
      body: {
        object_type: 'deals',
        scope: 'integration',
        provider: 'salesforce',
        channel_id: 'channel-1',
        external_object_type: 'opportunity',
        filters: [
          { field: 'stage', operator: 'equals', value: 'Closed Won' },
          { field: 'closedate', operator: 'greater_than_equal', value: '2026-05-18' },
        ],
        search: 'Renewal',
        page: 1,
        limit: 5,
        select: ['id', 'name', 'amount', 'case_status', 'closed_at', 'updated_at'],
      },
    });
    expect(list).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      scope: 'integration',
      provider: 'salesforce',
      channel_id: 'channel-1',
      total: 7,
      results: [
        {
          id: '006000000000001AAA',
          name: 'Enterprise Renewal',
          amount: 100000,
          case_status: 'Proposal',
        },
      ],
    });
  });

  it('lists deal pipelines when authentication is present', async () => {
    const listPipelines = jest.fn().mockResolvedValue([
      {
        id: 'pipeline-1',
        name: 'Sales',
        internal_name: 'sales',
        is_default: true,
        order: 1,
        stages: [
          { id: 'stage-1', name: 'Discovery', internal_value: 'discovery', order: 1 },
          { id: 'stage-2', name: 'Negotiation', internal_value: 'negotiation', order: 2 },
        ],
      },
    ]);

    const result = await crmListDealPipelinesTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { listPipelines },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { workspace_id: 'workspace-1' },
    });

    expect(listPipelines).toHaveBeenCalledWith({ workspace_id: 'workspace-1' }, undefined);
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'Returned 1 deal pipelines.',
      permission: undefined,
      results: [
        {
          id: 'pipeline-1',
          name: 'Sales',
          internal_name: 'sales',
          is_default: true,
          order: 1,
          stages: [
            { id: 'stage-1', name: 'Discovery', internal_value: 'discovery', order: 1 },
            { id: 'stage-2', name: 'Negotiation', internal_value: 'negotiation', order: 2 },
          ],
        },
      ],
    });
  });

  it('captures a HubSpot pipeline snapshot through the V2 endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        batch_id: 'batch-1',
        source_system: 'hubspot',
        channel_id: 'channel-1',
        deal_count: 30,
      },
    });

    const result = await crmCapturePipelineSnapshotTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        source_system: 'hubspot',
        channel_id: 'channel-1',
        limit: 30,
        search: 'AveJapan',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/pipeline-snapshots/hubspot/capture', {
      body: {
        channel_id: 'channel-1',
        search: 'AveJapan',
        limit: 30,
      },
    });
    expect(result.isError).toBeUndefined();
    expect(firstTextContent(result)).toContain('batch-1');
    expect(result.structuredContent).toMatchObject({
      success: true,
      data: {
        batch_id: 'batch-1',
        source_system: 'hubspot',
      },
    });
  });

  it('lists pipeline snapshot batches with filters', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: {
        data: [
          {
            batch_id: 'batch-1',
            trigger: 'hubspot_manual',
            deal_count: 30,
            captured_at: '2026-06-17T00:00:00Z',
          },
        ],
        page: 2,
        limit: 10,
        total: 21,
      },
    });

    const result = await crmListPipelineSnapshotBatchesTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        page: 2,
        limit: 10,
        source_system: 'hubspot',
        pipeline_id: 'pipeline-1',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/pipeline-snapshots/batches', {
      query: {
        page: 2,
        limit: 10,
        pipeline_id: 'pipeline-1',
        source_system: 'hubspot',
      },
    });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      page: 2,
      total: 21,
      results: [
        {
          batch_id: 'batch-1',
          trigger: 'hubspot_manual',
        },
      ],
    });
  });

  it('loads and compares pipeline snapshots', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: {
        batch: { batch_id: 'batch-2', deal_count: 2 },
        deals: [{ deal_name: 'Renewal A' }, { deal_name: 'Renewal B' }],
      },
    });
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        from_batch: { batch_id: 'batch-1' },
        to_batch: { batch_id: 'batch-2' },
        totals: {
          amount_delta_cents: -100000,
          weighted_delta_cents: -25000,
        },
        per_deal_diff: [{ deal_name: 'Renewal A', change: 'changed' }],
      },
    });

    const detailResult = await crmGetPipelineSnapshotBatchTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        batch_id: 'batch-2',
        pipeline_id: 'pipeline-1',
      },
    });

    const compareResult = await crmComparePipelineSnapshotsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        from_batch_id: 'batch-1',
        to_batch_id: 'batch-2',
        source_system: 'hubspot',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/pipeline-snapshots/batches/batch-2', {
      query: { pipeline_id: 'pipeline-1' },
    });
    expect(post).toHaveBeenCalledWith('/api/v2/pipeline-snapshots/compare', {
      body: {
        from_batch_id: 'batch-1',
        to_batch_id: 'batch-2',
        source_system: 'hubspot',
      },
    });
    expect(firstTextContent(detailResult)).toContain('batch-2');
    expect(firstTextContent(compareResult)).toContain('amount delta -100000 cents');
  });

  it('requires confirm before writing pipeline snapshot fields to HubSpot', async () => {
    const post = jest.fn();

    const blockedResult = await crmSyncPipelineSnapshotHubSpotPropertiesTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        channel_id: 'channel-1',
        dry_run: false,
      },
    });

    expect(blockedResult.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();

    post.mockResolvedValue({
      success: true,
      data: {
        dry_run: true,
        attempted: 2,
        succeeded: 0,
        failed: 0,
        records: [{ external_id: '123', status: 'planned' }],
      },
    });

    const dryRunResult = await crmSyncPipelineSnapshotHubSpotPropertiesTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        channel_id: 'channel-1',
        from_batch_id: 'batch-1',
        to_batch_id: 'batch-2',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/pipeline-snapshots/hubspot/sync-properties', {
      body: {
        channel_id: 'channel-1',
        from_batch_id: 'batch-1',
        to_batch_id: 'batch-2',
        limit: 500,
        offset: 0,
        dry_run: true,
        confirm: false,
      },
    });
    expect(firstTextContent(dryRunResult)).toContain('Previewed HubSpot snapshot property updates');
  });

  it('rejects malformed list_deals filters instead of listing unfiltered deals', async () => {
    const post = jest.fn();
    const list = jest.fn();

    const result = await crmListDealsTool.handler({
      reqContext: {
        client: { post, public: { deals: { list } } } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filters: [{ field: 42 }],
      },
    });

    expect(post).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain('filters[0] is missing a non-empty string `field`');
  });

  it.each([
    [
      "update_deal changing a Sanka deal's external_id",
      crmUpdateDealTool,
      { case_id: 'deal-1', external_id: 'DEAL-2' },
    ],
    [
      'create_deal pinning workspace_id on an integration target',
      crmCreateDealTool,
      { target: 'integration', provider: 'hubspot', name: 'Remote deal', workspace_id: 'workspace-1' },
    ],
  ])('refuses %s before sending a request', async (_case, tool, args) => {
    const { requests, result } = await sendThroughSDK({ tool, args });

    expect(result.isError).toBe(true);
    expect(requests).toEqual([]);
  });

  describeV2Requests(v2Requests);
});
