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

  it('keeps order handoff, freee sync, revenue summaries, and commission reports inside generic workflow tools', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);
    const workflowTypeSchema = (previewWorkflowTool.tool.inputSchema as any).properties.workflow_type;

    expect(workflowTypeSchema.enum).toContain('deal_to_order_handoff');
    expect(workflowTypeSchema.enum).toContain('invoice_export');
    expect(workflowTypeSchema.enum).toContain('revenue_control_summary');
    expect(workflowTypeSchema.enum).toContain('sales_incentive_commission');
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

    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/resolve-record', {
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

    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/start', {
      body: {
        workflow_type: 'deal_to_estimate',
        source_record: {
          source_system: 'sanka',
          object_type: 'deal',
          record_id: 'deal-1',
        },
        options: {},
        idempotency_key: 'key-1',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'run-1',
      status: 'waiting_for_approval',
    });
  });

  it('previews deal_to_estimate workflows from HubSpot deal URLs', async () => {
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
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/preview', {
      body: {
        workflow_type: 'deal_to_estimate',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          url: 'https://app.hubspot.com/contacts/49714315/record/0-3/46558049080',
        },
        options: {},
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      source_status: 'external_only',
      financials: { total_amount: 610000, line_item_count: 3 },
    });
  });

  it('previews deal_to_invoice workflows from HubSpot deal URLs', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        source_status: 'synced',
        financials: { total_amount: 250000, line_item_count: 2 },
        duplicate_check: {
          existing_invoices: [],
          would_create_invoice: true,
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
        workflow_type: 'deal_to_invoice',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          url: 'https://app.hubspot.com/contacts/49714315/record/0-3/46558049080',
        },
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/preview', {
      body: {
        workflow_type: 'deal_to_invoice',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          url: 'https://app.hubspot.com/contacts/49714315/record/0-3/46558049080',
        },
        options: {},
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      source_status: 'synced',
      financials: { total_amount: 250000, line_item_count: 2 },
      duplicate_check: {
        existing_invoices: [],
        would_create_invoice: true,
      },
    });
  });

  it('starts deal_to_invoice workflows with idempotency and explicit duplicate override', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        run_id: 'run-invoice-1',
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
        workflow_type: 'deal_to_invoice',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          external_id: '46558049080',
          portal_id: '49714315',
          channel_id: 'channel-1',
        },
        options: {
          channel_id: 'channel-1',
          allow_multiple_invoices: true,
        },
        idempotency_key: 'deal-to-invoice:46558049080',
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/start', {
      body: {
        workflow_type: 'deal_to_invoice',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          external_id: '46558049080',
          portal_id: '49714315',
          channel_id: 'channel-1',
        },
        options: {
          channel_id: 'channel-1',
          allow_multiple_invoices: true,
        },
        idempotency_key: 'deal-to-invoice:46558049080',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'run-invoice-1',
      status: 'completed',
    });
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
      },
    });

    expect(previewWorkflowTool.tool.annotations?.readOnlyHint).toBe(true);
    expect(previewOptions).toHaveProperty('include_inventory_check');
    expect(previewOptions).toHaveProperty('include_lead_time_check');
    expect(previewOptions).toHaveProperty('handoff_target');
    expect(previewOptions).toHaveProperty('allow_duplicate_order');
    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/preview', {
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
        },
        idempotency_key: 'deal-to-order-handoff:46558049080',
      },
    });

    expect(startWorkflowTool.tool.annotations?.readOnlyHint).toBe(false);
    expect(startOptions).toHaveProperty('include_hubspot_writeback');
    expect(startOptions).toHaveProperty('allow_duplicate_order');
    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/start', {
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
        },
        idempotency_key: 'deal-to-order-handoff:46558049080',
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
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/preview', {
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
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/start', {
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
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'freee-run-1',
      workflow_type: 'invoice_export',
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
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/preview', {
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
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/preview', {
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

  it('previews Salesforce quote_readiness through the Salesforce API preview endpoint', async () => {
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

    expect(post).toHaveBeenCalledWith('/v1/public/salesforce/cpq/preview', {
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

  it('previews quote_readiness Sanka deal references through the Salesforce API preview endpoint', async () => {
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

    expect(post).toHaveBeenCalledWith('/v1/public/salesforce/cpq/preview', {
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

    expect(get).toHaveBeenCalledWith('/v1/public/workflow-runs/run%2F1');
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'run/1',
      status: 'completed',
    });
  });
});
