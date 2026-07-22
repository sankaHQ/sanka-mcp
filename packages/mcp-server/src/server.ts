// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  SetLevelRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ClientOptions } from 'sanka-sdk';
import Sanka from 'sanka-sdk';
import { browserUseTool } from './browser-use-tools';
import { getCapabilityGuidanceTool } from './capability-guidance-tools';
import { getCargoCatalogTool, importCargoCatalogTool } from './cargo-catalog-tools';
import { codeTool } from './code-tool';
import {
  createFerryDiagramTool,
  deleteFerryDiagramTool,
  getFerryDiagramTool,
  listFerryDiagramsTool,
  updateFerryDiagramTool,
} from './ferry-diagram-tools';
import {
  batchUpsertFerryTodosTool,
  createFerryDocTool,
  createFerryTodoTool,
  deleteFerryTodoTool,
  getFerryProgramTool,
  listFerryDocsTool,
  listFerryProgramsTool,
  updateFerryDocTool,
  updateFerryTodoTool,
} from './ferry-program-tools';
import {
  cancelBuyRequestTool,
  confirmBuyOrderTool,
  createBuyBillTool,
  createBuyPurchaseOrderTool,
  createBuyRequestTool,
  getBuyMerchantPurchaseTool,
  getBuyRequestTool,
  getBuySourcingRunTool,
  listBuyRequestsTool,
  listBuySourcingRunsTool,
  prepareBuyCheckoutTool,
  previewBuyAccountingTool,
  previewBuyApprovalTool,
  previewBuyRequestTool,
  selectBuyOfferTool,
  sourceBuyRequestTool,
  submitBuyRequestTool,
  syncBuyRfqTool,
  updateBuyRequestTool,
} from './sanka-buy-tools';
import {
  crmArchiveCustomObjectRecordTool,
  crmArchivePrivateMessageThreadTool,
  crmAggregateRecordsTool,
  crmApplyAppBlueprintTool,
  crmApplyCompanyPriceTableItemsTool,
  crmApproveRecordApprovalTool,
  crmApprovePayrollRunTool,
  crmApproveIncentivesTool,
  crmCancelCalendarAttendanceTool,
  crmCancelWorkspaceInvitationTool,
  crmCalculateIncentivesTool,
  crmCapturePipelineSnapshotTool,
  crmCheckCalendarAvailabilityTool,
  crmComparePipelineSnapshotsTool,
  crmCreateCalendarAttendanceTool,
  crmCreateAssociationTool,
  crmCreateCompanyTool,
  crmCreateApprovalRequestTool,
  crmCreateContactTool,
  crmCreateContractFromTemplateTool,
  crmCreateCustomObjectRecordTool,
  crmCreateDealTool,
  crmCreateEstimateTool,
  crmCreateExpenseTool,
  crmCreateDisbursementAllocationTool,
  crmCreateInvoiceTool,
  crmCreateInventoryTool,
  crmCreateInventoryTransactionTool,
  crmCreateIncentivePlanTool,
  crmCreateAbsenceTool,
  crmCreateAttendanceRecordTool,
  crmCreatePermissionSetTool,
  crmCreateItemTool,
  crmCreateJournalStatementViewTool,
  crmCreateLocationTool,
  crmCreateOrderTool,
  crmCreatePaymentTool,
  crmCreateProjectTool,
  crmCreatePurchaseOrderTool,
  crmCreatePayrollJournalEntryTool,
  crmCreateReportTool,
  crmCreateBillTool,
  crmCreateDisbursementTool,
  crmCreateSlipTool,
  crmCreatePropertyTool,
  crmCreateSubscriptionTool,
  crmCreateTaskTool,
  crmCreateTicketTool,
  crmCreateViewTool,
  crmDeleteApprovalRuleTool,
  crmDeleteCompanyTool,
  crmDeleteDeliveryRuleTool,
  crmDeleteAssociationTool,
  crmDeleteContactTool,
  crmDeleteDealTool,
  crmDeleteEstimateTool,
  crmDeleteExpenseTool,
  crmDeleteDisbursementAllocationTool,
  crmDeleteInventoryTool,
  crmDeleteInventoryTransactionTool,
  crmActivateInvoiceTool,
  crmDeleteInvoiceTool,
  crmDeleteItemTool,
  crmDeleteLocationTool,
  crmActivateOrderTool,
  crmDeleteOrderTool,
  crmPermanentDeleteOrderTool,
  crmPermanentDeleteInvoiceTool,
  crmDeletePaymentTool,
  crmDeleteProjectTool,
  crmDeletePurchaseOrderTool,
  crmDeleteReportTool,
  crmDeleteBillTool,
  crmDeleteDisbursementTool,
  crmDeleteAbsenceTool,
  crmDeleteAttendanceRecordTool,
  crmDeleteLockRuleTool,
  crmDeleteSlipTool,
  crmDeletePropertyTool,
  crmDeleteSubscriptionTool,
  crmDeleteTaskTool,
  crmDeleteTicketTool,
  crmDeleteViewTool,
  crmAuthStatusTool,
  crmConnectSankaTool,
  crmCurrentWorkspaceTool,
  crmGetCalendarBootstrapTool,
  crmGetAbsenceTool,
  crmGetAttendanceRecordTool,
  crmGetCompanyTool,
  crmGetCompanyPriceTableTool,
  crmGetContactTool,
  crmGetContractWorkflowStateTool,
  crmGetDealTool,
  crmDownloadContractTemplateTool,
  crmDownloadEstimatePDFTool,
  crmAppendEstimateAttachmentUploadChunkTool,
  crmFinishEstimateAttachmentUploadTool,
  crmStartEstimateAttachmentUploadTool,
  crmUploadEstimateAttachmentTool,
  crmDownloadInvoicePDFTool,
  crmAppendInvoiceAttachmentUploadChunkTool,
  crmFinishInvoiceAttachmentUploadTool,
  crmStartInvoiceAttachmentUploadTool,
  crmUploadInvoiceAttachmentTool,
  crmDownloadOrderPDFTool,
  crmAppendOrderAttachmentUploadChunkTool,
  crmFinishOrderAttachmentUploadTool,
  crmStartOrderAttachmentUploadTool,
  crmUploadOrderAttachmentTool,
  crmDownloadPaymentPDFTool,
  crmDownloadPayrollPayslipPDFTool,
  crmDownloadPurchaseOrderPDFTool,
  crmAppendPurchaseOrderAttachmentUploadChunkTool,
  crmFinishPurchaseOrderAttachmentUploadTool,
  crmStartPurchaseOrderAttachmentUploadTool,
  crmUploadPurchaseOrderAttachmentTool,
  crmDownloadSlipPDFTool,
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
  crmGetPermissionSetEditorTool,
  crmGetPipelineSnapshotBatchTool,
  crmGetPayrollRunTool,
  crmGetProjectTool,
  crmGetPurchaseOrderTool,
  crmGetReportTool,
  crmGetBillTool,
  crmGetDisbursementTool,
  crmGetSlipTool,
  crmGetPrivateMessageThreadTool,
  crmGetWorkspaceMessageThreadTool,
  crmGetApprovalRuleOptionsTool,
  crmGetDeliveryRuleOptionsTool,
  crmGetLockRuleOptionsTool,
  crmGetPropertyTool,
  crmGetSubscriptionTool,
  crmGetTaskTool,
  crmGetTicketTool,
  crmGetViewColumnsTool,
  crmGetViewTool,
  crmListCompaniesTool,
  crmListEmployeesTool,
  crmListAbsencesTool,
  crmListAttendanceRecordsTool,
  crmListAssociationsTool,
  crmListContactsTool,
  crmListContractTemplatesTool,
  crmListDealPipelinesTool,
  crmListDealsTool,
  crmListPipelineSnapshotBatchesTool,
  crmListWorkspacesTool,
  crmListWorkspaceInvitationsTool,
  crmListEstimatesTool,
  crmListExpensesTool,
  crmListInventoriesTool,
  crmListIncentiveCompanyOptionsTool,
  crmListIncentivePlansTool,
  crmListIncentivesTool,
  crmListInvoicesTool,
  crmListJournalEntriesTool,
  crmListOverdueInvoicesTool,
  crmListInventoryTransactionsTool,
  crmListItemsTool,
  crmListLocationsTool,
  crmListOrdersTool,
  crmInviteWorkspaceUserTool,
  crmListDisbursementAllocationsTool,
  crmListPaymentAllocationsTool,
  crmListPaymentsTool,
  crmListPermissionSetsTool,
  crmListPayrollProfilesTool,
  crmListPayrollRunsTool,
  crmListProjectsTool,
  crmListPurchaseOrdersTool,
  crmListReportsTool,
  crmListBillsTool,
  crmListAppBlueprintTemplatesTool,
  crmListDisbursementsTool,
  crmListSlipsTool,
  crmListPrivateMessagesTool,
  crmListWorkspaceMessagesTool,
  crmListObjectSchemasTool,
  crmListRecordApprovalsTool,
  crmListApprovalRulesTool,
  crmListDeliveryRulesTool,
  crmListLockRulesTool,
  crmListPropertiesTool,
  crmListSubscriptionsTool,
  crmListTasksTool,
  crmListTicketPipelinesTool,
  crmListTicketsTool,
  crmListViewsTool,
  crmMergeRecordsTool,
  crmProspectCompaniesTool,
  crmPreviewAppBlueprintTool,
  crmMutateObjectSchemaTool,
  crmPreviewRecordMergeTool,
  crmQueryRecordsTool,
  crmReadBinaryDownloadChunkTool,
  crmReplyPrivateMessageThreadTool,
  crmReplyWorkspaceMessageThreadTool,
  crmRejectRecordApprovalTool,
  crmRescheduleCalendarAttendanceTool,
  crmSaveContractPlaceFieldsTool,
  crmSaveContractRecipientsTool,
  crmSaveContractSignersTool,
  crmScheduleContractRequestTool,
  crmScoreRecordTool,
  crmSendContractRequestTool,
  crmSendInvoiceEmailTool,
  crmSyncPipelineSnapshotHubSpotPropertiesTool,
  crmSyncPrivateMessagesTool,
  crmSyncWorkspaceMessagesTool,
  crmSwitchWorkspaceTool,
  crmAppendBillAttachmentUploadChunkTool,
  crmFinishBillAttachmentUploadTool,
  crmStartBillAttachmentUploadTool,
  crmUpdateCompanyTool,
  crmUpdateCompanyPriceTableCompanyTool,
  crmUpdateCompanyPriceTableItemTool,
  crmUpdateContractMetadataTool,
  crmUploadBillAttachmentTool,
  crmUploadContractPDFTool,
  crmReplaceContractPDFTool,
  crmUploadContractTemplateTool,
  crmUpdateContactTool,
  crmUpdateCustomObjectRecordTool,
  crmUpdateDealTool,
  crmUpdateDisbursementAllocationTool,
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
  crmUpdatePermissionSetTool,
  crmUpdateProjectTool,
  crmUpdatePurchaseOrderTool,
  crmUpdateReportTool,
  crmUpdateBillTool,
  crmUpdateAbsenceTool,
  crmUpdateAttendanceRecordTool,
  crmUpdateDisbursementTool,
  crmUpdateSlipTool,
  crmUpdatePropertyTool,
  crmUpdateSubscriptionTool,
  crmUpdateTaskTool,
  crmUpdateTicketStatusTool,
  crmUpdateTicketTool,
  crmUpsertApprovalRuleTool,
  crmUpsertDeliveryRuleTool,
  crmUpsertLockRuleTool,
  crmUpsertPayrollProfileTool,
  crmCalculatePayrollRunTool,
  crmUpdateViewTool,
  crmUploadExpenseAttachmentTool,
  crmStartExpenseAttachmentUploadTool,
  crmAppendExpenseAttachmentUploadChunkTool,
  crmFinishExpenseAttachmentUploadTool,
} from './crm-tools';
import { demoGenerateTool, integrationSyncPushTool } from './demo-tools';
import docsSearchTool from './docs-search-tool';
import { setLocalSearch } from './docs-search-tool';
import { getSharedLocalDocsSearch } from './local-docs-search';
import { getInstructions } from './instructions';
import { McpOptions } from './options';
import { blockedMethodsForCodeTool } from './methods';
import { ToolProfile } from './profile';
import {
  cancelExportJobTool,
  cancelImportJobTool,
  exportRecordsTool,
  getExportJobTool,
  getImportJobTool,
  importRecordsTool,
  listExportJobsTool,
  listImportJobsTool,
  listIntegrationChannelsTool,
  retryExportJobTool,
  retryImportJobTool,
  uploadImportFileTool,
} from './transfer-tools';
import {
  getWorkflowRunTool,
  previewWorkflowTool,
  resolveRecordTool,
  startWorkflowTool,
} from './workflow-run-tools';
import {
  createBuyRequestFromFindingTool,
  getWatchtowerSummaryTool,
  listWatchtowerFindingsTool,
  updateWatchtowerFindingTool,
} from './watchtower-tools';
import { lookoutCreateLpBatchTool, lookoutGetRunTool } from './lookout-tools';
import { createWorkflowTool, runWorkflowTool, updateWorkflowTool } from './workflow-tools';
import { McpRequestContext, ToolCallResult, McpTool } from './types';
import { requireScopes } from './tool-auth';
import { applyRequiredScopesToSecuritySchemes, getToolRequiredScopes } from './tool-scope-requirements';
import { validateToolArguments } from './tool-argument-validator';
import { buildToolErrorResult, normalizeToolCallResult } from './tool-result-normalizer';
import { enrichRecordUrlsForToolResult } from './record-url-enrichment';

export const SAKURA_MCP_SERVER_NAME = 'sakura';
export const SANKA_MCP_SERVER_VERSION =
  process.env['SANKA_MCP_SERVER_VERSION'] || process.env['npm_package_version'] || '0.0.1';

export const newMcpServer = async ({
  customInstructionsPath,
  toolProfile,
}: {
  customInstructionsPath?: string | undefined;
  toolProfile?: ToolProfile | undefined;
}) =>
  new McpServer(
    {
      name: SAKURA_MCP_SERVER_NAME,
      version: SANKA_MCP_SERVER_VERSION,
    },
    {
      instructions: await getInstructions({ customInstructionsPath, toolProfile }),
      capabilities: { tools: {}, logging: {} },
    },
  );

type ToolCallLogClient = {
  post: (
    path: string,
    options: { body: Record<string, unknown>; headers: Record<string, string> },
  ) => Promise<unknown>;
};

type ToolCallLogger = {
  warn: (message: string, ...rest: unknown[]) => void;
};

type ToolLogRecordIds = Record<string, string | string[]>;

const TOOL_LOG_SUMMARY_MAX_LENGTH = 500;
const TOOL_LOG_RECORD_ID_MAX_ITEMS = 20;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readToolLogID = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const text = value.trim();
    return text || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const addToolLogRecordID = (recordIds: ToolLogRecordIds, key: string, value: unknown, asArray = false) => {
  const id = readToolLogID(value);
  if (!id) {
    return;
  }

  const existing = recordIds[key];
  if (!existing) {
    recordIds[key] = asArray ? [id] : id;
    return;
  }

  const values = Array.isArray(existing) ? existing : [existing];
  if (!values.includes(id) && values.length < TOOL_LOG_RECORD_ID_MAX_ITEMS) {
    recordIds[key] = [...values, id];
  } else {
    recordIds[key] = values;
  }
};

const copyToolLogRecordIds = (recordIds: ToolLogRecordIds, source: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => addToolLogRecordID(recordIds, key, entry, true));
    } else {
      addToolLogRecordID(recordIds, key, value, key.endsWith('s'));
    }
  }
};

const summarizeToolResult = (result: ToolCallResult): string | undefined => {
  const text = result.content
    .map((entry) => (entry.type === 'text' ? entry.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
  return text ? text.slice(0, TOOL_LOG_SUMMARY_MAX_LENGTH) : undefined;
};

const summarizeToolError = (result: ToolCallResult): string | undefined => {
  if (!result.isError) {
    return undefined;
  }
  return summarizeToolResult(result) ?? 'tool_error';
};

const extractToolLogRecordIds = (result: ToolCallResult): ToolLogRecordIds | undefined => {
  const payload = result.structuredContent;
  if (!isRecord(payload)) {
    return undefined;
  }

  const recordIds: ToolLogRecordIds = {};
  const confirmation = isRecord(payload['confirmation']) ? payload['confirmation'] : undefined;
  const confirmationRecordIds =
    isRecord(confirmation?.['record_ids']) ? confirmation['record_ids'] : undefined;
  if (confirmationRecordIds) {
    copyToolLogRecordIds(recordIds, confirmationRecordIds);
  }

  const payment = isRecord(payload['payment']) ? payload['payment'] : undefined;
  if (payment) {
    addToolLogRecordID(recordIds, 'payment_id', payment['id'] ?? payment['payment_id'] ?? payment['id_rcp']);
  }

  const invoice = isRecord(payload['invoice']) ? payload['invoice'] : undefined;
  if (invoice) {
    addToolLogRecordID(recordIds, 'invoice_id', invoice['id'] ?? invoice['invoice_id'] ?? invoice['id_inv']);
  }

  const allocations = Array.isArray(payload['allocations']) ? payload['allocations'] : [];
  for (const allocation of allocations) {
    const row = isRecord(allocation) ? allocation : undefined;
    if (!row) {
      continue;
    }

    addToolLogRecordID(recordIds, 'allocation_ids', row['id'] ?? row['allocation_id'], true);
    addToolLogRecordID(recordIds, 'invoice_ids', row['invoice_id'] ?? row['id_inv'], true);
    addToolLogRecordID(recordIds, 'payment_ids', row['payment_id'], true);

    const allocationInvoice = isRecord(row['invoice']) ? row['invoice'] : undefined;
    if (allocationInvoice) {
      addToolLogRecordID(
        recordIds,
        'invoice_ids',
        allocationInvoice['id'] ?? allocationInvoice['invoice_id'] ?? allocationInvoice['id_inv'],
        true,
      );
    }

    const allocationPayment = isRecord(row['payment']) ? row['payment'] : undefined;
    if (allocationPayment) {
      addToolLogRecordID(
        recordIds,
        'payment_ids',
        allocationPayment['id'] ?? allocationPayment['payment_id'] ?? allocationPayment['id_rcp'],
        true,
      );
    }
  }

  return Object.keys(recordIds).length > 0 ? recordIds : undefined;
};

export async function recordMcpToolCall({
  client,
  logger,
  mcpTool,
  reqContext,
  result,
  startedAt,
}: {
  client: Sanka;
  logger: ToolCallLogger;
  mcpTool: McpTool;
  reqContext: McpRequestContext;
  result: ToolCallResult;
  startedAt: number;
}): Promise<void> {
  if (!reqContext.mcpSessionId || reqContext.auth?.authMode !== 'oauth_bearer') {
    return;
  }

  const resultSummary = summarizeToolResult(result);
  const error = summarizeToolError(result);
  const recordIds = extractToolLogRecordIds(result);
  try {
    await (client as unknown as ToolCallLogClient).post('/api/v2/mcp/tool-call-log', {
      body: {
        tool_name: mcpTool.tool.name,
        tool_title: mcpTool.tool.title ?? mcpTool.tool.name,
        resource: mcpTool.metadata.resource,
        operation: mcpTool.metadata.operation,
        success: !result.isError,
        duration_ms: Math.max(0, Date.now() - startedAt),
        ...(reqContext.mcpClientInfo?.name ? { client_name: reqContext.mcpClientInfo.name } : undefined),
        ...(reqContext.mcpClientInfo?.version ?
          { client_version: reqContext.mcpClientInfo.version }
        : undefined),
        ...(reqContext.mcpRequestEnvironment?.ipAddress ?
          { source_ip_address: reqContext.mcpRequestEnvironment.ipAddress }
        : undefined),
        ...(reqContext.mcpRequestEnvironment?.userAgent ?
          { source_user_agent: reqContext.mcpRequestEnvironment.userAgent }
        : undefined),
        ...(reqContext.mcpRequestEnvironment?.browser ?
          { source_browser: reqContext.mcpRequestEnvironment.browser }
        : undefined),
        ...(reqContext.mcpRequestEnvironment?.os ?
          { source_os: reqContext.mcpRequestEnvironment.os }
        : undefined),
        ...(reqContext.mcpRequestEnvironment?.deviceType ?
          { source_device_type: reqContext.mcpRequestEnvironment.deviceType }
        : undefined),
        ...(reqContext.mcpProtocolVersion ?
          { mcp_protocol_version: reqContext.mcpProtocolVersion }
        : undefined),
        mcp_server_name: SAKURA_MCP_SERVER_NAME,
        mcp_server_version: SANKA_MCP_SERVER_VERSION,
        ...(reqContext.mcpRequestEnvironment?.modelProvider ?
          { model_provider: reqContext.mcpRequestEnvironment.modelProvider }
        : undefined),
        ...(reqContext.mcpRequestEnvironment?.modelName ?
          { model_name: reqContext.mcpRequestEnvironment.modelName }
        : undefined),
        ...(resultSummary ? { result_summary: resultSummary } : undefined),
        ...(recordIds ? { record_ids: recordIds } : undefined),
        ...(error ? { error } : undefined),
      },
      headers: {
        'X-Sanka-MCP-Session-ID': reqContext.mcpSessionId,
      },
    });
  } catch (error) {
    logger.warn('Failed to record MCP tool call log', error);
  }
}

/**
 * Tool selection and scope preparation only depend on the tool profile and the
 * code-execution permission options, not on per-request auth or session state.
 * Cache the prepared tool arrays per distinct configuration so every request
 * does not rebuild and re-map the full tool registry. The cache is bounded
 * because permission overrides can arrive from client-controlled headers.
 */
const PREPARED_TOOLS_CACHE_MAX = 100;
const preparedToolsCache = new Map<string, McpTool[]>();

// Mirrors the option gating inside selectTools: generic code/docs tools exist
// only in the 'full' profile, and code-permission options only matter when the
// code tool is included. Keep this in sync with selectTools when selection
// starts depending on new options.
const preparedToolsCacheKey = (options: McpOptions | undefined, profile: ToolProfile): string => {
  const includeGenericTools = profile === 'full';
  const includeCodeTool = includeGenericTools && (options?.includeCodeTool ?? true);
  const includeDocsTools = includeGenericTools && (options?.includeDocsTools ?? true);
  return JSON.stringify({
    profile,
    includeCodeTool,
    includeDocsTools,
    codeAllowHttpGets: includeCodeTool ? options?.codeAllowHttpGets ?? null : null,
    codeAllowedMethods: includeCodeTool ? options?.codeAllowedMethods ?? null : null,
    codeBlockedMethods: includeCodeTool ? options?.codeBlockedMethods ?? null : null,
  });
};

/**
 * Returns the selected tools with required OAuth scopes applied, memoized per
 * (profile, code-permission options) configuration. The returned array and its
 * tools are shared across requests and must be treated as immutable.
 */
export function selectPreparedTools(options?: McpOptions, profile: ToolProfile = 'full'): McpTool[] {
  const cacheKey = preparedToolsCacheKey(options, profile);
  const cached = preparedToolsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const prepared = selectTools(options, profile).map(applyRequiredScopesToSecuritySchemes);
  if (preparedToolsCache.size >= PREPARED_TOOLS_CACHE_MAX) {
    const oldestKey = preparedToolsCache.keys().next().value;
    if (oldestKey !== undefined) {
      preparedToolsCache.delete(oldestKey);
    }
  }
  preparedToolsCache.set(cacheKey, prepared);
  return prepared;
}

/**
 * Initializes the provided MCP Server with the given tools and handlers.
 * If not provided, the default client, tools and handlers will be used.
 * Returns the tools registered on the server so callers can reuse the
 * selection instead of recomputing it.
 */
export async function initMcpServer(params: {
  server: Server | McpServer;
  clientOptions?: ClientOptions;
  mcpOptions?: McpOptions;
  mcpSessionId?: string | undefined;
  mcpClientInfo?: { name: string; version: string } | undefined;
  mcpProtocolVersion?: string | undefined;
  mcpRequestEnvironment?: McpRequestContext['mcpRequestEnvironment'];
  toolProfile?: ToolProfile | undefined;
  auth?: McpRequestContext['auth'];
  downloadBaseUrl?: string | undefined;
}): Promise<{ tools: McpTool[] }> {
  const server = params.server instanceof McpServer ? params.server.server : params.server;

  const logAtLevel =
    (level: 'debug' | 'info' | 'warning' | 'error') =>
    (message: string, ...rest: unknown[]) => {
      void server.sendLoggingMessage({
        level,
        data: { message, rest },
      });
    };
  const logger = {
    debug: logAtLevel('debug'),
    info: logAtLevel('info'),
    warn: logAtLevel('warning'),
    error: logAtLevel('error'),
  };

  const docsDir = params.mcpOptions?.docsDir;
  const localSearch = await getSharedLocalDocsSearch(docsDir ? { docsDir } : undefined);
  setLocalSearch(localSearch);

  let _client: Sanka | undefined;
  let _clientError: Error | undefined;
  let _logLevel: 'debug' | 'info' | 'warn' | 'error' | 'off' | undefined;

  const getClient = (): Sanka => {
    if (_clientError) throw _clientError;
    if (!_client) {
      try {
        _client = new Sanka({
          logger,
          ...params.clientOptions,
          defaultHeaders: {
            ...params.clientOptions?.defaultHeaders,
            'X-Sanka-MCP': 'true',
          },
        });
        if (_logLevel) {
          _client = _client.withOptions({ logLevel: _logLevel });
        }
      } catch (e) {
        _clientError = e instanceof Error ? e : new Error(String(e));
        throw _clientError;
      }
    }
    return _client;
  };

  const toolProfile = params.toolProfile ?? 'full';
  const providedTools = selectPreparedTools(params.mcpOptions, toolProfile);
  const toolMap = Object.fromEntries(providedTools.map((mcpTool) => [mcpTool.tool.name, mcpTool]));

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: providedTools.map((mcpTool) => mcpTool.tool),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const mcpTool = toolMap[name];
    if (!mcpTool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const reqContext: McpRequestContext = {
      client: undefined as any,
      mcpSessionId: params.mcpSessionId,
      mcpClientInfo: params.mcpClientInfo,
      mcpProtocolVersion: params.mcpProtocolVersion,
      mcpRequestEnvironment: params.mcpRequestEnvironment,
      toolProfile,
      auth: params.auth,
      downloadBaseUrl: params.downloadBaseUrl,
    };
    const startedAt = Date.now();

    const scopeError = requireScopes({
      reqContext,
      requiredScopes: getToolRequiredScopes({ tool: mcpTool, args }),
      toolTitle: mcpTool.tool.title ?? mcpTool.tool.name,
    });
    if (scopeError) {
      const normalizedScopeError = normalizeToolCallResult({
        mcpTool,
        result: scopeError,
        args,
      });
      try {
        const client = getClient();
        // Fire-and-forget: never make the tool result wait on the audit log POST.
        void recordMcpToolCall({
          client,
          logger,
          mcpTool,
          reqContext: {
            ...reqContext,
            client,
          },
          result: normalizedScopeError,
          startedAt,
        }).catch((error) => {
          logger.warn('Failed to record MCP tool call scope error log', error);
        });
      } catch (error) {
        logger.warn('Failed to record MCP tool call scope error log', error);
      }
      return normalizedScopeError;
    }

    let client: Sanka;
    try {
      client = getClient();
    } catch (error) {
      return normalizeToolCallResult({
        mcpTool,
        args,
        result: buildToolErrorResult(error),
      });
    }

    const reqContextWithClient = {
      ...reqContext,
      client,
    };

    try {
      const result = normalizeToolCallResult({
        mcpTool,
        result: await executeHandler({
          mcpTool,
          reqContext: reqContextWithClient,
          args,
        }),
        args,
      });
      const enrichedResult = enrichRecordUrlsForToolResult({
        result,
        resource: mcpTool.metadata.resource,
        reqContext: reqContextWithClient,
        args,
      });
      // Fire-and-forget: never make the tool result wait on the audit log POST.
      void recordMcpToolCall({
        client,
        logger,
        mcpTool,
        reqContext: reqContextWithClient,
        result: enrichedResult,
        startedAt,
      }).catch((error) => {
        logger.warn('Failed to record MCP tool call log', error);
      });
      return enrichedResult;
    } catch (error) {
      const errorResult = normalizeToolCallResult({
        mcpTool,
        args,
        result: buildToolErrorResult(error),
      });
      // Fire-and-forget: never make the tool result wait on the audit log POST.
      void recordMcpToolCall({
        client,
        logger,
        mcpTool,
        reqContext: reqContextWithClient,
        result: errorResult,
        startedAt,
      }).catch((logError) => {
        logger.warn('Failed to record MCP tool call log', logError);
      });
      return errorResult;
    }
  });

  server.setRequestHandler(SetLevelRequestSchema, async (request) => {
    const { level } = request.params;
    let logLevel: 'debug' | 'info' | 'warn' | 'error' | 'off';
    switch (level) {
      case 'debug':
        logLevel = 'debug';
        break;
      case 'info':
        logLevel = 'info';
        break;
      case 'notice':
      case 'warning':
        logLevel = 'warn';
        break;
      case 'error':
        logLevel = 'error';
        break;
      default:
        logLevel = 'off';
        break;
    }
    _logLevel = logLevel;
    if (_client) {
      _client = _client.withOptions({ logLevel });
    }
    return {};
  });

  return { tools: providedTools };
}

/**
 * Selects the tools to include in the MCP Server based on the provided options.
 *
 * NOTE: if selection starts depending on additional options, update
 * preparedToolsCacheKey so the memoized variant keys on them too.
 */
export function selectTools(options?: McpOptions, _profile: ToolProfile = 'full'): McpTool[] {
  const includedTools = [];

  const includeGenericTools = _profile === 'full';

  if (includeGenericTools && (options?.includeCodeTool ?? true)) {
    includedTools.push(
      codeTool({
        blockedMethods: blockedMethodsForCodeTool(options),
      }),
    );
  }
  if (includeGenericTools && (options?.includeDocsTools ?? true)) {
    includedTools.push(docsSearchTool);
  }
  includedTools.push(
    getCapabilityGuidanceTool,
    getCargoCatalogTool,
    importCargoCatalogTool,
    crmConnectSankaTool,
    crmAuthStatusTool,
    crmCurrentWorkspaceTool,
    crmListWorkspacesTool,
    crmSwitchWorkspaceTool,
    crmInviteWorkspaceUserTool,
    crmListWorkspaceInvitationsTool,
    crmCancelWorkspaceInvitationTool,
    crmReadBinaryDownloadChunkTool,
    crmListPrivateMessagesTool,
    crmSyncPrivateMessagesTool,
    crmGetPrivateMessageThreadTool,
    crmReplyPrivateMessageThreadTool,
    crmArchivePrivateMessageThreadTool,
    crmListWorkspaceMessagesTool,
    crmSyncWorkspaceMessagesTool,
    crmGetWorkspaceMessageThreadTool,
    crmReplyWorkspaceMessageThreadTool,
    crmQueryRecordsTool,
    crmAggregateRecordsTool,
    crmListAppBlueprintTemplatesTool,
    crmPreviewAppBlueprintTool,
    crmApplyAppBlueprintTool,
    crmPreviewRecordMergeTool,
    crmMergeRecordsTool,
    crmCreateCustomObjectRecordTool,
    crmUpdateCustomObjectRecordTool,
    crmArchiveCustomObjectRecordTool,
    crmListAssociationsTool,
    crmCreateAssociationTool,
    crmDeleteAssociationTool,
    crmListCompaniesTool,
    crmGetCompanyTool,
    crmCreateCompanyTool,
    crmUpdateCompanyTool,
    crmDeleteCompanyTool,
    crmGetCompanyPriceTableTool,
    crmUpdateCompanyPriceTableCompanyTool,
    crmUpdateCompanyPriceTableItemTool,
    crmApplyCompanyPriceTableItemsTool,
    crmListContactsTool,
    crmGetContactTool,
    crmCreateContactTool,
    crmUpdateContactTool,
    crmDeleteContactTool,
    crmListDealsTool,
    crmGetDealTool,
    crmCreateDealTool,
    crmUpdateDealTool,
    crmDeleteDealTool,
    crmListDealPipelinesTool,
    crmCapturePipelineSnapshotTool,
    crmListPipelineSnapshotBatchesTool,
    crmGetPipelineSnapshotBatchTool,
    crmComparePipelineSnapshotsTool,
    crmSyncPipelineSnapshotHubSpotPropertiesTool,
    createWorkflowTool,
    updateWorkflowTool,
    runWorkflowTool,
    resolveRecordTool,
    previewWorkflowTool,
    startWorkflowTool,
    getWorkflowRunTool,
    previewBuyRequestTool,
    listBuyRequestsTool,
    createBuyRequestTool,
    getBuyRequestTool,
    updateBuyRequestTool,
    cancelBuyRequestTool,
    sourceBuyRequestTool,
    syncBuyRfqTool,
    listBuySourcingRunsTool,
    getBuySourcingRunTool,
    selectBuyOfferTool,
    previewBuyApprovalTool,
    submitBuyRequestTool,
    createBuyPurchaseOrderTool,
    getBuyMerchantPurchaseTool,
    prepareBuyCheckoutTool,
    confirmBuyOrderTool,
    createBuyBillTool,
    previewBuyAccountingTool,
    listWatchtowerFindingsTool,
    updateWatchtowerFindingTool,
    createBuyRequestFromFindingTool,
    getWatchtowerSummaryTool,
    lookoutCreateLpBatchTool,
    lookoutGetRunTool,
    crmListItemsTool,
    crmGetItemTool,
    crmCreateItemTool,
    crmUpdateItemTool,
    crmDeleteItemTool,
    crmListOrdersTool,
    crmGetOrderTool,
    crmDownloadOrderPDFTool,
    crmUploadOrderAttachmentTool,
    crmStartOrderAttachmentUploadTool,
    crmAppendOrderAttachmentUploadChunkTool,
    crmFinishOrderAttachmentUploadTool,
    crmCreateOrderTool,
    crmUpdateOrderTool,
    crmActivateOrderTool,
    crmDeleteOrderTool,
    crmPermanentDeleteOrderTool,
    crmListPurchaseOrdersTool,
    crmGetPurchaseOrderTool,
    crmDownloadPurchaseOrderPDFTool,
    crmUploadPurchaseOrderAttachmentTool,
    crmStartPurchaseOrderAttachmentUploadTool,
    crmAppendPurchaseOrderAttachmentUploadChunkTool,
    crmFinishPurchaseOrderAttachmentUploadTool,
    crmCreatePurchaseOrderTool,
    crmUpdatePurchaseOrderTool,
    crmDeletePurchaseOrderTool,
    crmListProjectsTool,
    crmGetProjectTool,
    crmCreateProjectTool,
    crmUpdateProjectTool,
    crmDeleteProjectTool,
    listFerryDiagramsTool,
    getFerryDiagramTool,
    createFerryDiagramTool,
    updateFerryDiagramTool,
    deleteFerryDiagramTool,
    listFerryProgramsTool,
    getFerryProgramTool,
    listFerryDocsTool,
    createFerryDocTool,
    updateFerryDocTool,
    createFerryTodoTool,
    batchUpsertFerryTodosTool,
    updateFerryTodoTool,
    deleteFerryTodoTool,
    crmListTasksTool,
    crmGetTaskTool,
    crmCreateTaskTool,
    crmUpdateTaskTool,
    crmDeleteTaskTool,
    crmListContractTemplatesTool,
    crmDownloadContractTemplateTool,
    crmUploadContractTemplateTool,
    crmUploadContractPDFTool,
    crmReplaceContractPDFTool,
    crmCreateContractFromTemplateTool,
    crmGetContractWorkflowStateTool,
    crmUpdateContractMetadataTool,
    crmSaveContractSignersTool,
    crmSaveContractRecipientsTool,
    crmSaveContractPlaceFieldsTool,
    crmSendContractRequestTool,
    crmScheduleContractRequestTool,
    crmListEstimatesTool,
    crmGetEstimateTool,
    crmDownloadEstimatePDFTool,
    crmUploadEstimateAttachmentTool,
    crmStartEstimateAttachmentUploadTool,
    crmAppendEstimateAttachmentUploadChunkTool,
    crmFinishEstimateAttachmentUploadTool,
    crmCreateEstimateTool,
    crmUpdateEstimateTool,
    crmDeleteEstimateTool,
    crmListInvoicesTool,
    crmListOverdueInvoicesTool,
    crmListJournalEntriesTool,
    crmCreateJournalStatementViewTool,
    crmListViewsTool,
    crmGetViewTool,
    crmGetViewColumnsTool,
    crmCreateViewTool,
    crmUpdateViewTool,
    crmDeleteViewTool,
    crmListReportsTool,
    crmGetReportTool,
    crmCreateReportTool,
    crmUpdateReportTool,
    crmDeleteReportTool,
    crmGetInvoiceTool,
    crmDownloadInvoicePDFTool,
    crmSendInvoiceEmailTool,
    crmUploadInvoiceAttachmentTool,
    crmStartInvoiceAttachmentUploadTool,
    crmAppendInvoiceAttachmentUploadChunkTool,
    crmFinishInvoiceAttachmentUploadTool,
    crmCreateInvoiceTool,
    crmUpdateInvoiceTool,
    crmActivateInvoiceTool,
    crmDeleteInvoiceTool,
    crmPermanentDeleteInvoiceTool,
    crmListSubscriptionsTool,
    crmGetSubscriptionTool,
    crmCreateSubscriptionTool,
    crmUpdateSubscriptionTool,
    crmDeleteSubscriptionTool,
    crmListPaymentsTool,
    crmGetPaymentTool,
    crmListPaymentAllocationsTool,
    crmUpdatePaymentAllocationsTool,
    crmCreatePaymentTool,
    crmUpdatePaymentTool,
    crmDeletePaymentTool,
    crmDownloadPaymentPDFTool,
    crmListSlipsTool,
    crmGetSlipTool,
    crmCreateSlipTool,
    crmUpdateSlipTool,
    crmDeleteSlipTool,
    crmDownloadSlipPDFTool,
    crmListBillsTool,
    crmGetBillTool,
    crmUploadBillAttachmentTool,
    crmStartBillAttachmentUploadTool,
    crmAppendBillAttachmentUploadChunkTool,
    crmFinishBillAttachmentUploadTool,
    crmCreateBillTool,
    crmUpdateBillTool,
    crmDeleteBillTool,
    crmListDisbursementsTool,
    crmGetDisbursementTool,
    crmCreateDisbursementTool,
    crmUpdateDisbursementTool,
    crmDeleteDisbursementTool,
    crmListDisbursementAllocationsTool,
    crmCreateDisbursementAllocationTool,
    crmUpdateDisbursementAllocationTool,
    crmDeleteDisbursementAllocationTool,
    crmListTicketsTool,
    crmGetTicketTool,
    crmCreateTicketTool,
    crmUpdateTicketTool,
    crmDeleteTicketTool,
    crmListTicketPipelinesTool,
    crmUpdateTicketStatusTool,
    crmListLocationsTool,
    crmGetLocationTool,
    crmCreateLocationTool,
    crmUpdateLocationTool,
    crmDeleteLocationTool,
    crmListInventoriesTool,
    crmGetInventoryTool,
    crmCreateInventoryTool,
    crmUpdateInventoryTool,
    crmDeleteInventoryTool,
    crmListInventoryTransactionsTool,
    crmGetInventoryTransactionTool,
    crmCreateInventoryTransactionTool,
    crmUpdateInventoryTransactionTool,
    crmDeleteInventoryTransactionTool,
    crmListExpensesTool,
    crmGetExpenseTool,
    crmUploadExpenseAttachmentTool,
    crmStartExpenseAttachmentUploadTool,
    crmAppendExpenseAttachmentUploadChunkTool,
    crmFinishExpenseAttachmentUploadTool,
    crmCreateExpenseTool,
    crmUpdateExpenseTool,
    crmDeleteExpenseTool,
    crmListEmployeesTool,
    crmListAbsencesTool,
    crmGetAbsenceTool,
    crmCreateAbsenceTool,
    crmUpdateAbsenceTool,
    crmDeleteAbsenceTool,
    crmListAttendanceRecordsTool,
    crmGetAttendanceRecordTool,
    crmCreateAttendanceRecordTool,
    crmUpdateAttendanceRecordTool,
    crmDeleteAttendanceRecordTool,
    crmListPayrollProfilesTool,
    crmUpsertPayrollProfileTool,
    crmListPayrollRunsTool,
    crmGetPayrollRunTool,
    crmDownloadPayrollPayslipPDFTool,
    crmCalculatePayrollRunTool,
    crmCreatePayrollJournalEntryTool,
    crmApprovePayrollRunTool,
    crmListIncentivesTool,
    crmListIncentivePlansTool,
    crmListIncentiveCompanyOptionsTool,
    crmCreateIncentivePlanTool,
    crmCalculateIncentivesTool,
    crmApproveIncentivesTool,
    crmGenerateIncentivePaymentNoticeTool,
    crmListObjectSchemasTool,
    crmMutateObjectSchemaTool,
    crmListPermissionSetsTool,
    crmGetPermissionSetEditorTool,
    crmCreatePermissionSetTool,
    crmUpdatePermissionSetTool,
    crmCreateApprovalRequestTool,
    crmListRecordApprovalsTool,
    crmApproveRecordApprovalTool,
    crmRejectRecordApprovalTool,
    crmListApprovalRulesTool,
    crmGetApprovalRuleOptionsTool,
    crmUpsertApprovalRuleTool,
    crmDeleteApprovalRuleTool,
    crmListLockRulesTool,
    crmGetLockRuleOptionsTool,
    crmUpsertLockRuleTool,
    crmDeleteLockRuleTool,
    crmListDeliveryRulesTool,
    crmGetDeliveryRuleOptionsTool,
    crmUpsertDeliveryRuleTool,
    crmDeleteDeliveryRuleTool,
    crmListPropertiesTool,
    crmGetPropertyTool,
    crmCreatePropertyTool,
    crmUpdatePropertyTool,
    crmDeletePropertyTool,
    crmGetCalendarBootstrapTool,
    crmCheckCalendarAvailabilityTool,
    crmCreateCalendarAttendanceTool,
    crmCancelCalendarAttendanceTool,
    crmRescheduleCalendarAttendanceTool,
    crmProspectCompaniesTool,
    crmScoreRecordTool,
    uploadImportFileTool,
    importRecordsTool,
    getImportJobTool,
    listImportJobsTool,
    cancelImportJobTool,
    retryImportJobTool,
    listIntegrationChannelsTool,
    exportRecordsTool,
    getExportJobTool,
    listExportJobsTool,
    cancelExportJobTool,
    retryExportJobTool,
    demoGenerateTool,
    integrationSyncPushTool,
    browserUseTool,
  );
  return includedTools;
}

/**
 * Validates the arguments against the tool's input schema, then runs the
 * tool's handler with the given client and arguments. Invalid arguments never
 * reach the handler; they produce a non-retryable MCP error result instead.
 */
export async function executeHandler({
  mcpTool,
  reqContext,
  args,
}: {
  mcpTool: McpTool;
  reqContext: McpRequestContext;
  args: Record<string, unknown> | undefined;
}): Promise<ToolCallResult> {
  const invalidArgumentsResult = validateToolArguments({ mcpTool, args });
  if (invalidArgumentsResult) {
    return invalidArgumentsResult;
  }
  return await mcpTool.handler({ reqContext, args: args || {} });
}
