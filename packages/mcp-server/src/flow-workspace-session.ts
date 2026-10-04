import { McpTool, asErrorResult } from './types';
import { workflowWorkspaceHeaders } from './workflow-run-tools';
import { flowWorkspaceOrigin } from './flow-workspace-config';

export const flowWorkspaceSessionTool: McpTool = {
  metadata: { resource: 'auth', operation: 'write', tags: ['flow', 'app'] },
  tool: {
    name: 'start_flow_workspace_session',
    title: 'Open full Flow workspace',
    description:
      'Open the connected workspace in Sanka Flow inside ChatGPT after the user selects Open workspace. Requires prior full-workspace consent. Creates a browser session only; does not change business records. The one-use browser-bound handoff is returned only to the app.',
    inputSchema: {
      type: 'object',
      properties: {
        expected_workspace_id: { type: 'string', minLength: 1, maxLength: 64 },
        browser_challenge: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        browser_origin: { type: 'string', minLength: 1, maxLength: 255 },
      },
      required: ['expected_workspace_id', 'browser_challenge', 'browser_origin'],
      additionalProperties: false,
    },
    securitySchemes: [{ type: 'oauth2' }],
    outputSchema: {
      type: 'object',
      properties: { workspace_id: { type: 'string' }, status: { type: 'string', enum: ['opening'] } },
      required: ['workspace_id', 'status'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
    _meta: { ui: { visibility: ['app'] } },
  },
  handler: async ({ reqContext, args }) => {
    const base = flowWorkspaceOrigin();
    if (!base || !reqContext.auth?.oauth.nativeOAuth)
      return asErrorResult('Open Sanka Flow through the ChatGPT connection.');
    const expected = String(args?.['expected_workspace_id'] || '');
    const origin = String(args?.['browser_origin'] || '');
    const challenge = String(args?.['browser_challenge'] || '');
    let valid = false;
    try {
      const url = new URL(origin),
        root = new URL(base);
      const suffix = '.' + root.hostname;
      valid =
        url.origin === origin &&
        url.protocol === root.protocol &&
        url.port === root.port &&
        !url.username &&
        !url.password &&
        url.hostname.endsWith(suffix) &&
        /^[a-f0-9]{32}$/.test(url.hostname.slice(0, -suffix.length));
    } catch {
      /* Fail closed before forwarding. */
    }
    if (!valid || !/^[a-f0-9]{64}$/.test(challenge) || !expected)
      return asErrorResult('Invalid workspace browser binding.');
    const binding = await workflowWorkspaceHeaders(reqContext, expected);
    if (binding.error) return binding.error;
    const response = await reqContext.client.post<{
      data: { ticket: string; browser_origin: string; expires_in: number };
    }>('/api/v2/auth/chatgpt-connector/launch', {
      headers: { ...binding.headers, 'X-Workspace-Code': expected },
      maxRetries: 0,
      body: { expected_workspace_id: expected, browser_origin: origin, browser_challenge: challenge },
    });
    const session = response.data;
    if (!session || !/^scwt_[A-Za-z0-9_-]{43}$/.test(session.ticket) || session.browser_origin !== origin) {
      return asErrorResult('The workspace session could not be opened.');
    }
    return {
      content: [
        {
          type: 'text',
          text: 'Opening the connected Sanka Flow workspace. No business records were changed.',
        },
      ],
      structuredContent: { workspace_id: expected, status: 'opening' },
      // Credential never enters model-visible content, record enrichment, or audit summaries.
      _meta: { flow_workspace_session: session },
    };
  },
};
