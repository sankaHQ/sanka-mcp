// Hand-written demo and integration-sync tools, kept apart from the Stainless-generated code so
// they survive the next regeneration pass.
//
// generate_demo_workspace builds a NEW Free demo workspace with a case's fictional data for Sanka
// Desk, Sanka Flow, Sanka Monitor or Sanka Migrate, owned by the Sanka member who asks, with the
// Sanka colleagues they name as its admins too (sanka-api docs/specs/demo-workspaces/README.md). It
// never writes into an existing workspace.

import { envelopeData, readApiFailure } from './desk-tools';
import { readRecord } from './tool-factories';
import { McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

import type Sanka from 'sanka-sdk';

type IntegrationSyncPushParams = Sanka.IntegrationSyncPushParams;
type IntegrationSyncPushResponse = Sanka.IntegrationSyncPushResponse;
type JsonRecord = Record<string, unknown>;

const DEMO_WORKSPACES_PATH = '/api/v2/demo-workspaces';
const DEMO_ACTIONS = ['cases', 'build', 'status', 'list', 'extend', 'end'] as const;
const DEMO_PRODUCTS = ['desk', 'flow', 'monitor', 'migrate'] as const;
const MAX_DEMO_COLLEAGUES = 5;

const DEMO_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    action: {
      type: 'string',
      description:
        'What to do: "cases" lists the cases a demo can be built from; "build" starts a new demo workspace; "status" reads one back (its link and demo script once ready); "list" shows the person\'s demos and limits; "extend" adds 30 days (up to 90); "end" ends one now (view-only at once, deleted after 7 days). Use "end" only when the person asks.',
      enum: [...DEMO_ACTIONS],
      default: 'build',
    },
    product: {
      type: 'string',
      description: 'The product the demo shows (action "build").',
      enum: [...DEMO_PRODUCTS],
    },
    case: {
      type: 'string',
      description:
        'The case key from action "cases", for example "bpo_windows10_shadow_ai" (Monitor), "manufacturing" (Flow), "it_helpdesk_google" (Desk) or "salesforce_to_hubspot" (Migrate, a pair of systems in one direction).',
    },
    language: {
      type: 'string',
      description: "The demo's language. Empty takes the case's.",
      enum: ['en', 'ja'],
    },
    currency: {
      type: 'string',
      description: 'ISO 4217 code such as USD, JPY or PHP. Empty is USD in English and JPY in Japanese.',
      pattern: '^[A-Z]{3}$',
    },
    timezone: {
      type: 'string',
      description: "An IANA time zone such as Asia/Manila. Empty takes the case's.",
    },
    size: {
      type: 'integer',
      description: "How many PCs a Monitor demo has, within the case's bounds.",
      minimum: 1,
      maximum: 1000,
    },
    colleagues: {
      type: 'array',
      description:
        'E-mail addresses of Sanka colleagues to add to the demo as its admins (action "build"), only when the person names them. Each must be a member of Sanka\'s own workspace; they are added directly and get no e-mail.',
      items: { type: 'string' },
      maxItems: MAX_DEMO_COLLEAGUES,
    },
    demo_id: {
      type: 'string',
      description: 'The demo to read, extend or end (actions "status", "extend", "end").',
    },
    client_key: {
      type: 'string',
      description: 'Optional key that makes a retried "build" return the first one instead of a second demo.',
      minLength: 8,
      maxLength: 100,
    },
  },
};

const DEMO_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    action: { type: 'string' },
    demo: { type: ['object', 'null'] as any },
    demos: { type: 'array', items: { type: 'object' } },
    limits: { type: ['object', 'null'] as any },
    cases: { type: 'array', items: { type: 'object' } },
    message: { type: 'string' },
  },
  required: ['action', 'message'],
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
      description:
        'Object type to push to the destination channel. HubSpot channels support "contact", "company", "deal", "ticket", and "custom_object"; other pairs are rejected with INTEGRATION_EXPORT_NOT_SUPPORTED. When object_type is "custom_object", pass custom_object_id.',
      enum: ['contact', 'company', 'deal', 'ticket', 'custom_object'],
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
      description: 'Required custom object id when object_type is "custom_object".',
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

const DEMO_HINTS: Record<string, string> = {
  DEMO_WORKSPACES_SANKA_MEMBERS_ONLY:
    "Only members of Sanka's own workspace can build demo workspaces. A prospect signs up for Sanka themselves.",
  DEMO_WORKSPACES_OFF: 'Demo workspaces are switched off. Ask Sanka to turn them on.',
  DEMO_WORKSPACES_LIVE_LIMIT: 'End one of the person\'s demos (action "end") before building another.',
  DEMO_WORKSPACES_MONTH_LIMIT: 'The person has built as many demos as a month allows.',
  DEMO_CASE_UNKNOWN: 'Call this tool with action "cases" and pick one of them.',
  DEMO_COLLEAGUES_SANKA_MEMBERS_ONLY:
    "Only members of Sanka's own workspace can be added to a demo. Check the addresses in details.emails with the person, or build without them.",
};

// A 4xx answer with a code changed nothing; anything else is left to the server's error handling.
const demoErrorResult = (error: unknown, lead: string): ToolCallResult | undefined => {
  const failure = readApiFailure(error);
  if (!failure || (failure.status !== undefined && failure.status >= 500)) return undefined;
  const hint = DEMO_HINTS[failure.code];
  return {
    content: [
      { type: 'text', text: `${lead} (${failure.code}): ${failure.message}${hint ? ` ${hint}` : ''}` },
    ],
    isError: true,
    structuredContent: {
      action: 'error',
      code: failure.code,
      message: failure.message,
      details: failure.details,
    },
  };
};

const inputError = (text: string): ToolCallResult => ({
  content: [{ type: 'text', text }],
  isError: true,
});

const demoLine = (demo: JsonRecord): string => {
  const workspace = readRecord(demo['workspace']);
  const name = readString(workspace?.['name']) ?? '(not created yet)';
  return `- ${readString(demo['id'])} ${readString(demo['product'])}/${readString(
    demo['case'],
  )}: ${readString(demo['status'])}, ${name}`;
};

const demoText = (demo: JsonRecord): string => {
  const status = readString(demo['status']) ?? '';
  const id = readString(demo['id']) ?? '';
  if (status === 'ready') {
    const script = readString(demo['script']);
    const ends = readString(demo['expires_at']);
    const admins = readStringArray(demo['colleagues_added']);
    return [
      `The demo workspace is ready: ${readString(demo['link']) ?? ''}`,
      admins ? `Also its admins: ${admins.join(', ')} (no e-mail was sent).` : '',
      script ?? '',
      ends ? `It turns view-only on ${ends.slice(0, 10)} (UTC). demo_id: ${id}` : `demo_id: ${id}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  if (status === 'queued' || status === 'building') {
    return `The demo workspace is being built (demo_id: ${id}). It takes a minute or two: call generate_demo_workspace with action "status" and this demo_id for its link and demo script.`;
  }
  if (status === 'failed') {
    return `The demo build failed at ${readString(demo['error_step']) ?? 'an unknown step'} (${
      readString(demo['error_code']) ?? 'no code'
    }). Its workspace is being deleted; build again.`;
  }
  return `The demo is ${status} (demo_id: ${id}).`;
};

const demoBody = (args: JsonRecord | undefined): JsonRecord => {
  const body: JsonRecord = {
    product: readString(args?.['product']),
    case: readString(args?.['case']),
  };
  for (const key of ['language', 'currency', 'timezone', 'client_key']) {
    const value = readString(args?.[key]);
    if (value) body[key] = value;
  }
  const size = readNumber(args?.['size']);
  if (size !== undefined) body['size'] = Math.trunc(size);
  const colleagues = readStringArray(args?.['colleagues']);
  if (colleagues) body['colleagues'] = colleagues.map((email) => email.trim());
  return body;
};

export const demoGenerateTool: McpTool = {
  metadata: {
    resource: 'demo_workspaces',
    operation: 'write',
    tags: ['demo', 'sales-enablement'],
    httpMethod: 'post',
    httpPath: DEMO_WORKSPACES_PATH,
    operationId: 'demo_workspaces.create',
  },
  tool: {
    name: 'generate_demo_workspace',
    title: 'Generate demo workspace',
    description:
      'Build a NEW demo workspace on the Free plan, filled with a case\'s fictional data, for a Sanka Desk, Sanka Flow, Sanka Monitor or Sanka Migrate demo. Only members of Sanka\'s own workspace can use it; the person who asks owns the workspace, and Sanka colleagues they name become its admins too. It never writes into an existing workspace, connects no real account and pays for nothing: a Migrate demo runs between Sanka\'s own demo systems and stops at the free dry run. List the cases first (action "cases"), build (action "build"), then read it back (action "status") for its link and demo script. A demo lives 30 days; "extend" adds 30, "end" ends it now.',
    inputSchema: DEMO_INPUT_SCHEMA,
    outputSchema: DEMO_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Generate demo workspace',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }): Promise<ToolCallResult> => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Generate demo workspace' });
    if (authError) {
      return authError;
    }
    const client = reqContext.client;
    const action = readString(args?.['action']) ?? 'build';
    const demoId = readString(args?.['demo_id']);
    try {
      if (action === 'cases') {
        const language = readString(args?.['language']);
        const data = envelopeData(
          await client.get(`${DEMO_WORKSPACES_PATH}/cases`, language ? { query: { language } } : {}),
        );
        const cases = Array.isArray(data['cases']) ? (data['cases'] as JsonRecord[]) : [];
        const lines = cases.map(
          (entry) =>
            `- ${readString(entry['product'])} / ${readString(entry['key'])}: ${readString(entry['title'])}`,
        );
        return {
          content: [{ type: 'text', text: ['Demo cases:', ...lines].join('\n') }],
          structuredContent: { action, cases, message: `${cases.length} cases` },
        };
      }
      if (action === 'list') {
        const data = envelopeData(await client.get(DEMO_WORKSPACES_PATH));
        const demos = Array.isArray(data['demos']) ? (data['demos'] as JsonRecord[]) : [];
        const limits = readRecord(data['limits']) ?? null;
        const text = demos.length ? demos.map(demoLine).join('\n') : 'No demo workspaces yet.';
        return {
          content: [{ type: 'text', text }],
          structuredContent: { action, demos, limits, message: `${demos.length} demos` },
        };
      }
      if (action === 'build') {
        const body = demoBody(args);
        if (!body['product'] || !body['case']) {
          return inputError(
            'Both "product" and "case" are needed to build a demo. List the cases with action "cases".',
          );
        }
        const demo = envelopeData(await client.post(DEMO_WORKSPACES_PATH, { body }));
        return {
          content: [{ type: 'text', text: demoText(demo) }],
          structuredContent: { action, demo, message: readString(demo['status']) ?? '' },
        };
      }
      if (action === 'status' || action === 'extend' || action === 'end') {
        if (!demoId) {
          return inputError(`"demo_id" is needed to ${action} a demo. List them with action "list".`);
        }
        const path = `${DEMO_WORKSPACES_PATH}/${encodeURIComponent(demoId)}`;
        const demo = envelopeData(
          action === 'status' ? await client.get(path) : await client.post(`${path}/${action}`, { body: {} }),
        );
        return {
          content: [{ type: 'text', text: demoText(demo) }],
          structuredContent: { action, demo, message: readString(demo['status']) ?? '' },
        };
      }
      return inputError(`Unknown action "${action}". Use one of: ${DEMO_ACTIONS.join(', ')}.`);
    } catch (error) {
      const result = demoErrorResult(error, 'The demo workspace request was refused');
      if (result) return result;
      throw error;
    }
  },
};

const buildPushSummary = (response: IntegrationSyncPushResponse): string => {
  const emitted = response.emitted_event_ids?.length ?? 0;
  return `Queued ${emitted} outbound ${response.object_type} event${emitted === 1 ? '' : 's'} (requested ${
    response.requested_count
  }, skipped ${response.skipped_count}).`;
};

export const integrationSyncPushTool: McpTool = {
  metadata: {
    resource: 'integration_sync',
    operation: 'write',
    tags: ['integration-sync', 'outbound'],
    httpMethod: 'post',
    httpPath: '/api/v2/integration-sync/push',
    operationId: 'integration_sync.push.create',
  },
  tool: {
    name: 'push_integration_sync',
    title: 'Push records to integration channel',
    description:
      'Emit outbound integration sync events for a set of records so they flow to a connected destination (e.g. HubSpot). Use this after generating demo data or after a user manually edits records and wants to push the changes downstream. Prefer explicit record_ids; use workspace_scope="all" only when the user asks to push everything in the workspace. Native outbound delivery currently supports HubSpot channels with object_type "contact", "company", "deal", "ticket", or "custom_object"; custom_object pushes require custom_object_id. Other provider/object pairs are rejected with HTTP 400 and error code INTEGRATION_EXPORT_NOT_SUPPORTED — do not retry those, the pair has no working delivery pipeline yet. HTTP 503 with error code JOB_QUEUE_UNAVAILABLE means the dispatch queue is temporarily unavailable; retry later.',
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
