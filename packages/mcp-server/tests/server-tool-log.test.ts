import { recordMcpToolCall } from '../src/server';
import { McpRequestContext, McpTool } from '../src/types';

describe('MCP tool call logging', () => {
  it.each([
    ['list_expenses', 'List expenses', 'expenses', 'read'],
    ['list_companies', 'List companies', 'companies', 'read'],
    ['create_invoice', 'Create invoice', 'invoices', 'write'],
    ['send_invoice_email', 'Send invoice email', 'invoices', 'write'],
    ['switch_workspace', 'Switch workspace', 'workspace', 'write'],
  ])(
    'records authenticated MCP tool calls for %s with the session header',
    async (toolName, toolTitle, resource, operation) => {
      const post = jest.fn().mockResolvedValue({});
      const logger = { warn: jest.fn() };
      const tool = {
        metadata: {
          resource,
          operation,
          tags: [resource],
        },
        tool: {
          name: toolName,
          title: toolTitle,
          inputSchema: { type: 'object', properties: {} },
        },
        handler: jest.fn(),
      } as unknown as McpTool;
      const reqContext = {
        client: { post },
        mcpSessionId: 'codex-session-123',
        mcpClientInfo: { name: 'Codex', version: '0.1.0' },
        mcpProtocolVersion: '2025-03-26',
        mcpRequestEnvironment: {
          ipAddress: '203.0.113.10',
          userAgent: 'Codex/0.1.0',
          os: 'macOS',
          deviceType: 'desktop',
          modelProvider: 'openai',
          modelName: 'gpt-5.5',
        },
        auth: {
          authMode: 'oauth_bearer',
          clientOptions: {},
          oauth: {
            authorizationServerUrl: 'https://app.example.com',
            resourceMetadataUrl: 'https://app.example.com/.well-known/oauth-protected-resource',
            resourceUrl: 'https://app.example.com/mcp',
            scopes: ['api-access'],
          },
        },
      } as unknown as McpRequestContext;

      await recordMcpToolCall({
        client: reqContext.client,
        logger,
        mcpTool: tool,
        reqContext,
        result: {
          content: [{ type: 'text', text: 'Found 2288 expenses.' }],
        },
        startedAt: Date.now(),
      });

      expect(post).toHaveBeenCalledWith('/api/v2/mcp/tool-call-log', {
        body: expect.objectContaining({
          tool_name: toolName,
          tool_title: toolTitle,
          resource,
          operation,
          success: true,
          client_name: 'Codex',
          client_version: '0.1.0',
          source_ip_address: '203.0.113.10',
          source_user_agent: 'Codex/0.1.0',
          source_os: 'macOS',
          source_device_type: 'desktop',
          mcp_protocol_version: '2025-03-26',
          mcp_server_name: 'sanka_api',
          mcp_server_version: '0.0.1',
          model_provider: 'openai',
          model_name: 'gpt-5.5',
        }),
        headers: {
          'X-Sanka-MCP-Session-ID': 'codex-session-123',
        },
      });
    },
  );

  it('skips logging when the MCP session is missing', async () => {
    const post = jest.fn().mockResolvedValue({});
    const logger = { warn: jest.fn() };
    const tool = {
      metadata: {
        resource: 'expenses',
        operation: 'read',
        tags: ['expenses'],
      },
      tool: {
        name: 'list_expenses',
        title: 'List expenses',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: jest.fn(),
    } as unknown as McpTool;

    await recordMcpToolCall({
      client: { post } as unknown as McpRequestContext['client'],
      logger,
      mcpTool: tool,
      reqContext: {
        client: { post },
        auth: {
          authMode: 'oauth_bearer',
          clientOptions: {},
          oauth: {
            authorizationServerUrl: 'https://app.example.com',
            resourceMetadataUrl: 'https://app.example.com/.well-known/oauth-protected-resource',
            resourceUrl: 'https://app.example.com/mcp',
            scopes: ['api-access'],
          },
        },
      } as unknown as McpRequestContext,
      result: {
        content: [{ type: 'text', text: 'Found 2288 expenses.' }],
      },
      startedAt: Date.now(),
    });

    expect(post).not.toHaveBeenCalled();
  });

  it('records failed tool calls with an error summary', async () => {
    const post = jest.fn().mockResolvedValue({});
    const logger = { warn: jest.fn() };
    const tool = {
      metadata: {
        resource: 'companies',
        operation: 'read',
        tags: ['companies'],
      },
      tool: {
        name: 'list_companies',
        title: 'List companies',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: jest.fn(),
    } as unknown as McpTool;

    await recordMcpToolCall({
      client: { post } as unknown as McpRequestContext['client'],
      logger,
      mcpTool: tool,
      reqContext: {
        client: { post },
        mcpSessionId: 'codex-session-123',
        auth: {
          authMode: 'oauth_bearer',
          clientOptions: {},
          oauth: {
            authorizationServerUrl: 'https://app.example.com',
            resourceMetadataUrl: 'https://app.example.com/.well-known/oauth-protected-resource',
            resourceUrl: 'https://app.example.com/mcp',
            scopes: ['api-access'],
          },
        },
      } as unknown as McpRequestContext,
      result: {
        content: [{ type: 'text', text: 'Permission denied.' }],
        isError: true,
      },
      startedAt: Date.now(),
    });

    expect(post).toHaveBeenCalledWith('/api/v2/mcp/tool-call-log', {
      body: expect.objectContaining({
        tool_name: 'list_companies',
        success: false,
        error: 'Permission denied.',
      }),
      headers: {
        'X-Sanka-MCP-Session-ID': 'codex-session-123',
      },
    });
  });
});
