import Sanka from 'sanka-sdk';
import {
  previewWorkflowTool,
  startWorkflowTool,
  getWorkflowRunTool,
} from '../../packages/mcp-server/src/workflow-run-tools';

// A persistent app must not follow another conversation's workspace switch.
// This is an MCP transport invariant; the API cannot know the app's displayed workspace.
const cases = [
  { tool: previewWorkflowTool, path: '/preview' },
  { tool: startWorkflowTool, path: '/start' },
  { tool: getWorkflowRunTool, path: '/run-1' },
];

describe('workflow workspace pinned by an app', () => {
  it.each(cases)(
    'rejects a stale workspace for $tool.tool.name before sending business data',
    async ({ tool }) => {
      const requests: string[] = [];
      const client = new Sanka({
        apiKey: 'test-only',
        baseURL: 'https://api.example.test',
        maxRetries: 0,
        fetch: async (input) => {
          requests.push(String(input));
          return new Response(JSON.stringify({ data: { current_workspace: { id: 'workspace-b' } } }), {
            headers: { 'content-type': 'application/json' },
          });
        },
      });
      const result = await tool.handler({
        reqContext: { client, mcpSessionId: 'session-1' },
        args: {
          expected_workspace_id: 'workspace-a',
          run_id: 'run-1',
          workflow_type: 'order_to_invoice',
          source_record: { source_system: 'sanka', object_type: 'order', record_id: 'order-1' },
        },
      });
      expect(result.isError).toBe(true);
      expect(result.structuredContent?.['error']).toBe('WORKSPACE_CONTEXT_MISMATCH');
      expect(requests).toEqual(['https://api.example.test/api/v2/public/auth/session']);
    },
  );

  it.each(cases)('forwards the verified workspace for $tool.tool.name', async ({ tool, path }) => {
    const requests: { url: string; headers: Headers; body: unknown }[] = [];
    const client = new Sanka({
      apiKey: 'test-only',
      baseURL: 'https://api.example.test',
      maxRetries: 0,
      fetch: async (input, init) => {
        requests.push({ url: String(input), headers: new Headers(init?.headers), body: init?.body });
        const data =
          String(input).endsWith('/auth/session') ?
            { current_workspace: { id: 'workspace-a' } }
          : { status: 'previewed' };
        return new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } });
      },
    });
    const result = await tool.handler({
      reqContext: { client, mcpSessionId: 'session-1' },
      args: {
        expected_workspace_id: 'workspace-a',
        run_id: 'run-1',
        workflow_type: 'order_to_invoice',
        source_record: { source_system: 'sanka', object_type: 'order', record_id: 'order-1' },
      },
    });
    expect(result.isError).not.toBe(true);
    expect(requests[1]?.url).toBe(`https://api.example.test/api/v2/public/workflow-runs${path}`);
    expect(requests[1]?.headers.get('X-Sanka-Expected-Workspace-ID')).toBe('workspace-a');
    expect(requests[1]?.body ?? '').not.toContain('expected_workspace_id');
    expect(result.structuredContent?.['data']).toEqual({ status: 'previewed' });
  });

  it('refuses a pinned request without an MCP session', async () => {
    const result = await previewWorkflowTool.handler({
      reqContext: {
        client: new Sanka({
          apiKey: 'test-only',
          maxRetries: 0,
          fetch: async () => {
            throw new Error('Unexpected HTTP request');
          },
        }),
      },
      args: {
        expected_workspace_id: 'workspace-a',
        workflow_type: 'order_to_invoice',
        source_record: { record_id: 'order-1' },
      },
    });
    expect(result.structuredContent?.['error']).toBe('WORKSPACE_CONTEXT_MISMATCH');
  });
});
