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
import { codeTool } from './code-tool';
import {
  crmArchiveCustomObjectRecordTool,
  crmArchivePrivateMessageThreadTool,
  crmAggregateRecordsTool,
  crmApplyCompanyPriceTableItemsTool,
  crmApproveRecordApprovalTool,
  crmApprovePayrollRunTool,
  crmApproveIncentivesTool,
  crmCancelCalendarAttendanceTool,
  crmCalculateIncentivesTool,
  crmCheckCalendarAvailabilityTool,
  crmCreateCalendarAttendanceTool,
  crmCreateAssociationTool,
  crmCreateCompanyTool,
  crmCreateApprovalRequestTool,
  crmCreateContactTool,
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
  crmCreateItemTool,
  crmCreateJournalStatementViewTool,
  crmCreateLocationTool,
  crmCreateOrderTool,
  crmCreatePaymentTool,
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
  crmGetDealTool,
  crmDownloadEstimatePDFTool,
  crmUploadEstimateAttachmentTool,
  crmDownloadInvoicePDFTool,
  crmUploadInvoiceAttachmentTool,
  crmDownloadOrderPDFTool,
  crmUploadOrderAttachmentTool,
  crmDownloadPaymentPDFTool,
  crmDownloadPayrollPayslipPDFTool,
  crmDownloadPurchaseOrderPDFTool,
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
  crmGetPayrollRunTool,
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
  crmListDealPipelinesTool,
  crmListDealsTool,
  crmListWorkspacesTool,
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
  crmListDisbursementAllocationsTool,
  crmListPaymentAllocationsTool,
  crmListPaymentsTool,
  crmListPayrollProfilesTool,
  crmListPayrollRunsTool,
  crmListPurchaseOrdersTool,
  crmListReportsTool,
  crmListBillsTool,
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
  crmProspectCompaniesTool,
  crmMutateObjectSchemaTool,
  crmQueryRecordsTool,
  crmReadBinaryDownloadChunkTool,
  crmReplyPrivateMessageThreadTool,
  crmRejectRecordApprovalTool,
  crmRescheduleCalendarAttendanceTool,
  crmScoreRecordTool,
  crmSendInvoiceEmailTool,
  crmSyncPrivateMessagesTool,
  crmSyncWorkspaceMessagesTool,
  crmSwitchWorkspaceTool,
  crmUpdateCompanyTool,
  crmUpdateCompanyPriceTableCompanyTool,
  crmUpdateCompanyPriceTableItemTool,
  crmUploadBillAttachmentTool,
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
import { LocalDocsSearch } from './local-docs-search';
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
import { createWorkflowTool, runWorkflowTool, updateWorkflowTool } from './workflow-tools';
import { HandlerFunction, McpRequestContext, ToolCallResult, McpTool } from './types';
import { requireScopes } from './tool-auth';
import { applyRequiredScopesToSecuritySchemes, getToolRequiredScopes } from './tool-scope-requirements';
import { buildToolErrorResult, normalizeToolCallResult } from './tool-result-normalizer';
import { enrichRecordUrlsForToolResult } from './record-url-enrichment';

export const SANKA_MCP_SERVER_NAME = 'sanka_api';
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
      name: SANKA_MCP_SERVER_NAME,
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
        mcp_server_name: SANKA_MCP_SERVER_NAME,
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
 * Initializes the provided MCP Server with the given tools and handlers.
 * If not provided, the default client, tools and handlers will be used.
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
}) {
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
  const localSearch = await LocalDocsSearch.create(docsDir ? { docsDir } : undefined);
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
  const providedTools = selectTools(params.mcpOptions, toolProfile).map(applyRequiredScopesToSecuritySchemes);
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
        await recordMcpToolCall({
          client,
          logger,
          mcpTool,
          reqContext: {
            ...reqContext,
            client,
          },
          result: normalizedScopeError,
          startedAt,
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
          handler: mcpTool.handler,
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
      await recordMcpToolCall({
        client,
        logger,
        mcpTool,
        reqContext: reqContextWithClient,
        result: enrichedResult,
        startedAt,
      });
      return enrichedResult;
    } catch (error) {
      const errorResult = normalizeToolCallResult({
        mcpTool,
        args,
        result: buildToolErrorResult(error),
      });
      await recordMcpToolCall({
        client,
        logger,
        mcpTool,
        reqContext: reqContextWithClient,
        result: errorResult,
        startedAt,
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
}

/**
 * Selects the tools to include in the MCP Server based on the provided options.
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
    crmConnectSankaTool,
    crmAuthStatusTool,
    crmCurrentWorkspaceTool,
    crmListWorkspacesTool,
    crmSwitchWorkspaceTool,
    crmReadBinaryDownloadChunkTool,
    crmListPrivateMessagesTool,
    crmSyncPrivateMessagesTool,
    crmGetPrivateMessageThreadTool,
    crmReplyPrivateMessageThreadTool,
    crmArchivePrivateMessageThreadTool,
    crmListWorkspaceMessagesTool,
    crmSyncWorkspaceMessagesTool,
    crmGetWorkspaceMessageThreadTool,
    crmQueryRecordsTool,
    crmAggregateRecordsTool,
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
    createWorkflowTool,
    updateWorkflowTool,
    runWorkflowTool,
    resolveRecordTool,
    previewWorkflowTool,
    startWorkflowTool,
    getWorkflowRunTool,
    crmListItemsTool,
    crmGetItemTool,
    crmCreateItemTool,
    crmUpdateItemTool,
    crmDeleteItemTool,
    crmListOrdersTool,
    crmGetOrderTool,
    crmDownloadOrderPDFTool,
    crmUploadOrderAttachmentTool,
    crmCreateOrderTool,
    crmUpdateOrderTool,
    crmActivateOrderTool,
    crmDeleteOrderTool,
    crmPermanentDeleteOrderTool,
    crmListPurchaseOrdersTool,
    crmGetPurchaseOrderTool,
    crmDownloadPurchaseOrderPDFTool,
    crmUploadPurchaseOrderAttachmentTool,
    crmCreatePurchaseOrderTool,
    crmUpdatePurchaseOrderTool,
    crmDeletePurchaseOrderTool,
    crmListTasksTool,
    crmGetTaskTool,
    crmCreateTaskTool,
    crmUpdateTaskTool,
    crmDeleteTaskTool,
    crmListEstimatesTool,
    crmGetEstimateTool,
    crmDownloadEstimatePDFTool,
    crmUploadEstimateAttachmentTool,
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
 * Runs the provided handler with the given client and arguments.
 */
export async function executeHandler({
  handler,
  reqContext,
  args,
}: {
  handler: HandlerFunction;
  reqContext: McpRequestContext;
  args: Record<string, unknown> | undefined;
}): Promise<ToolCallResult> {
  return await handler({ reqContext, args: args || {} });
}
