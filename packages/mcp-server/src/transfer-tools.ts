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
      description: 'Object type to import. Currently supports only "item".',
      enum: ['item'],
      default: 'item',
    },
    file_id: {
      type: 'string',
      description: 'Temporary file id returned by upload_import_file.',
    },
    source_kind: {
      type: 'string',
      description: 'Import source kind. Currently supports only "file".',
      enum: ['file'],
      default: 'file',
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
      description: 'Reserved for future validation-only imports. Currently unsupported by the API.',
      default: false,
    },
  },
  required: ['file_id'],
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
      description: 'Optional filter. Currently supports only "item".',
      enum: ['item'],
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
      description: 'Object type you plan to export. Currently supports only "deal".',
      enum: ['deal'],
      default: 'deal',
    },
    provider: {
      type: 'string',
      description: 'Optional destination provider filter.',
      enum: ['hubspot'],
      default: 'hubspot',
    },
  },
};

const EXPORT_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: {
      type: 'string',
      description: 'Object type to export. Currently supports only "deal".',
      enum: ['deal'],
      default: 'deal',
    },
    destination_kind: {
      type: 'string',
      description: 'Destination kind. Currently supports only "integration".',
      enum: ['integration'],
      default: 'integration',
    },
    provider: {
      type: 'string',
      description: 'Destination provider. Currently supports only "hubspot".',
      enum: ['hubspot'],
      default: 'hubspot',
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
      description: 'Reserved for future validation-only exports. Currently unsupported by the API.',
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

const CHANNELS_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    channels: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
      },
    },
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

const buildChannelListSummary = (response: IntegrationChannelsListResponse): string => {
  const count = response.channels?.length ?? 0;
  return `Found ${count} integration channel${count === 1 ? '' : 's'}.`;
};

export const uploadImportFileTool: McpTool = {
  metadata: {
    resource: 'imports',
    operation: 'write',
    tags: ['imports', 'files'],
    httpMethod: 'post',
    httpPath: '/v1/public/files',
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
    httpPath: '/v1/public/imports',
    operationId: 'public.imports.create',
  },
  tool: {
    name: 'import_records',
    title: 'Import records',
    description:
      'Create a public import job from an uploaded file. Use upload_import_file first to obtain a file_id. Currently supports item CSV imports.',
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

    const fileId = readString(args?.['file_id']);
    if (!fileId) {
      return asErrorResult('`file_id` is required.');
    }

    const body: ImportCreateParams = {
      object_type: readString(args?.['object_type']) || 'item',
      file_id: fileId,
      source_kind: readString(args?.['source_kind']) || 'file',
      file_format: readString(args?.['file_format']) || 'csv',
      operation: readString(args?.['operation']) || 'upsert',
      mapping_mode: readString(args?.['mapping_mode']) || 'auto',
    };
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
    httpPath: '/v1/public/imports/{job_id}',
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
    httpPath: '/v1/public/imports',
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
    httpPath: '/v1/public/imports/{job_id}/cancel',
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

export const listIntegrationChannelsTool: McpTool = {
  metadata: {
    resource: 'integrations',
    operation: 'read',
    tags: ['exports', 'integrations'],
    httpMethod: 'get',
    httpPath: '/v1/public/integrations/channels',
    operationId: 'public.integrations.listChannels',
  },
  tool: {
    name: 'list_integration_channels',
    title: 'List integration channels',
    description:
      'List connected integration channels available for a public export flow. Use this before export_records when the user does not already know the destination channel_id.',
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

    const params: IntegrationChannelsListParams = {
      object_type: readString(args?.['object_type']) || 'deal',
    };
    const provider = readString(args?.['provider']);
    if (provider) {
      params.provider = provider;
    }

    const response: IntegrationChannelsListResponse =
      await reqContext.client.public.integrations.listChannels(params);
    return {
      content: [{ type: 'text', text: buildChannelListSummary(response) }],
      structuredContent: response as unknown as Record<string, unknown>,
    };
  },
};

export const exportRecordsTool: McpTool = {
  metadata: {
    resource: 'exports',
    operation: 'write',
    tags: ['exports'],
    httpMethod: 'post',
    httpPath: '/v1/public/exports',
    operationId: 'public.exports.create',
  },
  tool: {
    name: 'export_records',
    title: 'Export records',
    description:
      'Create a public export job for Sanka records. Currently supports exporting deals to a HubSpot integration channel.',
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

    const body: ExportCreateParams = {
      object_type: readString(args?.['object_type']) || 'deal',
      destination_kind: readString(args?.['destination_kind']) || 'integration',
      provider: readString(args?.['provider']) || 'hubspot',
      channel_id: channelId,
      operation: readString(args?.['operation']) || 'update',
    };
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
    httpPath: '/v1/public/exports/{job_id}',
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
    httpPath: '/v1/public/exports',
    operationId: 'public.exports.list',
  },
  tool: {
    name: 'list_export_jobs',
    title: 'List export jobs',
    description: 'List recent public export jobs for the authenticated workspace context.',
    inputSchema: IMPORT_LIST_INPUT_SCHEMA,
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
    httpPath: '/v1/public/exports/{job_id}/cancel',
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
