import { enrichRecordUrlsForToolResult } from '../../packages/mcp-server/src/record-url-enrichment';

const reqContext = {
  client: {} as any,
  auth: {
    authMode: 'oauth_bearer',
    clientOptions: {},
    oauth: {
      authorizationServerUrl: 'https://app.sanka.com',
      resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
      resourceUrl: 'https://mcp.sanka.com/mcp',
      scopes: ['mcp:access'],
      workspace_code: '39467777',
    },
  },
} as any;

describe('record URL enrichment', () => {
  it('adds app_url and workspace_code to list records for object resources', () => {
    const result = enrichRecordUrlsForToolResult({
      result: {
        content: [{ type: 'text', text: 'ok' }],
        structuredContent: {
          data: [{ id: 'cc59d222-21c1-4a64-af2a-6d6479fc8c51', id_inv: 21 }],
        },
      },
      resource: 'invoices',
      reqContext,
      args: { language: 'ja' },
    });

    expect(result.structuredContent?.['data']).toEqual([
      {
        id: 'cc59d222-21c1-4a64-af2a-6d6479fc8c51',
        id_inv: 21,
        workspace_code: '39467777',
        app_url: 'https://app.sanka.com/ja/39467777/invoices/?id=cc59d222-21c1-4a64-af2a-6d6479fc8c51',
      },
    ]);
  });

  it('adds app_url to mutation responses and mirrors single-record URLs into text content', () => {
    const result = enrichRecordUrlsForToolResult({
      result: {
        content: [{ type: 'text', text: 'created' }],
        structuredContent: {
          ok: true,
          status: 'created',
          order_id: 'order-uuid-1',
        },
      },
      resource: 'orders',
      reqContext,
      args: {},
    });

    expect(result.structuredContent).toMatchObject({
      workspace_code: '39467777',
      app_url: 'https://app.sanka.com/ja/39467777/orders/?id=order-uuid-1',
    });
    expect(result.content?.[0]).toMatchObject({
      type: 'text',
      text: 'created\napp_url: https://app.sanka.com/ja/39467777/orders/?id=order-uuid-1',
    });
  });

  it('does not overwrite backend-provided app_url or enrich integration rows', () => {
    const result = enrichRecordUrlsForToolResult({
      result: {
        content: [{ type: 'text', text: 'ok' }],
        structuredContent: {
          data: [
            {
              id: 'item-1',
              app_url: 'https://example.test/item-1',
              workspace_code: '11111111',
            },
            {
              id: 'remote-1',
              scope: 'integration',
            },
          ],
        },
      },
      resource: 'items',
      reqContext,
      args: { language: 'en' },
    });

    expect(result.structuredContent?.['data']).toEqual([
      {
        id: 'item-1',
        app_url: 'https://example.test/item-1',
        workspace_code: '11111111',
      },
      {
        id: 'remote-1',
        scope: 'integration',
      },
    ]);
  });
});
