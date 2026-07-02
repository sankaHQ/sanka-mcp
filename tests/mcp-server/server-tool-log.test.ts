import { configureLogger } from '../../packages/mcp-server/src/logger';
import { initMcpServer, recordMcpToolCall } from '../../packages/mcp-server/src/server';
import { McpRequestContext, McpTool } from '../../packages/mcp-server/src/types';

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
          mcp_server_name: 'sakura',
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

  it('records successful tool call summaries and related record IDs', async () => {
    const post = jest.fn().mockResolvedValue({});
    const logger = { warn: jest.fn() };
    const tool = {
      metadata: {
        resource: 'payments',
        operation: 'write',
        tags: ['payments'],
      },
      tool: {
        name: 'update_payment_allocations',
        title: 'Update payment allocations',
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
        content: [
          {
            type: 'text',
            text: 'Payment reconciliation applied successfully (消し込み済み); allocation_applied=true.',
          },
        ],
        structuredContent: {
          payment: { id: 'payment-1', id_rcp: 17 },
          allocations: [
            {
              id: 'allocation-1',
              payment_id: 'payment-1',
              invoice_id: 'invoice-1',
              invoice: { id: 'invoice-1', id_inv: 31 },
            },
          ],
        },
      },
      startedAt: Date.now(),
    });

    expect(post).toHaveBeenCalledWith('/api/v2/mcp/tool-call-log', {
      body: expect.objectContaining({
        tool_name: 'update_payment_allocations',
        success: true,
        result_summary:
          'Payment reconciliation applied successfully (消し込み済み); allocation_applied=true.',
        record_ids: {
          payment_id: 'payment-1',
          allocation_ids: ['allocation-1'],
          payment_ids: ['payment-1'],
          invoice_ids: ['invoice-1'],
        },
      }),
      headers: {
        'X-Sanka-MCP-Session-ID': 'codex-session-123',
      },
    });
  });

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
        result_summary: 'Permission denied.',
        error: 'Permission denied.',
      }),
      headers: {
        'X-Sanka-MCP-Session-ID': 'codex-session-123',
      },
    });
  });
});

describe('MCP tool call log dispatch', () => {
  beforeAll(() => {
    configureLogger({ level: 'error', pretty: false });
  });

  it('returns tool results without waiting for the tool-call log POST', async () => {
    // Keyed by the JSON-RPC method literal of each registered request schema so
    // the test does not need to resolve the MCP SDK package from the root tree.
    const handlersByMethod = new Map<string, (request: unknown) => Promise<unknown>>();
    const fakeServer = {
      setRequestHandler: (schema: unknown, handler: (request: unknown) => Promise<unknown>) => {
        const method = (schema as { shape?: { method?: { value?: unknown } } }).shape?.method?.value;
        if (typeof method === 'string') {
          handlersByMethod.set(method, handler);
        }
      },
      sendLoggingMessage: jest.fn().mockResolvedValue(undefined),
    };

    const jsonResponse = (body: unknown): Response =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    let logPostStarted = false;
    let resolveLogPost: (response: Response) => void = () => {};
    const fetchImpl = jest.fn((input: unknown): Promise<Response> => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('/api/v2/mcp/tool-call-log')) {
        logPostStarted = true;
        return new Promise<Response>((resolve) => {
          resolveLogPost = resolve;
        });
      }
      return Promise.resolve(
        jsonResponse({
          success: true,
          data: {
            auth_mode: 'oauth_bearer',
            principal_key: 'user:user-1',
            user: { id: 'user-1' },
            current_workspace: { id: 'workspace-1', code: '10101010', name: 'Workspace One' },
          },
          meta: { ctx_id: 'ctx-session' },
        }),
      );
    });

    await initMcpServer({
      server: fakeServer as never,
      clientOptions: { apiKey: 'soat_log_dispatch', fetch: fetchImpl as never },
      mcpSessionId: 'session-log-dispatch',
      toolProfile: 'hosted',
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
    });

    const callTool = handlersByMethod.get('tools/call');
    expect(callTool).toBeDefined();

    // The tool result must resolve while the log POST is still unresolved; if
    // the handler awaited the log POST, this await would hang until timeout.
    const result = (await callTool!({
      params: { name: 'current_workspace', arguments: {} },
    })) as { isError?: boolean };
    expect(result.isError).toBeFalsy();

    // The log call itself must still happen: give the fire-and-forget chain a
    // few event-loop turns to reach fetch, then release the pending POST.
    for (let turn = 0; turn < 50 && !logPostStarted; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(logPostStarted).toBe(true);
    resolveLogPost(jsonResponse({}));
  });
});
