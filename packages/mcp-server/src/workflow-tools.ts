import { asErrorResult, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const WORKFLOW_MUTATION_SCHEMA = {
  type: 'object' as const,
  properties: {
    provider: {
      type: 'string',
      enum: ['sanka', 'hubspot'],
      default: 'sanka',
      description:
        'Workflow provider. Use sanka for Sanka-native workflow definitions and hubspot for HubSpot Automation v4 flows through the same workflow endpoint.',
    },
    channel_id: {
      type: 'string',
      description: 'Optional integration channel id. Required when multiple HubSpot channels exist.',
    },
    external_id: {
      type: 'string',
      description: 'External workflow id. For HubSpot update this is the HubSpot flow id.',
    },
    title: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'string', description: 'Workflow status such as draft, active, or inactive.' },
    is_trigger_active: { type: 'boolean' },
    trigger_type: { type: 'string' },
    trigger_every: { type: 'number' },
    object_type: {
      type: 'string',
      enum: ['deal', 'contact', 'company', 'ticket'],
      default: 'deal',
      description: 'CRM object type for platform workflows. HubSpot deal maps to objectTypeId 0-3.',
    },
    trigger: {
      type: 'object',
      description:
        'Business trigger spec. For HubSpot property-change flows, pass property and value, for example {property:"dealstage", value:"closedwon"}.',
    },
    actions: {
      type: 'array',
      items: { type: 'object' },
      description:
        'Workflow actions. For HubSpot set-property flows, pass [{type:"set_property", property:"amount", value:100}]. For Sanka, actions can be public workflow nodes.',
    },
    nodes: {
      type: 'array',
      items: { type: 'object' },
      description: 'Sanka workflow nodes using public action_uid/action_slug/action_id identifiers.',
    },
    config: { type: 'object' },
    platform_payload: {
      type: 'object',
      description:
        'Raw provider payload override. For HubSpot this is sent to /automation/v4/flows or /automation/v4/flows/{flowId}.',
    },
    revision_id: {
      type: 'string',
      description: 'HubSpot revisionId required by some HubSpot flow update payloads.',
    },
    dry_run: {
      type: 'boolean',
      default: true,
      description: 'Preview without writing. HubSpot mutations default to dry run unless confirm=true.',
    },
    confirm: {
      type: 'boolean',
      default: false,
      description: 'Set true only after the user explicitly approves creating or updating the workflow.',
    },
  },
};

const WORKFLOW_RUN_SCHEMA = {
  type: 'object' as const,
  properties: {
    workflow_id: {
      type: 'string',
      description: 'Sanka workflow id to run.',
    },
    provider: {
      type: 'string',
      enum: ['sanka'],
      default: 'sanka',
      description: 'Only Sanka-native workflow runs are supported here.',
    },
    options: { type: 'object' },
    payload: { type: 'object' },
  },
  required: ['workflow_id'],
};

const WORKFLOW_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    data: { type: 'object' },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
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

const readObjectArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ?
    value.filter((entry): entry is Record<string, unknown> => Boolean(readObject(entry)))
  : [];

const workflowResult = (payload: Record<string, unknown>, fallbackSummary: string): ToolCallResult => {
  const data = readObject(payload['data']) ?? payload;
  const message = readString(payload['message']) ?? fallbackSummary;
  return {
    content: [
      { type: 'text', text: message },
      { type: 'text', text: `Structured workflow data:\n${JSON.stringify(data, null, 2)}` },
    ],
    structuredContent: {
      data,
      message,
      ctx_id: readString(payload['ctx_id']),
    },
  };
};

const mutationBody = (args: Record<string, unknown> | undefined): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    provider: readString(args?.['provider']) ?? 'sanka',
    channel_id: readString(args?.['channel_id']),
    external_id: readString(args?.['external_id']),
    title: readString(args?.['title']),
    description: readString(args?.['description']),
    status: readString(args?.['status']),
    trigger_type: readString(args?.['trigger_type']),
    trigger_every: args?.['trigger_every'],
    is_trigger_active: readBoolean(args?.['is_trigger_active']),
    object_type: readString(args?.['object_type']),
    trigger: readObject(args?.['trigger']),
    actions: readObjectArray(args?.['actions']),
    nodes: readObjectArray(args?.['nodes']),
    config: readObject(args?.['config']) ?? {},
    platform_payload: readObject(args?.['platform_payload']),
    revision_id: readString(args?.['revision_id']),
    dry_run: readBoolean(args?.['dry_run']),
    confirm: readBoolean(args?.['confirm']) ?? false,
  };
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
};

export const createWorkflowTool: McpTool = {
  metadata: {
    resource: 'workflows',
    operation: 'write',
    tags: ['workflows', 'hubspot', 'automation'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/workflows',
    operationId: 'public.workflows.create',
  },
  tool: {
    name: 'create_workflow',
    title: 'Create workflow',
    description:
      'Create a Sanka workflow definition or a provider workflow by passing provider=hubspot through the same workflow endpoint. For HubSpot, dry_run defaults to true unless confirm=true.',
    inputSchema: WORKFLOW_MUTATION_SCHEMA,
    outputSchema: WORKFLOW_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create workflow',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Create workflow' });
    if (authError) return authError;
    const body = mutationBody(args);
    if (body['provider'] === 'hubspot' && body['confirm'] !== true) {
      body['dry_run'] = true;
    }
    const response = (await reqContext.client.post('/api/v2/public/workflows', { body })) as Record<
      string,
      unknown
    >;
    return workflowResult(response, 'Created workflow');
  },
};

export const updateWorkflowTool: McpTool = {
  metadata: {
    resource: 'workflows',
    operation: 'write',
    tags: ['workflows', 'hubspot', 'automation'],
    httpMethod: 'patch',
    httpPath: '/api/v2/public/workflows/{workflow_id}',
    operationId: 'public.workflows.update',
  },
  tool: {
    name: 'update_workflow',
    title: 'Update workflow',
    description:
      'Update a Sanka workflow definition or a provider workflow by passing provider=hubspot through the same workflow endpoint. HubSpot updates require workflow_id or external_id as the HubSpot flow id.',
    inputSchema: {
      ...WORKFLOW_MUTATION_SCHEMA,
      required: ['workflow_id'],
      properties: {
        ...WORKFLOW_MUTATION_SCHEMA.properties,
        workflow_id: {
          type: 'string',
          description: 'Sanka workflow id, Sanka external workflow id, or HubSpot flow id.',
        },
      },
    },
    outputSchema: WORKFLOW_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update workflow',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Update workflow' });
    if (authError) return authError;
    const workflowID = readString(args?.['workflow_id']);
    if (!workflowID) return asErrorResult('`workflow_id` is required.');
    const body = mutationBody(args);
    if (body['provider'] === 'hubspot' && body['confirm'] !== true) {
      body['dry_run'] = true;
    }
    const response = (await reqContext.client.patch(
      `/api/v2/public/workflows/${encodeURIComponent(workflowID)}`,
      { body },
    )) as Record<string, unknown>;
    return workflowResult(response, 'Updated workflow');
  },
};

export const runWorkflowTool: McpTool = {
  metadata: {
    resource: 'workflows',
    operation: 'write',
    tags: ['workflows'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/workflows/{workflow_id}/run',
    operationId: 'public.workflows.run',
  },
  tool: {
    name: 'run_workflow',
    title: 'Run workflow',
    description:
      'Run an existing Sanka-native workflow definition. HubSpot workflow creation and updates use create_workflow/update_workflow with provider=hubspot.',
    inputSchema: WORKFLOW_RUN_SCHEMA,
    outputSchema: WORKFLOW_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Run workflow',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Run workflow' });
    if (authError) return authError;
    const workflowID = readString(args?.['workflow_id']);
    if (!workflowID) return asErrorResult('`workflow_id` is required.');
    const body = {
      provider: readString(args?.['provider']) ?? 'sanka',
      options: readObject(args?.['options']) ?? {},
      payload: readObject(args?.['payload']) ?? {},
    };
    const response = (await reqContext.client.post(
      `/api/v2/public/workflows/${encodeURIComponent(workflowID)}/run`,
      { body },
    )) as Record<string, unknown>;
    return workflowResult(response, 'Started workflow');
  },
};
