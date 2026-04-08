import { demoGenerateTool, integrationSyncPushTool } from '../../packages/mcp-server/src/demo-tools';

const oauthContext = (overrides?: {
  authMode?: 'none' | 'api_key' | 'legacy_oauth_jwt' | 'resource_oauth_jwt';
  scopes?: string[];
}) => ({
  authMode: overrides?.authMode ?? 'resource_oauth_jwt',
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: overrides?.scopes ?? [],
  },
});

describe('Phase 5 demo + integration-sync MCP tools', () => {
  it('advertises oauth security schemes on both tools', () => {
    expect(demoGenerateTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(integrationSyncPushTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
  });

  it('exposes operation ids that match the Sanka HTTP endpoints', () => {
    expect(demoGenerateTool.metadata.operationId).toBe('demo.generate.create');
    expect(demoGenerateTool.metadata.httpPath).toBe('/v1/demo/generate');
    expect(demoGenerateTool.metadata.httpMethod).toBe('post');

    expect(integrationSyncPushTool.metadata.operationId).toBe('integration_sync.push.create');
    expect(integrationSyncPushTool.metadata.httpPath).toBe('/v1/integration-sync/push');
    expect(integrationSyncPushTool.metadata.httpMethod).toBe('post');
  });

  describe('generate_demo_workspace', () => {
    it('returns a reauth challenge when called without authentication', async () => {
      const generate = jest.fn();

      const result = await demoGenerateTool.handler({
        reqContext: {
          client: {
            demo: { generate },
          } as any,
          auth: oauthContext({ authMode: 'none', scopes: [] }),
          toolProfile: 'full',
        },
        args: { template: 'b2b_saas', country: 'us' },
      });

      expect(result.isError).toBe(true);
      expect(result._meta?.['mcp/www_authenticate']).toEqual([
        expect.stringContaining('error="invalid_token"'),
      ]);
      expect(generate).not.toHaveBeenCalled();
    });

    it('returns an input error when template or country is missing', async () => {
      const generate = jest.fn();

      const result = await demoGenerateTool.handler({
        reqContext: {
          client: {
            demo: { generate },
          } as any,
          auth: oauthContext(),
          toolProfile: 'full',
        },
        args: { template: 'b2b_saas' },
      });

      expect(result.isError).toBe(true);
      expect(generate).not.toHaveBeenCalled();
      expect(result.content[0]).toMatchObject({ type: 'text' });
    });

    it('seeds the workspace and returns structured content on success', async () => {
      const generate = jest.fn().mockResolvedValue({
        workspace_id: 'workspace-1',
        workspace_name: 'Acme Demo',
        workspace_short_id: 42,
        template: 'b2b_saas',
        country: 'us',
        seed: 7,
        created: true,
        counts: {
          companies: 12,
          contacts: 35,
          deals: 9,
          subscriptions: 3,
          invoices: 8,
          receipts: 6,
        },
        sample_record_ids: {
          companies: ['company-1', 'company-2'],
          contacts: ['contact-1'],
        },
        message: 'Created new demo workspace Acme Demo',
      });

      const result = await demoGenerateTool.handler({
        reqContext: {
          client: {
            demo: { generate },
          } as any,
          auth: oauthContext(),
          toolProfile: 'full',
        },
        args: {
          template: 'b2b_saas',
          country: 'us',
          seed: 7,
        },
      });

      expect(generate).toHaveBeenCalledWith({
        template: 'b2b_saas',
        country: 'us',
        seed: 7,
      });
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual({
        workspace_id: 'workspace-1',
        workspace_name: 'Acme Demo',
        workspace_short_id: 42,
        template: 'b2b_saas',
        country: 'us',
        seed: 7,
        created: true,
        counts: {
          companies: 12,
          contacts: 35,
          deals: 9,
          subscriptions: 3,
          invoices: 8,
          receipts: 6,
        },
        sample_record_ids: {
          companies: ['company-1', 'company-2'],
          contacts: ['contact-1'],
        },
        message: 'Created new demo workspace Acme Demo',
      });
      const firstBlock = result.content[0];
      expect(firstBlock).toMatchObject({ type: 'text' });
      if (firstBlock && firstBlock.type === 'text') {
        expect(firstBlock.text).toContain('Created new demo workspace');
        expect(firstBlock.text).toContain('12 companies');
      }
    });

    it('passes through workspace_id for existing-workspace reseeding', async () => {
      const generate = jest.fn().mockResolvedValue({
        workspace_id: 'existing-ws',
        workspace_name: 'Existing',
        template: 'dtc_subscription',
        country: 'jp',
        seed: 1,
        created: false,
        counts: { companies: 10 },
        sample_record_ids: {},
        message: 'Seeded existing workspace Existing',
      });

      const result = await demoGenerateTool.handler({
        reqContext: {
          client: {
            demo: { generate },
          } as any,
          auth: oauthContext(),
          toolProfile: 'full',
        },
        args: {
          template: 'dtc_subscription',
          country: 'jp',
          workspace_id: 'existing-ws',
        },
      });

      expect(generate).toHaveBeenCalledWith({
        template: 'dtc_subscription',
        country: 'jp',
        workspace_id: 'existing-ws',
      });
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent?.['created']).toBe(false);
    });
  });

  describe('push_integration_sync', () => {
    it('returns a reauth challenge when called without authentication', async () => {
      const push = jest.fn();

      const result = await integrationSyncPushTool.handler({
        reqContext: {
          client: {
            integrationSync: { push },
          } as any,
          auth: oauthContext({ authMode: 'none', scopes: [] }),
          toolProfile: 'full',
        },
        args: { channel_id: 'chan-1', object_type: 'company', workspace_scope: 'all' },
      });

      expect(result.isError).toBe(true);
      expect(result._meta?.['mcp/www_authenticate']).toEqual([
        expect.stringContaining('error="invalid_token"'),
      ]);
      expect(push).not.toHaveBeenCalled();
    });

    it('requires channel_id and object_type', async () => {
      const push = jest.fn();

      const result = await integrationSyncPushTool.handler({
        reqContext: {
          client: {
            integrationSync: { push },
          } as any,
          auth: oauthContext(),
          toolProfile: 'full',
        },
        args: { channel_id: 'chan-1' },
      });

      expect(result.isError).toBe(true);
      expect(push).not.toHaveBeenCalled();
    });

    it('requires either record_ids or workspace_scope', async () => {
      const push = jest.fn();

      const result = await integrationSyncPushTool.handler({
        reqContext: {
          client: {
            integrationSync: { push },
          } as any,
          auth: oauthContext(),
          toolProfile: 'full',
        },
        args: { channel_id: 'chan-1', object_type: 'company' },
      });

      expect(result.isError).toBe(true);
      expect(push).not.toHaveBeenCalled();
    });

    it('rejects passing both record_ids and workspace_scope', async () => {
      const push = jest.fn();

      const result = await integrationSyncPushTool.handler({
        reqContext: {
          client: {
            integrationSync: { push },
          } as any,
          auth: oauthContext(),
          toolProfile: 'full',
        },
        args: {
          channel_id: 'chan-1',
          object_type: 'company',
          record_ids: ['rec-1'],
          workspace_scope: 'all',
        },
      });

      expect(result.isError).toBe(true);
      expect(push).not.toHaveBeenCalled();
    });

    it('pushes explicit record ids and returns structured content', async () => {
      const push = jest.fn().mockResolvedValue({
        channel_id: 'chan-1',
        object_type: 'company',
        operation: 'update',
        requested_count: 2,
        emitted_event_ids: ['evt-1', 'evt-2'],
        skipped_count: 0,
        message: 'Queued 2 events.',
      });

      const result = await integrationSyncPushTool.handler({
        reqContext: {
          client: {
            integrationSync: { push },
          } as any,
          auth: oauthContext(),
          toolProfile: 'full',
        },
        args: {
          channel_id: 'chan-1',
          object_type: 'company',
          record_ids: ['rec-1', 'rec-2'],
        },
      });

      expect(push).toHaveBeenCalledWith({
        channel_id: 'chan-1',
        object_type: 'company',
        record_ids: ['rec-1', 'rec-2'],
      });
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual({
        channel_id: 'chan-1',
        object_type: 'company',
        operation: 'update',
        requested_count: 2,
        emitted_event_ids: ['evt-1', 'evt-2'],
        skipped_count: 0,
        message: 'Queued 2 events.',
      });
      const firstBlock = result.content[0];
      if (firstBlock && firstBlock.type === 'text') {
        expect(firstBlock.text).toContain('Queued 2 outbound company events');
      }
    });

    it('pushes every eligible record when workspace_scope=all', async () => {
      const push = jest.fn().mockResolvedValue({
        channel_id: 'chan-1',
        object_type: 'contact',
        operation: 'upsert',
        requested_count: 50,
        emitted_event_ids: ['evt-1'],
        skipped_count: 49,
        message: 'Queued 1 event.',
      });

      const result = await integrationSyncPushTool.handler({
        reqContext: {
          client: {
            integrationSync: { push },
          } as any,
          auth: oauthContext(),
          toolProfile: 'full',
        },
        args: {
          channel_id: 'chan-1',
          object_type: 'contact',
          workspace_scope: 'all',
          operation: 'upsert',
          limit: 200,
        },
      });

      expect(push).toHaveBeenCalledWith({
        channel_id: 'chan-1',
        object_type: 'contact',
        workspace_scope: 'all',
        operation: 'upsert',
        limit: 200,
      });
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent?.['requested_count']).toBe(50);
      expect(result.structuredContent?.['skipped_count']).toBe(49);
    });
  });
});
