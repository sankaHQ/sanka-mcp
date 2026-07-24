// Hand-written transfer tools for the public import/export job endpoints.

import { File } from 'node:buffer';
import type Sanka from 'sanka-sdk';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpTool, ToolCallResult } from './types';

type ImportCreateParams = Sanka.Public.ImportCreateParams;
type ImportListParams = Sanka.Public.ImportListParams;
type ImportUploadFileParams = Sanka.Public.ImportUploadFileParams;
type TransferJob = Sanka.Public.TransferJob;
type TransferUploadFileResponse = Sanka.Public.TransferUploadFileResponse;
type ExportCreateParams = Sanka.Public.ExportCreateParams;
type ExportListParams = Sanka.Public.ExportListParams;
type IntegrationChannelsListParams = Sanka.Public.IntegrationChannelsListParams;
type IntegrationChannelsListResponse = Sanka.Public.IntegrationChannelsListResponse;

const IMPORT_UPLOAD_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: {
      type: 'string',
      description: 'Target object type for the import file upload. Currently supports only "item".',
      enum: ['item'],
      default: 'item',
    },
    filename: {
      type: 'string',
      description: 'Original filename to preserve on the uploaded import file.',
    },
    content_base64: {
      type: 'string',
      description:
        'Base64-encoded file content. Data URI format is also accepted (for example data:text/csv;base64,...).',
    },
    mime_type: {
      type: 'string',
      description: 'Optional MIME type override for the uploaded file.',
    },
  },
  required: ['filename', 'content_base64'],
};

const IMPORT_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: {
      type: 'string',
      description:
        'Object type to import. Use "item" for CSV file imports or "order" to import HubSpot deals as Sanka Orders.',
      enum: ['item', 'order'],
      default: 'item',
    },
    file_id: {
      type: 'string',
      description: 'Temporary file id returned by upload_import_file.',
    },
    source_kind: {
      type: 'string',
      description:
        'Import source kind. Use "file" for item CSV or "integration" for HubSpot deal-to-order imports.',
      enum: ['file', 'integration'],
      default: 'file',
    },
    provider: {
      type: 'string',
      description: 'Source provider for integration imports. Required when object_type="order".',
      enum: ['hubspot'],
    },
    channel_id: {
      type: 'string',
      description: 'Optional source integration channel id for HubSpot deal imports.',
    },
    record_ids: {
      type: 'array',
      description: 'HubSpot Deal ids to import as Sanka Orders when source_kind="integration".',
      items: { type: 'string' },
    },
    source_record: {
      type: 'object',
      description: 'Optional source record reference for a single integration import.',
      additionalProperties: true,
    },
    file_format: {
      type: 'string',
      description: 'Import file format. Currently supports only "csv".',
      enum: ['csv'],
      default: 'csv',
    },
    operation: {
      type: 'string',
      description:
        'Import mode. Use "create" for insert-only, "update" for update-only, or "upsert" to create and update.',
      enum: ['create', 'update', 'upsert'],
      default: 'upsert',
    },
    mapping_mode: {
      type: 'string',
      description: 'How column mappings should be resolved. Defaults to "auto".',
      enum: ['auto', 'manual'],
      default: 'auto',
    },
    key_field: {
      type: 'string',
      description: 'Reference field used for update or upsert imports.',
    },
    column_mappings: {
      type: 'array',
      description: 'Optional manual header-to-field mappings.',
      items: {
        type: 'object',
        properties: {
          source_header: { type: 'string' },
          target_field: { type: 'string' },
        },
        required: ['source_header', 'target_field'],
      },
    },
    dry_run: {
      type: 'boolean',
      description: 'Validate the import without creating or updating records.',
      default: false,
    },
  },
};

const JOB_LOOKUP_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    job_id: {
      type: 'string',
      description: 'Transfer job identifier returned by import_records or export_records.',
    },
  },
  required: ['job_id'],
};

const IMPORT_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: {
      type: 'string',
      description: 'Optional import job filter.',
      enum: ['item', 'order'],
      default: 'item',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of jobs to return.',
      minimum: 1,
      maximum: 200,
      default: 50,
    },
  },
};

const INTEGRATION_CHANNELS_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: {
      type: 'string',
      description:
        'Object type you plan to export. For export_records integration jobs, runnable pairs are company/contact/deal with hubspot and item/order with hubspot or nextengine. For invoice or Bill accounting export, this only discovers accounting channel_id candidates; preview_workflow/start_workflow with workflow_type=invoice_export or bill_export determines actual readiness.',
      enum: ['company', 'contact', 'deal', 'item', 'order', 'invoice', 'bill'],
      default: 'deal',
    },
    provider: {
      type: 'string',
      description:
        'Optional destination provider filter. Use hubspot for company/contact/deal/item/order integration exports, nextengine for item/order integration exports, freee/moneyforward to discover invoice_export channels, and quickbooks-online to discover invoice_export or bill_export channels.',
      enum: ['hubspot', 'nextengine', 'freee', 'moneyforward', 'quickbooks-online'],
      default: 'hubspot',
    },
  },
};

const EXPORT_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: {
      type: 'string',
      description:
        'Object type to export with destination_kind="integration". Runnable pairs are company/contact/deal with provider="hubspot" and item/order with provider="hubspot" or provider="nextengine". Invoice accounting exports are not created by export_records; use preview_workflow/start_workflow with workflow_type=invoice_export.',
      enum: ['company', 'contact', 'deal', 'item', 'order'],
      default: 'deal',
    },
    destination_kind: {
      type: 'string',
      description:
        'Destination kind for this tool. export_records creates integration-destination export jobs; Invoice/Bill accounting sync and file/CSV exports are rejected by this endpoint.',
      enum: ['integration'],
      default: 'integration',
    },
    provider: {
      type: 'string',
      description:
        'Destination integration provider. Runnable pairs: hubspot supports company/contact/deal/item/order; nextengine supports item/order. Other provider/object pairs are API-rejected with INTEGRATION_EXPORT_NOT_SUPPORTED or INTEGRATION_EXPORT_UNKNOWN_PROVIDER.',
      enum: ['hubspot', 'nextengine'],
      default: 'hubspot',
    },
    target_system: {
      type: 'string',
      description:
        'Legacy accounting target alias. Do not use with export_records; accounting exports must use preview_workflow/start_workflow with workflow_type=invoice_export or bill_export.',
      enum: ['freee', 'moneyforward'],
    },
    channel_id: {
      type: 'string',
      description: 'Destination channel id from list_integration_channels.',
    },
    record_ids: {
      type: 'array',
      description: 'Explicit list of record ids to export.',
      items: { type: 'string' },
    },
    workspace_scope: {
      type: 'string',
      description: 'Use "all" to export every eligible record in the workspace.',
      enum: ['all'],
    },
    operation: {
      type: 'string',
      description: 'Export operation to perform at the destination.',
      enum: ['create', 'update'],
      default: 'update',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of records to export in one call.',
      minimum: 1,
      maximum: 500,
      default: 200,
    },
    dry_run: {
      type: 'boolean',
      description: 'Validate the export selection without enqueuing outbound sync events.',
      default: false,
    },
  },
  required: ['channel_id'],
};

const JOB_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    job_id: { type: 'string' },
    job_type: { type: 'string' },
    object_type: { type: 'string' },
    status: { type: 'string' },
    mode: { type: ['string', 'null'] as any },
    started_async: { type: 'boolean' },
    source_kind: { type: ['string', 'null'] as any },
    destination_kind: { type: ['string', 'null'] as any },
    file_format: { type: ['string', 'null'] as any },
    file_id: { type: ['string', 'null'] as any },
    filename: { type: ['string', 'null'] as any },
    provider: { type: ['string', 'null'] as any },
    channel_id: { type: ['string', 'null'] as any },
    workspace_scope: { type: ['string', 'null'] as any },
    message: { type: ['string', 'null'] as any },
    error_message: { type: ['string', 'null'] as any },
    error_file_url: { type: ['string', 'null'] as any },
    summary: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['job_id', 'job_type', 'object_type', 'status', 'summary'],
};

const JOB_LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    jobs: {
      type: 'array',
      items: JOB_OUTPUT_SCHEMA,
    },
    message: { type: 'string' },
  },
  required: ['jobs', 'message'],
};

const EXPORT_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: {
      type: 'string',
      description:
        'Optional export job filter. Supports the public export object aliases accepted by the API.',
      enum: ['company', 'contact', 'deal', 'item', 'order', 'invoice'],
      default: 'deal',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of jobs to return.',
      minimum: 1,
      maximum: 200,
      default: 50,
    },
  },
};

const JOB_RETRY_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    job: JOB_OUTPUT_SCHEMA,
    retry_of_job_id: { type: 'string' },
    message: { type: ['string', 'null'] as any },
  },
  required: ['job', 'retry_of_job_id'],
};

const CHANNELS_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    channels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          channel_id: { type: 'string' },
          provider: { type: 'string' },
          channel_name: { type: 'string' },
          export_ready: { type: 'boolean' },
          export_blocker_reason: { type: ['string', 'null'] as any },
          export_blocker_reasons: {
            type: 'array',
            items: { type: 'string' },
          },
          is_export_blocked: { type: 'boolean' },
          invoice_export_channel_id: { type: 'string' },
          accounting_invoice_export_candidate: { type: 'boolean' },
          invoice_export_readiness_signal: { type: 'string' },
          readiness_guidance: { type: 'string' },
          shadow_mode: { type: 'boolean' },
          rollout_stage: { type: 'string' },
        },
        additionalProperties: true,
      },
    },
    requested_object_type: { type: 'string' },
    requested_provider: { type: 'string' },
    has_export_ready_channel: { type: 'boolean' },
    export_ready_count: { type: 'integer' },
    blocked_count: { type: 'integer' },
    blocked_by_shadow_mode: { type: 'boolean' },
    readiness_guidance: { type: 'string' },
    channel_usage: { type: 'string' },
    recommended_workflow_type: { type: 'string' },
    message: { type: 'string' },
  },
  required: ['channels', 'message'],
};

const UPLOAD_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    file_id: { type: 'string' },
    ok: { type: 'boolean' },
    object_type: { type: 'string' },
    filename: { type: ['string', 'null'] as any },
  },
  required: ['file_id', 'ok', 'object_type'],
};

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const readBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

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

const readPlainRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ?
    (value as Record<string, unknown>)
  : undefined;

const ACCOUNTING_EXPORT_PROVIDERS = new Set(['freee', 'moneyforward', 'quickbooks-online']);

const CHANNEL_REASON_PRIORITY = [
  'shadow_mode',
  'rollout_stage_shadow',
  'channel_disabled',
  'outbound_pipeline_inactive',
  'object_map_missing',
  'export_not_ready',
];

const readColumnMappings = (value: unknown): ImportCreateParams['column_mappings'] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return undefined;
      }
      const sourceHeader = readString((entry as Record<string, unknown>)['source_header']);
      const targetField = readString((entry as Record<string, unknown>)['target_field']);
      if (!sourceHeader || !targetField) {
        return undefined;
      }
      return {
        source_header: sourceHeader,
        target_field: targetField,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  return normalized.length > 0 ? normalized : undefined;
};

const parseBase64Content = (raw: string): { data: string; mimeType?: string } => {
  const trimmed = raw.trim();
  const match = trimmed.match(/^data:([^;,]+);base64,(.+)$/);
  if (match?.[1] && match?.[2]) {
    return {
      mimeType: match[1],
      data: match[2],
    };
  }
  return { data: trimmed };
};

const buildJobSummary = (job: TransferJob): string => {
  const succeeded = job.summary?.succeeded ?? 0;
  const failed = job.summary?.failed ?? 0;
  const total = job.summary?.total ?? job.summary?.requested_count ?? 0;
  return `${job.job_type} job ${job.job_id} is ${job.status} for ${job.object_type} (${succeeded} succeeded, ${failed} failed, ${total} total).`;
};

const buildJobListSummary = (jobType: 'import' | 'export', count: number): string =>
  `Found ${count} ${jobType} job${count === 1 ? '' : 's'}.`;

const channelString = (channel: Record<string, unknown>, key: string): string | undefined =>
  readString(channel[key]);

const channelBoolean = (channel: Record<string, unknown>, key: string): boolean | undefined =>
  readBoolean(channel[key]);

const channelReasons = (channel: Record<string, unknown>): string[] => {
  const reasons = readStringArray(channel['export_blocker_reasons']);
  if (reasons?.length) {
    return reasons;
  }
  const reason = channelString(channel, 'export_blocker_reason');
  return reason ? [reason] : [];
};

const fallbackChannelReasons = (channel: Record<string, unknown>): string[] => {
  const reasons: string[] = [];
  if (channelBoolean(channel, 'shadow_mode') === true) {
    reasons.push('shadow_mode');
  }
  if (channelString(channel, 'rollout_stage')?.toLowerCase() === 'shadow') {
    reasons.push('rollout_stage_shadow');
  }
  if (channelBoolean(channel, 'is_enabled') === false) {
    reasons.push('channel_disabled');
  }
  if (channelBoolean(channel, 'outbound_pipeline_active') === false) {
    reasons.push('outbound_pipeline_inactive');
  }
  return reasons;
};

const uniqueChannelReasons = (reasons: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const reason of reasons) {
    const trimmed = reason.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized.sort((left, right) => {
    const leftIndex = CHANNEL_REASON_PRIORITY.indexOf(left);
    const rightIndex = CHANNEL_REASON_PRIORITY.indexOf(right);
    const leftRank = leftIndex === -1 ? CHANNEL_REASON_PRIORITY.length : leftIndex;
    const rightRank = rightIndex === -1 ? CHANNEL_REASON_PRIORITY.length : rightIndex;
    return leftRank - rightRank;
  });
};

const effectiveChannelReasons = (channel: Record<string, unknown>): string[] => {
  const explicitReasons = channelReasons(channel);
  const fallbackReasons = fallbackChannelReasons(channel);
  const exportReady = channelBoolean(channel, 'export_ready');
  const reasons = uniqueChannelReasons([...explicitReasons, ...fallbackReasons]);
  if (exportReady === false && !reasons.length) {
    return ['export_not_ready'];
  }
  return reasons;
};

const buildBlockedChannelGuidance = (reasons: string[]): string => {
  const base = 'Do not call export_records or start_workflow with this blocked channel_id.';
  if (reasons.includes('shadow_mode') || reasons.includes('rollout_stage_shadow')) {
    return `${base} Shadow mode is an internal rollout state; report that accounting invoice export is not available from MCP yet unless the API returns an explicit user_action.`;
  }
  return `${base} Report the export blocker reason to the user and wait for the channel to become export_ready.`;
};

const normalizeChannelReadiness = (channel: Record<string, unknown>): Record<string, unknown> => {
  const reasons = effectiveChannelReasons(channel);
  const exportReady = channelBoolean(channel, 'export_ready');
  const isBlocked = exportReady === false || reasons.length > 0;
  if (!isBlocked) {
    return {
      ...channel,
      ...(exportReady === true ? { export_ready: true, is_export_blocked: false } : {}),
    };
  }

  const blockerReasons = reasons.length ? reasons : ['export_not_ready'];
  return {
    ...channel,
    export_ready: false,
    export_blocker_reason: blockerReasons[0] ?? null,
    export_blocker_reasons: blockerReasons,
    is_export_blocked: true,
    readiness_guidance: buildBlockedChannelGuidance(blockerReasons),
  };
};

const normalizeIntegrationChannelParams = (
  args: Record<string, unknown> | undefined,
): {
  params: IntegrationChannelsListParams;
  requestedObjectType: string;
  requestedProvider?: string;
} => {
  const requestedObjectType = readString(args?.['object_type']) || 'deal';
  const requestedProvider = readString(args?.['provider']);
  const isAccountingProvider = requestedProvider ? ACCOUNTING_EXPORT_PROVIDERS.has(requestedProvider) : false;
  const params: IntegrationChannelsListParams = {};

  if (requestedProvider) {
    params.provider = requestedProvider;
  }

  if (!['invoice', 'bill'].includes(requestedObjectType) && !isAccountingProvider) {
    params.object_type = requestedObjectType;
  }

  return {
    params,
    requestedObjectType,
    ...(requestedProvider ? { requestedProvider } : {}),
  };
};

const normalizeIntegrationChannelResponse = (
  response: IntegrationChannelsListResponse,
  context: { requestedObjectType: string; requestedProvider?: string },
): IntegrationChannelsListResponse & Record<string, unknown> => {
  const channels = (response.channels ?? [])
    .filter(
      (channel): channel is Record<string, unknown> =>
        Boolean(channel) && typeof channel === 'object' && !Array.isArray(channel),
    )
    .map(normalizeChannelReadiness);
  const exportReadyCount = channels.filter(
    (channel) =>
      channelBoolean(channel, 'export_ready') === true &&
      channelBoolean(channel, 'is_export_blocked') !== true,
  ).length;
  const blockedCount = channels.filter(
    (channel) => channelBoolean(channel, 'is_export_blocked') === true,
  ).length;
  const blockedByShadowMode = channels.some((channel) =>
    effectiveChannelReasons(channel).some(
      (reason) => reason === 'shadow_mode' || reason === 'rollout_stage_shadow',
    ),
  );
  const readinessGuidance =
    blockedCount > 0 && exportReadyCount === 0 ?
      blockedByShadowMode ?
        'No export-ready accounting channel is available. Shadow mode is an internal rollout state; do not call export_records or start_workflow unless the API returns an explicit user_action.'
      : 'No export-ready channel is available. Do not call export_records or start_workflow with blocked channel ids.'
    : exportReadyCount > 0 ? 'At least one channel is export_ready.'
    : 'Export channel readiness is unknown.';

  return {
    ...response,
    channels,
    requested_object_type: context.requestedObjectType,
    ...(context.requestedProvider ? { requested_provider: context.requestedProvider } : {}),
    has_export_ready_channel: exportReadyCount > 0,
    export_ready_count: exportReadyCount,
    blocked_count: blockedCount,
    blocked_by_shadow_mode: blockedByShadowMode,
    readiness_guidance: readinessGuidance,
  };
};

const accountingWorkflowType = (context: {
  requestedObjectType: string;
  requestedProvider?: string;
}): 'invoice_export' | 'bill_export' =>
  context.requestedObjectType === 'bill' ? 'bill_export' : 'invoice_export';

const isAccountingWorkflowChannelRequest = (context: {
  requestedObjectType: string;
  requestedProvider?: string;
}): boolean =>
  ['invoice', 'bill'].includes(context.requestedObjectType) ||
  (context.requestedProvider ? ACCOUNTING_EXPORT_PROVIDERS.has(context.requestedProvider) : false);

const normalizeAccountingExportChannel = (
  channel: Record<string, unknown>,
  workflowType: 'invoice_export' | 'bill_export',
): Record<string, unknown> => {
  const {
    export_ready: _exportReady,
    export_blocker_reason: _exportBlockerReason,
    export_blocker_reasons: _exportBlockerReasons,
    ...rest
  } = channel;
  const channelID = channelString(channel, 'channel_id') ?? channelString(channel, 'id');
  const isBillExport = workflowType === 'bill_export';
  return {
    ...rest,
    ...(channelID ?
      {
        channel_id: channelID,
        accounting_export_channel_id: channelID,
        ...(isBillExport ? { bill_export_channel_id: channelID } : { invoice_export_channel_id: channelID }),
      }
    : {}),
    ...(isBillExport ?
      { accounting_bill_export_candidate: true }
    : { accounting_invoice_export_candidate: true }),
    is_export_blocked: false,
    ...(isBillExport ?
      { bill_export_readiness_signal: 'preview_or_start_workflow' }
    : { invoice_export_readiness_signal: 'preview_or_start_workflow' }),
    readiness_guidance: `Use this channel_id as the accounting channel for preview_workflow/start_workflow with workflow_type=${workflowType}. Do not treat integration-sync shadow_mode, rollout_stage, is_enabled, or outbound_pipeline_active flags from this channel-list endpoint as ${workflowType} blockers; preview_workflow/start_workflow returns the actual accounting export blockers.`,
  };
};

const normalizeAccountingChannelResponse = (
  response: IntegrationChannelsListResponse,
  context: { requestedObjectType: string; requestedProvider?: string },
): IntegrationChannelsListResponse & Record<string, unknown> => {
  const workflowType = accountingWorkflowType(context);
  const channels = (response.channels ?? [])
    .filter(
      (channel): channel is Record<string, unknown> =>
        Boolean(channel) && typeof channel === 'object' && !Array.isArray(channel),
    )
    .map((channel) => normalizeAccountingExportChannel(channel, workflowType));
  return {
    ...response,
    channels,
    requested_object_type: context.requestedObjectType,
    ...(context.requestedProvider ? { requested_provider: context.requestedProvider } : {}),
    channel_usage: `accounting_${workflowType}_channel_candidates`,
    recommended_workflow_type: workflowType,
    has_export_ready_channel: channels.length > 0,
    export_ready_count: channels.length,
    blocked_count: 0,
    blocked_by_shadow_mode: false,
    readiness_guidance: `For ${workflowType}, list_integration_channels only discovers accounting channel_id candidates. Use preview_workflow/start_workflow with workflow_type=${workflowType}, target_system, an explicit sync_scope, record ids, and the selected channel_id; do not block on integration-sync shadow/outbound flags from this endpoint.`,
  };
};

const buildChannelSummaryLine = (channel: Record<string, unknown>): string => {
  const channelID = channelString(channel, 'channel_id') ?? channelString(channel, 'id') ?? 'unknown-channel';
  const name = channelString(channel, 'channel_name') ?? channelString(channel, 'name') ?? channelID;
  const provider = channelString(channel, 'provider') ?? 'unknown-provider';
  const exportReady = channelBoolean(channel, 'export_ready');
  const effectiveReasons = effectiveChannelReasons(channel);
  const primaryReason = effectiveReasons[0];
  const secondaryReasons = effectiveReasons.slice(1);
  const status =
    exportReady === true && channelBoolean(channel, 'is_export_blocked') !== true ? 'export ready'
    : primaryReason ?
      `export not ready: ${primaryReason}${
        secondaryReasons.length ? ` (also ${secondaryReasons.join(', ')})` : ''
      }`
    : 'export readiness unknown';
  const details: string[] = [];
  if (channelBoolean(channel, 'shadow_mode') === true) {
    details.push('shadow_mode=true');
  }
  const rolloutStage = channelString(channel, 'rollout_stage');
  if (rolloutStage) {
    details.push(`rollout_stage=${rolloutStage}`);
  }
  return `${name} (${provider}, ${channelID}): ${status}${
    details.length ? `; details: ${details.join(', ')}` : ''
  }`;
};

const buildAccountingChannelSummaryLine = (
  channel: Record<string, unknown>,
  workflowType: string,
): string => {
  const channelID = channelString(channel, 'channel_id') ?? channelString(channel, 'id') ?? 'unknown-channel';
  const name = channelString(channel, 'channel_name') ?? channelString(channel, 'name') ?? channelID;
  const provider = channelString(channel, 'provider') ?? 'unknown-provider';
  return `${name} (${provider}, ${channelID}): accounting ${workflowType} channel candidate. Use this channel_id with preview_workflow/start_workflow; integration-sync shadow/outbound flags are not ${workflowType} readiness blockers.`;
};

const buildChannelListSummary = (response: IntegrationChannelsListResponse): string => {
  const count = response.channels?.length ?? 0;
  const channels = (response.channels ?? []).filter(
    (channel): channel is Record<string, unknown> =>
      Boolean(channel) && typeof channel === 'object' && !Array.isArray(channel),
  );
  if (!channels.length) {
    return `Found ${count} integration channel${count === 1 ? '' : 's'}.`;
  }
  const responseMetadata = response as unknown as Record<string, unknown>;
  const requestedProvider = readString(responseMetadata['requested_provider']);
  const requestedObjectType = readString(responseMetadata['requested_object_type']);
  const exportReadyCount = readNumber(responseMetadata['export_ready_count']);
  const blockedCount = readNumber(responseMetadata['blocked_count']);
  const blockedByShadowMode = readBoolean(responseMetadata['blocked_by_shadow_mode']);
  const channelUsage = readString(responseMetadata['channel_usage']);
  if (
    channelUsage === 'accounting_invoice_export_channel_candidates' ||
    channelUsage === 'accounting_bill_export_channel_candidates'
  ) {
    const workflowType =
      readString(responseMetadata['recommended_workflow_type']) ||
      (channelUsage.includes('bill') ? 'bill_export' : 'invoice_export');
    const providerLabel = requestedProvider ? `${requestedProvider} ` : '';
    return [
      `Found ${count} ${providerLabel}accounting channel candidate${
        count === 1 ? '' : 's'
      } for ${workflowType}.`,
      `Use preview_workflow/start_workflow with workflow_type=${workflowType} to check and run the accounting export. Do not block on integration-sync shadow/outbound flags from this channel-list endpoint.`,
      ...channels.map((channel) => buildAccountingChannelSummaryLine(channel, workflowType)),
    ].join('\n');
  }
  const header: string[] = [`Found ${count} integration channel${count === 1 ? '' : 's'}.`];
  if ((exportReadyCount ?? 0) === 0 && (blockedCount ?? 0) > 0) {
    const providerLabel = requestedProvider ? `${requestedProvider} ` : '';
    const objectLabel = requestedObjectType ? `${requestedObjectType} ` : '';
    header.push(
      `No export-ready ${providerLabel}channel is available for ${objectLabel}exports. Do not call export_records or start_workflow with blocked channel ids.`,
    );
    if (blockedByShadowMode) {
      header.push(
        'Shadow mode is an internal rollout state; report that accounting invoice export is not available from MCP yet unless the API returns an explicit user_action.',
      );
    }
  }
  return [...header, ...channels.map(buildChannelSummaryLine)].join('\n');
};

export const uploadImportFileTool: McpTool = {
  metadata: {
    resource: 'imports',
    operation: 'write',
    tags: ['imports', 'files'],
    httpMethod: 'post',
    httpPath: '/api/v2/files',
    operationId: 'public.imports.uploadFile',
  },
  tool: {
    name: 'upload_import_file',
    title: 'Upload import file',
    description:
      'Upload a CSV file for a public import flow and return a temporary file_id. Provide a filename and base64-encoded file content, then pass the returned file_id to import_records.',
    inputSchema: IMPORT_UPLOAD_INPUT_SCHEMA,
    outputSchema: UPLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Upload import file',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }): Promise<ToolCallResult> => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Upload import file',
    });
    if (authError) {
      return authError;
    }

    const filename = readString(args?.['filename']);
    const contentBase64 = readString(args?.['content_base64']);
    const objectType = readString(args?.['object_type']) || 'item';
    const mimeType = readString(args?.['mime_type']);
    if (!filename) {
      return asErrorResult('`filename` is required.');
    }
    if (!contentBase64) {
      return asErrorResult('`content_base64` is required.');
    }

    const parsed = parseBase64Content(contentBase64);
    const file = new File([Buffer.from(parsed.data, 'base64')], filename, {
      type: mimeType || parsed.mimeType || 'application/octet-stream',
    });
    const body: ImportUploadFileParams = {
      object_type: objectType,
      file,
    };
    const response: TransferUploadFileResponse = await reqContext.client.public.imports.uploadFile(body);

    return {
      content: [
        {
          type: 'text',
          text: `Uploaded ${response.filename || filename} for ${response.object_type} imports.`,
        },
      ],
      structuredContent: response as unknown as Record<string, unknown>,
    };
  },
};

export const importRecordsTool: McpTool = {
  metadata: {
    resource: 'imports',
    operation: 'write',
    tags: ['imports'],
    httpMethod: 'post',
    httpPath: '/api/v2/imports',
    operationId: 'public.imports.create',
  },
  tool: {
    name: 'import_records',
    title: 'Import records',
    description:
      'Create a public import job. Use upload_import_file first for item CSV imports, or pass HubSpot Deal ids with object_type="order" and source_kind="integration" to create Sanka Orders.',
    inputSchema: IMPORT_INPUT_SCHEMA,
    outputSchema: JOB_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Import records',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Import records',
    });
    if (authError) {
      return authError;
    }

    const objectType = readString(args?.['object_type']) || 'item';
    const sourceKind = readString(args?.['source_kind']) || (objectType === 'order' ? 'integration' : 'file');

    const body: ImportCreateParams = {
      object_type: objectType,
      source_kind: sourceKind,
      file_format: readString(args?.['file_format']) || 'csv',
      operation: readString(args?.['operation']) || (objectType === 'order' ? 'create' : 'upsert'),
      mapping_mode: readString(args?.['mapping_mode']) || 'auto',
    };
    const fileId = readString(args?.['file_id']);
    if (sourceKind === 'file') {
      if (!fileId) {
        return asErrorResult('`file_id` is required for file imports.');
      }
      body.file_id = fileId;
    }
    if (sourceKind === 'integration') {
      const recordIds = readStringArray(args?.['record_ids']);
      const sourceRecord = readPlainRecord(args?.['source_record']);
      if (!recordIds && !sourceRecord) {
        return asErrorResult('Provide `record_ids` or `source_record` for integration imports.');
      }
      body.provider = readString(args?.['provider']) || 'hubspot';
      const channelId = readString(args?.['channel_id']);
      if (channelId) {
        body.channel_id = channelId;
      }
      if (recordIds) {
        body.record_ids = recordIds;
      }
      if (sourceRecord) {
        body.source_record = sourceRecord;
      }
    }
    const keyField = readString(args?.['key_field']);
    if (keyField) {
      body.key_field = keyField;
    }
    const columnMappings = readColumnMappings(args?.['column_mappings']);
    if (columnMappings) {
      body.column_mappings = columnMappings;
    }
    const dryRun = readBoolean(args?.['dry_run']);
    if (dryRun !== undefined) {
      body.dry_run = dryRun;
    }

    const job = await reqContext.client.public.imports.create(body);
    return {
      content: [{ type: 'text', text: buildJobSummary(job) }],
      structuredContent: job as unknown as Record<string, unknown>,
    };
  },
};

export const getImportJobTool: McpTool = {
  metadata: {
    resource: 'imports',
    operation: 'read',
    tags: ['imports'],
    httpMethod: 'get',
    httpPath: '/api/v2/imports/{job_id}',
    operationId: 'public.imports.retrieve',
  },
  tool: {
    name: 'get_import_job',
    title: 'Get import job',
    description: 'Load one import job by id.',
    inputSchema: JOB_LOOKUP_INPUT_SCHEMA,
    outputSchema: JOB_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get import job',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get import job',
    });
    if (authError) {
      return authError;
    }

    const jobId = readString(args?.['job_id']);
    if (!jobId) {
      return asErrorResult('`job_id` is required.');
    }

    const job = await reqContext.client.public.imports.retrieve(jobId);
    return {
      content: [{ type: 'text', text: buildJobSummary(job) }],
      structuredContent: job as unknown as Record<string, unknown>,
    };
  },
};

export const listImportJobsTool: McpTool = {
  metadata: {
    resource: 'imports',
    operation: 'read',
    tags: ['imports'],
    httpMethod: 'get',
    httpPath: '/api/v2/imports',
    operationId: 'public.imports.list',
  },
  tool: {
    name: 'list_import_jobs',
    title: 'List import jobs',
    description: 'List recent public import jobs for the authenticated workspace context.',
    inputSchema: IMPORT_LIST_INPUT_SCHEMA,
    outputSchema: JOB_LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List import jobs',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List import jobs',
    });
    if (authError) {
      return authError;
    }

    const params: ImportListParams = {
      object_type: readString(args?.['object_type']) || 'item',
    };
    const limit = readNumber(args?.['limit']);
    if (limit !== undefined) {
      params.limit = Math.trunc(limit);
    }

    const response = await reqContext.client.public.imports.list(params);
    return {
      content: [{ type: 'text', text: buildJobListSummary('import', response.jobs?.length ?? 0) }],
      structuredContent: response as unknown as Record<string, unknown>,
    };
  },
};

export const cancelImportJobTool: McpTool = {
  metadata: {
    resource: 'imports',
    operation: 'write',
    tags: ['imports'],
    httpMethod: 'post',
    httpPath: '/api/v2/imports/{job_id}/cancel',
    operationId: 'public.imports.cancel',
  },
  tool: {
    name: 'cancel_import_job',
    title: 'Cancel import job',
    description: 'Cancel a running import job.',
    inputSchema: JOB_LOOKUP_INPUT_SCHEMA,
    outputSchema: JOB_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Cancel import job',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Cancel import job',
    });
    if (authError) {
      return authError;
    }

    const jobId = readString(args?.['job_id']);
    if (!jobId) {
      return asErrorResult('`job_id` is required.');
    }

    const job = await reqContext.client.public.imports.cancel(jobId);
    return {
      content: [{ type: 'text', text: buildJobSummary(job) }],
      structuredContent: job as unknown as Record<string, unknown>,
    };
  },
};

export const retryImportJobTool: McpTool = {
  metadata: {
    resource: 'imports',
    operation: 'write',
    tags: ['imports'],
    httpMethod: 'post',
    httpPath: '/api/v2/imports/{job_id}/retry',
    operationId: 'public.imports.retry',
  },
  tool: {
    name: 'retry_import_job',
    title: 'Retry import job',
    description: 'Retry a failed, canceled, or otherwise terminal import job.',
    inputSchema: JOB_LOOKUP_INPUT_SCHEMA,
    outputSchema: JOB_RETRY_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Retry import job',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Retry import job',
    });
    if (authError) {
      return authError;
    }

    const jobId = readString(args?.['job_id']);
    if (!jobId) {
      return asErrorResult('`job_id` is required.');
    }

    const response = await reqContext.client.public.imports.retry(jobId);
    return {
      content: [{ type: 'text', text: `Retried import job ${jobId}. ${buildJobSummary(response.job)}` }],
      structuredContent: response as unknown as Record<string, unknown>,
    };
  },
};

export const listIntegrationChannelsTool: McpTool = {
  metadata: {
    resource: 'integrations',
    operation: 'read',
    tags: ['exports', 'integrations'],
    httpMethod: 'get',
    httpPath: '/api/v2/integrations/channels',
    operationId: 'public.integrations.listChannels',
  },
  tool: {
    name: 'list_integration_channels',
    title: 'List integration channels',
    description:
      'List connected integration channels available for a public export flow. Use this before export_records for supported HubSpot or NextEngine exports. For freee/MoneyForward invoice_export and QuickBooks Online invoice_export or bill_export workflows, use this only to discover accounting channel_id candidates; preview_workflow/start_workflow determines actual accounting export readiness. Do not treat integration-sync shadow_mode, rollout_stage, is_enabled, or outbound_pipeline_active fields from this endpoint as accounting workflow blockers.',
    inputSchema: INTEGRATION_CHANNELS_INPUT_SCHEMA,
    outputSchema: CHANNELS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List integration channels',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List integration channels',
    });
    if (authError) {
      return authError;
    }

    const { params, requestedObjectType, requestedProvider } = normalizeIntegrationChannelParams(args);

    const response: IntegrationChannelsListResponse =
      await reqContext.client.public.integrations.listChannels(params);
    const channelContext = {
      requestedObjectType,
      ...(requestedProvider ? { requestedProvider } : {}),
    };
    const normalizedResponse =
      isAccountingWorkflowChannelRequest(channelContext) ?
        normalizeAccountingChannelResponse(response, channelContext)
      : normalizeIntegrationChannelResponse(response, channelContext);
    return {
      content: [{ type: 'text', text: buildChannelListSummary(normalizedResponse) }],
      structuredContent: normalizedResponse,
    };
  },
};

export const exportRecordsTool: McpTool = {
  metadata: {
    resource: 'exports',
    operation: 'write',
    tags: ['exports'],
    httpMethod: 'post',
    httpPath: '/api/v2/exports',
    operationId: 'public.exports.create',
  },
  tool: {
    name: 'export_records',
    title: 'Export records',
    description:
      'Create a public export job for Sanka records. Use this for integration exports such as deals to HubSpot. For Invoice accounting sync, use preview_workflow/start_workflow with workflow_type=invoice_export; for QuickBooks Online Bill sync, use workflow_type=bill_export. Integration exports are validated against the runnable delivery matrix; provider/object pairs without a working native delivery pipeline are rejected with HTTP 400 and error code INTEGRATION_EXPORT_NOT_SUPPORTED (do not retry those pairs), and HTTP 503 with error code JOB_QUEUE_UNAVAILABLE means the dispatch queue is temporarily unavailable — retry later. Accepted integration exports return status "queued" and deliver asynchronously in the background; treat "queued" as successful submission instead of polling for "completed".',
    inputSchema: EXPORT_INPUT_SCHEMA,
    outputSchema: JOB_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Export records',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Export records',
    });
    if (authError) {
      return authError;
    }

    const channelId = readString(args?.['channel_id']);
    if (!channelId) {
      return asErrorResult('`channel_id` is required.');
    }

    const recordIds = readStringArray(args?.['record_ids']);
    const workspaceScope = readString(args?.['workspace_scope']);
    if (!recordIds && !workspaceScope) {
      return asErrorResult('Provide either `record_ids` or `workspace_scope="all"`.');
    }
    if (recordIds && workspaceScope) {
      return asErrorResult('`record_ids` and `workspace_scope` are mutually exclusive.');
    }

    const objectType = readString(args?.['object_type']) || 'deal';
    const destinationKind =
      readString(args?.['destination_kind']) || (objectType === 'invoice' ? 'accounting' : 'integration');
    const targetSystem = readString(args?.['target_system']);
    if (targetSystem && objectType !== 'invoice') {
      return asErrorResult('`target_system` is only supported when `object_type="invoice"`.');
    }
    let provider = readString(args?.['provider']) || (objectType === 'invoice' ? 'freee' : 'hubspot');
    if (objectType === 'invoice' && targetSystem) {
      provider = targetSystem;
    }
    if (objectType === 'invoice' && destinationKind === 'accounting') {
      return asErrorResult(
        'Invoice accounting exports must use preview_workflow/start_workflow with workflow_type=invoice_export. export_records uses generic export jobs and must not be used for freee, MoneyForward, Xero, or QuickBooks invoice sync.',
      );
    }
    const body: ExportCreateParams = {
      object_type: objectType,
      destination_kind: destinationKind,
      provider,
      channel_id: channelId,
      operation: readString(args?.['operation']) || (objectType === 'invoice' ? 'create' : 'update'),
    };
    if (targetSystem) {
      body.target_system = targetSystem;
    }
    if (recordIds) {
      body.record_ids = recordIds;
    }
    if (workspaceScope) {
      body.workspace_scope = workspaceScope;
    }
    const limit = readNumber(args?.['limit']);
    if (limit !== undefined) {
      body.limit = Math.trunc(limit);
    }
    const dryRun = readBoolean(args?.['dry_run']);
    if (dryRun !== undefined) {
      body.dry_run = dryRun;
    }

    const job = await reqContext.client.public.exports.create(body);
    return {
      content: [{ type: 'text', text: buildJobSummary(job) }],
      structuredContent: job as unknown as Record<string, unknown>,
    };
  },
};

export const getExportJobTool: McpTool = {
  metadata: {
    resource: 'exports',
    operation: 'read',
    tags: ['exports'],
    httpMethod: 'get',
    httpPath: '/api/v2/exports/{job_id}',
    operationId: 'public.exports.retrieve',
  },
  tool: {
    name: 'get_export_job',
    title: 'Get export job',
    description: 'Load one export job by id.',
    inputSchema: JOB_LOOKUP_INPUT_SCHEMA,
    outputSchema: JOB_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get export job',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get export job',
    });
    if (authError) {
      return authError;
    }

    const jobId = readString(args?.['job_id']);
    if (!jobId) {
      return asErrorResult('`job_id` is required.');
    }

    const job = await reqContext.client.public.exports.retrieve(jobId);
    return {
      content: [{ type: 'text', text: buildJobSummary(job) }],
      structuredContent: job as unknown as Record<string, unknown>,
    };
  },
};

export const listExportJobsTool: McpTool = {
  metadata: {
    resource: 'exports',
    operation: 'read',
    tags: ['exports'],
    httpMethod: 'get',
    httpPath: '/api/v2/exports',
    operationId: 'public.exports.list',
  },
  tool: {
    name: 'list_export_jobs',
    title: 'List export jobs',
    description: 'List recent public export jobs for the authenticated workspace context.',
    inputSchema: EXPORT_LIST_INPUT_SCHEMA,
    outputSchema: JOB_LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List export jobs',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List export jobs',
    });
    if (authError) {
      return authError;
    }

    const params: ExportListParams = {
      object_type: readString(args?.['object_type']) || 'deal',
    };
    const limit = readNumber(args?.['limit']);
    if (limit !== undefined) {
      params.limit = Math.trunc(limit);
    }

    const response = await reqContext.client.public.exports.list(params);
    return {
      content: [{ type: 'text', text: buildJobListSummary('export', response.jobs?.length ?? 0) }],
      structuredContent: response as unknown as Record<string, unknown>,
    };
  },
};

export const cancelExportJobTool: McpTool = {
  metadata: {
    resource: 'exports',
    operation: 'write',
    tags: ['exports'],
    httpMethod: 'post',
    httpPath: '/api/v2/exports/{job_id}/cancel',
    operationId: 'public.exports.cancel',
  },
  tool: {
    name: 'cancel_export_job',
    title: 'Cancel export job',
    description: 'Cancel a running export job.',
    inputSchema: JOB_LOOKUP_INPUT_SCHEMA,
    outputSchema: JOB_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Cancel export job',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Cancel export job',
    });
    if (authError) {
      return authError;
    }

    const jobId = readString(args?.['job_id']);
    if (!jobId) {
      return asErrorResult('`job_id` is required.');
    }

    const job = await reqContext.client.public.exports.cancel(jobId);
    return {
      content: [{ type: 'text', text: buildJobSummary(job) }],
      structuredContent: job as unknown as Record<string, unknown>,
    };
  },
};

export const retryExportJobTool: McpTool = {
  metadata: {
    resource: 'exports',
    operation: 'write',
    tags: ['exports'],
    httpMethod: 'post',
    httpPath: '/api/v2/exports/{job_id}/retry',
    operationId: 'public.exports.retry',
  },
  tool: {
    name: 'retry_export_job',
    title: 'Retry export job',
    description: 'Retry a failed, canceled, or otherwise terminal export job.',
    inputSchema: JOB_LOOKUP_INPUT_SCHEMA,
    outputSchema: JOB_RETRY_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Retry export job',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Retry export job',
    });
    if (authError) {
      return authError;
    }

    const jobId = readString(args?.['job_id']);
    if (!jobId) {
      return asErrorResult('`job_id` is required.');
    }

    const response = await reqContext.client.public.exports.retry(jobId);
    return {
      content: [{ type: 'text', text: `Retried export job ${jobId}. ${buildJobSummary(response.job)}` }],
      structuredContent: response as unknown as Record<string, unknown>,
    };
  },
};
