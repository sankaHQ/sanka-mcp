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

  it('keeps freee sync inside generic workflow tools', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);
    const workflowTypeSchema = (previewWorkflowTool.tool.inputSchema as any).properties.workflow_type;

    expect(workflowTypeSchema.enum).toContain('invoice_export');
    expect(toolNames).not.toContain('sync_sanka_invoice_to_freee');
    expect(toolNames).not.toContain('create_freee_invoice_draft');
    expect(toolNames).not.toContain('sync_hubspot_deals_to_freee');
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

  it('previews Salesforce quote_readiness through the generic workflow endpoint', async () => {
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

    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/preview', {
      body: {
        workflow_type: 'quote_readiness',
        source_record: {
          source_system: 'salesforce',
          object_type: 'opportunity',
          url: 'https://example.my.salesforce.com/lightning/r/Opportunity/006000000000001AAA/view',
        },
        options: {},
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
    });
  });

  it('does not introduce a Salesforce-only quote readiness tool', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    expect(toolNames).not.toContain('check_salesforce_quote_readiness');
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
