// Hand-written adapters for the public Sanka Migration API (ferry-api.yaml).
// Keep migration execution and authorization in the API; never use session workspace defaults.
import Ajv from 'ajv';
import { requireAuthentication } from './tool-auth';
import { buildToolErrorResult } from './tool-result-normalizer';
import { asErrorResult, McpTool } from './types';

const workspaceId = {
  type: 'string',
  pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  description:
    'Pinned internal workspace UUID for this migration. Obtain it from list_workspaces; reuse it for every call in this migration, even if another task switches workspace.',
};
const resourceId = {
  type: 'string',
  pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$',
  description: 'Resource ID returned by the Migration API.',
};
const pagination = {
  page: { type: 'integer', minimum: 1 },
  limit: { type: 'integer', minimum: 1, maximum: 100 },
};
const ajv = new Ajv({ allErrors: true });

type MigrationToolDefinition = {
  name: string;
  title: string;
  path: string;
  description: string;
  parameters?: Record<string, object>;
  method?: 'GET' | 'POST';
  required?: string[];
  executionAction?: 'apply' | 'pause' | 'resume' | 'cancel';
};

function migrationTool(definition: MigrationToolDefinition): McpTool {
  const method = definition.method ?? 'GET';
  const readOnly = method === 'GET';
  const pathParameters = [...definition.path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]!);
  const inputSchema: McpTool['tool']['inputSchema'] = {
    type: 'object',
    properties: { workspace_id: workspaceId, ...definition.parameters },
    required: ['workspace_id', ...pathParameters, ...(definition.required ?? [])],
    additionalProperties: false,
  };
  const validate = ajv.compile(inputSchema);
  return {
    metadata: {
      resource: 'migrations',
      operation: readOnly ? 'read' : 'write',
      tags: ['migration', 'sanka-migrate'],
      httpMethod: method,
      httpPath: `/api/v2/migrate${definition.path}`,
    },
    tool: {
      name: definition.name,
      title: definition.title,
      description: `${definition.description} Always supply the pinned workspace_id. API permissions and workspace binding apply.`,
      inputSchema,
      securitySchemes: [{ type: 'oauth2', scopes: ['mcp:access'] }],
      annotations: {
        readOnlyHint: readOnly,
        destructiveHint: Boolean(definition.executionAction && definition.executionAction !== 'pause'),
        idempotentHint: readOnly,
        openWorldHint: true,
      },
    },
    handler: async ({ reqContext, args }) => {
      const authError = requireAuthentication({ reqContext, toolTitle: definition.title });
      if (authError) return authError;
      if (!validate(args)) {
        return asErrorResult(`Invalid migration arguments: ${ajv.errorsText(validate.errors)}`);
      }
      const values = args!;
      const workspace = values['workspace_id'] as string;
      const boundWorkspace = reqContext.auth?.oauth.workspace_id;
      if (boundWorkspace && boundWorkspace.toLowerCase() !== workspace.toLowerCase()) {
        return asErrorResult(
          'The requested workspace differs from the authenticated workspace. Connect Sanka to the intended workspace and retry with its pinned UUID.',
        );
      }
      const query: Record<string, unknown> = { ...values };
      const path = definition.path.replace(/\{([^}]+)\}/g, (_, key: string) => {
        delete query[key];
        return encodeURIComponent(String(values[key]));
      });
      try {
        // Stateful POSTs are never retried automatically. Inspect status after an
        // ambiguous response; apply retries must reuse the original idempotency key.
        const payload =
          readOnly ?
            await reqContext.client.get<Record<string, unknown>>(`/api/v2/migrate${path}`, { query })
          : await reqContext.client.post<Record<string, unknown>>(`/api/v2/migrate${path}`, {
              query: { workspace_id: workspace },
              ...(definition.executionAction === 'pause' || definition.executionAction === 'cancel' ?
                {}
              : {
                  body: Object.fromEntries(
                    Object.entries(query).filter(
                      ([key]) => !['workspace_id', 'confirm', 'idempotency_key'].includes(key),
                    ),
                  ),
                }),
              ...(definition.executionAction === 'apply' ?
                { headers: { 'Idempotency-Key': values['idempotency_key'] as string } }
              : {}),
              maxRetries: 0,
            });
        if (definition.executionAction) {
          const data = payload['data'];
          const migration =
            data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
          const status = typeof migration['status'] === 'string' ? migration['status'] : null;
          const knownStatuses = [
            'created',
            'inspecting',
            'planning',
            'requires_approval',
            'applying',
            'paused',
            'applied',
            'verified',
            'failed',
            'cancelled',
          ];
          const statusText = status && knownStatuses.includes(status) ? status : 'not supplied';
          return {
            content: [
              {
                type: 'text',
                text: `Migration ${definition.executionAction} API response. Current status: ${statusText}. Read get_migration with the same workspace and migration IDs to monitor progress. This response does not establish verified completion or rollback.`,
              },
            ],
            structuredContent: {
              ...payload,
              workspace_id: workspace,
              migration_id: values['migration_id'],
              migration_status: status,
              status: status ?? 'unknown',
              plan_hash: migration['plan_hash'] ?? null,
              ...(values['plan_hash'] ? { requested_plan_hash: values['plan_hash'] } : {}),
              next_tool: 'get_migration',
            },
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          structuredContent: { ...payload, workspace_id: workspace },
        };
      } catch (error) {
        const result = buildToolErrorResult(error);
        return definition.executionAction ?
            {
              ...result,
              structuredContent: {
                ...result.structuredContent,
                workspace_id: workspace,
                migration_id: values['migration_id'],
                ...(values['plan_hash'] ? { requested_plan_hash: values['plan_hash'] } : {}),
                next_tool: 'get_migration',
              },
            }
          : result;
      }
    },
  };
}

export const migrationReadTools: McpTool[] = [
  {
    name: 'list_migration_connectors',
    title: 'List migration connectors',
    path: '/connectors',
    description: 'List available migration connectors and their capabilities.',
  },
  {
    name: 'list_migration_connections',
    title: 'List migration connections',
    path: '/connections',
    description: 'List configured migration source and destination connections.',
    parameters: pagination,
  },
  {
    name: 'get_migration_connection',
    title: 'Get migration connection',
    path: '/connections/{connection_id}',
    description: 'Inspect a migration connection without returning or changing credentials.',
    parameters: { connection_id: resourceId },
  },
  {
    name: 'list_migration_program_templates',
    title: 'List migration program templates',
    path: '/program-templates',
    description: 'List templates for organizing migration programs.',
  },
  {
    name: 'list_migration_programs',
    title: 'List migration programs',
    path: '/programs',
    description: 'List migration programs in the pinned workspace.',
  },
  {
    name: 'get_migration_program',
    title: 'Get migration program',
    path: '/programs/{program_id}',
    description: 'Inspect one migration program and its progress.',
    parameters: { program_id: resourceId },
  },
  {
    name: 'list_migrations',
    title: 'List migrations',
    path: '/migrations',
    description: 'List existing data migrations and their current status.',
    parameters: pagination,
  },
  {
    name: 'get_migration',
    title: 'Get migration',
    path: '/migrations/{migration_id}',
    description: 'Inspect a data migration or poll its current status; this does not start or resume it.',
    parameters: { migration_id: resourceId },
  },
  {
    name: 'get_migration_plan',
    title: 'Get migration plan',
    path: '/migrations/{migration_id}/plan',
    description:
      'Read an existing migration plan, including its plan hash. Does not scan, generate, approve or apply a plan. A not-ready API error means the plan is not available yet.',
    parameters: { migration_id: resourceId },
  },
  {
    name: 'get_migration_verification',
    title: 'Get migration verification',
    path: '/migrations/{migration_id}/verification',
    description: 'Read an existing verification report; does not start verification.',
    parameters: { migration_id: resourceId },
  },
  {
    name: 'list_ingestion_sources',
    title: 'List ingestion sources',
    path: '/ingestion-sources',
    description: 'List migration ingestion sources and their state.',
  },
  {
    name: 'list_ingestion_batches',
    title: 'List ingestion batches',
    path: '/ingestion-sources/{source_id}/batches',
    description: 'List existing batches for a migration ingestion source; does not submit a batch.',
    parameters: { source_id: resourceId, limit: pagination.limit },
  },
  {
    name: 'get_ingestion_batch',
    title: 'Get ingestion batch',
    path: '/ingestion-sources/{source_id}/batches/{batch_id}',
    description: 'Inspect an existing ingestion batch in its source and workspace.',
    parameters: { source_id: resourceId, batch_id: resourceId },
  },
].map(migrationTool);

export const startMigrationPlanTool = migrationTool({
  name: 'start_migration_plan',
  title: 'Start migration inspection and planning',
  path: '/migrations/{migration_id}/plan',
  method: 'POST',
  description:
    'Queue source inventory inspection and dry-run planning for an existing data migration. This changes migration planning state and may consume the workspace planning quota, but does not write destination records, approve or apply a plan. The response may be queued rather than complete: poll get_migration and then read get_migration_plan with the same workspace_id and migration_id. Reuse existing plans by default; set force=true only when a fresh scan and re-plan is explicitly requested. After a timeout or service error, inspect get_migration before submitting again. API state guards reject planning after transfer has begun.',
  parameters: {
    migration_id: resourceId,
    sample_size: {
      type: 'integer',
      minimum: 1,
      default: 10,
      description: 'Sample size for dry-run planning. Omit to use the API default of 10.',
    },
    force: {
      type: 'boolean',
      default: false,
      description:
        'Force a fresh source scan and plan, replacing prior planning evidence. Use only for an explicitly requested re-plan; defaults to false.',
    },
  },
});

const confirmation = {
  type: 'boolean',
  const: true,
  description:
    'Set true only after the user explicitly authorizes this action for the specified workspace, migration, and (for apply/resume) reviewed plan hash and route scope. Never infer authorization from a request to inspect or plan.',
};
const reviewedPlanHash = {
  type: 'string',
  minLength: 1,
  pattern: '^\\S+$',
  description:
    'Exact reviewed plan_hash from get_migration_plan. Never substitute a newer hash automatically after an API mismatch.',
};

const executionDefinitions: MigrationToolDefinition[] = [
  {
    name: 'apply_migration',
    title: 'Apply reviewed migration plan',
    path: '/migrations/{migration_id}/apply',
    method: 'POST',
    executionAction: 'apply',
    required: ['plan_hash', 'idempotency_key', 'confirm'],
    description:
      'Start destination writes for the reviewed migration plan only after explicit user confirmation of the workspace, migration, plan hash and selected routes. Requires confirm=true, the reviewed plan_hash and a stable idempotency_key. Omit routes only when the user approved all planned routes. A queued/applying response is not completion; poll get_migration. After a timeout inspect status first and, if retrying the identical apply, reuse the same idempotency key and payload. Never automatically replace a rejected hash or retry with a new key.',
    parameters: {
      migration_id: resourceId,
      plan_hash: reviewedPlanHash,
      confirm: confirmation,
      idempotency_key: {
        type: 'string',
        minLength: 8,
        maxLength: 200,
        pattern: '^[!-~]+$',
        description:
          'Stable unique key for this approved apply request (8–200 printable ASCII characters without spaces). Sent as Idempotency-Key. Reuse it with the identical payload after uncertain outcomes; never generate a new key just to bypass a conflict.',
      },
      routes: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        uniqueItems: true,
        items: { type: 'string', minLength: 1, pattern: '\\S' },
        description:
          'Explicit approved route keys from the plan. Omission applies all planned routes; empty/null selections are rejected to prevent accidental broadening.',
      },
    },
  },
  {
    name: 'pause_migration',
    title: 'Pause migration',
    path: '/migrations/{migration_id}/pause',
    method: 'POST',
    executionAction: 'pause',
    required: ['confirm'],
    description:
      'Pause an active migration after explicit user authorization. Stops its active job while preserving checkpoints for resume. Does not roll back records already written. No automatic retries; inspect get_migration after an uncertain response.',
    parameters: { migration_id: resourceId, confirm: confirmation },
  },
  {
    name: 'resume_migration',
    title: 'Resume reviewed migration',
    path: '/migrations/{migration_id}/resume',
    method: 'POST',
    executionAction: 'resume',
    required: ['plan_hash', 'confirm'],
    description:
      'Resume destination writes from durable checkpoints after explicit user authorization of the reviewed plan hash. Requires confirm=true and plan_hash. The API revalidates the plan and preserves the previous route selection; this tool cannot change routes. No automatic retries. Poll get_migration and inspect state before resubmitting after a timeout.',
    parameters: { migration_id: resourceId, plan_hash: reviewedPlanHash, confirm: confirmation },
  },
  {
    name: 'cancel_migration',
    title: 'Cancel migration',
    path: '/migrations/{migration_id}/cancel',
    method: 'POST',
    executionAction: 'cancel',
    required: ['confirm'],
    description:
      'Terminally cancel a migration after explicit user authorization. Stops an active job and preserves its transfer evidence; already-written destination records remain and are not rolled back. Use pause_migration when the user wants a resumable stop. No automatic retries; inspect get_migration after an uncertain response.',
    parameters: { migration_id: resourceId, confirm: confirmation },
  },
];

export const migrationExecutionTools = executionDefinitions.map(migrationTool);
