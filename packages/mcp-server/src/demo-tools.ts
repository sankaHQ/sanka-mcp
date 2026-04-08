// Hand-written Phase 5 tools for the /v1/demo/generate and
// /v1/integration-sync/push endpoints. Kept separate from the Stainless-
// generated code so they survive the next regeneration pass.

import type Sanka from 'sanka-sdk';
import { McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

// Re-export the generated types via the Sanka namespace so we don't need to
// reach into subpath modules (which do not resolve under moduleResolution:node).
type DemoGenerateParams = Sanka.DemoGenerateParams;
type DemoGenerateResponse = Sanka.DemoGenerateResponse;
type IntegrationSyncPushParams = Sanka.IntegrationSyncPushParams;
type IntegrationSyncPushResponse = Sanka.IntegrationSyncPushResponse;

const SUPPORTED_TEMPLATES = ['b2b_saas', 'dtc_subscription', 'agency_services'] as const;
const SUPPORTED_COUNTRIES = ['us', 'jp'] as const;

const DEMO_GENERATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    template: {
      type: 'string',
      description:
        'Demo template slug. Use "b2b_saas" for horizontal B2B SaaS, "dtc_subscription" for a direct-to-consumer subscription brand, or "agency_services" for a boutique creative/digital agency.',
      enum: [...SUPPORTED_TEMPLATES],
    },
    country: {
      type: 'string',
      description:
        'ISO country code (lowercase). Drives localized company/contact/item copy and the billing currency. Supported: "us" (USD) and "jp" (JPY).',
      enum: [...SUPPORTED_COUNTRIES],
    },
    workspace_id: {
      type: 'string',
      description:
        'Optional existing workspace UUID to seed into. When omitted, a brand new free-tier workspace owned by the caller is provisioned.',
    },
    seed: {
      type: 'integer',
      description: 'Optional seed for the deterministic random selections. Useful for replayable demos.',
      minimum: 0,
    },
  },
  required: ['template', 'country'],
};

const DEMO_GENERATE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    workspace_id: { type: 'string' },
    workspace_name: { type: 'string' },
    workspace_short_id: { type: ['integer', 'null'] as any },
    template: { type: 'string' },
    country: { type: 'string' },
    seed: { type: 'integer' },
    created: { type: 'boolean' },
    counts: {
      type: 'object',
      additionalProperties: { type: 'integer' },
    },
    sample_record_ids: {
      type: 'object',
      additionalProperties: { type: 'array', items: { type: 'string' } },
    },
    message: { type: 'string' },
  },
  required: [
    'workspace_id',
    'workspace_name',
    'template',
    'country',
    'seed',
    'created',
    'counts',
    'sample_record_ids',
    'message',
  ],
};

const INTEGRATION_SYNC_PUSH_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    channel_id: {
      type: 'string',
      description:
        'UUID of the destination integration channel setting (e.g. the HubSpot channel connection).',
    },
    object_type: {
      type: 'string',
      description: 'Object type to push to the destination channel, e.g. "company", "contact", "deal".',
    },
    record_ids: {
      type: 'array',
      description: 'Explicit list of record UUIDs to push. Mutually exclusive with workspace_scope.',
      items: { type: 'string' },
    },
    workspace_scope: {
      type: 'string',
      description:
        'Use "all" to push every eligible record in the workspace. Mutually exclusive with record_ids.',
      enum: ['all'],
    },
    operation: {
      type: 'string',
      description: 'Destination operation to perform. Defaults to "update".',
      default: 'update',
    },
    custom_object_id: {
      type: 'string',
      description: 'Optional custom object id when object_type is "custom".',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of records to emit in one call. Defaults to 200.',
      minimum: 1,
      maximum: 1000,
      default: 200,
    },
  },
  required: ['channel_id', 'object_type'],
};

const INTEGRATION_SYNC_PUSH_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    channel_id: { type: 'string' },
    object_type: { type: 'string' },
    operation: { type: 'string' },
    requested_count: { type: 'integer' },
    emitted_event_ids: { type: 'array', items: { type: 'string' } },
    skipped_count: { type: 'integer' },
    message: { type: 'string' },
  },
  required: [
    'channel_id',
    'object_type',
    'operation',
    'requested_count',
    'emitted_event_ids',
    'skipped_count',
    'message',
  ],
};

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const readNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const readStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result = value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
  );
  return result.length > 0 ? result : undefined;
};

const buildDemoSummary = (response: DemoGenerateResponse): string => {
  const parts: string[] = [];
  parts.push(
    response.created ?
      `Created new demo workspace "${response.workspace_name}"`
    : `Seeded existing workspace "${response.workspace_name}"`,
  );
  parts.push(
    `with ${response.counts?.['companies'] ?? 0} companies, ${response.counts?.['contacts'] ?? 0} contacts, ${
      response.counts?.['deals'] ?? 0
    } deals, ${response.counts?.['subscriptions'] ?? 0} subscriptions, ${
      response.counts?.['invoices'] ?? 0
    } invoices, ${response.counts?.['receipts'] ?? 0} receipts.`,
  );
  return parts.join(' ');
};

const buildPushSummary = (response: IntegrationSyncPushResponse): string => {
  const emitted = response.emitted_event_ids?.length ?? 0;
  return `Queued ${emitted} outbound ${response.object_type} event${emitted === 1 ? '' : 's'} (requested ${
    response.requested_count
  }, skipped ${response.skipped_count}).`;
};

export const demoGenerateTool: McpTool = {
  metadata: {
    resource: 'demo',
    operation: 'write',
    tags: ['demo', 'onboarding'],
    httpMethod: 'post',
    httpPath: '/v1/demo/generate',
    operationId: 'demo.generate.create',
  },
  tool: {
    name: 'generate_demo_workspace',
    title: 'Generate demo workspace',
    description:
      'Seed a Sanka workspace with a curated lead-to-cash demo (companies, contacts, items, deals, subscriptions, invoices, receipts). Use this when the user asks for an instant demo workspace or a reproducible sandbox. When the user has no workspace yet, omit workspace_id to auto-provision one.',
    inputSchema: DEMO_GENERATE_INPUT_SCHEMA,
    outputSchema: DEMO_GENERATE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Generate demo workspace',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }): Promise<ToolCallResult> => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Generate demo workspace',
    });
    if (authError) {
      return authError;
    }

    const template = readString(args?.['template']);
    const country = readString(args?.['country']);
    if (!template || !country) {
      return {
        content: [
          {
            type: 'text',
            text: 'Both "template" and "country" are required to generate a demo workspace.',
          },
        ],
        isError: true,
      };
    }

    const body: DemoGenerateParams = {
      template,
      country,
    };
    const workspaceId = readString(args?.['workspace_id']);
    if (workspaceId) {
      body.workspace_id = workspaceId;
    }
    const seed = readNumber(args?.['seed']);
    if (seed !== undefined) {
      body.seed = Math.trunc(seed);
    }

    const response = await reqContext.client.demo.generate(body);

    return {
      content: [
        {
          type: 'text',
          text: buildDemoSummary(response),
        },
      ],
      structuredContent: {
        workspace_id: response.workspace_id,
        workspace_name: response.workspace_name,
        workspace_short_id: response.workspace_short_id ?? null,
        template: response.template,
        country: response.country,
        seed: response.seed,
        created: response.created,
        counts: response.counts ?? {},
        sample_record_ids: response.sample_record_ids ?? {},
        message: response.message,
      },
    };
  },
};

export const integrationSyncPushTool: McpTool = {
  metadata: {
    resource: 'integration_sync',
    operation: 'write',
    tags: ['integration-sync', 'outbound'],
    httpMethod: 'post',
    httpPath: '/v1/integration-sync/push',
    operationId: 'integration_sync.push.create',
  },
  tool: {
    name: 'push_integration_sync',
    title: 'Push records to integration channel',
    description:
      'Emit outbound integration sync events for a set of records so they flow to a connected destination (e.g. HubSpot). Use this after generating demo data or after a user manually edits records and wants to push the changes downstream. Prefer explicit record_ids; use workspace_scope="all" only when the user asks to push everything in the workspace.',
    inputSchema: INTEGRATION_SYNC_PUSH_INPUT_SCHEMA,
    outputSchema: INTEGRATION_SYNC_PUSH_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Push records to integration channel',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }): Promise<ToolCallResult> => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Push records to integration channel',
    });
    if (authError) {
      return authError;
    }

    const channelId = readString(args?.['channel_id']);
    const objectType = readString(args?.['object_type']);
    if (!channelId || !objectType) {
      return {
        content: [
          {
            type: 'text',
            text: 'Both "channel_id" and "object_type" are required to push records.',
          },
        ],
        isError: true,
      };
    }

    const recordIds = readStringArray(args?.['record_ids']);
    const workspaceScope = readString(args?.['workspace_scope']);
    if (!recordIds && !workspaceScope) {
      return {
        content: [
          {
            type: 'text',
            text: 'Provide either "record_ids" (an explicit list) or "workspace_scope=all" to push every eligible record.',
          },
        ],
        isError: true,
      };
    }
    if (recordIds && workspaceScope) {
      return {
        content: [
          {
            type: 'text',
            text: '"record_ids" and "workspace_scope" are mutually exclusive — pick one.',
          },
        ],
        isError: true,
      };
    }

    const body: IntegrationSyncPushParams = {
      channel_id: channelId,
      object_type: objectType,
    };
    if (recordIds) {
      body.record_ids = recordIds;
    }
    if (workspaceScope) {
      body.workspace_scope = workspaceScope;
    }
    const operation = readString(args?.['operation']);
    if (operation) {
      body.operation = operation;
    }
    const customObjectId = readString(args?.['custom_object_id']);
    if (customObjectId) {
      body.custom_object_id = customObjectId;
    }
    const limit = readNumber(args?.['limit']);
    if (limit !== undefined) {
      body.limit = Math.trunc(limit);
    }

    const response = await reqContext.client.integrationSync.push(body);

    return {
      content: [
        {
          type: 'text',
          text: buildPushSummary(response),
        },
      ],
      structuredContent: {
        channel_id: response.channel_id,
        object_type: response.object_type,
        operation: response.operation,
        requested_count: response.requested_count,
        emitted_event_ids: response.emitted_event_ids ?? [],
        skipped_count: response.skipped_count,
        message: response.message,
      },
    };
  },
};
