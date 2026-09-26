import {
  crmActivateInvoiceTool,
  crmActivateOrderTool,
  crmArchivePrivateMessageThreadTool,
  crmCancelCalendarAttendanceTool,
  crmCheckCalendarAvailabilityTool,
  crmCreateBillTool,
  crmCreateCalendarAttendanceTool,
  crmCreateCompanyTool,
  crmCreateContactTool,
  crmCreateDealTool,
  crmCreateDisbursementTool,
  crmCreateEstimateTool,
  crmCreateExpenseTool,
  crmCreateInventoryTool,
  crmCreateInvoiceTool,
  crmCreateItemTool,
  crmCreateLocationTool,
  crmCreateOrderTool,
  crmCreatePaymentTool,
  crmCreatePropertyTool,
  crmCreatePurchaseOrderTool,
  crmCreateSlipTool,
  crmCreateTaskTool,
  crmCreateTicketTool,
  crmCurrentWorkspaceTool,
  crmDeleteBillTool,
  crmDeleteCompanyTool,
  crmDeleteContactTool,
  crmDeleteDealTool,
  crmDeleteDisbursementTool,
  crmDeleteEstimateTool,
  crmDeleteExpenseTool,
  crmDeleteInventoryTool,
  crmDeleteInvoiceTool,
  crmDeleteItemTool,
  crmDeleteLocationTool,
  crmDeleteOrderTool,
  crmDeletePaymentTool,
  crmDeletePropertyTool,
  crmDeletePurchaseOrderTool,
  crmDeleteSlipTool,
  crmDeleteSubscriptionTool,
  crmDeleteTaskTool,
  crmDeleteTicketTool,
  crmGetCalendarBootstrapTool,
  crmGetCompanyTool,
  crmGetContactTool,
  crmGetDealTool,
  crmGetPrivateMessageThreadTool,
  crmGetTaskTool,
  crmGetTicketTool,
  crmGetWorkspaceMessageThreadTool,
  crmListCompaniesTool,
  crmListContactsTool,
  crmListDealsTool,
  crmListPrivateMessagesTool,
  crmListTicketsTool,
  crmListWorkspaceMessagesTool,
  crmListWorkspacesTool,
  crmPermanentDeleteInvoiceTool,
  crmPermanentDeleteOrderTool,
  crmReplyPrivateMessageThreadTool,
  crmRescheduleCalendarAttendanceTool,
  crmSyncPrivateMessagesTool,
  crmSyncWorkspaceMessagesTool,
  crmUpdateBillTool,
  crmUpdateDisbursementTool,
  crmUpdateEstimateTool,
  crmUpdateExpenseTool,
  crmUpdateInventoryTool,
  crmUpdateInvoiceTool,
  crmUpdateItemTool,
  crmUpdateLocationTool,
  crmUpdateOrderTool,
  crmUpdatePaymentTool,
  crmUpdatePropertyTool,
  crmUpdatePurchaseOrderTool,
  crmUpdateSlipTool,
  crmUpdateTaskTool,
  crmUpdateTicketStatusTool,
  crmUpdateTicketTool,
} from '../../../packages/mcp-server/src/crm-tools';

describe('CRM tool schemas', () => {
  it.each([
    ['create_contact', crmCreateContactTool],
    ['create_expense', crmCreateExpenseTool],
    ['update_expense', crmUpdateExpenseTool],
    ['delete_expense', crmDeleteExpenseTool],
    ['create_property', crmCreatePropertyTool],
    ['update_property', crmUpdatePropertyTool],
    ['delete_property', crmDeletePropertyTool],
    ['create_order', crmCreateOrderTool],
    ['update_order', crmUpdateOrderTool],
    ['delete_order', crmDeleteOrderTool],
    ['activate_order', crmActivateOrderTool],
    ['permanent_delete_order', crmPermanentDeleteOrderTool],
    ['create_purchase_order', crmCreatePurchaseOrderTool],
    ['update_purchase_order', crmUpdatePurchaseOrderTool],
    ['delete_purchase_order', crmDeletePurchaseOrderTool],
    ['get_task', crmGetTaskTool],
    ['create_task', crmCreateTaskTool],
    ['update_task', crmUpdateTaskTool],
    ['delete_task', crmDeleteTaskTool],
    ['create_estimate', crmCreateEstimateTool],
    ['update_estimate', crmUpdateEstimateTool],
    ['delete_estimate', crmDeleteEstimateTool],
    ['create_invoice', crmCreateInvoiceTool],
    ['update_invoice', crmUpdateInvoiceTool],
    ['delete_invoice', crmDeleteInvoiceTool],
    ['activate_invoice', crmActivateInvoiceTool],
    ['permanent_delete_invoice', crmPermanentDeleteInvoiceTool],
    ['create_slip', crmCreateSlipTool],
    ['update_slip', crmUpdateSlipTool],
    ['delete_slip', crmDeleteSlipTool],
    ['create_bill', crmCreateBillTool],
    ['update_bill', crmUpdateBillTool],
    ['delete_bill', crmDeleteBillTool],
    ['create_disbursement', crmCreateDisbursementTool],
    ['update_disbursement', crmUpdateDisbursementTool],
    ['delete_disbursement', crmDeleteDisbursementTool],
    ['create_ticket', crmCreateTicketTool],
    ['update_ticket', crmUpdateTicketTool],
    ['update_ticket_status', crmUpdateTicketStatusTool],
    ['delete_ticket', crmDeleteTicketTool],
    ['create_item', crmCreateItemTool],
    ['update_item', crmUpdateItemTool],
    ['delete_item', crmDeleteItemTool],
    ['delete_subscription', crmDeleteSubscriptionTool],
    ['create_payment', crmCreatePaymentTool],
    ['update_payment', crmUpdatePaymentTool],
    ['delete_payment', crmDeletePaymentTool],
    ['create_location', crmCreateLocationTool],
    ['update_location', crmUpdateLocationTool],
    ['delete_location', crmDeleteLocationTool],
    ['create_inventory', crmCreateInventoryTool],
    ['update_inventory', crmUpdateInventoryTool],
    ['delete_inventory', crmDeleteInventoryTool],
  ])('%s outputSchema accepts null external_id', (_toolName, tool) => {
    expect((tool.tool.outputSchema as any).properties.external_id.type).toEqual(['string', 'null']);
  });

  it('allows nullable external identifiers inside order result schemas', () => {
    const orderOutputSchema = crmCreateOrderTool.tool.outputSchema as any;

    expect(orderOutputSchema.properties.results.items.properties.external_id.type).toEqual([
      'string',
      'null',
    ]);
  });

  it('allows nullable optional integration identifiers in property mutation schemas', () => {
    const propertyOutputSchema = crmCreatePropertyTool.tool.outputSchema as any;

    for (const field of ['provider', 'channel_id', 'channel_name', 'external_id', 'external_object_type']) {
      expect(propertyOutputSchema.properties[field].type).toEqual(['string', 'null']);
    }
  });

  it('advertises V2 private-message endpoints where the backend is ready', () => {
    expect(crmCurrentWorkspaceTool.metadata.httpPath).toBe('/api/v2/auth/session');
    expect(crmListWorkspacesTool.metadata.httpPath).toBe('/api/v2/auth/session');
    expect(crmListPrivateMessagesTool.metadata.httpPath).toBe('/api/v2/me/messages');
    expect(crmGetPrivateMessageThreadTool.metadata.httpPath).toBe('/api/v2/me/messages/threads/{thread_id}');
    expect(crmReplyPrivateMessageThreadTool.metadata.httpPath).toBe(
      '/api/v2/me/messages/threads/{thread_id}/reply',
    );
    expect(crmArchivePrivateMessageThreadTool.metadata.httpPath).toBe(
      '/api/v2/me/messages/threads/{thread_id}/archive',
    );
    expect(crmSyncPrivateMessagesTool.metadata.httpPath).toBe('/api/v2/me/messages/sync');
    expect(crmListWorkspaceMessagesTool.metadata.httpPath).toBe('/api/v2/workspace/messages');
    expect(crmSyncWorkspaceMessagesTool.metadata.httpPath).toBe('/api/v2/workspace/messages/sync');
    expect(crmGetWorkspaceMessageThreadTool.metadata.httpPath).toBe(
      '/api/v2/workspace/messages/threads/{thread_id}',
    );
    expect(crmGetCalendarBootstrapTool.metadata.httpPath).toBe('/api/v2/public/calendar/bootstrap');
    expect(crmCheckCalendarAvailabilityTool.metadata.httpPath).toBe('/api/v2/public/calendar/availability');
    expect(crmCreateCalendarAttendanceTool.metadata.httpPath).toBe('/api/v2/public/calendar/attendance');
    expect(crmCancelCalendarAttendanceTool.metadata.httpPath).toBe(
      '/api/v2/public/calendar/attendance/{attendance_id}/cancel',
    );
    expect(crmRescheduleCalendarAttendanceTool.metadata.httpPath).toBe(
      '/api/v2/public/calendar/attendance/{attendance_id}/reschedule',
    );
    expect(crmListCompaniesTool.metadata.httpPath).toBe('/api/v2/companies');
    expect(crmCreateCompanyTool.metadata.httpPath).toBe('/api/v2/companies');
    expect(crmGetCompanyTool.metadata.httpPath).toBe('/api/v2/companies/{company_id}');
    expect(crmDeleteCompanyTool.metadata.httpPath).toBe('/api/v2/companies/{company_id}');
    expect(crmListContactsTool.metadata.httpPath).toBe('/api/v2/contacts');
    expect(crmCreateContactTool.metadata.httpPath).toBe('/api/v2/contacts');
    expect(crmGetContactTool.metadata.httpPath).toBe('/api/v2/contacts/{contact_id}');
    expect(crmDeleteContactTool.metadata.httpPath).toBe('/api/v2/contacts/{contact_id}');
    expect(crmListDealsTool.metadata.httpPath).toBe('/api/v2/deals');
    expect(crmCreateDealTool.metadata.httpPath).toBe('/api/v2/deals');
    expect(crmGetDealTool.metadata.httpPath).toBe('/api/v2/deals/{case_id}');
    expect(crmDeleteDealTool.metadata.httpPath).toBe('/api/v2/deals/{case_id}');
    expect(crmListTicketsTool.metadata.httpPath).toBe('/api/v2/tickets');
    expect(crmCreateTicketTool.metadata.httpPath).toBe('/api/v2/tickets');
    expect(crmGetTicketTool.metadata.httpPath).toBe('/api/v2/tickets/{ticket_id}');
    expect(crmDeleteTicketTool.metadata.httpPath).toBe('/api/v2/tickets/{ticket_id}');
    expect(crmUpdateTicketStatusTool.metadata.httpPath).toBe('/api/v2/tickets/{ticket_id}/status');
  });
});
