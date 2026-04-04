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
import { crmAuthStatusTool, crmListCompaniesTool, crmListContactsTool } from './crm-tools';
import docsSearchTool from './docs-search-tool';
import { setLocalSearch } from './docs-search-tool';
import { LocalDocsSearch } from './local-docs-search';
import { getInstructions } from './instructions';
import { McpOptions } from './options';
import { blockedMethodsForCodeTool } from './methods';
import { ToolProfile } from './profile';
import { HandlerFunction, McpRequestContext, ToolCallResult, McpTool } from './types';

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
  const providedTools = selectTools(params.mcpOptions, toolProfile);
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
        client,
        mcpSessionId: params.mcpSessionId,
        mcpClientInfo: params.mcpClientInfo,
        toolProfile,
        auth: params.auth,
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
export function selectTools(options?: McpOptions, profile: ToolProfile = 'full'): McpTool[] {
  const includedTools = [];

  if ((options?.includeCodeTool ?? true) && profile === 'full') {
    includedTools.push(
      codeTool({
        blockedMethods: blockedMethodsForCodeTool(options),
      }),
    );
  }
  if ((options?.includeDocsTools ?? true) && profile === 'full') {
    includedTools.push(docsSearchTool);
  }
  if (profile === 'crm') {
    includedTools.push(crmAuthStatusTool, crmListCompaniesTool, crmListContactsTool);
  }
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
