import Sanka from 'sanka-sdk';
import { validateToolArguments } from '../../../packages/mcp-server/src/tool-argument-validator';
import type { McpTool } from '../../../packages/mcp-server/src/types';

export const oauthContext = (overrides?: {
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

export const firstTextContent = (result: { content: unknown[] }): string => {
  const entry = result.content
    .map((content) => (typeof content === 'object' && content !== null ? content : undefined))
    .find((content) => (content as Record<string, unknown> | undefined)?.['type'] === 'text') as
    | Record<string, unknown>
    | undefined;
  return typeof entry?.['text'] === 'string' ? entry['text'] : '';
};

export type V2Request = {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export type V2RequestCase = {
  name: string;
  tool: McpTool;
  args: Record<string, unknown>;
  expectedRequests: V2Request[];
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-v2-request' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

// Headers a tool sets on purpose. Transport headers (auth, user agent, retries) are not part of the row.
const isToolHeader = (name: string) =>
  name === 'accept-language' || name === 'x-language' || name.startsWith('x-sanka-');

const sendThroughSDK = async ({ tool, args }: V2RequestCase) => {
  const requests: V2Request[] = [];
  const client = new Sanka({
    apiKey: 'My API Key',
    apiVersion: 'v2',
    baseURL: 'http://localhost:5000/',
    maxRetries: 0,
    fetch: async (url, init) => {
      const headers = Object.fromEntries(
        [...new Headers(init?.headers)].filter(([name]) => isToolHeader(name)),
      );
      requests.push({
        method: String(init?.method ?? 'GET').toUpperCase(),
        url: String(url),
        ...(init?.body ? { body: JSON.parse(String(init.body)) } : undefined),
        ...(Object.keys(headers).length > 0 ? { headers } : undefined),
      });
      return tool.tool.name.startsWith('list_') ?
          envelope({ items: [], page: 1, page_size: 10, total: 0 })
        : envelope({ id: 'record-1', record_id: '1001', object_type: 'record', properties: {} });
    },
  });
  const result = await tool.handler({
    reqContext: { client, auth: oauthContext(), toolProfile: 'full' },
    args,
  });
  return { requests, result };
};

/**
 * One row per tool call. The arguments must pass the tool's input schema, and the tool
 * must send exactly these requests through the real SDK client to a fake `fetch`.
 */
export const describeV2Requests = (cases: V2RequestCase[]) =>
  describe('V2 requests', () => {
    it.each(cases)('$name', async (scenario) => {
      expect(validateToolArguments({ mcpTool: scenario.tool, args: scenario.args })).toBeUndefined();

      const { requests, result } = await sendThroughSDK(scenario);

      expect(result.isError).toBeFalsy();
      expect(requests).toEqual(scenario.expectedRequests);
    });
  });
