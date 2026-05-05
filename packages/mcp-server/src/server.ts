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
import { codeTool } from './code-tool';
import {
  crmArchivePrivateMessageThreadTool,
  crmAggregateRecordsTool,
  crmApplyCompanyPriceTableItemsTool,
  crmCancelCalendarAttendanceTool,
  crmCheckCalendarAvailabilityTool,
  crmCreateCalendarAttendanceTool,
  crmCreateCompanyTool,
  crmCreateContactTool,
  crmCreateDealTool,
  crmCreateEstimateTool,
  crmCreateExpenseTool,
  crmCreateInvoiceTool,
  crmCreateInventoryTool,
  crmCreateInventoryTransactionTool,
  crmCreateItemTool,
  crmCreateLocationTool,
  crmCreateOrderTool,
  crmCreatePaymentTool,
  crmCreatePurchaseOrderTool,
  crmCreateBillTool,
  crmCreateDisbursementTool,
  crmCreateSlipTool,
  crmCreatePropertyTool,
  crmCreateSubscriptionTool,
  crmCreateTaskTool,
  crmCreateTicketTool,
  crmDeleteCompanyTool,
  crmDeleteContactTool,
  crmDeleteDealTool,
  crmDeleteEstimateTool,
  crmDeleteExpenseTool,
  crmDeleteInventoryTool,
  crmDeleteInventoryTransactionTool,
  crmDeleteInvoiceTool,
  crmDeleteItemTool,
  crmDeleteLocationTool,
  crmDeleteOrderTool,
  crmDeletePaymentTool,
  crmDeletePurchaseOrderTool,
  crmDeleteBillTool,
  crmDeleteDisbursementTool,
  crmDeleteSlipTool,
  crmDeletePropertyTool,
  crmDeleteSubscriptionTool,
  crmDeleteTaskTool,
  crmDeleteTicketTool,
  crmAuthStatusTool,
  crmConnectSankaTool,
  crmGetCalendarBootstrapTool,
  crmGetCompanyTool,
  crmGetCompanyPriceTableTool,
  crmGetContactTool,
  crmGetDealTool,
  crmDownloadEstimatePDFTool,
  crmDownloadInvoicePDFTool,
  crmDownloadOrderPDFTool,
  crmDownloadPaymentPDFTool,
  crmDownloadSlipPDFTool,
  crmGetEstimateTool,
  crmGetExpenseTool,
  crmGetInventoryTool,
  crmGetInventoryTransactionTool,
  crmGetInvoiceTool,
  crmGetItemTool,
  crmGetLocationTool,
  crmGetOrderTool,
  crmGetPaymentTool,
  crmGetPurchaseOrderTool,
  crmGetBillTool,
  crmGetDisbursementTool,
  crmGetSlipTool,
  crmGetPrivateMessageThreadTool,
  crmGetPropertyTool,
  crmGetSubscriptionTool,
  crmGetTaskTool,
  crmGetTicketTool,
  crmListCompaniesTool,
  crmListContactsTool,
  crmListDealPipelinesTool,
  crmListDealsTool,
  crmListEstimatesTool,
  crmListExpensesTool,
  crmListInventoriesTool,
  crmListInvoicesTool,
  crmListOverdueInvoicesTool,
  crmListInventoryTransactionsTool,
  crmListItemsTool,
  crmListLocationsTool,
  crmListOrdersTool,
  crmListPaymentsTool,
  crmListPurchaseOrdersTool,
  crmListBillsTool,
  crmListDisbursementsTool,
  crmListSlipsTool,
  crmListPrivateMessagesTool,
  crmListPropertiesTool,
  crmListSubscriptionsTool,
  crmListTasksTool,
  crmListTicketPipelinesTool,
  crmListTicketsTool,
  crmProspectCompaniesTool,
  crmQueryRecordsTool,
  crmReplyPrivateMessageThreadTool,
  crmRescheduleCalendarAttendanceTool,
  crmScoreRecordTool,
  crmSyncPrivateMessagesTool,
  crmUpdateCompanyTool,
  crmUpdateCompanyPriceTableCompanyTool,
  crmUpdateCompanyPriceTableItemTool,
  crmUpdateContactTool,
  crmUpdateDealTool,
  crmUpdateEstimateTool,
  crmUpdateExpenseTool,
  crmUpdateInventoryTool,
  crmUpdateInventoryTransactionTool,
  crmUpdateInvoiceTool,
  crmUpdateItemTool,
  crmUpdateLocationTool,
  crmUpdateOrderTool,
  crmUpdatePaymentTool,
  crmUpdatePurchaseOrderTool,
  crmUpdateBillTool,
  crmUpdateDisbursementTool,
  crmUpdateSlipTool,
  crmUpdatePropertyTool,
  crmUpdateSubscriptionTool,
  crmUpdateTaskTool,
  crmUpdateTicketStatusTool,
  crmUpdateTicketTool,
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
    };

    const scopeError = requireScopes({
      reqContext,
      requiredScopes: getToolRequiredScopes({ tool: mcpTool, args }),
      toolTitle: mcpTool.tool.title ?? mcpTool.tool.name,
    });
    if (scopeError) {
      return scopeError;
    }

    let client: Sanka;
    try {
      client = getClient();
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to initialize client: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }

    return executeHandler({
      handler: mcpTool.handler,
      reqContext: {
        ...reqContext,
        client,
      },
      args,
    });
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
    crmListPrivateMessagesTool,
    crmSyncPrivateMessagesTool,
    crmGetPrivateMessageThreadTool,
    crmReplyPrivateMessageThreadTool,
    crmArchivePrivateMessageThreadTool,
    crmQueryRecordsTool,
    crmAggregateRecordsTool,
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
    crmCreateOrderTool,
    crmUpdateOrderTool,
    crmDeleteOrderTool,
    crmListPurchaseOrdersTool,
    crmGetPurchaseOrderTool,
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
    crmCreateEstimateTool,
    crmUpdateEstimateTool,
    crmDeleteEstimateTool,
    crmListInvoicesTool,
    crmListOverdueInvoicesTool,
    crmGetInvoiceTool,
    crmDownloadInvoicePDFTool,
    crmCreateInvoiceTool,
    crmUpdateInvoiceTool,
    crmDeleteInvoiceTool,
    crmListSubscriptionsTool,
    crmGetSubscriptionTool,
    crmCreateSubscriptionTool,
    crmUpdateSubscriptionTool,
    crmDeleteSubscriptionTool,
    crmListPaymentsTool,
    crmGetPaymentTool,
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
    crmCreateBillTool,
    crmUpdateBillTool,
    crmDeleteBillTool,
    crmListDisbursementsTool,
    crmGetDisbursementTool,
    crmCreateDisbursementTool,
    crmUpdateDisbursementTool,
    crmDeleteDisbursementTool,
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
