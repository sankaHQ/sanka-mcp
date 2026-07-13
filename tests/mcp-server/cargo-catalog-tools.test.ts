import {
  getCargoCatalogTool,
  importCargoCatalogTool,
} from '../../packages/mcp-server/src/cargo-catalog-tools';
import { selectTools } from '../../packages/mcp-server/src/server';

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

describe('Cargo catalog MCP tools', () => {
  it('registers read and import tools in the hosted profile', () => {
    const names = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);
    expect(names).toEqual(expect.arrayContaining(['get_cargo_catalog', 'import_cargo_catalog']));
  });

  it('reads the global manage view with an optional query', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: { summary: { verticals: 100, suppliers: 2169 } },
      meta: { ctx_id: 'ctx-cargo-read' },
    });

    const result = await getCargoCatalogTool.handler({
      reqContext: { client: { get } as any, auth: oauthContext() },
      args: { query: 'labels' },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/manage/cargo', {
      query: { q: 'labels' },
    });
    expect(result.structuredContent).toMatchObject({
      summary: { verticals: 100, suppliers: 2169 },
      ctx_id: 'ctx-cargo-read',
    });
  });

  it('imports an idempotent bundle without exposing publication', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'batch-1',
        idempotency_key: 'cargo-import-1',
        artifact_hash: 'abcdef1234567890',
        counts: { verticals: 1 },
      },
    });
    const bundle = {
      idempotency_key: 'cargo-import-1',
      artifact_hash: 'abcdef1234567890',
      verticals: [{ external_id: 'labels', name_ja: 'ラベル' }],
    };

    const result = await importCargoCatalogTool.handler({
      reqContext: { client: { post } as any, auth: oauthContext() },
      args: { bundle },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/manage/cargo/imports', {
      body: bundle,
    });
    expect(result.structuredContent).toMatchObject({
      id: 'batch-1',
      counts: { verticals: 1 },
    });
    expect(JSON.stringify(importCargoCatalogTool.tool)).not.toContain('publish_cargo');
  });
});
