import Sanka from 'sanka-sdk';
import { configureLogger } from '../../packages/mcp-server/src/logger';
import { clientForTool, initMcpServer } from '../../packages/mcp-server/src/server';

// Incident 2026-09-23: one reply_workspace_message_thread call reached the API three
// times. Gmail accepted each send, the API answered 500 after recording failed, and
// the SDK client's default retries (2) repeated the POST, so three emails went out.

type ToolResult = { isError?: boolean; structuredContent?: Record<string, unknown> };

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Retry immediately when the SDK decides to retry, keeping the test fast.
      'retry-after-ms': '0',
    },
  });

const serverError = () =>
  jsonResponse(500, {
    success: false,
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
    meta: { ctx_id: 'ctx-reply-failed' },
  });

const startServer = async (respond: (url: string) => Response) => {
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
  const requests: string[] = [];
  const fetchImpl = jest.fn(async (input: unknown): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/api/v2/mcp/tool-call-log')) {
      return jsonResponse(200, { success: true });
    }
    requests.push(url);
    return respond(url);
  });

  await initMcpServer({
    server: fakeServer as never,
    clientOptions: { apiKey: 'soat_retry_policy', fetch: fetchImpl as never },
    mcpSessionId: 'session-retry-policy',
    toolProfile: 'hosted',
    auth: {
      authMode: 'oauth_bearer',
      clientOptions: {},
      oauth: {
        authorizationServerUrl: 'https://app.example.com',
        resourceMetadataUrl: 'https://app.example.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://app.example.com/mcp',
        scopes: [
          'api-access',
          'workspace_messages:read',
          'workspace_messages:write',
          'account_messages:read',
          'account_messages:write',
        ],
      },
    },
  });

  const callTool = handlersByMethod.get('tools/call');
  expect(callTool).toBeDefined();
  return {
    requests,
    call: async (name: string, args: Record<string, unknown>) =>
      (await callTool!({ params: { name, arguments: args } })) as ToolResult,
  };
};

describe('MCP tool SDK retry policy', () => {
  beforeAll(() => {
    configureLogger({ level: 'error', pretty: false });
  });

  it.each([
    ['reply_workspace_message_thread', '/api/v2/workspace/messages/threads/thread-1/reply'],
    ['reply_private_message_thread', '/api/v2/me/messages/threads/thread-1/reply'],
  ])('%s makes exactly one request when the API answers 500', async (toolName, path) => {
    const server = await startServer(() => serverError());

    const result = await server.call(toolName, {
      thread_id: 'thread-1',
      body: 'Thanks, confirmed.',
      confirm_send: true,
    });

    expect(result.isError).toBe(true);
    expect(server.requests.filter((url) => url.includes(path))).toHaveLength(1);
  });

  it('keeps automatic retries for read tools', async () => {
    let attempts = 0;
    const server = await startServer(() => {
      attempts += 1;
      if (attempts === 1) {
        return serverError();
      }
      return jsonResponse(200, {
        success: true,
        data: { id: 'thread-1', title: 'Question', messages: [] },
        meta: { ctx_id: 'ctx-thread' },
      });
    });

    const result = await server.call('get_workspace_message_thread', { thread_id: 'thread-1' });

    expect(result.isError).toBeFalsy();
    expect(server.requests).toHaveLength(2);
  });
});

describe('clientForTool', () => {
  const client = new Sanka({ apiKey: 'soat_client_for_tool' });

  it('keeps the shared client for read tools', () => {
    expect(clientForTool(client, { metadata: { resource: 'x', operation: 'read', tags: [] } })).toBe(client);
  });

  it('disables automatic retries for write tools', () => {
    const writeClient = clientForTool(client, { metadata: { resource: 'x', operation: 'write', tags: [] } });

    expect(writeClient).not.toBe(client);
    expect(writeClient.maxRetries).toBe(0);
    expect(client.maxRetries).toBe(2);
  });
});
