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
import { codeTool } from './code-tool';
import {
  crmArchiveCustomObjectRecordTool,
  crmArchivePrivateMessageThreadTool,
  crmAggregateRecordsTool,
  crmApplyCompanyPriceTableItemsTool,
  crmApprovePayrollRunTool,
  crmApproveIncentivesTool,
  crmCancelCalendarAttendanceTool,
  crmCalculateIncentivesTool,
  crmCheckCalendarAvailabilityTool,
  crmCreateCalendarAttendanceTool,
  crmCreateAssociationTool,
  crmCreateCompanyTool,
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
  crmListObjectSchemasTool,
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
  crmRescheduleCalendarAttendanceTool,
  crmScoreRecordTool,
  crmSendInvoiceEmailTool,
  crmSyncPrivateMessagesTool,
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
  uploadImportFileTool,
} from './transfer-tools';
import {
  getWorkflowRunTool,
  previewWorkflowTool,
  resolveRecordTool,
  startWorkflowTool,
} from './workflow-run-tools';
import { HandlerFunction, McpRequestContext, ToolCallResult, McpTool } from './types';
import { requireScopes } from './tool-auth';
import { applyRequiredScopesToSecuritySchemes, getToolRequiredScopes } from './tool-scope-requirements';
import { buildToolErrorResult, normalizeToolCallResult } from './tool-result-normalizer';
import { enrichRecordUrlsForToolResult } from './record-url-enrichment';

export const newMcpServer = async ({
  customInstructionsPath,
  toolProfile,
}: {
  customInstructionsPath?: string | undefined;
  toolProfile?: ToolProfile | undefined;
}) =>
  new McpServer(
    {
      name: 'sanka_api',
      version: '0.0.1',
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

const summarizeToolError = (result: ToolCallResult): string | undefined => {
  if (!result.isError) {
    return undefined;
  }
  const text = result.content
    .map((entry) => (entry.type === 'text' ? entry.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
  return text ? text.slice(0, 500) : 'tool_error';
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

  const error = summarizeToolError(result);
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
    listIntegrationChannelsTool,
    exportRecordsTool,
    getExportJobTool,
    listExportJobsTool,
    cancelExportJobTool,
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
