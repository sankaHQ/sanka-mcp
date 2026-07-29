import { selectTools } from '../../packages/mcp-server/src/server';
import {
  createSandboxTool,
  deleteSandboxTool,
  getSandboxContextTool,
  getSandboxDiffTool,
  listSandboxesTool,
  refreshSandboxTool,
  syncSandboxDataTool,
} from '../../packages/mcp-server/src/sandbox-tools';

const oauthContext = () => ({
  authMode: 'oauth_bearer' as const,
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: ['mcp:access'],
  },
});

describe('sandbox MCP tools', () => {
  it('registers the sandbox family in the hosted toolset', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    for (const name of [
      'list_sandboxes',
      'get_sandbox_context',
      'create_sandbox',
      'sync_sandbox_data',
      'get_sandbox_diff',
      'refresh_sandbox',
      'delete_sandbox',
    ]) {
      expect(toolNames).toContain(name);
    }
  });

  it('advertises the non-public V2 sandbox endpoints', () => {
    expect(listSandboxesTool.metadata.httpPath).toBe('/api/v2/sandboxes');
    expect(getSandboxContextTool.metadata.httpPath).toBe('/api/v2/sandboxes/context');
    expect(createSandboxTool.metadata.httpPath).toBe('/api/v2/sandboxes');
    expect(syncSandboxDataTool.metadata.httpPath).toBe('/api/v2/sandboxes/{sandbox_id}/data-sync');
    expect(getSandboxDiffTool.metadata.httpPath).toBe('/api/v2/sandboxes/{sandbox_id}/diff');
    expect(refreshSandboxTool.metadata.httpPath).toBe('/api/v2/sandboxes/{sandbox_id}/refresh');
    expect(deleteSandboxTool.metadata.httpPath).toBe('/api/v2/sandboxes/{sandbox_id}');
    expect(refreshSandboxTool.tool.annotations?.destructiveHint).toBe(true);
    expect(deleteSandboxTool.tool.annotations?.destructiveHint).toBe(true);
    expect(listSandboxesTool.tool.annotations?.readOnlyHint).toBe(true);
  });

  it('lists sandboxes through the raw V2 path and unwraps the envelope', async () => {
    const get = jest.fn().mockResolvedValue({
      data: { sandboxes: [{ id: 'sb-1', status: 'active' }] },
      meta: { ctx_id: 'ctx_test' },
    });

    const result = await listSandboxesTool.handler({
      reqContext: { client: { get } as any, auth: oauthContext() },
      args: {},
    });

    expect(get).toHaveBeenCalledWith('/api/v2/sandboxes');
    expect(result.structuredContent?.['data']).toEqual({
      sandboxes: [{ id: 'sb-1', status: 'active' }],
    });
    expect(result.structuredContent?.['ctx_id']).toBe('ctx_test');
  });

  it('previews refresh without confirm and never calls the API', async () => {
    const post = jest.fn();

    const result = await refreshSandboxTool.handler({
      reqContext: { client: { post } as any, auth: oauthContext() },
      args: { sandbox_id: 'sb-1' },
    });

    expect(post).not.toHaveBeenCalled();
    expect(result.structuredContent?.['data']).toEqual({
      confirmed: false,
      action: 'refresh_sandbox',
    });
  });

  it('refreshes with confirm=true through the raw V2 path', async () => {
    const post = jest.fn().mockResolvedValue({
      data: { id: 'sb-1', status: 'refreshing' },
    });

    const result = await refreshSandboxTool.handler({
      reqContext: { client: { post } as any, auth: oauthContext() },
      args: { sandbox_id: 'sb-1', confirm: true },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/sandboxes/sb-1/refresh', { body: {} });
    expect((result.structuredContent?.['data'] as any).status).toBe('refreshing');
  });

  it('previews delete without confirm and deletes with confirm=true', async () => {
    const del = jest.fn().mockResolvedValue({
      data: { id: 'sb-1', status: 'deleting' },
    });
    const reqContext = { client: { delete: del } as any, auth: oauthContext() };

    const preview = await deleteSandboxTool.handler({ reqContext, args: { sandbox_id: 'sb-1' } });
    expect(del).not.toHaveBeenCalled();
    expect(preview.structuredContent?.['data']).toEqual({
      confirmed: false,
      action: 'delete_sandbox',
    });

    const confirmed = await deleteSandboxTool.handler({
      reqContext,
      args: { sandbox_id: 'sb-1', confirm: true },
    });
    expect(del).toHaveBeenCalledWith('/api/v2/sandboxes/sb-1');
    expect((confirmed.structuredContent?.['data'] as any).status).toBe('deleting');
  });

  it('requires at least one object family for data sync', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'sb-1', status: 'active' } });

    const missing = await syncSandboxDataTool.handler({
      reqContext: { client: { post } as any, auth: oauthContext() },
      args: { sandbox_id: 'sb-1', objects: [] },
    });
    expect(post).not.toHaveBeenCalled();
    expect(missing.isError).toBe(true);

    await syncSandboxDataTool.handler({
      reqContext: { client: { post } as any, auth: oauthContext() },
      args: { sandbox_id: 'sb-1', objects: ['contacts', 'orders'] },
    });
    expect(post).toHaveBeenCalledWith('/api/v2/sandboxes/sb-1/data-sync', {
      body: { objects: ['contacts', 'orders'] },
    });
  });

  it('rejects unauthenticated calls before touching the client', async () => {
    const get = jest.fn();

    const result = await listSandboxesTool.handler({
      reqContext: { client: { get } as any, auth: { authMode: 'none' } as any },
      args: {},
    });

    expect(get).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });
});
