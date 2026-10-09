import { File } from 'node:buffer';
import {
  appendBinaryUploadChunk,
  BINARY_UPLOAD_CHUNK_BASE64_LENGTH,
  finishBinaryUpload,
  startBinaryUpload,
} from './binary-upload-store';
import { buildSafeRecordLabel } from './record-labels';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpRequestContext, McpTool, ToolCallResult } from './types';

/**
 * Shared factories and result-shaping helpers for the hand-written MCP tools
 * in crm-tools.ts.
 *
 * Most CRM tools are instances of three templates: a list tool (auth check ->
 * fetch a page of rows -> buildListResult), a detail tool (auth check ->
 * resolve a target id -> retrieve -> buildEntityDetailSummary), and a mutation
 * tool (auth check -> optionally resolve a target id -> call the SDK ->
 * buildEntityMutationSummary). defineListTool / defineDetailTool /
 * defineMutationTool capture those templates once; the resource-specific parts
 * (schemas, descriptions, SDK call, param/body builders, preview keys) stay at
 * the call site. createChunkedUploadTools generates a start/append/finish
 * chunked upload triplet whose finish tool uploads the assembled file, and
 * createChunkedAttachmentUploadTools is its attachment form, ending in a
 * file_id for a resource's create and update tools.
 *
 * MIGRATING ANOTHER RESOURCE FAMILY ONTO THE FACTORIES
 *
 * 1. Confirm the tool is template-pure first: the handler must be exactly
 *    "requireAuthentication -> (optional arg validation / id resolution) ->
 *    one SDK call -> buildListResult / buildEntityDetailSummary /
 *    buildEntityMutationSummary". Tools with bespoke summaries (for example
 *    absences/attendance use buildRecordMutationSummary, expenses use
 *    buildExpenseDetailSummary), multi-call handlers, extra warnings, or
 *    non-oauth2 security schemes do NOT fit; leave them hand-written or extend
 *    the factory deliberately.
 * 2. Keep the exported const name and every user-visible string (name, title,
 *    description, schema consts, error messages, entity label, preview keys,
 *    idKeys) byte-identical. The factory derives only `operation`,
 *    `annotations` (readOnlyHint by kind, destructiveHint for
 *    action === 'deleted') and securitySchemes; check the original literal for
 *    deviations before migrating and keep the original if it deviates.
 * 3. Move resource param/body builders into closures: `resolveTarget` adapts
 *    the existing buildXRetrieveParams/buildXDeleteParams helpers to
 *    { id, params }; `fetchList` / `retrieve` / `execute` wrap the existing
 *    SDK call expression unchanged (including casts).
 * 4. Run the existing crm-tools tests unmodified - they are the compatibility
 *    contract - plus tests/mcp-server/tool-registration.test.ts, which fails
 *    if a defined tool is missing from selectTools in server.ts.
 */

export type ToolArgs = Record<string, unknown> | undefined;

export type ListToolPayload = {
  scope?: string | null;
  provider?: string | null;
  channel_id?: string | null;
  channel_name?: string | null;
  external_object_type?: string | null;
  data_origin?: string | null;
  source_of_truth?: string | null;
  sync_state?: Record<string, unknown> | null;
  unavailable_reason?: string | null;
  next_cursor?: string | null;
  count: number;
  data: Array<Record<string, unknown>>;
  message: string;
  page: number;
  total: number;
  has_next?: boolean;
  permission?: string | null;
  hasBlockingPending?: boolean;
  rules?: unknown[];
};

export const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const readBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
};

export const readRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
};

export const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => readString(entry)).filter((entry): entry is string => Boolean(entry));
};

export const STRUCTURED_TEXT_PREVIEW_ITEM_LIMIT = 10;
const STRUCTURED_TEXT_PREVIEW_MAX_CHARS = 12000;
const LIST_SUMMARY_PRIMARY_DISPLAY_KEYS = new Set([
  'name',
  'title',
  'label',
  'display_name',
  'display_label',
  'internal_name',
  'description',
  'subject',
]);

export const buildStructuredTextPreview = (label: string, value: unknown): string | undefined => {
  const json = JSON.stringify(value, null, 2);
  if (!json || json === '{}' || json === '[]') {
    return undefined;
  }

  const truncated = json.length > STRUCTURED_TEXT_PREVIEW_MAX_CHARS;
  const body = truncated ? `${json.slice(0, STRUCTURED_TEXT_PREVIEW_MAX_CHARS)}\n...truncated...` : json;
  return `${label}:\n${body}`;
};

const readListPreviewValue = (
  row: Record<string, unknown>,
  keys: string[],
  predicate: (key: string) => boolean = () => true,
): string | undefined => {
  for (const key of keys) {
    if (!predicate(key)) {
      continue;
    }
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
};

const buildListModelContextPreview = ({
  label,
  payload,
}: {
  label: string;
  payload: ListToolPayload;
}): string | undefined =>
  buildStructuredTextPreview(`${label} model context`, {
    ...(payload.scope ? { scope: payload.scope } : undefined),
    ...(payload.provider ? { provider: payload.provider } : undefined),
    ...(payload.channel_id ? { channel_id: payload.channel_id } : undefined),
    ...(payload.channel_name ? { channel_name: payload.channel_name } : undefined),
    ...(payload.external_object_type ? { external_object_type: payload.external_object_type } : undefined),
    ...(payload.data_origin ? { data_origin: payload.data_origin } : undefined),
    ...(payload.source_of_truth ? { source_of_truth: payload.source_of_truth } : undefined),
    ...(payload.sync_state ? { sync_state: payload.sync_state } : undefined),
    ...(payload.unavailable_reason ? { unavailable_reason: payload.unavailable_reason } : undefined),
    ...(payload.next_cursor ? { next_cursor: payload.next_cursor } : undefined),
    ...(payload.permission ? { permission: payload.permission } : undefined),
    count: payload.count,
    total: payload.total,
    page: payload.page,
    ...(payload.has_next !== undefined ? { has_next: payload.has_next } : undefined),
    message: payload.message,
    results: payload.data.slice(0, STRUCTURED_TEXT_PREVIEW_ITEM_LIMIT),
  });
const readGovernanceAdvisories = (payload: Record<string, unknown>): Array<Record<string, unknown>> => {
  const advisories = payload['advisories'];
  if (!Array.isArray(advisories)) {
    return [];
  }

  return advisories
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
};

const buildGovernanceAdvisorySummary = (payload: Record<string, unknown>): string | undefined => {
  const advisories = readGovernanceAdvisories(payload);
  const missingPartnerAdvisory = advisories.find(
    (advisory) => readString(advisory['code']) === 'missing_recommended_partner',
  );
  if (missingPartnerAdvisory) {
    return (
      'Partner fields are missing. Ask the user for explicit permission before creating or linking a ' +
      'company/contact, then update this record.'
    );
  }

  const firstAdvisory = advisories[0];
  const message = firstAdvisory ? readString(firstAdvisory['message']) : undefined;
  return message ? `Governance advisory: ${message}` : undefined;
};

export const appendGovernanceAdvisorySummary = (
  summary: string,
  payload: Record<string, unknown>,
): string => {
  const advisorySummary = buildGovernanceAdvisorySummary(payload);
  return advisorySummary ? `${summary} ${advisorySummary}` : summary;
};

const buildListSummary = ({
  label,
  rows,
  total,
  previewKeys = ['name'],
}: {
  label: string;
  rows: Array<Record<string, unknown>>;
  total: number;
  previewKeys?: string[];
}): string => {
  if (rows.length === 0) {
    return `No ${label} matched the current filters.`;
  }

  const preview = rows
    .slice(0, 3)
    .map((row) => {
      const primaryDisplayValue = readListPreviewValue(row, previewKeys, (key) =>
        LIST_SUMMARY_PRIMARY_DISPLAY_KEYS.has(key),
      );
      if (primaryDisplayValue) {
        return primaryDisplayValue;
      }

      const safeRecordLabel = buildSafeRecordLabel({ entity: label, payload: row });
      if (safeRecordLabel) {
        return safeRecordLabel;
      }

      return readListPreviewValue(row, previewKeys) ?? null;
    })
    .filter((value): value is string => Boolean(value));

  const previewText = preview.length > 0 ? ` Examples: ${preview.join(', ')}.` : '';
  return `Found ${total} ${label}.${previewText}`;
};

export const buildListResult = ({
  label,
  payload,
  previewKeys,
  includeStructuredTextPreview = true,
}: {
  label: string;
  payload: ListToolPayload;
  previewKeys?: string[];
  includeStructuredTextPreview?: boolean;
}): ToolCallResult => {
  const structuredTextPreview =
    includeStructuredTextPreview ? buildListModelContextPreview({ label, payload }) : undefined;
  const summaryInput =
    previewKeys ?
      {
        label,
        rows: payload.data,
        total: payload.total,
        previewKeys,
      }
    : {
        label,
        rows: payload.data,
        total: payload.total,
      };

  return {
    content: [
      {
        type: 'text',
        text: [
          payload.unavailable_reason ?
            `${label} are unavailable: ${payload.unavailable_reason}. ${payload.message}`
          : buildListSummary(summaryInput),
          structuredTextPreview,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
    structuredContent: {
      ...(payload.scope ? { scope: payload.scope } : undefined),
      ...(payload.provider ? { provider: payload.provider } : undefined),
      ...(payload.channel_id ? { channel_id: payload.channel_id } : undefined),
      ...(payload.channel_name ? { channel_name: payload.channel_name } : undefined),
      ...(payload.external_object_type ? { external_object_type: payload.external_object_type } : undefined),
      ...(payload.data_origin ? { data_origin: payload.data_origin } : undefined),
      ...(payload.source_of_truth ? { source_of_truth: payload.source_of_truth } : undefined),
      ...(payload.sync_state ? { sync_state: payload.sync_state } : undefined),
      ...(payload.unavailable_reason ? { unavailable_reason: payload.unavailable_reason } : undefined),
      ...(payload.next_cursor ? { next_cursor: payload.next_cursor } : undefined),
      count: payload.count,
      page: payload.page,
      total: payload.total,
      ...(payload.has_next !== undefined ? { has_next: payload.has_next } : undefined),
      message: payload.message,
      permission: payload.permission ?? undefined,
      results: payload.data,
    },
  };
};

export const buildEntityMutationSummary = ({
  entity,
  action,
  payload,
  idKeys,
}: {
  entity: string;
  action: 'created' | 'updated' | 'deleted';
  payload: Record<string, unknown>;
  idKeys: string[];
}): string => {
  const target = readString(payload['target']);
  const operation = readString(payload['operation']);
  const provider = readString(payload['provider']) || 'integration';
  const dryRun = readBoolean(payload['dry_run']);
  if (target === 'integration' && operation?.startsWith('dedupe_')) {
    const remote = readRecord(payload['remote']);
    const primary =
      readString(remote?.['primary_external_id']) ||
      readString(payload['primary_external_id']) ||
      readString(payload['external_id']);
    const secondaries =
      readStringArray(remote?.['secondary_external_ids']).length > 0 ?
        readStringArray(remote?.['secondary_external_ids'])
      : readStringArray(payload['secondary_external_ids']);
    const mergeCount = secondaries.length;
    const previewText = dryRun || operation === 'dedupe_preview' ? 'preview prepared' : 'applied';
    const primaryText = primary ? ` primary=${primary}` : '';
    const mergeText = mergeCount > 0 ? ` merge_count=${mergeCount}` : '';
    return `${entity} ${provider} dedupe ${previewText}:${primaryText}${mergeText}.`;
  }

  if (target === 'integration') {
    const reference =
      readString(payload['external_id']) ||
      readString(payload['status']) ||
      readString(payload['operation']) ||
      entity;
    return `${entity} ${provider} ${operation || action}: ${reference}.`;
  }

  const reference =
    idKeys.map((key) => readString(payload[key])).find((value): value is string => Boolean(value)) ||
    readString(payload['external_id']) ||
    readString(payload['status']) ||
    entity;

  return appendGovernanceAdvisorySummary(`${entity} ${action}: ${reference}.`, payload);
};

export const buildEntityDetailSummary = ({
  entity,
  payload,
  previewKeys,
}: {
  entity: string;
  payload: Record<string, unknown>;
  previewKeys: string[];
}): string => {
  const safeRecordLabel = buildSafeRecordLabel({ entity, payload });
  if (safeRecordLabel) {
    return `Loaded ${entity} successfully: ${safeRecordLabel}.`;
  }

  for (const key of previewKeys) {
    const stringValue = readString(payload[key]);
    if (stringValue) {
      return `Loaded ${entity}: ${stringValue}.`;
    }

    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `Loaded ${entity}: ${value}.`;
    }
  }

  return `Loaded ${entity} ${readString(payload['id']) ?? ''}.`.trim();
};

type CrudToolIdentity = {
  resource: string;
  tags: string[];
  httpMethod: 'get' | 'post' | 'put' | 'patch' | 'delete';
  httpPath: string;
  operationId: string;
  name: string;
  title: string;
  description: string;
  inputSchema: ToolInputSchema;
  outputSchema: ToolOutputSchema;
};

const buildCrudToolShell = ({
  identity,
  operation,
  readOnlyHint,
  destructiveHint,
}: {
  identity: CrudToolIdentity;
  operation: 'read' | 'write';
  readOnlyHint: boolean;
  destructiveHint: boolean;
}): Omit<McpTool, 'handler'> => ({
  metadata: {
    resource: identity.resource,
    operation,
    tags: identity.tags,
    httpMethod: identity.httpMethod,
    httpPath: identity.httpPath,
    operationId: identity.operationId,
  },
  tool: {
    name: identity.name,
    title: identity.title,
    description: identity.description,
    inputSchema: identity.inputSchema,
    outputSchema: identity.outputSchema,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: identity.title,
      readOnlyHint,
      destructiveHint,
      openWorldHint: false,
    },
  },
});

/**
 * Generates a list tool: auth preamble, optional argument validation, a
 * resource-specific fetch, and the shared buildListResult plumbing.
 */
export const defineListTool = (
  options: CrudToolIdentity & {
    label: string;
    previewKeys?: string[];
    includeStructuredTextPreview?: boolean;
    validateArgs?: (args: ToolArgs) => ToolCallResult | undefined;
    fetchList: (input: { reqContext: McpRequestContext; args: ToolArgs }) => Promise<ListToolPayload>;
  },
): McpTool => ({
  ...buildCrudToolShell({
    identity: options,
    operation: 'read',
    readOnlyHint: true,
    destructiveHint: false,
  }),
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: options.title,
    });
    if (authError) {
      return authError;
    }

    const validationError = options.validateArgs?.(args);
    if (validationError) {
      return validationError;
    }

    const payload = await options.fetchList({ reqContext, args });
    return buildListResult({
      label: options.label,
      payload,
      ...(options.previewKeys ? { previewKeys: options.previewKeys } : undefined),
      ...(options.includeStructuredTextPreview !== undefined ?
        { includeStructuredTextPreview: options.includeStructuredTextPreview }
      : undefined),
    });
  },
});

/**
 * Generates a get/detail tool: auth preamble, target id resolution with the
 * tool's exact missing-id error, a resource-specific retrieve, and the shared
 * buildEntityDetailSummary plumbing.
 */
export const defineDetailTool = <TParams>(
  options: CrudToolIdentity & {
    entity: string;
    previewKeys: string[];
    missingTargetError: string;
    resolveTarget: (args: ToolArgs) => { id: string | undefined; params: TParams };
    retrieve: (input: {
      reqContext: McpRequestContext;
      id: string;
      params: TParams;
      args: ToolArgs;
    }) => Promise<unknown>;
  },
): McpTool => ({
  ...buildCrudToolShell({
    identity: options,
    operation: 'read',
    readOnlyHint: true,
    destructiveHint: false,
  }),
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: options.title,
    });
    if (authError) {
      return authError;
    }

    const { id, params } = options.resolveTarget(args);
    if (!id) {
      return asErrorResult(options.missingTargetError);
    }

    const payload = (await options.retrieve({ reqContext, id, params, args })) as Record<string, unknown>;
    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: options.entity,
            payload,
            previewKeys: options.previewKeys,
          }),
        },
      ],
      structuredContent: payload,
    };
  },
});

export type MutationAction = 'created' | 'updated' | 'deleted';

type MutationToolBase = CrudToolIdentity & {
  entity: string;
  action: MutationAction;
  idKeys: string[];
};

/**
 * Generates a create/update/delete tool: auth preamble, optional target id
 * resolution with the tool's exact missing-id error, a resource-specific SDK
 * call, and the shared buildEntityMutationSummary plumbing. destructiveHint is
 * derived from action === 'deleted'.
 */
export function defineMutationTool<TParams>(
  options: MutationToolBase & {
    resolveTarget: (args: ToolArgs) => { id: string | undefined; params: TParams };
    missingTargetError: string;
    execute: (input: {
      reqContext: McpRequestContext;
      args: ToolArgs;
      id: string;
      params: TParams;
    }) => Promise<unknown>;
  },
): McpTool;
export function defineMutationTool(
  options: MutationToolBase & {
    execute: (input: { reqContext: McpRequestContext; args: ToolArgs }) => Promise<unknown>;
  },
): McpTool;
export function defineMutationTool(
  options: MutationToolBase & {
    resolveTarget?: (args: ToolArgs) => { id: string | undefined; params: unknown };
    missingTargetError?: string;
    execute: (input: {
      reqContext: McpRequestContext;
      args: ToolArgs;
      id: string;
      params: unknown;
    }) => Promise<unknown>;
  },
): McpTool {
  return {
    ...buildCrudToolShell({
      identity: options,
      operation: 'write',
      readOnlyHint: false,
      destructiveHint: options.action === 'deleted',
    }),
    handler: async ({ reqContext, args }) => {
      const authError = requireAuthentication({
        reqContext,
        toolTitle: options.title,
      });
      if (authError) {
        return authError;
      }

      let response: unknown;
      if (options.resolveTarget) {
        const { id, params } = options.resolveTarget(args);
        if (!id) {
          return asErrorResult(options.missingTargetError!);
        }
        response = await options.execute({ reqContext, args, id, params });
      } else {
        const executeUntargeted = options.execute as (input: {
          reqContext: McpRequestContext;
          args: ToolArgs;
        }) => Promise<unknown>;
        response = await executeUntargeted({ reqContext, args });
      }

      const payload = response as Record<string, unknown>;
      return {
        content: [
          {
            type: 'text',
            text: buildEntityMutationSummary({
              entity: options.entity,
              action: options.action,
              payload,
              idKeys: options.idKeys,
            }),
          },
        ],
        structuredContent: payload,
      };
    },
  };
}

export type ToolInputSchema = NonNullable<McpTool['tool']['inputSchema']>;
export type ToolOutputSchema = NonNullable<McpTool['tool']['outputSchema']>;

export type ChunkedAttachmentUploadToolConfig = {
  resource: string;
  tags: string[];
  httpPath: string;
  operationIdPrefix: string;
  entityName: string;
  attachmentLabel: string;
  fileKindLabel: string;
  directUploadToolName: string;
  createToolName: string;
  updateToolName: string;
  startToolName: string;
  appendToolName: string;
  finishToolName: string;
  startToolTitle: string;
  appendToolTitle: string;
  finishToolTitle: string;
  uploadAttachment: (reqContext: McpRequestContext, file: File) => Promise<unknown>;
};

export type ChunkedUploadToolTriplet<T> = { start: T; append: T; finish: T };

/** The assembled file a finish tool uploaded. */
export type FinishedChunkedUpload = { filename: string; byteLength: number; contentBase64Length: number };

/**
 * A start/append/finish chunked upload: the binary upload store plumbing is shared, and the
 * config supplies every user-visible string and what the finish tool does with the file.
 */
export type ChunkedUploadToolConfig = {
  resource: string;
  tags: string[];
  /** The route the finish tool uploads the assembled file to. */
  httpPath: string;
  operationIds: ChunkedUploadToolTriplet<string>;
  names: ChunkedUploadToolTriplet<string>;
  titles: ChunkedUploadToolTriplet<string>;
  /** The uploaded file, such as "expense attachment". */
  fileLabel: string;
  /** Typical files, such as "receipt/invoice PDFs". */
  fileKindLabel: string;
  /** Start inputs required besides filename, such as content_base64_length. */
  startRequired?: string[];
  /** append and chunk replace the default append tool and content_base64 descriptions. */
  descriptions: { start: string; finish: string; append?: string; chunk?: string };
  nextActions: {
    /** After start; gets the number of max-size append calls when the length is known. */
    start: (recommendedChunkCount: number | undefined) => string;
    /** After an append that leaves chunks to send. */
    chunk: string;
    /** After the last chunk. */
    finish: string;
  };
  finish: {
    /** Finish inputs besides the upload token, such as the record the file goes to. */
    inputProperties?: Record<string, unknown>;
    required?: string[];
    /** false refuses inputs the schema does not name. */
    additionalProperties?: false;
    outputSchema: ToolOutputSchema;
    /** Runs before the chunks are assembled; a result stops the finish and keeps the upload. */
    check?: (reqContext: McpRequestContext, args: ToolArgs) => Promise<ToolCallResult | undefined>;
    upload: (reqContext: McpRequestContext, file: File, args: ToolArgs) => Promise<unknown>;
    result: (response: unknown, upload: FinishedChunkedUpload, args: ToolArgs) => ToolCallResult;
    /** Upload errors after which the staged file is kept for another finish; others end the upload. */
    keepUploadOnError?: (error: unknown) => boolean;
  };
};

const CHUNKED_ATTACHMENT_UPLOAD_START_OUTPUT_SCHEMA: ToolOutputSchema = {
  type: 'object' as const,
  properties: {
    upload_token: { type: 'string' },
    chunk_size: { type: 'number' },
    expires_at: { type: 'string' },
    next_offset: { type: 'number' },
    recommended_chunk_count: { type: 'number' },
    recommended_upload_strategy: {
      type: 'string',
      enum: ['single_append_then_finish', 'append_chunks_then_finish'],
    },
    completion_status: { type: 'string' },
    required_next_tool: { type: 'string' },
    next_action: { type: 'string' },
  },
  required: [
    'upload_token',
    'chunk_size',
    'expires_at',
    'next_offset',
    'recommended_upload_strategy',
    'completion_status',
    'required_next_tool',
    'next_action',
  ],
};

const CHUNKED_ATTACHMENT_UPLOAD_APPEND_OUTPUT_SCHEMA: ToolOutputSchema = {
  type: 'object' as const,
  properties: {
    upload_token: { type: 'string' },
    filename: { type: 'string' },
    mime_type: { type: 'string' },
    content_base64_offset: { type: 'number' },
    content_base64_length: { type: 'number' },
    expected_content_base64_length: { type: 'number' },
    expected_byte_length: { type: 'number' },
    recommended_chunk_count: { type: 'number' },
    next_offset: { type: 'number' },
    done: { type: 'boolean' },
    chunk_size: { type: 'number' },
    expires_at: { type: 'string' },
    completion_status: { type: 'string' },
    required_next_tool: { type: 'string' },
    next_action: { type: 'string' },
  },
  required: [
    'upload_token',
    'filename',
    'mime_type',
    'content_base64_offset',
    'content_base64_length',
    'next_offset',
    'done',
    'chunk_size',
    'expires_at',
    'completion_status',
    'next_action',
  ],
};

const CHUNKED_ATTACHMENT_UPLOAD_FINISH_OUTPUT_SCHEMA: ToolOutputSchema = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    file_id: { type: 'string' },
    id: { type: 'string' },
    filename: { type: 'string' },
    url: { type: 'string' },
    relative_path: { type: 'string' },
    byte_length: { type: 'number' },
    content_base64_length: { type: 'number' },
    completion_status: { type: 'string' },
    next_action: { type: 'string' },
  },
  required: ['ok', 'file_id', 'filename', 'completion_status', 'next_action'],
};

const capitalizeFirst = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const buildChunkedUploadStartInputSchema = (config: ChunkedUploadToolConfig): ToolInputSchema => ({
  type: 'object' as const,
  properties: {
    filename: {
      type: 'string',
      description: `${capitalizeFirst(config.fileLabel)} filename to preserve in Sanka.`,
    },
    mime_type: {
      type: 'string',
      description: 'Optional MIME type. Defaults to application/octet-stream.',
    },
    content_base64_length: {
      type: 'number',
      description: `Optional total base64 character length. Pass this when known so ${config.names.finish} can detect missing chunks.`,
      minimum: 1,
    },
    byte_length: {
      type: 'number',
      description: `Optional original byte length. Pass this when known so ${config.names.finish} can verify the decoded file size.`,
      minimum: 1,
    },
  },
  required: ['filename', ...(config.startRequired ?? [])],
});

const buildChunkedUploadAppendInputSchema = (config: ChunkedUploadToolConfig): ToolInputSchema => ({
  type: 'object' as const,
  properties: {
    upload_token: {
      type: 'string',
      description: `Opaque token returned by ${config.names.start}.`,
    },
    token: {
      type: 'string',
      description: 'Alias for upload_token.',
    },
    offset: {
      type: 'number',
      description:
        'Base64 character offset for this chunk. Start at 0, then use next_offset from the previous append result.',
      minimum: 0,
      default: 0,
    },
    content_base64: {
      type: 'string',
      description:
        config.descriptions.chunk ??
        `One base64 chunk of the original ${config.fileLabel}. Use the returned chunk_size as the normal target so ${config.fileKindLabel} often complete in one append call. Larger chunks are accepted up to the server max if the client can pass them without truncation.`,
    },
  },
  required: ['content_base64'],
  anyOf: [{ required: ['upload_token'] }, { required: ['token'] }],
});

const buildChunkedUploadFinishInputSchema = (config: ChunkedUploadToolConfig): ToolInputSchema => ({
  type: 'object' as const,
  properties: {
    upload_token: {
      type: 'string',
      description: `Opaque token returned by ${config.names.start}.`,
    },
    token: {
      type: 'string',
      description: 'Alias for upload_token.',
    },
    ...config.finish.inputProperties,
  },
  ...(config.finish.required?.length ? { required: config.finish.required } : undefined),
  anyOf: [{ required: ['upload_token'] }, { required: ['token'] }],
  ...(config.finish.additionalProperties === false ? { additionalProperties: false } : undefined),
});

// The verified workspace survives native OAuth token rotation and client-selected
// session churn. Older authenticated contexts share a conservative fallback pool.
const uploadPrincipal = (context: McpRequestContext): string =>
  context.auth ?
    context.auth.oauth.workspace_id ?
      `workspace:${context.auth.oauth.workspace_id}`
    : 'hosted:unresolved'
  : 'stdio';

export const createChunkedUploadTools = (
  config: ChunkedUploadToolConfig,
): {
  startTool: McpTool;
  appendTool: McpTool;
  finishTool: McpTool;
} => {
  const startTool: McpTool = {
    metadata: {
      resource: config.resource,
      operation: 'write',
      tags: config.tags,
      operationId: config.operationIds.start,
    },
    tool: {
      name: config.names.start,
      title: config.titles.start,
      description: config.descriptions.start,
      inputSchema: buildChunkedUploadStartInputSchema(config),
      outputSchema: CHUNKED_ATTACHMENT_UPLOAD_START_OUTPUT_SCHEMA,
      securitySchemes: [{ type: 'oauth2' }],
      annotations: {
        title: config.titles.start,
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    handler: async ({ reqContext, args }) => {
      const authError = requireAuthentication({
        reqContext,
        toolTitle: config.titles.start,
      });
      if (authError) {
        return authError;
      }

      const filename = readString(args?.['filename']);
      if (!filename) {
        return asErrorResult('`filename` is required.');
      }

      const expectedBase64Length =
        typeof args?.['content_base64_length'] === 'number' ? args['content_base64_length'] : undefined;
      const recommendedChunkCount =
        typeof expectedBase64Length === 'number' ?
          Math.ceil(expectedBase64Length / BINARY_UPLOAD_CHUNK_BASE64_LENGTH)
        : undefined;

      const upload = startBinaryUpload({
        filename,
        mimeType: readString(args?.['mime_type']),
        expectedBase64Length,
        expectedByteLength: typeof args?.['byte_length'] === 'number' ? args['byte_length'] : undefined,
        sessionId: reqContext.mcpSessionId,
        principalId: uploadPrincipal(reqContext),
      });
      if (!upload.ok) {
        return asErrorResult(upload.message);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Started chunked ${config.fileLabel} upload for ${filename}.`,
          },
        ],
        structuredContent: {
          upload_token: upload.uploadToken,
          chunk_size: upload.chunkSize,
          expires_at: upload.expiresAt,
          next_offset: upload.nextOffset,
          ...(recommendedChunkCount !== undefined ?
            { recommended_chunk_count: recommendedChunkCount }
          : undefined),
          completion_status: 'requires_chunks',
          required_next_tool: config.names.append,
          recommended_upload_strategy:
            recommendedChunkCount === undefined || recommendedChunkCount <= 1 ?
              'single_append_then_finish'
            : 'append_chunks_then_finish',
          next_action: config.nextActions.start(recommendedChunkCount),
        },
      };
    },
  };

  const appendTool: McpTool = {
    metadata: {
      resource: config.resource,
      operation: 'write',
      tags: config.tags,
      operationId: config.operationIds.append,
    },
    tool: {
      name: config.names.append,
      title: config.titles.append,
      description:
        config.descriptions.append ??
        `Append one base64 chunk to a ${config.fileLabel} upload started with ${config.names.start}. Send the original file base64 in ordered chunks; chunk_size is the normal target, so ${config.fileKindLabel} often complete in one append. Continue appending until the result returns done=true, then call ${config.names.finish}.`,
      inputSchema: buildChunkedUploadAppendInputSchema(config),
      outputSchema: CHUNKED_ATTACHMENT_UPLOAD_APPEND_OUTPUT_SCHEMA,
      securitySchemes: [{ type: 'oauth2' }],
      annotations: {
        title: config.titles.append,
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    handler: async ({ reqContext, args }) => {
      const authError = requireAuthentication({
        reqContext,
        toolTitle: config.titles.append,
      });
      if (authError) {
        return authError;
      }

      const uploadToken = readString(args?.['upload_token']) ?? readString(args?.['token']);
      if (!uploadToken) {
        return asErrorResult('`upload_token` is required.');
      }
      const contentBase64 = readString(args?.['content_base64']);
      if (!contentBase64) {
        return asErrorResult('`content_base64` is required.');
      }

      const chunk = appendBinaryUploadChunk({
        uploadToken,
        contentBase64,
        offset: typeof args?.['offset'] === 'number' ? args['offset'] : undefined,
        sessionId: reqContext.mcpSessionId,
        principalId: uploadPrincipal(reqContext),
      });
      if (!chunk.ok) {
        return asErrorResult(chunk.message);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Appended ${chunk.nextOffset - chunk.contentBase64Offset} base64 characters for ${
              chunk.filename
            }.`,
          },
        ],
        structuredContent: {
          upload_token: uploadToken,
          filename: chunk.filename,
          mime_type: chunk.mimeType,
          content_base64_offset: chunk.contentBase64Offset,
          content_base64_length: chunk.contentBase64Length,
          ...(chunk.expectedBase64Length !== undefined ?
            { expected_content_base64_length: chunk.expectedBase64Length }
          : undefined),
          ...(chunk.expectedByteLength !== undefined ?
            { expected_byte_length: chunk.expectedByteLength }
          : undefined),
          ...(chunk.expectedBase64Length !== undefined ?
            { recommended_chunk_count: Math.ceil(chunk.expectedBase64Length / chunk.chunkSize) }
          : undefined),
          next_offset: chunk.nextOffset,
          done: chunk.done,
          chunk_size: chunk.chunkSize,
          expires_at: chunk.expiresAt,
          completion_status: chunk.done ? 'chunks_received' : 'requires_next_chunk',
          ...(chunk.done ?
            { required_next_tool: config.names.finish }
          : { required_next_tool: config.names.append }),
          next_action: chunk.done ? config.nextActions.finish : config.nextActions.chunk,
        },
      };
    },
  };

  const finishTool: McpTool = {
    metadata: {
      resource: config.resource,
      operation: 'write',
      tags: config.tags,
      httpMethod: 'post',
      httpPath: config.httpPath,
      operationId: config.operationIds.finish,
    },
    tool: {
      name: config.names.finish,
      title: config.titles.finish,
      description: config.descriptions.finish,
      inputSchema: buildChunkedUploadFinishInputSchema(config),
      outputSchema: config.finish.outputSchema,
      securitySchemes: [{ type: 'oauth2' }],
      annotations: {
        title: config.titles.finish,
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    handler: async ({ reqContext, args }) => {
      const authError = requireAuthentication({
        reqContext,
        toolTitle: config.titles.finish,
      });
      if (authError) {
        return authError;
      }

      const uploadToken = readString(args?.['upload_token']) ?? readString(args?.['token']);
      if (!uploadToken) {
        return asErrorResult('`upload_token` is required.');
      }

      const stopped = await config.finish.check?.(reqContext, args);
      if (stopped) {
        return stopped;
      }

      const keepUploadOnError = config.finish.keepUploadOnError;
      const assembled = finishBinaryUpload({
        uploadToken,
        sessionId: reqContext.mcpSessionId,
        principalId: uploadPrincipal(reqContext),
        retain: keepUploadOnError !== undefined,
      });
      if (!assembled.ok) {
        return asErrorResult(assembled.message);
      }

      let keepUpload = false;
      try {
        const file = new File([assembled.buffer], assembled.filename, {
          type: assembled.mimeType,
        });
        const response = await config.finish.upload(reqContext, file, args);
        return config.finish.result(
          response,
          {
            filename: assembled.filename,
            byteLength: assembled.byteLength,
            contentBase64Length: assembled.contentBase64Length,
          },
          args,
        );
      } catch (error) {
        keepUpload = keepUploadOnError?.(error) === true;
        throw error;
      } finally {
        if (keepUpload && assembled.reopen) {
          assembled.reopen();
        } else {
          assembled.release();
        }
      }
    },
  };

  return { startTool, appendTool, finishTool };
};

/** The start/append/finish triplet for a record attachment that ends in a file_id. */
export const createChunkedAttachmentUploadTools = (
  config: ChunkedAttachmentUploadToolConfig,
): {
  startTool: McpTool;
  appendTool: McpTool;
  finishTool: McpTool;
} => {
  const createOrUpdateLabel = `${config.createToolName} or ${config.updateToolName}`;

  return createChunkedUploadTools({
    resource: config.resource,
    tags: config.tags,
    httpPath: config.httpPath,
    operationIds: {
      start: `${config.operationIdPrefix}.startChunkedAttachmentUpload`,
      append: `${config.operationIdPrefix}.appendChunkedAttachmentUpload`,
      finish: `${config.operationIdPrefix}.finishChunkedAttachmentUpload`,
    },
    names: { start: config.startToolName, append: config.appendToolName, finish: config.finishToolName },
    titles: { start: config.startToolTitle, append: config.appendToolTitle, finish: config.finishToolTitle },
    fileLabel: config.attachmentLabel,
    fileKindLabel: config.fileKindLabel,
    descriptions: {
      start: `Start a chunked ${config.attachmentLabel} upload for ${config.fileKindLabel} that are too large or unreliable to pass as one content_base64 string. Use ${config.directUploadToolName} when the client can pass content_base64 reliably. Start, append every chunk in order, then finish to receive a file_id for ${createOrUpdateLabel}. Do not abandon the attachment only because multiple append calls are required.`,
      finish: `Finish a chunked ${config.attachmentLabel} upload after all chunks have been appended, assemble the uploaded chunks, upload the original file to Sanka, and return the file_id for ${createOrUpdateLabel}.`,
    },
    nextActions: {
      start: (recommendedChunkCount) =>
        `Call ${
          config.appendToolName
        } with content_base64 chunks around ${BINARY_UPLOAD_CHUNK_BASE64_LENGTH} characters, using next_offset each time until append returns done=true${
          recommendedChunkCount !== undefined ?
            `; using max-size chunks this should take ${recommendedChunkCount} append call(s)`
          : ''
        }. For ordinary ${
          config.fileKindLabel
        }, prefer one reliable append call when the base64 fits within this size instead of manually slicing into tiny chunks. Then call ${
          config.finishToolName
        } to get a file_id. If this upload was started for a user-provided or required attachment, do not drop it and call ${createOrUpdateLabel} without its file_id unless the upload returns an error or the user explicitly approves skipping that attachment.`,
      chunk: `Call ${config.appendToolName} again with next_offset and the next content_base64 chunk. Do not drop this in-progress user-provided or required attachment and switch to ${createOrUpdateLabel} without its file_id while chunks remain.`,
      finish: `Call ${config.finishToolName} with this upload_token to upload the assembled file to Sanka and receive a file_id.`,
    },
    finish: {
      outputSchema: CHUNKED_ATTACHMENT_UPLOAD_FINISH_OUTPUT_SCHEMA,
      upload: (reqContext, file) => config.uploadAttachment(reqContext, file),
      result: (uploaded, upload) => {
        const response = uploaded as Record<string, unknown>;
        return {
          content: [
            {
              type: 'text',
              text: `Uploaded ${config.attachmentLabel} ${
                readString(response['filename']) || upload.filename
              }.`,
            },
          ],
          structuredContent: {
            ...response,
            filename: readString(response['filename']) || upload.filename,
            byte_length: upload.byteLength,
            content_base64_length: upload.contentBase64Length,
            completion_status: 'uploaded',
            next_action: `Pass structuredContent.file_id in attachment_file_ids when calling ${createOrUpdateLabel}, then read the ${config.entityName} back if attachment confirmation matters.`,
          },
        };
      },
    },
  });
};
