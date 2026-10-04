import { McpTool, asErrorResult } from './types';
import { requireAuthentication } from './tool-auth';
import { workflowWorkspaceHeaders } from './workflow-run-tools';

function invoiceTool(operation: 'preview' | 'start' | 'attempt'): McpTool {
  const write = operation === 'start';
  const name = {
    preview: 'preview_flow_invoice',
    start: 'start_flow_invoice',
    attempt: 'get_flow_invoice_attempt',
  }[operation];
  const title = {
    preview: 'Preview invoice draft',
    start: 'Create invoice draft',
    attempt: 'Recover invoice submission',
  }[operation];
  return {
    metadata: {
      resource: 'workflow-runs',
      operation: write ? 'write' : 'read',
      tags: ['flow', 'app', 'invoices'],
    },
    tool: {
      name,
      title,
      description:
        write ?
          'After the user confirms the reviewed draft, submit this order once. Requires the exact review_token from preview_flow_invoice. Repeated calls recover the same attempt. Never send or approve invoices.'
        : operation === 'preview' ?
          'Preview a draft invoice from one Sanka order. Returns a review_token and canonical order_id for explicit confirmation. Does not create records.'
        : 'Recover the durable invoice submission for this order, including after a timeout. This read never creates another invoice. Read saved records with get_flow_invoice.',
      inputSchema: {
        type: 'object',
        properties: {
          order_id: { type: 'string', minLength: 1 },
          expected_workspace_id: { type: 'string', minLength: 1 },
          ...(write ?
            {
              review_token: {
                type: 'string',
                pattern: '^[a-f0-9]{64}$',
                description:
                  'The SHA-256 fingerprint returned by the reviewed preview. It detects changed order contents; it is not an authentication credential. OAuth remains managed by the host.',
              },
            }
          : {}),
          language: { type: 'string', enum: ['en', 'ja'], default: 'en' },
        },
        required: ['order_id', 'expected_workspace_id', ...(write ? ['review_token'] : [])],
        additionalProperties: false,
      },
      securitySchemes: [{ type: 'oauth2' }],
      annotations: {
        readOnlyHint: !write,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handler: async ({ reqContext, args }) => {
      const denied = requireAuthentication({ reqContext, toolTitle: title });
      if (denied) return denied;
      const expected = String(args?.['expected_workspace_id'] ?? '').trim();
      const orderID = String(args?.['order_id'] ?? '').trim();
      if (!expected || !orderID) return asErrorResult('Order and workspace are required.');
      const binding = await workflowWorkspaceHeaders(reqContext, expected);
      if (binding.error) return binding.error;
      const headers = { ...binding.headers, 'X-Workspace-Code': expected };
      const path = `/api/v2/flow/invoice/${operation}`;
      const response = (
        operation === 'attempt' ?
          await reqContext.client.get(path, { headers, query: { order_id: orderID }, maxRetries: 0 })
        : await reqContext.client.post(path, {
            headers,
            maxRetries: 0,
            body: {
              order_id: orderID,
              language: args?.['language'] === 'ja' ? 'ja' : 'en',
              ...(write ? { review_token: args?.['review_token'] } : {}),
            },
          })) as Record<string, unknown>;
      return { content: [{ type: 'text', text: title }], structuredContent: response };
    },
  };
}

export const flowInvoiceTools = [invoiceTool('preview'), invoiceTool('start'), invoiceTool('attempt')];
