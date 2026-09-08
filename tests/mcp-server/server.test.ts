import { configureLogger } from '../../packages/mcp-server/src/logger';
import { recordMcpToolCall, selectTools } from '../../packages/mcp-server/src/server';
import {
  DEFAULT_INSTRUCTIONS_MAX_BYTES,
  getInstructions,
  getWorkflowGuidance,
} from '../../packages/mcp-server/src/instructions';
import { applyRequiredScopesToSecuritySchemes } from '../../packages/mcp-server/src/tool-scope-requirements';

describe('profile-aware tool selection', () => {
  beforeAll(() => {
    configureLogger({ level: 'error', pretty: false });
  });

  it('records MCP tool calls through the V2 audit route', async () => {
    const post = jest.fn().mockResolvedValue({});
    const logger = { warn: jest.fn() };

    await recordMcpToolCall({
      client: { post } as never,
      logger,
      mcpTool: {
        tool: { name: 'list_deals', title: 'List deals' },
        metadata: { resource: 'deals', operation: 'list' },
      } as never,
      reqContext: {
        mcpSessionId: 'mcp-session-1',
        auth: { authMode: 'oauth_bearer' },
        mcpClientInfo: { name: 'Claude', version: '1.0.0' },
      } as never,
      result: { content: [], isError: false },
      startedAt: Date.now() - 12,
    });

    expect(post).toHaveBeenCalledWith('/api/v2/mcp/tool-call-log', {
      body: expect.objectContaining({
        tool_name: 'list_deals',
        tool_title: 'List deals',
        resource: 'deals',
        operation: 'list',
        success: true,
        client_name: 'Claude',
        client_version: '1.0.0',
      }),
      headers: { 'X-Sanka-MCP-Session-ID': 'mcp-session-1' },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('exposes the unified toolset from the full profile', () => {
    const toolNames = selectTools(undefined, 'full').map((tool) => tool.tool.name);

    expect(toolNames).toContain('execute');
    expect(toolNames).toContain('search_docs');
    expect(toolNames).toContain('connect_sanka');
    expect(toolNames).toContain('auth_status');
    expect(toolNames).toContain('list_sandboxes');
    expect(toolNames).toContain('get_sandbox_context');
    expect(toolNames).toContain('create_sandbox');
    expect(toolNames).toContain('sync_sandbox_data');
    expect(toolNames).toContain('get_sandbox_diff');
    expect(toolNames).toContain('refresh_sandbox');
    expect(toolNames).toContain('delete_sandbox');
    expect(toolNames).toContain('invite_workspace_user');
    expect(toolNames).toContain('list_workspace_invitations');
    expect(toolNames).toContain('cancel_workspace_invitation');
    expect(toolNames).toContain('read_binary_download_chunk');
    expect(toolNames).toContain('list_private_messages');
    expect(toolNames).toContain('sync_private_messages');
    expect(toolNames).toContain('get_private_message_thread');
    expect(toolNames).toContain('reply_private_message_thread');
    expect(toolNames).toContain('archive_private_message_thread');
    expect(toolNames).toContain('list_workspace_messages');
    expect(toolNames).toContain('sync_workspace_messages');
    expect(toolNames).toContain('update_workspace_message_draft');
    expect(toolNames).toContain('get_workspace_message_thread');
    expect(toolNames).toContain('reply_workspace_message_thread');
    expect(toolNames).toContain('list_associations');
    expect(toolNames).toContain('create_association');
    expect(toolNames).toContain('delete_association');
    expect(toolNames).toContain('list_companies');
    expect(toolNames).toContain('get_company');
    expect(toolNames).toContain('create_company');
    expect(toolNames).toContain('update_company');
    expect(toolNames).toContain('delete_company');
    expect(toolNames).toContain('get_company_price_table');
    expect(toolNames).toContain('update_company_price_table_company');
    expect(toolNames).toContain('update_company_price_table_item');
    expect(toolNames).toContain('apply_company_price_table_items');
    expect(toolNames).toContain('list_contacts');
    expect(toolNames).toContain('get_contact');
    expect(toolNames).toContain('create_contact');
    expect(toolNames).toContain('update_contact');
    expect(toolNames).toContain('delete_contact');
    expect(toolNames).toContain('list_deals');
    expect(toolNames).toContain('get_deal');
    expect(toolNames).toContain('create_deal');
    expect(toolNames).toContain('update_deal');
    expect(toolNames).toContain('delete_deal');
    expect(toolNames).toContain('list_deal_pipelines');
    expect(toolNames).toContain('capture_pipeline_snapshot');
    expect(toolNames).toContain('compare_pipeline_snapshots');
    expect(toolNames).toContain('sync_pipeline_snapshot_hubspot_properties');
    expect(toolNames).toContain('list_items');
    expect(toolNames).toContain('get_item');
    expect(toolNames).toContain('create_item');
    expect(toolNames).toContain('update_item');
    expect(toolNames).toContain('delete_item');
    expect(toolNames).toContain('list_orders');
    expect(toolNames).toContain('get_order');
    expect(toolNames).toContain('create_order');
    expect(toolNames).toContain('update_order');
    expect(toolNames).toContain('activate_order');
    expect(toolNames).toContain('delete_order');
    expect(toolNames).toContain('permanent_delete_order');
    expect(toolNames).toContain('list_purchase_orders');
    expect(toolNames).toContain('get_purchase_order');
    expect(toolNames).toContain('download_purchase_order_pdf');
    expect(toolNames).toContain('create_purchase_order');
    expect(toolNames).toContain('update_purchase_order');
    expect(toolNames).toContain('delete_purchase_order');
    expect(toolNames).toContain('list_projects');
    expect(toolNames).toContain('get_project');
    expect(toolNames).toContain('create_project');
    expect(toolNames).toContain('update_project');
    expect(toolNames).toContain('delete_project');
    expect(toolNames).toContain('list_contract_templates');
    expect(toolNames).toContain('download_contract_template');
    expect(toolNames).toContain('upload_contract_template');
    expect(toolNames).toContain('upload_contract_pdf');
    expect(toolNames).toContain('replace_contract_pdf');
    expect(toolNames).toContain('create_contract_from_template');
    expect(toolNames).toContain('get_contract_workflow_state');
    expect(toolNames).toContain('update_contract_metadata');
    expect(toolNames).toContain('save_contract_signers');
    expect(toolNames).toContain('save_contract_recipients');
    expect(toolNames).toContain('save_contract_place_fields');
    expect(toolNames).toContain('send_contract_request');
    expect(toolNames).toContain('schedule_contract_request');
    expect(toolNames).toContain('list_estimates');
    expect(toolNames).toContain('get_estimate');
    expect(toolNames).toContain('create_estimate');
    expect(toolNames).toContain('update_estimate');
    expect(toolNames).toContain('delete_estimate');
    expect(toolNames).toContain('list_invoices');
    expect(toolNames).toContain('list_overdue_invoices');
    expect(toolNames).toContain('get_invoice');
    expect(toolNames).toContain('list_invoice_line_items');
    expect(toolNames).toContain('send_invoice_email');
    expect(toolNames).toContain('create_invoice');
    expect(toolNames).toContain('update_invoice');
    expect(toolNames).toContain('activate_invoice');
    expect(toolNames).toContain('delete_invoice');
    expect(toolNames).toContain('permanent_delete_invoice');
    expect(toolNames).toContain('list_subscriptions');
    expect(toolNames).toContain('get_subscription');
    expect(toolNames).toContain('create_subscription');
    expect(toolNames).toContain('update_subscription');
    expect(toolNames).toContain('delete_subscription');
    expect(toolNames).toContain('list_payments');
    expect(toolNames).toContain('get_payment');
    expect(toolNames).toContain('list_payment_allocations');
    expect(toolNames).toContain('update_payment_allocations');
    expect(toolNames).toContain('create_payment');
    expect(toolNames).toContain('update_payment');
    expect(toolNames).toContain('delete_payment');
    expect(toolNames).toContain('list_slips');
    expect(toolNames).toContain('get_slip');
    expect(toolNames).toContain('create_slip');
    expect(toolNames).toContain('update_slip');
    expect(toolNames).toContain('delete_slip');
    expect(toolNames).toContain('list_bills');
    expect(toolNames).toContain('get_bill');
    expect(toolNames).toContain('upload_bill_attachment');
    expect(toolNames).toContain('start_bill_attachment_upload');
    expect(toolNames).toContain('append_bill_attachment_upload_chunk');
    expect(toolNames).toContain('finish_bill_attachment_upload');
    expect(toolNames).toContain('create_bill');
    expect(toolNames).toContain('update_bill');
    expect(toolNames).toContain('delete_bill');
    expect(toolNames).toContain('list_disbursements');
    expect(toolNames).toContain('get_disbursement');
    expect(toolNames).toContain('create_disbursement');
    expect(toolNames).toContain('update_disbursement');
    expect(toolNames).toContain('delete_disbursement');
    expect(toolNames).toContain('list_disbursement_allocations');
    expect(toolNames).toContain('create_disbursement_allocation');
    expect(toolNames).toContain('update_disbursement_allocation');
    expect(toolNames).toContain('delete_disbursement_allocation');
    expect(toolNames).toContain('list_tickets');
    expect(toolNames).toContain('get_ticket');
    expect(toolNames).toContain('create_ticket');
    expect(toolNames).toContain('update_ticket');
    expect(toolNames).toContain('delete_ticket');
    expect(toolNames).toContain('list_ticket_pipelines');
    expect(toolNames).toContain('update_ticket_status');
    expect(toolNames).toContain('list_locations');
    expect(toolNames).toContain('get_location');
    expect(toolNames).toContain('create_location');
    expect(toolNames).toContain('update_location');
    expect(toolNames).toContain('delete_location');
    expect(toolNames).toContain('list_inventories');
    expect(toolNames).toContain('get_inventory');
    expect(toolNames).toContain('create_inventory');
    expect(toolNames).toContain('update_inventory');
    expect(toolNames).toContain('delete_inventory');
    expect(toolNames).toContain('list_inventory_transactions');
    expect(toolNames).toContain('get_inventory_transaction');
    expect(toolNames).toContain('create_inventory_transaction');
    expect(toolNames).toContain('update_inventory_transaction');
    expect(toolNames).toContain('delete_inventory_transaction');
    expect(toolNames).toContain('list_expenses');
    expect(toolNames).toContain('get_expense');
    expect(toolNames).toContain('upload_expense_attachment');
    expect(toolNames).toContain('start_expense_attachment_upload');
    expect(toolNames).toContain('append_expense_attachment_upload_chunk');
    expect(toolNames).toContain('finish_expense_attachment_upload');
    expect(toolNames).toContain('upload_order_attachment');
    expect(toolNames).toContain('start_order_attachment_upload');
    expect(toolNames).toContain('append_order_attachment_upload_chunk');
    expect(toolNames).toContain('finish_order_attachment_upload');
    expect(toolNames).toContain('upload_purchase_order_attachment');
    expect(toolNames).toContain('start_purchase_order_attachment_upload');
    expect(toolNames).toContain('append_purchase_order_attachment_upload_chunk');
    expect(toolNames).toContain('finish_purchase_order_attachment_upload');
    expect(toolNames).toContain('upload_estimate_attachment');
    expect(toolNames).toContain('start_estimate_attachment_upload');
    expect(toolNames).toContain('append_estimate_attachment_upload_chunk');
    expect(toolNames).toContain('finish_estimate_attachment_upload');
    expect(toolNames).toContain('upload_invoice_attachment');
    expect(toolNames).toContain('start_invoice_attachment_upload');
    expect(toolNames).toContain('append_invoice_attachment_upload_chunk');
    expect(toolNames).toContain('finish_invoice_attachment_upload');
    expect(toolNames).toContain('upload_import_file');
    expect(toolNames).toContain('import_records');
    expect(toolNames).toContain('get_import_job');
    expect(toolNames).toContain('list_import_jobs');
    expect(toolNames).toContain('cancel_import_job');
    expect(toolNames).toContain('list_integration_channels');
    expect(toolNames).toContain('export_records');
    expect(toolNames).toContain('get_export_job');
    expect(toolNames).toContain('list_export_jobs');
    expect(toolNames).toContain('cancel_export_job');
    expect(toolNames).toContain('create_expense');
    expect(toolNames).toContain('update_expense');
    expect(toolNames).toContain('delete_expense');
    expect(toolNames).toContain('list_employees');
    expect(toolNames).toContain('list_absences');
    expect(toolNames).toContain('get_absence');
    expect(toolNames).toContain('create_absence');
    expect(toolNames).toContain('update_absence');
    expect(toolNames).toContain('delete_absence');
    expect(toolNames).toContain('list_attendance_records');
    expect(toolNames).toContain('get_attendance_record');
    expect(toolNames).toContain('create_attendance_record');
    expect(toolNames).toContain('update_attendance_record');
    expect(toolNames).toContain('delete_attendance_record');
    expect(toolNames).toContain('list_payroll_profiles');
    expect(toolNames).toContain('upsert_payroll_profile');
    expect(toolNames).toContain('list_payroll_runs');
    expect(toolNames).toContain('get_payroll_run');
    expect(toolNames).toContain('download_payroll_payslip_pdf');
    expect(toolNames).toContain('calculate_payroll_run');
    expect(toolNames).toContain('create_payroll_journal_entry');
    expect(toolNames).toContain('approve_payroll_run');
    expect(toolNames).toContain('list_incentives');
    expect(toolNames).toContain('list_incentive_plans');
    expect(toolNames).toContain('list_incentive_company_options');
    expect(toolNames).toContain('create_incentive_plan');
    expect(toolNames).toContain('calculate_incentives');
    expect(toolNames).toContain('approve_incentives');
    expect(toolNames).toContain('generate_incentive_payment_notice');
    expect(toolNames).toContain('list_properties');
    expect(toolNames).toContain('get_property');
    expect(toolNames).toContain('create_property');
    expect(toolNames).toContain('update_property');
    expect(toolNames).toContain('delete_property');
    expect(toolNames).toContain('create_approval_request');
    expect(toolNames).toContain('list_record_approvals');
    expect(toolNames).toContain('approve_record_approval');
    expect(toolNames).toContain('reject_record_approval');
    expect(toolNames).toContain('list_approval_rules');
    expect(toolNames).toContain('get_approval_rule_options');
    expect(toolNames).toContain('upsert_approval_rule');
    expect(toolNames).toContain('delete_approval_rule');
    expect(toolNames).toContain('list_lock_rules');
    expect(toolNames).toContain('get_lock_rule_options');
    expect(toolNames).toContain('upsert_lock_rule');
    expect(toolNames).toContain('delete_lock_rule');
    expect(toolNames).toContain('list_delivery_rules');
    expect(toolNames).toContain('get_delivery_rule_options');
    expect(toolNames).toContain('upsert_delivery_rule');
    expect(toolNames).toContain('delete_delivery_rule');
    expect(toolNames).toContain('get_calendar_bootstrap');
    expect(toolNames).toContain('check_calendar_availability');
    expect(toolNames).toContain('create_calendar_attendance');
    expect(toolNames).toContain('cancel_calendar_attendance');
    expect(toolNames).toContain('reschedule_calendar_attendance');
    expect(toolNames).toContain('prospect_companies');
    expect(toolNames).toContain('score_record');
    expect(toolNames).toContain('generate_demo_workspace');
    expect(toolNames).toContain('push_integration_sync');
  });

  it('does not register duplicate tool names', () => {
    for (const profile of ['full', 'hosted'] as const) {
      const toolNames = selectTools(undefined, profile).map((tool) => tool.tool.name);
      expect(toolNames).toHaveLength(new Set(toolNames).size);
    }
  });

  it('keeps cleanup tools available for workflow-created records', () => {
    const workflowCleanupTools = [
      'delete_estimate',
      'delete_order',
      'delete_invoice',
      'delete_subscription',
      'delete_purchase_order',
      'delete_task',
    ];

    for (const profile of ['full', 'hosted'] as const) {
      const selectedTools = selectTools(undefined, profile);
      const toolsByName = new Map(selectedTools.map((selected) => [selected.tool.name, selected.tool]));

      for (const toolName of workflowCleanupTools) {
        const tool = toolsByName.get(toolName);
        expect(tool).toBeDefined();
        expect(tool?.annotations?.destructiveHint).toBe(true);
      }
    }
  });

  it('hides generic docs/code tools from the hosted profile', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    expect(toolNames).not.toContain('execute');
    expect(toolNames).not.toContain('search_docs');
    expect(toolNames).toContain('connect_sanka');
    expect(toolNames).toContain('auth_status');
    expect(toolNames).toContain('list_sandboxes');
    expect(toolNames).toContain('get_sandbox_context');
    expect(toolNames).toContain('create_sandbox');
    expect(toolNames).toContain('sync_sandbox_data');
    expect(toolNames).toContain('get_sandbox_diff');
    expect(toolNames).toContain('refresh_sandbox');
    expect(toolNames).toContain('delete_sandbox');
    expect(toolNames).toContain('invite_workspace_user');
    expect(toolNames).toContain('list_workspace_invitations');
    expect(toolNames).toContain('cancel_workspace_invitation');
    expect(toolNames).toContain('list_private_messages');
    expect(toolNames).toContain('sync_private_messages');
    expect(toolNames).toContain('get_private_message_thread');
    expect(toolNames).toContain('reply_private_message_thread');
    expect(toolNames).toContain('archive_private_message_thread');
    expect(toolNames).toContain('list_workspace_messages');
    expect(toolNames).toContain('sync_workspace_messages');
    expect(toolNames).toContain('get_workspace_message_thread');
    expect(toolNames).toContain('reply_workspace_message_thread');
    expect(toolNames).toContain('list_associations');
    expect(toolNames).toContain('create_association');
    expect(toolNames).toContain('delete_association');
    expect(toolNames).toContain('list_companies');
    expect(toolNames).toContain('get_company');
    expect(toolNames).toContain('create_company');
    expect(toolNames).toContain('update_company');
    expect(toolNames).toContain('delete_company');
    expect(toolNames).toContain('get_company_price_table');
    expect(toolNames).toContain('update_company_price_table_company');
    expect(toolNames).toContain('update_company_price_table_item');
    expect(toolNames).toContain('apply_company_price_table_items');
    expect(toolNames).toContain('list_contacts');
    expect(toolNames).toContain('get_contact');
    expect(toolNames).toContain('create_contact');
    expect(toolNames).toContain('update_contact');
    expect(toolNames).toContain('delete_contact');
    expect(toolNames).toContain('list_deals');
    expect(toolNames).toContain('get_deal');
    expect(toolNames).toContain('create_deal');
    expect(toolNames).toContain('update_deal');
    expect(toolNames).toContain('delete_deal');
    expect(toolNames).toContain('list_deal_pipelines');
    expect(toolNames).toContain('capture_pipeline_snapshot');
    expect(toolNames).toContain('compare_pipeline_snapshots');
    expect(toolNames).toContain('sync_pipeline_snapshot_hubspot_properties');
    expect(toolNames).toContain('list_items');
    expect(toolNames).toContain('get_item');
    expect(toolNames).toContain('create_item');
    expect(toolNames).toContain('update_item');
    expect(toolNames).toContain('delete_item');
    expect(toolNames).toContain('list_orders');
    expect(toolNames).toContain('get_order');
    expect(toolNames).toContain('create_order');
    expect(toolNames).toContain('update_order');
    expect(toolNames).toContain('activate_order');
    expect(toolNames).toContain('delete_order');
    expect(toolNames).toContain('permanent_delete_order');
    expect(toolNames).toContain('list_purchase_orders');
    expect(toolNames).toContain('get_purchase_order');
    expect(toolNames).toContain('download_purchase_order_pdf');
    expect(toolNames).toContain('create_purchase_order');
    expect(toolNames).toContain('update_purchase_order');
    expect(toolNames).toContain('delete_purchase_order');
    expect(toolNames).toContain('list_projects');
    expect(toolNames).toContain('get_project');
    expect(toolNames).toContain('create_project');
    expect(toolNames).toContain('update_project');
    expect(toolNames).toContain('delete_project');
    expect(toolNames).toContain('list_estimates');
    expect(toolNames).toContain('get_estimate');
    expect(toolNames).toContain('create_estimate');
    expect(toolNames).toContain('update_estimate');
    expect(toolNames).toContain('delete_estimate');
    expect(toolNames).toContain('list_invoices');
    expect(toolNames).toContain('list_overdue_invoices');
    expect(toolNames).toContain('get_invoice');
    expect(toolNames).toContain('list_invoice_line_items');
    expect(toolNames).toContain('send_invoice_email');
    expect(toolNames).toContain('create_invoice');
    expect(toolNames).toContain('update_invoice');
    expect(toolNames).toContain('activate_invoice');
    expect(toolNames).toContain('delete_invoice');
    expect(toolNames).toContain('permanent_delete_invoice');
    expect(toolNames).toContain('list_subscriptions');
    expect(toolNames).toContain('get_subscription');
    expect(toolNames).toContain('create_subscription');
    expect(toolNames).toContain('update_subscription');
    expect(toolNames).toContain('delete_subscription');
    expect(toolNames).toContain('list_payments');
    expect(toolNames).toContain('get_payment');
    expect(toolNames).toContain('list_payment_allocations');
    expect(toolNames).toContain('update_payment_allocations');
    expect(toolNames).toContain('create_payment');
    expect(toolNames).toContain('update_payment');
    expect(toolNames).toContain('delete_payment');
    expect(toolNames).toContain('list_slips');
    expect(toolNames).toContain('get_slip');
    expect(toolNames).toContain('create_slip');
    expect(toolNames).toContain('update_slip');
    expect(toolNames).toContain('delete_slip');
    expect(toolNames).toContain('list_bills');
    expect(toolNames).toContain('get_bill');
    expect(toolNames).toContain('upload_bill_attachment');
    expect(toolNames).toContain('start_bill_attachment_upload');
    expect(toolNames).toContain('append_bill_attachment_upload_chunk');
    expect(toolNames).toContain('finish_bill_attachment_upload');
    expect(toolNames).toContain('create_bill');
    expect(toolNames).toContain('update_bill');
    expect(toolNames).toContain('delete_bill');
    expect(toolNames).toContain('list_disbursements');
    expect(toolNames).toContain('get_disbursement');
    expect(toolNames).toContain('create_disbursement');
    expect(toolNames).toContain('update_disbursement');
    expect(toolNames).toContain('delete_disbursement');
    expect(toolNames).toContain('list_disbursement_allocations');
    expect(toolNames).toContain('create_disbursement_allocation');
    expect(toolNames).toContain('update_disbursement_allocation');
    expect(toolNames).toContain('delete_disbursement_allocation');
    expect(toolNames).toContain('list_tickets');
    expect(toolNames).toContain('get_ticket');
    expect(toolNames).toContain('create_ticket');
    expect(toolNames).toContain('update_ticket');
    expect(toolNames).toContain('delete_ticket');
    expect(toolNames).toContain('list_ticket_pipelines');
    expect(toolNames).toContain('update_ticket_status');
    expect(toolNames).toContain('list_locations');
    expect(toolNames).toContain('get_location');
    expect(toolNames).toContain('create_location');
    expect(toolNames).toContain('update_location');
    expect(toolNames).toContain('delete_location');
    expect(toolNames).toContain('list_inventories');
    expect(toolNames).toContain('get_inventory');
    expect(toolNames).toContain('create_inventory');
    expect(toolNames).toContain('update_inventory');
    expect(toolNames).toContain('delete_inventory');
    expect(toolNames).toContain('list_inventory_transactions');
    expect(toolNames).toContain('get_inventory_transaction');
    expect(toolNames).toContain('create_inventory_transaction');
    expect(toolNames).toContain('update_inventory_transaction');
    expect(toolNames).toContain('delete_inventory_transaction');
    expect(toolNames).toContain('list_expenses');
    expect(toolNames).toContain('get_expense');
    expect(toolNames).toContain('upload_expense_attachment');
    expect(toolNames).toContain('start_expense_attachment_upload');
    expect(toolNames).toContain('append_expense_attachment_upload_chunk');
    expect(toolNames).toContain('finish_expense_attachment_upload');
    expect(toolNames).toContain('upload_order_attachment');
    expect(toolNames).toContain('start_order_attachment_upload');
    expect(toolNames).toContain('append_order_attachment_upload_chunk');
    expect(toolNames).toContain('finish_order_attachment_upload');
    expect(toolNames).toContain('upload_purchase_order_attachment');
    expect(toolNames).toContain('start_purchase_order_attachment_upload');
    expect(toolNames).toContain('append_purchase_order_attachment_upload_chunk');
    expect(toolNames).toContain('finish_purchase_order_attachment_upload');
    expect(toolNames).toContain('upload_estimate_attachment');
    expect(toolNames).toContain('start_estimate_attachment_upload');
    expect(toolNames).toContain('append_estimate_attachment_upload_chunk');
    expect(toolNames).toContain('finish_estimate_attachment_upload');
    expect(toolNames).toContain('upload_invoice_attachment');
    expect(toolNames).toContain('start_invoice_attachment_upload');
    expect(toolNames).toContain('append_invoice_attachment_upload_chunk');
    expect(toolNames).toContain('finish_invoice_attachment_upload');
    expect(toolNames).toContain('upload_import_file');
    expect(toolNames).toContain('import_records');
    expect(toolNames).toContain('get_import_job');
    expect(toolNames).toContain('list_import_jobs');
    expect(toolNames).toContain('cancel_import_job');
    expect(toolNames).toContain('list_integration_channels');
    expect(toolNames).toContain('export_records');
    expect(toolNames).toContain('get_export_job');
    expect(toolNames).toContain('list_export_jobs');
    expect(toolNames).toContain('cancel_export_job');
    expect(toolNames).toContain('create_expense');
    expect(toolNames).toContain('update_expense');
    expect(toolNames).toContain('delete_expense');
    expect(toolNames).toContain('list_employees');
    expect(toolNames).toContain('list_absences');
    expect(toolNames).toContain('get_absence');
    expect(toolNames).toContain('create_absence');
    expect(toolNames).toContain('update_absence');
    expect(toolNames).toContain('delete_absence');
    expect(toolNames).toContain('list_attendance_records');
    expect(toolNames).toContain('get_attendance_record');
    expect(toolNames).toContain('create_attendance_record');
    expect(toolNames).toContain('update_attendance_record');
    expect(toolNames).toContain('delete_attendance_record');
    expect(toolNames).toContain('list_payroll_profiles');
    expect(toolNames).toContain('upsert_payroll_profile');
    expect(toolNames).toContain('list_payroll_runs');
    expect(toolNames).toContain('get_payroll_run');
    expect(toolNames).toContain('download_payroll_payslip_pdf');
    expect(toolNames).toContain('calculate_payroll_run');
    expect(toolNames).toContain('create_payroll_journal_entry');
    expect(toolNames).toContain('approve_payroll_run');
    expect(toolNames).toContain('list_incentives');
    expect(toolNames).toContain('list_incentive_plans');
    expect(toolNames).toContain('list_incentive_company_options');
    expect(toolNames).toContain('create_incentive_plan');
    expect(toolNames).toContain('calculate_incentives');
    expect(toolNames).toContain('approve_incentives');
    expect(toolNames).toContain('generate_incentive_payment_notice');
    expect(toolNames).toContain('list_properties');
    expect(toolNames).toContain('get_property');
    expect(toolNames).toContain('create_property');
    expect(toolNames).toContain('update_property');
    expect(toolNames).toContain('delete_property');
    expect(toolNames).toContain('get_calendar_bootstrap');
    expect(toolNames).toContain('check_calendar_availability');
    expect(toolNames).toContain('create_calendar_attendance');
    expect(toolNames).toContain('cancel_calendar_attendance');
    expect(toolNames).toContain('reschedule_calendar_attendance');
    expect(toolNames).toContain('prospect_companies');
    expect(toolNames).toContain('score_record');
    expect(toolNames).toContain('generate_demo_workspace');
    expect(toolNames).toContain('push_integration_sync');
  });

  it('advertises resource-specific OAuth scopes on protected tools', () => {
    const tools = selectTools(undefined, 'hosted').map(applyRequiredScopesToSecuritySchemes);
    const listDeals = tools.find((tool) => tool.tool.name === 'list_deals');
    const listInventories = tools.find((tool) => tool.tool.name === 'list_inventories');
    const getWorkflowRun = tools.find((tool) => tool.tool.name === 'get_workflow_run');

    expect(listDeals?.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['deals:read'] }]);
    expect(listInventories?.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['inventories:read'] }]);
    expect(getWorkflowRun?.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['mcp:access'] }]);
  });

  it('returns compact unified instructions from the default profile', async () => {
    const instructions = await getInstructions({ toolProfile: 'full' });
    const toolNames = selectTools(undefined, 'full').map((tool) => tool.tool.name);
    const documented = [instructions, ...getWorkflowGuidance('full')].join('\n');

    expect(Buffer.byteLength(instructions, 'utf8')).toBeLessThanOrEqual(DEFAULT_INSTRUCTIONS_MAX_BYTES);
    expect(instructions).toContain('execute');
    expect(instructions).toContain('search_docs');
    expect(instructions).toContain('get_capability_guidance');
    expect(instructions).toContain('Guardrails:');
    expect(documented).not.toContain('Sakura plugin');
    for (const toolName of [
      'execute',
      'search_docs',
      'connect_sanka',
      'auth_status',
      'list_sandboxes',
      'get_sandbox_context',
      'create_sandbox',
      'sync_sandbox_data',
      'get_sandbox_diff',
      'refresh_sandbox',
      'delete_sandbox',
      'list_private_messages',
      'sync_private_messages',
      'get_private_message_thread',
      'reply_private_message_thread',
      'archive_private_message_thread',
      'list_workspace_messages',
      'sync_workspace_messages',
      'get_workspace_message_thread',
      'reply_workspace_message_thread',
      'list_associations',
      'create_association',
      'delete_association',
      'list_companies',
      'get_company',
      'create_company',
      'update_company',
      'delete_company',
      'get_company_price_table',
      'update_company_price_table_company',
      'update_company_price_table_item',
      'apply_company_price_table_items',
      'list_contacts',
      'get_contact',
      'create_contact',
      'update_contact',
      'delete_contact',
      'list_deals',
      'get_deal',
      'create_deal',
      'update_deal',
      'delete_deal',
      'list_deal_pipelines',
      'capture_pipeline_snapshot',
      'compare_pipeline_snapshots',
      'sync_pipeline_snapshot_hubspot_properties',
      'list_items',
      'get_item',
      'create_item',
      'update_item',
      'delete_item',
      'list_orders',
      'get_order',
      'create_order',
      'update_order',
      'activate_order',
      'delete_order',
      'permanent_delete_order',
      'list_purchase_orders',
      'get_purchase_order',
      'download_purchase_order_pdf',
      'read_binary_download_chunk',
      'create_purchase_order',
      'update_purchase_order',
      'delete_purchase_order',
      'list_estimates',
      'get_estimate',
      'create_estimate',
      'update_estimate',
      'delete_estimate',
      'list_invoices',
      'list_overdue_invoices',
      'get_invoice',
      'list_invoice_line_items',
      'send_invoice_email',
      'create_invoice',
      'update_invoice',
      'activate_invoice',
      'delete_invoice',
      'permanent_delete_invoice',
      'list_subscriptions',
      'get_subscription',
      'create_subscription',
      'update_subscription',
      'delete_subscription',
      'list_payments',
      'get_payment',
      'list_payment_allocations',
      'update_payment_allocations',
      'create_payment',
      'update_payment',
      'delete_payment',
      'list_slips',
      'get_slip',
      'create_slip',
      'update_slip',
      'delete_slip',
      'list_bills',
      'get_bill',
      'upload_bill_attachment',
      'start_bill_attachment_upload',
      'append_bill_attachment_upload_chunk',
      'finish_bill_attachment_upload',
      'create_bill',
      'update_bill',
      'delete_bill',
      'list_disbursements',
      'get_disbursement',
      'create_disbursement',
      'update_disbursement',
      'delete_disbursement',
      'list_disbursement_allocations',
      'create_disbursement_allocation',
      'update_disbursement_allocation',
      'delete_disbursement_allocation',
      'list_tickets',
      'get_ticket',
      'create_ticket',
      'update_ticket',
      'delete_ticket',
      'list_ticket_pipelines',
      'update_ticket_status',
      'list_locations',
      'get_location',
      'create_location',
      'update_location',
      'delete_location',
      'list_inventories',
      'get_inventory',
      'create_inventory',
      'update_inventory',
      'delete_inventory',
      'list_inventory_transactions',
      'get_inventory_transaction',
      'create_inventory_transaction',
      'update_inventory_transaction',
      'delete_inventory_transaction',
      'list_expenses',
      'get_expense',
      'upload_expense_attachment',
      'start_expense_attachment_upload',
      'append_expense_attachment_upload_chunk',
      'finish_expense_attachment_upload',
      'upload_order_attachment',
      'start_order_attachment_upload',
      'append_order_attachment_upload_chunk',
      'finish_order_attachment_upload',
      'upload_purchase_order_attachment',
      'start_purchase_order_attachment_upload',
      'append_purchase_order_attachment_upload_chunk',
      'finish_purchase_order_attachment_upload',
      'upload_estimate_attachment',
      'start_estimate_attachment_upload',
      'append_estimate_attachment_upload_chunk',
      'finish_estimate_attachment_upload',
      'upload_invoice_attachment',
      'start_invoice_attachment_upload',
      'append_invoice_attachment_upload_chunk',
      'finish_invoice_attachment_upload',
      'upload_import_file',
      'import_records',
      'get_import_job',
      'list_import_jobs',
      'cancel_import_job',
      'list_integration_channels',
      'export_records',
      'get_export_job',
      'list_export_jobs',
      'cancel_export_job',
      'create_expense',
      'update_expense',
      'delete_expense',
      'list_employees',
      'list_absences',
      'create_absence',
      'list_attendance_records',
      'create_attendance_record',
      'list_payroll_profiles',
      'download_payroll_payslip_pdf',
      'calculate_payroll_run',
      'create_payroll_journal_entry',
      'approve_payroll_run',
      'list_incentives',
      'list_incentive_plans',
      'list_incentive_company_options',
      'create_incentive_plan',
      'calculate_incentives',
      'approve_incentives',
      'generate_incentive_payment_notice',
      'list_properties',
      'get_property',
      'create_property',
      'update_property',
      'delete_property',
      'get_calendar_bootstrap',
      'check_calendar_availability',
      'create_calendar_attendance',
      'cancel_calendar_attendance',
      'reschedule_calendar_attendance',
      'prospect_companies',
      'score_record',
      'generate_demo_workspace',
      'push_integration_sync',
    ]) {
      expect(toolNames).toContain(toolName);
    }
    for (const phrase of [
      'qbo_expense_account_id',
      'workflow_type=bill_export',
      'QuickBooks BillPayment is a separate workflow',
      'Do not render Sanka record numbers as Markdown issue references',
      '売上請求番号 7',
      'Order is "受注" and Invoice is "売上請求"',
      'status=draft should be shown as "下書き"',
      'For Sanka company cycles',
      'billing_cycle and payment_cycle are standard company fields',
      'Do not say a Sanka tool or API call failed unless',
      'structuredContent.required_user_facing_reply',
      'prefer the plugin-attached namespace',
      'mcp__sakura_plugin__*',
      'installed Sanka plugin chip',
      'mcp__sanka_key__*',
      'Only use download_estimate_pdf when the user explicitly asks',
    ]) {
      expect(documented).toContain(phrase);
    }
  });

  it('returns hosted instructions without generic docs/code tools', async () => {
    const instructions = await getInstructions({ toolProfile: 'hosted' });
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);
    const documented = [instructions, ...getWorkflowGuidance('hosted')].join('\n');

    expect(Buffer.byteLength(instructions, 'utf8')).toBeLessThanOrEqual(DEFAULT_INSTRUCTIONS_MAX_BYTES);
    expect(instructions).not.toContain('execute');
    expect(instructions).not.toContain('search_docs');
    expect(instructions).toContain('get_capability_guidance');
    expect(instructions).toContain('Guardrails:');
    expect(documented).not.toContain('Sakura plugin');
    for (const toolName of [
      'connect_sanka',
      'auth_status',
      'list_sandboxes',
      'get_sandbox_context',
      'create_sandbox',
      'sync_sandbox_data',
      'get_sandbox_diff',
      'refresh_sandbox',
      'delete_sandbox',
      'list_private_messages',
      'sync_private_messages',
      'get_private_message_thread',
      'reply_private_message_thread',
      'archive_private_message_thread',
      'list_workspace_messages',
      'sync_workspace_messages',
      'get_workspace_message_thread',
      'reply_workspace_message_thread',
      'list_associations',
      'create_association',
      'delete_association',
      'list_companies',
      'get_company',
      'create_company',
      'update_company',
      'delete_company',
      'get_company_price_table',
      'update_company_price_table_company',
      'update_company_price_table_item',
      'apply_company_price_table_items',
      'list_contacts',
      'get_contact',
      'create_contact',
      'update_contact',
      'delete_contact',
      'list_deals',
      'get_deal',
      'create_deal',
      'update_deal',
      'delete_deal',
      'list_deal_pipelines',
      'capture_pipeline_snapshot',
      'compare_pipeline_snapshots',
      'sync_pipeline_snapshot_hubspot_properties',
      'list_items',
      'get_item',
      'create_item',
      'update_item',
      'delete_item',
      'list_orders',
      'get_order',
      'create_order',
      'update_order',
      'activate_order',
      'delete_order',
      'permanent_delete_order',
      'list_purchase_orders',
      'get_purchase_order',
      'download_purchase_order_pdf',
      'read_binary_download_chunk',
      'create_purchase_order',
      'update_purchase_order',
      'delete_purchase_order',
      'list_estimates',
      'get_estimate',
      'create_estimate',
      'update_estimate',
      'delete_estimate',
      'list_invoices',
      'list_overdue_invoices',
      'get_invoice',
      'list_invoice_line_items',
      'send_invoice_email',
      'create_invoice',
      'update_invoice',
      'activate_invoice',
      'delete_invoice',
      'permanent_delete_invoice',
      'list_subscriptions',
      'get_subscription',
      'create_subscription',
      'update_subscription',
      'delete_subscription',
      'list_payments',
      'get_payment',
      'list_payment_allocations',
      'update_payment_allocations',
      'create_payment',
      'update_payment',
      'delete_payment',
      'list_slips',
      'get_slip',
      'create_slip',
      'update_slip',
      'delete_slip',
      'list_bills',
      'get_bill',
      'upload_bill_attachment',
      'start_bill_attachment_upload',
      'append_bill_attachment_upload_chunk',
      'finish_bill_attachment_upload',
      'create_bill',
      'update_bill',
      'delete_bill',
      'list_disbursements',
      'get_disbursement',
      'create_disbursement',
      'update_disbursement',
      'delete_disbursement',
      'list_disbursement_allocations',
      'create_disbursement_allocation',
      'update_disbursement_allocation',
      'delete_disbursement_allocation',
      'list_tickets',
      'get_ticket',
      'create_ticket',
      'update_ticket',
      'delete_ticket',
      'list_ticket_pipelines',
      'update_ticket_status',
      'list_locations',
      'get_location',
      'create_location',
      'update_location',
      'delete_location',
      'list_inventories',
      'get_inventory',
      'create_inventory',
      'update_inventory',
      'delete_inventory',
      'list_inventory_transactions',
      'get_inventory_transaction',
      'create_inventory_transaction',
      'update_inventory_transaction',
      'delete_inventory_transaction',
      'list_expenses',
      'get_expense',
      'upload_expense_attachment',
      'start_expense_attachment_upload',
      'append_expense_attachment_upload_chunk',
      'finish_expense_attachment_upload',
      'upload_order_attachment',
      'start_order_attachment_upload',
      'append_order_attachment_upload_chunk',
      'finish_order_attachment_upload',
      'upload_purchase_order_attachment',
      'start_purchase_order_attachment_upload',
      'append_purchase_order_attachment_upload_chunk',
      'finish_purchase_order_attachment_upload',
      'upload_estimate_attachment',
      'start_estimate_attachment_upload',
      'append_estimate_attachment_upload_chunk',
      'finish_estimate_attachment_upload',
      'upload_invoice_attachment',
      'start_invoice_attachment_upload',
      'append_invoice_attachment_upload_chunk',
      'finish_invoice_attachment_upload',
      'upload_import_file',
      'import_records',
      'get_import_job',
      'list_import_jobs',
      'cancel_import_job',
      'list_integration_channels',
      'export_records',
      'get_export_job',
      'list_export_jobs',
      'cancel_export_job',
      'create_expense',
      'update_expense',
      'delete_expense',
      'list_employees',
      'list_absences',
      'create_absence',
      'list_attendance_records',
      'create_attendance_record',
      'list_payroll_profiles',
      'download_payroll_payslip_pdf',
      'calculate_payroll_run',
      'create_payroll_journal_entry',
      'approve_payroll_run',
      'list_incentives',
      'list_incentive_plans',
      'list_incentive_company_options',
      'create_incentive_plan',
      'calculate_incentives',
      'approve_incentives',
      'generate_incentive_payment_notice',
      'list_properties',
      'get_property',
      'create_property',
      'update_property',
      'delete_property',
      'get_calendar_bootstrap',
      'check_calendar_availability',
      'create_calendar_attendance',
      'cancel_calendar_attendance',
      'reschedule_calendar_attendance',
      'prospect_companies',
      'score_record',
      'generate_demo_workspace',
      'push_integration_sync',
    ]) {
      expect(toolNames).toContain(toolName);
    }
    for (const phrase of [
      'qbo_expense_account_id',
      'additional_pdf_attachments',
      'workflow_type=bill_export',
      'QuickBooks BillPayment is a separate workflow',
      'action="draft"',
      'structuredContent.required_user_facing_reply',
      'prefer the plugin-attached namespace',
      'mcp__sakura_plugin__*',
      'installed Sanka plugin chip',
      'mcp__sanka_key__*',
      'Only use download_estimate_pdf when the user explicitly asks',
    ]) {
      expect(documented).toContain(phrase);
    }
  });
});
