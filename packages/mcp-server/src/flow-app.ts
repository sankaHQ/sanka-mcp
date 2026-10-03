import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { crmCurrentWorkspaceTool } from './crm-tools';
import { McpTool, asErrorResult } from './types';
import { requireAuthentication } from './tool-auth';
import { workflowWorkspaceHeaders } from './workflow-run-tools';

export const FLOW_APP_URI = 'ui://sanka/flow-workspace';
export const FLOW_APP_MIME_TYPE = 'text/html;profile=mcp-app';
export const isFlowAppEnabled = (): boolean => process.env['SANKA_MCP_FLOW_APP_ENABLED'] === '1';

export const flowWorkspaceTool: McpTool = {
  metadata: { resource: 'auth', operation: 'read', tags: ['flow', 'app'] },
  tool: {
    ...crmCurrentWorkspaceTool.tool,
    name: 'open_flow_workspace',
    title: 'Flow workspace',
    description:
      'Open Sanka Flow to preview an invoice from an order and inspect workflow results in the connected workspace.',
    icons: [
      {
        src:
          'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.33"><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="12" y="11" width="6" height="6" rx="1"/><path d="M8 6h7v5M12 8l3 3 3-3"/></svg>',
          ),
        mimeType: 'image/svg+xml',
        sizes: ['any'],
      },
    ],
    annotations: {
      title: 'Flow workspace',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    _meta: {
      ui: { resourceUri: FLOW_APP_URI },
      'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] },
    },
  },
  // Invoked only through the existing dispatcher: scope, validation and audit apply.
  handler: crmCurrentWorkspaceTool.handler,
};

export const flowInvoiceTool: McpTool = {
  metadata: {
    resource: 'invoices',
    operation: 'read',
    tags: ['flow', 'app', 'invoices'],
    httpMethod: 'get',
    httpPath: '/api/v2/invoices/{invoice_id}',
    operationId: 'public.invoices.retrieve',
  },
  tool: {
    name: 'get_flow_invoice',
    title: 'Review saved invoice',
    description:
      'Read a saved invoice and its line items in the workspace displayed by Sanka Flow. Accepts its UUID, number or exact external reference for timeout recovery.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', minLength: 1 },
        expected_workspace_id: { type: 'string', minLength: 1 },
      },
      required: ['invoice_id', 'expected_workspace_id'],
      additionalProperties: false,
    },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  handler: async ({ reqContext, args }) => {
    const denied = requireAuthentication({ reqContext, toolTitle: 'Review saved invoice' });
    if (denied) return denied;
    const expected =
      typeof args?.['expected_workspace_id'] === 'string' ? args['expected_workspace_id'].trim() : '';
    const invoiceID = typeof args?.['invoice_id'] === 'string' ? args['invoice_id'].trim() : '';
    if (!expected || !invoiceID) return asErrorResult('Invoice and workspace are required.');
    const binding = await workflowWorkspaceHeaders(reqContext, expected);
    if (binding.error) return binding.error;
    // Pin both detail and line-item reads even if a legacy session switches after
    // the fresh context check. Connector tokens additionally enforce this in V2.
    const headers = { ...binding.headers, 'X-Workspace-Code': expected };
    const invoice = (await reqContext.client.public.invoices.retrieve(
      invoiceID,
      {},
      { headers },
    )) as unknown as Record<string, unknown>;
    const id = typeof invoice['id'] === 'string' ? invoice['id'] : '';
    if (!id) return asErrorResult('The saved invoice could not be identified.');
    const lineItems = await reqContext.client.public.invoices.listLineItems(id, { headers });
    return {
      content: [{ type: 'text', text: 'Read back the saved invoice and line items.' }],
      structuredContent: { ...invoice, line_items: lineItems },
    };
  },
};

export const flowAppResource = {
  uri: FLOW_APP_URI,
  name: 'flow-workspace',
  title: 'Flow workspace',
  mimeType: FLOW_APP_MIME_TYPE,
};

export async function readFlowAppResource(uri: string) {
  if (uri !== FLOW_APP_URI) throw new McpError(ErrorCode.InvalidParams, 'Unknown resource');
  return {
    contents: [
      {
        uri,
        mimeType: FLOW_APP_MIME_TYPE,
        text: await readFile(join(__dirname, 'flow-app.html'), 'utf8'),
        _meta: {
          ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: false },
          'openai/ui': {
            preferredDisplayMode: 'fullscreen',
            availableDisplayModes: ['inline', 'fullscreen'],
          },
        },
      },
    ],
  };
}
