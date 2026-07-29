// Hand-written sandbox workspace tools for the /api/v2/sandboxes family.
// These endpoints sit outside the public developer OpenAPI contract, so the
// handlers call the API with raw client paths (like the auth/workspace
// family) and are kept separate from Stainless-generated code so they
// survive regeneration.
import { asErrorResult, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const SANDBOX_DATA_OBJECTS = [
  'contacts',
  'companies',
  'deals',
  'items',
  'orders',
  'invoices',
  'estimates',
  'tasks',
  'tickets',
  'custom_objects',
] as const;

const SANDBOX_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    data: { type: 'object' },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
};

const SANDBOX_ID_SCHEMA = {
  type: 'object' as const,
  properties: {
    sandbox_id: {
      type: 'string',
      description:
        'The sandbox link id returned by list_sandboxes/create_sandbox (field `id`) — not the sandbox workspace id or the 8-digit workspace code.',
    },
  },
  required: ['sandbox_id'],
};

const readString = (value: unknown): string | undefined => {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
};

const readBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return undefined;
};

const readObject = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ?
    (value as Record<string, unknown>)
  : undefined;

const readStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.map((entry) => String(entry ?? '').trim()).filter(Boolean) : undefined;

const sandboxResult = (payload: Record<string, unknown>, fallbackSummary: string): ToolCallResult => {
  const envelope = readObject(payload) ?? {};
  const data = readObject(envelope['data']) ?? envelope;
  const meta = readObject(envelope['meta']);
  const message = readString(envelope['message']) ?? fallbackSummary;
  return {
    content: [
      { type: 'text', text: message },
      { type: 'text', text: `Structured sandbox data:\n${JSON.stringify(data, null, 2)}` },
    ],
    structuredContent: {
      data,
      message,
      ctx_id: readString(meta?.['ctx_id']),
    },
  };
};

const confirmationPreview = (action: string, detail: string): ToolCallResult => ({
  content: [
    {
      type: 'text',
      text: `Preview only — no changes made. ${detail} Re-run ${action} with confirm=true only after the user explicitly approves.`,
    },
  ],
  structuredContent: {
    data: { confirmed: false, action },
    message: 'Confirmation required.',
    ctx_id: undefined,
  },
});

export const listSandboxesTool: McpTool = {
  metadata: {
    resource: 'sandboxes',
    operation: 'read',
    tags: ['crm', 'sandboxes'],
    httpMethod: 'get',
    httpPath: '/api/v2/sandboxes',
    operationId: 'list_sandboxes',
  },
  tool: {
    name: 'list_sandboxes',
    title: 'List sandboxes',
    description:
      'List the sandbox linked to the current workspace (one sandbox per workspace). Each entry includes the sandbox link id, status (creating/active/refreshing/failed/deleting), the sandbox workspace code, and copy stats. Operates on the current workspace; use switch_workspace first if needed.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: SANDBOX_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List sandboxes',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List sandboxes' });
    if (authError) return authError;
    const response = (await reqContext.client.get('/api/v2/sandboxes')) as Record<string, unknown>;
    return sandboxResult(response, 'Listed sandboxes for the current workspace.');
  },
};

export const getSandboxContextTool: McpTool = {
  metadata: {
    resource: 'sandboxes',
    operation: 'read',
    tags: ['crm', 'sandboxes'],
    httpMethod: 'get',
    httpPath: '/api/v2/sandboxes/context',
    operationId: 'get_sandbox_context',
  },
  tool: {
    name: 'get_sandbox_context',
    title: 'Get sandbox context',
    description:
      'Report whether the CURRENT workspace is itself a sandbox (is_sandbox, status, and the production workspace it belongs to). Call this before risky or experimental changes: if is_sandbox=true you are already in a safe copy; if false, consider creating or switching to a sandbox first.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: SANDBOX_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get sandbox context',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Get sandbox context' });
    if (authError) return authError;
    const response = (await reqContext.client.get('/api/v2/sandboxes/context')) as Record<string, unknown>;
    return sandboxResult(response, 'Fetched sandbox context for the current workspace.');
  },
};

export const createSandboxTool: McpTool = {
  metadata: {
    resource: 'sandboxes',
    operation: 'write',
    tags: ['crm', 'sandboxes'],
    httpMethod: 'post',
    httpPath: '/api/v2/sandboxes',
    operationId: 'create_sandbox',
  },
  tool: {
    name: 'create_sandbox',
    title: 'Create sandbox',
    description:
      'Create a sandbox copy of the current workspace configuration (objects, fields, views, pipelines, workflows arrive paused; records, integrations, and credentials are never copied). Responds 202 with status=creating; poll list_sandboxes until active. Requires an admin role and sandbox entitlement (partner plan or an override); one sandbox per workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Optional sandbox name. Defaults to "<workspace name> Sandbox".',
        },
      },
    },
    outputSchema: SANDBOX_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create sandbox',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Create sandbox' });
    if (authError) return authError;
    const body = { name: readString(args?.['name']) ?? null };
    const response = (await reqContext.client.post('/api/v2/sandboxes', { body })) as Record<string, unknown>;
    return sandboxResult(response, 'Sandbox creation started (poll list_sandboxes until active).');
  },
};

export const syncSandboxDataTool: McpTool = {
  metadata: {
    resource: 'sandboxes',
    operation: 'write',
    tags: ['crm', 'sandboxes'],
    httpMethod: 'post',
    httpPath: '/api/v2/sandboxes/{sandbox_id}/data-sync',
    operationId: 'sync_sandbox_data',
  },
  tool: {
    name: 'sync_sandbox_data',
    title: 'Copy production data into sandbox',
    description:
      'Copy a sample of production records into an active sandbox: per selected object, the newest 5,000 records with custom field values, line items, and associations between copied records. Additive and idempotent (re-running adds newer records without duplicating). Responds 202; progress lands in the sandbox copy_stats.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SANDBOX_ID_SCHEMA.properties,
        objects: {
          type: 'array',
          items: { type: 'string', enum: [...SANDBOX_DATA_OBJECTS] },
          minItems: 1,
          description: 'Object families to copy.',
        },
      },
      required: ['sandbox_id', 'objects'],
    },
    outputSchema: SANDBOX_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Copy production data into sandbox',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Copy production data into sandbox',
    });
    if (authError) return authError;
    const sandboxID = readString(args?.['sandbox_id']);
    if (!sandboxID) return asErrorResult('`sandbox_id` is required.');
    const objects = readStringArray(args?.['objects']);
    if (!objects || objects.length === 0) {
      return asErrorResult('`objects` must list at least one object family.');
    }
    const response = (await reqContext.client.post(
      `/api/v2/sandboxes/${encodeURIComponent(sandboxID)}/data-sync`,
      { body: { objects } },
    )) as Record<string, unknown>;
    return sandboxResult(response, 'Sandbox data copy started.');
  },
};

export const getSandboxDiffTool: McpTool = {
  metadata: {
    resource: 'sandboxes',
    operation: 'read',
    tags: ['crm', 'sandboxes'],
    httpMethod: 'get',
    httpPath: '/api/v2/sandboxes/{sandbox_id}/diff',
    operationId: 'get_sandbox_diff',
  },
  tool: {
    name: 'get_sandbox_diff',
    title: 'Diff sandbox against production',
    description:
      'Compare the sandbox configuration against production per family (views, workflows, fields, pipelines, …): counts and bounded item lists for new-in-sandbox, modified-since-copy, and production-only. Use this as the checklist before re-applying tested changes to production.',
    inputSchema: SANDBOX_ID_SCHEMA,
    outputSchema: SANDBOX_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Diff sandbox against production',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Diff sandbox against production',
    });
    if (authError) return authError;
    const sandboxID = readString(args?.['sandbox_id']);
    if (!sandboxID) return asErrorResult('`sandbox_id` is required.');
    const response = (await reqContext.client.get(
      `/api/v2/sandboxes/${encodeURIComponent(sandboxID)}/diff`,
    )) as Record<string, unknown>;
    return sandboxResult(response, 'Computed sandbox configuration diff.');
  },
};

export const refreshSandboxTool: McpTool = {
  metadata: {
    resource: 'sandboxes',
    operation: 'write',
    tags: ['crm', 'sandboxes'],
    httpMethod: 'post',
    httpPath: '/api/v2/sandboxes/{sandbox_id}/refresh',
    operationId: 'refresh_sandbox',
  },
  tool: {
    name: 'refresh_sandbox',
    title: 'Refresh sandbox',
    description:
      'Replace everything in the sandbox with a fresh copy of current production configuration. PERMANENTLY DISCARDS all sandbox changes and copied data; the sandbox keeps its workspace code and URLs. Refreshes sit 24h apart (a never-refreshed sandbox may refresh immediately). Requires confirm=true after explicit user approval.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SANDBOX_ID_SCHEMA.properties,
        confirm: {
          type: 'boolean',
          default: false,
          description: 'Set true only after the user explicitly approves discarding sandbox changes.',
        },
      },
      required: ['sandbox_id'],
    },
    outputSchema: SANDBOX_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Refresh sandbox',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Refresh sandbox' });
    if (authError) return authError;
    const sandboxID = readString(args?.['sandbox_id']);
    if (!sandboxID) return asErrorResult('`sandbox_id` is required.');
    if (readBoolean(args?.['confirm']) !== true) {
      return confirmationPreview(
        'refresh_sandbox',
        'Refreshing permanently discards every change and all copied data in the sandbox, then re-copies production configuration (the sandbox keeps its workspace code).',
      );
    }
    const response = (await reqContext.client.post(
      `/api/v2/sandboxes/${encodeURIComponent(sandboxID)}/refresh`,
      { body: {} },
    )) as Record<string, unknown>;
    return sandboxResult(response, 'Sandbox refresh started (poll list_sandboxes until active).');
  },
};

export const deleteSandboxTool: McpTool = {
  metadata: {
    resource: 'sandboxes',
    operation: 'write',
    tags: ['crm', 'sandboxes'],
    httpMethod: 'delete',
    httpPath: '/api/v2/sandboxes/{sandbox_id}',
    operationId: 'delete_sandbox',
  },
  tool: {
    name: 'delete_sandbox',
    title: 'Delete sandbox',
    description:
      'PERMANENTLY delete the sandbox workspace and everything in it. Production is never affected. Requires confirm=true after explicit user approval.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SANDBOX_ID_SCHEMA.properties,
        confirm: {
          type: 'boolean',
          default: false,
          description: 'Set true only after the user explicitly approves deleting the sandbox.',
        },
      },
      required: ['sandbox_id'],
    },
    outputSchema: SANDBOX_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete sandbox',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Delete sandbox' });
    if (authError) return authError;
    const sandboxID = readString(args?.['sandbox_id']);
    if (!sandboxID) return asErrorResult('`sandbox_id` is required.');
    if (readBoolean(args?.['confirm']) !== true) {
      return confirmationPreview(
        'delete_sandbox',
        'Deleting removes the sandbox workspace and everything inside it permanently.',
      );
    }
    const response = (await reqContext.client.delete(
      `/api/v2/sandboxes/${encodeURIComponent(sandboxID)}`,
    )) as Record<string, unknown>;
    return sandboxResult(response, 'Sandbox deletion started.');
  },
};
