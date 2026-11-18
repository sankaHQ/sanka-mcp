import Sanka from 'sanka-sdk';

import { demoGenerateTool, integrationSyncPushTool } from '../../packages/mcp-server/src/demo-tools';

const oauthContext = (overrides?: { authMode?: 'none' | 'oauth_bearer'; scopes?: string[] }) => ({
  authMode: overrides?.authMode ?? 'oauth_bearer',
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
    expect(integrationSyncPushTool.metadata.operationId).toBe('integration_sync.push.create');
    expect(integrationSyncPushTool.metadata.httpPath).toBe('/api/v2/integration-sync/push');
    expect(integrationSyncPushTool.metadata.httpMethod).toBe('post');
  });

  it('advertises the runnable HubSpot push object matrix', () => {
    const properties = (integrationSyncPushTool.tool.inputSchema as any).properties;

    expect(properties.object_type.enum).toEqual(['contact', 'company', 'deal', 'ticket', 'custom_object']);
    expect(properties.object_type.description).toContain('custom_object');
    expect(properties.object_type.description).toContain('custom_object_id');
    expect(properties.custom_object_id.description).toContain('object_type is "custom_object"');
    expect(integrationSyncPushTool.tool.description).toContain('"custom_object"');
  });

  describe('generate_demo_workspace', () => {
    // Pins the published name, the route each action calls and what the person reads back. Route
    // behaviour (limits, who may ask, the build) is owned by sanka-api and its e2e specs.
    type Call = { method: string; url: string; body: unknown };
    const demo = (overrides: Record<string, unknown> = {}) => ({
      id: 'demo-1',
      product: 'monitor',
      case: 'bpo_windows10_shadow_ai',
      status: 'ready',
      workspace: { id: 'ws-1', code: '12345678', name: 'Demo – Northbay Contact Solutions' },
      link: 'https://monitor.sanka.com/12345678/risk-report',
      script: '**Sanka Monitor demo**',
      expires_at: '2026-12-19T00:00:00Z',
      ...overrides,
    });
    const clientFor = (calls: Call[], respond: (call: Call) => Response) =>
      new Sanka({
        apiKey: 'My API Key',
        apiVersion: 'v2',
        baseURL: 'http://localhost:5000/',
        maxRetries: 0,
        fetch: async (url, init) => {
          const call = {
            method: String(init?.method ?? 'GET').toUpperCase(),
            url: String(url),
            body: init?.body ? JSON.parse(String(init.body)) : undefined,
          };
          calls.push(call);
          return respond(call);
        },
      });
    const ok = (data: unknown) =>
      new Response(JSON.stringify({ success: true, data }), {
        headers: { 'Content-Type': 'application/json' },
      });
    const run = (client: Sanka, args: Record<string, unknown>) =>
      demoGenerateTool.handler({
        reqContext: { client, auth: oauthContext(), toolProfile: 'full' } as any,
        args,
      });

    it.each([
      {
        name: 'build',
        args: { product: 'monitor', case: 'bpo_windows10_shadow_ai', size: 12, language: 'en' },
        call: {
          method: 'POST',
          url: 'http://localhost:5000/api/v2/demo-workspaces',
          body: { product: 'monitor', case: 'bpo_windows10_shadow_ai', language: 'en', size: 12 },
        },
        data: demo({ status: 'queued', link: null, script: null, workspace: null }),
        text: 'action "status"',
      },
      {
        name: 'status',
        args: { action: 'status', demo_id: 'demo-1' },
        call: { method: 'GET', url: 'http://localhost:5000/api/v2/demo-workspaces/demo-1', body: undefined },
        data: demo(),
        text: 'https://monitor.sanka.com/12345678/risk-report',
      },
      {
        name: 'end',
        args: { action: 'end', demo_id: 'demo-1' },
        call: { method: 'POST', url: 'http://localhost:5000/api/v2/demo-workspaces/demo-1/end', body: {} },
        data: demo({ status: 'ended' }),
        text: 'ended',
      },
    ])('$name calls its route and says what to do next', async ({ args, call, data, text }) => {
      const calls: Call[] = [];
      const result = (await run(
        clientFor(calls, () => ok(data)),
        args,
      )) as { content: Array<{ text: string }>; isError?: boolean };
      expect(calls).toEqual([call]);
      expect(result.isError).toBeUndefined();
      expect(result.content[0]?.text).toContain(text);
    });

    it('refuses to build without a product and a case, and calls nothing', async () => {
      const calls: Call[] = [];
      const result = (await run(
        clientFor(calls, () => ok({})),
        { case: 'manufacturing' },
      )) as {
        isError?: boolean;
      };
      expect(result.isError).toBe(true);
      expect(calls).toEqual([]);
    });

    it('returns the route refusal with its code, so the client can say why', async () => {
      const calls: Call[] = [];
      const refusal = () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'DEMO_WORKSPACES_SANKA_MEMBERS_ONLY', message: 'Only Sanka members can ask.' },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      const result = (await run(clientFor(calls, refusal), {
        product: 'flow',
        case: 'manufacturing',
      })) as { isError?: boolean; structuredContent?: { code?: string } };
      expect(result.isError).toBe(true);
      expect(result.structuredContent?.code).toBe('DEMO_WORKSPACES_SANKA_MEMBERS_ONLY');
    });
  });

  describe('push_integration_sync', () => {
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
