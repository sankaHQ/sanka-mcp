import { asErrorResult, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const SOURCE_RECORD_SCHEMA = {
  type: 'object' as const,
  properties: {
    source_system: {
      type: 'string',
      enum: ['sanka', 'hubspot'],
      description:
        'Source system for the record reference. Use sanka for Sanka records, hubspot for synced HubSpot records.',
    },
    object_type: {
      type: 'string',
      enum: ['deal'],
      default: 'deal',
      description: 'Business object type. MVP supports deal.',
    },
    record_id: {
      type: 'string',
      description: 'Sanka record UUID or numeric deal id. For hubspot, this may be the HubSpot deal id.',
    },
    external_id: {
      type: 'string',
      description: 'External platform record id, such as a HubSpot deal id.',
    },
  },
};

const WORKFLOW_TYPE_SCHEMA = {
  type: 'string',
  enum: ['deal_to_estimate'],
  description: 'Workflow type to run. MVP supports deal_to_estimate.',
};

const WORKFLOW_RUN_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    data: { type: 'object' },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
};

const RESOLVE_RECORD_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    query: {
      type: 'string',
      description: 'Company, deal, or external record text to resolve.',
    },
    object_type: {
      type: 'string',
      enum: ['deal'],
      default: 'deal',
      description: 'Business object type to resolve. MVP supports deal.',
    },
    source_system: {
      type: 'string',
      enum: ['sanka', 'hubspot'],
      description: 'Optional source filter. Omit when the user prompt is ambiguous.',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 20,
      default: 5,
      description: 'Maximum number of candidates to return.',
    },
  },
  required: ['query'],
};

const PREVIEW_WORKFLOW_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    workflow_type: WORKFLOW_TYPE_SCHEMA,
    source_record: SOURCE_RECORD_SCHEMA,
    options: {
      type: 'object',
      description: 'Optional workflow-specific controls.',
    },
  },
  required: ['workflow_type', 'source_record'],
};

const START_WORKFLOW_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    workflow_type: WORKFLOW_TYPE_SCHEMA,
    source_record: SOURCE_RECORD_SCHEMA,
    options: {
      type: 'object',
      description: 'Optional workflow-specific controls.',
    },
    idempotency_key: {
      type: 'string',
      description: 'Optional key for safely retrying the same workflow start request.',
    },
  },
  required: ['workflow_type', 'source_record'],
};

const GET_WORKFLOW_RUN_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    run_id: {
      type: 'string',
      description: 'Workflow run id returned by start_workflow.',
    },
  },
  required: ['run_id'],
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
};

const readNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
};

const readObject = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const workflowResult = (payload: Record<string, unknown>, fallbackSummary: string): ToolCallResult => {
  const data = readObject(payload['data']);
  const message = readString(payload['message']);
  const text = message ? `${fallbackSummary}: ${message}` : fallbackSummary;
  return {
    content: [{ type: 'text', text }],
    structuredContent: {
      ...payload,
      ...(data ? { data } : undefined),
    },
  };
};

const postWorkflowRunEndpoint = async ({
  reqContext,
  path,
  body,
  summary,
}: {
  reqContext: Parameters<McpTool['handler']>[0]['reqContext'];
  path: string;
  body: Record<string, unknown>;
  summary: string;
}): Promise<ToolCallResult> => {
  const authError = requireAuthentication({
    reqContext,
    toolTitle: summary,
  });
  if (authError) {
    return authError;
  }

  const response = (await reqContext.client.post(path, { body })) as Record<string, unknown>;
  return workflowResult(response, summary);
};

export const resolveRecordTool: McpTool = {
  metadata: {
    resource: 'workflow-runs',
    operation: 'read',
    tags: ['crm', 'workflow-runs', 'deals', 'estimates'],
    httpMethod: 'post',
    httpPath: '/v1/public/workflow-runs/resolve-record',
    operationId: 'public.workflowRuns.resolveRecord',
  },
  tool: {
    name: 'resolve_record',
    title: 'Resolve record',
    description:
      'Resolve an ambiguous user phrase such as a company or deal name into candidate Sanka or HubSpot-backed deal records before previewing or starting a workflow.',
    inputSchema: RESOLVE_RECORD_INPUT_SCHEMA,
    outputSchema: WORKFLOW_RUN_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Resolve record',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const query = readString(args?.['query']);
    if (!query) {
      return asErrorResult('`query` is required.');
    }
    return postWorkflowRunEndpoint({
      reqContext,
      path: '/v1/public/workflow-runs/resolve-record',
      body: {
        query,
        object_type: readString(args?.['object_type']) ?? 'deal',
        source_system: readString(args?.['source_system']),
        limit: readNumber(args?.['limit']),
      },
      summary: 'Resolved record candidates',
    });
  },
};

export const previewWorkflowTool: McpTool = {
  metadata: {
    resource: 'workflow-runs',
    operation: 'read',
    tags: ['crm', 'workflow-runs', 'deals', 'estimates'],
    httpMethod: 'post',
    httpPath: '/v1/public/workflow-runs/preview',
    operationId: 'public.workflowRuns.preview',
  },
  tool: {
    name: 'preview_workflow',
    title: 'Preview workflow',
    description:
      'Dry-run a supported business workflow. For deal_to_estimate, previews the Sanka estimate draft, copied deal totals, and whether existing approval rules require approval. Does not write records.',
    inputSchema: PREVIEW_WORKFLOW_INPUT_SCHEMA,
    outputSchema: WORKFLOW_RUN_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Preview workflow',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const sourceRecord = readObject(args?.['source_record']);
    const workflowType = readString(args?.['workflow_type']);
    if (!workflowType) {
      return asErrorResult('`workflow_type` is required.');
    }
    if (!sourceRecord) {
      return asErrorResult('`source_record` is required.');
    }
    return postWorkflowRunEndpoint({
      reqContext,
      path: '/v1/public/workflow-runs/preview',
      body: {
        workflow_type: workflowType,
        source_record: sourceRecord,
        options: readObject(args?.['options']) ?? {},
      },
      summary: 'Previewed workflow',
    });
  },
};

export const startWorkflowTool: McpTool = {
  metadata: {
    resource: 'workflow-runs',
    operation: 'write',
    tags: ['crm', 'workflow-runs', 'deals', 'estimates'],
    httpMethod: 'post',
    httpPath: '/v1/public/workflow-runs/start',
    operationId: 'public.workflowRuns.start',
  },
  tool: {
    name: 'start_workflow',
    title: 'Start workflow',
    description:
      'Start a supported business workflow. For deal_to_estimate, creates a Sanka estimate draft from the deal, applies existing estimate approval rules, creates pending approval requests when required, and stops there until approval.',
    inputSchema: START_WORKFLOW_INPUT_SCHEMA,
    outputSchema: WORKFLOW_RUN_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Start workflow',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const sourceRecord = readObject(args?.['source_record']);
    const workflowType = readString(args?.['workflow_type']);
    if (!workflowType) {
      return asErrorResult('`workflow_type` is required.');
    }
    if (!sourceRecord) {
      return asErrorResult('`source_record` is required.');
    }
    return postWorkflowRunEndpoint({
      reqContext,
      path: '/v1/public/workflow-runs/start',
      body: {
        workflow_type: workflowType,
        source_record: sourceRecord,
        options: readObject(args?.['options']) ?? {},
        idempotency_key: readString(args?.['idempotency_key']),
      },
      summary: 'Started workflow',
    });
  },
};

export const getWorkflowRunTool: McpTool = {
  metadata: {
    resource: 'workflow-runs',
    operation: 'read',
    tags: ['crm', 'workflow-runs'],
    httpMethod: 'get',
    httpPath: '/v1/public/workflow-runs/{run_id}',
    operationId: 'public.workflowRuns.retrieve',
  },
  tool: {
    name: 'get_workflow_run',
    title: 'Get workflow run',
    description:
      'Load a workflow run created by start_workflow, including created records, pending or completed approval history, and audit events.',
    inputSchema: GET_WORKFLOW_RUN_INPUT_SCHEMA,
    outputSchema: WORKFLOW_RUN_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get workflow run',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get workflow run',
    });
    if (authError) {
      return authError;
    }
    const runID = readString(args?.['run_id']);
    if (!runID) {
      return asErrorResult('`run_id` is required.');
    }
    const response = (await reqContext.client.get(
      `/v1/public/workflow-runs/${encodeURIComponent(runID)}`,
    )) as Record<string, unknown>;
    return workflowResult(response, 'Loaded workflow run');
  },
};
