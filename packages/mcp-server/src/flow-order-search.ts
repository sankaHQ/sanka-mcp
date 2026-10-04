import { McpTool, asErrorResult } from './types';
import { requireAuthentication } from './tool-auth';
import { workflowWorkspaceHeaders } from './workflow-run-tools';

export const flowOrderSearchTool: McpTool = {
  metadata: { resource: 'orders', operation: 'read', tags: ['flow', 'app', 'orders'] },
  tool: {
    name: 'search_flow_orders',
    title: 'Find orders',
    description:
      'Find existing Sanka orders by customer name, order notes, or line-item name/description in the connected workspace. Returns 20 matches per page. Ask the user to choose when several orders match; never choose by guesswork. Use the chosen order_id with preview_flow_invoice before requesting confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' },
        page: { type: 'integer', minimum: 1, maximum: 1000, default: 1 },
        expected_workspace_id: { type: 'string', minLength: 1 },
      },
      required: ['query', 'expected_workspace_id'],
      additionalProperties: false,
    },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  handler: async ({ reqContext, args }) => {
    const denied = requireAuthentication({ reqContext, toolTitle: 'Find orders' });
    if (denied) return denied;
    const expected = String(args?.['expected_workspace_id'] ?? '').trim();
    const query = String(args?.['query'] ?? '').trim();
    if (!expected || !query) return asErrorResult('Enter a customer name or order description.');
    const binding = await workflowWorkspaceHeaders(reqContext, expected);
    if (binding.error) return binding.error;
    const response = (await reqContext.client.get('/api/v2/flow/invoice/orders', {
      headers: { ...binding.headers, 'X-Workspace-Code': expected },
      query: { query, page: args?.['page'] ?? 1 },
      maxRetries: 0,
    })) as Record<string, unknown>;
    return {
      content: [{ type: 'text', text: 'Matching orders. Choose an order, then preview the invoice.' }],
      structuredContent: response,
    };
  },
};
