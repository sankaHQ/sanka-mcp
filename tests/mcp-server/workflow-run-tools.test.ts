import {
  getWorkflowRunTool,
  previewWorkflowTool,
  resolveRecordTool,
  startWorkflowTool,
} from '../../packages/mcp-server/src/workflow-run-tools';
import { selectTools } from '../../packages/mcp-server/src/server';

const oauthContext = () => ({
  authMode: 'oauth_bearer' as const,
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: ['mcp:access'],
  },
});

describe('workflow run MCP tools', () => {
  it('registers generic workflow tools in the default toolset', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    expect(toolNames).toContain('resolve_record');
    expect(toolNames).toContain('preview_workflow');
    expect(toolNames).toContain('start_workflow');
    expect(toolNames).toContain('get_workflow_run');
  });

  it('advertises OAuth protection', () => {
    expect(resolveRecordTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(previewWorkflowTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(startWorkflowTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(getWorkflowRunTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
  });

  it('marks workflow preview as read-only', () => {
    expect(previewWorkflowTool.tool.annotations?.readOnlyHint).toBe(true);
    expect(previewWorkflowTool.tool.annotations?.destructiveHint).toBe(false);
  });

  it('advertises the V2 workflow-run endpoints in tool metadata', () => {
    expect(resolveRecordTool.metadata.httpPath).toBe('/api/v2/public/workflow-runs/resolve-record');
    expect(previewWorkflowTool.metadata.httpPath).toBe('/api/v2/public/workflow-runs/preview');
    expect(startWorkflowTool.metadata.httpPath).toBe('/api/v2/public/workflow-runs/start');
    expect(getWorkflowRunTool.metadata.httpPath).toBe('/api/v2/public/workflow-runs/{run_id}');
  });

  it('keeps order-first, handoff, accounting sync, revenue summaries, and commission reports inside generic workflow tools', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);
    const workflowTypeSchema = (previewWorkflowTool.tool.inputSchema as any).properties.workflow_type;
    const workflowTypes = workflowTypeSchema.enum as string[];
    const previewOptions = (previewWorkflowTool.tool.inputSchema as any).properties.options.properties;
    const startOptions = (startWorkflowTool.tool.inputSchema as any).properties.options.properties;

    expect(workflowTypes).toContain('deal_to_order');
    expect(workflowTypes).toContain('deal_to_subscription');
    expect(workflowTypes).toContain('estimate_to_invoice');
    expect(workflowTypes).toContain('order_to_invoice');
    expect(workflowTypes).toContain('order_to_subscription');
    expect(workflowTypes).toContain('subscription_to_invoice');
    expect(workflowTypes).toContain('order_to_purchase_order');
    expect(workflowTypes).toContain('deal_to_order_handoff');
    expect(workflowTypes).toContain('invoice_export');
    expect(workflowTypes).toContain('revenue_control_summary');
    expect(workflowTypes).toContain('sales_incentive_commission');
    expect(workflowTypes).not.toContain('deal_to_invoice');
    expect(previewOptions.allow_recreate_moneyforward_draft).toEqual({ type: 'boolean' });
    expect(startOptions.allow_recreate_moneyforward_draft).toEqual({ type: 'boolean' });
    expect((startWorkflowTool.tool.inputSchema as any).properties.language.default).toBe('en');
    expect((previewWorkflowTool.tool.inputSchema as any).properties.language.default).toBe('en');
    expect(toolNames).not.toContain('create_order_from_hubspot_deal');
    expect(toolNames).not.toContain('hubspot_deal_to_order');
    expect(toolNames).not.toContain('create_hubspot_order_draft');
    expect(toolNames).not.toContain('create_fulfillment_from_hubspot_deal');
    expect(toolNames).not.toContain('check_hubspot_deal_inventory');
    expect(toolNames).not.toContain('handoff_hubspot_deal_to_fulfillment');
    expect(toolNames).not.toContain('sync_sanka_invoice_to_freee');
    expect(toolNames).not.toContain('create_freee_invoice_draft');
    expect(toolNames).not.toContain('sync_hubspot_deals_to_freee');
    expect(toolNames).not.toContain('summarize_hubspot_revenue_control');
    expect(toolNames).not.toContain('get_hubspot_revenue_bucket');
    expect(toolNames).not.toContain('calculate_hubspot_commissions');
    expect(toolNames).not.toContain('calculate_salesforce_commissions');
    expect(toolNames).not.toContain('calculate_rep_commission');
  });

  it('allows estimate and subscription source records for billing workflows', () => {
    const sourceRecordSchema = (previewWorkflowTool.tool.inputSchema as any).properties.source_record;
    const objectTypes = sourceRecordSchema.properties.object_type.enum as string[];

    expect(objectTypes).toContain('estimate');
    expect(objectTypes).toContain('subscription');
  });

  it('resolves records through the public workflow-runs endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: { candidates: [{ record_ref: { record_id: 'deal-1' } }] },
      message: 'ok',
    });

    const result = await resolveRecordTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        query: 'A Company',
        source_system: 'hubspot',
        limit: 3,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/resolve-record', {
      body: {
        query: 'A Company',
        object_type: 'deal',
        source_system: 'hubspot',
        limit: 3,
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      candidates: [{ record_ref: { record_id: 'deal-1' } }],
    });
    expect((result.content[0] as any).text).toContain('Structured workflow data');
    expect((result.content[0] as any).text).toContain('deal-1');
  });

  it('starts deal_to_estimate workflows through the public endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        run_id: 'run-1',
        status: 'waiting_for_approval',
      },
      message: 'started',
    });

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'deal_to_estimate',
        source_record: {
          source_system: 'sanka',
          object_type: 'deal',
          record_id: 'deal-1',
        },
        idempotency_key: 'key-1',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/start', {
      body: {
        workflow_type: 'deal_to_estimate',
        source_record: {
          source_system: 'sanka',
          object_type: 'deal',
          record_id: 'deal-1',
        },
        options: {},
        idempotency_key: 'key-1',
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'run-1',
      status: 'waiting_for_approval',
    });
  });

  it('starts deal_to_order workflows through the public endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        run_id: 'run-order-1',
        status: 'completed',
        result: { order: { id: 'order-1' } },
      },
      message: 'started',
    });

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'deal_to_order',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          url: 'https://app.hubspot.com/contacts/49714315/record/0-3/46558049080',
        },
        idempotency_key: 'order-key-1',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/start', {
      body: {
        workflow_type: 'deal_to_order',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          url: 'https://app.hubspot.com/contacts/49714315/record/0-3/46558049080',
        },
        options: {},
        idempotency_key: 'order-key-1',
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'run-order-1',
      status: 'completed',
      result: { order: { id: 'order-1' } },
    });
  });

  it('starts deal_to_subscription batch workflows through the public endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        workflow_type: 'deal_to_subscription',
        mode: 'execute',
        total_created: 2,
      },
      message: 'started',
    });

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'deal_to_subscription',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          portal_id: '49714315',
        },
        options: {
          subscription_flag_property: 'sanka_subscription',
          subscription_flag_value: 'true',
        },
        idempotency_key: 'subscription-batch-key-1',
        language: 'en',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/start', {
      body: {
        workflow_type: 'deal_to_subscription',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          portal_id: '49714315',
        },
        options: {
          subscription_flag_property: 'sanka_subscription',
          subscription_flag_value: 'true',
        },
        idempotency_key: 'subscription-batch-key-1',
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      workflow_type: 'deal_to_subscription',
      mode: 'execute',
      total_created: 2,
    });
  });

  it('starts order_to_invoice workflows through the public endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        run_id: 'invoice-run-1',
        status: 'completed',
        result: {
          invoice: {
            id: 'invoice-1',
            workspace_code: '99112888',
            app_url: 'https://app.sanka.com/ja/99112888/invoices/?id=invoice-1',
          },
        },
      },
      message: 'started',
    });

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'order_to_invoice',
        source_record: {
          source_system: 'sanka',
          object_type: 'order',
          record_id: 'order-1',
        },
        options: { status: 'draft' },
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/start', {
      body: {
        workflow_type: 'order_to_invoice',
        source_record: {
          source_system: 'sanka',
          object_type: 'order',
          record_id: 'order-1',
        },
        options: { status: 'draft' },
        idempotency_key: undefined,
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'invoice-run-1',
      status: 'completed',
      result: {
        invoice: {
          id: 'invoice-1',
          workspace_code: '99112888',
          app_url: 'https://app.sanka.com/ja/99112888/invoices/?id=invoice-1',
        },
      },
    });
  });

  it('forwards explicit workflow language overrides', async () => {
    const post = jest.fn().mockResolvedValue({
      data: { run_id: 'invoice-run-ja', status: 'completed' },
      message: 'started',
    });

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'order_to_invoice',
        source_record: {
          source_system: 'sanka',
          object_type: 'order',
          record_id: 'order-1',
        },
        language: 'ja',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/start', {
      body: {
        workflow_type: 'order_to_invoice',
        source_record: {
          source_system: 'sanka',
          object_type: 'order',
          record_id: 'order-1',
        },
        options: {},
        idempotency_key: undefined,
        language: 'ja',
      },
    });
    expect(result.structuredContent?.['display_guidance']).toMatchObject({
      object_labels_ja: {
        order: '受注',
        invoice: '売上請求',
      },
      status_labels_ja: {
        draft: '下書き',
      },
    });
    expect((result.structuredContent?.['display_guidance'] as any).record_number_format).toContain(
      '売上請求番号 9',
    );
  });

  it('previews order_to_subscription workflows through the public endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        workflow_type: 'order_to_subscription',
        can_start: true,
      },
      message: 'ok',
    });

    const result = await previewWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'order_to_subscription',
        source_record: {
          source_system: 'sanka',
          object_type: 'order',
          record_id: 'order-1',
        },
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/preview', {
      body: {
        workflow_type: 'order_to_subscription',
        source_record: {
          source_system: 'sanka',
          object_type: 'order',
          record_id: 'order-1',
        },
        options: {},
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      workflow_type: 'order_to_subscription',
      can_start: true,
    });
    expect((result.content[0] as any).text).toContain('Structured workflow data');
    expect((result.content[0] as any).text).toContain('order_to_subscription');
  });

  it('starts estimate_to_invoice workflows through the public endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        run_id: 'estimate-invoice-run-1',
        status: 'completed',
        result: { invoice: { id: 'invoice-1' } },
      },
      message: 'started',
    });

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'estimate_to_invoice',
        source_record: {
          source_system: 'sanka',
          object_type: 'estimate',
          record_id: 'estimate-1',
        },
        options: { status: 'draft' },
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/start', {
      body: {
        workflow_type: 'estimate_to_invoice',
        source_record: {
          source_system: 'sanka',
          object_type: 'estimate',
          record_id: 'estimate-1',
        },
        options: { status: 'draft' },
        idempotency_key: undefined,
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'estimate-invoice-run-1',
      status: 'completed',
      result: { invoice: { id: 'invoice-1' } },
    });
  });

  it('starts subscription_to_invoice workflows through the public endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        run_id: 'subscription-invoice-run-1',
        status: 'completed',
        result: { invoice: { id: 'invoice-1' } },
      },
      message: 'started',
    });

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'subscription_to_invoice',
        source_record: {
          source_system: 'sanka',
          object_type: 'subscription',
          record_id: 'subscription-1',
        },
        options: {
          start_date: '2026-06-01',
          due_date: '2026-06-30',
          status: 'draft',
        },
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/start', {
      body: {
        workflow_type: 'subscription_to_invoice',
        source_record: {
          source_system: 'sanka',
          object_type: 'subscription',
          record_id: 'subscription-1',
        },
        options: {
          start_date: '2026-06-01',
          due_date: '2026-06-30',
          status: 'draft',
        },
        idempotency_key: undefined,
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'subscription-invoice-run-1',
      status: 'completed',
      result: { invoice: { id: 'invoice-1' } },
    });
  });

  it('starts order_to_purchase_order workflows through the public endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        run_id: 'po-run-1',
        status: 'completed',
        result: { purchase_order: { id: 'purchase-order-1' } },
      },
      message: 'started',
    });

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'order_to_purchase_order',
        source_record: {
          source_system: 'sanka',
          object_type: 'order',
          record_id: 'order-1',
        },
        options: {
          use_existing_inventory: true,
          make_association: true,
        },
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/start', {
      body: {
        workflow_type: 'order_to_purchase_order',
        source_record: {
          source_system: 'sanka',
          object_type: 'order',
          record_id: 'order-1',
        },
        options: {
          use_existing_inventory: true,
          make_association: true,
        },
        idempotency_key: undefined,
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'po-run-1',
      status: 'completed',
      result: { purchase_order: { id: 'purchase-order-1' } },
    });
  });

  it('blocks direct deal_to_invoice workflow routing before calling the API', async () => {
    const post = jest.fn();

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'deal_to_invoice',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          external_id: '46558049080',
        },
      },
    });

    expect(post).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe('text');
    expect((result.content[0] as any).text).toContain('deal_to_order');
  });

  it('previews deal_to_estimate workflows from HubSpot deal URLs', async () => {
    const previewOptions = (previewWorkflowTool.tool.inputSchema as any).properties.options.properties;
    const post = jest.fn().mockResolvedValue({
      data: {
        source_status: 'external_only',
        financials: { total_amount: 610000, line_item_count: 3 },
      },
      message: 'ok',
    });

    const result = await previewWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'deal_to_estimate',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          url: 'https://app.hubspot.com/contacts/49714315/record/0-3/46558049080',
        },
        options: {
          allow_missing_customer_create: true,
        },
      },
    });

    expect(previewOptions).toHaveProperty('allow_missing_customer_create');
    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/preview', {
      body: {
        workflow_type: 'deal_to_estimate',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          url: 'https://app.hubspot.com/contacts/49714315/record/0-3/46558049080',
        },
        options: {
          allow_missing_customer_create: true,
        },
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      source_status: 'external_only',
      financials: { total_amount: 610000, line_item_count: 3 },
    });
  });

  it('blocks direct deal_to_invoice preview routing before calling the API', async () => {
    const post = jest.fn();

    const result = await previewWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'deal_to_invoice',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          url: 'https://app.hubspot.com/contacts/49714315/record/0-3/46558049080',
        },
      },
    });

    expect(post).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe('text');
    expect((result.content[0] as any).text).toContain('deal_to_order');
  });

  it('previews HubSpot deal order handoff through the generic workflow endpoint', async () => {
    const previewOptions = (previewWorkflowTool.tool.inputSchema as any).properties.options.properties;
    const post = jest.fn().mockResolvedValue({
      data: {
        workflow_type: 'deal_to_order_handoff',
        source_system: 'hubspot',
        target_system: 'sanka',
        mode: 'preview',
        required_confirmation: true,
        would_create_order: true,
        would_create_handoff: true,
        would_update_hubspot: true,
        inventory_check_results: [{ status: 'available' }],
        delivery_lead_time_results: [{ status: 'available', lead_time_days: 5 }],
      },
      message: 'ok',
    });

    const result = await previewWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'deal_to_order_handoff',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          url: 'https://app.hubspot.com/contacts/49714315/record/0-3/46558049080',
        },
        options: {
          target_system: 'sanka',
          include_inventory_check: true,
          include_lead_time_check: true,
          requested_delivery_date: '2026-06-01',
          handoff_target: 'ops-team',
        },
        language: 'en',
      },
    });

    expect(previewWorkflowTool.tool.annotations?.readOnlyHint).toBe(true);
    expect(previewOptions).toHaveProperty('include_inventory_check');
    expect(previewOptions).toHaveProperty('include_lead_time_check');
    expect(previewOptions).toHaveProperty('handoff_target');
    expect(previewOptions).toHaveProperty('allow_duplicate_order');
    expect(previewOptions).toHaveProperty('allow_missing_customer_create');
    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/preview', {
      body: {
        workflow_type: 'deal_to_order_handoff',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          url: 'https://app.hubspot.com/contacts/49714315/record/0-3/46558049080',
        },
        options: {
          target_system: 'sanka',
          include_inventory_check: true,
          include_lead_time_check: true,
          requested_delivery_date: '2026-06-01',
          handoff_target: 'ops-team',
        },
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      workflow_type: 'deal_to_order_handoff',
      source_system: 'hubspot',
      target_system: 'sanka',
      mode: 'preview',
      required_confirmation: true,
      would_create_order: true,
      would_create_handoff: true,
      would_update_hubspot: true,
      inventory_check_results: [{ status: 'available' }],
      delivery_lead_time_results: [{ status: 'available', lead_time_days: 5 }],
    });
  });

  it('starts HubSpot deal order handoff with idempotency and explicit options', async () => {
    const startOptions = (startWorkflowTool.tool.inputSchema as any).properties.options.properties;
    const post = jest.fn().mockResolvedValue({
      data: {
        run_id: 'order-handoff-run-1',
        workflow_type: 'deal_to_order_handoff',
        status: 'completed',
        total_created_orders: 1,
        total_created_handoffs: 1,
      },
      message: 'started',
    });

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'deal_to_order_handoff',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          external_id: '46558049080',
          portal_id: '49714315',
          channel_id: 'channel-1',
        },
        options: {
          target_system: 'sanka',
          channel_id: 'channel-1',
          include_inventory_check: true,
          include_lead_time_check: true,
          include_hubspot_writeback: true,
          handoff_target: 'ops-team',
          confirm_create_missing_customer: true,
        },
        idempotency_key: 'deal-to-order-handoff:46558049080',
        language: 'en',
      },
    });

    expect(startWorkflowTool.tool.annotations?.readOnlyHint).toBe(false);
    expect(startOptions).toHaveProperty('include_hubspot_writeback');
    expect(startOptions).toHaveProperty('allow_duplicate_order');
    expect(startOptions).toHaveProperty('confirm_create_missing_customer');
    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/start', {
      body: {
        workflow_type: 'deal_to_order_handoff',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          external_id: '46558049080',
          portal_id: '49714315',
          channel_id: 'channel-1',
        },
        options: {
          target_system: 'sanka',
          channel_id: 'channel-1',
          include_inventory_check: true,
          include_lead_time_check: true,
          include_hubspot_writeback: true,
          handoff_target: 'ops-team',
          confirm_create_missing_customer: true,
        },
        idempotency_key: 'deal-to-order-handoff:46558049080',
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'order-handoff-run-1',
      workflow_type: 'deal_to_order_handoff',
      status: 'completed',
      total_created_orders: 1,
      total_created_handoffs: 1,
    });
  });

  it('previews freee invoice export workflows with explicit selected invoices', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        workflow_type: 'invoice_export',
        target_system: 'freee',
        mode: 'preview',
        sync_scope: 'selected_invoice_ids',
        needs_confirmation: false,
        per_invoice_results: [{ sanka_invoice: { id: 'invoice-1' } }],
      },
      message: 'ok',
    });

    const result = await previewWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'invoice_export',
        source_record: {
          source_system: 'sanka',
          object_type: 'invoice',
        },
        options: {
          target_system: 'freee',
          sync_scope: 'selected_invoice_ids',
          invoice_ids: ['invoice-1'],
          freee_channel_id: 'freee-channel-1',
        },
        language: 'en',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/preview', {
      body: {
        workflow_type: 'invoice_export',
        source_record: {
          source_system: 'sanka',
          object_type: 'invoice',
        },
        options: {
          target_system: 'freee',
          sync_scope: 'selected_invoice_ids',
          invoice_ids: ['invoice-1'],
          freee_channel_id: 'freee-channel-1',
        },
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      workflow_type: 'invoice_export',
      target_system: 'freee',
      mode: 'preview',
      sync_scope: 'selected_invoice_ids',
      needs_confirmation: false,
      per_invoice_results: [{ sanka_invoice: { id: 'invoice-1' } }],
    });
  });

  it('starts freee invoice export workflows with workflow run scope and idempotency', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        run_id: 'freee-run-1',
        workflow_type: 'invoice_export',
        status: 'completed',
      },
      message: 'started',
    });

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'invoice_export',
        source_record: {
          source_system: 'sanka',
          object_type: 'invoice',
        },
        options: {
          target_system: 'freee',
          sync_scope: 'created_in_workflow_run',
          workflow_run_id: 'hubspot-invoice-run-1',
          freee_channel_id: 'freee-channel-1',
        },
        idempotency_key: 'invoice-export:hubspot-invoice-run-1',
        language: 'en',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/start', {
      body: {
        workflow_type: 'invoice_export',
        source_record: {
          source_system: 'sanka',
          object_type: 'invoice',
        },
        options: {
          target_system: 'freee',
          sync_scope: 'created_in_workflow_run',
          workflow_run_id: 'hubspot-invoice-run-1',
          freee_channel_id: 'freee-channel-1',
        },
        idempotency_key: 'invoice-export:hubspot-invoice-run-1',
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'freee-run-1',
      workflow_type: 'invoice_export',
      status: 'completed',
    });
  });

  it('starts MoneyForward invoice export workflows through the accounting runtime', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        run_id: 'moneyforward-run-1',
        workflow_type: 'invoice_export',
        target_system: 'moneyforward',
        status: 'completed',
      },
      message: 'started',
    });

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'invoice_export',
        source_record: {
          source_system: 'sanka',
          object_type: 'invoice',
        },
        options: {
          target_system: 'moneyforward',
          sync_scope: 'selected_invoice_ids',
          invoice_ids: ['invoice-27'],
          moneyforward_channel_id: 'moneyforward-channel-1',
        },
        idempotency_key: 'invoice-export:moneyforward:invoice-27',
        language: 'en',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/start', {
      body: {
        workflow_type: 'invoice_export',
        source_record: {
          source_system: 'sanka',
          object_type: 'invoice',
        },
        options: {
          target_system: 'moneyforward',
          sync_scope: 'selected_invoice_ids',
          invoice_ids: ['invoice-27'],
          moneyforward_channel_id: 'moneyforward-channel-1',
        },
        idempotency_key: 'invoice-export:moneyforward:invoice-27',
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'moneyforward-run-1',
      workflow_type: 'invoice_export',
      target_system: 'moneyforward',
      status: 'completed',
    });
  });

  it('previews HubSpot revenue control summaries through the generic workflow endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        workflow_type: 'revenue_control_summary',
        source_system: 'hubspot',
        mode: 'read_only',
        read_only: true,
        totals: {
          total_closed_won_amount: { JPY: 18600000 },
          record_count_by_bucket: {
            won: 8,
            unbilled: 3,
            approval_pending: 1,
            unpaid: 2,
          },
        },
        buckets: {
          won: [],
          quote_drafted: [],
          approval_pending: [],
          unbilled: [],
          invoiced: [],
          unpaid: [],
          blocked: [],
        },
        top_blockers: [{ blocker_type: 'approval_pending_too_long' }],
        next_actions: [{ action: 'Review the pending approval request.' }],
      },
      message: 'ok',
    });

    const result = await previewWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'revenue_control_summary',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          channel_id: 'hubspot-channel-1',
        },
        options: {
          start_date: '2026-05-01',
          end_date: '2026-05-31',
          include_records: true,
          include_freee_status: true,
          aging_as_of: '2026-05-12',
          limit_per_bucket: 10,
        },
        language: 'en',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/preview', {
      body: {
        workflow_type: 'revenue_control_summary',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          channel_id: 'hubspot-channel-1',
        },
        options: {
          start_date: '2026-05-01',
          end_date: '2026-05-31',
          include_records: true,
          include_freee_status: true,
          aging_as_of: '2026-05-12',
          limit_per_bucket: 10,
        },
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      workflow_type: 'revenue_control_summary',
      source_system: 'hubspot',
      mode: 'read_only',
      read_only: true,
      totals: {
        total_closed_won_amount: { JPY: 18600000 },
        record_count_by_bucket: {
          won: 8,
          unbilled: 3,
          approval_pending: 1,
          unpaid: 2,
        },
      },
      buckets: {
        won: [],
        quote_drafted: [],
        approval_pending: [],
        unbilled: [],
        invoiced: [],
        unpaid: [],
        blocked: [],
      },
      top_blockers: [{ blocker_type: 'approval_pending_too_long' }],
      next_actions: [{ action: 'Review the pending approval request.' }],
    });
  });

  it('previews sales incentive commission reports through the generic workflow endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        workflow_type: 'sales_incentive_commission',
        source_system: 'hubspot',
        mode: 'read_only',
        read_only: true,
        compensation_rule_snapshot: {
          id: 'plan-1',
          rate_type: 'percentage',
          rate_value: 10,
        },
        totals: {
          total_reps: 2,
          total_deals_read: 5,
          total_included_deals: 3,
          total_excluded_deals: 1,
          total_flagged_deals: 1,
          total_eligible_amount_by_currency: { USD: 3000 },
          total_commission_by_currency: { USD: 300 },
        },
        summary_by_rep: [{ rep: { id: 'rep-1' }, included_deal_count: 2 }],
        deal_results: [
          {
            crm_deal_id: '1001',
            status: 'flagged',
            reason_codes: ['low_gross_margin'],
          },
        ],
        exclusions: [{ hubspot_deal_id: '1002', reason_codes: ['unpaid_invoice'] }],
        exceptions: [{ hubspot_deal_id: '1001', reason_codes: ['low_gross_margin'] }],
      },
      message: 'ok',
    });

    const result = await previewWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'sales_incentive_commission',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          channel_id: 'hubspot-channel-1',
        },
        options: {
          period: '2026-04',
          include_records: true,
          include_excluded: true,
          include_payment_status: true,
          include_margin: true,
          include_refunds: true,
          compensation_rule_id: 'plan-1',
          rep_ids: ['rep-1'],
          crm_owner_ids: ['owner-1'],
          customer_ids: ['customer-1'],
          min_gross_margin_percent: 20,
        },
        language: 'en',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflow-runs/preview', {
      body: {
        workflow_type: 'sales_incentive_commission',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          channel_id: 'hubspot-channel-1',
        },
        options: {
          period: '2026-04',
          include_records: true,
          include_excluded: true,
          include_payment_status: true,
          include_margin: true,
          include_refunds: true,
          compensation_rule_id: 'plan-1',
          rep_ids: ['rep-1'],
          crm_owner_ids: ['owner-1'],
          customer_ids: ['customer-1'],
          min_gross_margin_percent: 20,
        },
        language: 'en',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      workflow_type: 'sales_incentive_commission',
      source_system: 'hubspot',
      mode: 'read_only',
      read_only: true,
      compensation_rule_snapshot: {
        id: 'plan-1',
        rate_type: 'percentage',
        rate_value: 10,
      },
      totals: {
        total_reps: 2,
        total_deals_read: 5,
        total_included_deals: 3,
        total_excluded_deals: 1,
        total_flagged_deals: 1,
        total_eligible_amount_by_currency: { USD: 3000 },
        total_commission_by_currency: { USD: 300 },
      },
      summary_by_rep: [{ rep: { id: 'rep-1' }, included_deal_count: 2 }],
      deal_results: [
        {
          crm_deal_id: '1001',
          status: 'flagged',
          reason_codes: ['low_gross_margin'],
        },
      ],
      exclusions: [{ hubspot_deal_id: '1002', reason_codes: ['unpaid_invoice'] }],
      exceptions: [{ hubspot_deal_id: '1001', reason_codes: ['low_gross_margin'] }],
    });
  });

  it('previews Salesforce quote_readiness through the business-first CPQ route', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        workflow_type: 'quote_readiness',
        ready: false,
        read_only: true,
        target_record: {
          object_type: 'estimate',
          operation: 'preview_create',
          amount: 32400,
          currency: 'USD',
        },
        approval: {
          required: false,
          matched_rules: [],
        },
        hard_blockers: [{ code: 'missing_billing_contact' }],
        warnings: [{ code: 'missing_payment_terms' }],
        orchestration_plan: {
          read_only: true,
          would_reuse_company: false,
          would_create_company: true,
          would_reuse_contact: false,
          would_create_contact: true,
          would_reuse_items: [],
          would_create_items: [{ platform_mapping: { platform_id: '01t000000000001AAA' } }],
          platform_mappings_that_would_be_written: [
            { platform_id: '001000000000001AAA', target_object_type: 'company' },
            { platform_id: '003000000000001AAA', target_object_type: 'contact' },
            { platform_id: '01t000000000001AAA', target_object_type: 'item' },
          ],
        },
      },
      message: 'ok',
    });

    const result = await previewWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'quote_readiness',
        source_record: {
          source_system: 'salesforce',
          object_type: 'opportunity',
          url: 'https://example.my.salesforce.com/lightning/r/Opportunity/006000000000001AAA/view',
        },
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/cpq/quote-readiness/salesforce/preview', {
      body: {
        source_record: {
          source_system: 'salesforce',
          object_type: 'opportunity',
          url: 'https://example.my.salesforce.com/lightning/r/Opportunity/006000000000001AAA/view',
        },
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      workflow_type: 'quote_readiness',
      ready: false,
      read_only: true,
      target_record: {
        object_type: 'estimate',
        operation: 'preview_create',
        amount: 32400,
        currency: 'USD',
      },
      approval: {
        required: false,
        matched_rules: [],
      },
      hard_blockers: [{ code: 'missing_billing_contact' }],
      warnings: [{ code: 'missing_payment_terms' }],
      orchestration_plan: {
        read_only: true,
        would_reuse_company: false,
        would_create_company: true,
        would_reuse_contact: false,
        would_create_contact: true,
        would_reuse_items: [],
        would_create_items: [{ platform_mapping: { platform_id: '01t000000000001AAA' } }],
        platform_mappings_that_would_be_written: [
          { platform_id: '001000000000001AAA', target_object_type: 'company' },
          { platform_id: '003000000000001AAA', target_object_type: 'contact' },
          { platform_id: '01t000000000001AAA', target_object_type: 'item' },
        ],
      },
    });
  });

  it('previews quote_readiness Sanka deal references through the business-first CPQ route', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        workflow_type: 'quote_readiness',
        source_status: 'synced',
        read_only: true,
      },
      message: 'ok',
    });

    await previewWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'quote_readiness',
        source_record: {
          source_system: 'sanka',
          object_type: 'deal',
          record_id: 'deal-1',
        },
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/cpq/quote-readiness/salesforce/preview', {
      body: {
        source_record: {
          source_system: 'sanka',
          object_type: 'deal',
          record_id: 'deal-1',
        },
      },
    });
  });

  it('does not introduce a Salesforce-only quote readiness tool', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    expect(toolNames).not.toContain('check_salesforce_quote_readiness');
    expect(toolNames).not.toContain('create_draft_estimate_from_salesforce_opportunity');
    expect(toolNames).not.toContain('create_quote_from_salesforce_opportunity');
    expect(toolNames).not.toContain('salesforce_opportunity_to_estimate');
    expect(toolNames).not.toContain('start_salesforce_quote_workflow');
    expect(toolNames).not.toContain('check_and_create_salesforce_estimate');
  });

  it('loads workflow runs by id', async () => {
    const get = jest.fn().mockResolvedValue({
      data: { run_id: 'run/1', status: 'completed' },
      message: 'ok',
    });

    const result = await getWorkflowRunTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
      },
      args: {
        run_id: 'run/1',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/public/workflow-runs/run%2F1');
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'run/1',
      status: 'completed',
    });
  });
});
