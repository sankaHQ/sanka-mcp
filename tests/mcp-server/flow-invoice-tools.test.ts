import Sanka from 'sanka-sdk';
import { flowInvoiceTools } from '../../packages/mcp-server/src/flow-invoice-tools';
import { flowInvoiceTool } from '../../packages/mcp-server/src/flow-app';

// Owns the App's MCP->V2 wire boundary; API tests own persistence and deduplication.
describe('Flow invoice tools', () => {
  it.each([...flowInvoiceTools, flowInvoiceTool])('pins every request for $tool.name', async (tool) => {
    const requests: { url: string; headers: Headers; body: unknown }[] = [];
    const client = new Sanka({
      apiKey: 'test-only',
      baseURL: 'https://api.example.test',
      maxRetries: 0,
      fetch: async (input, init) => {
        const url = String(input);
        requests.push({ url, headers: new Headers(init?.headers), body: init?.body });
        const data =
          url.endsWith('/auth/session') ? { current_workspace: { id: 'workspace-a' } }
          : url.endsWith('/invoices/invoice-1') ?
            { id: 'invoice-1', properties: { total_price: '123.45', currency: 'USD', status: 'draft' } }
          : url.endsWith('/line-items') ? { items: [{ id: 'line-1', total_price: '123.45' }] }
          : { order_id: 'order-1', status: 'submitted' };
        return new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'test' } }), { headers: { 'content-type': 'application/json' } });
      },
    });
    const result = await tool.handler({
      reqContext: { client, mcpSessionId: 'test-session' },
      args: {
        expected_workspace_id: 'workspace-a',
        order_id: 'order-1',
        invoice_id: 'invoice-1',
        review_token: 'a'.repeat(64),
      },
    });
    expect(result.isError).not.toBe(true);
    expect(requests.length).toBe(tool === flowInvoiceTool ? 3 : 2);
    for (const request of requests.slice(1)) {
      expect(request.headers.get('X-Workspace-Code')).toBe('workspace-a');
      expect(request.headers.get('X-Sanka-Expected-Workspace-ID')).toBe('workspace-a');
    }
    if (tool === flowInvoiceTool) {
      expect(result.structuredContent).toMatchObject({
        id: 'invoice-1',
        total_price: '123.45',
        line_items: [{ id: 'line-1' }],
      });
    } else {
      expect(result.structuredContent?.['data']).toMatchObject({ order_id: 'order-1', status: 'submitted' });
    }
  });

  it('does not retry a failed creation request', async () => {
    let submissions = 0;
    const client = new Sanka({
      apiKey: 'test-only',
      baseURL: 'https://api.example.test',
      maxRetries: 2,
      fetch: async (input) => {
        if (String(input).endsWith('/auth/session'))
          return new Response(JSON.stringify({ data: { current_workspace: { id: 'workspace-a' } } }), {
            headers: { 'content-type': 'application/json' },
          });
        submissions++;
        return new Response(JSON.stringify({ error: { code: 'UNAVAILABLE' } }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const tool = flowInvoiceTools.find((item) => item.tool.name === 'start_flow_invoice')!;
    await expect(
      tool.handler({
        reqContext: { client, mcpSessionId: 'test-session' },
        args: { expected_workspace_id: 'workspace-a', order_id: 'order-1', review_token: 'a'.repeat(64) },
      }),
    ).rejects.toThrow();
    expect(submissions).toBe(1);
  });
});
