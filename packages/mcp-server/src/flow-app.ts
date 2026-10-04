import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { crmCurrentWorkspaceTool } from './crm-tools';
import { McpTool, asErrorResult } from './types';
import { requireAuthentication } from './tool-auth';
import { workflowWorkspaceHeaders } from './workflow-run-tools';

// Canonical Sanka mark from the maintained web app; theme variants keep it legible.
const sankaMark = `<svg width="780" height="751" viewBox="0 0 780 751" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_10270_54135)">
<path d="M0 0L86.6667 375.5H390L0 0Z" fill="url(#paint0_linear_10270_54135)"/>
<path d="M780 751L390 375.5H693.333L780 751Z" fill="url(#paint1_linear_10270_54135)"/>
<path d="M548.889 115.538H231.111C86.6667 115.538 0 0 0 0H780C780 0 693.333 115.538 548.889 115.538Z" fill="#1B0F0B"/>
<path d="M548.889 635.462H231.111C86.6667 635.462 0 751 0 751H780C780 751 693.333 635.462 548.889 635.462Z" fill="#1B0F0B"/>
<path d="M548.888 433.269H231.11C199.212 433.269 86.666 375.5 86.666 375.5C86.666 375.5 199.212 317.731 231.11 317.731H548.888C580.786 317.731 693.333 375.5 693.333 375.5C693.333 375.5 580.786 433.269 548.888 433.269Z" fill="#1B0F0B"/>
</g>
<defs>
<linearGradient id="paint0_linear_10270_54135" x1="195" y1="0" x2="195" y2="375.5" gradientUnits="userSpaceOnUse">
<stop offset="0.25" stop-color="#1B0F0B" stop-opacity="0"/>
<stop offset="0.78" stop-color="#1B0F0B" stop-opacity="0.2"/>
<stop offset="1" stop-color="#1B0F0B" stop-opacity="0.36"/>
</linearGradient>
<linearGradient id="paint1_linear_10270_54135" x1="585" y1="751" x2="585" y2="0" gradientUnits="userSpaceOnUse">
<stop offset="0.25" stop-color="#1B0F0B" stop-opacity="0"/>
<stop offset="0.78" stop-color="#1B0F0B" stop-opacity="0.2"/>
<stop offset="1" stop-color="#1B0F0B" stop-opacity="0.36"/>
</linearGradient>
<clipPath id="clip0_10270_54135">
<rect width="780" height="751" fill="white"/>
</clipPath>
</defs>
</svg>`;

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
      'Open Sanka Flow to find orders, preview an invoice draft, and inspect saved results in the connected workspace.',
    icons: (['light', 'dark'] as const).map((theme) => ({
      src:
        'data:image/svg+xml,' +
        encodeURIComponent(theme === 'dark' ? sankaMark.replaceAll('#1B0F0B', '#FFFFFF') : sankaMark),
      mimeType: 'image/svg+xml',
      sizes: ['any'],
      theme,
    })),
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
