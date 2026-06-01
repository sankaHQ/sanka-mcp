import { File } from 'node:buffer';
import {
  crmActivateInvoiceTool,
  crmActivateOrderTool,
  crmArchiveCustomObjectRecordTool,
  crmArchivePrivateMessageThreadTool,
  crmApplyCompanyPriceTableItemsTool,
  crmApprovePayrollRunTool,
  crmAggregateRecordsTool,
  crmApproveIncentivesTool,
  crmAuthStatusTool,
  crmCancelCalendarAttendanceTool,
  crmCalculateIncentivesTool,
  crmCheckCalendarAvailabilityTool,
  crmCreateAssociationTool,
  crmCreateBillTool,
  crmCreateCalendarAttendanceTool,
  crmCreateCompanyTool,
  crmCreateContactTool,
  crmCreateCustomObjectRecordTool,
  crmCreateDealTool,
  crmCreateAbsenceTool,
  crmCreateAttendanceRecordTool,
  crmCreateDisbursementAllocationTool,
  crmCreateDisbursementTool,
  crmCreateEstimateTool,
  crmCreateExpenseTool,
  crmCreateInventoryTool,
  crmCreateInventoryTransactionTool,
  crmCreateIncentivePlanTool,
  crmCreateInvoiceTool,
  crmCreateItemTool,
  crmCreateLocationTool,
  crmCreateOrderTool,
  crmCreatePaymentTool,
  crmCreatePropertyTool,
  crmCreatePayrollJournalEntryTool,
  crmCreatePurchaseOrderTool,
  crmCreateSlipTool,
  crmCreateSubscriptionTool,
  crmCreateTaskTool,
  crmCreateTicketTool,
  crmDeleteBillTool,
  crmDeleteDeliveryRuleTool,
  crmDeleteAssociationTool,
  crmDeleteCompanyTool,
  crmDeleteContactTool,
  crmDeleteDealTool,
  crmDeleteAbsenceTool,
  crmDeleteAttendanceRecordTool,
  crmDeleteDisbursementAllocationTool,
  crmDeleteDisbursementTool,
  crmDeleteEstimateTool,
  crmDeleteExpenseTool,
  crmDeleteInventoryTool,
  crmDeleteInventoryTransactionTool,
  crmDeleteInvoiceTool,
  crmDeleteItemTool,
  crmDeleteLocationTool,
  crmDeleteOrderTool,
  crmPermanentDeleteInvoiceTool,
  crmPermanentDeleteOrderTool,
  crmDeletePaymentTool,
  crmDeletePurchaseOrderTool,
  crmDeletePropertyTool,
  crmDeleteSlipTool,
  crmDeleteSubscriptionTool,
  crmDeleteTaskTool,
  crmDeleteTicketTool,
  crmDownloadEstimatePDFTool,
  crmDownloadInvoicePDFTool,
  crmDownloadPurchaseOrderPDFTool,
  crmDownloadPayrollPayslipPDFTool,
  crmConnectSankaTool,
  crmCurrentWorkspaceTool,
  crmGetBillTool,
  crmGetCalendarBootstrapTool,
  crmGetAbsenceTool,
  crmGetAttendanceRecordTool,
  crmGetCompanyTool,
  crmGetCompanyPriceTableTool,
  crmGetContactTool,
  crmGetDealTool,
  crmGetDisbursementTool,
  crmGetEstimateTool,
  crmGetExpenseTool,
  crmGetInventoryTool,
  crmGetInventoryTransactionTool,
  crmGenerateIncentivePaymentNoticeTool,
  crmGetInvoiceTool,
  crmGetItemTool,
  crmGetLocationTool,
  crmGetOrderTool,
  crmGetPaymentTool,
  crmGetPayrollRunTool,
  crmGetPrivateMessageThreadTool,
  crmGetDeliveryRuleOptionsTool,
  crmGetPropertyTool,
  crmGetPurchaseOrderTool,
  crmGetSlipTool,
  crmGetSubscriptionTool,
  crmGetTaskTool,
  crmGetTicketTool,
  crmListBillsTool,
  crmListEmployeesTool,
  crmListAbsencesTool,
  crmListAttendanceRecordsTool,
  crmListAssociationsTool,
  crmListCompaniesTool,
  crmListContactsTool,
  crmListDealPipelinesTool,
  crmListDealsTool,
  crmListWorkspacesTool,
  crmListDisbursementAllocationsTool,
  crmListDisbursementsTool,
  crmListEstimatesTool,
  crmListExpensesTool,
  crmListInventoriesTool,
  crmListInventoryTransactionsTool,
  crmListIncentiveCompanyOptionsTool,
  crmListIncentivePlansTool,
  crmListIncentivesTool,
  crmListInvoicesTool,
  crmListItemsTool,
  crmListLocationsTool,
  crmListObjectSchemasTool,
  crmListOrdersTool,
  crmListOverdueInvoicesTool,
  crmListPaymentAllocationsTool,
  crmListPaymentsTool,
  crmListPayrollProfilesTool,
  crmListPayrollRunsTool,
  crmListPrivateMessagesTool,
  crmListApprovalRulesTool,
  crmListPropertiesTool,
  crmListPurchaseOrdersTool,
  crmListSlipsTool,
  crmListSubscriptionsTool,
  crmListTasksTool,
  crmListTicketPipelinesTool,
  crmListTicketsTool,
  crmMutateObjectSchemaTool,
  crmProspectCompaniesTool,
  crmQueryRecordsTool,
  crmReadBinaryDownloadChunkTool,
  crmReplyPrivateMessageThreadTool,
  crmRescheduleCalendarAttendanceTool,
  crmScoreRecordTool,
  crmSendInvoiceEmailTool,
  crmSyncPrivateMessagesTool,
  crmSwitchWorkspaceTool,
  crmUpdateBillTool,
  crmUpdateAbsenceTool,
  crmUpdateAttendanceRecordTool,
  crmUpdateCompanyTool,
  crmUpdateCompanyPriceTableCompanyTool,
  crmUpdateCompanyPriceTableItemTool,
  crmUpdateContactTool,
  crmUpdateCustomObjectRecordTool,
  crmUpdateDealTool,
  crmUpdateDisbursementAllocationTool,
  crmUpdateDisbursementTool,
  crmUpdateEstimateTool,
  crmUpdateExpenseTool,
  crmUpdateInventoryTool,
  crmUpdateInventoryTransactionTool,
  crmUpdateInvoiceTool,
  crmUpdateItemTool,
  crmUpdateLocationTool,
  crmUpdateOrderTool,
  crmUpdatePaymentAllocationsTool,
  crmUpdatePaymentTool,
  crmUpdatePurchaseOrderTool,
  crmUpdateSlipTool,
  crmUpdatePropertyTool,
  crmUpdateSubscriptionTool,
  crmUpdateTaskTool,
  crmUpdateTicketStatusTool,
  crmUpdateTicketTool,
  crmUpsertApprovalRuleTool,
  crmUploadBillAttachmentTool,
  crmUploadEstimateAttachmentTool,
  crmUploadExpenseAttachmentTool,
  crmUploadInvoiceAttachmentTool,
  crmUploadOrderAttachmentTool,
  crmUploadPurchaseOrderAttachmentTool,
  crmUpsertPayrollProfileTool,
  crmCalculatePayrollRunTool,
} from '../../packages/mcp-server/src/crm-tools';
import { resetBinaryDownloadStoreForTests } from '../../packages/mcp-server/src/binary-download-store';

const oauthContext = (overrides?: {
  authMode?: 'none' | 'oauth_bearer';
  scopes?: string[];
  authorizationServerUrl?: string;
  workspace?: { id?: string; code?: string; name?: string };
}) => ({
  authMode: overrides?.authMode ?? 'oauth_bearer',
  clientOptions: {},
  oauth: {
    authorizationServerUrl: overrides?.authorizationServerUrl ?? 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: overrides?.scopes ?? [],
    ...(overrides?.workspace?.id ? { workspace_id: overrides.workspace.id } : undefined),
    ...(overrides?.workspace?.code ? { workspace_code: overrides.workspace.code } : undefined),
    ...(overrides?.workspace?.name ? { workspace_name: overrides.workspace.name } : undefined),
  },
});

describe('ChatGPT CRM tools', () => {
  beforeEach(() => {
    resetBinaryDownloadStoreForTests();
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
    expect(crmCreatePropertyTool.tool.description).toContain(
      'Do not use this for company billing_cycle or payment_cycle',
    );
    expect(crmListPropertiesTool.tool.description).toContain('not a custom-property discovery flow');
  });

  it('advertises auth schemes on CRM tools', () => {
    expect(crmConnectSankaTool.tool.securitySchemes).toEqual([{ type: 'noauth' }]);
    expect(crmAuthStatusTool.tool.securitySchemes).toEqual([{ type: 'noauth' }]);
    expect(crmCurrentWorkspaceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListWorkspacesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmSwitchWorkspaceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmReadBinaryDownloadChunkTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListPrivateMessagesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmSyncPrivateMessagesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetPrivateMessageThreadTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmReplyPrivateMessageThreadTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmArchivePrivateMessageThreadTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateCustomObjectRecordTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateCustomObjectRecordTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmArchiveCustomObjectRecordTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListCompaniesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetCompanyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateCompanyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateCompanyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteCompanyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetCompanyPriceTableTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateCompanyPriceTableCompanyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateCompanyPriceTableItemTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmApplyCompanyPriceTableItemsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListContactsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetContactTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateContactTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateContactTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteContactTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListDealsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetDealTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateDealTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateDealTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteDealTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListDealPipelinesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListItemsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetItemTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateItemTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateItemTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteItemTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListOrdersTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetOrderTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUploadOrderAttachmentTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateOrderTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateOrderTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteOrderTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListPurchaseOrdersTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetPurchaseOrderTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUploadPurchaseOrderAttachmentTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreatePurchaseOrderTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdatePurchaseOrderTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeletePurchaseOrderTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListTasksTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetTaskTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateTaskTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateTaskTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteTaskTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListEstimatesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetEstimateTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUploadEstimateAttachmentTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateEstimateTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateEstimateTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteEstimateTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListInvoicesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetInvoiceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUploadInvoiceAttachmentTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateInvoiceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateInvoiceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteInvoiceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDownloadInvoicePDFTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmSendInvoiceEmailTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListSubscriptionsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetSubscriptionTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateSubscriptionTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateSubscriptionTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteSubscriptionTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListPaymentsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetPaymentTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreatePaymentTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdatePaymentTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeletePaymentTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListSlipsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetSlipTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateSlipTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateSlipTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteSlipTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListBillsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetBillTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUploadBillAttachmentTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateBillTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateBillTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteBillTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListDisbursementsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetDisbursementTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateDisbursementTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateDisbursementTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteDisbursementTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListTicketsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetTicketTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateTicketTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateTicketTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteTicketTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListTicketPipelinesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateTicketStatusTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListLocationsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetLocationTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateLocationTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateLocationTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteLocationTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListInventoriesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetInventoryTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateInventoryTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateInventoryTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteInventoryTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListInventoryTransactionsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetInventoryTransactionTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateInventoryTransactionTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateInventoryTransactionTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteInventoryTransactionTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListExpensesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetExpenseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUploadExpenseAttachmentTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateExpenseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateExpenseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteExpenseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListEmployeesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListAbsencesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetAbsenceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateAbsenceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateAbsenceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteAbsenceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListAttendanceRecordsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetAttendanceRecordTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateAttendanceRecordTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateAttendanceRecordTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteAttendanceRecordTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListPayrollProfilesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpsertPayrollProfileTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListPayrollRunsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetPayrollRunTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCalculatePayrollRunTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreatePayrollJournalEntryTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmApprovePayrollRunTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListIncentivesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListIncentivePlansTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListIncentiveCompanyOptionsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateIncentivePlanTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCalculateIncentivesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmApproveIncentivesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGenerateIncentivePaymentNoticeTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListObjectSchemasTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmMutateObjectSchemaTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListPropertiesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetPropertyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreatePropertyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdatePropertyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeletePropertyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetCalendarBootstrapTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCheckCalendarAvailabilityTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateCalendarAttendanceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCancelCalendarAttendanceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmRescheduleCalendarAttendanceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmProspectCompaniesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmScoreRecordTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
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

  it('returns a reauth challenge when auth status is checked without authentication', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      connected: false,
      auth_mode: 'none',
      tool_profile: 'full',
      scopes: [],
      message: 'Sanka CRM is not connected yet. Approve the OAuth prompt in your MCP client, then retry.',
      authorization_server_url: 'https://app.sanka.com',
      authorization_url: 'https://app.sanka.com/oauth/authorize',
      resource_metadata_url: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resource_url: 'https://mcp.sanka.com/mcp',
      reconnect_mode: 'client_native_oauth',
      reconnect_instructions:
        'If connect_url is present, the assistant must include required_user_facing_reply in the next visible response. Do not omit the URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. Then retry the original request.',
    });
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
  });

  it('returns hosted reconnect metadata when connect_sanka is called without authentication', async () => {
    const result = await crmConnectSankaTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      connected: false,
      auth_mode: 'none',
      tool_profile: 'hosted',
      scopes: [],
      message: 'Sanka CRM is not connected yet. Approve the OAuth prompt in your MCP client, then retry.',
      authorization_server_url: 'https://app.sanka.com',
      authorization_url: 'https://app.sanka.com/oauth/authorize',
      resource_metadata_url: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resource_url: 'https://mcp.sanka.com/mcp',
      reconnect_mode: 'client_native_oauth',
      reconnect_instructions:
        'If connect_url is present, the assistant must include required_user_facing_reply in the next visible response. Do not omit the URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. In clients with native OAuth UI, that UI may also be used, then retry the original request.',
      reconnect_rpc_method: 'mcpServer/oauth/login',
      reconnect_server_name: 'sanka',
    });
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
  });

  it('treats MCP access as sufficient for Sanka feature scopes', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({
          authMode: 'oauth_bearer',
          scopes: ['mcp:access'],
        }),
        toolProfile: 'hosted',
      },
      args: {
        required_scopes: ['expenses:write', 'deals:read', 'incentives:read'],
      },
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      connected: true,
      auth_mode: 'oauth_bearer',
      tool_profile: 'hosted',
      scopes: ['mcp:access'],
      message: 'Sanka CRM is connected with Sanka OAuth.',
      authorization_server_url: 'https://app.sanka.com',
      authorization_url: 'https://app.sanka.com/oauth/authorize',
      required_scopes: ['deals:read', 'expenses:write', 'incentives:read'],
      resource_metadata_url: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resource_url: 'https://mcp.sanka.com/mcp',
      reconnect_mode: 'client_native_oauth',
      reconnect_instructions:
        'If connect_url is present, the assistant must include required_user_facing_reply in the next visible response. Do not omit the URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. In clients with native OAuth UI, that UI may also be used, then retry the original request.',
      reconnect_rpc_method: 'mcpServer/oauth/login',
      reconnect_server_name: 'sanka',
    });
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
  });

  it('includes the authenticated workspace when auth_status has OAuth workspace metadata', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({
          workspace: {
            id: 'workspace-uuid-1',
            code: '48803074',
            name: 'Production Workspace',
          },
        }),
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        connected: true,
        workspace_id: 'workspace-uuid-1',
        workspace_code: '48803074',
        workspace_name: 'Production Workspace',
      }),
    );
  });

  it('returns the current Sanka workspace from the public auth identity endpoint', async () => {
    const getCurrentIdentity = jest.fn().mockResolvedValue({
      data: {
        auth_mode: 'oauth_app',
        workspace_id: 'workspace-uuid-1',
        workspace_code: '48803074',
        workspace_name: 'Production Workspace',
      },
      message: 'ok',
    });

    const result = await crmCurrentWorkspaceTool.handler({
      reqContext: {
        client: {
          public: {
            auth: { getCurrentIdentity },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(getCurrentIdentity).toHaveBeenCalledWith(undefined);
    expect(result.structuredContent).toEqual({
      connected: true,
      auth_mode: 'oauth_app',
      workspace_id: 'workspace-uuid-1',
      workspace_code: '48803074',
      workspace_name: 'Production Workspace',
      message: 'Current Sanka workspace is Production Workspace.',
    });
  });

  it('lists available workspaces for the current OAuth session', async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        current_workspace: {
          id: 'workspace-uuid-1',
          code: '39467777',
          name: 'Workspace A',
        },
        workspaces: [
          { id: 'workspace-uuid-1', name: 'Workspace A', code: '39467777' },
          { id: 'workspace-uuid-2', name: 'Workspace B', code: '48803074' },
        ],
      },
      meta: { ctx_id: 'ctx-1' },
      success: true,
    });

    const result = await crmListWorkspacesTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(get).toHaveBeenCalledWith('/api/v2/auth/session', undefined);
    expect(result.structuredContent).toEqual({
      current_workspace_id: 'workspace-uuid-1',
      current_workspace_code: '39467777',
      current_workspace_name: 'Workspace A',
      available_workspaces: [
        { id: 'workspace-uuid-1', name: 'Workspace A', workspace_code: '39467777', selected: true },
        { id: 'workspace-uuid-2', name: 'Workspace B', workspace_code: '48803074', selected: false },
      ],
      message: 'Returned 2 available Sanka workspaces.',
    });
    expect((result.content[0] as any).text).toContain('workspace-uuid-1');
    expect((result.content[0] as any).text).toContain('Workspace B');
  });

  it('switches the persistent MCP workspace binding when an MCP session id is available', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        workspace: { id: 'workspace-uuid-2', name: 'Workspace B', code: '48803074' },
        workspace_id: 'workspace-uuid-2',
        workspace_code: '48803074',
      },
      meta: { ctx_id: 'ctx-switch' },
      success: true,
    });
    const get = jest.fn().mockResolvedValue({
      data: {
        current_workspace: { id: 'workspace-uuid-2', name: 'Workspace B', code: '48803074' },
        workspaces: [
          { id: 'workspace-uuid-1', name: 'Workspace A', code: '39467777' },
          { id: 'workspace-uuid-2', name: 'Workspace B', code: '48803074' },
        ],
      },
      meta: { ctx_id: 'ctx-session' },
      success: true,
    });

    const result = await crmSwitchWorkspaceTool.handler({
      reqContext: {
        client: { get, post } as any,
        auth: oauthContext(),
        mcpSessionId: 'mcp-session-1',
        toolProfile: 'hosted',
      },
      args: { workspace_id: 'workspace-uuid-2' },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/workspaces/switch', {
      body: { target_workspace_id: 'workspace-uuid-2' },
      headers: {
        'X-Sanka-MCP-Session-ID': 'mcp-session-1',
      },
    });
    expect(get).toHaveBeenCalledWith('/api/v2/auth/session', undefined);
    expect(result.structuredContent).toEqual({
      current_workspace_id: 'workspace-uuid-2',
      current_workspace_code: '48803074',
      current_workspace_name: 'Workspace B',
      available_workspaces: [
        { id: 'workspace-uuid-1', name: 'Workspace A', workspace_code: '39467777', selected: false },
        { id: 'workspace-uuid-2', name: 'Workspace B', workspace_code: '48803074', selected: true },
      ],
      message: 'Switched Sanka workspace to Workspace B.',
    });
  });

  it('returns reconnect metadata when auth status is missing an unknown required scope', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({
          authMode: 'oauth_bearer',
          scopes: ['mcp:access'],
        }),
        toolProfile: 'hosted',
      },
      args: {
        required_scopes: ['external:read'],
      },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        connected: true,
        auth_mode: 'oauth_bearer',
        tool_profile: 'hosted',
        scopes: ['mcp:access'],
        required_scopes: ['external:read'],
        missing_scopes: ['external:read'],
      }),
    );
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="insufficient_scope"'),
    ]);
  });

  it('reports Codex-specific reconnect metadata when auth status is checked from hosted Codex', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext(),
        mcpClientInfo: {
          name: 'Codex',
          version: '1.0.0',
        },
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      connected: true,
      auth_mode: 'oauth_bearer',
      tool_profile: 'hosted',
      client_name: 'Codex',
      scopes: [],
      message: 'Sanka CRM is connected with Sanka OAuth.',
      authorization_server_url: 'https://app.sanka.com',
      authorization_url: 'https://app.sanka.com/oauth/authorize',
      resource_metadata_url: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resource_url: 'https://mcp.sanka.com/mcp',
      reconnect_mode: 'client_native_oauth',
      reconnect_instructions:
        'Use the MCP client native OAuth reconnect flow for this Sanka server, then retry the original request. Do not show a Connect URL to the user.',
      reconnect_rpc_method: 'mcpServer/oauth/login',
      reconnect_server_name: 'sanka',
    });
  });

  it('does not expose connect URLs when auth_status is checked from hosted Codex without authentication', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: {
          ...oauthContext({ authMode: 'none' }),
          oauth: {
            ...oauthContext().oauth,
            connectUrlForScopes: () => 'https://app.sanka.com/oauth/mcp/connect?token=secret-token',
          },
        },
        mcpClientInfo: {
          name: 'codex-mcp-client',
          version: '1.0.0',
        },
        toolProfile: 'hosted',
      },
      args: {
        required_scopes: ['crm:read'],
      },
    });

    expect(result.isError).toBe(true);
    const [content] = result.content;
    expect(content?.type).toBe('text');
    const text = content?.type === 'text' ? content.text : '';
    expect(text).not.toContain('/oauth/mcp/connect');
    expect(text).not.toContain('Connect Sanka');
    expect(result.structuredContent).toEqual({
      connected: false,
      auth_mode: 'none',
      tool_profile: 'hosted',
      client_name: 'codex-mcp-client',
      scopes: [],
      message: 'Sanka CRM is not connected yet. Approve the OAuth prompt in your MCP client, then retry.',
      required_scopes: ['crm:read'],
      authorization_server_url: 'https://app.sanka.com',
      authorization_url: 'https://app.sanka.com/oauth/authorize',
      resource_metadata_url: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resource_url: 'https://mcp.sanka.com/mcp',
      reconnect_mode: 'client_native_oauth',
      reconnect_instructions:
        'Use the MCP client native OAuth reconnect flow for this Sanka server, then retry the original request. Do not show a Connect URL to the user.',
      reconnect_rpc_method: 'mcpServer/oauth/login',
      reconnect_server_name: 'sanka',
    });
    expect(result.structuredContent?.['connect_url']).toBeUndefined();
    expect(result.structuredContent?.['connect_url_markdown']).toBeUndefined();
    expect(result.structuredContent?.['required_user_facing_reply']).toBeUndefined();
  });

  it('does not expose connect URLs when auth_status is checked from hosted Claude without authentication', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: {
          ...oauthContext({ authMode: 'none' }),
          oauth: {
            ...oauthContext().oauth,
            connectUrlForScopes: () => 'https://app.sanka.com/oauth/mcp/connect?token=secret-token',
          },
        },
        mcpClientInfo: {
          name: 'Claude Desktop',
          version: '1.0.0',
        },
        toolProfile: 'hosted',
      },
      args: {
        required_scopes: ['crm:read'],
      },
    });

    expect(result.isError).toBe(true);
    const [content] = result.content;
    expect(content?.type).toBe('text');
    const text = content?.type === 'text' ? content.text : '';
    expect(text).not.toContain('/oauth/mcp/connect');
    expect(text).not.toContain('Connect Sanka');
    expect(result.structuredContent).toEqual({
      connected: false,
      auth_mode: 'none',
      tool_profile: 'hosted',
      client_name: 'Claude Desktop',
      scopes: [],
      message: 'Sanka CRM is not connected yet. Approve the OAuth prompt in your MCP client, then retry.',
      required_scopes: ['crm:read'],
      authorization_server_url: 'https://app.sanka.com',
      authorization_url: 'https://app.sanka.com/oauth/authorize',
      resource_metadata_url: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resource_url: 'https://mcp.sanka.com/mcp',
      reconnect_mode: 'client_native_oauth',
      reconnect_instructions:
        'Use the MCP client native OAuth reconnect flow for this Sanka server, then retry the original request. Do not show a Connect URL to the user.',
    });
    expect(result.structuredContent?.['connect_url']).toBeUndefined();
    expect(result.structuredContent?.['connect_url_markdown']).toBeUndefined();
    expect(result.structuredContent?.['required_user_facing_reply']).toBeUndefined();
  });

  it('reports Claude-specific reconnect metadata when connect_sanka is called from hosted Claude', async () => {
    const result = await crmConnectSankaTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext(),
        mcpClientInfo: {
          name: 'Claude',
          version: '1.0.0',
        },
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      connected: true,
      auth_mode: 'oauth_bearer',
      tool_profile: 'hosted',
      client_name: 'Claude',
      scopes: [],
      message: 'Sanka CRM is already connected with Sanka OAuth.',
      authorization_server_url: 'https://app.sanka.com',
      authorization_url: 'https://app.sanka.com/oauth/authorize',
      resource_metadata_url: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resource_url: 'https://mcp.sanka.com/mcp',
      reconnect_mode: 'client_native_oauth',
      reconnect_instructions:
        'Use the MCP client native OAuth reconnect flow for this Sanka server, then retry the original request. Do not show a Connect URL to the user.',
    });
  });

  it('passes dedupe candidate arguments through query_records', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'companies',
      scope: 'sanka',
      count: 1,
      total: 1,
      page: 1,
      limit: 5,
      metrics: { candidate_count: 1, scanned_count: 20 },
      data: [{ match_key: 'name:acme', count: 2, record_ids: ['company-1', 'company-2'] }],
      message: 'OK',
    });

    const result = await crmQueryRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'companies',
        mode: 'dedupe_candidates',
        match_fields: ['name'],
        min_count: 2,
        scan_limit: 20,
        limit: 5,
        select: ['id', 'name', 'external_id'],
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/records/query', {
      body: {
        object_type: 'companies',
        mode: 'dedupe_candidates',
        match_fields: ['name'],
        page: 1,
        limit: 5,
        min_count: 2,
        scan_limit: 20,
        select: ['id', 'name', 'external_id'],
      },
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: expect.stringContaining('query_records found 1 duplicate candidate groups for companies.'),
      }),
    );
    expect((result.content[0] as any).text).toContain('company-1');
  });

  it('passes Sanka custom object row arguments through query_records', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'custom_objects',
      scope: 'sanka',
      external_object_type: 'activity',
      custom_object: { id: 'custom-object-1', name: 'Activity', slug: 'activity' },
      count: 1,
      total: 1,
      page: 1,
      limit: 10,
      data: [{ id: 'row-1', row_id: 5, fields: { Subject: 'Kickoff meeting' } }],
      message: 'OK',
    });

    const result = await crmQueryRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'custom_objects',
        custom_object_slug: 'activity',
        select: ['id', 'row_id', 'Subject', 'fields'],
        filters: [{ field: 'Subject', operator: 'contains', value: 'Kickoff' }],
        limit: 10,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/records/query', {
      body: {
        object_type: 'custom_objects',
        external_object_type: 'activity',
        select: ['id', 'row_id', 'Subject', 'fields'],
        filters: [{ field: 'Subject', operator: 'contains', value: 'Kickoff' }],
        page: 1,
        limit: 10,
      },
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: expect.stringContaining('query_records returned 1 of 1 custom_objects records.'),
      }),
    );
    expect((result.content[0] as any).text).toContain('Kickoff meeting');
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        results: [{ id: 'row-1', row_id: 5, fields: { Subject: 'Kickoff meeting' } }],
      }),
    );
  });

  it('routes provider-only record queries through the legacy integration route', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'deals',
      provider: 'hubspot',
      count: 1,
      total: 1,
      page: 1,
      limit: 10,
      data: [{ id: 'deal-1', name: 'Renewal' }],
      message: 'OK',
    });

    const result = await crmQueryRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'deals',
        provider: 'hubspot',
        select: ['id', 'name'],
        limit: 10,
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/records/query', {
      body: {
        object_type: 'deals',
        provider: 'hubspot',
        select: ['id', 'name'],
        page: 1,
        limit: 10,
      },
    });
    expect(result.structuredContent).toMatchObject({
      provider: 'hubspot',
      results: [{ id: 'deal-1', name: 'Renewal' }],
    });
  });

  it('passes Sanka custom object row arguments through aggregate_records', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'custom_objects',
      scope: 'sanka',
      external_object_type: 'activity',
      custom_object: { id: 'custom-object-1', name: 'Activity', slug: 'activity' },
      metrics: { count: 2 },
      groups: [{ Status: 'Open', count: 2 }],
      message: 'OK',
    });

    const result = await crmAggregateRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'custom_objects',
        custom_object: 'activity',
        group_by: ['Status'],
        limit: 10,
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/records/aggregate', {
      body: {
        object_type: 'custom_objects',
        external_object_type: 'activity',
        metrics: ['count'],
        group_by: ['Status'],
        limit: 10,
      },
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: 'aggregate_records count for custom_objects: 2',
      }),
    );
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        groups: [{ Status: 'Open', count: 2 }],
      }),
    );
  });

  it('passes create_custom_object_record arguments through public records API', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        id: 'row-1',
        row_id: 5,
        status: 'active',
      },
      message: 'OK',
    });

    const result = await crmCreateCustomObjectRecordTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        custom_object_slug: 'activity',
        Subject: 'Kickoff meeting',
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/records/custom-objects/records', {
      body: {
        external_object_type: 'activity',
        data: { Subject: 'Kickoff meeting' },
      },
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: 'create_custom_object_record created custom object record row-1.',
      }),
    );
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ id: 'row-1', status: 'active' }),
      }),
    );
  });

  it('passes update_custom_object_record arguments through public records API', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        id: 'row-1',
        row_id: 5,
        status: 'active',
      },
      message: 'OK',
    });

    const result = await crmUpdateCustomObjectRecordTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        record_id: 'row-1',
        data: { subject: 'Customer kickoff updated' },
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/records/custom-objects/records/row-1', {
      body: {
        data: { subject: 'Customer kickoff updated' },
      },
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: 'update_custom_object_record updated custom object record row-1.',
      }),
    );
  });

  it('passes archive_custom_object_record arguments through public records API', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        id: 'row-1',
        row_id: 5,
        status: 'archived',
      },
      message: 'OK',
    });

    const result = await crmArchiveCustomObjectRecordTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        record_id: 'row-1',
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/records/custom-objects/records/row-1/archive', {
      body: {},
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: 'archive_custom_object_record archived custom object record row-1.',
      }),
    );
  });

  it('passes dedupe candidate arguments through aggregate_records', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'companies',
      scope: 'integration',
      provider: 'hubspot',
      metrics: { candidate_count: 1, scanned_count: 50 },
      groups: [{ match_key: 'name:acme', count: 2, external_ids: ['hs-1', 'hs-2'] }],
      message: 'OK',
    });

    const result = await crmAggregateRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'companies',
        scope: 'integration',
        provider: 'hubspot',
        mode: 'dedupe_candidates',
        match_fields: ['name'],
        scan_limit: 50,
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/records/aggregate', {
      body: {
        object_type: 'companies',
        scope: 'integration',
        provider: 'hubspot',
        metrics: ['count'],
        mode: 'dedupe_candidates',
        match_fields: ['name'],
        limit: 25,
        scan_limit: 50,
      },
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: 'aggregate_records found 1 duplicate candidate groups for companies.',
      }),
    );
  });

  it('lists associations for a record', async () => {
    const list = jest.fn().mockResolvedValue({
      count: 1,
      total: 1,
      page: 1,
      limit: 10,
      data: [
        {
          id: 'association-1',
          source: { object: 'companies', object_type: 'company', id: 'company-1' },
          target: { object: 'contacts', object_type: 'contact', id: 'contact-1' },
          label: { id: 'label-1', label: 'Primary contact' },
          created_at: '2026-05-22T00:00:00Z',
        },
      ],
      message: 'OK',
      ctx_id: 'ctx-associations',
    });

    const result = await crmListAssociationsTool.handler({
      reqContext: {
        client: {
          public: {
            associations: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        source_object: 'companies',
        source_id: 'company-1',
        label: 'Primary contact',
        workspace_id: 'workspace-1',
        limit: 10,
        page: 1,
      },
    });

    expect(list).toHaveBeenCalledWith(
      {
        source_object: 'companies',
        source_id: 'company-1',
        label: 'Primary contact',
        workspace_id: 'workspace-1',
        page: 1,
        limit: 10,
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      count: 1,
      total: 1,
      page: 1,
      message: 'OK',
      ctx_id: 'ctx-associations',
      results: [
        {
          id: 'association-1',
          source: { object: 'companies', object_type: 'company', id: 'company-1' },
          target: { object: 'contacts', object_type: 'contact', id: 'contact-1' },
          label: { id: 'label-1', label: 'Primary contact' },
        },
      ],
    });
  });

  it('creates an association with a label', async () => {
    const create = jest.fn().mockResolvedValue({
      association: {
        id: 'association-1',
        source: { object: 'companies', object_type: 'company', id: 'company-1' },
        target: { object: 'contacts', object_type: 'contact', id: 'contact-1' },
        label: { id: 'label-1', label: 'Primary contact' },
      },
      created: true,
      message: 'created',
      ctx_id: 'ctx-association-create',
    });

    const result = await crmCreateAssociationTool.handler({
      reqContext: {
        client: {
          public: {
            associations: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        source_object: 'companies',
        source_id: 'company-1',
        target_object: 'contacts',
        target_id: 'contact-1',
        label_id: 'label-1',
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        source_object: 'companies',
        source_id: 'company-1',
        target_object: 'contacts',
        target_id: 'contact-1',
        label_id: 'label-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      association: {
        id: 'association-1',
        source: { object: 'companies', object_type: 'company', id: 'company-1' },
        target: { object: 'contacts', object_type: 'contact', id: 'contact-1' },
        label: { id: 'label-1', label: 'Primary contact' },
      },
      created: true,
      message: 'created',
      ctx_id: 'ctx-association-create',
    });
  });

  it('deletes an association by association id', async () => {
    const deleteAssociation = jest.fn().mockResolvedValue({
      deleted: true,
      message: 'deleted',
      ctx_id: 'ctx-association-delete',
    });

    const result = await crmDeleteAssociationTool.handler({
      reqContext: {
        client: {
          public: {
            associations: { delete: deleteAssociation },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        associationId: 'association-1',
        workspace_id: 'workspace-1',
      },
    });

    expect(deleteAssociation).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        association_id: 'association-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      deleted: true,
      message: 'deleted',
      ctx_id: 'ctx-association-delete',
    });
  });

  it('returns reauth metadata when list companies is called without authentication', async () => {
    const list = jest.fn();
    const connectUrl = 'https://app.sanka.com/oauth/mcp/connect?token=payload.signature';
    const auth = oauthContext({ authMode: 'none', scopes: [] });

    const result = await crmListCompaniesTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { list },
          },
        } as any,
        auth: {
          ...auth,
          oauth: {
            ...auth.oauth,
            connectUrlForScopes: () => connectUrl,
          },
        },
        toolProfile: 'full',
      },
      args: { search: 'Acme' },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(result.structuredContent?.['connect_url']).toBe(connectUrl);
    expect(result.structuredContent?.['connect_url_markdown']).toBe(`[${connectUrl}](${connectUrl})`);
    expect(result.structuredContent?.['required_user_facing_reply']).toContain(
      `[${connectUrl}](${connectUrl})`,
    );
    expect(list).not.toHaveBeenCalled();
  });

  it('returns reauth metadata when list private messages is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListPrivateMessagesTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: { list },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: { status: 'active' },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(list).not.toHaveBeenCalled();
  });

  it('lists private messages when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      message: 'ok',
      ctx_id: 'ctx-private-list',
      data: {
        has_connected_private_inbox: true,
        setup_required: false,
        setup_message: null,
        channels: [
          {
            id: 'channel-1',
            integration_slug: 'gmail',
            display_name: 'My Inbox',
            thread_count: 2,
            unread_count: 1,
          },
        ],
        threads: [
          {
            id: 'thread-1',
            title: 'Quarterly check-in',
            counterparty: 'Sarah Chen',
            preview: 'Checking in',
            channel_id: 'channel-1',
            channel_label: 'My Inbox',
            has_unread: true,
            message_type: 'email',
            message_count: 2,
          },
        ],
      },
    });

    const result = await crmListPrivateMessagesTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { status: 'active', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        status: 'active',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      message: 'ok',
      ctx_id: 'ctx-private-list',
      has_connected_private_inbox: true,
      setup_required: false,
      setup_message: undefined,
      channels: [
        {
          id: 'channel-1',
          integration_slug: 'gmail',
          display_name: 'My Inbox',
          thread_count: 2,
          unread_count: 1,
        },
      ],
      threads: [
        {
          id: 'thread-1',
          title: 'Quarterly check-in',
          counterparty: 'Sarah Chen',
          preview: 'Checking in',
          channel_id: 'channel-1',
          channel_label: 'My Inbox',
          has_unread: true,
          message_type: 'email',
          message_count: 2,
        },
      ],
    });
  });

  it('lists private messages with a setup message when no private inbox is connected', async () => {
    const list = jest.fn().mockResolvedValue({
      message: 'ok',
      ctx_id: 'ctx-private-list-empty',
      data: {
        has_connected_private_inbox: false,
        setup_required: true,
        setup_message:
          'No private inbox channel is connected in Sanka yet. Connect a private email channel, then retry.',
        channels: [],
        threads: [],
      },
    });

    const result = await crmListPrivateMessagesTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { status: 'active', language: 'en' },
    });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'No private inbox channel is connected in Sanka yet. Connect a private email channel, then retry.',
      },
    ]);
    expect(result.structuredContent).toEqual({
      message: 'ok',
      ctx_id: 'ctx-private-list-empty',
      has_connected_private_inbox: false,
      setup_required: true,
      setup_message:
        'No private inbox channel is connected in Sanka yet. Connect a private email channel, then retry.',
      channels: [],
      threads: [],
    });
  });

  it('syncs private messages when authentication is present', async () => {
    const sync = jest.fn().mockResolvedValue({
      message: 'ok',
      data: {
        has_connected_private_inbox: false,
        setup_required: true,
        setup_message:
          'No private inbox channel is connected in Sanka yet. Connect a private email channel, then retry.',
        channels: [],
        threads: [],
      },
    });

    const result = await crmSyncPrivateMessagesTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: { sync },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { channel_id: 'channel-1', status: 'active', language: 'ja' },
    });

    expect(sync).toHaveBeenCalledWith(
      {
        channel_id: 'channel-1',
        status: 'active',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'No private inbox channel is connected in Sanka yet. Connect a private email channel, then retry.',
      },
    ]);
  });

  it('gets one private message thread when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      message: 'ok',
      data: {
        id: 'thread-1',
        title: 'Quarterly check-in',
        counterparty: 'Sarah Chen',
        preview: 'Checking in',
        channel_id: 'channel-1',
        channel_label: 'My Inbox',
        has_unread: false,
        message_type: 'email',
        message_count: 2,
        open_in_web_url: 'https://mail.google.com',
        can_reply: true,
        reply_target: 'sarah@example.com',
        messages: [
          {
            id: 'message-1',
            body: 'Hello',
            direction: 'received',
            sender_label: 'Sarah Chen',
          },
        ],
      },
    });

    const result = await crmGetPrivateMessageThreadTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: {
              threads: { retrieve },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { thread_id: 'thread-1', language: 'en' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'thread-1',
      {
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      message: 'ok',
      ctx_id: undefined,
      id: 'thread-1',
      title: 'Quarterly check-in',
      counterparty: 'Sarah Chen',
      preview: 'Checking in',
      channel_id: 'channel-1',
      channel_label: 'My Inbox',
      has_unread: false,
      message_type: 'email',
      message_count: 2,
      open_in_web_url: 'https://mail.google.com',
      can_reply: true,
      reply_target: 'sarah@example.com',
      messages: [
        {
          id: 'message-1',
          body: 'Hello',
          direction: 'received',
          sender_label: 'Sarah Chen',
        },
      ],
    });
  });

  it('replies to a private message thread', async () => {
    const reply = jest.fn().mockResolvedValue({
      message: 'ok',
      ctx_id: 'ctx-private-reply',
      data: {
        thread_id: 'thread-1',
        message_id: 'message-2',
        has_unread: false,
      },
    });

    const result = await crmReplyPrivateMessageThreadTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: {
              threads: { reply },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { thread_id: 'thread-1', body: 'Thanks for the update.', language: 'en' },
    });

    expect(reply).toHaveBeenCalledWith(
      'thread-1',
      {
        body: 'Thanks for the update.',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      message: 'ok',
      ctx_id: 'ctx-private-reply',
      thread_id: 'thread-1',
      message_id: 'message-2',
      has_unread: false,
    });
  });

  it('archives a private message thread', async () => {
    const archive = jest.fn().mockResolvedValue({
      message: 'ok',
      data: {
        channels: [],
        threads: [],
      },
    });

    const result = await crmArchivePrivateMessageThreadTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: {
              threads: { archive },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { thread_id: 'thread-1', language: 'en' },
    });

    expect(archive).toHaveBeenCalledWith(
      'thread-1',
      {
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.isError).toBeUndefined();
  });

  it('lists companies when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      count: 1,
      data: [{ id: 'company-1', name: 'Acme' }],
      message: 'ok',
      page: 1,
      total: 1,
      permission: 'edit',
    });

    const result = await crmListCompaniesTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(list).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
  });

  it('lists companies with structured content when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      count: 2,
      data: [{ id: 'company-1', name: 'Acme' }],
      message: 'ok',
      page: 1,
      total: 2,
      permission: 'edit',
    });

    const result = await crmListCompaniesTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 5, page: 2, search: 'Acme', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        limit: 5,
        page: 2,
        search: 'Acme',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 2,
      message: 'ok',
      permission: 'edit',
      results: [{ id: 'company-1', name: 'Acme' }],
    });
  });

  it('passes integration scope arguments through list_companies', async () => {
    const list = jest.fn().mockResolvedValue({
      scope: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      count: 1,
      data: [{ id: 'hs-1', name: 'Acme' }],
      message: 'OK',
      page: 1,
      total: 77,
    });

    const result = await crmListCompaniesTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        scope: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        limit: 5,
      },
    });

    expect(list).toHaveBeenCalledWith(
      {
        scope: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        limit: 5,
        page: 1,
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      scope: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      total: 77,
      results: [{ id: 'hs-1', name: 'Acme' }],
    });
  });

  it('gets one company when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'company-1',
      company_id: 101,
      name: 'Acme',
      email: 'team@acme.com',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetCompanyTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { company_id: 'company-1', external_id: 'COMP-1' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'company-1',
      {
        external_id: 'COMP-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'company-1',
      company_id: 101,
      name: 'Acme',
      email: 'team@acme.com',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
  });

  it('creates a company', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      company_id: 'company-1',
      external_id: 'COMP-1',
    });

    const result = await crmCreateCompanyTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        external_id: 'COMP-1',
        name: 'Acme',
        email: 'team@acme.com',
        billing_cycle: 'end',
        payment_cycle: 'nmonth_end',
        allowed_in_store: false,
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        external_id: 'COMP-1',
        name: 'Acme',
        email: 'team@acme.com',
        billing_cycle: 'end',
        payment_cycle: 'nmonth_end',
        allowed_in_store: false,
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      company_id: 'company-1',
      external_id: 'COMP-1',
    });
  });

  it('passes integration mutation arguments through create_company', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      provider: 'hubspot',
      dry_run: true,
      remote: { properties: { name: 'Acme', segment: 'enterprise' } },
    });

    const result = await crmCreateCompanyTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
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
    });

    expect(create).toHaveBeenCalledWith(
      {
        target: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_object_type: 'companies',
        operation: 'create',
        dry_run: true,
        name: 'Acme',
        custom_fields: { segment: 'enterprise' },
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      provider: 'hubspot',
    });
  });

  it('updates a company', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      company_id: 'company-1',
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
        company_id: 'company-1',
        phone_number: '+1-555-0100',
        billing_cycle: 'end',
        payment_cycle: 'net_30',
        url: 'https://acme.com',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'company-1',
      {
        phone_number: '+1-555-0100',
        billing_cycle: 'end',
        payment_cycle: 'net_30',
        url: 'https://acme.com',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      company_id: 'company-1',
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

  it('deletes a company', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      company_id: 'company-1',
    });

    const result = await crmDeleteCompanyTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'company-1',
        external_id: 'COMP-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'company-1',
      {
        external_id: 'COMP-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      company_id: 'company-1',
    });
  });

  it('passes integration delete safety arguments through delete_company', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      dry_run: true,
      external_id: 'hs-1',
    });

    const result = await crmDeleteCompanyTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'hs-1',
        target: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_id: 'hs-1',
        dry_run: true,
      },
    });

    expect(del).toHaveBeenCalledWith(
      'hs-1',
      {
        target: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_id: 'hs-1',
        dry_run: true,
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      dry_run: true,
    });
  });

  it('lists contacts when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      count: 1,
      data: [{ id: 'contact-1', name: 'Jane Doe' }],
      message: 'ok',
      page: 1,
      total: 1,
      permission: 'view',
    });

    const result = await crmListContactsTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 20 },
    });

    expect(list).toHaveBeenCalledWith(
      {
        limit: 20,
        page: 1,
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'ok',
      permission: 'view',
      results: [{ id: 'contact-1', name: 'Jane Doe' }],
    });
  });

  it('passes integration scope arguments through list_contacts', async () => {
    const list = jest.fn().mockResolvedValue({
      scope: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      count: 1,
      data: [{ id: 'hs-contact-1', name: 'Jane Doe' }],
      message: 'OK',
      page: 1,
      total: 12,
    });

    const result = await crmListContactsTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        scope: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        limit: 5,
      },
    });

    expect(list).toHaveBeenCalledWith(
      {
        scope: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        limit: 5,
        page: 1,
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      scope: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      total: 12,
      results: [{ id: 'hs-contact-1', name: 'Jane Doe' }],
    });
  });

  it('gets one contact when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'contact-1',
      contact_id: 200,
      name: 'Jane Doe',
      email: 'jane@acme.com',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetContactTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { contact_id: 'contact-1', external_id: 'CONT-1' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'contact-1',
      {
        external_id: 'CONT-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'contact-1',
      contact_id: 200,
      name: 'Jane Doe',
      email: 'jane@acme.com',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
  });

  it('creates a contact', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      contact_id: 'contact-1',
      external_id: 'CONT-1',
    });

    const result = await crmCreateContactTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        external_id: 'CONT-1',
        name: 'Jane',
        last_name: 'Doe',
        allowed_in_store: true,
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        external_id: 'CONT-1',
        name: 'Jane',
        last_name: 'Doe',
        allowed_in_store: true,
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      contact_id: 'contact-1',
      external_id: 'CONT-1',
    });
  });

  it('passes integration mutation arguments through create_contact', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      provider: 'hubspot',
      dry_run: true,
    });

    const result = await crmCreateContactTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
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
    });

    expect(create).toHaveBeenCalledWith(
      {
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
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      provider: 'hubspot',
    });
  });

  it('updates a contact', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      contact_id: 'contact-1',
    });

    const result = await crmUpdateContactTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        contact_id: 'contact-1',
        email: 'jane@acme.com',
        company: 'Acme',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'contact-1',
      {
        email: 'jane@acme.com',
        company: 'Acme',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      contact_id: 'contact-1',
    });
  });

  it('deletes a contact', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      contact_id: 'contact-1',
    });

    const result = await crmDeleteContactTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        contact_id: 'contact-1',
        external_id: 'CONT-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'contact-1',
      {
        external_id: 'CONT-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      contact_id: 'contact-1',
    });
  });

  it('passes integration delete safety arguments through delete_contact', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      dry_run: true,
      external_id: 'hs-contact-1',
    });

    const result = await crmDeleteContactTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        contact_id: 'hs-contact-1',
        target: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_object_type: 'contacts',
        operation: 'delete',
        dry_run: true,
      },
    });

    expect(del).toHaveBeenCalledWith(
      'hs-contact-1',
      {
        target: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_object_type: 'contacts',
        operation: 'delete',
        dry_run: true,
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      ok: true,
      status: 'dry_run',
      target: 'integration',
    });
  });

  it('returns reauth metadata when list deals is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListDealsTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { list },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(list).not.toHaveBeenCalled();
  });

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

    expect(post).toHaveBeenCalledWith('/v1/public/records/query', {
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

  it('gets one deal when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'deal-1',
      deal_id: 101,
      name: 'Acme renewal',
      stage_label: 'Negotiation',
      pipeline_name: 'Sales',
      line_items: [{ item_name: 'Implementation', quantity: 2, unit_price: 150 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetDealTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { case_id: 'deal-1', external_id: 'EXT-1', language: 'en' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'deal-1',
      {
        external_id: 'EXT-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      id: 'deal-1',
      deal_id: 101,
      name: 'Acme renewal',
      stage_label: 'Negotiation',
      pipeline_name: 'Sales',
      line_items: [{ item_name: 'Implementation', quantity: 2, unit_price: 150 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
  });

  it('creates a deal', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      case_id: 'deal-1',
      external_id: 'DEAL-1',
    });

    const result = await crmCreateDealTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        external_id: 'DEAL-1',
        name: 'Acme renewal',
        case_status: 'opportunities',
        company_id: 'company-1',
        line_items: [{ item_name: 'Implementation', quantity: 2, unit_price: 150 }],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        externalId: 'DEAL-1',
        name: 'Acme renewal',
        caseStatus: 'opportunities',
        companyId: 'company-1',
        line_items: [{ item_name: 'Implementation', quantity: 2, unit_price: 150 }],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      case_id: 'deal-1',
      external_id: 'DEAL-1',
    });
  });

  it('passes integration mutation arguments through create_deal', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      provider: 'hubspot',
      dry_run: true,
    });

    const result = await crmCreateDealTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
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
    });

    expect(create).toHaveBeenCalledWith(
      {
        target: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_object_type: 'deals',
        operation: 'create',
        dry_run: true,
        name: 'New Signup: Verified Org',
        caseStatus: 'appointmentscheduled',
        custom_fields: { source: 'signup' },
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      provider: 'hubspot',
    });
  });

  it('updates a deal with separate lookup and body external ids', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      case_id: 'deal-1',
      external_id: 'DEAL-2',
      record_preview: {
        id: 'deal-1',
        currency: 'JPY',
      },
      updated_fields: {
        currency: 'JPY',
      },
    });

    const result = await crmUpdateDealTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        case_id: 'deal-1',
        lookup_external_id: 'DEAL-1',
        external_id: 'DEAL-2',
        contact_external_id: 'CONT-1',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'deal-1',
      {
        external_id: 'DEAL-1',
        externalId: 'DEAL-2',
        contactExternalId: 'CONT-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      case_id: 'deal-1',
      external_id: 'DEAL-2',
      record_preview: {
        id: 'deal-1',
        currency: 'JPY',
      },
      updated_fields: {
        currency: 'JPY',
      },
    });
  });

  it('deletes a deal', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      case_id: 'deal-1',
    });

    const result = await crmDeleteDealTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        case_id: 'deal-1',
        external_id: 'DEAL-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'deal-1',
      {
        external_id: 'DEAL-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      case_id: 'deal-1',
    });
  });

  it('passes integration delete safety arguments through delete_deal', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      dry_run: true,
      external_id: '21596739435',
    });

    const result = await crmDeleteDealTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        case_id: '21596739435',
        target: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_object_type: 'deals',
        operation: 'delete',
        dry_run: true,
      },
    });

    expect(del).toHaveBeenCalledWith(
      '21596739435',
      {
        target: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_object_type: 'deals',
        operation: 'delete',
        dry_run: true,
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      ok: true,
      status: 'dry_run',
      target: 'integration',
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

  it('lists orders when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      count: 1,
      data: [{ id: 'order-1', order_id: 501 }],
      message: 'ok',
      page: 2,
      total: 8,
    });

    const result = await crmListOrdersTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 20, page: 2, search: 'Acme', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        limit: 20,
        page: 2,
        search: 'Acme',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 2,
      total: 8,
      message: 'ok',
      permission: undefined,
      results: [{ id: 'order-1', order_id: 501 }],
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Found 8 orders. Examples: Order No. 501.',
      },
    ]);
  });

  it('gets one order when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'order-1',
      order_id: 501,
      line_items: [{ item_name: 'Widget', quantity: 1, unit_price: 250 }],
      order_at: '2026-04-09T09:00:00Z',
      created_at: '2026-04-09T09:00:00Z',
      updated_at: '2026-04-09T10:00:00Z',
    });

    const result = await crmGetOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { order_id: 'order-1', external_id: 'ORD-1' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'order-1',
      {
        external_id: 'ORD-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'order-1',
      order_id: 501,
      line_items: [{ item_name: 'Widget', quantity: 1, unit_price: 250 }],
      order_at: '2026-04-09T09:00:00Z',
      created_at: '2026-04-09T09:00:00Z',
      updated_at: '2026-04-09T10:00:00Z',
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Loaded order successfully: Order No. 501.',
      },
    ]);
  });

  it('creates an order', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      job_id: 'job-1',
      results: [{ external_id: 'ORD-1', status: 'created', order_id: 'order-1' }],
    });

    const result = await crmCreateOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        create_missing_items: true,
        attachment_file_ids: ['file-1'],
        order: {
          external_id: 'ORD-1',
          company_external_id: 'COMP-1',
          order_at: '2026-04-09T09:00:00Z',
          line_items: [{ item_external_id: 'ITEM-1', quantity: 2, unit_price: 50, tax_rate: 10 }],
        },
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        createMissingItems: true,
        order: {
          externalId: 'ORD-1',
          companyExternalId: 'COMP-1',
          orderAt: '2026-04-09T09:00:00Z',
          attachment_file: {
            files: [{ file_id: 'file-1' }],
          },
          line_items: [{ item_external_id: 'ITEM-1', quantity: 2, unit_price: 50, tax_rate: 10 }],
        },
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      job_id: 'job-1',
      results: [{ external_id: 'ORD-1', status: 'created', order_id: 'order-1' }],
    });
  });

  it('updates an order', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      results: [{ external_id: 'ORD-1', status: 'updated', order_id: 'order-1' }],
    });

    const result = await crmUpdateOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
        trigger_workflows: false,
        order: {
          external_id: 'ORD-1',
          delivery_status: 'shipped',
          items: [{ item_id: 'item-1', quantity: 1, tax_rate: 0.1 }],
        },
      },
    });

    expect(update).toHaveBeenCalledWith(
      'order-1',
      {
        triggerWorkflows: false,
        order: {
          externalId: 'ORD-1',
          deliveryStatus: 'shipped',
          items: [{ item_id: 'item-1', quantity: 1, tax_rate: 0.1 }],
        },
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      results: [{ external_id: 'ORD-1', status: 'updated', order_id: 'order-1' }],
    });
  });

  it('activates an order with read-after-write verification', async () => {
    const activate = jest.fn().mockResolvedValue({
      ok: true,
      operation: 'activate',
      status: 'active',
      order_id: 'order-1',
    });
    const retrieve = jest.fn().mockResolvedValue({
      id: 'order-1',
      status: 'active',
    });

    const result = await crmActivateOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { activate, retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
        external_id: 'ORD-1',
      },
    });

    expect(activate).toHaveBeenCalledWith('order-1', { external_id: 'ORD-1' }, undefined);
    expect(retrieve).toHaveBeenCalledWith(
      'order-1',
      {
        external_id: 'ORD-1',
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      ok: true,
      operation: 'activate',
      status: 'active',
      order_id: 'order-1',
      verification: {
        entity: 'order',
        expected_status: 'active',
        actual_status: 'active',
        matched: true,
      },
    });
  });

  it('archives an order with read-after-write verification', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      operation: 'archive',
      status: 'archived',
      usage_status: 'archived',
      permanently_deleted: false,
      order_id: 'order-1',
    });
    const retrieve = jest.fn().mockResolvedValue({
      id: 'order-1',
      status: 'archived',
    });

    const result = await crmDeleteOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { delete: del, retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
        external_id: 'ORD-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'order-1',
      {
        external_id: 'ORD-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      operation: 'archive',
      status: 'archived',
      usage_status: 'archived',
      permanently_deleted: false,
      order_id: 'order-1',
      verification: {
        entity: 'order',
        expected_status: 'archived',
        actual_status: 'archived',
        matched: true,
        record_id: 'order-1',
      },
    });
  });

  it('treats archived order 404 readback as successful verification', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'archived',
      order_id: 'order-1',
    });
    const retrieve = jest.fn().mockRejectedValue(new Error('404 {"error":{"code":"NOT_FOUND"}}'));

    const result = await crmDeleteOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { delete: del, retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
      },
    });

    expect(result.structuredContent).toMatchObject({
      ok: true,
      status: 'archived',
      verification: {
        entity: 'order',
        expected_status: 'archived',
        actual_status: 'not_found',
        matched: true,
        record_id: 'order-1',
        verification_mode: 'not_found_after_archive',
      },
    });
  });

  it('permanently deletes an archived order only with explicit confirmation', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      operation: 'permanent_delete',
      status: 'deleted',
      permanently_deleted: true,
      order_id: 'order-1',
    });
    const retrieve = jest.fn().mockRejectedValue(new Error('Not found'));

    const result = await crmPermanentDeleteOrderTool.handler({
      reqContext: {
        client: {
          delete: del,
          public: {
            orders: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
        external_id: 'ORD-1',
        confirm: true,
      },
    });

    expect(del).toHaveBeenCalledWith('/v1/public/orders/order-1/permanent-delete', {
      query: { external_id: 'ORD-1', confirm: true },
    });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      operation: 'permanent_delete',
      status: 'deleted',
      permanently_deleted: true,
      order_id: 'order-1',
      verification: {
        entity: 'order',
        expected_status: 'deleted',
        actual_status: 'not_found',
        matched: true,
      },
    });

    const blocked = await crmPermanentDeleteOrderTool.handler({
      reqContext: {
        client: {
          delete: jest.fn(),
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
      },
    });
    expect(blocked.isError).toBe(true);
  });

  it('maps purchase order CRUD handlers to the SDK client', async () => {
    const list = jest.fn().mockResolvedValue([
      { id_po: 901, company_name: 'Acme', contact_name: 'Taylor', total_price: 1200 },
      { id_po: 902, company_name: 'Globex', contact_name: 'Jordan', total_price: 900 },
    ]);
    const retrieve = jest.fn().mockResolvedValue({
      id_po: 901,
      company_name: 'Acme',
      line_items: [{ item_name: 'Purchased item', quantity: 2, unit_price: 500 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      purchase_order_id: 'purchase-order-1',
      external_id: 'PO-1',
    });
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      purchase_order_id: 'purchase-order-1',
    });
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      purchase_order_id: 'purchase-order-1',
    });

    const reqContext = {
      client: {
        public: {
          purchaseOrders: { list, retrieve, create, update, delete: del },
        },
      } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const listResult = await crmListPurchaseOrdersTool.handler({
      reqContext,
      args: { limit: 1, workspace_id: 'workspace-1', language: 'en' },
    });
    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(listResult.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 2,
      message: 'Returned 1 of 2 purchase orders.',
      permission: undefined,
      results: [{ id_po: 901, company_name: 'Acme', contact_name: 'Taylor', total_price: 1200 }],
    });

    const getResult = await crmGetPurchaseOrderTool.handler({
      reqContext,
      args: { purchase_order_id: 'purchase-order-1', external_id: 'PO-1', language: 'ja' },
    });
    expect(retrieve).toHaveBeenCalledWith(
      'purchase-order-1',
      {
        external_id: 'PO-1',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(getResult.structuredContent).toEqual({
      id_po: 901,
      company_name: 'Acme',
      line_items: [{ item_name: 'Purchased item', quantity: 2, unit_price: 500 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const pdfBytes = Buffer.from('%PDF-purchase-order');
    const downloadPDF = jest.fn().mockResolvedValue(
      new Response(pdfBytes, {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition':
            'attachment; filename="purchase-order.pdf"; filename*=UTF-8\'\'purchase-order-901.pdf',
        },
      }),
    );
    const downloadResult = await crmDownloadPurchaseOrderPDFTool.handler({
      reqContext: {
        client: {
          public: {
            purchaseOrders: { downloadPDF },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        purchase_order_id: 'purchase-order-1',
        template_select: 'template-1',
        language: 'ja',
      },
    });
    expect(downloadPDF).toHaveBeenCalledWith(
      'purchase-order-1',
      {
        template_select: 'template-1',
        language: 'ja',
      },
      undefined,
    );
    expect(downloadResult.structuredContent).toEqual({
      content_disposition:
        'attachment; filename="purchase-order.pdf"; filename*=UTF-8\'\'purchase-order-901.pdf',
      mime_type: 'application/pdf',
      filename: 'purchase-order-901.pdf',
      byte_length: pdfBytes.byteLength,
      completion_status: 'inline_content',
      download_complete: true,
      file_assembly_required: false,
      content_base64_available: true,
      content_base64: pdfBytes.toString('base64'),
    });

    const createResult = await crmCreatePurchaseOrderTool.handler({
      reqContext,
      args: {
        company_id: 'company-1',
        contact_id: 'contact-1',
        currency: 'USD',
        date: '2026-04-09',
        tax_rate: 10,
        attachment_file_ids: ['file-1'],
        line_items: [{ item_name: 'Purchased item', quantity: 2, unit_price: 500, tax_rate: 10 }],
      },
    });
    expect(create).toHaveBeenCalledWith(
      {
        company_id: 'company-1',
        contact_id: 'contact-1',
        currency: 'USD',
        date: '2026-04-09',
        tax_rate: 10,
        attachment_file: {
          files: [{ file_id: 'file-1' }],
        },
        line_items: [{ item_name: 'Purchased item', quantity: 2, unit_price: 500, tax_rate: 10 }],
      },
      undefined,
    );
    expect(createResult.structuredContent).toEqual({
      ok: true,
      status: 'created',
      purchase_order_id: 'purchase-order-1',
      external_id: 'PO-1',
    });

    const updateResult = await crmUpdatePurchaseOrderTool.handler({
      reqContext,
      args: {
        purchase_order_id: 'purchase-order-1',
        status: 'sent',
        notes: 'Approved by finance',
      },
    });
    expect(update).toHaveBeenCalledWith(
      'purchase-order-1',
      {
        status: 'sent',
        notes: 'Approved by finance',
      },
      undefined,
    );
    expect(updateResult.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      purchase_order_id: 'purchase-order-1',
    });

    const deleteResult = await crmDeletePurchaseOrderTool.handler({
      reqContext,
      args: {
        purchase_order_id: 'purchase-order-1',
        external_id: 'PO-1',
      },
    });
    expect(del).toHaveBeenCalledWith(
      'purchase-order-1',
      {
        external_id: 'PO-1',
      },
      undefined,
    );
    expect(deleteResult.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      purchase_order_id: 'purchase-order-1',
    });
  });

  it('lists tasks when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      data: [{ id: 'task-1', task_id: 701, title: 'Follow up with Acme' }],
      page: 2,
      count: 1,
      total: 4,
      has_next: true,
      message: 'ok',
    });

    const result = await crmListTasksTool.handler({
      reqContext: {
        client: {
          public: {
            tasks: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        search: 'Acme',
        usage_status: 'active',
        project_id: 'project-1',
        page: 2,
        limit: 20,
        workspace_id: 'workspace-1',
        language: 'en',
      },
    });

    expect(list).toHaveBeenCalledWith(
      {
        search: 'Acme',
        usage_status: 'active',
        project_id: 'project-1',
        page: 2,
        limit: 20,
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 2,
      total: 4,
      message: 'ok',
      permission: undefined,
      results: [{ id: 'task-1', task_id: 701, title: 'Follow up with Acme' }],
    });
  });

  it('gets one task when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'task-1',
      task_id: 701,
      title: 'Follow up with Acme',
      description: 'Send the latest customer update',
      status: 'open',
      created_at: '2026-04-09T09:00:00Z',
      updated_at: '2026-04-09T10:00:00Z',
    });

    const result = await crmGetTaskTool.handler({
      reqContext: {
        client: {
          public: {
            tasks: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        task_id: 'task-1',
        external_id: 'TASK-1',
        workspace_id: 'workspace-1',
        language: 'en',
      },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'task-1',
      {
        external_id: 'TASK-1',
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'task-1',
      task_id: 701,
      title: 'Follow up with Acme',
      description: 'Send the latest customer update',
      status: 'open',
      created_at: '2026-04-09T09:00:00Z',
      updated_at: '2026-04-09T10:00:00Z',
    });
  });

  it('creates a task', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      task_id: 'task-1',
      external_id: 'TASK-1',
    });

    const result = await crmCreateTaskTool.handler({
      reqContext: {
        client: {
          public: {
            tasks: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        external_id: 'TASK-1',
        title: 'Follow up with Acme',
        description: 'Send the latest customer update',
        assignees: ['user-1'],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        external_id: 'TASK-1',
        title: 'Follow up with Acme',
        description: 'Send the latest customer update',
        assignees: ['user-1'],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      task_id: 'task-1',
      external_id: 'TASK-1',
    });
  });

  it('updates a task with separate lookup and body external ids', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      task_id: 'task-1',
      external_id: 'TASK-2',
    });

    const result = await crmUpdateTaskTool.handler({
      reqContext: {
        client: {
          public: {
            tasks: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        task_id: 'task-1',
        lookup_external_id: 'TASK-1',
        external_id: 'TASK-2',
        description: 'Append the latest customer note',
        projects: ['project-1'],
      },
    });

    expect(update).toHaveBeenCalledWith(
      'task-1',
      {
        external_id: 'TASK-1',
        body_external_id: 'TASK-2',
        description: 'Append the latest customer note',
        projects: ['project-1'],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      task_id: 'task-1',
      external_id: 'TASK-2',
    });
  });

  it('deletes a task', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      task_id: 'task-1',
    });

    const result = await crmDeleteTaskTool.handler({
      reqContext: {
        client: {
          public: {
            tasks: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        task_id: 'task-1',
        external_id: 'TASK-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'task-1',
      {
        external_id: 'TASK-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      task_id: 'task-1',
    });
  });

  it('lists estimates with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      { id_est: 1, company_name: 'Acme', total_price: 100 },
      { id_est: 2, company_name: 'Globex', total_price: 200 },
      { id_est: 3, company_name: 'Initech', total_price: 300 },
    ]);

    const result = await crmListEstimatesTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, workspace_id: 'workspace-1', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 estimates.',
      permission: undefined,
      results: [
        { id_est: 1, company_name: 'Acme', total_price: 100 },
        { id_est: 2, company_name: 'Globex', total_price: 200 },
      ],
    });
  });

  it('gets one estimate when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id_est: 1,
      company_name: 'Acme',
      line_items: [{ item_name: 'Discovery', quantity: 2, unit_price: 50 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetEstimateTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { estimate_id: 'estimate-1', external_id: 'EST-1', language: 'ja' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'estimate-1',
      {
        external_id: 'EST-1',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id_est: 1,
      company_name: 'Acme',
      line_items: [{ item_name: 'Discovery', quantity: 2, unit_price: 50 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Loaded estimate successfully: Estimate No. 1.',
      },
    ]);
  });

  it('returns saveable artifact metadata when downloading an estimate PDF', async () => {
    const pdfBytes = Buffer.from('%PDF-estimate');
    const downloadPDF = jest.fn().mockResolvedValue(
      new Response(pdfBytes, {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition':
            'attachment; filename="estimate.pdf"; filename*=UTF-8\'\'%E8%A6%8B%E7%A9%8D%E6%9B%B8.pdf',
        },
      }),
    );

    const result = await crmDownloadEstimatePDFTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { downloadPDF },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        estimate_id: 'estimate-1',
        template_select: 'template-1',
        language: 'ja',
      },
    });

    expect(downloadPDF).toHaveBeenCalledWith(
      'estimate-1',
      {
        template_select: 'template-1',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      content_disposition:
        'attachment; filename="estimate.pdf"; filename*=UTF-8\'\'%E8%A6%8B%E7%A9%8D%E6%9B%B8.pdf',
      mime_type: 'application/pdf',
      filename: '見積書.pdf',
      byte_length: pdfBytes.byteLength,
      completion_status: 'inline_content',
      download_complete: true,
      file_assembly_required: false,
      content_base64_available: true,
      content_base64: pdfBytes.toString('base64'),
    });
    expect(result.content[0]).toEqual({
      type: 'resource',
      resource: {
        uri: 'resource://tool-response',
        mimeType: 'application/pdf',
        blob: pdfBytes.toString('base64'),
      },
    });
  });

  it('creates an estimate', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      estimate_id: 'estimate-1',
      external_id: 'EST-1',
    });

    const result = await crmCreateEstimateTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'company-1',
        total_price: 100,
        currency: 'USD',
        attachment_file_ids: ['file-1'],
        line_items: [{ item_name: 'Discovery', quantity: 2, unit_price: 50, tax_rate: 10 }],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        company_id: 'company-1',
        total_price: 100,
        currency: 'USD',
        attachment_file: {
          files: [{ file_id: 'file-1' }],
        },
        line_items: [{ item_name: 'Discovery', quantity: 2, unit_price: 50, tax_rate: 10 }],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      estimate_id: 'estimate-1',
      external_id: 'EST-1',
    });
  });

  it('updates an estimate', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      estimate_id: 'estimate-1',
    });

    const result = await crmUpdateEstimateTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        estimate_id: 'estimate-1',
        status: 'sent',
        notes: 'Updated notes',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'estimate-1',
      {
        status: 'sent',
        notes: 'Updated notes',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      estimate_id: 'estimate-1',
    });
  });

  it('deletes an estimate', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      estimate_id: 'estimate-1',
    });

    const result = await crmDeleteEstimateTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        estimate_id: 'estimate-1',
        external_id: 'EST-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'estimate-1',
      {
        external_id: 'EST-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      estimate_id: 'estimate-1',
    });
  });

  it('lists invoices with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id_inv: 1,
        company_name: 'Acme',
        total_price: 100,
        app_url: 'https://app.sanka.com/ja/99112888/invoices/?id=invoice-1',
      },
      { id_inv: 2, company_name: 'Globex', total_price: 200 },
      { id_inv: 3, company_name: 'Initech', total_price: 300 },
    ]);

    const result = await crmListInvoicesTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, workspace_id: 'workspace-1', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 invoices.',
      permission: undefined,
      results: [
        {
          id_inv: 1,
          company_name: 'Acme',
          total_price: 100,
          app_url: 'https://app.sanka.com/ja/99112888/invoices/?id=invoice-1',
        },
        { id_inv: 2, company_name: 'Globex', total_price: 200 },
      ],
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Found 3 invoices. Examples: Invoice No. 1, Invoice No. 2.',
      },
    ]);
  });

  it('lists overdue invoices with a local result limit', async () => {
    const listOverdue = jest.fn().mockResolvedValue([
      { id_inv: 1, company_name: 'Acme', outstanding_balance: 100, days_overdue: 7 },
      { id_inv: 2, company_name: 'Globex', outstanding_balance: 80, days_overdue: 3 },
      { id_inv: 3, company_name: 'Initech', outstanding_balance: 50, days_overdue: 1 },
    ]);

    const result = await crmListOverdueInvoicesTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { listOverdue },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, workspace_id: 'workspace-1', as_of_date: '2026-04-10', language: 'en' },
    });

    expect(listOverdue).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        as_of_date: '2026-04-10',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 overdue invoices.',
      permission: undefined,
      results: [
        { id_inv: 1, company_name: 'Acme', outstanding_balance: 100, days_overdue: 7 },
        { id_inv: 2, company_name: 'Globex', outstanding_balance: 80, days_overdue: 3 },
      ],
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Found 3 overdue invoices. Examples: Invoice No. 1, Invoice No. 2.',
      },
    ]);
  });

  it('gets one invoice when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'invoice-1',
      id_inv: 1,
      app_url: 'https://app.sanka.com/ja/99112888/invoices/?id=invoice-1',
      workspace_code: '99112888',
      company_name: 'Acme',
      line_items: [{ item_name: 'Implementation', quantity: 1, unit_price: 120 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetInvoiceTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { invoice_id: 'invoice-1', external_id: 'INV-1', language: 'ja' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'invoice-1',
      {
        external_id: 'INV-1',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'invoice-1',
      id_inv: 1,
      app_url: 'https://app.sanka.com/ja/99112888/invoices/?id=invoice-1',
      workspace_code: '99112888',
      company_name: 'Acme',
      line_items: [{ item_name: 'Implementation', quantity: 1, unit_price: 120 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
    const firstContent = result.content?.[0];
    expect(firstContent?.type).toBe('text');
    if (firstContent?.type === 'text') {
      expect(firstContent.text).toContain('Loaded invoice successfully: Invoice No. 1.');
      expect(firstContent.text).toContain('app_url');
    }
  });

  it('downloads invoice PDFs with structured base64 content', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4\ninvoice');
    const contentDisposition = `attachment; filename="invoice-fallback.pdf"; filename*=UTF-8''invoice%205.pdf`;
    const downloadPDF = jest.fn().mockResolvedValue(
      new Response(pdfBytes, {
        headers: {
          'content-disposition': contentDisposition,
          'content-type': 'application/pdf',
        },
      }),
    );

    const result = await crmDownloadInvoicePDFTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { downloadPDF },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        external_id: 'INV-1',
        template_select: 'modern',
        language: 'ja',
      },
    });

    const contentBase64 = pdfBytes.toString('base64');
    expect(downloadPDF).toHaveBeenCalledWith(
      'invoice-1',
      {
        external_id: 'INV-1',
        template_select: 'modern',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      content_disposition: contentDisposition,
      mime_type: 'application/pdf',
      filename: 'invoice 5.pdf',
      byte_length: pdfBytes.length,
      completion_status: 'inline_content',
      download_complete: true,
      file_assembly_required: false,
      content_base64_available: true,
      content_base64: contentBase64,
    });
    expect(result.content).toEqual([
      {
        type: 'resource',
        resource: {
          uri: 'resource://tool-response',
          mimeType: 'application/pdf',
          blob: contentBase64,
        },
      },
    ]);
    expect(Buffer.from(result.structuredContent?.['content_base64'] as string, 'base64')).toEqual(pdfBytes);
  });

  it('keeps large invoice PDF downloads below Codex output truncation limits and serves chunks', async () => {
    const pdfBytes = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(104732 - 9, 65)]);
    const contentBase64 = pdfBytes.toString('base64');
    const downloadPDF = jest.fn().mockResolvedValue(
      new Response(pdfBytes, {
        headers: {
          'content-disposition': 'attachment; filename="invoice-7.pdf"',
          'content-type': 'application/pdf',
        },
      }),
    );
    const reqContext = {
      client: {
        public: {
          invoices: { downloadPDF },
        },
      } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
      mcpSessionId: 'session-large-pdf',
      downloadBaseUrl: 'https://mcp.example.test',
    };

    const result = await crmDownloadInvoicePDFTool.handler({
      reqContext,
      args: {
        invoice_id: 'invoice-7',
        language: 'ja',
      },
    });

    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured).toMatchObject({
      mime_type: 'application/pdf',
      filename: 'invoice-7.pdf',
      byte_length: pdfBytes.length,
      completion_status: 'download_url_ready',
      download_complete: false,
      file_assembly_required: false,
      content_base64_available: false,
      content_base64_length: contentBase64.length,
      download_transfer_mode: 'url',
      fallback_next_tool: 'read_binary_download_chunk',
      chunk_size: 24000,
      total_chunks: Math.ceil(contentBase64.length / 24000),
      next_offset: 0,
    });
    expect(typeof structured['next_action']).toBe('string');
    expect(structured['next_action']).toContain('attach or save');
    expect(structured).not.toHaveProperty('content_base64');
    expect(typeof structured['download_token']).toBe('string');
    expect(structured['download_url']).toBe(
      `https://mcp.example.test/downloads/${structured['download_token']}`,
    );
    expect(structured['download_url_expires_at']).toBe(structured['expires_at']);
    expect(structured).not.toHaveProperty('required_next_tool');
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Download it directly from download_url'),
    });
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('before telling the user the PDF download is complete'),
    });
    expect(JSON.stringify(structured).length).toBeLessThan(48000);

    const downloadToken = structured['download_token'] as string;
    let offset = structured['next_offset'] as number;
    let stitchedBase64 = '';
    let done = false;

    for (let i = 0; i < 20 && !done; i += 1) {
      const chunkResult = await crmReadBinaryDownloadChunkTool.handler({
        reqContext,
        args: { download_token: downloadToken, offset },
      });
      const chunk = chunkResult.structuredContent as Record<string, unknown>;
      expect(JSON.stringify(chunk).length).toBeLessThan(48000);
      expect(chunk['content_base64_offset']).toBe(offset);
      expect(chunk['file_assembly_required']).toBe(true);
      expect(typeof chunk['next_action']).toBe('string');
      stitchedBase64 += chunk['content_base64'] as string;
      offset = chunk['next_offset'] as number;
      done = chunk['done'] as boolean;
      expect(chunk['completion_status']).toBe(done ? 'chunks_read' : 'requires_next_chunk');
      if (done) {
        expect(chunk).not.toHaveProperty('required_next_tool');
        expect(chunk['next_action']).toContain('attach or save');
      } else {
        expect(chunk['required_next_tool']).toBe('read_binary_download_chunk');
      }
    }

    expect(done).toBe(true);
    expect(stitchedBase64).toBe(contentBase64);
    expect(Buffer.from(stitchedBase64, 'base64')).toEqual(pdfBytes);
  });

  it('sends or schedules invoice emails through the public invoice email endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      ok: true,
      status: 'scheduled',
      invoice_id: 'invoice-1',
      id_inv: 1233,
      message_thread_ids: ['message-thread-1'],
      scheduled_at: '2026-05-21T09:00:00+09:00',
    });

    const result = await crmSendInvoiceEmailTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        action: 'schedule',
        to: ['finance@example.com'],
        cc: ['ops@example.com'],
        subject: 'May invoice',
        body: 'Please see attached.',
        scheduled_at: '2026-05-21T09:00:00+09:00',
        template_select: 'template-1',
        language: 'ja',
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/invoices/invoice-1/email', {
      body: {
        action: 'schedule',
        to: ['finance@example.com'],
        cc: ['ops@example.com'],
        subject: 'May invoice',
        body: 'Please see attached.',
        scheduled_at: '2026-05-21T09:00:00+09:00',
        template_select: 'template-1',
      },
      query: {
        language: 'ja',
      },
    });
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'scheduled',
      invoice_id: 'invoice-1',
      id_inv: 1233,
      message_thread_ids: ['message-thread-1'],
      scheduled_at: '2026-05-21T09:00:00+09:00',
    });
    expect((result.content[0] as any).text).toContain('Scheduled Invoice No. 1233 email');
  });

  it('creates an invoice', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      invoice_id: 'invoice-1',
      external_id: 'INV-1',
    });

    const result = await crmCreateInvoiceTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'company-1',
        total_price: 120,
        currency: 'USD',
        attachment_file_ids: ['file-1'],
        line_items: [{ item_name: 'Implementation', quantity: 1, unit_price: 120, tax_rate: 10 }],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        company_id: 'company-1',
        total_price: 120,
        currency: 'USD',
        attachment_file: {
          files: [{ file_id: 'file-1' }],
        },
        line_items: [{ item_name: 'Implementation', quantity: 1, unit_price: 120, tax_rate: 10 }],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      invoice_id: 'invoice-1',
      external_id: 'INV-1',
    });
  });

  it('blocks direct CRM-sourced invoice subscription and procurement creation', async () => {
    const createInvoice = jest.fn();
    const createSubscription = jest.fn();
    const createPurchaseOrder = jest.fn();
    const reqContext = {
      client: {
        public: {
          invoices: { create: createInvoice },
          subscriptions: { create: createSubscription },
          purchaseOrders: { create: createPurchaseOrder },
        },
      } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const invoiceResult = await crmCreateInvoiceTool.handler({
      reqContext,
      args: {
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          external_id: '46558049080',
        },
        company_id: 'company-1',
        total_price: 120,
      },
    });
    const subscriptionResult = await crmCreateSubscriptionTool.handler({
      reqContext,
      args: {
        source_system: 'salesforce',
        object_type: 'opportunity',
        salesforce_opportunity_id: '0065g00000Opportunity',
      },
    });
    const purchaseOrderResult = await crmCreatePurchaseOrderTool.handler({
      reqContext,
      args: {
        hubspot_deal_url: 'https://app.hubspot.com/contacts/49714315/record/0-3/46558049080',
        company_id: 'supplier-1',
      },
    });

    expect(createInvoice).not.toHaveBeenCalled();
    expect(createSubscription).not.toHaveBeenCalled();
    expect(createPurchaseOrder).not.toHaveBeenCalled();
    for (const result of [invoiceResult, subscriptionResult, purchaseOrderResult]) {
      expect(result.isError).toBe(true);
      expect((result.content[0] as any).text).toContain('deal_to_order');
      expect((result.content[0] as any).text).toContain('Sanka Order');
    }
  });

  it('updates an invoice', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      invoice_id: 'invoice-1',
    });

    const result = await crmUpdateInvoiceTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        status: 'paid',
        notes: 'Updated invoice notes',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'invoice-1',
      {
        status: 'paid',
        notes: 'Updated invoice notes',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      invoice_id: 'invoice-1',
    });
  });

  it('activates an invoice with read-after-write verification', async () => {
    const post = jest.fn().mockResolvedValue({
      ok: true,
      operation: 'activate',
      status: 'active',
      usage_status: 'active',
      invoice_id: 'invoice-1',
    });
    const retrieve = jest.fn().mockResolvedValue({
      id: 'invoice-1',
      usage_status: 'active',
    });

    const result = await crmActivateInvoiceTool.handler({
      reqContext: {
        client: {
          post,
          public: {
            invoices: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        external_id: 'INV-1',
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/invoices/invoice-1/activate', {
      query: { external_id: 'INV-1' },
    });
    expect(retrieve).toHaveBeenCalledWith(
      'invoice-1',
      {
        external_id: 'INV-1',
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      ok: true,
      operation: 'activate',
      status: 'active',
      usage_status: 'active',
      invoice_id: 'invoice-1',
      verification: {
        entity: 'invoice',
        expected_status: 'active',
        actual_status: 'active',
        matched: true,
      },
    });
  });

  it('archives an invoice with read-after-write verification', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      operation: 'archive',
      status: 'archived',
      usage_status: 'archived',
      permanently_deleted: false,
      invoice_id: 'invoice-1',
    });
    const retrieve = jest.fn().mockResolvedValue({
      id: 'invoice-1',
      status: '下書き',
      status_key: 'draft',
      usage_status: 'archived',
    });

    const result = await crmDeleteInvoiceTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { delete: del, retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        external_id: 'INV-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'invoice-1',
      {
        external_id: 'INV-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      operation: 'archive',
      status: 'archived',
      usage_status: 'archived',
      permanently_deleted: false,
      invoice_id: 'invoice-1',
      verification: {
        entity: 'invoice',
        expected_status: 'archived',
        actual_status: 'archived',
        matched: true,
        record_id: 'invoice-1',
      },
    });
  });

  it('permanently deletes an archived invoice only with explicit confirmation', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      operation: 'permanent_delete',
      status: 'deleted',
      permanently_deleted: true,
      invoice_id: 'invoice-1',
    });
    const retrieve = jest.fn().mockRejectedValue(new Error('Not found'));

    const result = await crmPermanentDeleteInvoiceTool.handler({
      reqContext: {
        client: {
          delete: del,
          public: {
            invoices: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        external_id: 'INV-1',
        confirm: true,
      },
    });

    expect(del).toHaveBeenCalledWith('/v1/public/invoices/invoice-1/permanent-delete', {
      query: { external_id: 'INV-1', confirm: true },
    });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      operation: 'permanent_delete',
      status: 'deleted',
      permanently_deleted: true,
      invoice_id: 'invoice-1',
      verification: {
        entity: 'invoice',
        expected_status: 'deleted',
        actual_status: 'not_found',
        matched: true,
      },
    });

    const blocked = await crmPermanentDeleteInvoiceTool.handler({
      reqContext: {
        client: {
          delete: jest.fn(),
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
      },
    });
    expect(blocked.isError).toBe(true);
  });

  it('lists payments with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id_rcp: 301,
        company_name: 'Acme',
        contact_name: 'Taylor',
        status: 'sent',
      },
      {
        id_rcp: 302,
        company_name: 'Globex',
        contact_name: 'Jordan',
        status: 'paid',
      },
      {
        id_rcp: 303,
        company_name: 'Initech',
        contact_name: 'Casey',
        status: 'draft',
      },
    ]);

    const result = await crmListPaymentsTool.handler({
      reqContext: {
        client: {
          public: {
            payments: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, workspace_id: 'workspace-1', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      message: 'Returned 2 of 3 payments.',
      page: 1,
      permission: undefined,
      results: [
        {
          id_rcp: 301,
          company_name: 'Acme',
          contact_name: 'Taylor',
          status: 'sent',
        },
        {
          id_rcp: 302,
          company_name: 'Globex',
          contact_name: 'Jordan',
          status: 'paid',
        },
      ],
      total: 3,
    });
  });

  it('gets one payment when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id_rcp: 301,
      company_name: 'Acme',
      line_items: [{ item_name: 'Payment row', quantity: 2, unit_price: 50 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetPaymentTool.handler({
      reqContext: {
        client: {
          public: {
            payments: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { payment_id: 'payment-1', external_id: 'PAY-1', language: 'ja' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'payment-1',
      {
        external_id: 'PAY-1',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id_rcp: 301,
      company_name: 'Acme',
      line_items: [{ item_name: 'Payment row', quantity: 2, unit_price: 50 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Loaded payment successfully: Payment No. 301.',
      },
    ]);
  });

  it('lists payment allocations', async () => {
    const listAllocations = jest.fn().mockResolvedValue({
      payment: {
        id_rcp: 301,
        allocated_amount: 150,
        unallocated_amount: 0,
      },
      allocations: [{ invoice: { id_inv: 1147 }, amount: 150 }],
      message: 'ok',
    });

    const result = await crmListPaymentAllocationsTool.handler({
      reqContext: {
        client: {
          public: {
            payments: { listAllocations },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { payment_id: '301', external_id: 'PAY-301', language: 'ja' },
    });

    expect(listAllocations).toHaveBeenCalledWith(
      '301',
      {
        external_id: 'PAY-301',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      payment: {
        id_rcp: 301,
        allocated_amount: 150,
        unallocated_amount: 0,
      },
      allocations: [{ invoice: { id_inv: 1147 }, amount: 150 }],
      message: 'ok',
    });
  });

  it('updates payment allocations', async () => {
    const updateAllocations = jest.fn().mockResolvedValue({
      payment: {
        id_rcp: 301,
        allocated_amount: 150,
        unallocated_amount: 0,
      },
      allocations: [{ invoice: { id_inv: 1147 }, amount: 150 }],
      message: 'ok',
    });

    const result = await crmUpdatePaymentAllocationsTool.handler({
      reqContext: {
        client: {
          public: {
            payments: { updateAllocations },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        payment_id: '301',
        external_id: 'PAY-301',
        language: 'ja',
        allocations: [
          {
            id_inv: 1147,
            amount: 150,
            source: 'mcp',
            notes: 'CSV reconciliation',
          },
        ],
      },
    });

    expect(updateAllocations).toHaveBeenCalledWith(
      '301',
      {
        external_id: 'PAY-301',
        'Accept-Language': 'ja',
        allocations: [
          {
            invoice_id: '1147',
            amount: 150,
            source: 'mcp',
            notes: 'CSV reconciliation',
          },
        ],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      payment: {
        id_rcp: 301,
        allocated_amount: 150,
        unallocated_amount: 0,
      },
      allocations: [{ invoice: { id_inv: 1147 }, amount: 150 }],
      message: 'ok',
    });
  });

  it('creates a payment', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      payment_id: 'payment-1',
      external_id: 'PAY-1',
    });

    const result = await crmCreatePaymentTool.handler({
      reqContext: {
        client: {
          public: {
            payments: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'company-1',
        currency: 'USD',
        entry_type: 'item',
        tax_rate: 10,
        tax_option: 'unified_tax',
        line_items: [{ item_name: 'Payment row', quantity: 2, unit_price: 50, tax_rate: 10 }],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        companyId: 'company-1',
        currency: 'USD',
        entryType: 'item',
        taxRate: 10,
        taxOption: 'unified_tax',
        line_items: [{ item_name: 'Payment row', quantity: 2, unit_price: 50, tax_rate: 10 }],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      payment_id: 'payment-1',
      external_id: 'PAY-1',
    });
  });

  it('updates a payment', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      payment_id: 'payment-1',
    });

    const result = await crmUpdatePaymentTool.handler({
      reqContext: {
        client: {
          public: {
            payments: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        payment_id: 'payment-1',
        status: 'paid',
        notes: 'Updated payment notes',
        external_id: 'PAY-1',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'payment-1',
      {
        status: 'paid',
        notes: 'Updated payment notes',
        externalId: 'PAY-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      payment_id: 'payment-1',
    });
  });

  it('deletes a payment', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      payment_id: 'payment-1',
    });

    const result = await crmDeletePaymentTool.handler({
      reqContext: {
        client: {
          public: {
            payments: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        payment_id: 'payment-1',
        external_id: 'PAY-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'payment-1',
      {
        external_id: 'PAY-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      payment_id: 'payment-1',
    });
  });

  it('maps slip CRUD handlers to the SDK client', async () => {
    const list = jest.fn().mockResolvedValue([
      { id_slip: 401, company_name: 'Acme', contact_name: 'Taylor', slip_type: 'delivery_slip' },
      { id_slip: 402, company_name: 'Globex', contact_name: 'Jordan', slip_type: 'delivery_slip' },
    ]);
    const retrieve = jest.fn().mockResolvedValue({
      id_slip: 401,
      company_name: 'Acme',
      line_items: [{ item_name: 'Delivered item', quantity: 5, unit_price: 100 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      slip_id: 'slip-1',
      external_id: 'SLIP-1',
    });
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      slip_id: 'slip-1',
    });
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      slip_id: 'slip-1',
    });

    const reqContext = {
      client: {
        public: {
          slips: { list, retrieve, create, update, delete: del },
        },
      } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const listResult = await crmListSlipsTool.handler({
      reqContext,
      args: { limit: 1, workspace_id: 'workspace-1', language: 'en' },
    });
    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(listResult.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 2,
      message: 'Returned 1 of 2 slips.',
      permission: undefined,
      results: [{ id_slip: 401, company_name: 'Acme', contact_name: 'Taylor', slip_type: 'delivery_slip' }],
    });

    const getResult = await crmGetSlipTool.handler({
      reqContext,
      args: { slip_id: 'slip-1', external_id: 'SLIP-1', language: 'ja' },
    });
    expect(retrieve).toHaveBeenCalledWith(
      'slip-1',
      {
        external_id: 'SLIP-1',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(getResult.structuredContent).toEqual({
      id_slip: 401,
      company_name: 'Acme',
      line_items: [{ item_name: 'Delivered item', quantity: 5, unit_price: 100 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const createResult = await crmCreateSlipTool.handler({
      reqContext,
      args: {
        company_id: 'company-1',
        currency: 'USD',
        slip_type: 'delivery_slip',
        total_price: 500,
        tax_inclusive: true,
        line_items: [{ item_name: 'Delivered item', quantity: 5, unit_price: 100, tax_rate: 0 }],
      },
    });
    expect(create).toHaveBeenCalledWith(
      {
        company_id: 'company-1',
        currency: 'USD',
        slip_type: 'delivery_slip',
        total_price: 500,
        tax_inclusive: true,
        line_items: [{ item_name: 'Delivered item', quantity: 5, unit_price: 100, tax_rate: 0 }],
      },
      undefined,
    );
    expect(createResult.structuredContent).toEqual({
      ok: true,
      status: 'created',
      slip_id: 'slip-1',
      external_id: 'SLIP-1',
    });

    const updateResult = await crmUpdateSlipTool.handler({
      reqContext,
      args: {
        slip_id: 'slip-1',
        status: 'sent',
        notes: 'Updated slip notes',
      },
    });
    expect(update).toHaveBeenCalledWith(
      'slip-1',
      {
        status: 'sent',
        notes: 'Updated slip notes',
      },
      undefined,
    );
    expect(updateResult.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      slip_id: 'slip-1',
    });

    const deleteResult = await crmDeleteSlipTool.handler({
      reqContext,
      args: {
        slip_id: 'slip-1',
        external_id: 'SLIP-1',
      },
    });
    expect(del).toHaveBeenCalledWith(
      'slip-1',
      {
        external_id: 'SLIP-1',
      },
      undefined,
    );
    expect(deleteResult.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      slip_id: 'slip-1',
    });
  });

  it('maps bill CRUD handlers to the SDK client', async () => {
    const list = jest.fn().mockResolvedValue([
      { id_bill: 501, company_name: 'Acme', contact_name: 'Taylor', amount: 1200 },
      { id_bill: 502, company_name: 'Globex', contact_name: 'Jordan', amount: 900 },
    ]);
    const retrieve = jest.fn().mockResolvedValue({
      id_bill: 501,
      company_name: 'Acme',
      line_items: [{ item_name: 'Bill row', quantity: 2, unit_price: 500 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      bill_id: 'bill-1',
      external_id: 'BILL-1',
    });
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      bill_id: 'bill-1',
    });
    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'file-1',
      filename: 'supplier-invoice.pdf',
    });
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      bill_id: 'bill-1',
    });

    const reqContext = {
      client: {
        public: {
          bills: { list, retrieve, create, update, uploadAttachment, delete: del },
        },
      } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const listResult = await crmListBillsTool.handler({
      reqContext,
      args: { limit: 1, workspace_id: 'workspace-1', language: 'en' },
    });
    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(listResult.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 2,
      message: 'Returned 1 of 2 bills.',
      permission: undefined,
      results: [{ id_bill: 501, company_name: 'Acme', contact_name: 'Taylor', amount: 1200 }],
    });

    const getResult = await crmGetBillTool.handler({
      reqContext,
      args: { bill_id: 'bill-1', external_id: 'BILL-1', language: 'ja' },
    });
    expect(retrieve).toHaveBeenCalledWith(
      'bill-1',
      {
        external_id: 'BILL-1',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(getResult.structuredContent).toEqual({
      id_bill: 501,
      company_name: 'Acme',
      line_items: [{ item_name: 'Bill row', quantity: 2, unit_price: 500 }],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const uploadResult = await crmUploadBillAttachmentTool.handler({
      reqContext,
      args: {
        filename: 'supplier-invoice.pdf',
        mime_type: 'application/pdf',
        content_base64: Buffer.from('bill attachment').toString('base64'),
      },
    });
    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const [payload] = uploadAttachment.mock.calls[0];
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe('supplier-invoice.pdf');
    expect(payload.file.type).toBe('application/pdf');
    expect(uploadResult.structuredContent).toEqual({
      ok: true,
      file_id: 'file-1',
      filename: 'supplier-invoice.pdf',
    });

    const createResult = await crmCreateBillTool.handler({
      reqContext,
      args: {
        company_id: 'company-1',
        currency: 'USD',
        due_date: '2026-04-20',
        tax_inclusive: false,
        attachment_file_ids: ['file-1'],
        line_items: [{ item_name: 'Bill row', quantity: 2, unit_price: 500, tax_rate: 10 }],
      },
    });
    expect(create).toHaveBeenCalledWith(
      {
        company_id: 'company-1',
        currency: 'USD',
        due_date: '2026-04-20',
        tax_inclusive: false,
        attachment_file: {
          files: [{ file_id: 'file-1' }],
        },
        line_items: [{ item_name: 'Bill row', quantity: 2, unit_price: 500, tax_rate: 10 }],
      },
      undefined,
    );
    expect(createResult.structuredContent).toEqual({
      ok: true,
      status: 'created',
      bill_id: 'bill-1',
      external_id: 'BILL-1',
    });

    const updateResult = await crmUpdateBillTool.handler({
      reqContext,
      args: {
        bill_id: 'bill-1',
        status: 'paid',
        payment_date: '2026-04-15',
        attachment_file_ids: ['file-2'],
      },
    });
    expect(update).toHaveBeenCalledWith(
      'bill-1',
      {
        status: 'paid',
        payment_date: '2026-04-15',
        attachment_file: {
          files: [{ file_id: 'file-2' }],
        },
      },
      undefined,
    );
    expect(updateResult.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      bill_id: 'bill-1',
    });

    const deleteResult = await crmDeleteBillTool.handler({
      reqContext,
      args: {
        bill_id: 'bill-1',
        external_id: 'BILL-1',
      },
    });
    expect(del).toHaveBeenCalledWith(
      'bill-1',
      {
        external_id: 'BILL-1',
      },
      undefined,
    );
    expect(deleteResult.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      bill_id: 'bill-1',
    });
  });

  it('uploads a bill attachment from base64 content', async () => {
    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'file-1',
      filename: 'bill.pdf',
    });

    const result = await crmUploadBillAttachmentTool.handler({
      reqContext: {
        client: {
          public: {
            bills: { uploadAttachment },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filename: 'bill.pdf',
        mime_type: 'application/pdf',
        content_base64: Buffer.from('test bill').toString('base64'),
      },
    });

    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const [payload] = uploadAttachment.mock.calls[0];
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe('bill.pdf');
    expect(payload.file.type).toBe('application/pdf');
    expect(result.structuredContent).toEqual({
      ok: true,
      file_id: 'file-1',
      filename: 'bill.pdf',
    });
  });

  it('maps disbursement CRUD handlers to the SDK client', async () => {
    const list = jest.fn().mockResolvedValue([
      { id_dsb: 601, company_name: 'Acme', contact_name: 'Taylor', total_price: 800 },
      { id_dsb: 602, company_name: 'Globex', contact_name: 'Jordan', total_price: 650 },
    ]);
    const retrieve = jest.fn().mockResolvedValue({
      id_dsb: 601,
      company_name: 'Acme',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      disbursement_id: 'disbursement-1',
      external_id: 'DSB-1',
    });
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      disbursement_id: 'disbursement-1',
    });
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      disbursement_id: 'disbursement-1',
    });

    const reqContext = {
      client: {
        public: {
          disbursements: { list, retrieve, create, update, delete: del },
        },
      } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const listResult = await crmListDisbursementsTool.handler({
      reqContext,
      args: { limit: 1, workspace_id: 'workspace-1', language: 'en' },
    });
    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(listResult.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 2,
      message: 'Returned 1 of 2 disbursements.',
      permission: undefined,
      results: [{ id_dsb: 601, company_name: 'Acme', contact_name: 'Taylor', total_price: 800 }],
    });

    const getResult = await crmGetDisbursementTool.handler({
      reqContext,
      args: { disbursement_id: 'disbursement-1', external_id: 'DSB-1', language: 'ja' },
    });
    expect(retrieve).toHaveBeenCalledWith(
      'disbursement-1',
      {
        external_id: 'DSB-1',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(getResult.structuredContent).toEqual({
      id_dsb: 601,
      company_name: 'Acme',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const createResult = await crmCreateDisbursementTool.handler({
      reqContext,
      args: {
        company_id: 'company-1',
        currency: 'USD',
        fee: 25,
        tax_inclusive: true,
        line_items: [{ item_name: 'Disbursement row', quantity: 2, unit_price: 400, tax_rate: 0 }],
      },
    });
    expect(create).toHaveBeenCalledWith(
      {
        company_id: 'company-1',
        currency: 'USD',
        fee: 25,
        tax_inclusive: true,
        line_items: [{ item_name: 'Disbursement row', quantity: 2, unit_price: 400, tax_rate: 0 }],
      },
      undefined,
    );
    expect(createResult.structuredContent).toEqual({
      ok: true,
      status: 'created',
      disbursement_id: 'disbursement-1',
      external_id: 'DSB-1',
    });

    const updateResult = await crmUpdateDisbursementTool.handler({
      reqContext,
      args: {
        disbursement_id: 'disbursement-1',
        status: 'approved',
        notes: 'Approved for payout',
      },
    });
    expect(update).toHaveBeenCalledWith(
      'disbursement-1',
      {
        status: 'approved',
        notes: 'Approved for payout',
      },
      undefined,
    );
    expect(updateResult.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      disbursement_id: 'disbursement-1',
    });

    const deleteResult = await crmDeleteDisbursementTool.handler({
      reqContext,
      args: {
        disbursement_id: 'disbursement-1',
        external_id: 'DSB-1',
      },
    });
    expect(del).toHaveBeenCalledWith(
      'disbursement-1',
      {
        external_id: 'DSB-1',
      },
      undefined,
    );
    expect(deleteResult.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      disbursement_id: 'disbursement-1',
    });
  });

  it('maps disbursement allocation handlers to public allocation endpoints', async () => {
    const allocationPayload = {
      disbursement: {
        id: 'disbursement-1',
        id_dsb: 701,
        allocated_amount: 125,
        unallocated_amount: 375,
      },
      allocations: [
        {
          id: 'allocation-1',
          payable_type: 'expense',
          payable_id: 'expense-1',
          amount: 125,
        },
      ],
      available_payables: [],
      message: 'OK',
    };
    const get = jest.fn().mockResolvedValue(allocationPayload);
    const post = jest.fn().mockResolvedValue(allocationPayload);
    const patch = jest.fn().mockResolvedValue({
      ...allocationPayload,
      allocations: [{ ...allocationPayload.allocations[0], amount: 150 }],
    });
    const del = jest.fn().mockResolvedValue({
      ...allocationPayload,
      allocations: [],
      disbursement: {
        ...allocationPayload.disbursement,
        allocated_amount: 0,
        unallocated_amount: 500,
      },
    });

    const reqContext = {
      client: { get, post, patch, delete: del } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const listResult = await crmListDisbursementAllocationsTool.handler({
      reqContext,
      args: {
        disbursement_id: 'disbursement-1',
        external_id: 'DSB-1',
        language: 'en',
      },
    });
    expect(get).toHaveBeenCalledWith('/v1/public/disbursements/disbursement-1/allocations', {
      query: {
        external_id: 'DSB-1',
        'Accept-Language': 'en',
      },
    });
    expect(listResult.structuredContent).toEqual(allocationPayload);

    const createResult = await crmCreateDisbursementAllocationTool.handler({
      reqContext,
      args: {
        disbursement_id: 'disbursement-1',
        payable_type: 'expense',
        expense_id: 'expense-1',
        amount: 125,
        notes: 'Receipt allocation',
      },
    });
    expect(post).toHaveBeenCalledWith('/v1/public/disbursements/disbursement-1/allocations', {
      query: {},
      body: {
        payable_type: 'expense',
        expense_id: 'expense-1',
        amount: 125,
        notes: 'Receipt allocation',
      },
    });
    expect(createResult.structuredContent).toEqual(allocationPayload);

    const updateResult = await crmUpdateDisbursementAllocationTool.handler({
      reqContext,
      args: {
        disbursement_id: 'disbursement-1',
        allocation_id: 'allocation-1',
        amount: 150,
      },
    });
    expect(patch).toHaveBeenCalledWith('/v1/public/disbursements/disbursement-1/allocations/allocation-1', {
      query: {},
      body: { amount: 150 },
    });
    expect(updateResult.structuredContent).toEqual({
      ...allocationPayload,
      allocations: [{ ...allocationPayload.allocations[0], amount: 150 }],
    });

    const deleteResult = await crmDeleteDisbursementAllocationTool.handler({
      reqContext,
      args: {
        disbursement_id: 'disbursement-1',
        allocation_id: 'allocation-1',
      },
    });
    expect(del).toHaveBeenCalledWith('/v1/public/disbursements/disbursement-1/allocations/allocation-1', {
      query: {},
    });
    expect(deleteResult.structuredContent).toEqual({
      ...allocationPayload,
      allocations: [],
      disbursement: {
        ...allocationPayload.disbursement,
        allocated_amount: 0,
        unallocated_amount: 500,
      },
    });
  });

  it('returns reauth metadata when list tickets is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListTicketsTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { list },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(list).not.toHaveBeenCalled();
  });

  it('lists tickets with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'ticket-1',
        ticket_id: 401,
        title: 'Broken integration',
        stage_key: 'triage',
        status: 'active',
      },
      {
        id: 'ticket-2',
        ticket_id: 402,
        title: 'Upgrade billing plan',
        stage_key: 'investigating',
        status: 'active',
      },
      {
        id: 'ticket-3',
        ticket_id: 403,
        title: 'Webhook failure',
        stage_key: 'resolved',
        status: 'archived',
      },
    ]);

    const result = await crmListTicketsTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, workspace_id: 'workspace-1' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 tickets.',
      permission: undefined,
      results: [
        {
          id: 'ticket-1',
          ticket_id: 401,
          title: 'Broken integration',
          stage_key: 'triage',
          status: 'active',
        },
        {
          id: 'ticket-2',
          ticket_id: 402,
          title: 'Upgrade billing plan',
          stage_key: 'investigating',
          status: 'active',
        },
      ],
    });
  });

  it('gets one ticket when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'ticket-1',
      ticket_id: 401,
      title: 'Broken integration',
      stage_key: 'triage',
      status: 'active',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetTicketTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { ticket_id: 'ticket-1', external_id: 'TICK-1', workspace_id: 'workspace-1' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'ticket-1',
      {
        external_id: 'TICK-1',
        workspace_id: 'workspace-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'ticket-1',
      ticket_id: 401,
      title: 'Broken integration',
      stage_key: 'triage',
      status: 'active',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
  });

  it('creates a ticket', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      ticket_id: 'ticket-1',
      external_id: 'TICK-1',
    });

    const result = await crmCreateTicketTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        external_id: 'TICK-1',
        title: 'Broken integration',
        priority: 'high',
        deal_ids: ['deal-1'],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        body_external_id: 'TICK-1',
        title: 'Broken integration',
        priority: 'high',
        deal_ids: ['deal-1'],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      ticket_id: 'ticket-1',
      external_id: 'TICK-1',
    });
  });

  it('updates a ticket with separate lookup and body external ids', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      ticket_id: 'ticket-1',
      external_id: 'TICK-2',
    });

    const result = await crmUpdateTicketTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        ticket_id: 'ticket-1',
        lookup_external_id: 'TICK-1',
        external_id: 'TICK-2',
        status: 'archived',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'ticket-1',
      {
        external_id: 'TICK-1',
        body_external_id: 'TICK-2',
        status: 'archived',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      ticket_id: 'ticket-1',
      external_id: 'TICK-2',
    });
  });

  it('deletes a ticket', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      ticket_id: 'ticket-1',
    });

    const result = await crmDeleteTicketTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        ticket_id: 'ticket-1',
        external_id: 'TICK-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'ticket-1',
      {
        external_id: 'TICK-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      ticket_id: 'ticket-1',
    });
  });

  it('lists ticket pipelines when authentication is present', async () => {
    const listPipelines = jest.fn().mockResolvedValue([
      {
        id: 'pipeline-1',
        name: 'Support',
        internal_name: 'support',
        is_default: true,
        order: 1,
        stages: [
          { id: 'stage-1', name: 'Triage', internal_value: 'triage', order: 1 },
          { id: 'stage-2', name: 'Resolved', internal_value: 'resolved', order: 2 },
        ],
      },
    ]);

    const result = await crmListTicketPipelinesTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { listPipelines },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { workspace_id: 'workspace-1' },
    });

    expect(listPipelines).toHaveBeenCalledWith({ workspace_id: 'workspace-1' }, undefined);
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'Returned 1 ticket pipelines.',
      permission: undefined,
      results: [
        {
          id: 'pipeline-1',
          name: 'Support',
          internal_name: 'support',
          is_default: true,
          order: 1,
          stages: [
            { id: 'stage-1', name: 'Triage', internal_value: 'triage', order: 1 },
            { id: 'stage-2', name: 'Resolved', internal_value: 'resolved', order: 2 },
          ],
        },
      ],
    });
  });

  it('updates only the ticket status or stage', async () => {
    const updateStatus = jest.fn().mockResolvedValue({
      ok: true,
      status: 'archived',
      ticket_id: 'ticket-1',
      external_id: 'TICK-1',
    });

    const result = await crmUpdateTicketStatusTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { updateStatus },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        ticket_id: 'ticket-1',
        lookup_external_id: 'TICK-1',
        stage_key: 'resolved',
        status: 'archived',
        language: 'ja',
      },
    });

    expect(updateStatus).toHaveBeenCalledWith(
      'ticket-1',
      {
        external_id: 'TICK-1',
        stage_key: 'resolved',
        status: 'archived',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'archived',
      ticket_id: 'ticket-1',
      external_id: 'TICK-1',
    });
  });

  it('lists expenses with a server-reported total', async () => {
    const withResponse = jest.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: 'expense-1',
              record_id: '101',
              properties: {
                description: 'Google Workspace',
                company_name: 'Google',
                amount: 20,
                currency: 'USD',
              },
            },
            {
              id: 'expense-2',
              record_id: '102',
              properties: { description: 'Zoom', company_name: 'Zoom', amount: 10, currency: 'USD' },
            },
          ],
          page: 1,
          page_size: 2,
          total: 2288,
        },
        meta: { pagination: { page: 1, page_size: 2, total: 2288 } },
      },
      response: new Response('{}'),
    });
    const v2Get = jest.fn().mockReturnValue({ withResponse });

    const result = await crmListExpensesTool.handler({
      reqContext: {
        client: {
          v2Get,
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, language: 'en', workspace_id: 'workspace-1' },
    });

    expect(v2Get).toHaveBeenCalledWith('/expenses', {
      query: {
        limit: 2,
        page: 1,
        workspace_id: 'workspace-1',
      },
      headers: { 'Accept-Language': 'en' },
    });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 2288,
      message: 'Returned 2 of 2288 expenses.',
      permission: undefined,
      results: [
        {
          id: 'expense-1',
          id_pm: 101,
          description: 'Google Workspace',
          company_name: 'Google',
          amount: 20,
          currency: 'USD',
        },
        {
          id: 'expense-2',
          id_pm: 102,
          description: 'Zoom',
          company_name: 'Zoom',
          amount: 10,
          currency: 'USD',
        },
      ],
    });
  });

  it('returns reauth metadata when list expenses is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListExpensesTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { list },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(list).not.toHaveBeenCalled();
  });

  it('gets one expense when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'expense-1',
      description: 'Google Workspace',
      company_name: 'Google',
      amount: 20,
      currency: 'USD',
      created_at: '2026-04-08T00:00:00Z',
    });

    const result = await crmGetExpenseTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { expense_id: 'expense-1', external_id: 'EXP-1', language: 'en' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'expense-1',
      {
        external_id: 'EXP-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'expense-1',
      description: 'Google Workspace',
      company_name: 'Google',
      amount: 20,
      currency: 'USD',
      created_at: '2026-04-08T00:00:00Z',
    });
  });

  it('uploads an expense attachment from base64 content', async () => {
    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'file-1',
      filename: 'receipt.pdf',
    });

    const result = await crmUploadExpenseAttachmentTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { uploadAttachment },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filename: 'receipt.pdf',
        mime_type: 'application/pdf',
        content_base64: Buffer.from('test receipt').toString('base64'),
      },
    });

    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const [payload] = uploadAttachment.mock.calls[0];
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe('receipt.pdf');
    expect(payload.file.type).toBe('application/pdf');
    expect(result.structuredContent).toEqual({
      ok: true,
      file_id: 'file-1',
      filename: 'receipt.pdf',
    });
  });

  it.each([
    [
      'order',
      crmUploadOrderAttachmentTool,
      (uploadAttachment: jest.Mock) => ({ orders: { uploadAttachment } }),
    ],
    [
      'purchase order',
      crmUploadPurchaseOrderAttachmentTool,
      (uploadAttachment: jest.Mock) => ({ purchaseOrders: { uploadAttachment } }),
    ],
    [
      'estimate',
      crmUploadEstimateAttachmentTool,
      (uploadAttachment: jest.Mock) => ({ estimates: { uploadAttachment } }),
    ],
    [
      'invoice',
      crmUploadInvoiceAttachmentTool,
      (uploadAttachment: jest.Mock) => ({ invoices: { uploadAttachment } }),
    ],
  ])('uploads a %s attachment from base64 content', async (_label, tool, publicClientFactory) => {
    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'file-1',
      filename: 'document.pdf',
    });

    const result = await tool.handler({
      reqContext: {
        client: {
          public: publicClientFactory(uploadAttachment),
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filename: 'document.pdf',
        mime_type: 'application/pdf',
        content_base64: Buffer.from('test document').toString('base64'),
      },
    });

    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const [payload] = uploadAttachment.mock.calls[0];
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe('document.pdf');
    expect(payload.file.type).toBe('application/pdf');
    expect(result.structuredContent).toEqual({
      ok: true,
      file_id: 'file-1',
      filename: 'document.pdf',
    });
  });

  it('creates an expense with uploaded attachment ids', async () => {
    const post = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      expense_id: 'expense-1',
      external_id: 'EXP-1',
      advisories: [
        {
          code: 'missing_recommended_partner',
          message: 'Created without a linked company or contact.',
          requires_confirmation: true,
        },
      ],
    });

    const result = await crmCreateExpenseTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        amount: 100,
        currency: 'USD',
        description: 'Hotel',
        status: 'submitted',
        attachment_file_ids: ['file-1', 'file-2'],
      },
    });

    expect(post).toHaveBeenCalledWith('https://api.sanka.com/v1/public/expenses', {
      body: {
        amount: 100,
        currency: 'USD',
        description: 'Hotel',
        status: 'submitted',
        attachment_file: {
          files: [{ file_id: 'file-1' }, { file_id: 'file-2' }],
        },
      },
    });
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      expense_id: 'expense-1',
      external_id: 'EXP-1',
      advisories: [
        {
          code: 'missing_recommended_partner',
          message: 'Created without a linked company or contact.',
          requires_confirmation: true,
        },
      ],
    });
    const summaryBlock = result.content?.[0];
    expect(summaryBlock?.type).toBe('text');
    const summaryText = summaryBlock?.type === 'text' ? summaryBlock.text : '';
    expect(summaryText).toContain('Partner fields are missing');
    expect(summaryText).toContain('explicit permission');
  });

  it('updates an expense', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      expense_id: 'expense-1',
    });

    const result = await crmUpdateExpenseTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        expense_id: 'expense-1',
        description: 'Updated hotel',
        company_id: 'company-1',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'expense-1',
      {
        description: 'Updated hotel',
        company_id: 'company-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      expense_id: 'expense-1',
    });
  });

  it('deletes an expense', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      expense_id: 'expense-1',
    });

    const result = await crmDeleteExpenseTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        expense_id: 'expense-1',
        external_id: 'EXP-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'expense-1',
      {
        external_id: 'EXP-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      expense_id: 'expense-1',
    });
  });

  it('lists properties with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'prop-1',
        name: 'Priority',
        internal_name: 'priority',
        object: 'orders',
        is_custom: true,
        immutable: false,
      },
      {
        id: 'prop-2',
        name: 'Region',
        internal_name: 'region',
        object: 'orders',
        is_custom: true,
        immutable: false,
      },
      {
        id: 'prop-3',
        name: 'Channel',
        internal_name: 'channel',
        object: 'orders',
        is_custom: true,
        immutable: false,
      },
    ]);

    const result = await crmListPropertiesTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'orders',
        custom_only: true,
        limit: 2,
        workspace_id: 'workspace-1',
        language: 'en',
      },
    });

    expect(list).toHaveBeenCalledWith(
      'orders',
      {
        custom_only: true,
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 properties.',
      permission: undefined,
      results: [
        {
          id: 'prop-1',
          name: 'Priority',
          internal_name: 'priority',
          object: 'orders',
          is_custom: true,
          immutable: false,
        },
        {
          id: 'prop-2',
          name: 'Region',
          internal_name: 'region',
          object: 'orders',
          is_custom: true,
          immutable: false,
        },
      ],
    });
  });

  it('lists integration properties with provider routing', async () => {
    const get = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'hs/lifecycle_stage',
          name: 'Lifecycle stage',
          internal_name: 'lifecycle_stage',
          object: 'companies',
          scope: 'integration',
          provider: 'hubspot',
          is_custom: false,
          immutable: false,
        },
      ],
    });

    const result = await crmListPropertiesTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'companies',
        scope: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_object_type: 'companies',
        search: 'lifecycle',
        limit: 2,
      },
    });

    expect(get).toHaveBeenCalledWith('https://api.sanka.com/v1/public/properties/companies', {
      query: {
        scope: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_object_type: 'companies',
        search: 'lifecycle',
      },
    });
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'Returned 1 of 1 properties.',
      permission: undefined,
      results: [
        {
          id: 'hs/lifecycle_stage',
          name: 'Lifecycle stage',
          internal_name: 'lifecycle_stage',
          object: 'companies',
          scope: 'integration',
          provider: 'hubspot',
          is_custom: false,
          immutable: false,
        },
      ],
    });
  });

  it('lists approval rules through the public rule settings API', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: {
        settingType: 'invoices',
        rules: [
          {
            id: 'rule-1',
            name: 'Block invoice download',
            blockTargets: ['document_download'],
            summary: 'status == sent',
          },
        ],
        message: 'OK',
      },
    });

    const result = await crmListApprovalRulesTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object: 'invoices',
        workspace_id: 'workspace-1',
        language: 'ja',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/approval-rules', {
      query: {
        object: 'invoices',
        workspace_id: 'workspace-1',
        language: 'ja',
      },
    });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      results: [{ id: 'rule-1', name: 'Block invoice download' }],
    });
  });

  it('upserts approval rules with object and block targets', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        rule: {
          id: 'rule-1',
          name: 'Block invoice download',
          blockTargets: ['document_download'],
        },
        message: 'Approval rule saved.',
      },
    });

    const result = await crmUpsertApprovalRuleTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object: 'invoices',
        name: 'Block invoice download',
        conditions: { all: [{ field: 'status', op: '==', value: 'sent' }] },
        block_targets: ['document_download'],
        approver_user_ids: ['7'],
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/approval-rules', {
      body: {
        object: 'invoices',
        name: 'Block invoice download',
        conditions: { all: [{ field: 'status', op: '==', value: 'sent' }] },
        block_targets: ['document_download'],
        approver_user_ids: ['7'],
      },
    });
    expect(result.structuredContent).toEqual({
      rule: {
        id: 'rule-1',
        name: 'Block invoice download',
        blockTargets: ['document_download'],
      },
      message: 'Approval rule saved.',
    });
  });

  it('loads delivery rule options and deletes delivery rules through object-scoped endpoints', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: {
        rule: { id: 'default-send', action: 'send' },
        actionOptions: [{ value: 'send', label: 'Send' }],
        message: 'OK',
      },
    });
    const del = jest.fn().mockResolvedValue({
      success: true,
      data: { message: 'Send rule deleted.' },
    });

    const optionsResult = await crmGetDeliveryRuleOptionsTool.handler({
      reqContext: {
        client: { get, delete: del } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object: 'invoices',
        action: 'send',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/delivery-rules/options', {
      query: {
        object: 'invoices',
        action: 'send',
      },
    });
    expect(optionsResult.structuredContent).toMatchObject({
      rule: { id: 'default-send', action: 'send' },
    });

    const deleteResult = await crmDeleteDeliveryRuleTool.handler({
      reqContext: {
        client: { get, delete: del } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object: 'invoices',
        rule_id: 'rule-1',
      },
    });

    expect(del).toHaveBeenCalledWith('/api/v2/delivery-rules/rule-1', {
      query: { object: 'invoices' },
    });
    expect(deleteResult.structuredContent).toEqual({ message: 'Send rule deleted.' });
  });

  it('gets one property when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'prop-1',
      object: 'orders',
      name: 'Priority',
      internal_name: 'priority',
      is_custom: true,
      immutable: false,
    });

    const result = await crmGetPropertyTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { object_name: 'orders', property_ref: 'prop-1', workspace_id: 'workspace-1', language: 'en' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'prop-1',
      {
        object_name: 'orders',
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'prop-1',
      object: 'orders',
      name: 'Priority',
      internal_name: 'priority',
      is_custom: true,
      immutable: false,
    });
  });

  it('creates a property', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      object: 'orders',
      property_id: 'prop-1',
      ctx_id: 'ctx-1',
    });

    const result = await crmCreatePropertyTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'orders',
        name: 'Priority',
        internal_name: 'priority',
        type: 'text',
        tag_values: [],
      },
    });

    expect(create).toHaveBeenCalledWith(
      'orders',
      {
        name: 'Priority',
        internal_name: 'priority',
        type: 'text',
        tag_values: [],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      object: 'orders',
      property_id: 'prop-1',
      ctx_id: 'ctx-1',
    });
  });

  it('creates an integration property with mutation routing', async () => {
    const post = jest.fn().mockResolvedValue({
      ok: true,
      status: 'dry_run',
      object: 'deals',
      property_id: 'CodexSmokeField__c',
      ctx_id: 'ctx-remote',
      target: 'integration',
      provider: 'salesforce',
      dry_run: true,
    });

    const result = await crmCreatePropertyTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'deals',
        target: 'integration',
        provider: 'salesforce',
        external_object_type: 'Opportunity',
        external_id: 'CodexSmokeField__c',
        dry_run: true,
        name: 'Codex Smoke Field',
        type: 'text',
      },
    });

    expect(post).toHaveBeenCalledWith('https://api.sanka.com/v1/public/properties/deals', {
      body: {
        external_id: 'CodexSmokeField__c',
        external_object_type: 'Opportunity',
        name: 'Codex Smoke Field',
        provider: 'salesforce',
        target: 'integration',
        type: 'text',
        dry_run: true,
      },
    });
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'dry_run',
      object: 'deals',
      property_id: 'CodexSmokeField__c',
      ctx_id: 'ctx-remote',
      target: 'integration',
      provider: 'salesforce',
      dry_run: true,
    });
  });

  it('treats property mutation scope=integration as target=integration', async () => {
    const post = jest.fn().mockResolvedValue({
      ok: true,
      status: 'dry_run',
      object: 'contacts',
      property_id: 'test_property',
      target: 'integration',
      provider: 'hubspot',
    });

    const result = await crmCreatePropertyTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'contacts',
        scope: 'integration',
        provider: 'hubspot',
        external_id: 'test_property',
        group_name: 'contactinformation',
        dry_run: true,
        name: 'Test property',
        type: 'text',
      },
    });

    expect(post).toHaveBeenCalledWith('https://api.sanka.com/v1/public/properties/contacts', {
      body: {
        dry_run: true,
        external_id: 'test_property',
        group_name: 'contactinformation',
        name: 'Test property',
        provider: 'hubspot',
        scope: 'integration',
        target: 'integration',
        type: 'text',
      },
    });
    expect(result.structuredContent).toMatchObject({
      target: 'integration',
      provider: 'hubspot',
    });
  });

  it('routes staging integration properties to the staging legacy public API host', async () => {
    const get = jest.fn().mockResolvedValue([{ id: 'prop-1', name: 'Stage Field' }]);

    const result = await crmListPropertiesTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext({ authorizationServerUrl: 'https://app.sankastaging.com' }),
        toolProfile: 'full',
      },
      args: {
        object_name: 'contacts',
        scope: 'integration',
        provider: 'hubspot',
        limit: 10,
      },
    });

    expect(get).toHaveBeenCalledWith('https://api.sankastaging.com/v1/public/properties/contacts', {
      query: {
        scope: 'integration',
        provider: 'hubspot',
      },
    });
    expect(result.structuredContent?.['count']).toBe(1);
  });

  it('updates a property', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      object: 'orders',
      property_id: 'prop-1',
      ctx_id: 'ctx-2',
    });

    const result = await crmUpdatePropertyTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'orders',
        property_ref: 'prop-1',
        required_field: true,
        choice_values: ['high', 'low'],
      },
    });

    expect(update).toHaveBeenCalledWith(
      'prop-1',
      {
        object_name: 'orders',
        required_field: true,
        choice_values: ['high', 'low'],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      object: 'orders',
      property_id: 'prop-1',
      ctx_id: 'ctx-2',
    });
  });

  it('deletes a property', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      object: 'orders',
      property_id: 'prop-1',
      ctx_id: 'ctx-3',
    });

    const result = await crmDeletePropertyTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'orders',
        property_ref: 'prop-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'prop-1',
      {
        object_name: 'orders',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      object: 'orders',
      property_id: 'prop-1',
      ctx_id: 'ctx-3',
    });
  });

  it('deletes an integration property with confirmation routing', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      object: 'deals',
      property_id: 'codex_smoke_field',
      ctx_id: 'ctx-remote-delete',
      target: 'integration',
      provider: 'hubspot',
    });

    const result = await crmDeletePropertyTool.handler({
      reqContext: {
        client: { delete: del } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'deals',
        property_ref: 'codex_smoke_field',
        target: 'integration',
        provider: 'hubspot',
        confirm: true,
      },
    });

    expect(del).toHaveBeenCalledWith('https://api.sanka.com/v1/public/properties/deals/codex_smoke_field', {
      query: {
        object_name: 'deals',
        target: 'integration',
        provider: 'hubspot',
        confirm: true,
      },
    });
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      object: 'deals',
      property_id: 'codex_smoke_field',
      ctx_id: 'ctx-remote-delete',
      target: 'integration',
      provider: 'hubspot',
    });
  });

  it('lists routed object schemas from integration scope', async () => {
    const get = jest.fn().mockResolvedValue([
      {
        id: '2-123',
        name: 'asset',
        slug: 'asset',
        scope: 'integration',
        provider: 'hubspot',
        external_id: '2-123',
      },
    ]);

    const result = await crmListObjectSchemasTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        scope: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        search: 'asset',
        limit: 5,
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/object-schemas', {
      query: {
        scope: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        search: 'asset',
      },
    });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      total: 1,
      results: [
        {
          id: '2-123',
          name: 'asset',
          provider: 'hubspot',
        },
      ],
    });
  });

  it('mutates Salesforce object schema through Metadata API dry-run routing', async () => {
    const post = jest.fn().mockResolvedValue({
      ok: true,
      status: 'dry_run',
      operation: 'create',
      target: 'integration',
      provider: 'salesforce',
      external_id: 'Asset__c',
      object_schema_id: 'Asset__c',
      remote: {
        request: {
          metadata_api: true,
          soap_action: 'createMetadata',
          metadata_type: 'CustomObject',
          fullName: 'Asset__c',
        },
      },
      ctx_id: 'ctx-schema',
    });

    const result = await crmMutateObjectSchemaTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        operation: 'create',
        target: 'integration',
        provider: 'salesforce',
        external_object_type: 'Asset__c',
        name: 'Asset',
        plural_label: 'Assets',
        primary_display_property: 'Asset Name',
        dry_run: true,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/object-schemas', {
      body: {
        operation: 'create',
        target: 'integration',
        provider: 'salesforce',
        external_object_type: 'Asset__c',
        name: 'Asset',
        plural_label: 'Assets',
        primary_display_property: 'Asset Name',
        dry_run: true,
      },
    });
    expect(result.structuredContent).toMatchObject({
      status: 'dry_run',
      provider: 'salesforce',
      remote: {
        request: {
          metadata_api: true,
          soap_action: 'createMetadata',
          metadata_type: 'CustomObject',
        },
      },
    });
  });

  it('returns reauth metadata when calendar bootstrap is called without authentication', async () => {
    const bootstrap = jest.fn();

    const result = await crmGetCalendarBootstrapTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: { bootstrap },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: { slug: 'demo-event' },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it('loads calendar bootstrap context', async () => {
    const bootstrap = jest.fn().mockResolvedValue({
      message: 'ok',
      mode: 'book',
      status: 'ready',
      event: {
        id: 'event-1',
        title: 'Intro Call',
      },
      workspace: {
        id: 'workspace-1',
        name: 'Acme',
      },
    });

    const result = await crmGetCalendarBootstrapTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: { bootstrap },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        slug: 'intro-call',
        mode: 'book',
      },
    });

    expect(bootstrap).toHaveBeenCalledWith(
      {
        mode: 'book',
        slug: 'intro-call',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      message: 'ok',
      mode: 'book',
      status: 'ready',
      event: {
        id: 'event-1',
        title: 'Intro Call',
      },
      workspace: {
        id: 'workspace-1',
        name: 'Acme',
      },
    });
  });

  it('checks calendar availability', async () => {
    const checkAvailability = jest.fn().mockResolvedValue({
      message: 'ok',
      timezone: 'Asia/Tokyo',
      days: [
        {
          date: '2026-04-10',
          day_index: 5,
          weekday: 'Friday',
          slots: ['09:00', '10:00'],
        },
      ],
    });

    const result = await crmCheckCalendarAvailabilityTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: { checkAvailability },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        event_id: 'event-1',
        start_date: '2026-04-10',
        days: 3,
        timezone: 'Asia/Tokyo',
      },
    });

    expect(checkAvailability).toHaveBeenCalledWith(
      {
        event_id: 'event-1',
        start_date: '2026-04-10',
        days: 3,
        timezone: 'Asia/Tokyo',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      message: 'ok',
      timezone: 'Asia/Tokyo',
      days: [
        {
          date: '2026-04-10',
          day_index: 5,
          weekday: 'Friday',
          slots: ['09:00', '10:00'],
        },
      ],
    });
  });

  it('creates calendar attendance', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      message: 'Booked successfully.',
      attendance: {
        id: 'attendance-1',
      },
      meet_link: 'https://meet.example.com/abc',
    });

    const result = await crmCreateCalendarAttendanceTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: {
              attendance: { create },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        event_id: 'event-1',
        date: '2026-04-10',
        time: '09:00',
        name: 'Jane Doe',
        email: 'jane@example.com',
        timezone: 'Asia/Tokyo',
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        event_id: 'event-1',
        date: '2026-04-10',
        time: '09:00',
        name: 'Jane Doe',
        email: 'jane@example.com',
        timezone: 'Asia/Tokyo',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      message: 'Booked successfully.',
      attendance: {
        id: 'attendance-1',
      },
      meet_link: 'https://meet.example.com/abc',
    });
  });

  it('cancels calendar attendance', async () => {
    const cancel = jest.fn().mockResolvedValue({
      ok: true,
      status: 'cancelled',
      message: 'Attendance cancelled.',
      attendance: {
        id: 'attendance-1',
      },
    });

    const result = await crmCancelCalendarAttendanceTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: {
              attendance: { cancel },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        attendance_id: 'attendance-1',
      },
    });

    expect(cancel).toHaveBeenCalledWith('attendance-1', undefined);
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'cancelled',
      message: 'Attendance cancelled.',
      attendance: {
        id: 'attendance-1',
      },
    });
  });

  it('reschedules calendar attendance', async () => {
    const reschedule = jest.fn().mockResolvedValue({
      ok: true,
      status: 'rescheduled',
      message: 'Attendance rescheduled.',
      attendance: {
        id: 'attendance-1',
        select_date: '2026-04-11',
        time_event: '11:00',
      },
    });

    const result = await crmRescheduleCalendarAttendanceTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: {
              attendance: { reschedule },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        attendance_id: 'attendance-1',
        date: '2026-04-11',
        time: '11:00',
        comment: 'Need a later slot',
      },
    });

    expect(reschedule).toHaveBeenCalledWith(
      'attendance-1',
      {
        date: '2026-04-11',
        time: '11:00',
        comment: 'Need a later slot',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'rescheduled',
      message: 'Attendance rescheduled.',
      attendance: {
        id: 'attendance-1',
        select_date: '2026-04-11',
        time_event: '11:00',
      },
    });
  });

  it('lists items with workspace and language filters', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'item-1',
        item_id: 17,
        name: 'Widget',
        price: 300,
      },
    ]);

    const result = await crmListItemsTool.handler({
      reqContext: {
        client: {
          public: {
            items: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        workspace_id: 'ws-1',
        language: 'en',
        limit: 5,
      },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'ws-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'Returned 1 of 1 items.',
      permission: undefined,
      results: [
        {
          id: 'item-1',
          item_id: 17,
          name: 'Widget',
          price: 300,
        },
      ],
    });
  });

  it('updates items through the SDK V2 item update method', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      item_id: 'item-1',
      external_id: 'ITEM-EXT',
    });

    const result = await crmUpdateItemTool.handler({
      reqContext: {
        client: {
          public: {
            items: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        item_id: 'item-1',
        external_id: 'ITEM-EXT',
        name: 'Updated starter kit',
        price: 1400,
        purchase_price: 900,
        status: 'active',
      },
    });

    expect(crmUpdateItemTool.metadata.httpPath).toBe('/api/v2/items/{item_id}');
    expect(update).toHaveBeenCalledWith(
      'item-1',
      {
        externalId: 'ITEM-EXT',
        name: 'Updated starter kit',
        price: 1400,
        purchasePrice: 900,
        status: 'active',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      item_id: 'item-1',
      external_id: 'ITEM-EXT',
    });
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

  it('creates a subscription for a company customer with copied invoice line items', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'sub-1',
      status: 'active',
      subscription_status: 'active',
      items: [
        {
          id: null,
          item_id: null,
          line_item_id: 'line-1',
          name: 'Launch support package',
          amount: 1,
          price: 155000,
        },
      ],
      line_items: [
        {
          id: 'line-1',
          item_id: null,
          item_name: 'Launch support package',
          quantity: 1,
          unit_price: 155000,
        },
      ],
      contact_info: [{ id: 'company-1', name: 'Demo Company' }],
      created_at: '2026-06-01T00:00:00Z',
      number_item: 1,
    });

    const result = await crmCreateSubscriptionTool.handler({
      reqContext: {
        client: {
          public: {
            subscriptions: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'company-1',
        subscription_status: 'active',
        start_date: '2026-06-01',
        frequency: 1,
        frequency_time: 'months',
        currency: 'JPY',
        line_items: [
          {
            item_id: null,
            item_name: 'Launch support package',
            quantity: 1,
            unit_price: 155000,
          },
        ],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        cid: 'company-1',
        company_id: 'company-1',
        subscription_status: 'active',
        currency: 'JPY',
        frequency_time: 'months',
        start_date: '2026-06-01',
        frequency: 1,
        items: [
          {
            item_name: 'Launch support package',
            quantity: 1,
            unit_price: 155000,
          },
        ],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'sub-1',
      status: 'active',
      subscription_status: 'active',
      items: [
        {
          id: null,
          item_id: null,
          line_item_id: 'line-1',
          name: 'Launch support package',
          amount: 1,
          price: 155000,
        },
      ],
      line_items: [
        {
          id: 'line-1',
          item_id: null,
          item_name: 'Launch support package',
          quantity: 1,
          unit_price: 155000,
        },
      ],
      contact_info: [{ id: 'company-1', name: 'Demo Company' }],
      created_at: '2026-06-01T00:00:00Z',
      number_item: 1,
    });
  });

  it('rejects create_subscription without any customer identifier', async () => {
    const create = jest.fn();

    const result = await crmCreateSubscriptionTool.handler({
      reqContext: {
        client: {
          public: {
            subscriptions: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        subscription_status: 'active',
        items: [{ name: 'Plan', amount: 1, price: 100 }],
      },
    });

    expect(create).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: 'text',
        text: '`contact_id`, `company_id`, or `customer_id` is required.',
      },
    ]);
  });

  it('updates a subscription with lookup_external_id', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'sub-1',
      status: 'active',
      items: [],
      contact_info: [],
      created_at: '2026-04-09T00:00:00Z',
      number_item: 1,
    });

    const result = await crmUpdateSubscriptionTool.handler({
      reqContext: {
        client: {
          public: {
            subscriptions: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        subscription_id: 'sub-1',
        lookup_external_id: 'ext-sub-1',
        status: 'active',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'sub-1',
      {
        external_id: 'ext-sub-1',
        status: 'active',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'sub-1',
      status: 'active',
      items: [],
      contact_info: [],
      created_at: '2026-04-09T00:00:00Z',
      number_item: 1,
    });
  });

  it('updates a payment with lookup_external_id', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'ok',
      payment_id: 'pay-1',
      external_id: 'pay-ext-1',
    });

    const result = await crmUpdatePaymentTool.handler({
      reqContext: {
        client: {
          public: {
            payments: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        payment_id: 'pay-1',
        lookup_external_id: 'pay-ext-1',
        total_price: 1200,
        currency: 'USD',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'pay-1',
      {
        external_id: 'pay-ext-1',
        totalPrice: 1200,
        currency: 'USD',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'ok',
      payment_id: 'pay-1',
      external_id: 'pay-ext-1',
    });
  });

  it('lists locations with search filters', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'loc-1',
        id_iw: '17',
        warehouse: 'Main',
        location: 'A-1-1',
      },
    ]);

    const result = await crmListLocationsTool.handler({
      reqContext: {
        client: {
          public: {
            locations: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        workspace_id: 'ws-1',
        search: 'A-1',
      },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'ws-1',
        search: 'A-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'Returned 1 of 1 locations.',
      permission: undefined,
      results: [
        {
          id: 'loc-1',
          id_iw: '17',
          warehouse: 'Main',
          location: 'A-1-1',
        },
      ],
    });
  });

  it('updates inventory with required external id body', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'ok',
      inventory_id: 'inv-1',
      external_id: 'inv-ext-1',
    });

    const result = await crmUpdateInventoryTool.handler({
      reqContext: {
        client: {
          public: {
            inventories: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        inventory_id: 'inv-1',
        external_id: 'inv-ext-1',
        name: 'Warehouse stock',
        unit_price: 12.5,
      },
    });

    expect(update).toHaveBeenCalledWith(
      'inv-1',
      {
        externalId: 'inv-ext-1',
        name: 'Warehouse stock',
        unitPrice: 12.5,
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'ok',
      inventory_id: 'inv-1',
      external_id: 'inv-ext-1',
    });
  });

  it('creates inventory transactions with mapped payload keys', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'ok',
      transaction_id: 'txn-1',
      inventory_id: 'inv-1',
    });

    const result = await crmCreateInventoryTransactionTool.handler({
      reqContext: {
        client: {
          public: {
            inventoryTransactions: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        transaction_type: 'incoming',
        inventory_id: 'inv-1',
        amount: 3,
        use_unit_value: true,
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        transactionType: 'incoming',
        inventoryId: 'inv-1',
        amount: 3,
        useUnitValue: true,
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'ok',
      transaction_id: 'txn-1',
      inventory_id: 'inv-1',
    });
  });
  it('prospects companies when authentication is present', async () => {
    const create = jest.fn().mockResolvedValue({
      data: {
        count: 1,
        query: 'manufacturing companies in Tokyo',
        parsed_filters: {
          location: 'Tokyo',
          industry: 'Manufacturing',
        },
        results: [
          {
            name: 'Acme Manufacturing',
            domain: 'acme.example',
            industry: 'Manufacturing',
            relevance_score: 0.92,
          },
        ],
      },
      message: 'Prospecting completed.',
    });

    const result = await crmProspectCompaniesTool.handler({
      reqContext: {
        client: {
          prospect: {
            companies: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        query: 'manufacturing companies in Tokyo',
        location: 'Tokyo',
        industry: 'Manufacturing',
        limit: 5,
      },
    });

    expect(create).toHaveBeenCalledWith({
      query: 'manufacturing companies in Tokyo',
      location: 'Tokyo',
      industry: 'Manufacturing',
      limit: 5,
    });
    expect(result.structuredContent).toEqual({
      query: 'manufacturing companies in Tokyo',
      parsed_filters: {
        location: 'Tokyo',
        industry: 'Manufacturing',
      },
      count: 1,
      results: [
        {
          name: 'Acme Manufacturing',
          domain: 'acme.example',
          industry: 'Manufacturing',
          relevance_score: 0.92,
        },
      ],
      message: 'Prospecting completed.',
    });
  });

  it('scores a record when authentication is present', async () => {
    const create = jest.fn().mockResolvedValue({
      data: {
        object_type: 'company',
        record_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        snapshot_id: 'snap-1',
        algorithm_key: 'transparent_company_fit',
        algorithm_version: '2026-04-01',
        score_model_id: 'model-1',
        score_model_name: 'Default Fit',
        score_model_version: 3,
        input_hash: 'input-1',
        output_hash: 'output-1',
        score: 82,
        band: 'high',
        dimensions: [{ key: 'firmographics', score: 40 }],
        reasons: [{ label: 'ICP match', weight: 20 }],
        explanation: 'Strong ICP fit.',
      },
      message: 'Scoring completed.',
      ctx_id: 'ctx-score-1',
    });

    const result = await crmScoreRecordTool.handler({
      reqContext: {
        client: {
          score: { create },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'company',
        record_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        score_model_id: 'model-1',
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        object_type: 'company',
        record_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        score_model_id: 'model-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      data: {
        object_type: 'company',
        record_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        snapshot_id: 'snap-1',
        algorithm_key: 'transparent_company_fit',
        algorithm_version: '2026-04-01',
        score_model_id: 'model-1',
        score_model_name: 'Default Fit',
        score_model_version: 3,
        input_hash: 'input-1',
        output_hash: 'output-1',
        score: 82,
        band: 'high',
        dimensions: [{ key: 'firmographics', score: 40 }],
        reasons: [{ label: 'ICP match', weight: 20 }],
        explanation: 'Strong ICP fit.',
      },
      message: 'Scoring completed.',
      ctx_id: 'ctx-score-1',
    });
  });

  it('calls dedicated HR and payroll public endpoints', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: 'worker-1',
            id_worker: 10,
            worker_id: 'worker-1',
            name: 'NM',
            email: null,
          },
        ],
        page: 1,
        total: 1,
        count: 1,
        permission: 'read|edit|archive',
        message: 'OK',
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'att-1',
            track_id: 1,
            name: 'Daily attendance',
            status: 'stop',
          },
        ],
        page: 1,
        total: 1,
        count: 1,
        message: 'OK',
      });
    const post = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: 'absence-1',
          absence_id: 1,
          status: 'submitted',
        },
        status: 'created',
        message: 'created',
      })
      .mockResolvedValueOnce({
        data: {
          run: {
            id: 'run-1',
            period: '2026-04',
            status: 'calculated',
          },
          results: [],
        },
        message: 'OK',
      })
      .mockResolvedValueOnce({
        data: {
          id: 'journal-1',
          id_journal: 12,
          payroll_run_id: 'run-1',
          period: '2026-04',
          created: true,
        },
        message: 'OK',
      });

    const reqContext = {
      client: { get, post } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const employeeResult = await crmListEmployeesTool.handler({
      reqContext,
      args: { limit: 5, search: 'NM', language: 'ja' },
    });
    expect(get).toHaveBeenNthCalledWith(1, '/v1/public/employees', {
      query: { limit: 5, page: 1, search: 'NM', language: 'ja' },
    });
    expect(employeeResult.structuredContent?.['results']).toEqual([
      {
        id: 'worker-1',
        id_worker: 10,
        worker_id: 'worker-1',
        name: 'NM',
        email: null,
      },
    ]);
    expect(employeeResult.structuredContent?.['permission']).toBe('read|edit|archive');

    const absenceResult = await crmCreateAbsenceTool.handler({
      reqContext,
      args: {
        worker_id: 'worker-1',
        start_date: '2026-05-22',
        end_date: '2026-05-22',
        absence_type: 'pto',
      },
    });
    expect(post).toHaveBeenNthCalledWith(1, '/v1/public/absences', {
      body: {
        worker_id: 'worker-1',
        start_date: '2026-05-22',
        end_date: '2026-05-22',
        absence_type: 'pto',
      },
    });
    expect(absenceResult.structuredContent).toMatchObject({
      data: { id: 'absence-1', status: 'submitted' },
    });

    const attendanceResult = await crmListAttendanceRecordsTool.handler({
      reqContext,
      args: { limit: 5, search: 'Daily' },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/v1/public/attendance-records', {
      query: { limit: 5, page: 1, search: 'Daily' },
    });
    expect(attendanceResult.structuredContent?.['results']).toEqual([
      {
        id: 'att-1',
        track_id: 1,
        name: 'Daily attendance',
        status: 'stop',
      },
    ]);

    const payrollResult = await crmCalculatePayrollRunTool.handler({
      reqContext,
      args: { period: '2026-04', pay_date: '2026-04-30' },
    });
    expect(post).toHaveBeenNthCalledWith(2, '/v1/public/payroll/runs/calculate', {
      body: { period: '2026-04', pay_date: '2026-04-30' },
    });
    expect(payrollResult.structuredContent).toMatchObject({
      data: { run: { id: 'run-1', period: '2026-04' } },
    });

    const payrollJournalResult = await crmCreatePayrollJournalEntryTool.handler({
      reqContext,
      args: { run_id: 'run-1', notes: 'Monthly payroll journal' },
    });
    expect(post).toHaveBeenNthCalledWith(3, '/v1/public/payroll/runs/run-1/journal-entry', {
      query: {},
      body: { notes: 'Monthly payroll journal' },
    });
    expect(payrollJournalResult.structuredContent).toMatchObject({
      data: { id: 'journal-1', id_journal: 12, payroll_run_id: 'run-1' },
    });

    const pdfBytes = Buffer.from('%PDF-payroll');
    const asResponse = jest.fn().mockResolvedValue(
      new Response(pdfBytes, {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="payslip.pdf"; filename*=UTF-8\'\'payroll-payslip.pdf',
        },
      }),
    );
    get.mockReturnValueOnce({ asResponse });

    const payslipResult = await crmDownloadPayrollPayslipPDFTool.handler({
      reqContext,
      args: {
        run_id: 'run-1',
        result_id: 'result-1',
        language: 'ja',
      },
    });

    expect(get).toHaveBeenLastCalledWith('/v1/public/payroll/runs/run-1/payslips/pdf', {
      query: {
        result_id: 'result-1',
        language: 'ja',
      },
    });
    expect(payslipResult.structuredContent).toMatchObject({
      mime_type: 'application/pdf',
      filename: 'payroll-payslip.pdf',
      byte_length: pdfBytes.byteLength,
      download_complete: true,
      content_base64_available: true,
      content_base64: pdfBytes.toString('base64'),
    });
  });

  it('creates subscriptions with end dates and contract associations', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'sub-1',
      subscription_status: 'active',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      contract_info: [{ id: 'contract-1', contract_id: 7, name: 'MSA' }],
      created_at: '2026-05-01T00:00:00Z',
      items: [],
    });

    const result = await crmCreateSubscriptionTool.handler({
      reqContext: {
        client: {
          public: {
            subscriptions: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'company-1',
        items: [{ item_name: 'Monthly platform fee', quantity: 1, unit_price: 1000 }],
        subscription_status: 'active',
        start_date: '2026-05-01',
        end_date: '2026-05-31',
        contract_ids: ['contract-1'],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        cid: 'company-1',
        company_id: 'company-1',
        items: [{ item_name: 'Monthly platform fee', quantity: 1, unit_price: 1000 }],
        subscription_status: 'active',
        start_date: '2026-05-01',
        end_date: '2026-05-31',
        contract_ids: ['contract-1'],
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      id: 'sub-1',
      end_date: '2026-05-31',
      contract_info: [{ id: 'contract-1' }],
    });
  });

  it('updates subscription dates and clears contract associations', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'sub-1',
      subscription_status: 'completed',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      contract_info: [],
      created_at: '2026-05-01T00:00:00Z',
      items: [],
    });

    const result = await crmUpdateSubscriptionTool.handler({
      reqContext: {
        client: {
          public: {
            subscriptions: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        subscription_id: 'sub-1',
        status: 'completed',
        start_date: '2026-05-01',
        end_date: '2026-05-31',
        contract_ids: [],
      },
    });

    expect(update).toHaveBeenCalledWith(
      'sub-1',
      {
        status: 'completed',
        start_date: '2026-05-01',
        end_date: '2026-05-31',
        contract_ids: [],
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      id: 'sub-1',
      subscription_status: 'completed',
      end_date: '2026-05-31',
      contract_info: [],
    });
  });
});
