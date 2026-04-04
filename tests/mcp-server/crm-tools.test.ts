import {
  crmAuthStatusTool,
  crmListCompaniesTool,
  crmListContactsTool,
} from '../../packages/mcp-server/src/crm-tools';

const oauthContext = (overrides?: {
  authMode?: 'none' | 'api_key' | 'legacy_oauth_jwt' | 'resource_oauth_jwt';
  scopes?: string[];
}) => ({
  authMode: overrides?.authMode ?? 'resource_oauth_jwt',
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource/mcp/crm',
    resourceUrl: 'https://mcp.sanka.com/mcp/crm',
    scopes: overrides?.scopes ?? ['companies:read', 'contacts:read'],
  },
});

describe('ChatGPT CRM tools', () => {
  it('advertises auth schemes on CRM tools', () => {
    expect(crmAuthStatusTool.tool.securitySchemes).toEqual([{ type: 'noauth' }]);
    expect(crmListCompaniesTool.tool.securitySchemes).toEqual([
      { type: 'oauth2', scopes: ['companies:read'] },
    ]);
    expect(crmListContactsTool.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['contacts:read'] }]);
  });

  it('returns a reauth challenge when auth status is checked without authentication', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'crm',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      connected: false,
      auth_mode: 'none',
      tool_profile: 'crm',
      scopes: [],
      message: 'Sanka CRM is not connected yet. Approve the OAuth prompt in your MCP client, then retry.',
      resource_url: 'https://mcp.sanka.com/mcp/crm',
    });
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
  });

  it('reports connected auth status when OAuth scopes are present', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({ scopes: ['companies:read', 'contacts:read'] }),
        toolProfile: 'crm',
      },
      args: {},
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      connected: true,
      auth_mode: 'resource_oauth_jwt',
      tool_profile: 'crm',
      scopes: ['companies:read', 'contacts:read'],
      message: 'Sanka CRM is connected with OAuth and scopes: companies:read, contacts:read.',
      resource_url: 'https://mcp.sanka.com/mcp/crm',
    });
  });

  it('returns reauth metadata when list companies is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListCompaniesTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { list },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'crm',
      },
      args: { search: 'Acme' },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(list).not.toHaveBeenCalled();
  });

  it('returns insufficient_scope metadata when list companies lacks companies:read', async () => {
    const list = jest.fn();

    const result = await crmListCompaniesTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { list },
          },
        } as any,
        auth: oauthContext({ scopes: ['contacts:read'] }),
        toolProfile: 'crm',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="insufficient_scope"'),
    ]);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('scope="companies:read"'),
    ]);
    expect(list).not.toHaveBeenCalled();
  });

  it('lists companies with structured content when the required scope is present', async () => {
    const list = jest.fn().mockResolvedValue({
      count: 2,
      data: [{ id: 'company-1', name: 'Acme' }],
      message: 'ok',
      page: 1,
      total: 2,
      permission: 'edit',
    });

    const result = await crmListCompaniesTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { list },
          },
        } as any,
        auth: oauthContext({ scopes: ['companies:read'] }),
        toolProfile: 'crm',
      },
      args: { limit: 5, page: 2, search: 'Acme', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        limit: 5,
        page: 2,
        search: 'Acme',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 2,
      message: 'ok',
      permission: 'edit',
      results: [{ id: 'company-1', name: 'Acme' }],
    });
  });

  it('lists contacts with the contacts:read scope', async () => {
    const list = jest.fn().mockResolvedValue({
      count: 1,
      data: [{ id: 'contact-1', name: 'Jane Doe' }],
      message: 'ok',
      page: 1,
      total: 1,
      permission: 'view',
    });

    const result = await crmListContactsTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { list },
          },
        } as any,
        auth: oauthContext({ scopes: ['contacts:read'] }),
        toolProfile: 'crm',
      },
      args: { limit: 20 },
    });

    expect(list).toHaveBeenCalledWith(
      {
        limit: 20,
        page: 1,
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'ok',
      permission: 'view',
      results: [{ id: 'contact-1', name: 'Jane Doe' }],
    });
  });
});
