import { File } from 'node:buffer';
import { buildOAuthWwwAuthenticateHeader } from './auth';
import {
  BINARY_DOWNLOAD_INLINE_BASE64_LIMIT,
  readBinaryDownloadChunk,
  storeBinaryDownload,
} from './binary-download-store';
import {
  buildMcpConnectMarkdownLink,
  buildMcpConnectStructuredReply,
  buildMcpConnectUserFacingReply,
  buildOAuthAuthorizationUrl,
  normalizeMcpConnectScopes,
} from './mcp-connect';
import { mcpClientLooksLikeClaude, mcpClientLooksLikeCodex } from './mcp-client-info';
import {
  appendGovernanceAdvisorySummary,
  buildEntityDetailSummary,
  buildEntityMutationSummary,
  buildListResult,
  buildStructuredTextPreview,
  createChunkedAttachmentUploadTools,
  defineDetailTool,
  defineListTool,
  defineMutationTool,
  ListToolPayload,
  readBoolean,
  readRecord,
  readString,
  readStringArray,
  STRUCTURED_TEXT_PREVIEW_ITEM_LIMIT,
} from './tool-factories';
import { asBinaryDownloadResult, asErrorResult, McpRequestContext, McpTool, ToolCallResult } from './types';
import { requireAuthentication, resolveMissingScopes } from './tool-auth';
import { DEFAULT_CONNECT_SANKA_SCOPES } from './tool-scope-requirements';

const WORKSPACE_ID_DESCRIPTION =
  'Internal workspace UUID. This is not a workspace switcher; do not pass short workspace codes such as 48803074. Usually omit it so Sanka uses the authenticated workspace.';

const INTEGRATION_RECORD_SCOPE_INPUT_PROPERTIES = {
  scope: {
    type: 'string',
    description:
      'Data scope. Use "sanka" for records stored in Sanka, or "integration" to read live records from connected integrations. freee/MoneyForward integration scope maps companies to accounting partners. Do not fall back to Sanka records when an integration read returns unavailable_reason unless the user asks for synced Sanka records.',
    enum: ['sanka', 'integration'],
    default: 'sanka',
  },
  source: {
    type: 'string',
    description: 'Alias for scope. Prefer scope.',
    enum: ['sanka', 'integration'],
  },
  provider: {
    type: 'string',
    description:
      'Connected integration provider. Use with scope="integration" for live HubSpot/Salesforce data, or provider="freee"/"moneyforward" with companies to inspect accounting partners.',
    enum: ['freee', 'hubspot', 'moneyforward', 'salesforce'],
  },
  channel_id: {
    type: 'string',
    description:
      'Optional integration channel UUID. Pass this when a workspace has more than one channel for the provider.',
  },
  external_object_type: {
    type: 'string',
    description:
      'Optional provider object type override, for example HubSpot "companies", Salesforce "Account", Salesforce "Contact", or Salesforce "Product2". For object_type="custom_objects" with scope="sanka", prefer custom_object/custom_object_slug; this legacy field is also accepted.',
  },
  custom_object: {
    type: 'string',
    description:
      'For object_type="custom_objects" with scope="sanka", the Sanka custom object slug/internal key or id. Prefer this over display name.',
  },
  custom_object_slug: {
    type: 'string',
    description:
      'For object_type="custom_objects" with scope="sanka", the stable Sanka custom object slug/internal key.',
  },
  custom_object_id: {
    type: 'string',
    description: 'For object_type="custom_objects" with scope="sanka", the Sanka custom object UUID.',
  },
};

const COMPANY_INTEGRATION_MUTATION_INPUT_PROPERTIES = {
  target: {
    type: 'string',
    description:
      'Mutation destination. Use "sanka" for Sanka only, "integration" for the connected CRM only, or "both" to mutate integration first and then Sanka.',
    enum: ['sanka', 'integration', 'both'],
    default: 'sanka',
  },
  provider: {
    type: 'string',
    description:
      'Connected integration provider for target="integration" or target="both". Integration mutations support HubSpot/Salesforce where the API allows them; freee/MoneyForward are limited to company delete where companies map to accounting partners.',
    enum: ['freee', 'hubspot', 'moneyforward', 'salesforce'],
  },
  channel_id: {
    type: 'string',
    description:
      'Optional integration channel UUID. Pass this when a workspace has more than one channel for the provider.',
  },
  external_object_type: {
    type: 'string',
    description:
      'Optional provider object type override, for example HubSpot "companies"/"contacts"/"deals", Salesforce "Account"/"Contact"/"Opportunity", or freee/MoneyForward "partners". Usually omit it.',
  },
  dry_run: {
    type: 'boolean',
    description:
      'Preview the remote mutation without writing to the integration. Use this before remote delete or dedupe.',
    default: false,
  },
  confirm: {
    type: 'boolean',
    description:
      'Required to execute destructive remote mutations such as integration delete or dedupe_apply after reviewing dry_run output.',
    default: false,
  },
  operation: {
    type: 'string',
    description:
      'Optional remote operation override. Supported values include create, update, upsert, archive, delete, dedupe_preview, and dedupe_apply.',
    enum: ['create', 'update', 'upsert', 'archive', 'delete', 'dedupe_preview', 'dedupe_apply'],
  },
  primary_external_id: {
    type: 'string',
    description: 'Primary provider record id for integration dedupe operations.',
  },
  secondary_external_ids: {
    type: 'array',
    description: 'Provider record ids to merge into primary_external_id for integration dedupe operations.',
    items: { type: 'string' },
  },
};

const RECORD_INTEGRATION_MUTATION_INPUT_PROPERTIES = {
  target: COMPANY_INTEGRATION_MUTATION_INPUT_PROPERTIES.target,
  provider: COMPANY_INTEGRATION_MUTATION_INPUT_PROPERTIES.provider,
  channel_id: COMPANY_INTEGRATION_MUTATION_INPUT_PROPERTIES.channel_id,
  external_object_type: COMPANY_INTEGRATION_MUTATION_INPUT_PROPERTIES.external_object_type,
  dry_run: COMPANY_INTEGRATION_MUTATION_INPUT_PROPERTIES.dry_run,
  confirm: COMPANY_INTEGRATION_MUTATION_INPUT_PROPERTIES.confirm,
  operation: {
    type: 'string',
    description:
      'Optional remote operation override for contact/deal integration mutations. Supported values include create, update, upsert, archive, and delete.',
    enum: ['create', 'update', 'upsert', 'archive', 'delete'],
  },
};

const LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...INTEGRATION_RECORD_SCOPE_INPUT_PROPERTIES,
    search: {
      type: 'string',
      description: 'Free-text search query.',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    page: {
      type: 'integer',
      description: 'Page number to fetch.',
      minimum: 1,
      default: 1,
    },
    sort: {
      type: 'string',
      description: 'Sort field, optionally prefixed with "-" for descending order.',
    },
    view: {
      type: 'string',
      description: 'Optional saved view identifier.',
    },
    reference_id: {
      type: 'string',
      description: 'Optional reference ID for idempotent pagination or tracing.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
    select: {
      type: 'array',
      description:
        'Optional fields to return when scope/provider routing is used, for example ["id", "name", "url"].',
      items: { type: 'string' },
    },
  },
};

const RECORD_FILTER_SCHEMA = {
  type: 'object' as const,
  properties: {
    field: {
      type: 'string',
      description:
        'Built-in field to filter, for example address, name, email, status, created_at, or updated_at.',
    },
    operator: {
      type: 'string',
      description:
        'Filter operator. Supported values include equals, not_equals, contains, starts_with, ends_with, is_empty, is_not_empty, in, greater_than, greater_than_equal, less_than, and less_than_equal.',
      default: 'equals',
    },
    value: {
      description: 'Filter value. Omit for is_empty and is_not_empty.',
    },
  },
  required: ['field'],
};

const RECORD_QUERY_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...INTEGRATION_RECORD_SCOPE_INPUT_PROPERTIES,
    object_type: {
      type: 'string',
      description:
        'Record object to query. Supports companies, contacts, deals, and Sanka custom object rows. This does not fetch HubSpot deal line items or deal associations; use preview_workflow for HubSpot Deal line items. For custom object rows, set object_type="custom_objects" and custom_object/custom_object_slug to the custom object slug/internal key or id.',
      enum: [
        'companies',
        'company',
        'contacts',
        'contact',
        'deals',
        'deal',
        'opportunities',
        'opportunity',
        'custom_objects',
        'custom_object',
      ],
    },
    select: {
      type: 'array',
      description:
        'Fields to return. Keep this narrow so the MCP response stays small, for example ["id", "name", "address"] or custom object fields such as ["row_id", "Subject", "fields"].',
      items: { type: 'string' },
    },
    filters: {
      type: 'array',
      description: 'Server-side filters. Use these instead of fetching all rows and counting client-side.',
      items: RECORD_FILTER_SCHEMA,
    },
    mode: {
      type: 'string',
      description:
        'Optional query mode. Use "dedupe_candidates" to find likely duplicate groups without mutating records.',
      enum: ['dedupe_candidates'],
    },
    match_fields: {
      type: 'array',
      description:
        'Fields used by mode="dedupe_candidates", for example ["name"] for companies or ["email"] for contacts.',
      items: { type: 'string' },
    },
    min_count: {
      type: 'integer',
      description: 'Minimum records per duplicate candidate group. Defaults to 2.',
      minimum: 2,
      default: 2,
    },
    scan_limit: {
      type: 'integer',
      description:
        'Maximum records to scan while finding duplicate candidates. Keep this bounded for live integrations.',
      minimum: 1,
      maximum: 500,
      default: 250,
    },
    search: {
      type: 'string',
      description: 'Optional free-text search over the default text fields for the object.',
    },
    sort: {
      type: 'string',
      description: 'Optional built-in sort field, optionally prefixed with "-" for descending order.',
    },
    page: {
      type: 'integer',
      minimum: 1,
      default: 1,
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 25,
    },
  },
  required: ['object_type'],
};

const RECORD_QUERY_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: { type: 'string' },
    scope: { type: 'string' },
    provider: { type: 'string' },
    channel_id: { type: 'string' },
    channel_name: { type: 'string' },
    external_object_type: { type: 'string' },
    sync_state: { type: 'object' },
    unavailable_reason: { type: 'string' },
    next_cursor: { type: 'string' },
    count: { type: 'integer' },
    page: { type: 'integer' },
    limit: { type: 'integer' },
    total: { type: 'integer' },
    has_next: { type: 'boolean' },
    message: { type: 'string' },
    data_origin: { type: 'string' },
    source_of_truth: { type: 'string' },
    results: {
      type: 'array',
      items: { type: 'object' },
    },
  },
  required: ['object_type', 'count', 'page', 'limit', 'total', 'message', 'results'],
};

const RECORD_AGGREGATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...INTEGRATION_RECORD_SCOPE_INPUT_PROPERTIES,
    object_type: {
      type: 'string',
      description:
        'Record object to aggregate. Supports companies, contacts, deals, and Sanka custom object rows. For custom object rows, set object_type="custom_objects" and custom_object/custom_object_slug to the custom object slug/internal key or id.',
      enum: [
        'companies',
        'company',
        'contacts',
        'contact',
        'deals',
        'deal',
        'opportunities',
        'opportunity',
        'custom_objects',
        'custom_object',
      ],
    },
    filters: {
      type: 'array',
      description:
        'Server-side filters. For count questions, prefer aggregate_records with filters over list_* pagination.',
      items: RECORD_FILTER_SCHEMA,
    },
    mode: {
      type: 'string',
      description:
        'Optional aggregate mode. Use "dedupe_candidates" to return likely duplicate groups without mutating records.',
      enum: ['dedupe_candidates'],
    },
    match_fields: {
      type: 'array',
      description:
        'Fields used by mode="dedupe_candidates", for example ["name"] for companies or ["email"] for contacts.',
      items: { type: 'string' },
    },
    min_count: {
      type: 'integer',
      description: 'Minimum records per duplicate candidate group. Defaults to 2.',
      minimum: 2,
      default: 2,
    },
    scan_limit: {
      type: 'integer',
      description:
        'Maximum records to scan while finding duplicate candidates. Keep this bounded for live integrations.',
      minimum: 1,
      maximum: 500,
      default: 250,
    },
    search: {
      type: 'string',
      description: 'Optional free-text search over the default text fields for the object.',
    },
    metrics: {
      type: 'array',
      description: 'Aggregate metrics to compute. Currently supports count.',
      items: { type: 'string', enum: ['count'] },
      default: ['count'],
    },
    group_by: {
      type: 'array',
      description: 'Optional single built-in field to group by.',
      items: { type: 'string' },
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of groups to return when group_by is used.',
      minimum: 1,
      maximum: 100,
      default: 25,
    },
  },
  required: ['object_type'],
};

const RECORD_AGGREGATE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: { type: 'string' },
    scope: { type: 'string' },
    provider: { type: 'string' },
    channel_id: { type: 'string' },
    channel_name: { type: 'string' },
    external_object_type: { type: 'string' },
    sync_state: { type: 'object' },
    unavailable_reason: { type: 'string' },
    metrics: { type: 'object' },
    groups: {
      type: 'array',
      items: { type: 'object' },
    },
    message: { type: 'string' },
    data_origin: { type: 'string' },
    source_of_truth: { type: 'string' },
  },
  required: ['object_type', 'metrics', 'groups', 'message'],
};

const RECORD_MERGE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: {
      type: 'string',
      description: 'Sanka object type to merge. Currently supports companies and contacts.',
      enum: ['companies', 'company', 'contacts', 'contact'],
    },
    primary_record_id: {
      type: 'string',
      description:
        'Sanka UUID of the canonical record that should remain after the merge. Alias: canonical_record_id.',
    },
    canonical_record_id: {
      type: 'string',
      description: 'Alias for primary_record_id.',
    },
    duplicate_record_ids: {
      type: 'array',
      description: 'Sanka UUIDs of duplicate records to merge into the primary record.',
      items: { type: 'string' },
    },
    field_resolution: {
      type: 'object',
      description:
        'Optional per-field resolution policy. Values may be "primary", "first_non_empty", a duplicate record id, or {source_record_id} / {value}.',
      additionalProperties: true,
    },
    archive_merged_records: {
      type: 'boolean',
      description:
        'Archive duplicate records after related records are relinked to the primary record. Defaults to true.',
      default: true,
    },
    dry_run: {
      type: 'boolean',
      description: 'When true, return the merge preview without applying changes.',
      default: false,
    },
    confirm: {
      type: 'boolean',
      description: 'Required by merge_records to apply the merge after reviewing preview_record_merge.',
      default: false,
    },
    reason: {
      type: 'string',
      description: 'Optional audit note explaining why the records are being merged.',
    },
  },
  required: ['object_type', 'duplicate_record_ids'],
};

const RECORD_MERGE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: { type: 'string' },
    scope: { type: 'string' },
    source_of_truth: { type: 'string' },
    data_origin: { type: 'string' },
    status: { type: 'string' },
    merge_plan: { type: 'object' },
    field_plan: {
      type: 'array',
      items: { type: 'object' },
    },
    related_record_plan: { type: 'object' },
    result: { type: 'object' },
    audit: { type: 'object' },
    message: { type: 'string' },
  },
  required: ['object_type', 'status', 'merge_plan', 'field_plan', 'related_record_plan', 'message'],
};

const CUSTOM_OBJECT_RECORD_DATA_SCHEMA = {
  type: 'object' as const,
  description:
    'Custom object row fields. Keys may be field UUIDs, custom field names, internal_name values, or supported row fields such as owner and usage_status.',
  additionalProperties: true,
};

const CUSTOM_OBJECT_RECORD_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    custom_object: {
      type: 'string',
      description:
        'Preferred custom object identifier: stable slug/internal key or UUID. Display name is accepted as a fallback.',
    },
    customObject: {
      type: 'string',
      description: 'Alias for custom_object.',
    },
    custom_object_slug: {
      type: 'string',
      description: 'Stable custom object slug/internal key, for example "activity".',
    },
    customObjectSlug: {
      type: 'string',
      description: 'Alias for custom_object_slug.',
    },
    custom_object_id: {
      type: 'string',
      description: 'Custom object UUID.',
    },
    customObjectId: {
      type: 'string',
      description: 'Alias for custom_object_id.',
    },
    external_object_type: {
      type: 'string',
      description: 'Legacy alias for custom_object. Prefer custom_object or custom_object_slug.',
    },
    externalObjectType: {
      type: 'string',
      description: 'Alias for external_object_type.',
    },
    data: CUSTOM_OBJECT_RECORD_DATA_SCHEMA,
    associations: {
      type: 'object',
      description:
        'Optional association targets keyed by association label id/name. Values are record references such as {id, object_type}.',
      additionalProperties: true,
    },
    form_set_id: {
      type: 'string',
      description: 'Optional form/property set id to validate against.',
    },
    property_set_id: {
      type: 'string',
      description: 'Alias for form_set_id.',
    },
    view_id: {
      type: 'string',
      description: 'Optional view id for form resolution.',
    },
  },
  required: [],
};

const CUSTOM_OBJECT_RECORD_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    record_id: {
      type: 'string',
      description: 'Custom object row UUID to update.',
    },
    data: CUSTOM_OBJECT_RECORD_DATA_SCHEMA,
    associations: CUSTOM_OBJECT_RECORD_CREATE_INPUT_SCHEMA.properties.associations,
    form_set_id: CUSTOM_OBJECT_RECORD_CREATE_INPUT_SCHEMA.properties.form_set_id,
    property_set_id: CUSTOM_OBJECT_RECORD_CREATE_INPUT_SCHEMA.properties.property_set_id,
    view_id: CUSTOM_OBJECT_RECORD_CREATE_INPUT_SCHEMA.properties.view_id,
  },
  required: ['record_id'],
};

const CUSTOM_OBJECT_RECORD_ARCHIVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    record_id: {
      type: 'string',
      description: 'Custom object row UUID to archive.',
    },
  },
  required: ['record_id'],
};

const CUSTOM_OBJECT_RECORD_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    data: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        row_id: { type: 'integer' },
        property_set_id: { type: 'string' },
        status: { type: 'string' },
      },
      required: ['id'],
    },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['data', 'message'],
};

const ASSOCIATION_REF_INPUT_PROPERTIES = {
  source_object: {
    type: 'string',
    description:
      'Source Sanka object slug, for example companies, contacts, deals, orders, invoices, payments, bills, or custom_objects.',
  },
  source_id: {
    type: 'string',
    description: 'Source record identifier. Accepts the public API identifier supported for that object.',
  },
  source_custom_object_id: {
    type: 'string',
    description: 'Required when source_object is custom_objects; pass the custom object id, slug, or name.',
  },
  target_object: {
    type: 'string',
    description:
      'Target Sanka object slug, for example companies, contacts, deals, orders, invoices, payments, bills, or custom_objects.',
  },
  target_id: {
    type: 'string',
    description: 'Target record identifier. Accepts the public API identifier supported for that object.',
  },
  target_custom_object_id: {
    type: 'string',
    description: 'Required when target_object is custom_objects; pass the custom object id, slug, or name.',
  },
  label_id: {
    type: 'string',
    description: 'Association label UUID. Prefer this when known.',
  },
  label: {
    type: 'string',
    description:
      'Association label name. Use when label_id is not known; the label must allow the source and target object types.',
  },
};

const ASSOCIATION_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...ASSOCIATION_REF_INPUT_PROPERTIES,
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    page: {
      type: 'integer',
      minimum: 1,
      default: 1,
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 25,
    },
  },
};

const ASSOCIATION_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: ASSOCIATION_REF_INPUT_PROPERTIES,
  required: ['source_object', 'source_id', 'target_object', 'target_id'],
};

const ASSOCIATION_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    association_id: {
      type: 'string',
      description:
        'Association edge UUID to delete. If omitted, source_object/source_id, target_object/target_id, and label_id or label are required.',
    },
    associationId: {
      type: 'string',
      description: 'Alias for association_id.',
    },
    id: {
      type: 'string',
      description: 'Alias for association_id.',
    },
    ...ASSOCIATION_REF_INPUT_PROPERTIES,
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
};

const ASSOCIATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    source: { type: 'object', additionalProperties: true },
    target: { type: 'object', additionalProperties: true },
    label: { type: 'object', additionalProperties: true },
    created_at: { type: 'string' },
  },
  required: ['id', 'source', 'target'],
};

const ASSOCIATION_LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    count: { type: 'integer' },
    page: { type: 'integer' },
    total: { type: 'integer' },
    message: { type: 'string' },
    results: {
      type: 'array',
      items: ASSOCIATION_OUTPUT_SCHEMA,
    },
    ctx_id: { type: 'string' },
  },
  required: ['count', 'page', 'total', 'message', 'results'],
};

const ASSOCIATION_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    association: ASSOCIATION_OUTPUT_SCHEMA,
    created: { type: 'boolean' },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['association', 'created', 'message'],
};

const ASSOCIATION_DELETE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    deleted: { type: 'boolean' },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['deleted', 'message'],
};

type OrderLineItem = {
  item_id?: string;
  itemExternalId?: string;
  price?: number;
  quantity?: number;
  tax?: number;
  tax_rate?: number;
};

type PublicLineItem = Record<string, unknown>;

type AttachmentFilePayload = {
  files: Array<{ file_id: string }>;
};

type OrderPayload = {
  externalId: string;
  items?: OrderLineItem[];
  line_items?: PublicLineItem[];
  attachment_file?: AttachmentFilePayload;
  companyExternalId?: string;
  companyId?: string;
  deliveryStatus?: string;
  orderAt?: string;
};

type OrderPayloadDraft = Partial<OrderPayload> & {
  items?: OrderLineItem[];
  line_items?: PublicLineItem[];
  attachment_file?: AttachmentFilePayload;
};

type OrderMutationPayload = {
  order: OrderPayload;
  createMissingItems?: boolean;
  triggerWorkflows?: boolean;
};

type OrderMutationPayloadDraft = {
  order?: OrderPayloadDraft;
  createMissingItems?: boolean;
  triggerWorkflows?: boolean;
};

type TaskMutationPayload = {
  external_id?: string;
  title?: string;
  description?: string;
  status?: string;
  usage_status?: string;
  project_id?: string;
  start_date?: string;
  due_date?: string;
  main_task_id?: string;
  owner_id?: string;
  assignees?: string[];
  projects?: string[];
};

const COMPANY_MUTATION_INPUT_PROPERTIES = {
  ...COMPANY_INTEGRATION_MUTATION_INPUT_PROPERTIES,
  address: {
    type: 'string',
    description: 'Company address.',
  },
  allowed_in_store: {
    type: 'boolean',
    description: 'Whether the company is allowed in store.',
  },
  email: {
    type: 'string',
    description: 'Company email address.',
  },
  external_id: {
    type: 'string',
    description:
      'External reference used for Sanka idempotent create/update flows, or the provider record id for integration update/delete.',
  },
  custom_fields: {
    type: 'object',
    description:
      'Sanka custom field values keyed by property id or internal_name. Company billing_cycle and payment_cycle are standard company fields, so prefer the top-level billing_cycle/payment_cycle inputs instead of custom_fields. For integration mutations custom_fields are forwarded as provider property names.',
  },
  billing_cycle: {
    type: 'string',
    description:
      'Sanka company billing cycle standard field. Use "end" for month-end closing or "1" through "31" for a specific monthly closing day.',
  },
  payment_cycle: {
    type: 'string',
    description:
      'Sanka company payment cycle standard field. Examples: "nmonth_end" for end of next month, "cmonth_end" for end of current month, or "net_30". Ask for clarification if the user only says "月末払い".',
  },
  name: {
    type: 'string',
    description: 'Company name.',
  },
  phone_number: {
    type: 'string',
    description: 'Company phone number.',
  },
  status: {
    type: 'string',
    description: 'Company status.',
  },
  url: {
    type: 'string',
    description: 'Company website URL.',
  },
};

const COMPANY_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: COMPANY_MUTATION_INPUT_PROPERTIES,
  required: [],
};

const COMPANY_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    company_id: {
      type: 'string',
      description: 'Company identifier. Accepts a UUID, numeric company id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['company_id'],
};

const COMPANY_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    company_id: {
      type: 'string',
      description: 'Company identifier to update.',
    },
    ...COMPANY_MUTATION_INPUT_PROPERTIES,
  },
  required: ['company_id'],
};

const COMPANY_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    company_id: {
      type: 'string',
      description:
        'Company identifier to delete. For target=integration with provider=freee/moneyforward/salesforce, pass the provider record id here or in external_id.',
    },
    ...COMPANY_INTEGRATION_MUTATION_INPUT_PROPERTIES,
    external_id: {
      type: 'string',
      description:
        'Optional explicit external id lookup override. For provider=freee/moneyforward this is the accounting partner id; for provider=salesforce this is the Salesforce record id.',
    },
  },
  required: [],
};

const CONTACT_MUTATION_INPUT_PROPERTIES = {
  ...RECORD_INTEGRATION_MUTATION_INPUT_PROPERTIES,
  allowed_in_store: {
    type: 'boolean',
    description: 'Whether the contact is allowed in store.',
  },
  company: {
    type: 'string',
    description: 'Plain-text company name associated with the contact.',
  },
  custom_fields: {
    type: 'object',
    description:
      'Custom field values. For integration mutations these are forwarded as provider property names.',
  },
  email: {
    type: 'string',
    description: 'Contact email address.',
  },
  external_id: {
    type: 'string',
    description: 'External reference used for idempotent create/update flows.',
  },
  last_name: {
    type: 'string',
    description: 'Contact last name.',
  },
  name: {
    type: 'string',
    description: 'Contact first or full name.',
  },
  phone_number: {
    type: 'string',
    description: 'Contact phone number.',
  },
  status: {
    type: 'string',
    description: 'Contact status.',
  },
};

const CONTACT_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: CONTACT_MUTATION_INPUT_PROPERTIES,
  required: [],
};

const CONTACT_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    contact_id: {
      type: 'string',
      description: 'Contact identifier. Accepts a UUID, numeric contact id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['contact_id'],
};

const CONTACT_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    contact_id: {
      type: 'string',
      description: 'Contact identifier to update.',
    },
    ...CONTACT_MUTATION_INPUT_PROPERTIES,
  },
  required: ['contact_id'],
};

const CONTACT_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    contact_id: {
      type: 'string',
      description: 'Contact identifier to delete.',
    },
    ...RECORD_INTEGRATION_MUTATION_INPUT_PROPERTIES,
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['contact_id'],
};

const EXPENSE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of expenses to return from the newest-first expense list.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    page: {
      type: 'integer',
      description: 'Page number to fetch.',
      minimum: 1,
      default: 1,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const EXPENSE_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    expense_id: {
      type: 'string',
      description: 'Expense identifier. May be a UUID, PM numeric id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['expense_id'],
};

const EXPENSE_MUTATION_INPUT_PROPERTIES = {
  amount: {
    type: 'number',
    description: 'Expense amount in the provided currency.',
  },
  attachment_file_ids: {
    type: 'array',
    description:
      'Optional uploaded expense attachment file IDs to bind to the expense. For already available base64 payloads, upload receipt or invoice files with upload_expense_attachment. For client-local PDFs or any payload that may truncate in one call, use start_expense_attachment_upload, append_expense_attachment_upload_chunk until done, then finish_expense_attachment_upload; ordinary receipt PDFs should usually take one append call. Pass the returned file_id values here.',
    items: {
      type: 'string',
    },
  },
  company_external_id: {
    type: 'string',
    description: 'Optional supplier company external id.',
  },
  company_id: {
    type: 'string',
    description: 'Optional supplier company id.',
  },
  contact_external_id: {
    type: 'string',
    description: 'Optional supplier contact external id.',
  },
  contact_id: {
    type: 'string',
    description: 'Optional supplier contact id.',
  },
  currency: {
    type: 'string',
    description: 'Expense currency code.',
  },
  description: {
    type: 'string',
    description: 'Human-readable expense description.',
  },
  due_date: {
    type: 'string',
    description: 'Optional due date in ISO format.',
  },
  external_id: {
    type: 'string',
    description: 'Optional external id for idempotent upsert-style integrations.',
  },
  reimburse_date: {
    type: 'string',
    description: 'Optional reimbursement date in ISO format.',
  },
  status: {
    type: 'string',
    description: 'Expense status.',
  },
};

const EXPENSE_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: EXPENSE_MUTATION_INPUT_PROPERTIES,
};

const EXPENSE_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    expense_id: {
      type: 'string',
      description: 'Expense identifier to update.',
    },
    ...EXPENSE_MUTATION_INPUT_PROPERTIES,
  },
  required: ['expense_id'],
};

const EXPENSE_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    expense_id: {
      type: 'string',
      description: 'Expense identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['expense_id'],
};

const EMPLOYEE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of employees to return.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    page: {
      type: 'integer',
      description: 'Page number to fetch.',
      minimum: 1,
      default: 1,
    },
    search: {
      type: 'string',
      description: 'Optional employee name, email, username, or record number search.',
    },
    sort: {
      type: 'string',
      description:
        'Sort field, optionally prefixed with "-". Supported fields include id_user, id_worker, name, email, created_at, updated_at, status, and login_blocked.',
    },
    view: {
      type: 'string',
      description: 'Optional saved employee view identifier.',
    },
    usage_status: {
      type: 'string',
      description: 'Optional employee usage status. Use archived to list inactive employees.',
      enum: ['active', 'archived'],
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override, for example ja or en.',
    },
  },
};

const ABSENCE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of absences to return.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    page: {
      type: 'integer',
      description: 'Page number to fetch.',
      minimum: 1,
      default: 1,
    },
    worker_id: {
      type: 'string',
      description: 'Optional Worker UUID to filter leave and absence records.',
    },
    status: {
      type: 'string',
      description: 'Optional absence status, for example submitted, approved, declined, or draft.',
    },
    usage_status: {
      type: 'string',
      description: 'Optional usage status. Defaults to active.',
    },
    start_date_from: {
      type: 'string',
      description: 'Optional lower bound for start_date in YYYY-MM-DD format.',
    },
    start_date_to: {
      type: 'string',
      description: 'Optional upper bound for start_date in YYYY-MM-DD format.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
};

const ABSENCE_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    absence_id: {
      type: 'string',
      description: 'Absence identifier. May be a UUID or workspace absence number.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['absence_id'],
};

const ABSENCE_MUTATION_INPUT_PROPERTIES = {
  worker_id: {
    type: 'string',
    description: 'Worker UUID for the person taking leave.',
  },
  start_date: {
    type: 'string',
    description: 'Absence start date in YYYY-MM-DD format.',
  },
  end_date: {
    type: 'string',
    description: 'Absence end date in YYYY-MM-DD format.',
  },
  absence_type: {
    type: 'string',
    description: 'Absence type, for example pto, sick, or personal.',
  },
  status: {
    type: 'string',
    description: 'Absence status, for example submitted, approved, declined, or draft.',
  },
  requested_by_user_id: {
    type: 'integer',
    description: 'Optional requesting User id. Defaults to the authenticated user.',
  },
  approved_by_user_id: {
    type: 'integer',
    description: 'Optional approving User id.',
  },
  requester_name: {
    type: 'string',
    description: 'Optional requester display name.',
  },
  note: {
    type: 'string',
    description: 'Optional leave request note or reason.',
  },
};

const ABSENCE_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: ABSENCE_MUTATION_INPUT_PROPERTIES,
};

const ABSENCE_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    absence_id: {
      type: 'string',
      description: 'Absence identifier to update.',
    },
    ...ABSENCE_MUTATION_INPUT_PROPERTIES,
  },
  required: ['absence_id'],
};

const ATTENDANCE_RECORD_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of attendance records to return.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    page: {
      type: 'integer',
      description: 'Page number to fetch.',
      minimum: 1,
      default: 1,
    },
    search: {
      type: 'string',
      description: 'Optional name or numeric attendance record search.',
    },
    usage_status: {
      type: 'string',
      description: 'Optional usage status. Defaults to active.',
    },
    sort: {
      type: 'string',
      description:
        'Sort field, optionally prefixed with "-". Supported fields include created_at, start_time, end_time, and track_id.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
};

const ATTENDANCE_RECORD_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    attendance_record_id: {
      type: 'string',
      description: 'Attendance record identifier. May be a UUID, numeric track id, or external_id.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['attendance_record_id'],
};

const ATTENDANCE_RECORD_SUBTRACK_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: {
      type: 'string',
      description: 'Existing subtrack UUID when updating a subtrack.',
    },
    name: {
      type: 'string',
      description: 'Optional subtrack name.',
    },
    start_time: {
      type: 'string',
      description: 'Optional start time. Use YYYY-MM-DD HH:mm for English locale.',
    },
    hours: {
      type: 'integer',
      default: 0,
    },
    minutes: {
      type: 'integer',
      default: 0,
    },
    seconds: {
      type: 'integer',
      default: 0,
    },
    activity_track_type: {
      type: 'string',
      description: 'work or break.',
      enum: ['work', 'break'],
      default: 'work',
    },
    delete: {
      type: 'boolean',
      description: 'Set true to remove this subtrack on update.',
      default: false,
    },
  },
};

const ATTENDANCE_RECORD_MUTATION_INPUT_PROPERTIES = {
  external_id: {
    type: 'string',
    description: 'Optional external id for idempotent integrations.',
  },
  name: {
    type: 'string',
    description: 'Attendance record name.',
  },
  assignee_user_id: {
    type: 'integer',
    description: 'Optional assignee User id. Defaults to the authenticated user.',
  },
  control_time_mode: {
    type: 'string',
    description: 'manual_entry or timetracker.',
    enum: ['manual_entry', 'timetracker'],
    default: 'manual_entry',
  },
  timetracker_toggle: {
    type: 'boolean',
    description: 'Start a running timetracker entry when true.',
    default: false,
  },
  subtracks: {
    type: 'array',
    description: 'Manual work or break segments.',
    items: ATTENDANCE_RECORD_SUBTRACK_SCHEMA,
  },
  custom_fields: {
    type: 'object',
    description: 'Optional custom field values keyed by field UUID.',
  },
};

const ATTENDANCE_RECORD_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: ATTENDANCE_RECORD_MUTATION_INPUT_PROPERTIES,
  required: ['name'],
};

const ATTENDANCE_RECORD_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    attendance_record_id: {
      type: 'string',
      description: 'Attendance record identifier to update.',
    },
    ...ATTENDANCE_RECORD_MUTATION_INPUT_PROPERTIES,
  },
  required: ['attendance_record_id'],
};

const PAYROLL_PROFILE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    employee_id: {
      type: 'string',
      description: 'Optional Worker UUID or supported employee token.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
};

const PAYROLL_PROFILE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    employee_id: {
      type: 'string',
      description: 'Worker UUID or supported employee token.',
    },
    jurisdiction_country_code: {
      type: 'string',
      description: 'Optional payroll jurisdiction country code. Defaults from workspace settings.',
    },
    pay_type: {
      type: 'string',
      description: 'Payroll pay type, for example monthly, hourly, or director.',
      default: 'monthly',
    },
    base_salary: {
      type: 'number',
      description: 'Base salary amount.',
    },
    hourly_rate: {
      type: 'number',
      description: 'Optional hourly rate.',
    },
    scheduled_monthly_hours: {
      type: 'number',
      description: 'Optional scheduled monthly hours.',
    },
    tax_table_type: {
      type: 'string',
      description: 'Tax table type. JP default is ko.',
      default: 'ko',
    },
    dependent_count: {
      type: 'integer',
      default: 0,
    },
    resident_tax_monthly_amount: {
      type: 'number',
      default: 0,
    },
    standard_monthly_remuneration: {
      type: 'number',
    },
    health_insurance_prefecture_code: {
      type: 'string',
    },
    is_health_insurance_enrolled: {
      type: 'boolean',
      default: false,
    },
    is_care_insurance_enrolled: {
      type: 'boolean',
      default: false,
    },
    is_pension_enrolled: {
      type: 'boolean',
      default: false,
    },
    is_employment_insurance_enrolled: {
      type: 'boolean',
      default: false,
    },
    effective_from: {
      type: 'string',
      description: 'Optional effective start date in YYYY-MM-DD format.',
    },
    effective_to: {
      type: 'string',
      description: 'Optional effective end date in YYYY-MM-DD format.',
    },
    extra_settings: {
      type: 'object',
      description: 'Optional country-specific payroll calculation overrides.',
    },
  },
  required: ['employee_id'],
};

const PAYROLL_RUN_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    period: {
      type: 'string',
      description: 'Optional payroll period in YYYY-MM format.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
};

const PAYROLL_RUN_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    run_id: {
      type: 'string',
      description: 'Payroll run UUID.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['run_id'],
};

const PAYROLL_PAYSLIP_PDF_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    run_id: {
      type: 'string',
      description: 'Payroll run UUID.',
    },
    result_id: {
      type: 'string',
      description: 'Optional payroll employee result UUID. Omit to download all payslips in the run.',
    },
    employee_id: {
      type: 'string',
      description:
        'Optional Worker UUID or supported employee token. Omit to download all payslips in the run.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override for the generated PDF labels, for example ja or en.',
    },
  },
  required: ['run_id'],
};

const PAYROLL_RUN_CALCULATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    period: {
      type: 'string',
      description: 'Payroll period in YYYY-MM format.',
    },
    pay_date: {
      type: 'string',
      description: 'Optional pay date in YYYY-MM-DD format.',
    },
    country_code: {
      type: 'string',
      description: 'Optional payroll country code. Currently JP is supported.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['period'],
};

const PAYROLL_JOURNAL_ENTRY_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    run_id: {
      type: 'string',
      description: 'Payroll run UUID to convert into one monthly Sanka Journal Entry.',
    },
    debit_account: {
      type: 'string',
      description: 'Optional debit journal account. Defaults to salaries and allowances.',
    },
    credit_account: {
      type: 'string',
      description: 'Optional credit journal account for net pay. Defaults to other accounts payable.',
    },
    deductions_account: {
      type: 'string',
      description: 'Optional credit journal account for payroll deductions. Defaults to deposits received.',
    },
    notes: {
      type: 'string',
      description: 'Optional journal entry notes.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['run_id'],
};

const INCENTIVE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of incentives to return.',
      minimum: 1,
      maximum: 100,
      default: 25,
    },
    page: {
      type: 'integer',
      description: 'Page number to fetch.',
      minimum: 1,
      default: 1,
    },
    period: {
      type: 'string',
      description: 'Optional incentive period in YYYY-MM format.',
    },
    status: {
      type: 'string',
      description: 'Optional incentive status filter, for example draft, approved, paid, or reversed.',
    },
    owner_user_id: {
      type: 'string',
      description:
        'Optional owner UserManagement id. Finance users can filter any owner; managers are scoped by Sanka permissions.',
    },
    source_object_type: {
      type: 'string',
      description: 'Optional source object type, for example invoices, receipts, or commerce_orders.',
    },
    search: {
      type: 'string',
      description: 'Search rule name, payee, source label, owner, or source record id.',
    },
    sort: {
      type: 'string',
      description: 'Optional sort field.',
    },
    sort_direction: {
      type: 'string',
      description: 'Optional sort direction: asc or desc.',
      enum: ['asc', 'desc'],
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const INCENTIVE_PLAN_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const INCENTIVE_COMPANY_OPTIONS_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    q: {
      type: 'string',
      description: 'Company name, company id, or UUID search text.',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of company options to return.',
      minimum: 1,
      maximum: 100,
      default: 30,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const INCENTIVE_PLAN_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: {
      type: 'string',
      description: 'Rule name.',
    },
    base_event: {
      type: 'string',
      description: 'Trigger event: order_confirmed, payment_received, or invoice_paid.',
      enum: ['order_confirmed', 'payment_received', 'invoice_paid'],
    },
    source_status: {
      type: 'string',
      description: 'Optional source status filter, for example paid for invoice_paid.',
    },
    source_company_id: {
      type: 'string',
      description:
        'Optional source customer company UUID. Use list_companies or list_incentive_company_options to resolve it.',
    },
    payee_type: {
      type: 'string',
      description: 'Payee object type. Use company for partner commissions and user for employee incentives.',
      enum: ['company', 'user'],
      default: 'user',
    },
    payee_company_id: {
      type: 'string',
      description: 'Required when payee_type is company. Company UUID to receive commission.',
    },
    amount_basis: {
      type: 'string',
      description: 'Amount basis for invoice calculations.',
      enum: ['tax_exclusive', 'tax_inclusive'],
      default: 'tax_exclusive',
    },
    rate_type: {
      type: 'string',
      description: 'Calculation method: percentage or fixed.',
      enum: ['percentage', 'fixed'],
    },
    rate_value: {
      type: 'number',
      description: 'Percentage value or fixed amount.',
    },
    effective_from: {
      type: 'string',
      description: 'Rule start date in YYYY-MM-DD format.',
    },
    effective_to: {
      type: 'string',
      description: 'Optional rule end date in YYYY-MM-DD format.',
    },
    status: {
      type: 'string',
      description: 'Plan status.',
      enum: ['active', 'inactive'],
      default: 'active',
    },
    min_amount: {
      type: 'number',
      description: 'Optional minimum base amount required for payout.',
    },
    max_payout_amount: {
      type: 'number',
      description: 'Optional maximum payout per incentive.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['name', 'base_event', 'rate_type', 'rate_value', 'effective_from'],
};

const INCENTIVE_CALCULATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    period: {
      type: 'string',
      description: 'Incentive period in YYYY-MM format.',
    },
    plan_id: {
      type: 'string',
      description: 'Optional rule id. Omit to use the active rule for the period.',
    },
    owner_user_id: {
      type: 'string',
      description: 'Optional owner UserManagement id for user incentives.',
    },
    dry_run: {
      type: 'boolean',
      description: 'When true, preview candidate incentives without storing drafts.',
      default: true,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['period'],
};

const INCENTIVE_APPROVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    incentive_id: {
      type: 'string',
      description: 'Single incentive UUID to approve.',
    },
    ids: {
      type: 'array',
      description: 'Multiple incentive UUIDs to approve in one request.',
      items: { type: 'string' },
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
};

const INCENTIVE_NOTICE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    period_from: {
      type: 'string',
      description: 'First incentive period in YYYY-MM format.',
    },
    period_to: {
      type: 'string',
      description: 'Last incentive period in YYYY-MM format. Defaults to period_from.',
    },
    status: {
      type: 'string',
      description: 'Optional incentive status filter. For payment requests, approved is usually appropriate.',
    },
    payee_company_id: {
      type: 'string',
      description: 'Optional partner/payee company UUID.',
    },
    payee_company_name: {
      type: 'string',
      description: 'Optional partner/payee company name to display when no rows are returned.',
    },
    request_date: {
      type: 'string',
      description: 'Optional request date in YYYY-MM-DD format. Defaults to today.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Notice language. Use ja for Japanese output.',
      default: 'ja',
    },
  },
  required: ['period_from'],
};

const EXPENSE_UPLOAD_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    filename: {
      type: 'string',
      description: 'Attachment filename to preserve in Sanka.',
    },
    content_base64: {
      type: 'string',
      description:
        'Base64-encoded original file content. Data URLs are also accepted. For normal receipts or invoices, keep the original PDF bytes; do not shrink, rasterize, or replace the document with extracted text just because it is a few hundred KB. If the client-local file may be truncated or unreliable as one tool argument, use the chunked upload tools instead.',
    },
    mime_type: {
      type: 'string',
      description: 'Optional MIME type override.',
    },
  },
  required: ['filename', 'content_base64'],
};

const CONTRACT_TEMPLATE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
};

const CONTRACT_TEMPLATE_DOWNLOAD_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    template_id: {
      type: 'string',
      description: 'Contract template UUID to download.',
    },
    source: {
      type: 'boolean',
      description:
        'When true, download the retained source file such as DOCX if available. When false, download the signing PDF.',
      default: true,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['template_id'],
};

const CONTRACT_TEMPLATE_UPLOAD_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    filename: {
      type: 'string',
      description: 'Template filename. PDF, DOC, and DOCX are supported by the Sanka API.',
    },
    content_base64: {
      type: 'string',
      description:
        'Base64-encoded original template file content. Data URLs are also accepted. Upload the original PDF/DOC/DOCX bytes. Max decoded size: 20 MiB.',
    },
    mime_type: {
      type: 'string',
      description: 'Optional MIME type override.',
    },
    name: {
      type: 'string',
      description: 'Display name for the contract template.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['filename', 'content_base64'],
};

const CONTRACT_PDF_UPLOAD_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    filename: {
      type: 'string',
      description: 'PDF filename to preserve for the contract draft.',
    },
    content_base64: {
      type: 'string',
      description: 'Base64-encoded PDF bytes. Data URLs are also accepted. Max decoded size: 20 MiB.',
    },
    mime_type: {
      type: 'string',
      description: 'Optional MIME type override. Defaults to application/pdf.',
    },
    title: {
      type: 'string',
      description: 'Optional contract draft title.',
    },
    file_name_override: {
      type: 'string',
      description: 'Optional file name override accepted by the Sanka API.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['filename', 'content_base64'],
};

const CONTRACT_CREATE_FROM_TEMPLATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    template_id: {
      type: 'string',
      description: 'Contract template UUID to copy into a new contract draft.',
    },
    title: {
      type: 'string',
      description: 'Optional contract draft title. Defaults to the template name.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent to the API.',
    },
  },
  required: ['template_id'],
};

const CONTRACT_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    contract_id: {
      type: 'string',
      description: 'Contract identifier.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['contract_id'],
};

const CONTRACT_METADATA_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    contract_id: {
      type: 'string',
      description: 'Contract identifier.',
    },
    name: {
      type: 'string',
      description: 'Contract display name.',
    },
    description: {
      type: 'string',
      description: 'Contract description or internal note.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['contract_id'],
};

const CONTRACT_SIGNERS_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    contract_id: {
      type: 'string',
      description: 'Contract identifier.',
    },
    signers: {
      type: 'array',
      description: 'Signer rows with name and optional email.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    signature_id: {
      type: 'string',
      description: 'Optional legacy signature id.',
    },
    add_me_as_signer: {
      type: 'boolean',
      description: 'When true, add the authenticated user as a signer.',
      default: false,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['contract_id'],
};

const CONTRACT_PLACE_FIELDS_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    contract_id: {
      type: 'string',
      description: 'Contract identifier.',
    },
    fields: {
      type: 'array',
      description:
        'Signature field placements. Each row requires signer_id, page, left, top, width, height, page_width, and page_height.',
      items: {
        type: 'object',
        properties: {
          signer_id: { type: 'string' },
          page: { type: 'integer', minimum: 1 },
          left: { type: 'number' },
          top: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          page_width: { type: 'number' },
          page_height: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['contract_id', 'fields'],
};

const CONTRACT_SEND_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    contract_id: {
      type: 'string',
      description: 'Contract identifier.',
    },
    content: {
      type: 'string',
      description: 'Message sent to signers.',
    },
    language: {
      type: 'string',
      description: 'Optional language or locale such as ja or en.',
    },
    resend: {
      type: 'boolean',
      description: 'When true, resend a previously sent request using the persisted body.',
      default: false,
    },
    no_send_request: {
      type: 'boolean',
      description: 'When true, persist signing state without sending external email.',
      default: false,
    },
    confirm: {
      type: 'boolean',
      description:
        'Required true after explicit user approval because this may send signature request emails to external signers.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['contract_id', 'confirm'],
};

const CONTRACT_SCHEDULE_SEND_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    contract_id: {
      type: 'string',
      description: 'Contract identifier.',
    },
    content: {
      type: 'string',
      description: 'Message sent to signers.',
    },
    scheduled_at: {
      type: 'string',
      description: 'ISO datetime when the signature request should be sent.',
    },
    language: {
      type: 'string',
      description: 'Optional language or locale such as ja or en.',
    },
    confirm: {
      type: 'boolean',
      description:
        'Required true after explicit user approval because this schedules signature request emails to external signers.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['contract_id', 'scheduled_at', 'confirm'],
};

const LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    scope: { type: 'string' },
    provider: { type: 'string' },
    channel_id: { type: 'string' },
    channel_name: { type: 'string' },
    external_object_type: { type: 'string' },
    sync_state: { type: 'object' },
    unavailable_reason: { type: 'string' },
    next_cursor: { type: 'string' },
    count: { type: 'integer' },
    page: { type: 'integer' },
    total: { type: 'integer' },
    message: { type: 'string' },
    permission: { type: 'string' },
    data_origin: { type: 'string' },
    source_of_truth: { type: 'string' },
    results: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
  },
  required: ['count', 'page', 'total', 'message', 'results'],
};

const PRIVATE_MESSAGE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    status: {
      type: 'string',
      description:
        'Optional authenticated-user private/personal account-level inbox thread status filter. Do not use for Sanka workspace Gmail integrations, /conversation, or shared inbox threads.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const PRIVATE_MESSAGE_SYNC_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    channel_id: {
      type: 'string',
      description:
        'Optional authenticated-user private/personal account-level inbox channel id to sync. Do not use for integration-linked Gmail, /conversation, or shared workspace inbox channels.',
    },
    status: {
      type: 'string',
      description:
        'Optional authenticated-user private/personal account-level inbox thread status filter to return after sync.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const PRIVATE_MESSAGE_THREAD_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    thread_id: {
      type: 'string',
      description:
        'Authenticated-user private/personal account-level inbox thread identifier. Not a /conversation shared workspace thread.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['thread_id'],
};

const PRIVATE_MESSAGE_REPLY_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    thread_id: {
      type: 'string',
      description:
        'Authenticated-user private/personal account-level inbox thread identifier. Not a /conversation shared workspace thread.',
    },
    body: {
      type: 'string',
      description:
        'Reply body to send on an authenticated-user private/personal account-level message thread.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['thread_id', 'body'],
};

const PRIVATE_MESSAGE_CHANNEL_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    integration_slug: { type: 'string' },
    display_name: { type: 'string' },
    account_username: { type: 'string' },
    status: { type: 'string' },
    updated_at: { type: 'string' },
    thread_count: { type: 'integer' },
    unread_count: { type: 'integer' },
  },
  required: ['id', 'integration_slug', 'display_name', 'thread_count', 'unread_count'],
};

const PRIVATE_MESSAGE_THREAD_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    counterparty: { type: 'string' },
    preview: { type: 'string' },
    last_message_at: { type: 'string' },
    channel_id: { type: 'string' },
    channel_label: { type: 'string' },
    has_unread: { type: 'boolean' },
    message_type: { type: 'string' },
    message_count: { type: 'integer' },
  },
  required: [
    'id',
    'title',
    'counterparty',
    'preview',
    'channel_id',
    'channel_label',
    'has_unread',
    'message_type',
    'message_count',
  ],
};

const PRIVATE_MESSAGE_THREAD_MESSAGE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    body: { type: 'string' },
    sent_at: { type: 'string' },
    status: { type: 'string' },
    direction: { type: 'string' },
    sender_label: { type: 'string' },
  },
  required: ['id', 'body', 'direction', 'sender_label'],
};

const PRIVATE_MESSAGES_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: { type: 'string' },
    ctx_id: { type: 'string' },
    channels: {
      type: 'array',
      items: PRIVATE_MESSAGE_CHANNEL_OUTPUT_SCHEMA,
    },
    threads: {
      type: 'array',
      items: PRIVATE_MESSAGE_THREAD_OUTPUT_SCHEMA,
    },
  },
  required: ['message', 'channels', 'threads'],
};

const PRIVATE_MESSAGE_THREAD_DETAIL_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: { type: 'string' },
    ctx_id: { type: 'string' },
    ...PRIVATE_MESSAGE_THREAD_OUTPUT_SCHEMA.properties,
    open_in_web_url: { type: 'string' },
    can_reply: { type: 'boolean' },
    reply_target: { type: 'string' },
    messages: {
      type: 'array',
      items: PRIVATE_MESSAGE_THREAD_MESSAGE_OUTPUT_SCHEMA,
    },
  },
  required: [
    'message',
    'id',
    'title',
    'counterparty',
    'preview',
    'channel_id',
    'channel_label',
    'has_unread',
    'message_type',
    'message_count',
    'open_in_web_url',
    'can_reply',
    'messages',
  ],
};

const PRIVATE_MESSAGE_REPLY_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: { type: 'string' },
    ctx_id: { type: 'string' },
    thread_id: { type: 'string' },
    message_id: { type: 'string' },
    has_unread: { type: 'boolean' },
  },
  required: ['message', 'thread_id', 'has_unread'],
};

const WORKSPACE_MESSAGE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    status: {
      type: 'string',
      description:
        'Optional shared workspace/integration inbox thread status filter. Use for Sanka-connected Gmail, integration inbox, /conversation, shared inbox, group inbox, and Contact Conversation threads. Defaults to `active` on the API side.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const WORKSPACE_MESSAGE_SYNC_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    channel_id: {
      type: 'string',
      description:
        'Optional shared workspace/integration inbox channel id to sync. Use for Sanka-connected Gmail, integration inbox, /conversation, shared inbox, group inbox, and Contact Conversation channels. Omit to sync all supported workspace channels.',
    },
    status: {
      type: 'string',
      description: 'Optional shared workspace/integration inbox thread status filter to return after sync.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const WORKSPACE_MESSAGE_THREAD_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    thread_id: {
      type: 'string',
      description:
        'Shared workspace/integration inbox thread identifier from /conversation, Contact Conversation, or integration-linked Gmail.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['thread_id'],
};

const WORKSPACE_MESSAGE_THREAD_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...PRIVATE_MESSAGE_THREAD_OUTPUT_SCHEMA.properties,
    status: { type: 'string' },
    assignee_id: { type: 'integer' },
    assignee_username: { type: 'string' },
    assignee_display_name: { type: 'string' },
  },
  required: PRIVATE_MESSAGE_THREAD_OUTPUT_SCHEMA.required,
};

const WORKSPACE_MESSAGES_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: { type: 'string' },
    ctx_id: { type: 'string' },
    channels: {
      type: 'array',
      items: PRIVATE_MESSAGE_CHANNEL_OUTPUT_SCHEMA,
    },
    threads: {
      type: 'array',
      items: WORKSPACE_MESSAGE_THREAD_OUTPUT_SCHEMA,
    },
  },
  required: ['message', 'channels', 'threads'],
};

const WORKSPACE_MESSAGE_THREAD_DETAIL_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: { type: 'string' },
    ctx_id: { type: 'string' },
    ...WORKSPACE_MESSAGE_THREAD_OUTPUT_SCHEMA.properties,
    open_in_web_url: { type: 'string' },
    can_reply: { type: 'boolean' },
    reply_target: { type: 'string' },
    messages: {
      type: 'array',
      items: PRIVATE_MESSAGE_THREAD_MESSAGE_OUTPUT_SCHEMA,
    },
  },
  required: [
    'message',
    'id',
    'title',
    'counterparty',
    'preview',
    'channel_id',
    'channel_label',
    'has_unread',
    'message_type',
    'message_count',
    'open_in_web_url',
    'can_reply',
    'messages',
  ],
};

const EXPENSE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    id_pm: { type: 'integer' },
    contact_name: { type: 'string' },
    company_name: { type: 'string' },
    description: { type: 'string' },
    reimburse_date: { type: 'string' },
    due_date: { type: 'string' },
    status: { type: 'string' },
    currency: { type: 'string' },
    amount: { type: 'number' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    attached_files: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    attachment_file_count: { type: 'integer' },
    attachment_verification: { type: 'object', additionalProperties: true },
  },
  required: ['id', 'created_at'],
};

const GOVERNANCE_ADVISORY_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    code: { type: 'string' },
    severity: { type: 'string' },
    field_group: { type: 'string' },
    message: { type: 'string' },
    requires_confirmation: { type: 'boolean' },
    suggested_next_action: { type: 'string' },
    details: { type: 'object', additionalProperties: true },
  },
};

const EXPENSE_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: 'string' },
    expense_id: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    attached_files: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    attachment_file_count: { type: 'integer' },
    attachment_verification: { type: 'object', additionalProperties: true },
    advisories: {
      type: ['array', 'null'] as any,
      items: GOVERNANCE_ADVISORY_OUTPUT_SCHEMA,
    },
  },
  required: ['ok', 'status'],
};

const RECORD_DETAIL_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
};

const RECORD_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    data: { type: 'object', additionalProperties: true },
    status: { type: 'string' },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['data', 'message'],
};

const INCENTIVE_ACTION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    data: {
      type: 'object',
      additionalProperties: true,
    },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['data', 'message'],
};

const INCENTIVE_NOTICE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    notice: { type: 'string' },
    count: { type: 'integer' },
    total_payout: { type: 'number' },
    total_base_amount: { type: 'number' },
    periods: {
      type: 'array',
      items: { type: 'string' },
    },
    results: {
      type: 'array',
      items: { type: 'object' },
    },
  },
  required: ['notice', 'count', 'total_payout', 'total_base_amount', 'periods', 'results'],
};

const EXPENSE_UPLOAD_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    file_id: { type: 'string' },
    ok: { type: 'boolean' },
    ctx_id: { type: 'string' },
    filename: { type: 'string' },
  },
  required: ['file_id', 'ok'],
};

const BILL_UPLOAD_INPUT_SCHEMA = EXPENSE_UPLOAD_INPUT_SCHEMA;
const BILL_UPLOAD_OUTPUT_SCHEMA = EXPENSE_UPLOAD_OUTPUT_SCHEMA;
const ORDER_UPLOAD_INPUT_SCHEMA = EXPENSE_UPLOAD_INPUT_SCHEMA;
const ORDER_UPLOAD_OUTPUT_SCHEMA = EXPENSE_UPLOAD_OUTPUT_SCHEMA;
const ESTIMATE_UPLOAD_INPUT_SCHEMA = EXPENSE_UPLOAD_INPUT_SCHEMA;
const ESTIMATE_UPLOAD_OUTPUT_SCHEMA = EXPENSE_UPLOAD_OUTPUT_SCHEMA;
const INVOICE_UPLOAD_INPUT_SCHEMA = EXPENSE_UPLOAD_INPUT_SCHEMA;
const INVOICE_UPLOAD_OUTPUT_SCHEMA = EXPENSE_UPLOAD_OUTPUT_SCHEMA;
const PURCHASE_ORDER_UPLOAD_INPUT_SCHEMA = EXPENSE_UPLOAD_INPUT_SCHEMA;
const PURCHASE_ORDER_UPLOAD_OUTPUT_SCHEMA = EXPENSE_UPLOAD_OUTPUT_SCHEMA;

const DOCUMENT_ATTACHMENT_FILE_IDS_INPUT_PROPERTY = {
  type: 'array',
  description: 'Optional uploaded attachment file IDs to bind to the record.',
  items: {
    type: 'string',
  },
};

const DEAL_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...INTEGRATION_RECORD_SCOPE_INPUT_PROPERTIES,
    limit: {
      type: 'integer',
      description: 'Maximum number of deals to return from the deal list.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
    page: {
      type: 'integer',
      description: 'Page number for record-query backed deal lists.',
      minimum: 1,
      default: 1,
    },
    search: {
      type: 'string',
      description: 'Optional free-text search over deal names/stages when record-query routing is used.',
    },
    filters: {
      type: 'array',
      description:
        'Server-side filters for record-query backed deal lists. For HubSpot/Salesforce date filters, fields such as closed_at, closedate, close_date, CloseDate, stage, dealstage, or StageName are accepted by the Sanka API.',
      items: RECORD_FILTER_SCHEMA,
    },
    select: {
      type: 'array',
      description:
        'Optional fields to return when scope/provider routing is used, for example ["id", "name", "amount", "case_status", "closed_at"]. Provider names and common aliases such as dealname, dealstage, stage, closedate, close_date, and CloseDate are also accepted by the Sanka API.',
      items: { type: 'string' },
    },
  },
};

const DEAL_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    case_id: {
      type: 'string',
      description: 'Deal identifier. Accepts a UUID, deal numeric id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['case_id'],
};

const PUBLIC_LINE_ITEM_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    item_id: {
      type: 'string',
      description: 'Optional Sanka item UUID or item identifier to link this row to an item.',
    },
    item: {
      type: 'string',
      description: 'Optional item identifier alias.',
    },
    id: {
      type: 'string',
      description: 'Optional item identifier alias used by some record detail outputs.',
    },
    item_external_id: {
      type: 'string',
      description: 'Optional external item reference when the target object supports item external ids.',
    },
    item_name: {
      type: 'string',
      description: 'Line item label when no item id is available, or an override for the linked item name.',
    },
    itemName: {
      type: 'string',
      description: 'Line item label alias.',
    },
    name: {
      type: 'string',
      description: 'Line item label alias.',
    },
    quantity: {
      type: 'number',
      description: 'Quantity for this line item.',
    },
    amount: {
      type: 'number',
      description: 'Quantity alias used by subscription items.',
    },
    amount_item: {
      type: 'number',
      description: 'Quantity alias used by Sanka public APIs.',
    },
    unit_price: {
      type: 'number',
      description: 'Unit price for this line item.',
    },
    unitPrice: {
      type: 'number',
      description: 'Unit price alias.',
    },
    price: {
      type: 'number',
      description: 'Unit price alias.',
    },
    amount_price: {
      type: 'number',
      description: 'Unit price alias used by Sanka public APIs.',
    },
    tax_rate: {
      type: 'number',
      description:
        'Line item tax rate percentage. The document tax settings may override this unless using item-based tax.',
    },
    line_item_properties: {
      type: 'object',
      description: 'Optional line-item custom field values keyed by custom field id.',
      additionalProperties: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          value_number_format: { type: 'string' },
        },
      },
    },
  },
};

const DEAL_MUTATION_INPUT_PROPERTIES = {
  ...RECORD_INTEGRATION_MUTATION_INPUT_PROPERTIES,
  case_status: {
    type: 'string',
    description: 'Deal stage/status key.',
  },
  company_external_id: {
    type: 'string',
    description: 'External company reference to associate to the deal.',
  },
  company_id: {
    type: 'string',
    description: 'Company id to associate to the deal.',
  },
  contact_external_id: {
    type: 'string',
    description: 'External contact reference to associate to the deal.',
  },
  contact_id: {
    type: 'string',
    description: 'Contact id to associate to the deal.',
  },
  currency: {
    type: 'string',
    description: 'Deal currency code.',
  },
  custom_fields: {
    type: 'object',
    description:
      'Custom field values. For integration mutations these are forwarded as provider property names.',
  },
  external_id: {
    type: 'string',
    description: 'External reference stored on the deal.',
  },
  line_items: {
    type: 'array',
    description: 'Line items for this deal. When provided, Sanka creates/replaces the deal detail rows.',
    items: PUBLIC_LINE_ITEM_INPUT_SCHEMA,
  },
  name: {
    type: 'string',
    description: 'Deal name.',
  },
  status: {
    type: 'string',
    description: 'Deal record status.',
  },
};

const DEAL_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: DEAL_MUTATION_INPUT_PROPERTIES,
  required: [],
};

const DEAL_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    case_id: {
      type: 'string',
      description: 'Deal identifier to update.',
    },
    lookup_external_id: {
      type: 'string',
      description: 'Optional explicit external id used to resolve the target deal.',
    },
    ...DEAL_MUTATION_INPUT_PROPERTIES,
  },
  required: ['case_id'],
};

const DEAL_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    case_id: {
      type: 'string',
      description: 'Deal identifier to delete.',
    },
    ...RECORD_INTEGRATION_MUTATION_INPUT_PROPERTIES,
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['case_id'],
};

const DEAL_PIPELINES_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
};

const PIPELINE_SNAPSHOT_CAPTURE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    source_system: {
      type: 'string',
      description: 'Snapshot source. Use "sanka" for Sanka Deal rows or "hubspot" for live HubSpot Deals.',
      enum: ['sanka', 'hubspot'],
      default: 'sanka',
    },
    channel_id: {
      type: 'string',
      description: 'HubSpot connected channel UUID. Required when source_system="hubspot".',
    },
    pipeline_id: {
      type: 'string',
      description: 'Optional Sanka pipeline UUID for Sanka Deal snapshots.',
    },
    custom_field_whitelist: {
      type: 'array',
      description: 'Optional Sanka Deal custom field internal names to freeze in the snapshot.',
      items: { type: 'string' },
    },
    limit: {
      type: 'integer',
      description: 'Maximum HubSpot deals to capture when source_system="hubspot".',
      minimum: 0,
      maximum: 10000,
      default: 1000,
    },
    search: {
      type: 'string',
      description: 'Optional HubSpot deal search query for HubSpot snapshot capture.',
    },
  },
};

const PIPELINE_SNAPSHOT_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    page: {
      type: 'integer',
      minimum: 1,
      default: 1,
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 200,
      default: 20,
    },
    pipeline_id: {
      type: 'string',
      description: 'Optional Sanka pipeline UUID filter.',
    },
    source_system: {
      type: 'string',
      description: 'Optional source filter, for example "hubspot" or "sanka".',
    },
  },
};

const PIPELINE_SNAPSHOT_GET_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    batch_id: {
      type: 'string',
      description: 'Pipeline snapshot batch UUID.',
    },
    pipeline_id: {
      type: 'string',
      description: 'Optional Sanka pipeline UUID filter for returned deal rows.',
    },
  },
  required: ['batch_id'],
};

const PIPELINE_SNAPSHOT_COMPARE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    from_batch_id: {
      type: 'string',
      description: 'Older snapshot batch UUID. Omit with to_batch_id to compare the latest two batches.',
    },
    to_batch_id: {
      type: 'string',
      description: 'Newer snapshot batch UUID. Omit with from_batch_id to compare the latest two batches.',
    },
    pipeline_id: {
      type: 'string',
      description: 'Optional Sanka pipeline UUID filter.',
    },
    source_system: {
      type: 'string',
      description: 'Optional source filter when resolving the latest two batches, for example "hubspot".',
    },
  },
};

const PIPELINE_SNAPSHOT_HUBSPOT_SYNC_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    channel_id: {
      type: 'string',
      description: 'HubSpot connected channel UUID.',
    },
    from_batch_id: {
      type: 'string',
      description: 'Older snapshot batch UUID. Omit with to_batch_id to use the latest two HubSpot batches.',
    },
    to_batch_id: {
      type: 'string',
      description:
        'Newer snapshot batch UUID. Omit with from_batch_id to use the latest two HubSpot batches.',
    },
    pipeline_id: {
      type: 'string',
      description: 'Optional Sanka pipeline UUID filter.',
    },
    source_system: {
      type: 'string',
      description: 'Snapshot source filter. Defaults to "hubspot".',
      default: 'hubspot',
    },
    limit: {
      type: 'integer',
      minimum: 0,
      maximum: 10000,
      default: 500,
    },
    offset: {
      type: 'integer',
      minimum: 0,
      default: 0,
    },
    dry_run: {
      type: 'boolean',
      description: 'Preview HubSpot property updates without writing. Defaults to true.',
      default: true,
    },
    confirm: {
      type: 'boolean',
      description: 'Required with dry_run=false after reviewing the dry-run result.',
      default: false,
    },
    checked_at: {
      type: 'string',
      description: 'Optional ISO datetime used to populate sanka_test_snapshot_checked_at.',
    },
  },
  required: ['channel_id'],
};

const PIPELINE_SNAPSHOT_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
};

const DEAL_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    deal_id: { type: 'integer' },
    name: { type: 'string' },
    case_status: { type: 'string' },
    status: { type: 'string' },
    currency: { type: 'string' },
    pipeline_name: { type: 'string' },
    pipeline_order: { type: 'integer' },
    stage_key: { type: 'string' },
    stage_label: { type: 'string' },
    stage_position: { type: 'integer' },
    stage_score: { type: 'number' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['created_at', 'updated_at'],
};

const PROPERTY_CHOICE_VALUES_SCHEMA = {
  anyOf: [
    {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    {
      type: 'array',
      items: { type: 'string' },
    },
  ],
};

const PROPERTY_CUSTOM_OBJECT_INPUT_PROPERTIES = {
  custom_object_id: {
    type: 'string',
    description: 'Sanka custom object UUID/id when object_name is custom_objects or custom_object.',
  },
  custom_object_slug: {
    type: 'string',
    description:
      'Sanka custom object slug/internal key when object_name is custom_objects or custom_object. Prefer this when the user named the custom object.',
  },
  custom_object: {
    type: 'string',
    description: 'Alias for custom_object_slug.',
  },
};

const PROPERTY_MUTATION_INPUT_PROPERTIES = {
  target: {
    type: 'string',
    description:
      'Mutation destination. Use "sanka" for Sanka custom properties, "integration" for the connected CRM only, or "both" to mutate integration first and then Sanka. If provider is supplied and target is omitted, the MCP routes to "integration"; provider with target="sanka" is rejected.',
    enum: ['sanka', 'integration', 'both'],
    default: 'sanka',
  },
  scope: {
    type: 'string',
    description: 'Alias for target. If set to "integration", MCP routes the mutation to the connected CRM.',
    enum: ['sanka', 'integration'],
  },
  source: {
    type: 'string',
    description: 'Alias for scope. Prefer target for property mutations.',
    enum: ['sanka', 'integration'],
  },
  provider: {
    type: 'string',
    description:
      'Connected integration provider for target="integration" or target="both". Supplying provider prevents a Sanka-only property mutation. Supports HubSpot and Salesforce property definitions.',
    enum: ['hubspot', 'salesforce'],
  },
  channel_id: {
    type: 'string',
    description:
      'Optional integration channel UUID. Pass this when a workspace has more than one channel for the provider.',
  },
  external_object_type: {
    type: 'string',
    description:
      'Optional provider object type override, for example HubSpot "companies" or Salesforce "Account".',
  },
  external_id: {
    type: 'string',
    description:
      'Provider property API name for integration create, for example HubSpot "customer_tier" or Salesforce "CustomerTier__c".',
  },
  ...PROPERTY_CUSTOM_OBJECT_INPUT_PROPERTIES,
  dry_run: {
    type: 'boolean',
    description:
      'Preview the integration property mutation without writing. Use this before remote deletes or Salesforce metadata changes.',
    default: false,
  },
  confirm: {
    type: 'boolean',
    description:
      'Required to execute destructive integration property deletes after reviewing dry_run output.',
    default: false,
  },
  badge_color: {
    type: 'string',
    description: 'Optional badge color token.',
  },
  choice_values: {
    ...PROPERTY_CHOICE_VALUES_SCHEMA,
    description: 'Optional allowed choices as either a string map or a string array.',
  },
  conditional_choice_mapping: {
    type: 'object',
    description: 'Optional conditional choice mapping object.',
    additionalProperties: true,
  },
  description: {
    type: 'string',
    description: 'Property description.',
  },
  internal_name: {
    type: 'string',
    description: 'Internal property name.',
  },
  field_type: {
    type: 'string',
    description:
      'Provider-specific field type override, for example HubSpot "select" or Salesforce "Picklist". Usually omit it.',
  },
  group_name: {
    type: 'string',
    description:
      'Provider property group name for integration targets, for example HubSpot "companyinformation".',
  },
  multiple_select: {
    type: 'boolean',
    description: 'Whether the property allows multiple selected values.',
  },
  name: {
    type: 'string',
    description: 'Property display name.',
  },
  number_format: {
    type: 'string',
    description: 'Optional number format.',
  },
  order: {
    type: 'integer',
    description: 'Optional display order.',
  },
  required_field: {
    type: 'boolean',
    description: 'Whether the property is required.',
  },
  show_badge: {
    type: 'boolean',
    description: 'Whether to show the property as a badge.',
  },
  tag_values: {
    type: 'array',
    description: 'Optional tag values for enumerated property types.',
    items: { type: 'string' },
  },
  options: {
    type: 'array',
    description:
      'Provider option rows for picklist/enumeration properties. Each row should include label and value.',
    items: { type: 'object', additionalProperties: true },
  },
  type: {
    type: 'string',
    description:
      'Sanka custom property type, for example text, number, date, choice, or tag. Company billing_cycle and payment_cycle are standard company fields and should be set with update_company/create_company top-level inputs, not by creating a custom property.',
  },
  unique: {
    type: 'boolean',
    description: 'Whether the property value must be unique.',
  },
};

const PROPERTY_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_name: {
      type: 'string',
      description:
        'Object family to inspect, for example `orders`, `companies`, `invoices`, or `purchase-orders`.',
    },
    custom_only: {
      type: 'boolean',
      description: 'When true, only return custom properties.',
    },
    scope: {
      type: 'string',
      description:
        'Data scope. Use "sanka" for Sanka custom properties, or "integration" to read live property definitions from a connected CRM.',
      enum: ['sanka', 'integration'],
      default: 'sanka',
    },
    source: {
      type: 'string',
      description: 'Alias for scope. Prefer scope.',
      enum: ['sanka', 'integration'],
    },
    provider: {
      type: 'string',
      description:
        'Connected integration provider. Use with scope="integration" for live HubSpot/Salesforce property definitions.',
      enum: ['hubspot', 'salesforce'],
    },
    channel_id: {
      type: 'string',
      description:
        'Optional integration channel UUID. Pass this when a workspace has more than one channel for the provider.',
    },
    external_object_type: {
      type: 'string',
      description:
        'Optional provider object type override, for example HubSpot "companies" or Salesforce "Account".',
    },
    ...PROPERTY_CUSTOM_OBJECT_INPUT_PROPERTIES,
    search: {
      type: 'string',
      description: 'Optional provider property search text applied server-side or after provider fetch.',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of properties to return from the fetched list.',
      minimum: 1,
      maximum: 100,
      default: 25,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['object_name'],
};

const RULE_SETTINGS_OBJECT_PROPERTY = {
  type: 'string',
  description:
    'Sanka object family the rule applies to, for example invoices, companies, contacts, deals, payments, estimates, orders, or purchase-orders. Delivery rules currently support invoices only.',
};

const RULE_SETTINGS_COMMON_INPUT_PROPERTIES = {
  object: RULE_SETTINGS_OBJECT_PROPERTY,
  object_name: {
    ...RULE_SETTINGS_OBJECT_PROPERTY,
    description: 'Alias for object. Prefer object.',
  },
  workspace_id: {
    type: 'string',
    description: WORKSPACE_ID_DESCRIPTION,
  },
  language: {
    type: 'string',
    description: 'Optional language override.',
  },
};

const RULE_CONDITIONS_PROPERTY = {
  type: 'object',
  description:
    'Rule condition DSL. Use {"all":[{"field":"status","op":"==","value":"sent"}]} for simple AND conditions.',
  additionalProperties: true,
};

const APPROVAL_RULE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...RULE_SETTINGS_COMMON_INPUT_PROPERTIES,
    limit: {
      type: 'integer',
      description: 'Maximum number of rules to show in the MCP response.',
      minimum: 1,
      maximum: 100,
      default: 25,
    },
  },
  required: ['object'],
};

const APPROVAL_RULE_OPTIONS_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...RULE_SETTINGS_COMMON_INPUT_PROPERTIES,
    rule_id: {
      type: 'string',
      description: 'Existing rule UUID to load. Omit to get a blank rule template and available options.',
    },
  },
  required: ['object'],
};

const APPROVAL_RULE_UPSERT_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...RULE_SETTINGS_COMMON_INPUT_PROPERTIES,
    rule_id: {
      type: 'string',
      description: 'Existing rule UUID. Omit to create a new approval rule.',
    },
    name: { type: 'string', description: 'Approval rule name.' },
    description: { type: 'string', description: 'Optional rule description.' },
    is_active: { type: 'boolean', description: 'Whether this rule is active.', default: true },
    block_save: {
      type: 'boolean',
      description: 'Legacy shortcut for block_targets=["save"]. Prefer block_targets.',
    },
    block_targets: {
      type: 'array',
      description:
        'Actions to block until approved, such as save, status_sent, status_scheduled, document_download, delivery_send, delivery_schedule, crud_create, crud_update, crud_delete, bulk_update, export, or convert.',
      items: { type: 'string' },
    },
    conditions: RULE_CONDITIONS_PROPERTY,
    approver_user_ids: {
      type: 'array',
      description: 'Sanka user ids that can approve this rule.',
      items: { type: 'string' },
    },
    worker_scope_type: {
      type: 'string',
      description: 'Employee scope for expense approval rules. Usually omit or use all.',
      enum: ['all', 'selected_workers'],
      default: 'all',
    },
    worker_ids: {
      type: 'array',
      description: 'Employee worker UUIDs for selected_workers expense rules.',
      items: { type: 'string' },
    },
    order: { type: 'integer', description: 'Rule display/evaluation order.', default: 0 },
  },
  required: ['object', 'name'],
};

const APPROVAL_REQUEST_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...RULE_SETTINGS_COMMON_INPUT_PROPERTIES,
    record_id: {
      type: 'string',
      description: 'Sanka record UUID to request approval for.',
    },
    approver_user_ids: {
      type: 'array',
      description: 'Sanka user ids that can approve this request.',
      items: { type: 'string' },
    },
    title: {
      type: 'string',
      description: 'Approval request title shown to approvers.',
    },
    description: {
      type: 'string',
      description: 'Optional approval request description.',
    },
    block_targets: {
      type: 'array',
      description:
        'Actions to block until this request is approved, for example status_transition, send, download, convert, crud_update, or document_download.',
      items: { type: 'string' },
    },
    requested_action: {
      type: 'string',
      description: 'Optional machine-readable action label, such as approve_estimate or send_invoice.',
    },
    idempotency_key: {
      type: 'string',
      description: 'Optional idempotency key to avoid creating duplicate approval requests.',
    },
  },
  required: ['object', 'record_id', 'approver_user_ids'],
};

const RECORD_APPROVAL_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...RULE_SETTINGS_COMMON_INPUT_PROPERTIES,
    record_id: {
      type: 'string',
      description: 'Sanka record UUID whose approval requests should be listed.',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of approval requests to show in the MCP response.',
      minimum: 1,
      maximum: 100,
      default: 25,
    },
  },
  required: ['object', 'record_id'],
};

const RECORD_APPROVAL_MUTATION_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    history_id: {
      type: 'string',
      description: 'WorkflowHistory UUID for the approval request to approve or reject.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['history_id'],
};

const RULE_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...RULE_SETTINGS_COMMON_INPUT_PROPERTIES,
    rule_id: { type: 'string', description: 'Rule UUID to delete.' },
  },
  required: ['object', 'rule_id'],
};

const LOCK_RULE_LIST_INPUT_SCHEMA = APPROVAL_RULE_LIST_INPUT_SCHEMA;
const LOCK_RULE_OPTIONS_INPUT_SCHEMA = APPROVAL_RULE_OPTIONS_INPUT_SCHEMA;
const LOCK_RULE_UPSERT_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...RULE_SETTINGS_COMMON_INPUT_PROPERTIES,
    rule_id: {
      type: 'string',
      description: 'Existing rule UUID. Omit to create a new lock rule.',
    },
    name: { type: 'string', description: 'Lock rule name.' },
    description: { type: 'string', description: 'Optional rule description.' },
    is_active: { type: 'boolean', description: 'Whether this rule is active.', default: true },
    lock_scope: {
      type: 'string',
      description:
        'What to lock while conditions match. invoices support full_record, financial_fields, and selected_fields; other objects use full_record.',
      enum: ['full_record', 'financial_fields', 'selected_fields'],
      default: 'full_record',
    },
    lock_config: {
      type: 'object',
      description:
        'Lock configuration. For invoices selected_fields, pass {"locked_field_keys":["status","issue_date"]}.',
      additionalProperties: true,
    },
    conditions: RULE_CONDITIONS_PROPERTY,
    order: { type: 'integer', description: 'Rule display/evaluation order.', default: 0 },
  },
  required: ['object', 'name'],
};

const DELIVERY_RULE_LIST_INPUT_SCHEMA = APPROVAL_RULE_LIST_INPUT_SCHEMA;
const DELIVERY_RULE_OPTIONS_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...RULE_SETTINGS_COMMON_INPUT_PROPERTIES,
    rule_id: {
      type: 'string',
      description: 'Existing delivery rule UUID to load.',
    },
    action: {
      type: 'string',
      description: 'Delivery action to inspect when rule_id is omitted.',
      enum: ['send', 'schedule'],
    },
  },
  required: ['object'],
};
const DELIVERY_RULE_UPSERT_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...RULE_SETTINGS_COMMON_INPUT_PROPERTIES,
    rule_id: {
      type: 'string',
      description: 'Existing delivery rule UUID. Omit to create a new delivery rule.',
    },
    action: {
      type: 'string',
      description: 'Invoice delivery action controlled by this rule.',
      enum: ['send', 'schedule'],
      default: 'send',
    },
    name: { type: 'string', description: 'Delivery rule name.' },
    description: { type: 'string', description: 'Optional rule description.' },
    is_active: { type: 'boolean', description: 'Whether this rule is active.', default: true },
    conditions: RULE_CONDITIONS_PROPERTY,
    required_fields: {
      type: 'array',
      description: 'Invoice fields that must be present before the delivery action can run.',
      items: { type: 'string' },
    },
    order: { type: 'integer', description: 'Rule display/evaluation order.', default: 0 },
  },
  required: ['object', 'name'],
};

const RULE_SETTINGS_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
};

const PROPERTY_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_name: {
      type: 'string',
      description: 'Object family that owns the property, for example `orders`.',
    },
    property_ref: {
      type: 'string',
      description: 'Property identifier or reference.',
    },
    scope: {
      type: 'string',
      description:
        'Data scope. Use "sanka" for Sanka custom properties, or "integration" for a live CRM property definition.',
      enum: ['sanka', 'integration'],
      default: 'sanka',
    },
    source: {
      type: 'string',
      description: 'Alias for scope. Prefer scope.',
      enum: ['sanka', 'integration'],
    },
    provider: {
      type: 'string',
      description:
        'Connected integration provider. Use with scope="integration" for live HubSpot/Salesforce property definitions.',
      enum: ['hubspot', 'salesforce'],
    },
    channel_id: {
      type: 'string',
      description:
        'Optional integration channel UUID. Pass this when a workspace has more than one channel for the provider.',
    },
    external_object_type: {
      type: 'string',
      description:
        'Optional provider object type override, for example HubSpot "companies" or Salesforce "Account".',
    },
    ...PROPERTY_CUSTOM_OBJECT_INPUT_PROPERTIES,
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['object_name', 'property_ref'],
};

const PROPERTY_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_name: {
      type: 'string',
      description: 'Object family that should receive the new property, for example `orders`.',
    },
    ...PROPERTY_MUTATION_INPUT_PROPERTIES,
  },
  required: ['object_name'],
};

const PROPERTY_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_name: {
      type: 'string',
      description: 'Object family that owns the property.',
    },
    property_ref: {
      type: 'string',
      description: 'Property identifier or reference to update.',
    },
    ...PROPERTY_MUTATION_INPUT_PROPERTIES,
  },
  required: ['object_name', 'property_ref'],
};

const PROPERTY_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_name: {
      type: 'string',
      description: 'Object family that owns the property.',
    },
    property_ref: {
      type: 'string',
      description: 'Property identifier or reference to delete.',
    },
    target: {
      type: 'string',
      description:
        'Mutation destination. Use "sanka" for Sanka custom properties, "integration" for the connected CRM only, or "both" to delete integration first and then Sanka. If provider is supplied and target is omitted, the MCP routes to "integration"; provider with target="sanka" is rejected.',
      enum: ['sanka', 'integration', 'both'],
      default: 'sanka',
    },
    scope: {
      type: 'string',
      description: 'Alias for target. If set to "integration", MCP routes the delete to the connected CRM.',
      enum: ['sanka', 'integration'],
    },
    source: {
      type: 'string',
      description: 'Alias for scope. Prefer target for property mutations.',
      enum: ['sanka', 'integration'],
    },
    provider: {
      type: 'string',
      description:
        'Connected integration provider for target="integration" or target="both". Supplying provider prevents a Sanka-only property mutation. Supports HubSpot and Salesforce property definitions.',
      enum: ['hubspot', 'salesforce'],
    },
    channel_id: {
      type: 'string',
      description:
        'Optional integration channel UUID. Pass this when a workspace has more than one channel for the provider.',
    },
    external_object_type: {
      type: 'string',
      description:
        'Optional provider object type override, for example HubSpot "companies" or Salesforce "Account".',
    },
    ...PROPERTY_CUSTOM_OBJECT_INPUT_PROPERTIES,
    dry_run: {
      type: 'boolean',
      description: 'Preview the integration property delete without writing.',
      default: false,
    },
    confirm: {
      type: 'boolean',
      description:
        'Required to execute destructive integration property deletes after reviewing dry_run output.',
      default: false,
    },
  },
  required: ['object_name', 'property_ref'],
};

const OBJECT_SCHEMA_COMMON_INPUT_PROPERTIES = {
  target: {
    type: 'string',
    description:
      'Mutation destination. Use "sanka" for Sanka custom object schema, "integration" for HubSpot/Salesforce only, or "both" to mutate integration first and then Sanka.',
    enum: ['sanka', 'integration', 'both'],
    default: 'sanka',
  },
  provider: {
    type: 'string',
    description: 'Connected integration provider for target="integration" or target="both".',
    enum: ['hubspot', 'salesforce'],
  },
  channel_id: {
    type: 'string',
    description:
      'Optional integration channel UUID. Pass this when a workspace has more than one channel for the provider.',
  },
  schema_ref: {
    type: 'string',
    description:
      'Existing object schema id, object type id, or API name for update/delete, for example HubSpot "2-123" or Salesforce "Asset__c".',
  },
  external_object_type: {
    type: 'string',
    description:
      'Provider object type/API name, for example HubSpot custom object name or Salesforce "Asset__c".',
  },
  name: {
    type: 'string',
    description: 'Display name for the object schema.',
  },
  slug: {
    type: 'string',
    description: 'Sanka slug or provider API name seed for the object schema.',
  },
  singular_label: {
    type: 'string',
    description: 'Singular label for provider object schema creation.',
  },
  plural_label: {
    type: 'string',
    description: 'Plural label for provider object schema creation.',
  },
  labels: {
    type: 'object',
    description: 'Provider labels object, usually with singular and plural.',
    additionalProperties: true,
  },
  description: {
    type: 'string',
    description: 'Object schema description.',
  },
  primary_display_property: {
    type: 'string',
    description:
      'Primary display property. HubSpot uses this as primaryDisplayProperty; Salesforce uses it as nameField.label.',
  },
  required_properties: {
    type: 'array',
    description: 'Provider required property API names.',
    items: { type: 'string' },
  },
  searchable_properties: {
    type: 'array',
    description: 'Provider searchable property API names.',
    items: { type: 'string' },
  },
  secondary_display_properties: {
    type: 'array',
    description: 'Provider secondary display property API names.',
    items: { type: 'string' },
  },
  properties: {
    type: 'array',
    description:
      'Provider property definitions to create with a HubSpot object schema. Salesforce custom fields should be managed with property tools.',
    items: { type: 'object', additionalProperties: true },
  },
  associations: {
    type: 'array',
    description: 'Optional HubSpot associated object definitions for schema creation.',
    items: { type: 'object', additionalProperties: true },
  },
  dry_run: {
    type: 'boolean',
    description:
      'Preview the schema mutation without writing. Use this first for all HubSpot/Salesforce schema changes.',
    default: false,
  },
  confirm: {
    type: 'boolean',
    description: 'Required to execute destructive schema deletes after reviewing dry_run output.',
    default: false,
  },
};

const OBJECT_SCHEMA_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    scope: {
      type: 'string',
      description:
        'Data scope. Use "sanka" for Sanka custom object schemas, or "integration" to inspect live HubSpot/Salesforce schemas.',
      enum: ['sanka', 'integration'],
      default: 'sanka',
    },
    source: {
      type: 'string',
      description: 'Alias for scope. Prefer scope.',
      enum: ['sanka', 'integration'],
    },
    provider: {
      type: 'string',
      description: 'Connected integration provider for scope="integration".',
      enum: ['hubspot', 'salesforce'],
    },
    channel_id: {
      type: 'string',
      description:
        'Optional integration channel UUID. Pass this when a workspace has more than one channel for the provider.',
    },
    custom_only: {
      type: 'boolean',
      description: 'When true, only return custom object schemas.',
      default: true,
    },
    search: {
      type: 'string',
      description: 'Optional schema search text.',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of schemas to return.',
      minimum: 1,
      maximum: 100,
      default: 25,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
};

const OBJECT_SCHEMA_MUTATION_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    operation: {
      type: 'string',
      description: 'Schema mutation operation.',
      enum: ['create', 'update', 'delete'],
      default: 'create',
    },
    ...OBJECT_SCHEMA_COMMON_INPUT_PROPERTIES,
  },
  required: ['operation'],
};

const OBJECT_SCHEMA_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    operation: { type: 'string' },
    target: { type: 'string' },
    object_schema_id: { type: ['string', 'null'] as any },
    name: { type: ['string', 'null'] as any },
    slug: { type: ['string', 'null'] as any },
    provider: { type: ['string', 'null'] as any },
    channel_id: { type: ['string', 'null'] as any },
    channel_name: { type: ['string', 'null'] as any },
    external_object_type: { type: ['string', 'null'] as any },
    external_id: { type: ['string', 'null'] as any },
    dry_run: { type: ['boolean', 'null'] as any },
    sanka_action: { type: ['object', 'null'] as any },
    remote: { type: ['object', 'null'] as any },
    warnings: { type: ['array', 'null'] as any, items: { type: 'string' } },
    message: { type: ['string', 'null'] as any },
    ctx_id: { type: 'string' },
  },
};

const APP_BUILDER_CUSTOM_OBJECT_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['name', 'slug'],
};

const APP_BUILDER_MODULE_SCHEMA = {
  type: 'object' as const,
  properties: {
    slug: { type: 'string' },
    name: { type: 'string' },
    name_ja: { type: 'string' },
    object_ids: {
      type: 'array',
      description:
        'Canonical Sanka object ids such as company, contact, deal, invoice, item, or custom:<custom_object_slug>.',
      items: { type: 'string' },
    },
    icon: { type: 'string' },
  },
  required: ['slug', 'name', 'object_ids'],
};

const APP_BUILDER_PERMISSION_SET_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    permissions: {
      type: 'object',
      description: 'Permission map keyed by Sanka permission object key.',
      additionalProperties: { type: 'string' },
    },
  },
  required: ['name'],
};

const APP_BUILDER_ARTIFACT_SCHEMA = {
  type: 'object' as const,
  properties: {
    slug: { type: 'string' },
    artifact_type: {
      type: 'string',
      description: 'Artifact kind. Supported values include guide, flowchart, and er_diagram.',
      enum: ['guide', 'flowchart', 'er_diagram'],
    },
    artifactType: {
      type: 'string',
      description: 'Alias for artifact_type.',
      enum: ['guide', 'flowchart', 'er_diagram'],
    },
    type: {
      type: 'string',
      description: 'Alias for artifact_type.',
      enum: ['guide', 'flowchart', 'er_diagram'],
    },
    title: { type: 'string' },
    content: { type: 'string' },
    body: { type: 'string' },
    format: {
      type: 'string',
      description: 'Artifact format, usually markdown or mermaid.',
    },
  },
  required: ['artifact_type', 'title', 'content'],
};

const APP_BUILDER_BLUEPRINT_DSL_SCHEMA = {
  type: 'object' as const,
  description:
    'Blueprint DSL for template overlays or validator-gated generated blueprints. Use preview first; apply generated blueprints only after validation passes and explicit user approval.',
  properties: {
    source: {
      type: 'string',
      description: 'Origin marker such as template, template_overlay, or ai_generated.',
      enum: ['template', 'template_overlay', 'ai_generated'],
    },
    base_template_slug: {
      type: 'string',
      description: 'Base template slug when this DSL overlays an existing template.',
    },
    baseTemplateSlug: {
      type: 'string',
      description: 'Alias for base_template_slug.',
    },
    language: {
      type: 'string',
      description: 'Language hint for generated guides and artifacts, such as ja or en.',
    },
    modules: {
      type: 'array',
      description: 'Modules to add or override.',
      items: APP_BUILDER_MODULE_SCHEMA,
    },
    custom_objects: {
      type: 'array',
      description: 'Custom object schemas to create before module application.',
      items: APP_BUILDER_CUSTOM_OBJECT_SCHEMA,
    },
    customObjects: {
      type: 'array',
      description: 'Alias for custom_objects.',
      items: APP_BUILDER_CUSTOM_OBJECT_SCHEMA,
    },
    permission_sets: {
      type: 'array',
      description: 'Permission sets to add or override.',
      items: APP_BUILDER_PERMISSION_SET_SCHEMA,
    },
    permissionSets: {
      type: 'array',
      description: 'Alias for permission_sets.',
      items: APP_BUILDER_PERMISSION_SET_SCHEMA,
    },
    artifacts: {
      type: 'array',
      description: 'Guide, Mermaid flowchart, and Mermaid ER diagram artifacts.',
      items: APP_BUILDER_ARTIFACT_SCHEMA,
    },
    destructive_actions: {
      type: 'array',
      description: 'Must remain empty. The validator rejects destructive blueprint actions.',
      items: { type: 'string' },
    },
    destructiveActions: {
      type: 'array',
      description: 'Alias for destructive_actions. Must remain empty.',
      items: { type: 'string' },
    },
    notes: { type: 'string' },
  },
};

const APP_BLUEPRINT_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    template_slug: {
      type: 'string',
      description:
        'Supported blueprint template slug. Current values include crm, erp, expense-management, inventory-management, procurement-management, billing-collections, hr-management, it-asset-management, project-management, and support-desk.',
    },
    templateSlug: {
      type: 'string',
      description: 'Alias for template_slug.',
    },
    prompt: {
      type: 'string',
      description:
        'Natural language intent such as "sankaでCRMを構築して". Used when template_slug is omitted.',
    },
    intent: {
      type: 'string',
      description: 'Alias for prompt.',
    },
    language: {
      type: 'string',
      description:
        'Optional language hint such as ja or en. Pass the same language on preview and apply so generated guides and editable manuals match the user language.',
    },
    modules: {
      type: 'array',
      description: 'Optional complete module plan override.',
      items: APP_BUILDER_MODULE_SCHEMA,
    },
    custom_objects: {
      type: 'array',
      description: 'Optional Sanka custom objects to create before module application.',
      items: APP_BUILDER_CUSTOM_OBJECT_SCHEMA,
    },
    customObjects: {
      type: 'array',
      description: 'Alias for custom_objects.',
      items: APP_BUILDER_CUSTOM_OBJECT_SCHEMA,
    },
    permission_sets: {
      type: 'array',
      description: 'Optional complete permission-set plan override.',
      items: APP_BUILDER_PERMISSION_SET_SCHEMA,
    },
    permissionSets: {
      type: 'array',
      description: 'Alias for permission_sets.',
      items: APP_BUILDER_PERMISSION_SET_SCHEMA,
    },
    blueprint_dsl: {
      ...APP_BUILDER_BLUEPRINT_DSL_SCHEMA,
      description:
        'Complete generated blueprint DSL. Unknown intents should be previewed with this field first and only applied after validator approval and explicit user confirmation.',
    },
    blueprintDsl: {
      ...APP_BUILDER_BLUEPRINT_DSL_SCHEMA,
      description: 'Alias for blueprint_dsl.',
    },
    blueprint: {
      ...APP_BUILDER_BLUEPRINT_DSL_SCHEMA,
      description: 'Alias for blueprint_dsl.',
    },
    overlay: {
      ...APP_BUILDER_BLUEPRINT_DSL_SCHEMA,
      description:
        'Template overlay DSL for partial matches, such as industry-specific ERP additions. Usually used with template_slug or base_template_slug.',
    },
    options: {
      type: 'object',
      additionalProperties: true,
    },
  },
};

const APP_BLUEPRINT_APPLY_INPUT_SCHEMA = {
  ...APP_BLUEPRINT_INPUT_SCHEMA,
  properties: {
    ...APP_BLUEPRINT_INPUT_SCHEMA.properties,
    confirm: {
      type: 'boolean',
      description: 'Required. Must be true after the user explicitly approves the blueprint mutation.',
      default: false,
    },
    idempotency_key: {
      type: 'string',
      description: 'Optional client-generated idempotency key for audit and retries.',
    },
    idempotencyKey: {
      type: 'string',
      description: 'Alias for idempotency_key.',
    },
    update_existing_modules: {
      type: 'boolean',
      description: 'When true, modules with matching slugs are updated. Defaults to true.',
      default: true,
    },
    updateExistingModules: {
      type: 'boolean',
      description: 'Alias for update_existing_modules.',
    },
    update_existing_permission_sets: {
      type: 'boolean',
      description: 'When true, permission sets with matching names are updated. Defaults to false.',
      default: false,
    },
    updateExistingPermissionSets: {
      type: 'boolean',
      description: 'Alias for update_existing_permission_sets.',
    },
    create_editable_guides: {
      type: 'boolean',
      description:
        'When true, generated guide, flowchart, and ER diagram artifacts are promoted into editable Sanka guide manuals after apply.',
      default: false,
    },
    createEditableGuides: {
      type: 'boolean',
      description: 'Alias for create_editable_guides.',
    },
    promote_guide_artifacts: {
      type: 'boolean',
      description: 'Alias for create_editable_guides.',
    },
    promoteGuideArtifacts: {
      type: 'boolean',
      description: 'Alias for create_editable_guides.',
    },
    allow_generated_blueprint_apply: {
      type: 'boolean',
      description:
        'Required true only when applying a validator-approved ai_generated blueprint after explicit user approval.',
      default: false,
    },
    allowGeneratedBlueprintApply: {
      type: 'boolean',
      description: 'Alias for allow_generated_blueprint_apply.',
    },
  },
  required: ['confirm'],
};

const APP_BLUEPRINT_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    plan: { type: 'object' },
    dry_run: { type: 'boolean' },
    applied: { type: 'boolean' },
    mutation_results: { type: 'array', items: { type: 'object' } },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
};

const APP_BLUEPRINT_TEMPLATES_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    templates: { type: 'array', items: { type: 'object' } },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
};

const PERMISSION_SET_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    q: { type: 'string', description: 'Optional search text.' },
    search: { type: 'string', description: 'Alias for q.' },
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  },
};

const PERMISSION_SET_EDITOR_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {},
};

const PERMISSION_SET_MUTATION_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    permission_set_id: {
      type: 'string',
      description: 'Permission set UUID. Required for update_permission_set.',
    },
    permissionSetId: {
      type: 'string',
      description: 'Alias for permission_set_id.',
    },
    name: { type: 'string' },
    description: { type: 'string' },
    permissions: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    permission: {
      type: 'object',
      description: 'Alias for permissions.',
      additionalProperties: { type: 'string' },
    },
  },
};

const PERMISSION_SET_CREATE_INPUT_SCHEMA = {
  ...PERMISSION_SET_MUTATION_INPUT_SCHEMA,
  required: ['name'],
};

const PERMISSION_SET_UPDATE_INPUT_SCHEMA = {
  ...PERMISSION_SET_MUTATION_INPUT_SCHEMA,
  required: ['permission_set_id', 'name'],
};

const PERMISSION_SET_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    data: { type: 'object' },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
};

const AUTH_STATUS_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    required_scopes: {
      type: 'array',
      description:
        'Optional Sanka feature scopes for diagnostics. MCP OAuth connects with mcp:access; feature access is enforced by Sanka user permissions.',
      items: { type: 'string' },
    },
  },
};

const AUTH_STATUS_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    connected: { type: 'boolean' },
    auth_mode: { type: 'string' },
    tool_profile: { type: 'string' },
    client_name: { type: 'string' },
    scopes: {
      type: 'array',
      items: { type: 'string' },
    },
    message: { type: 'string' },
    authorization_server_url: { type: 'string' },
    authorization_url: { type: 'string' },
    connect_url: { type: 'string' },
    connect_scopes: {
      type: 'array',
      items: { type: 'string' },
    },
    resource_metadata_url: { type: 'string' },
    resource_url: { type: 'string' },
    required_scopes: {
      type: 'array',
      items: { type: 'string' },
    },
    missing_scopes: {
      type: 'array',
      items: { type: 'string' },
    },
    workspace_id: {
      type: 'string',
      description: 'Internal UUID of the workspace bound to the authenticated Sanka credential.',
    },
    workspace_code: {
      type: 'string',
      description: 'Short numeric workspace code used in Sanka URLs. Do not pass this as workspace_id.',
    },
    workspace_name: {
      type: 'string',
      description: 'Human-readable name of the workspace bound to the authenticated Sanka credential.',
    },
    reconnect_mode: { type: 'string' },
    reconnect_instructions: { type: 'string' },
    reconnect_rpc_method: { type: 'string' },
    reconnect_server_name: { type: 'string' },
  },
  required: ['connected', 'auth_mode', 'tool_profile', 'scopes', 'message'],
};

const WORKSPACE_OPTION_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: {
      type: 'string',
      description: 'Internal workspace UUID to pass to switch_workspace.',
    },
    name: { type: 'string' },
    workspace_code: {
      type: 'string',
      description: 'Short numeric workspace code used in Sanka URLs. Do not pass this as workspace_id.',
    },
    selected: { type: 'boolean' },
  },
  required: ['id', 'selected'],
};

const CURRENT_WORKSPACE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    connected: { type: 'boolean' },
    auth_mode: { type: 'string' },
    workspace_id: {
      type: 'string',
      description: 'Internal UUID of the workspace bound to the authenticated Sanka credential.',
    },
    workspace_code: {
      type: 'string',
      description: 'Short numeric workspace code used in Sanka URLs. Do not pass this as workspace_id.',
    },
    workspace_name: { type: 'string' },
    message: { type: 'string' },
  },
  required: ['connected', 'auth_mode', 'message'],
};

const LIST_WORKSPACES_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    current_workspace_id: {
      type: 'string',
      description: 'Internal UUID of the workspace currently bound to this credential.',
    },
    current_workspace_code: {
      type: 'string',
      description: 'Short numeric workspace code currently bound to this credential.',
    },
    current_workspace_name: { type: 'string' },
    available_workspaces: {
      type: 'array',
      items: WORKSPACE_OPTION_SCHEMA,
    },
    message: { type: 'string' },
  },
  required: ['available_workspaces', 'message'],
};

const SWITCH_WORKSPACE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    workspace_id: {
      type: 'string',
      description:
        'Internal workspace UUID from list_workspaces. This switches the authenticated MCP workspace. Do not pass short workspace codes such as 48803074.',
    },
  },
  required: ['workspace_id'],
};

const COMPANY_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    company_id: { type: 'integer' },
    name: { type: 'string' },
    address: { type: 'string' },
    email: { type: 'string' },
    phone_number: { type: 'string' },
    url: { type: 'string' },
    allowed_in_store: { type: 'boolean' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['created_at', 'updated_at'],
};

const COMPANY_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: ['string', 'null'] as any },
    company_id: { type: ['string', 'null'] as any },
    external_id: { type: ['string', 'null'] as any },
    target: { type: ['string', 'null'] as any },
    provider: { type: ['string', 'null'] as any },
    channel_id: { type: ['string', 'null'] as any },
    channel_name: { type: ['string', 'null'] as any },
    external_object_type: { type: ['string', 'null'] as any },
    operation: { type: ['string', 'null'] as any },
    dry_run: { type: ['boolean', 'null'] as any },
    sync_state: { type: ['object', 'null'] as any, additionalProperties: true },
    remote: { type: ['object', 'null'] as any, additionalProperties: true },
    data_origin: { type: ['string', 'null'] as any },
    source_of_truth: { type: ['string', 'null'] as any },
    unavailable_reason: { type: ['string', 'null'] as any },
    message: { type: ['string', 'null'] as any },
  },
  required: ['ok', 'status'],
};

const CONTACT_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    contact_id: { type: 'integer' },
    name: { type: 'string' },
    email: { type: 'string' },
    phone_number: { type: 'string' },
    allowed_in_store: { type: 'boolean' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['created_at', 'updated_at'],
};

const CONTACT_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: ['string', 'null'] as any },
    contact_id: { type: ['string', 'null'] as any },
    external_id: { type: ['string', 'null'] as any },
    target: { type: ['string', 'null'] as any },
    provider: { type: ['string', 'null'] as any },
    channel_id: { type: ['string', 'null'] as any },
    channel_name: { type: ['string', 'null'] as any },
    external_object_type: { type: ['string', 'null'] as any },
    operation: { type: ['string', 'null'] as any },
    dry_run: { type: ['boolean', 'null'] as any },
    remote: { type: ['object', 'null'] as any, additionalProperties: true },
    sync_state: { type: ['object', 'null'] as any, additionalProperties: true },
    warnings: {
      type: ['array', 'null'] as any,
      items: { type: 'string' },
    },
    message: { type: ['string', 'null'] as any },
    data_origin: { type: ['string', 'null'] as any },
    source_of_truth: { type: ['string', 'null'] as any },
  },
  required: ['ok', 'status'],
};

const DEAL_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: ['string', 'null'] as any },
    case_id: { type: ['string', 'null'] as any },
    external_id: { type: ['string', 'null'] as any },
    record_preview: {
      type: ['object', 'null'] as any,
      additionalProperties: true,
    },
    updated_fields: {
      type: ['object', 'null'] as any,
      additionalProperties: true,
    },
    target: { type: ['string', 'null'] as any },
    provider: { type: ['string', 'null'] as any },
    channel_id: { type: ['string', 'null'] as any },
    channel_name: { type: ['string', 'null'] as any },
    external_object_type: { type: ['string', 'null'] as any },
    operation: { type: ['string', 'null'] as any },
    dry_run: { type: ['boolean', 'null'] as any },
    remote: { type: ['object', 'null'] as any, additionalProperties: true },
    sync_state: { type: ['object', 'null'] as any, additionalProperties: true },
    warnings: {
      type: ['array', 'null'] as any,
      items: { type: 'string' },
    },
    message: { type: ['string', 'null'] as any },
  },
  required: ['ok', 'status'],
};

const PROPERTY_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    immutable: { type: 'boolean' },
    is_custom: { type: 'boolean' },
    object: { type: 'string' },
    badge_color: { type: 'string' },
    choice_values: PROPERTY_CHOICE_VALUES_SCHEMA,
    conditional_choice_mapping: {
      type: 'object',
      additionalProperties: true,
    },
    created_at: { type: 'string' },
    description: { type: 'string' },
    internal_name: { type: 'string' },
    multiple_select: { type: 'boolean' },
    name: { type: 'string' },
    number_format: { type: 'string' },
    order: { type: 'integer' },
    required_field: { type: 'boolean' },
    show_badge: { type: 'boolean' },
    tag_values: {
      type: 'array',
      items: { type: 'string' },
    },
    type: { type: 'string' },
    unique: { type: 'boolean' },
    updated_at: { type: 'string' },
  },
  required: ['id', 'immutable', 'is_custom', 'object'],
};

const PROPERTY_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: 'string' },
    object: { type: 'string' },
    property_id: { type: 'string' },
    target: { type: 'string' },
    provider: { type: ['string', 'null'] as any },
    channel_id: { type: ['string', 'null'] as any },
    channel_name: { type: ['string', 'null'] as any },
    external_id: { type: ['string', 'null'] as any },
    external_object_type: { type: ['string', 'null'] as any },
    dry_run: { type: 'boolean' },
    remote: { type: 'object', additionalProperties: true },
  },
  required: ['ok', 'status', 'ctx_id', 'object', 'property_id'],
};

const ORDER_ITEM_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    item_id: {
      type: 'string',
      description: 'Existing item id to attach to the order line.',
    },
    item_external_id: {
      type: 'string',
      description: 'External item reference to attach to the order line.',
    },
    price: {
      type: 'number',
      description: 'Line price.',
    },
    quantity: {
      type: 'integer',
      description: 'Line quantity.',
      minimum: 1,
    },
    tax: {
      type: 'number',
      description: 'Line tax amount.',
    },
    tax_rate: {
      type: 'number',
      description: 'Line tax rate.',
    },
  },
};

const ORDER_BODY_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    external_id: {
      type: 'string',
      description: 'External order reference.',
    },
    company_external_id: {
      type: 'string',
      description: 'External company reference for the order.',
    },
    company_id: {
      type: 'string',
      description: 'Company id for the order.',
    },
    delivery_status: {
      type: 'string',
      description: 'Delivery status.',
    },
    order_at: {
      type: 'string',
      description: 'Order timestamp in ISO format.',
    },
    items: {
      type: 'array',
      description: 'Order line items.',
      items: ORDER_ITEM_INPUT_SCHEMA,
    },
    line_items: {
      type: 'array',
      description:
        'Common line item contract. When provided, Sanka converts these rows into order item rows.',
      items: PUBLIC_LINE_ITEM_INPUT_SCHEMA,
    },
  },
  required: ['external_id'],
};

const ORDER_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    order: ORDER_BODY_INPUT_SCHEMA,
    attachment_file_ids: DOCUMENT_ATTACHMENT_FILE_IDS_INPUT_PROPERTY,
    create_missing_items: {
      type: 'boolean',
      description: 'When true, create referenced items that do not exist yet.',
    },
    trigger_workflows: {
      type: 'boolean',
      description: 'When true, trigger follow-on workflows after the order is created.',
    },
  },
  required: ['order'],
};

const ORDER_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    order_id: {
      type: 'string',
      description: 'Order identifier to update.',
    },
    order: ORDER_BODY_INPUT_SCHEMA,
    attachment_file_ids: DOCUMENT_ATTACHMENT_FILE_IDS_INPUT_PROPERTY,
    create_missing_items: {
      type: 'boolean',
      description: 'When true, create referenced items that do not exist yet.',
    },
    trigger_workflows: {
      type: 'boolean',
      description: 'When true, trigger follow-on workflows after the order is updated.',
    },
  },
  required: ['order_id', 'order'],
};

const ORDER_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    order_id: {
      type: 'string',
      description: 'Order identifier. Accepts a UUID, numeric order id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['order_id'],
};

const ORDER_DOWNLOAD_PDF_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    order_id: {
      type: 'string',
      description: 'Order identifier. Accepts a UUID, numeric order id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    template_select: {
      type: 'string',
      description: 'Optional template selector. Pass a template UUID or built-in template path.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language. Defaults to ja for document PDFs.',
    },
  },
  required: ['order_id'],
};

const ORDER_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    order_id: {
      type: 'string',
      description: 'Order identifier to archive. This is a soft delete, not a permanent delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['order_id'],
};

const ORDER_PERMANENT_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    order_id: {
      type: 'string',
      description: 'Archived order identifier to permanently delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    confirm: {
      type: 'boolean',
      description: 'Must be true. Permanent delete cannot be undone.',
    },
  },
  required: ['order_id', 'confirm'],
};

const TASK_MUTATION_INPUT_PROPERTIES = {
  external_id: {
    type: 'string',
    description: 'External task reference used for idempotent create or update flows.',
  },
  title: {
    type: 'string',
    description: 'Task title.',
  },
  description: {
    type: 'string',
    description: 'Task description.',
  },
  status: {
    type: 'string',
    description: 'Task status.',
  },
  usage_status: {
    type: 'string',
    description: 'Task usage status, for example active or archived.',
  },
  project_id: {
    type: 'string',
    description: 'Optional project identifier associated with the task.',
  },
  start_date: {
    type: 'string',
    description: 'Task start date in ISO format.',
  },
  due_date: {
    type: 'string',
    description: 'Task due date in ISO format.',
  },
  main_task_id: {
    type: 'string',
    description: 'Optional parent task identifier.',
  },
  owner_id: {
    type: 'string',
    description: 'Optional owner identifier.',
  },
  assignees: {
    type: 'array',
    description: 'Optional list of assignee identifiers.',
    items: { type: 'string' },
  },
  projects: {
    type: 'array',
    description: 'Optional list of related project identifiers.',
    items: { type: 'string' },
  },
};

const TASK_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    search: {
      type: 'string',
      description: 'Free-text search query.',
    },
    usage_status: {
      type: 'string',
      description: 'Optional usage status filter.',
    },
    project_id: {
      type: 'string',
      description: 'Optional project identifier filter.',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    page: {
      type: 'integer',
      description: 'Page number to fetch.',
      minimum: 1,
      default: 1,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const TASK_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: TASK_MUTATION_INPUT_PROPERTIES,
};

const TASK_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    task_id: {
      type: 'string',
      description: 'Task identifier. Accepts a UUID, numeric task id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['task_id'],
};

const TASK_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    task_id: {
      type: 'string',
      description: 'Task identifier to update.',
    },
    lookup_external_id: {
      type: 'string',
      description: 'Optional external id lookup override when resolving the task to update.',
    },
    ...TASK_MUTATION_INPUT_PROPERTIES,
  },
  required: ['task_id'],
};

const TASK_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    task_id: {
      type: 'string',
      description: 'Task identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['task_id'],
};

const V2_RECORD_DETAIL_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {},
  additionalProperties: true,
  required: [],
};

const ORDER_OUTPUT_SCHEMA = V2_RECORD_DETAIL_OUTPUT_SCHEMA;

const ORDER_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    operation: { type: 'string' },
    status: { type: 'string' },
    usage_status: { type: 'string' },
    usage_status_label: { type: 'string' },
    permanently_deleted: { type: 'boolean' },
    ctx_id: { type: 'string' },
    job_id: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    order_id: { type: 'string' },
    order_number: { type: 'integer' },
    verification: { type: 'object' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          external_id: { type: ['string', 'null'] as any },
          status: { type: 'string' },
          errors: {
            type: 'array',
            items: { type: 'string' },
          },
          order_id: { type: 'string' },
        },
        required: ['external_id', 'status'],
      },
    },
  },
  required: ['ok'],
};

const PURCHASE_ORDER_MUTATION_INPUT_PROPERTIES = {
  attachment_file_ids: DOCUMENT_ATTACHMENT_FILE_IDS_INPUT_PROPERTY,
  company_external_id: {
    type: 'string',
    description: 'External company reference.',
  },
  company_id: {
    type: 'string',
    description: 'Company id.',
  },
  contact_external_id: {
    type: 'string',
    description: 'External contact reference.',
  },
  contact_id: {
    type: 'string',
    description: 'Contact id.',
  },
  currency: {
    type: 'string',
    description: 'Currency code.',
  },
  date: {
    type: 'string',
    description: 'Purchase order date in ISO format.',
  },
  external_id: {
    type: 'string',
    description: 'External reference.',
  },
  notes: {
    type: 'string',
    description: 'Document notes.',
  },
  status: {
    type: 'string',
    description: 'Purchase order status.',
  },
  tax_option: {
    type: 'string',
    description: 'Tax option.',
  },
  tax_rate: {
    type: 'number',
    description: 'Tax rate.',
  },
  total_price: {
    type: 'number',
    description: 'Total price including tax when applicable.',
  },
  total_price_without_tax: {
    type: 'number',
    description: 'Total price before tax.',
  },
  line_items: {
    type: 'array',
    description:
      'Line items for this purchase order. When provided, Sanka creates/replaces the purchase order detail rows and recalculates totals.',
    items: PUBLIC_LINE_ITEM_INPUT_SCHEMA,
  },
};

const PURCHASE_ORDER_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: PURCHASE_ORDER_MUTATION_INPUT_PROPERTIES,
};

const PURCHASE_ORDER_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    purchase_order_id: {
      type: 'string',
      description: 'Purchase order identifier to update.',
    },
    ...PURCHASE_ORDER_MUTATION_INPUT_PROPERTIES,
  },
  required: ['purchase_order_id'],
};

const PURCHASE_ORDER_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    purchase_order_id: {
      type: 'string',
      description:
        'Purchase order identifier. Accepts a UUID, numeric purchase order id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['purchase_order_id'],
};

const PURCHASE_ORDER_DOWNLOAD_PDF_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    purchase_order_id: {
      type: 'string',
      description:
        'Purchase order identifier. Accepts a UUID, numeric purchase order id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    template_select: {
      type: 'string',
      description: 'Optional template selector. Pass a template UUID or built-in template path.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language. Defaults to ja for document PDFs.',
    },
  },
  required: ['purchase_order_id'],
};

const PURCHASE_ORDER_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    purchase_order_id: {
      type: 'string',
      description: 'Purchase order identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['purchase_order_id'],
};

const PURCHASE_ORDER_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of purchase orders to return from the fetched list.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const PURCHASE_ORDER_OUTPUT_SCHEMA = V2_RECORD_DETAIL_OUTPUT_SCHEMA;

const PURCHASE_ORDER_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    purchase_order_id: { type: 'string' },
    advisories: {
      type: ['array', 'null'] as any,
      items: GOVERNANCE_ADVISORY_OUTPUT_SCHEMA,
    },
  },
  required: ['ok', 'status'],
};

const TASK_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    task_id: { type: 'integer' },
    external_id: { type: ['string', 'null'] as any },
    title: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'string' },
    status_label: { type: 'string' },
    usage_status: { type: 'string' },
    project_id: { type: 'string' },
    project_title: { type: 'string' },
    main_task_id: { type: 'string' },
    owner_id: { type: 'string' },
    start_date: { type: 'string' },
    due_date: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
};

const TASK_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    task_id: { type: 'string' },
  },
  required: ['ok', 'status'],
};

const FINANCIAL_DOCUMENT_LINE_ITEM_INPUT_SCHEMA = PUBLIC_LINE_ITEM_INPUT_SCHEMA;

const ESTIMATE_INVOICE_MUTATION_INPUT_PROPERTIES = {
  attachment_file_ids: DOCUMENT_ATTACHMENT_FILE_IDS_INPUT_PROPERTY,
  company_external_id: {
    type: 'string',
    description: 'External company reference.',
  },
  company_id: {
    type: 'string',
    description: 'Company id.',
  },
  contact_external_id: {
    type: 'string',
    description: 'External contact reference.',
  },
  contact_id: {
    type: 'string',
    description: 'Contact id.',
  },
  currency: {
    type: 'string',
    description: 'Currency code.',
  },
  due_date: {
    type: 'string',
    description: 'Due date in ISO format.',
  },
  external_id: {
    type: 'string',
    description: 'External reference.',
  },
  notes: {
    type: 'string',
    description: 'Document notes.',
  },
  start_date: {
    type: 'string',
    description: 'Document start date in ISO format.',
  },
  status: {
    type: 'string',
    description: 'Document status.',
  },
  tax_inclusive: {
    type: 'boolean',
    description: 'Whether totals are tax inclusive.',
  },
  tax_option: {
    type: 'string',
    description: 'Tax option.',
  },
  tax_rate: {
    type: 'number',
    description: 'Tax rate.',
  },
  total_price: {
    type: 'number',
    description: 'Total price including tax when applicable.',
  },
  total_price_without_tax: {
    type: 'number',
    description: 'Total price before tax.',
  },
  line_items: {
    type: 'array',
    description:
      'Line items for this document. When provided, Sanka creates/replaces the detail rows and recalculates totals.',
    items: FINANCIAL_DOCUMENT_LINE_ITEM_INPUT_SCHEMA,
  },
};

const ESTIMATE_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: ESTIMATE_INVOICE_MUTATION_INPUT_PROPERTIES,
};

const ESTIMATE_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    estimate_id: {
      type: 'string',
      description: 'Estimate identifier to update.',
    },
    ...ESTIMATE_INVOICE_MUTATION_INPUT_PROPERTIES,
  },
  required: ['estimate_id'],
};

const ESTIMATE_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    estimate_id: {
      type: 'string',
      description: 'Estimate identifier. Accepts a UUID, numeric estimate id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['estimate_id'],
};

const ESTIMATE_DOWNLOAD_PDF_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    estimate_id: {
      type: 'string',
      description: 'Estimate identifier. Accepts a UUID, numeric estimate id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    template_select: {
      type: 'string',
      description: 'Optional template selector. Pass a template UUID or built-in template path.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language. Defaults to ja for document PDFs.',
    },
  },
  required: ['estimate_id'],
};

const ESTIMATE_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    estimate_id: {
      type: 'string',
      description: 'Estimate identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['estimate_id'],
};

const ESTIMATE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of estimates to return from the fetched list.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const ESTIMATE_OUTPUT_SCHEMA = V2_RECORD_DETAIL_OUTPUT_SCHEMA;

const ESTIMATE_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    estimate_id: { type: 'string' },
    advisories: {
      type: ['array', 'null'] as any,
      items: GOVERNANCE_ADVISORY_OUTPUT_SCHEMA,
    },
  },
  required: ['ok', 'status'],
};

const BINARY_DOWNLOAD_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    content_disposition: { type: 'string' },
    mime_type: { type: 'string' },
    filename: { type: 'string' },
    byte_length: { type: 'number' },
    completion_status: {
      type: 'string',
      description:
        'inline_content when the PDF bytes are present now, download_url_ready when download_url must be fetched, or requires_chunks when read_binary_download_chunk must be called before reporting completion.',
    },
    download_complete: {
      type: 'boolean',
      description:
        'True only when this result contains final file bytes. False means the download must not be reported as complete yet.',
    },
    file_assembly_required: {
      type: 'boolean',
      description:
        'True when the client must assemble chunks into the final PDF before attaching or saving it.',
    },
    content_base64_available: {
      type: 'boolean',
      description:
        'True when content_base64 is present in this tool result. False means the file must be fetched from download_url or read with read_binary_download_chunk.',
    },
    content_base64: {
      type: 'string',
      description:
        'Base64-encoded file bytes for small downloads. Decode this value to save the downloaded PDF locally.',
    },
    content_base64_length: {
      type: 'number',
      description: 'Total length of the full base64 payload when the download is chunked.',
    },
    download_token: {
      type: 'string',
      description:
        'Opaque token for download_url and read_binary_download_chunk when content_base64_available is false.',
    },
    download_url: {
      type: 'string',
      description:
        'Short-lived URL for downloading the prepared PDF directly without base64 chunks. Fetch this before using read_binary_download_chunk.',
    },
    download_url_expires_at: {
      type: 'string',
      description: 'ISO timestamp when the direct download URL expires.',
    },
    download_transfer_mode: {
      type: 'string',
      description: 'Preferred transfer mode for the prepared PDF, usually url for large files.',
    },
    required_next_tool: {
      type: 'string',
      description: 'The MCP tool that must be called next before reporting the PDF download as complete.',
    },
    fallback_next_tool: {
      type: 'string',
      description: 'Fallback MCP tool to call if the preferred transfer mode is unavailable.',
    },
    chunk_size: {
      type: 'number',
      description: 'Recommended base64 character chunk size for read_binary_download_chunk.',
    },
    total_chunks: {
      type: 'number',
      description:
        'Expected number of read_binary_download_chunk calls when using the recommended chunk_size.',
    },
    expires_at: {
      type: 'string',
      description: 'ISO timestamp when the chunk token expires.',
    },
    next_offset: {
      type: 'number',
      description: 'Initial base64 character offset to pass to read_binary_download_chunk.',
    },
    next_action: {
      type: 'string',
      description:
        'Human-readable completion step. Follow it before telling the user the PDF was downloaded.',
    },
  },
  required: [
    'mime_type',
    'filename',
    'byte_length',
    'completion_status',
    'download_complete',
    'file_assembly_required',
    'content_base64_available',
  ],
};

const BINARY_DOWNLOAD_CHUNK_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    download_token: {
      type: 'string',
      description: 'Opaque token returned by a PDF download tool when content_base64_available is false.',
    },
    token: {
      type: 'string',
      description: 'Alias for download_token.',
    },
    offset: {
      type: 'number',
      description:
        'Base64 character offset to read from. Start at 0, then use next_offset from the previous chunk.',
      minimum: 0,
      default: 0,
    },
    chunk_size: {
      type: 'number',
      description:
        'Optional base64 character chunk size. Defaults to the original chunk_size and is capped for MCP output reliability.',
      minimum: 4,
    },
  },
  required: ['download_token'],
};

const BINARY_DOWNLOAD_CHUNK_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    content_disposition: { type: 'string' },
    mime_type: { type: 'string' },
    filename: { type: 'string' },
    byte_length: { type: 'number' },
    content_base64: {
      type: 'string',
      description: 'Base64 chunk. Concatenate chunks in offset order, then decode the combined string.',
    },
    content_base64_offset: { type: 'number' },
    content_base64_length: { type: 'number' },
    next_offset: { type: 'number' },
    done: { type: 'boolean' },
    chunk_size: { type: 'number' },
    expires_at: { type: 'string' },
    completion_status: {
      type: 'string',
      description:
        'requires_next_chunk until more chunks remain, or chunks_read when this is the final chunk.',
    },
    file_assembly_required: {
      type: 'boolean',
      description:
        'Always true for chunk reads. Concatenate all chunks in offset order and decode before reporting completion.',
    },
    required_next_tool: {
      type: 'string',
      description:
        'The MCP tool to call again when done is false. Omitted once the final chunk has been read.',
    },
    next_action: {
      type: 'string',
      description:
        'Human-readable completion step. Follow it before telling the user the PDF was downloaded.',
    },
  },
  required: [
    'mime_type',
    'filename',
    'byte_length',
    'content_base64',
    'content_base64_offset',
    'content_base64_length',
    'next_offset',
    'done',
    'chunk_size',
    'completion_status',
    'file_assembly_required',
    'next_action',
  ],
};

const INVOICE_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: ESTIMATE_INVOICE_MUTATION_INPUT_PROPERTIES,
};

const INVOICE_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    invoice_id: {
      type: 'string',
      description: 'Invoice identifier to update.',
    },
    ...ESTIMATE_INVOICE_MUTATION_INPUT_PROPERTIES,
  },
  required: ['invoice_id'],
};

const INVOICE_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    invoice_id: {
      type: 'string',
      description: 'Invoice identifier. Accepts a UUID, numeric invoice id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['invoice_id'],
};

const INVOICE_DOWNLOAD_PDF_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    invoice_id: {
      type: 'string',
      description: 'Invoice identifier. Accepts a UUID, numeric invoice id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    template_select: {
      type: 'string',
      description: 'Optional template selector. Pass a template UUID or built-in template path.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language. Defaults to ja for document PDFs.',
    },
  },
  required: ['invoice_id'],
};

const INVOICE_EMAIL_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    invoice_id: {
      type: 'string',
      description: 'Invoice identifier. Accepts a UUID, numeric invoice id, or external reference.',
    },
    action: {
      type: 'string',
      description: 'Create a draft, send now, or schedule for later.',
      enum: ['draft', 'send', 'schedule'],
      default: 'send',
    },
    to: {
      type: 'array',
      description:
        'Primary recipient email addresses or supported Sanka recipient selectors. Omit to use the invoice customer email.',
      items: { type: 'string' },
    },
    cc: {
      type: 'array',
      description: 'Optional CC email addresses or supported Sanka recipient selectors.',
      items: { type: 'string' },
    },
    subject: {
      type: 'string',
      description: 'Optional email subject. Defaults to the workspace invoice PDF email subject.',
    },
    body: {
      type: 'string',
      description: 'Optional email body. Defaults to the workspace invoice PDF email body.',
    },
    scheduled_at: {
      type: 'string',
      description:
        'Required when action="schedule". ISO datetime for scheduled send, for example 2026-05-21T09:00:00+09:00.',
    },
    template_select: {
      type: 'string',
      description: 'Optional invoice PDF template selector. Pass a template UUID or built-in template path.',
    },
    additional_pdf_attachments: {
      type: 'array',
      description:
        'Optional extra generated PDF attachments, such as additional invoices or delivery notes. Supported object_type values are invoices, estimates, orders, and purchase_orders. Each item may include template_select, object_type, record_id, and filename. Omit record_id/object_type to render this invoice with another template.',
      items: {
        type: 'object',
        properties: {
          template_select: {
            type: 'string',
            description: 'PDF template UUID or built-in template path to render for this attachment.',
          },
          object_type: {
            type: 'string',
            enum: [
              'invoice',
              'invoices',
              'estimate',
              'estimates',
              'order',
              'orders',
              'purchase_order',
              'purchase_orders',
            ],
            description: 'Optional Sanka object type or slug. Defaults to invoices.',
          },
          record_id: {
            type: 'string',
            description: 'Optional record UUID to render. Defaults to invoice_id.',
          },
          filename: {
            type: 'string',
            description: 'Optional attachment filename. Defaults to the rendered record number.',
          },
        },
      },
    },
    channel_id: {
      type: 'string',
      description: 'Optional SMTP/email channel UUID. Omit to use Sanka default sending.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['invoice_id'],
};

const INVOICE_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    invoice_id: {
      type: 'string',
      description: 'Invoice identifier to archive. This is a soft delete, not a permanent delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['invoice_id'],
};

const INVOICE_PERMANENT_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    invoice_id: {
      type: 'string',
      description: 'Archived invoice identifier to permanently delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    confirm: {
      type: 'boolean',
      description: 'Must be true. Permanent delete cannot be undone.',
    },
  },
  required: ['invoice_id', 'confirm'],
};

const INVOICE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of invoices to return from the fetched list.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const INVOICE_OVERDUE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of overdue invoices to return from the fetched list.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    as_of_date: {
      type: 'string',
      description: 'Optional evaluation date in ISO format. Defaults to today.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const JOURNAL_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    view_id: {
      type: 'string',
      description:
        'Optional saved journal view id. Pass a profit_and_loss, balance_sheet, or cash_flow view id to return statement rows.',
    },
    view: {
      type: 'string',
      description: 'Alias for view_id.',
    },
    search: {
      type: 'string',
      description: 'Optional free-text search for normal journal table views.',
    },
    status: {
      type: 'string',
      description: 'Optional journal usage/status filter.',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of journal rows or statement rows to return.',
      minimum: 1,
      maximum: 100,
      default: 25,
    },
    page: {
      type: 'integer',
      description: 'Page number for normal journal table views.',
      minimum: 1,
      default: 1,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const JOURNAL_STATEMENT_VIEW_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: {
      type: 'string',
      description: 'Name of the saved Sanka journal view to create.',
    },
    view_type: {
      type: 'string',
      description: 'Statement view type to create.',
      enum: ['profit_and_loss', 'balance_sheet', 'cash_flow'],
      default: 'profit_and_loss',
    },
    is_private: {
      type: 'boolean',
      description: 'Create a private view visible only to the authenticated user.',
      default: false,
    },
    balance_sheet_display: {
      type: 'string',
      description: 'Balance-sheet display mode. Applies only to view_type="balance_sheet".',
      enum: ['vertical', 'two_column'],
      default: 'vertical',
    },
    balance_sheet_type: {
      type: 'string',
      description:
        'Balance-sheet period preset. Applies only to view_type="balance_sheet". Use bs_snapshot, bs_this_year, bs_last_year, or bs_custom_date.',
    },
    date_range: {
      type: 'string',
      description:
        'Custom balance-sheet date range in YYYY-MM-DD - YYYY-MM-DD format. Applies only to view_type="balance_sheet".',
    },
    include_preview: {
      type: 'boolean',
      description: 'Return the generated statement rows after creating the view.',
      default: true,
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of preview rows to return.',
      minimum: 1,
      maximum: 100,
      default: 25,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const JOURNAL_STATEMENT_VIEW_CREATE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    data: { type: 'object' },
    statement: { type: ['object', 'null'] as any },
    message: { type: 'string' },
    ctx_id: { type: ['string', 'null'] as any },
  },
};

const VIEW_FILTER_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    field: {
      type: 'string',
      description: 'Field key to filter on.',
    },
    operator: {
      type: 'string',
      description: 'Filter operator such as equals, contains, between, is_empty, or is_not_empty.',
      default: 'equals',
    },
    value: {
      description: 'Filter value. Omit for empty/not-empty operators.',
    },
    value2: {
      description: 'Second filter value for between filters.',
    },
  },
  required: ['field'],
};

const VIEW_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object: {
      type: 'string',
      description:
        'Sanka object name or type, for example orders, invoices, companies, contacts, deals, tickets, tasks, custom_object, dashboards, or panels.',
    },
    custom_object_id: {
      type: 'string',
      description: 'Sanka custom object id when object is custom_object/custom_objects.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['object'],
};

const VIEW_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    view_id: {
      type: 'string',
      description: 'Saved view UUID.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['view_id'],
};

const VIEW_MUTATION_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object: {
      type: 'string',
      description:
        'Sanka object name or type, for example orders, invoices, companies, contacts, deals, tickets, tasks, custom_object, dashboards, or panels.',
    },
    custom_object_id: {
      type: 'string',
      description: 'Sanka custom object id when object is custom_object/custom_objects.',
    },
    name: {
      type: 'string',
      description: 'Saved view name.',
    },
    view_type: {
      type: 'string',
      description:
        'View type, for example list, table, kanban, profit_and_loss, balance_sheet, or cash_flow.',
      default: 'list',
    },
    columns: {
      type: 'array',
      description: 'Column keys to show in the saved view.',
      items: { type: 'string' },
    },
    pagination: {
      type: 'integer',
      description: 'Rows per page for list/table views.',
      minimum: 1,
      maximum: 200,
    },
    is_private: {
      type: 'boolean',
      description: 'Create or keep the view private to the authenticated user.',
      default: false,
    },
    sort_order_by: {
      type: 'string',
      description: 'Optional sort field key.',
    },
    sort_order_method: {
      type: 'string',
      description: 'Optional sort direction.',
      enum: ['asc', 'desc'],
    },
    filters: {
      type: 'array',
      description: 'Optional saved view filters.',
      items: VIEW_FILTER_INPUT_SCHEMA,
    },
    form_data: {
      type: 'object',
      description:
        'Advanced escape hatch for existing view-settings form fields. Prefer the structured fields above.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['object'],
};

const VIEW_UPDATE_INPUT_SCHEMA = {
  ...VIEW_MUTATION_INPUT_SCHEMA,
  properties: {
    ...VIEW_MUTATION_INPUT_SCHEMA.properties,
    view_id: {
      type: 'string',
      description: 'Saved view UUID to update.',
    },
  },
  required: ['view_id', 'object'],
};

const VIEW_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    view_id: {
      type: 'string',
      description: 'Saved view UUID to delete.',
    },
    object: VIEW_MUTATION_INPUT_SCHEMA.properties.object,
    custom_object_id: VIEW_MUTATION_INPUT_SCHEMA.properties.custom_object_id,
    workspace_id: VIEW_MUTATION_INPUT_SCHEMA.properties.workspace_id,
    language: VIEW_MUTATION_INPUT_SCHEMA.properties.language,
  },
  required: ['view_id', 'object'],
};

const REPORT_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    page: {
      type: 'integer',
      minimum: 1,
      default: 1,
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
};

const REPORT_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    report_id: {
      type: 'string',
      description: 'Report UUID.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['report_id'],
};

const REPORT_PANEL_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    panel_type: {
      type: 'string',
      description: 'Panel type, for example chart, table, summary_card, pivot_table, or number.',
    },
    data_source: { type: 'string' },
    data_sources: {
      type: 'array',
      items: { type: 'string' },
    },
    data_source_type: { type: 'string', default: 'app' },
    width_units: { type: 'integer' },
    height_px: { type: 'integer' },
    ratio: { type: 'integer' },
    breakdown: { type: 'string' },
    filter: { type: 'object' },
    meta_data: { type: 'object' },
    type_objects: {
      type: 'array',
      items: { type: 'string' },
    },
    metrics: {
      type: 'array',
      items: { type: 'object' },
    },
    order: { type: 'integer' },
  },
};

const REPORT_MUTATION_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: {
      type: 'string',
      description: 'Report name.',
    },
    description: {
      type: 'string',
      description: 'Report description.',
    },
    report_type: {
      type: 'string',
      description:
        'Source object for the report. Supported examples include orders, invoices, payments, bills, expenses, deals, companies, contacts, items, subscriptions, purchase_orders, and slips.',
    },
    report_format: {
      type: 'string',
      description:
        'Optional report format or default panel type, for example chart, table, summary_card, or pivot_table.',
    },
    report_filters: {
      type: 'object',
      description: 'Optional reportFilters payload accepted by the Sanka public report API.',
    },
    report_metadata: {
      type: 'object',
      description:
        'Advanced reportMetadata payload. Prefer name/report_type/report_format for simple reports.',
    },
    create_default_panel: {
      type: 'boolean',
      description: 'Create a default panel when panels are omitted.',
      default: true,
    },
    panels: {
      type: 'array',
      description: 'Optional report panel definitions.',
      items: REPORT_PANEL_INPUT_SCHEMA,
    },
  },
  required: ['name', 'report_type'],
};

const REPORT_UPDATE_INPUT_SCHEMA = {
  ...REPORT_MUTATION_INPUT_SCHEMA,
  properties: {
    ...REPORT_MUTATION_INPUT_SCHEMA.properties,
    report_id: REPORT_RETRIEVE_INPUT_SCHEMA.properties.report_id,
    workspace_id: REPORT_RETRIEVE_INPUT_SCHEMA.properties.workspace_id,
  },
  required: ['report_id'],
};

const PAYMENT_DOWNLOAD_PDF_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    payment_id: {
      type: 'string',
      description: 'Payment identifier. Accepts a UUID, numeric payment id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    template_select: {
      type: 'string',
      description: 'Optional template selector. Pass a template UUID or built-in template path.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language. Defaults to ja for document PDFs.',
    },
  },
  required: ['payment_id'],
};

const SLIP_MUTATION_INPUT_PROPERTIES = {
  company_external_id: {
    type: 'string',
    description: 'External company reference.',
  },
  company_id: {
    type: 'string',
    description: 'Company id.',
  },
  contact_external_id: {
    type: 'string',
    description: 'External contact reference.',
  },
  contact_id: {
    type: 'string',
    description: 'Contact id.',
  },
  currency: {
    type: 'string',
    description: 'Currency code.',
  },
  external_id: {
    type: 'string',
    description: 'External reference.',
  },
  notes: {
    type: 'string',
    description: 'Document notes.',
  },
  slip_type: {
    type: 'string',
    description: 'Slip document type.',
  },
  start_date: {
    type: 'string',
    description: 'Document start date in ISO format.',
  },
  status: {
    type: 'string',
    description: 'Document status.',
  },
  tax_inclusive: {
    type: 'boolean',
    description: 'Whether totals are tax inclusive.',
  },
  tax_option: {
    type: 'string',
    description: 'Tax option.',
  },
  tax_rate: {
    type: 'number',
    description: 'Tax rate.',
  },
  total_price: {
    type: 'number',
    description: 'Total price including tax when applicable.',
  },
  total_price_without_tax: {
    type: 'number',
    description: 'Total price before tax.',
  },
  line_items: {
    type: 'array',
    description:
      'Line items for this document. When provided, Sanka creates/replaces the detail rows and recalculates totals.',
    items: FINANCIAL_DOCUMENT_LINE_ITEM_INPUT_SCHEMA,
  },
};

const SLIP_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: SLIP_MUTATION_INPUT_PROPERTIES,
};

const SLIP_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    slip_id: {
      type: 'string',
      description: 'Slip identifier to update.',
    },
    ...SLIP_MUTATION_INPUT_PROPERTIES,
  },
  required: ['slip_id'],
};

const SLIP_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    slip_id: {
      type: 'string',
      description: 'Slip identifier. Accepts a UUID, numeric slip id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['slip_id'],
};

const SLIP_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    slip_id: {
      type: 'string',
      description: 'Slip identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['slip_id'],
};

const SLIP_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of slips to return from the fetched list.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const SLIP_DOWNLOAD_PDF_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    slip_id: {
      type: 'string',
      description: 'Slip identifier. Accepts a UUID, numeric slip id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    template_select: {
      type: 'string',
      description: 'Optional template selector. Pass a template UUID or built-in template path.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language. Defaults to ja for document PDFs.',
    },
  },
  required: ['slip_id'],
};

const BILL_MUTATION_INPUT_PROPERTIES = {
  amount: {
    type: 'number',
    description: 'Bill amount in the provided currency.',
  },
  amount_without_tax: {
    type: 'number',
    description: 'Bill amount before tax.',
  },
  attachment_file_ids: {
    type: 'array',
    description:
      'Optional uploaded bill attachment file IDs to bind to the bill. For client-local invoice PDFs or large/unreliable base64 payloads, use start_bill_attachment_upload, append_bill_attachment_upload_chunk until done, then finish_bill_attachment_upload and pass the returned file_id here.',
    items: {
      type: 'string',
    },
  },
  company_external_id: {
    type: 'string',
    description: 'External company reference.',
  },
  company_id: {
    type: 'string',
    description: 'Company id.',
  },
  contact_external_id: {
    type: 'string',
    description: 'External contact reference.',
  },
  contact_id: {
    type: 'string',
    description: 'Contact id.',
  },
  currency: {
    type: 'string',
    description: 'Currency code.',
  },
  description: {
    type: 'string',
    description: 'Bill description.',
  },
  due_date: {
    type: 'string',
    description: 'Due date in ISO format.',
  },
  external_id: {
    type: 'string',
    description: 'External reference.',
  },
  issued_date: {
    type: 'string',
    description: 'Issue date in ISO format.',
  },
  notes: {
    type: 'string',
    description: 'Document notes.',
  },
  payment_date: {
    type: 'string',
    description: 'Payment date in ISO format.',
  },
  status: {
    type: 'string',
    description: 'Bill status.',
  },
  tax_inclusive: {
    type: 'boolean',
    description: 'Whether totals are tax inclusive.',
  },
  tax_option: {
    type: 'string',
    description: 'Tax option.',
  },
  tax_rate: {
    type: 'number',
    description: 'Tax rate.',
  },
  line_items: {
    type: 'array',
    description:
      'Line items for this bill. When provided, Sanka creates/replaces the bill detail rows and recalculates totals.',
    items: PUBLIC_LINE_ITEM_INPUT_SCHEMA,
  },
};

const BILL_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: BILL_MUTATION_INPUT_PROPERTIES,
};

const BILL_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    bill_id: {
      type: 'string',
      description: 'Bill identifier to update.',
    },
    ...BILL_MUTATION_INPUT_PROPERTIES,
  },
  required: ['bill_id'],
};

const BILL_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    bill_id: {
      type: 'string',
      description: 'Bill identifier. Accepts a UUID, numeric bill id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['bill_id'],
};

const BILL_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    bill_id: {
      type: 'string',
      description: 'Bill identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['bill_id'],
};

const BILL_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of bills to return from the fetched list.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const DISBURSEMENT_MUTATION_INPUT_PROPERTIES = {
  company_external_id: {
    type: 'string',
    description: 'External company reference.',
  },
  company_id: {
    type: 'string',
    description: 'Company id.',
  },
  contact_external_id: {
    type: 'string',
    description: 'External contact reference.',
  },
  contact_id: {
    type: 'string',
    description: 'Contact id.',
  },
  currency: {
    type: 'string',
    description: 'Currency code.',
  },
  external_id: {
    type: 'string',
    description: 'External reference.',
  },
  fee: {
    type: 'number',
    description: 'Additional fee amount.',
  },
  notes: {
    type: 'string',
    description: 'Document notes.',
  },
  start_date: {
    type: 'string',
    description: 'Document start date in ISO format.',
  },
  status: {
    type: 'string',
    description: 'Document status.',
  },
  tax_inclusive: {
    type: 'boolean',
    description: 'Whether totals are tax inclusive.',
  },
  tax_option: {
    type: 'string',
    description: 'Tax option.',
  },
  tax_rate: {
    type: 'number',
    description: 'Tax rate.',
  },
  total_price: {
    type: 'number',
    description: 'Total price including tax when applicable.',
  },
  total_price_without_tax: {
    type: 'number',
    description: 'Total price before tax.',
  },
  line_items: {
    type: 'array',
    description:
      'Line items for this disbursement. When provided, Sanka creates/replaces the disbursement detail rows and recalculates totals.',
    items: PUBLIC_LINE_ITEM_INPUT_SCHEMA,
  },
};

const DISBURSEMENT_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: DISBURSEMENT_MUTATION_INPUT_PROPERTIES,
};

const DISBURSEMENT_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    disbursement_id: {
      type: 'string',
      description: 'Disbursement identifier to update.',
    },
    ...DISBURSEMENT_MUTATION_INPUT_PROPERTIES,
  },
  required: ['disbursement_id'],
};

const DISBURSEMENT_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    disbursement_id: {
      type: 'string',
      description: 'Disbursement identifier. Accepts a UUID, numeric disbursement id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['disbursement_id'],
};

const DISBURSEMENT_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    disbursement_id: {
      type: 'string',
      description: 'Disbursement identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['disbursement_id'],
};

const DISBURSEMENT_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of disbursements to return from the fetched list.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const DISBURSEMENT_ALLOCATION_LINE_INPUT_PROPERTIES = {
  payable_type: {
    type: 'string',
    description: 'Payable object type to allocate. Use "expense" for Expense or "bill" for Bill.',
    enum: ['bill', 'expense'],
  },
  payable_id: {
    type: 'string',
    description:
      'Payable record identifier. Accepts UUID or the workspace numeric id for the selected payable type.',
  },
  bill_id: {
    type: 'string',
    description: 'Bill identifier alias. Use this instead of payable_id when allocating a bill.',
  },
  expense_id: {
    type: 'string',
    description: 'Expense identifier alias. Use this instead of payable_id when allocating an expense.',
  },
  id_bill: {
    type: 'string',
    description: 'Numeric bill id alias.',
  },
  id_pm: {
    type: 'string',
    description: 'Numeric expense id alias.',
  },
  amount: {
    type: 'number',
    description: 'Amount to allocate from the disbursement to the payable.',
  },
  currency: {
    type: 'string',
    description:
      'Optional allocation currency. Must match the disbursement and payable currency when provided.',
  },
  source: {
    type: 'string',
    description: 'Optional allocation source label, for example manual, api, bank_statement, or migration.',
  },
  notes: {
    type: 'string',
    description: 'Optional allocation notes.',
  },
};

const DISBURSEMENT_ALLOCATIONS_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    disbursement_id: {
      type: 'string',
      description: 'Disbursement identifier. Accepts a UUID, numeric disbursement id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['disbursement_id'],
};

const DISBURSEMENT_ALLOCATION_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...DISBURSEMENT_ALLOCATIONS_LIST_INPUT_SCHEMA.properties,
    ...DISBURSEMENT_ALLOCATION_LINE_INPUT_PROPERTIES,
  },
  required: ['disbursement_id', 'amount'],
};

const DISBURSEMENT_ALLOCATION_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...DISBURSEMENT_ALLOCATIONS_LIST_INPUT_SCHEMA.properties,
    allocation_id: {
      type: 'string',
      description: 'Disbursement allocation row UUID returned by list_disbursement_allocations.',
    },
    ...DISBURSEMENT_ALLOCATION_LINE_INPUT_PROPERTIES,
  },
  required: ['disbursement_id', 'allocation_id'],
};

const DISBURSEMENT_ALLOCATION_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...DISBURSEMENT_ALLOCATIONS_LIST_INPUT_SCHEMA.properties,
    allocation_id: {
      type: 'string',
      description: 'Disbursement allocation row UUID returned by list_disbursement_allocations.',
    },
  },
  required: ['disbursement_id', 'allocation_id'],
};

const INVOICE_OUTPUT_SCHEMA = V2_RECORD_DETAIL_OUTPUT_SCHEMA;

const INVOICE_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    operation: { type: 'string' },
    status: { type: 'string' },
    usage_status: { type: 'string' },
    usage_status_label: { type: 'string' },
    permanently_deleted: { type: 'boolean' },
    ctx_id: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    invoice_id: { type: 'string' },
    id_inv: { type: 'integer' },
    verification: { type: 'object' },
    app_url: { type: 'string' },
    workspace_code: { type: 'string' },
    advisories: {
      type: ['array', 'null'] as any,
      items: GOVERNANCE_ADVISORY_OUTPUT_SCHEMA,
    },
  },
  required: ['ok', 'status'],
};

const INVOICE_EMAIL_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: 'string' },
    invoice_id: { type: 'string' },
    id_inv: { type: 'integer' },
    message_thread_ids: {
      type: 'array',
      items: { type: 'string' },
    },
    scheduled_at: { type: 'string' },
    attachment_count: { type: 'integer' },
    message: { type: 'string' },
  },
  required: ['ok', 'status', 'invoice_id', 'message_thread_ids'],
};

const SLIP_OUTPUT_SCHEMA = V2_RECORD_DETAIL_OUTPUT_SCHEMA;

const SLIP_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    slip_id: { type: 'string' },
  },
  required: ['ok', 'status'],
};

const BILL_OUTPUT_SCHEMA = V2_RECORD_DETAIL_OUTPUT_SCHEMA;

const BILL_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    bill_id: { type: 'string' },
    ctx_id: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    advisories: {
      type: ['array', 'null'] as any,
      items: GOVERNANCE_ADVISORY_OUTPUT_SCHEMA,
    },
  },
  required: ['ok', 'status'],
};

const DISBURSEMENT_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    company_name: { type: 'string' },
    contact_name: { type: 'string' },
    currency: { type: 'string' },
    id_dsb: { type: 'integer' },
    start_date: { type: 'string' },
    status: { type: 'string' },
    total_price: { type: 'number' },
    total_price_without_tax: { type: 'number' },
  },
  required: ['created_at', 'updated_at'],
};

const DISBURSEMENT_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: 'string' },
    disbursement_id: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
  },
  required: ['ok', 'status'],
};

const DISBURSEMENT_ALLOCATIONS_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    disbursement: {
      type: 'object',
      additionalProperties: true,
    },
    bill: {
      type: 'object',
      additionalProperties: true,
    },
    expense: {
      type: 'object',
      additionalProperties: true,
    },
    allocations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
      },
    },
    available_payables: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
      },
    },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
};

const TICKET_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of tickets to return from the fetched ticket list.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
};

const TICKET_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ticket_id: {
      type: 'string',
      description: 'Ticket identifier. Accepts a UUID, numeric ticket id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
  required: ['ticket_id'],
};

const TICKET_MUTATION_INPUT_PROPERTIES = {
  deal_ids: {
    type: 'array',
    description: 'Optional deal ids to associate to the ticket.',
    items: {
      type: 'string',
    },
  },
  description: {
    type: 'string',
    description: 'Ticket description or body.',
  },
  external_id: {
    type: 'string',
    description: 'External reference stored on the ticket for idempotent create or update flows.',
  },
  first_response_due_at: {
    type: 'string',
    description: 'First response SLA due-at timestamp in ISO format.',
  },
  owner_id: {
    type: 'string',
    description: 'Owner user id.',
  },
  priority: {
    type: 'string',
    description: 'Ticket priority.',
  },
  resolution_due_at: {
    type: 'string',
    description: 'Resolution SLA due-at timestamp in ISO format.',
  },
  stage_key: {
    type: 'string',
    description: 'Pipeline stage key.',
  },
  status: {
    type: 'string',
    description: 'Ticket status.',
  },
  title: {
    type: 'string',
    description: 'Ticket title.',
  },
  visibility: {
    type: 'string',
    description: 'Ticket visibility.',
  },
};

const TICKET_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: TICKET_MUTATION_INPUT_PROPERTIES,
};

const TICKET_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ticket_id: {
      type: 'string',
      description: 'Ticket identifier to update.',
    },
    lookup_external_id: {
      type: 'string',
      description: 'Optional explicit external id used to resolve the target ticket.',
    },
    ...TICKET_MUTATION_INPUT_PROPERTIES,
  },
  required: ['ticket_id'],
};

const TICKET_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ticket_id: {
      type: 'string',
      description: 'Ticket identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['ticket_id'],
};

const TICKET_PIPELINES_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
  },
};

const TICKET_STATUS_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ticket_id: {
      type: 'string',
      description: 'Ticket identifier to update.',
    },
    lookup_external_id: {
      type: 'string',
      description: 'Optional explicit external id used to resolve the target ticket.',
    },
    stage_key: {
      type: 'string',
      description: 'Pipeline stage key to assign.',
    },
    status: {
      type: 'string',
      description: 'Ticket status to assign.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['ticket_id'],
};

const TICKET_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    ticket_id: { type: 'integer' },
    title: { type: 'string' },
    description: { type: 'string' },
    owner_id: { type: 'string' },
    pipeline_id: { type: 'string' },
    pipeline_name: { type: 'string' },
    pipeline_order: { type: 'integer' },
    priority: { type: 'string' },
    resolution_due_at: { type: 'string' },
    first_response_due_at: { type: 'string' },
    responded_at: { type: 'string' },
    resolved_at: { type: 'string' },
    sla_status: { type: 'string' },
    source_channel: { type: 'string' },
    stage_key: { type: 'string' },
    status: { type: 'string' },
    visibility: { type: 'string' },
    deal_ids: {
      type: 'array',
      items: { type: 'string' },
    },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['created_at', 'updated_at'],
};

const TICKET_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    ticket_id: { type: 'string' },
  },
  required: ['ok', 'status'],
};

const CALENDAR_BOOTSTRAP_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    attendance_id: {
      type: 'string',
      description: 'Existing attendance id when loading a reschedule or cancel flow.',
    },
    mode: {
      type: 'string',
      description: 'Optional booking flow mode override.',
    },
    slug: {
      type: 'string',
      description: 'Public event slug to bootstrap.',
    },
    url: {
      type: 'string',
      description: 'Optional public booking URL to resolve.',
    },
  },
};

const CALENDAR_AVAILABILITY_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    event_id: {
      type: 'string',
      description: 'Public calendar event id to check availability for.',
    },
    start_date: {
      type: 'string',
      description: 'Start date in ISO format for the first day to inspect.',
    },
    days: {
      type: 'integer',
      description: 'Number of days to inspect starting from start_date.',
      minimum: 1,
    },
    timezone: {
      type: 'string',
      description: 'Timezone to evaluate and return slots in.',
    },
  },
  required: ['event_id', 'start_date'],
};

const CALENDAR_ATTENDANCE_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    date: {
      type: 'string',
      description: 'Booking date in ISO format.',
    },
    email: {
      type: 'string',
      description: 'Attendee email address.',
    },
    event_id: {
      type: 'string',
      description: 'Public calendar event id to book.',
    },
    name: {
      type: 'string',
      description: 'Attendee name.',
    },
    time: {
      type: 'string',
      description: 'Booking start time.',
    },
    comment: {
      type: 'string',
      description: 'Optional attendee comment.',
    },
    timezone: {
      type: 'string',
      description: 'Timezone for the requested booking slot.',
    },
  },
  required: ['date', 'email', 'event_id', 'name', 'time'],
};

const CALENDAR_ATTENDANCE_CANCEL_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    attendance_id: {
      type: 'string',
      description: 'Attendance identifier to cancel.',
    },
  },
  required: ['attendance_id'],
};

const CALENDAR_ATTENDANCE_RESCHEDULE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    attendance_id: {
      type: 'string',
      description: 'Attendance identifier to reschedule.',
    },
    date: {
      type: 'string',
      description: 'New booking date in ISO format.',
    },
    time: {
      type: 'string',
      description: 'New booking start time.',
    },
    comment: {
      type: 'string',
      description: 'Optional attendee comment.',
    },
    email: {
      type: 'string',
      description: 'Optional attendee email address override.',
    },
    name: {
      type: 'string',
      description: 'Optional attendee name override.',
    },
    timezone: {
      type: 'string',
      description: 'Timezone for the requested booking slot.',
    },
  },
  required: ['attendance_id', 'date', 'time'],
};

const PUBLIC_CALENDAR_ATTENDANCE_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    calendar_event_id: { type: 'string' },
    comment: { type: 'string' },
    event_id: { type: 'string' },
    link: { type: 'string' },
    select_date: { type: 'string' },
    time_event: { type: 'string' },
    timezone: { type: 'string' },
    user_email: { type: 'string' },
    user_name: { type: 'string' },
  },
  required: ['id'],
};

const CALENDAR_BOOTSTRAP_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: { type: 'string' },
    mode: { type: 'string' },
    status: { type: 'string' },
    ctx_id: { type: 'string' },
    attendance: PUBLIC_CALENDAR_ATTENDANCE_SCHEMA,
    event: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        duration: { type: 'string' },
        location: { type: 'string' },
        slug: { type: 'string' },
        status: { type: 'string' },
        time_increment: { type: 'string' },
        timezone: { type: 'string' },
        timezone_label: { type: 'string' },
        timezone_locked: { type: 'boolean' },
        url: { type: 'string' },
        schedule: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day_index: { type: 'integer' },
              day_name: { type: 'string' },
              enabled: { type: 'boolean' },
              slots: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    start: { type: 'string' },
                    end: { type: 'string' },
                  },
                  required: ['start', 'end'],
                },
              },
            },
            required: ['day_index', 'day_name'],
          },
        },
      },
      required: ['id', 'title'],
    },
    workspace: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        short_id: { type: 'string' },
        timezone: { type: 'string' },
      },
      required: ['id', 'name'],
    },
  },
  required: ['message', 'mode', 'status'],
};

const CALENDAR_AVAILABILITY_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: { type: 'string' },
    ctx_id: { type: 'string' },
    timezone: { type: 'string' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          day_index: { type: 'integer' },
          weekday: { type: 'string' },
          slots: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['date', 'day_index', 'weekday'],
      },
    },
  },
  required: ['message'],
};

const CALENDAR_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    message: { type: 'string' },
    status: { type: 'string' },
    ok: { type: 'boolean' },
    ctx_id: { type: 'string' },
    meet_link: { type: 'string' },
    attendance: PUBLIC_CALENDAR_ATTENDANCE_SCHEMA,
  },
  required: ['message', 'status'],
};

const WORKSPACE_LANGUAGE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return locally from the API response.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    workspace_id: {
      type: 'string',
      description: WORKSPACE_ID_DESCRIPTION,
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language when supported.',
    },
  },
};

const SEARCHABLE_WORKSPACE_LANGUAGE_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...WORKSPACE_LANGUAGE_LIST_INPUT_SCHEMA.properties,
    search: {
      type: 'string',
      description: 'Optional search term.',
    },
  },
};

const OBJECT_RECORD_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...SEARCHABLE_WORKSPACE_LANGUAGE_LIST_INPUT_SCHEMA.properties,
    page: {
      type: 'integer',
      description: 'Page number to fetch.',
      minimum: 1,
      default: 1,
    },
    sort: {
      type: 'string',
      description: 'Sort field, optionally prefixed with "-" for descending order.',
    },
    view_id: {
      type: 'string',
      description: 'Optional saved view identifier.',
    },
  },
};

const ITEM_MUTATION_INPUT_PROPERTIES = {
  external_id: {
    type: 'string',
    description: 'External item reference.',
  },
  name: {
    type: 'string',
    description: 'Item name.',
  },
  description: {
    type: 'string',
    description: 'Item description.',
  },
  currency: {
    type: 'string',
    description: 'Currency code.',
  },
  price: {
    type: 'number',
    description: 'Default sales price.',
  },
  purchase_price: {
    type: 'number',
    description: 'Optional purchase price.',
  },
  tax: {
    type: 'number',
    description: 'Tax amount or rate stored on the item.',
  },
  status: {
    type: 'string',
    description: 'Item status.',
  },
};

const ITEM_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: ITEM_MUTATION_INPUT_PROPERTIES,
  required: ['external_id'],
};

const ITEM_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    item_id: {
      type: 'string',
      description: 'Item identifier. Accepts a UUID, numeric item id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['item_id'],
};

const ITEM_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    item_id: {
      type: 'string',
      description: 'Item identifier to update.',
    },
    ...ITEM_MUTATION_INPUT_PROPERTIES,
  },
  required: ['item_id', 'external_id'],
};

const ITEM_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    item_id: {
      type: 'string',
      description: 'Item identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['item_id'],
};

const ITEM_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    item_id: { type: 'integer' },
    name: { type: 'string' },
    price: { type: 'number' },
    currency: { type: 'string' },
    status: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['created_at', 'updated_at'],
};

const ITEM_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    item_id: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['ok', 'status', 'external_id'],
};

const SUBSCRIPTION_ITEM_INPUT_SCHEMA = PUBLIC_LINE_ITEM_INPUT_SCHEMA;

const SUBSCRIPTION_DISCOUNT_INPUT_PROPERTIES = {
  discount_id: {
    type: 'string',
    description: 'Existing registered Sanka discount id to apply at the subscription record level.',
  },
  discount_value: {
    type: 'number',
    description:
      'Manual subscription record-level discount value. Pair with discount_number_format, for example 10 with % or 5 with USD.',
  },
  discount_number_format: {
    type: 'string',
    description:
      'Discount format for discount_value. Use % for percentage or a currency code such as USD or JPY.',
  },
  discount_tax_option: {
    type: 'string',
    description: 'Whether the subscription discount is applied before or after tax.',
    enum: ['pre_tax', 'post_tax'],
  },
  discount_mode: {
    type: 'string',
    description:
      'Optional discount mode. Use free_writing_discounts for manual values or registered_discounts for discount_id.',
    enum: ['free_writing_discounts', 'registered_discounts'],
  },
  clear_discount: {
    type: 'boolean',
    description: 'Set true on update to remove the subscription record-level discount.',
  },
};

const SUBSCRIPTION_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    contact_id: {
      type: 'string',
      description:
        'Contact identifier for the subscription customer. Use either contact_id, company_id, or customer_id.',
    },
    company_id: {
      type: 'string',
      description: 'Company identifier for the subscription customer. Use this for company-only customers.',
    },
    customer_id: {
      type: 'string',
      description: 'Generic customer identifier. May point to either a Sanka contact or company.',
    },
    items: {
      type: 'array',
      description: 'Subscription line items.',
      items: SUBSCRIPTION_ITEM_INPUT_SCHEMA,
    },
    line_items: {
      type: 'array',
      description: 'Alias for items, useful when copying line_items returned by get_invoice or get_order.',
      items: SUBSCRIPTION_ITEM_INPUT_SCHEMA,
    },
    subscription_status: {
      type: 'string',
      description: 'Subscription status.',
    },
    currency: {
      type: 'string',
      description: 'Currency code.',
    },
    start_date: {
      type: 'string',
      description: 'Subscription start date in ISO format.',
    },
    end_date: {
      type: 'string',
      description:
        'Subscription end date in ISO format. Use this when completing or time-bounding a subscription contract.',
    },
    contract_id: {
      type: 'string',
      description: 'Contract record identifier to associate with the subscription.',
    },
    contract_ids: {
      type: 'array',
      description: 'Contract record identifiers to associate with the subscription.',
      items: {
        type: 'string',
      },
    },
    total_price: {
      type: 'number',
      description: 'Total subscription price.',
    },
    total_price_without_tax: {
      type: 'number',
      description: 'Total subscription price before tax.',
    },
    frequency: {
      type: 'integer',
      description: 'Recurring frequency amount.',
      minimum: 1,
    },
    frequency_time: {
      type: 'string',
      description: 'Recurring frequency unit.',
    },
    tax: {
      type: 'number',
      description: 'Tax amount.',
    },
    shipping_cost_tax_status: {
      type: 'string',
      description: 'Shipping cost tax status.',
    },
    ...SUBSCRIPTION_DISCOUNT_INPUT_PROPERTIES,
  },
  required: ['subscription_status'],
};

const SUBSCRIPTION_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    subscription_id: {
      type: 'string',
      description: 'Subscription identifier. Accepts a UUID, numeric id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['subscription_id'],
};

const SUBSCRIPTION_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    subscription_id: {
      type: 'string',
      description: 'Subscription identifier to update.',
    },
    lookup_external_id: {
      type: 'string',
      description: 'Optional external id to resolve the target subscription.',
    },
    contact: {
      type: 'string',
      description: 'Replacement contact reference.',
    },
    contact_id: {
      type: 'string',
      description:
        'Replacement contact identifier. Use exactly one of contact_id, company_id, or customer_id.',
    },
    company_id: {
      type: 'string',
      description: 'Replacement company identifier. Use this for company-only customers.',
    },
    customer_id: {
      type: 'string',
      description: 'Generic replacement customer identifier. May point to either a Sanka contact or company.',
    },
    owner_id: {
      type: 'string',
      description: 'Workspace user identifier for the subscription owner.',
    },
    item_id: {
      type: 'string',
      description: 'Primary item identifier for the subscription.',
    },
    item_variant_id: {
      type: 'string',
      description: 'Primary item variant identifier for the subscription.',
    },
    channel_id: {
      type: 'string',
      description: 'Source integration channel identifier.',
    },
    platform_display_name: {
      type: 'string',
      description: 'Display name for the source platform.',
    },
    items: {
      type: 'array',
      description: 'Replacement subscription line items.',
      items: SUBSCRIPTION_ITEM_INPUT_SCHEMA,
    },
    line_items: {
      type: 'array',
      description: 'Alias for items, useful when copying line_items returned by get_invoice or get_order.',
      items: SUBSCRIPTION_ITEM_INPUT_SCHEMA,
    },
    status: {
      type: 'string',
      description: 'Subscription status.',
    },
    subscription_status: {
      type: 'string',
      description: 'Alias for status. Updates the subscription business status.',
    },
    start_date: {
      type: 'string',
      description: 'Subscription start date in ISO format.',
    },
    end_date: {
      type: 'string',
      description: 'Subscription end date in ISO format.',
    },
    currency: {
      type: 'string',
      description: 'Currency code.',
    },
    frequency: {
      type: 'integer',
      description: 'Recurring frequency amount.',
      minimum: 1,
    },
    frequency_time: {
      type: 'string',
      description: 'Recurring frequency unit.',
    },
    prior_to_next: {
      type: 'number',
      description: 'Invoice generation lead time before the next billing date.',
    },
    prior_to_time: {
      type: 'string',
      description: 'Unit for prior_to_next, for example days or months.',
    },
    billing_timing: {
      type: 'string',
      description: 'Billing timing rule.',
    },
    billing_anchor: {
      type: 'string',
      description: 'Billing anchor rule.',
    },
    charge_method: {
      type: 'string',
      description: 'Subscription charge method.',
    },
    payment_term_type: {
      type: 'string',
      description: 'Payment term type.',
    },
    payment_term_days: {
      type: 'integer',
      description: 'Payment term day count.',
    },
    payment_term_closing_day: {
      type: 'integer',
      description: 'Payment term closing day.',
    },
    payment_term_offset_months: {
      type: 'integer',
      description: 'Payment term month offset.',
    },
    payment_term_payment_day: {
      type: 'integer',
      description: 'Payment term payment day.',
    },
    auto_gen_invoice: {
      type: 'boolean',
      description: 'Whether the subscription should automatically generate invoices.',
    },
    auto_gen_invoice_statuses: {
      type: 'string',
      description: 'Statuses eligible for automatic invoice generation.',
    },
    upcoming_invoice_date: {
      type: 'string',
      description: 'Upcoming invoice date in ISO format.',
    },
    auto_invoice_start_policy: {
      type: 'string',
      description: 'Policy for the first automatic invoice date.',
    },
    auto_invoice_start_date: {
      type: 'string',
      description: 'Explicit first automatic invoice date in ISO format.',
    },
    number_item: {
      type: 'integer',
      description: 'Number of subscription items.',
    },
    total_price: {
      type: 'number',
      description: 'Total subscription price.',
    },
    total_price_without_tax: {
      type: 'number',
      description: 'Total subscription price before tax.',
    },
    tax_rate: {
      type: 'number',
      description: 'Subscription tax rate.',
    },
    tax: {
      type: 'number',
      description: 'Tax amount.',
    },
    tax_applied_to: {
      type: 'string',
      description: 'Tax application target.',
    },
    shipping_cost_id: {
      type: 'string',
      description: 'Shipping cost identifier.',
    },
    shipping_cost_tax_status: {
      type: 'string',
      description: 'Shipping cost tax status.',
    },
    quick_entry_mode: {
      type: 'boolean',
      description: 'Whether quick entry mode is enabled for the subscription.',
    },
    custom_fields: {
      type: 'object',
      description: 'Custom field values keyed by custom property id or internal_name.',
    },
    contract_id: {
      type: 'string',
      description: 'Contract record identifier to associate with the subscription.',
    },
    contract_ids: {
      type: 'array',
      description:
        'Contract record identifiers to associate with the subscription. Passing an empty array clears the contract association.',
      items: {
        type: 'string',
      },
    },
    ...SUBSCRIPTION_DISCOUNT_INPUT_PROPERTIES,
  },
  required: ['subscription_id'],
};

const SUBSCRIPTION_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    subscription_id: {
      type: 'string',
      description: 'Subscription identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['subscription_id'],
};

const SUBSCRIPTION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    status: { type: 'string' },
    subscription_status: { type: 'string' },
    currency: { type: 'string' },
    total_price: { type: 'number' },
    created_at: { type: 'string' },
    start_date: { type: 'string' },
    end_date: { type: 'string' },
    contract_info: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          contract_id: { type: 'integer' },
          name: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
    items: {
      type: 'array',
      items: SUBSCRIPTION_ITEM_INPUT_SCHEMA,
    },
    line_items: {
      type: 'array',
      items: PUBLIC_LINE_ITEM_INPUT_SCHEMA,
    },
  },
  required: ['id', 'created_at'],
};

const SUBSCRIPTION_DELETE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    subscription_id: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['ok', 'status'],
};

const PAYMENT_MUTATION_INPUT_PROPERTIES = {
  external_id: {
    type: 'string',
    description: 'External payment reference.',
  },
  contact_id: {
    type: 'string',
    description: 'Contact identifier.',
  },
  contact_external_id: {
    type: 'string',
    description: 'External contact reference.',
  },
  company_id: {
    type: 'string',
    description: 'Company identifier.',
  },
  company_external_id: {
    type: 'string',
    description: 'External company reference.',
  },
  start_date: {
    type: 'string',
    description: 'Payment date in ISO format.',
  },
  status: {
    type: 'string',
    description:
      'Payment status. Use paid for bank-transfer or CSV reconciliation payments that should clear invoice balances.',
  },
  currency: {
    type: 'string',
    description: 'Currency code.',
  },
  total_price: {
    type: 'number',
    description:
      'Total payment amount. For payment reconciliation, pass the received amount here and set status to paid.',
  },
  total_price_without_tax: {
    type: 'number',
    description: 'Total payment amount before tax.',
  },
  manual_price: {
    type: 'number',
    description:
      'Quick-entry payment amount before tax. Use with entry_type=manual so the Sanka UI opens the payment in Quick Entry mode.',
  },
  tax_rate: {
    type: 'number',
    description: 'Payment-level tax rate used when tax_option is unified_tax.',
  },
  tax_inclusive: {
    type: 'boolean',
    description: 'Whether line item prices are tax inclusive.',
  },
  tax_option: {
    type: 'string',
    description: 'Payment tax option.',
  },
  entry_type: {
    type: 'string',
    description: 'Payment entry type. Use manual for Quick Entry payments.',
  },
  notes: {
    type: 'string',
    description: 'Payment notes.',
  },
  line_items: {
    type: 'array',
    description:
      'Line items for this payment/receipt. When provided, Sanka creates/replaces the receipt detail rows and recalculates totals.',
    items: PUBLIC_LINE_ITEM_INPUT_SCHEMA,
  },
};

const PAYMENT_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: PAYMENT_MUTATION_INPUT_PROPERTIES,
  required: ['external_id'],
};

const PAYMENT_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    payment_id: {
      type: 'string',
      description: 'Payment identifier. Accepts a UUID, numeric id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['payment_id'],
};

const PAYMENT_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    payment_id: {
      type: 'string',
      description: 'Payment identifier to update.',
    },
    lookup_external_id: {
      type: 'string',
      description: 'Optional external id to resolve the target payment.',
    },
    ...PAYMENT_MUTATION_INPUT_PROPERTIES,
  },
  required: ['payment_id'],
};

const PAYMENT_ALLOCATION_LINE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    invoice_id: {
      type: 'string',
      description:
        'Invoice identifier to allocate this payment to. Accepts a UUID, numeric invoice id, or external reference.',
    },
    amount: {
      type: 'number',
      description:
        'Receipt amount to apply to the invoice. May be less than the invoice balance for partial payment.',
    },
    adjustment_amount: {
      type: 'number',
      description:
        'Optional adjustment amount cleared together with the payment, for example bank transfer fees.',
    },
    adjustment_type: {
      type: 'string',
      description: 'Optional adjustment type, for example bank_transfer_fee.',
    },
    currency: {
      type: 'string',
      description: 'Optional allocation currency. Must match the payment and invoice currency when provided.',
    },
    source: {
      type: 'string',
      description: 'Optional allocation source label, for example mcp, api, csv, or reconciliation.',
    },
    notes: {
      type: 'string',
      description: 'Optional allocation notes.',
    },
  },
  required: ['invoice_id', 'amount'],
};

const PAYMENT_ALLOCATIONS_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    payment_id: {
      type: 'string',
      description: 'Payment identifier. Accepts a UUID, numeric payment id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['payment_id'],
};

const PAYMENT_ALLOCATIONS_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    payment_id: {
      type: 'string',
      description: 'Payment identifier. Accepts a UUID, numeric payment id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
    allocations: {
      type: 'array',
      description:
        'Complete replacement set of invoice allocations for this payment. Include every invoice row that should remain linked after the update.',
      items: PAYMENT_ALLOCATION_LINE_INPUT_SCHEMA,
    },
  },
  required: ['payment_id', 'allocations'],
};

const buildPrivateMessageListParams = (args: Record<string, unknown> | undefined) => {
  const status = readString(args?.['status']);
  const language = readString(args?.['language']);

  return {
    ...(status ? { status } : undefined),
    ...(language ? { 'Accept-Language': language } : undefined),
  };
};

const buildPrivateMessageSyncParams = (args: Record<string, unknown> | undefined) => {
  const channelID = readString(args?.['channel_id']);
  const status = readString(args?.['status']);
  const language = readString(args?.['language']);

  return {
    ...(channelID ? { channel_id: channelID } : undefined),
    ...(status ? { status } : undefined),
    ...(language ? { 'Accept-Language': language } : undefined),
  };
};

const buildPrivateMessageThreadLanguageParams = (args: Record<string, unknown> | undefined) => {
  const language = readString(args?.['language']);

  return {
    ...(language ? { 'Accept-Language': language } : undefined),
  };
};

const buildPrivateMessageReplyParams = (args: Record<string, unknown> | undefined) => {
  const body = readString(args?.['body']);
  const language = readString(args?.['language']);

  return {
    ...(body ? { body } : undefined),
    ...(language ? { 'Accept-Language': language } : undefined),
  };
};

const flattenPrivateMessagesPayload = (payload: Record<string, unknown>) => {
  const data = readRecord(payload['data']);
  const channels =
    Array.isArray(data?.['channels']) ? (data['channels'] as Array<Record<string, unknown>>) : [];
  const threads = Array.isArray(data?.['threads']) ? (data['threads'] as Array<Record<string, unknown>>) : [];
  const hasConnectedPrivateInbox = readBoolean(data?.['has_connected_private_inbox']) ?? channels.length > 0;
  const setupRequired = readBoolean(data?.['setup_required']) ?? !hasConnectedPrivateInbox;
  const setupMessage = readString(data?.['setup_message']);

  return {
    message: readString(payload['message']) ?? 'ok',
    ctx_id: readString(payload['ctx_id']) ?? undefined,
    channels,
    threads,
    has_connected_private_inbox: hasConnectedPrivateInbox,
    setup_required: setupRequired,
    setup_message: setupMessage,
  };
};

const buildPrivateMessagesResult = ({
  action,
  payload,
}: {
  action: 'Loaded' | 'Synced' | 'Updated';
  payload: Record<string, unknown>;
}): ToolCallResult => {
  const flattened = flattenPrivateMessagesPayload(payload);
  const unreadThreads = flattened.threads.reduce((total, thread) => {
    return total + (readBoolean(thread['has_unread']) ? 1 : 0);
  }, 0);
  const setupMessage = flattened.setup_message ?? 'No private inbox channel is connected in Sanka yet.';

  if (flattened.setup_required) {
    return {
      content: [
        {
          type: 'text',
          text: setupMessage,
        },
      ],
      structuredContent: flattened,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `${action} ${flattened.threads.length} private message thread${
          flattened.threads.length === 1 ? '' : 's'
        } across ${flattened.channels.length} channel${flattened.channels.length === 1 ? '' : 's'}${
          unreadThreads > 0 ? `, ${unreadThreads} unread` : ''
        }.`,
      },
    ],
    structuredContent: flattened,
  };
};

const buildPrivateMessageThreadResult = (payload: Record<string, unknown>): ToolCallResult => {
  const data = readRecord(payload['data']) ?? {};
  const title = readString(data['title']);
  const messages = Array.isArray(data['messages']) ? data['messages'] : [];

  return {
    content: [
      {
        type: 'text',
        text:
          title ?
            `Loaded private message thread "${title}" with ${messages.length} message${
              messages.length === 1 ? '' : 's'
            }.`
          : `Loaded private message thread with ${messages.length} message${
              messages.length === 1 ? '' : 's'
            }.`,
      },
    ],
    structuredContent: {
      message: readString(payload['message']) ?? 'ok',
      ctx_id: readString(payload['ctx_id']) ?? undefined,
      ...data,
    },
  };
};

const buildPrivateMessageReplyResult = (payload: Record<string, unknown>): ToolCallResult => {
  const data = readRecord(payload['data']) ?? {};
  const threadID = readString(data['thread_id']);

  return {
    content: [
      {
        type: 'text',
        text:
          threadID ? `Replied to private message thread ${threadID}.` : 'Replied to private message thread.',
      },
    ],
    structuredContent: {
      message: readString(payload['message']) ?? 'ok',
      ctx_id: readString(payload['ctx_id']) ?? undefined,
      ...data,
    },
  };
};

const buildWorkspaceMessageListParams = (args: Record<string, unknown> | undefined) => {
  const status = readString(args?.['status']);
  const language = readString(args?.['language']);

  return {
    ...(status ? { status } : undefined),
    ...(language ? { 'Accept-Language': language } : undefined),
  };
};

const buildWorkspaceMessageSyncParams = (args: Record<string, unknown> | undefined) => {
  const channelID = readString(args?.['channel_id']);
  const status = readString(args?.['status']);
  const language = readString(args?.['language']);

  return {
    ...(channelID ? { channel_id: channelID } : undefined),
    ...(status ? { status } : undefined),
    ...(language ? { 'Accept-Language': language } : undefined),
  };
};

const buildWorkspaceMessageThreadLanguageParams = (args: Record<string, unknown> | undefined) => {
  const language = readString(args?.['language']);

  return {
    ...(language ? { 'Accept-Language': language } : undefined),
  };
};

const flattenWorkspaceMessagesPayload = (payload: Record<string, unknown>) => {
  const data = readRecord(payload['data']);
  const channels =
    Array.isArray(data?.['channels']) ? (data['channels'] as Array<Record<string, unknown>>) : [];
  const threads = Array.isArray(data?.['threads']) ? (data['threads'] as Array<Record<string, unknown>>) : [];

  return {
    message: readString(payload['message']) ?? 'ok',
    ctx_id: readString(payload['ctx_id']) ?? undefined,
    channels,
    threads,
  };
};

const buildWorkspaceMessagesResult = ({
  action,
  payload,
}: {
  action: 'Loaded' | 'Synced';
  payload: Record<string, unknown>;
}): ToolCallResult => {
  const flattened = flattenWorkspaceMessagesPayload(payload);
  const unreadThreads = flattened.threads.reduce((total, thread) => {
    return total + (readBoolean(thread['has_unread']) ? 1 : 0);
  }, 0);

  return {
    content: [
      {
        type: 'text',
        text: `${action} ${flattened.threads.length} shared workspace message thread${
          flattened.threads.length === 1 ? '' : 's'
        } across ${flattened.channels.length} channel${flattened.channels.length === 1 ? '' : 's'}${
          unreadThreads > 0 ? `, ${unreadThreads} unread` : ''
        }.`,
      },
    ],
    structuredContent: flattened,
  };
};

const buildWorkspaceMessageThreadResult = (payload: Record<string, unknown>): ToolCallResult => {
  const data = readRecord(payload['data']) ?? {};
  const title = readString(data['title']);
  const messages = Array.isArray(data['messages']) ? data['messages'] : [];

  return {
    content: [
      {
        type: 'text',
        text:
          title ?
            `Loaded shared workspace message thread "${title}" with ${messages.length} message${
              messages.length === 1 ? '' : 's'
            }.`
          : `Loaded shared workspace message thread with ${messages.length} message${
              messages.length === 1 ? '' : 's'
            }.`,
      },
    ],
    structuredContent: {
      message: readString(payload['message']) ?? 'ok',
      ctx_id: readString(payload['ctx_id']) ?? undefined,
      ...data,
    },
  };
};

const PAYMENT_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    payment_id: {
      type: 'string',
      description: 'Payment identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['payment_id'],
};

const PAYMENT_OUTPUT_SCHEMA = V2_RECORD_DETAIL_OUTPUT_SCHEMA;

const PAYMENT_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    payment_id: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['ok', 'status'],
};

const PAYMENT_ALLOCATIONS_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    payment: {
      type: 'object',
      additionalProperties: true,
    },
    invoice: {
      type: 'object',
      additionalProperties: true,
    },
    allocations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
      },
    },
    adjustments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
      },
    },
    adjustment_total: { type: 'number' },
    available_invoices: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
      },
    },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
};

const LOCATION_MUTATION_INPUT_PROPERTIES = {
  external_id: {
    type: 'string',
    description: 'External location reference.',
  },
  warehouse: {
    type: 'string',
    description: 'Warehouse name.',
  },
  floor: {
    type: 'string',
    description: 'Floor value.',
  },
  zone: {
    type: 'string',
    description: 'Zone value.',
  },
  aisle: {
    type: 'string',
    description: 'Aisle value.',
  },
  rack: {
    type: 'string',
    description: 'Rack value.',
  },
  shelf: {
    type: 'string',
    description: 'Shelf value.',
  },
  bin: {
    type: 'string',
    description: 'Bin value.',
  },
  usage_status: {
    type: 'string',
    description: 'Usage status.',
  },
};

const LOCATION_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: LOCATION_MUTATION_INPUT_PROPERTIES,
  required: ['external_id'],
};

const LOCATION_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    location_id: {
      type: 'string',
      description: 'Location identifier. Accepts a UUID, numeric id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['location_id'],
};

const LOCATION_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    location_id: {
      type: 'string',
      description: 'Location identifier to update.',
    },
    lookup_external_id: {
      type: 'string',
      description: 'Optional external id to resolve the target location.',
    },
    ...LOCATION_MUTATION_INPUT_PROPERTIES,
  },
  required: ['location_id'],
};

const LOCATION_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    location_id: {
      type: 'string',
      description: 'Location identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['location_id'],
};

const LOCATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    id_iw: { type: 'string' },
    warehouse: { type: 'string' },
    floor: { type: 'string' },
    zone: { type: 'string' },
    aisle: { type: 'string' },
    rack: { type: 'string' },
    shelf: { type: 'string' },
    bin: { type: 'string' },
    usage_status: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['created_at', 'updated_at'],
};

const LOCATION_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    location_id: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['ok', 'status'],
};

const INVENTORY_MUTATION_INPUT_PROPERTIES = {
  external_id: {
    type: 'string',
    description: 'External inventory reference.',
  },
  name: {
    type: 'string',
    description: 'Inventory name.',
  },
  item_id: {
    type: 'string',
    description: 'Item identifier.',
  },
  item_external_id: {
    type: 'string',
    description: 'External item reference.',
  },
  status: {
    type: 'string',
    description: 'Inventory status.',
  },
  inventory_status: {
    type: 'string',
    description: 'Inventory sub-status.',
  },
  currency: {
    type: 'string',
    description: 'Currency code.',
  },
  unit_price: {
    type: 'number',
    description: 'Unit price.',
  },
  initial_value: {
    type: 'integer',
    description: 'Initial inventory amount.',
  },
  date: {
    type: 'string',
    description: 'Inventory date in ISO format.',
  },
  warehouse_id: {
    type: 'string',
    description: 'Location identifier for the inventory.',
  },
};

const INVENTORY_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: INVENTORY_MUTATION_INPUT_PROPERTIES,
  required: ['external_id'],
};

const INVENTORY_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    inventory_id: {
      type: 'string',
      description: 'Inventory identifier. Accepts a UUID, numeric id, or external reference.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['inventory_id'],
};

const INVENTORY_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    inventory_id: {
      type: 'string',
      description: 'Inventory identifier to update.',
    },
    ...INVENTORY_MUTATION_INPUT_PROPERTIES,
  },
  required: ['inventory_id', 'external_id'],
};

const INVENTORY_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    inventory_id: {
      type: 'string',
      description: 'Inventory identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['inventory_id'],
};

const INVENTORY_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    inventory_id: { type: 'integer' },
    name: { type: 'string' },
    currency: { type: 'string' },
    inventory_status: { type: 'string' },
    total_inventory: { type: 'number' },
    unit_price: { type: 'number' },
    warehouse_id: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['created_at', 'updated_at'],
};

const INVENTORY_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    external_id: { type: ['string', 'null'] as any },
    inventory_id: { type: 'string' },
    inventory_record_id: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['ok', 'status', 'external_id'],
};

const INVENTORY_TRANSACTION_MUTATION_INPUT_PROPERTIES = {
  inventory_id: {
    type: 'string',
    description: 'Inventory identifier.',
  },
  inventory_external_id: {
    type: 'string',
    description: 'External inventory reference.',
  },
  transaction_type: {
    type: 'string',
    description: 'Transaction type.',
  },
  amount: {
    type: 'integer',
    description: 'Inventory quantity delta.',
  },
  transaction_amount: {
    type: 'integer',
    description: 'Transaction amount.',
  },
  transaction_date: {
    type: 'string',
    description: 'Transaction date in ISO format.',
  },
  status: {
    type: 'string',
    description: 'Transaction status.',
  },
  inventory_type: {
    type: 'string',
    description: 'Inventory type.',
  },
  use_unit_value: {
    type: 'boolean',
    description: 'Whether to use unit value calculations.',
  },
  price: {
    type: 'number',
    description: 'Transaction price.',
  },
};

const INVENTORY_TRANSACTION_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: INVENTORY_TRANSACTION_MUTATION_INPUT_PROPERTIES,
  required: ['transaction_type'],
};

const INVENTORY_TRANSACTION_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    transaction_id: {
      type: 'string',
      description: 'Inventory transaction identifier. Accepts a UUID or numeric transaction id.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['transaction_id'],
};

const INVENTORY_TRANSACTION_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    transaction_id: {
      type: 'string',
      description: 'Inventory transaction identifier to update.',
    },
    ...INVENTORY_TRANSACTION_MUTATION_INPUT_PROPERTIES,
  },
  required: ['transaction_id', 'transaction_type'],
};

const INVENTORY_TRANSACTION_DELETE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    transaction_id: {
      type: 'string',
      description: 'Inventory transaction identifier to delete.',
    },
  },
  required: ['transaction_id'],
};

const INVENTORY_TRANSACTION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    transaction_id: { type: 'integer' },
    inventory_id: { type: 'string' },
    transaction_type: { type: 'string' },
    transaction_amount: { type: 'number' },
    transaction_date: { type: 'string' },
    status: { type: 'string' },
    price: { type: 'number' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: ['created_at', 'updated_at'],
};

const INVENTORY_TRANSACTION_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    transaction_id: { type: 'string' },
    inventory_id: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['ok', 'status'],
};

const COMPANY_PRICE_TABLE_QUERY_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    company_id: {
      type: 'string',
      description: 'Company identifier. Accepts a UUID, numeric company id, or external reference.',
    },
    field_ref: {
      type: 'string',
      description: 'Optional specific price-table property id or ref.',
    },
    search: {
      type: 'string',
      description: 'Optional item filter. Supports item names, product ids, and #numeric item ids.',
    },
    page: {
      type: 'integer',
      description: 'Page number to fetch.',
      minimum: 1,
      default: 1,
    },
    page_size: {
      type: 'integer',
      description: 'Number of rows to fetch.',
      minimum: 1,
      maximum: 100,
      default: 30,
    },
  },
  required: ['company_id'],
};

const COMPANY_PRICE_TABLE_COMPANY_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    company_id: {
      type: 'string',
      description: 'Company identifier. Accepts a UUID, numeric company id, or external reference.',
    },
    field_ref: {
      type: 'string',
      description: 'Optional specific price-table property id or ref.',
    },
    mode: {
      type: 'string',
      description: 'Price table mode to persist, typically `company` or `item`.',
    },
    price_percentage: {
      type: 'number',
      description: 'Company-wide percentage to apply.',
    },
  },
  required: ['company_id'],
};

const COMPANY_PRICE_TABLE_ITEM_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    company_id: {
      type: 'string',
      description: 'Company identifier. Accepts a UUID, numeric company id, or external reference.',
    },
    item_id: {
      type: 'string',
      description: 'Item identifier to update.',
    },
    field_ref: {
      type: 'string',
      description: 'Optional specific price-table property id or ref.',
    },
    price_percentage: {
      type: 'number',
      description: 'Per-item percentage override to store.',
    },
    clear_override: {
      type: 'boolean',
      description: 'When true, remove the per-item override instead of storing a percentage.',
    },
  },
  required: ['company_id', 'item_id'],
};

const COMPANY_PRICE_TABLE_APPLY_ALL_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    company_id: {
      type: 'string',
      description: 'Company identifier. Accepts a UUID, numeric company id, or external reference.',
    },
    field_ref: {
      type: 'string',
      description: 'Optional specific price-table property id or ref.',
    },
    mode: {
      type: 'string',
      description: 'Mode to persist after applying overrides.',
    },
    price_percentage: {
      type: 'number',
      description: 'Percentage to apply to every item override.',
    },
    exclude_item_ids: {
      type: 'array',
      description: 'Optional item ids to exclude from the bulk application.',
      items: { type: 'string' },
    },
  },
  required: ['company_id', 'price_percentage'],
};

const COMPANY_PRICE_TABLE_ITEM_SCHEMA = {
  type: 'object' as const,
  properties: {
    item_id: { type: 'string' },
    item_record_id: { type: 'integer' },
    item_name: { type: 'string' },
    currency: { type: 'string' },
    default_price: { type: 'number' },
    discount_price: { type: 'number' },
    discount_rate: { type: 'number' },
    has_override: { type: 'boolean' },
  },
  required: ['item_id', 'item_name', 'default_price', 'discount_price', 'discount_rate', 'has_override'],
};

const COMPANY_PRICE_TABLE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    field_id: { type: 'string' },
    mode: { type: 'string' },
    company_price_precentage: { type: 'number' },
    company_price_percentage: { type: 'number' },
    items: {
      type: 'array',
      items: COMPANY_PRICE_TABLE_ITEM_SCHEMA,
    },
    pagination: {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        page_size: { type: 'integer' },
        total_count: { type: 'integer' },
        total_pages: { type: 'integer' },
        has_next: { type: 'boolean' },
        has_previous: { type: 'boolean' },
      },
      required: ['page', 'page_size', 'total_count', 'total_pages', 'has_next', 'has_previous'],
    },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['field_id', 'mode', 'items', 'pagination', 'message'],
};

const COMPANY_PRICE_TABLE_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    data: {
      type: 'object',
      properties: {
        field_id: { type: 'string' },
        item_id: { type: 'string' },
        mode: { type: 'string' },
        price_precentage: { type: 'number' },
        price_percentage: { type: 'number' },
        discount_price: { type: 'number' },
        currency: { type: 'string' },
        updated_count: { type: 'integer' },
        skipped_count: { type: 'integer' },
        deleted: { type: 'boolean' },
      },
    },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['data', 'message'],
};

const readNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const MAX_LIST_LIMIT = 100;

// Keep `limit` inside the bounds advertised by the list input schemas
// (minimum 1, maximum 100) instead of forwarding arbitrary finite numbers.
const clampListLimit = (value: unknown, fallback: number): number =>
  Math.max(1, Math.min(MAX_LIST_LIMIT, Math.trunc(readNumber(value, fallback))));

const DOCUMENT_PDF_DEFAULT_LANGUAGE = 'ja';

const readDocumentPDFLanguage = (args: Record<string, unknown> | undefined): string =>
  readString(args?.['language']) ?? DOCUMENT_PDF_DEFAULT_LANGUAGE;

const asStoredBinaryDownloadResult = (
  reqContext: McpRequestContext,
  response: Response,
  fallbackFilename: string,
): Promise<ToolCallResult> => {
  const createDownloadUrl =
    reqContext.downloadBaseUrl ?
      (downloadToken: string): string =>
        new URL(`/downloads/${encodeURIComponent(downloadToken)}`, reqContext.downloadBaseUrl).toString()
    : undefined;

  return asBinaryDownloadResult(response, fallbackFilename, {
    inlineBase64Limit: BINARY_DOWNLOAD_INLINE_BASE64_LIMIT,
    sessionId: reqContext.mcpSessionId,
    storeLargeDownload: storeBinaryDownload,
    createDownloadUrl,
  });
};

export const crmReadBinaryDownloadChunkTool: McpTool = {
  metadata: {
    resource: 'downloads',
    operation: 'read',
    tags: ['crm', 'downloads'],
  },
  tool: {
    name: 'read_binary_download_chunk',
    title: 'Read binary download chunk',
    description:
      'Read one base64 chunk from a large PDF download returned by a Sanka PDF download tool. Concatenate chunks in offset order, then decode the combined base64 string.',
    inputSchema: BINARY_DOWNLOAD_CHUNK_INPUT_SCHEMA,
    outputSchema: BINARY_DOWNLOAD_CHUNK_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Read binary download chunk',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Read binary download chunk',
    });
    if (authError) {
      return authError;
    }

    const downloadToken = readString(args?.['download_token']) ?? readString(args?.['token']);
    if (!downloadToken) {
      return asErrorResult('`download_token` is required.');
    }

    const chunk = readBinaryDownloadChunk({
      downloadToken,
      offset: readNumber(args?.['offset'], 0),
      chunkSize: typeof args?.['chunk_size'] === 'number' ? args['chunk_size'] : undefined,
      sessionId: reqContext.mcpSessionId,
    });
    if (!chunk.ok) {
      return asErrorResult(chunk.message);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Read ${chunk.contentBase64.length} base64 characters for ${chunk.filename} from offset ${chunk.contentBase64Offset}.`,
        },
      ],
      structuredContent: {
        ...(chunk.contentDisposition ? { content_disposition: chunk.contentDisposition } : undefined),
        mime_type: chunk.mimeType,
        filename: chunk.filename,
        byte_length: chunk.byteLength,
        content_base64: chunk.contentBase64,
        content_base64_offset: chunk.contentBase64Offset,
        content_base64_length: chunk.contentBase64Length,
        next_offset: chunk.nextOffset,
        done: chunk.done,
        chunk_size: chunk.chunkSize,
        expires_at: chunk.expiresAt,
        completion_status: chunk.done ? 'chunks_read' : 'requires_next_chunk',
        file_assembly_required: true,
        ...(chunk.done ? undefined : { required_next_tool: 'read_binary_download_chunk' }),
        next_action:
          chunk.done ?
            'Concatenate all content_base64 chunks in offset order, decode the combined base64, then attach or save the decoded PDF before reporting completion.'
          : 'Call read_binary_download_chunk again with next_offset, then concatenate chunks in offset order and decode the final PDF before reporting completion.',
      },
    };
  },
};

const unwrapV2EnvelopeRecord = (
  payload: Record<string, unknown>,
): { data: unknown; meta: Record<string, unknown> | undefined } | undefined => {
  if (typeof payload['success'] !== 'boolean' || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return undefined;
  }
  return {
    data: payload['data'],
    meta: readRecord(payload['meta']),
  };
};

const normalizeV2ObjectRecord = (
  record: Record<string, unknown>,
  formattedIDKey?: string,
): Record<string, unknown> => {
  const properties = readRecord(record['properties']) ?? {};
  const recordID = readString(record['record_id']);
  const numericRecordID = recordID === undefined ? undefined : Number(recordID);
  const formattedID =
    formattedIDKey === undefined ?
      {}
    : {
        [formattedIDKey]:
          Number.isFinite(numericRecordID) ? numericRecordID
          : recordID !== undefined ? recordID
          : null,
      };
  return {
    ...properties,
    id: readString(record['id']) ?? String(record['id'] ?? ''),
    ...formattedID,
  };
};

const normalizeV2ObjectRecordListPayload = (
  payload: Record<string, unknown>,
  formattedIDKey?: string,
): {
  rows: Array<Record<string, unknown>>;
  page: number;
  total: number;
} => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  const data = readRecord(envelope?.data) ?? readRecord(payload['data']) ?? payload;
  const rawItems = Array.isArray(data['items']) ? data['items'] : [];
  const rows = rawItems
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => normalizeV2ObjectRecord(entry, formattedIDKey));
  const pagination = readRecord(envelope?.meta?.['pagination']);
  return {
    rows,
    page: readNumber(data['page'], readNumber(pagination?.['page'], 1)),
    total: readNumber(data['total'], readNumber(pagination?.['total'], rows.length)),
  };
};

const DIRECT_CRM_SOURCE_LOCK_MESSAGE =
  'CRM deal/opportunity-sourced billing or procurement requests must go through workflow_type=deal_to_order first. Ask the user to confirm creating or reusing a Sanka Order, then use order_to_invoice, order_to_subscription, or order_to_purchase_order from that Order.';

const isDirectCrmSourceContext = (args: Record<string, unknown> | undefined): boolean => {
  const sourceRecord = readRecord(args?.['source_record']);
  const sourceSystem = (
    readString(sourceRecord?.['source_system']) ?? readString(args?.['source_system'])
  )?.toLowerCase();
  if (sourceSystem === 'hubspot' || sourceSystem === 'salesforce') {
    return true;
  }

  const objectType = (
    readString(sourceRecord?.['object_type']) ?? readString(args?.['object_type'])
  )?.toLowerCase();
  if (objectType === 'opportunity') {
    return true;
  }

  const crmIDKeys = [
    'crm_deal_id',
    'crm_opportunity_id',
    'deal_external_id',
    'hubspot_deal_id',
    'salesforce_opportunity_id',
  ];
  if (crmIDKeys.some((key) => Boolean(readString(args?.[key])))) {
    return true;
  }

  const url =
    readString(sourceRecord?.['url']) ??
    readString(args?.['url']) ??
    readString(args?.['hubspot_deal_url']) ??
    readString(args?.['salesforce_opportunity_url']);
  if (!url) {
    return false;
  }

  const normalizedURL = url.toLowerCase();
  return normalizedURL.includes('hubspot.com') || normalizedURL.includes('salesforce.com');
};

type WorkspaceIdentity = {
  workspace_id?: string;
  workspace_code?: string;
  workspace_name?: string;
};

type PublicAuthWorkspaceOption = {
  id?: string;
  name?: string | null;
  workspace_code?: string | null;
  selected?: boolean;
};

type PublicAuthSessionResponse = {
  data?: {
    workspace_id?: string | null;
    workspace_code?: string | null;
    workspace_name?: string | null;
    available_workspaces?: PublicAuthWorkspaceOption[];
  };
  message?: string | null;
};

const workspaceIdentityFromRecord = (record: Record<string, unknown> | undefined): WorkspaceIdentity => {
  const workspaceID = readString(record?.['workspace_id']) ?? readString(record?.['id']);
  const workspaceCode = readString(record?.['workspace_code']) ?? readString(record?.['code']);
  const workspaceName = readString(record?.['workspace_name']) ?? readString(record?.['name']);
  return {
    ...(workspaceID ? { workspace_id: workspaceID } : undefined),
    ...(workspaceCode ? { workspace_code: workspaceCode } : undefined),
    ...(workspaceName ? { workspace_name: workspaceName } : undefined),
  };
};

const workspaceIdentityFromSessionRecord = (
  record: Record<string, unknown> | undefined,
): WorkspaceIdentity => {
  return workspaceIdentityFromRecord(
    readRecord(record?.['current_workspace']) ?? readRecord(record?.['workspace']) ?? record,
  );
};

const workspaceIdentityFromOauth = (reqContext: McpRequestContext): WorkspaceIdentity =>
  workspaceIdentityFromRecord(reqContext.auth?.oauth as unknown as Record<string, unknown> | undefined);

const currentWorkspaceLabel = (workspace: WorkspaceIdentity): string =>
  workspace.workspace_name ?? workspace.workspace_code ?? workspace.workspace_id ?? 'unknown workspace';

const buildCurrentWorkspaceStructuredContent = ({
  authMode,
  connected,
  message,
  workspace,
}: {
  authMode: string;
  connected: boolean;
  message: string;
  workspace: WorkspaceIdentity;
}): Record<string, unknown> => ({
  connected,
  auth_mode: authMode,
  ...workspace,
  message,
});

const normalizeWorkspaceOptions = (
  options: PublicAuthWorkspaceOption[] | undefined,
): Record<string, unknown>[] =>
  (options ?? []).map((workspace) => {
    const workspaceID = readString(workspace.id);
    const workspaceName = readString(workspace.name);
    const workspaceCode = readString(workspace.workspace_code);
    return {
      id: workspaceID ?? '',
      ...(workspaceName ? { name: workspaceName } : undefined),
      ...(workspaceCode ? { workspace_code: workspaceCode } : undefined),
      selected: workspace.selected === true,
    };
  });

const normalizeSessionWorkspaceOptions = (
  data: Record<string, unknown> | undefined,
): Record<string, unknown>[] => {
  const legacyOptions = data?.['available_workspaces'];
  if (Array.isArray(legacyOptions)) {
    return normalizeWorkspaceOptions(legacyOptions as PublicAuthWorkspaceOption[]);
  }

  const workspaces = data?.['workspaces'];
  if (!Array.isArray(workspaces)) {
    return [];
  }
  const currentWorkspaceID = workspaceIdentityFromSessionRecord(data).workspace_id;
  return workspaces
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((workspace) => {
      const identity = workspaceIdentityFromRecord(workspace);
      return {
        id: identity.workspace_id ?? '',
        ...(identity.workspace_name ? { name: identity.workspace_name } : undefined),
        ...(identity.workspace_code ? { workspace_code: identity.workspace_code } : undefined),
        selected: Boolean(identity.workspace_id && identity.workspace_id === currentWorkspaceID),
      };
    });
};

const assignStringFields = (
  body: Record<string, unknown>,
  args: Record<string, unknown> | undefined,
  keys: readonly string[],
) => {
  for (const key of keys) {
    const value = readString(args?.[key]);
    if (value) {
      body[key] = value;
    }
  }
};

const assignBooleanFields = (
  body: Record<string, unknown>,
  args: Record<string, unknown> | undefined,
  keys: readonly string[],
) => {
  for (const key of keys) {
    const value = readBoolean(args?.[key]);
    if (value !== undefined) {
      body[key] = value;
    }
  }
};

const assignIntegerFields = (
  body: Record<string, unknown>,
  args: Record<string, unknown> | undefined,
  keys: readonly string[],
) => {
  for (const key of keys) {
    const value = args?.[key];
    if (typeof value === 'number' && Number.isInteger(value)) {
      body[key] = value;
    }
  }
};

const assignMappedStringFields = (
  body: Record<string, unknown>,
  args: Record<string, unknown> | undefined,
  mappings: ReadonlyArray<readonly [string, string]>,
) => {
  for (const [sourceKey, targetKey] of mappings) {
    const value = readString(args?.[sourceKey]);
    if (value) {
      body[targetKey] = value;
    }
  }
};

const assignMappedBooleanFields = (
  body: Record<string, unknown>,
  args: Record<string, unknown> | undefined,
  mappings: ReadonlyArray<readonly [string, string]>,
) => {
  for (const [sourceKey, targetKey] of mappings) {
    const value = readBoolean(args?.[sourceKey]);
    if (value !== undefined) {
      body[targetKey] = value;
    }
  }
};

const assignMappedNumberFields = (
  body: Record<string, unknown>,
  args: Record<string, unknown> | undefined,
  mappings: ReadonlyArray<readonly [string, string]>,
) => {
  for (const [sourceKey, targetKey] of mappings) {
    const value = args?.[sourceKey];
    if (typeof value === 'number' && Number.isFinite(value)) {
      body[targetKey] = value;
    }
  }
};

const assignMappedIntegerFields = (
  body: Record<string, unknown>,
  args: Record<string, unknown> | undefined,
  mappings: ReadonlyArray<readonly [string, string]>,
) => {
  for (const [sourceKey, targetKey] of mappings) {
    const value = args?.[sourceKey];
    if (typeof value === 'number' && Number.isInteger(value)) {
      body[targetKey] = value;
    }
  }
};

const buildTaskListParams = (args: Record<string, unknown> | undefined) => {
  const language = readString(args?.['language']);
  const workspaceID = readString(args?.['workspace_id']);
  const search = readString(args?.['search']);
  const usageStatus = readString(args?.['usage_status']);
  const projectID = readString(args?.['project_id']);
  const rawLimit = readNumber(args?.['limit'], 10);
  const rawPage = readNumber(args?.['page'], 1);

  return {
    params: {
      limit: Math.max(1, Math.min(100, rawLimit)),
      page: Math.max(1, rawPage),
      ...(search ? { search } : undefined),
      ...(usageStatus ? { usage_status: usageStatus } : undefined),
      ...(projectID ? { project_id: projectID } : undefined),
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildTaskRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const taskID = readString(args?.['task_id']);
  const externalID = readString(args?.['external_id']);
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);

  return {
    taskID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildTaskMutationBody = (args: Record<string, unknown> | undefined): TaskMutationPayload => {
  const body: TaskMutationPayload = {};
  assignStringFields(body, args, [
    'external_id',
    'title',
    'description',
    'status',
    'usage_status',
    'project_id',
    'start_date',
    'due_date',
    'main_task_id',
    'owner_id',
  ]);

  const assignees = readStringArray(args?.['assignees']);
  if (assignees.length > 0) {
    body.assignees = assignees;
  }

  const projects = readStringArray(args?.['projects']);
  if (projects.length > 0) {
    body.projects = projects;
  }

  return body;
};

const readHeaderNumber = (headers: Headers, name: string): number | undefined => {
  const value = headers.get(name);
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export class InvalidRecordFiltersError extends Error {}

const buildRecordFilters = (value: unknown): Record<string, unknown>[] => {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new InvalidRecordFiltersError(
      '`filters` must be an array of { field, operator, value } objects. Fix the filters and call the tool again.',
    );
  }

  const filters: Record<string, unknown>[] = [];
  const problems: string[] = [];
  value.forEach((entry, index) => {
    const record = readRecord(entry);
    if (!record) {
      problems.push(`filters[${index}] must be an object with a string \`field\`.`);
      return;
    }
    const field = readString(record['field']);
    if (!field) {
      problems.push(`filters[${index}] is missing a non-empty string \`field\`.`);
      return;
    }
    const operator = readString(record['operator']);
    if (record['operator'] !== undefined && !operator) {
      problems.push(`filters[${index}] \`operator\` must be a non-empty string.`);
      return;
    }
    filters.push({
      field,
      operator: operator ?? 'equals',
      ...(Object.prototype.hasOwnProperty.call(record, 'value') ? { value: record['value'] } : undefined),
    });
  });
  if (problems.length > 0) {
    const detail = problems.join(' ');
    throw new InvalidRecordFiltersError(
      `Invalid \`filters\`: ${detail} Fix the filters and call the tool again; the query was not executed.`,
    );
  }
  return filters;
};

// Surfaces malformed `filters` as a tool error result before any request is
// sent, so a bad filter can never silently run an unfiltered query.
const invalidRecordFiltersResult = (value: unknown): ToolCallResult | undefined => {
  try {
    buildRecordFilters(value);
    return undefined;
  } catch (error) {
    if (error instanceof InvalidRecordFiltersError) {
      return asErrorResult(error.message);
    }
    throw error;
  }
};

const readCustomObjectIdentifier = (args: Record<string, unknown> | undefined): string | undefined =>
  readString(
    args?.['custom_object'] ??
      args?.['customObject'] ??
      args?.['custom_object_slug'] ??
      args?.['customObjectSlug'] ??
      args?.['custom_object_id'] ??
      args?.['customObjectId'] ??
      args?.['external_object_type'] ??
      args?.['externalObjectType'],
  );

const buildRecordQueryBody = (args: Record<string, unknown> | undefined) => {
  const objectType = readString(args?.['object_type']);
  const scope = readString(args?.['scope'] ?? args?.['source']);
  const provider = readString(args?.['provider']);
  const channelID = readString(args?.['channel_id'] ?? args?.['channelId']);
  const externalObjectType = readCustomObjectIdentifier(args);
  const body: Record<string, unknown> = {
    ...(objectType ? { object_type: objectType } : undefined),
    ...(scope ? { scope } : undefined),
    ...(provider ? { provider } : undefined),
    ...(channelID ? { channel_id: channelID } : undefined),
    ...(externalObjectType ? { external_object_type: externalObjectType } : undefined),
  };
  const select = readStringArray(args?.['select']);
  const filters = buildRecordFilters(args?.['filters']);
  const mode = readString(args?.['mode']);
  const matchFields = readStringArray(args?.['match_fields'] ?? args?.['matchFields']);
  const search = readString(args?.['search']);
  const sort = readString(args?.['sort']);

  if (select.length) {
    body['select'] = select;
  }
  if (filters.length) {
    body['filters'] = filters;
  }
  if (mode) {
    body['mode'] = mode;
  }
  if (matchFields.length) {
    body['match_fields'] = matchFields;
  }
  if (search) {
    body['search'] = search;
  }
  if (sort) {
    body['sort'] = sort;
  }
  body['page'] = readNumber(args?.['page'], 1);
  body['limit'] = clampListLimit(args?.['limit'], 25);
  const minCountValue = args?.['min_count'] ?? args?.['minCount'];
  if (typeof minCountValue === 'number' && Number.isFinite(minCountValue)) {
    const minCount = minCountValue;
    body['min_count'] = Math.trunc(minCount);
  }
  const scanLimitValue = args?.['scan_limit'] ?? args?.['scanLimit'];
  if (typeof scanLimitValue === 'number' && Number.isFinite(scanLimitValue)) {
    const scanLimit = scanLimitValue;
    body['scan_limit'] = Math.trunc(scanLimit);
  }
  return body;
};

const buildRecordAggregateBody = (args: Record<string, unknown> | undefined) => {
  const objectType = readString(args?.['object_type']);
  const scope = readString(args?.['scope'] ?? args?.['source']);
  const provider = readString(args?.['provider']);
  const channelID = readString(args?.['channel_id'] ?? args?.['channelId']);
  const externalObjectType = readCustomObjectIdentifier(args);
  const filters = buildRecordFilters(args?.['filters']);
  const mode = readString(args?.['mode']);
  const matchFields = readStringArray(args?.['match_fields'] ?? args?.['matchFields']);
  const search = readString(args?.['search']);
  const metrics = readStringArray(args?.['metrics']);
  const groupBy = readStringArray(args?.['group_by'] ?? args?.['groupBy']);
  const body: Record<string, unknown> = {
    ...(objectType ? { object_type: objectType } : undefined),
    ...(scope ? { scope } : undefined),
    ...(provider ? { provider } : undefined),
    ...(channelID ? { channel_id: channelID } : undefined),
    ...(externalObjectType ? { external_object_type: externalObjectType } : undefined),
    metrics: metrics.length ? metrics : ['count'],
  };

  if (filters.length) {
    body['filters'] = filters;
  }
  if (mode) {
    body['mode'] = mode;
  }
  if (matchFields.length) {
    body['match_fields'] = matchFields;
  }
  if (search) {
    body['search'] = search;
  }
  if (groupBy.length) {
    body['group_by'] = groupBy;
  }
  body['limit'] = clampListLimit(args?.['limit'], 25);
  const minCountValue = args?.['min_count'] ?? args?.['minCount'];
  if (typeof minCountValue === 'number' && Number.isFinite(minCountValue)) {
    const minCount = minCountValue;
    body['min_count'] = Math.trunc(minCount);
  }
  const scanLimitValue = args?.['scan_limit'] ?? args?.['scanLimit'];
  if (typeof scanLimitValue === 'number' && Number.isFinite(scanLimitValue)) {
    const scanLimit = scanLimitValue;
    body['scan_limit'] = Math.trunc(scanLimit);
  }
  return body;
};

const buildRecordMergeBody = (args: Record<string, unknown> | undefined) => {
  const objectType = readString(args?.['object_type'] ?? args?.['objectType']);
  const primaryRecordID = readString(
    args?.['primary_record_id'] ??
      args?.['primaryRecordId'] ??
      args?.['canonical_record_id'] ??
      args?.['canonicalRecordId'] ??
      args?.['target_record_id'] ??
      args?.['targetRecordId'],
  );
  const duplicateRecordIDs = readStringArray(
    args?.['duplicate_record_ids'] ??
      args?.['duplicateRecordIds'] ??
      args?.['secondary_record_ids'] ??
      args?.['secondaryRecordIds'] ??
      args?.['source_record_ids'] ??
      args?.['sourceRecordIds'],
  );
  const fieldResolution = readRecord(args?.['field_resolution'] ?? args?.['fieldResolution']);
  const archiveMergedRecords = readBoolean(
    args?.['archive_merged_records'] ??
      args?.['archiveMergedRecords'] ??
      args?.['delete_merged_record'] ??
      args?.['deleteMergedRecord'],
  );
  const dryRun = readBoolean(args?.['dry_run'] ?? args?.['dryRun']);
  const confirm = readBoolean(args?.['confirm']);
  const reason = readString(args?.['reason']);

  return {
    ...(objectType ? { object_type: objectType } : undefined),
    ...(primaryRecordID ? { primary_record_id: primaryRecordID } : undefined),
    ...(duplicateRecordIDs.length ? { duplicate_record_ids: duplicateRecordIDs } : undefined),
    ...(fieldResolution ? { field_resolution: fieldResolution } : undefined),
    ...(typeof archiveMergedRecords === 'boolean' ?
      { archive_merged_records: archiveMergedRecords }
    : undefined),
    ...(typeof dryRun === 'boolean' ? { dry_run: dryRun } : undefined),
    ...(typeof confirm === 'boolean' ? { confirm } : undefined),
    ...(reason ? { reason } : undefined),
  };
};

const readLowerString = (value: unknown): string | undefined => readString(value)?.toLowerCase();

const recordQueryPathForBody = (_body: Record<string, unknown>): string => '/api/v2/public/records/query';

const recordAggregatePathForBody = (_body: Record<string, unknown>): string =>
  '/api/v2/public/records/aggregate';

const normalizeRecordMergePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  if (!envelope) {
    return payload;
  }
  const data = readRecord(envelope.data) ?? {};
  return {
    ...data,
    ...(envelope.meta?.['ctx_id'] && !data['ctx_id'] ? { ctx_id: envelope.meta['ctx_id'] } : undefined),
  };
};

const buildRecordMergeResult = (
  toolName: 'preview_record_merge' | 'merge_records',
  payload: Record<string, unknown>,
): ToolCallResult => {
  const objectType = readString(payload['object_type']) ?? 'records';
  const status = readString(payload['status']) ?? 'completed';
  const message = readString(payload['message']) ?? `${toolName} completed`;
  const mergePlan = readRecord(payload['merge_plan']);
  const primaryRecord = readRecord(mergePlan?.['primary_record']);
  const duplicateRecords =
    Array.isArray(mergePlan?.['duplicate_records']) ? mergePlan?.['duplicate_records'] : [];
  const primaryID = readString(primaryRecord?.['id']);
  const duplicateCount = duplicateRecords.length;
  const summary =
    toolName === 'preview_record_merge' ?
      `preview_record_merge planned ${duplicateCount} ${objectType} duplicate record merge${
        primaryID ? ` into ${primaryID}` : ''
      }.`
    : `merge_records ${status} ${duplicateCount} ${objectType} duplicate record merge${
        primaryID ? ` into ${primaryID}` : ''
      }.`;

  return {
    content: [
      {
        type: 'text',
        text: `${summary} ${message}`,
      },
    ],
    structuredContent: payload,
  };
};

const buildCustomObjectRecordMutationBody = (
  args: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const externalObjectType = readCustomObjectIdentifier(args);
  const data = readRecord(args?.['data']);
  const associations = readRecord(args?.['associations']);
  const formSetID = readString(args?.['form_set_id'] ?? args?.['formSetId']);
  const propertySetID = readString(args?.['property_set_id'] ?? args?.['propertySetId']);
  const viewID = readString(args?.['view_id'] ?? args?.['viewId']);
  const reservedKeys = new Set([
    'custom_object',
    'customObject',
    'custom_object_slug',
    'customObjectSlug',
    'custom_object_id',
    'customObjectId',
    'external_object_type',
    'externalObjectType',
    'record_id',
    'recordId',
    'data',
    'associations',
    'form_set_id',
    'formSetId',
    'property_set_id',
    'propertySetId',
    'view_id',
    'viewId',
  ]);
  const inlineData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args ?? {})) {
    if (!reservedKeys.has(key)) {
      inlineData[key] = value;
    }
  }
  const mergedData = { ...inlineData, ...(data ?? {}) };

  return {
    ...(externalObjectType ? { external_object_type: externalObjectType } : undefined),
    data: mergedData,
    ...(associations ? { associations } : undefined),
    ...(formSetID ? { form_set_id: formSetID } : undefined),
    ...(propertySetID ? { property_set_id: propertySetID } : undefined),
    ...(viewID ? { view_id: viewID } : undefined),
  };
};

const buildCustomObjectRecordMutationResult = ({
  toolName,
  action,
  payload,
}: {
  toolName: string;
  action: string;
  payload: Record<string, unknown>;
}): ToolCallResult => {
  const data = readRecord(payload['data']) ?? {};
  const recordID = readString(data['id']);
  const message = `${toolName} ${action} custom object record${recordID ? ` ${recordID}` : ''}.`;

  return {
    content: [{ type: 'text', text: message }],
    structuredContent: payload,
  };
};

const normalizeRecordQueryPayload = (
  payload: Record<string, unknown>,
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  if (!envelope) {
    return payload;
  }

  const pagination = readRecord(envelope.meta?.['pagination']);
  const rows =
    Array.isArray(envelope.data) ? envelope.data
    : Array.isArray(readRecord(envelope.data)?.['data']) ? (readRecord(envelope.data)?.['data'] as unknown[])
    : [];
  const page = readNumber(pagination?.['page'], readNumber(body['page'], 1));
  const limit = readNumber(pagination?.['page_size'], readNumber(body['limit'], rows.length || 25));
  const total = readNumber(pagination?.['total'], rows.length);

  return {
    object_type: body['object_type'] ?? 'records',
    scope: body['scope'] ?? 'sanka',
    ...(body['provider'] ? { provider: body['provider'] } : undefined),
    ...(body['channel_id'] ? { channel_id: body['channel_id'] } : undefined),
    ...(body['external_object_type'] ? { external_object_type: body['external_object_type'] } : undefined),
    count: rows.length,
    total,
    page,
    limit,
    has_next: page * limit < total,
    data: rows,
    message: 'OK',
    ...(envelope.meta?.['ctx_id'] ? { ctx_id: envelope.meta['ctx_id'] } : undefined),
  };
};

const normalizeRecordAggregatePayload = (
  payload: Record<string, unknown>,
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  if (!envelope) {
    return payload;
  }

  const data = readRecord(envelope.data) ?? {};
  return {
    ...data,
    object_type: data['object_type'] ?? body['object_type'] ?? 'records',
    scope: data['scope'] ?? body['scope'] ?? 'sanka',
    ...(body['provider'] && !data['provider'] ? { provider: body['provider'] } : undefined),
    ...(body['channel_id'] && !data['channel_id'] ? { channel_id: body['channel_id'] } : undefined),
    message: data['message'] ?? 'OK',
    ...(envelope.meta?.['ctx_id'] ? { ctx_id: envelope.meta['ctx_id'] } : undefined),
  };
};

const buildRecordQueryResult = (payload: Record<string, unknown>): ToolCallResult => {
  const objectType = readString(payload['object_type']) ?? 'records';
  const count = readNumber(payload['count'], 0);
  const total = readNumber(payload['total'], count);
  const rows = Array.isArray(payload['data']) ? payload['data'] : [];
  const metrics = readRecord(payload['metrics']);
  const candidateCount = metrics?.['candidate_count'];
  const structuredTextPreview = buildStructuredTextPreview('query_records results preview', {
    object_type: objectType,
    count,
    total,
    results: rows.slice(0, STRUCTURED_TEXT_PREVIEW_ITEM_LIMIT),
  });
  if (typeof candidateCount === 'number') {
    return {
      content: [
        {
          type: 'text',
          text: [
            `query_records found ${candidateCount} duplicate candidate groups for ${objectType}.`,
            structuredTextPreview,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      structuredContent: {
        ...payload,
        results: rows,
      },
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: [`query_records returned ${count} of ${total} ${objectType} records.`, structuredTextPreview]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
    structuredContent: {
      ...payload,
      results: rows,
    },
  };
};

const buildRecordAggregateResult = (payload: Record<string, unknown>): ToolCallResult => {
  const objectType = readString(payload['object_type']) ?? 'records';
  const metrics = readRecord(payload['metrics']) ?? {};
  const count = metrics['count'];
  const unavailableReason = readString(payload['unavailable_reason']);
  const candidateCount = metrics['candidate_count'];
  const summary =
    unavailableReason ?
      `aggregate_records unavailable: ${unavailableReason}. ${readString(payload['message']) ?? ''}`.trim()
    : typeof candidateCount === 'number' ?
      `aggregate_records found ${candidateCount} duplicate candidate groups for ${objectType}.`
    : typeof count === 'number' ? `aggregate_records count for ${objectType}: ${count}`
    : `aggregate_records completed for ${objectType}.`;

  return {
    content: [
      {
        type: 'text',
        text: summary,
      },
    ],
    structuredContent: payload,
  };
};

const readAssociationIdentifier = (value: unknown): string | undefined => {
  const stringValue = readString(value);
  if (stringValue) {
    return stringValue;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const buildAssociationBaseParams = (args: Record<string, unknown> | undefined) => {
  const params: Record<string, unknown> = {};

  for (const key of [
    'source_object',
    'source_custom_object_id',
    'target_object',
    'target_custom_object_id',
    'label_id',
    'label',
  ] as const) {
    const value = readString(args?.[key]);
    if (value) {
      params[key] = value;
    }
  }

  const sourceID = readAssociationIdentifier(args?.['source_id']);
  if (sourceID) {
    params['source_id'] = sourceID;
  }
  const targetID = readAssociationIdentifier(args?.['target_id']);
  if (targetID) {
    params['target_id'] = targetID;
  }

  return params;
};

const buildAssociationListParams = (args: Record<string, unknown> | undefined) => {
  const params = buildAssociationBaseParams(args);
  const workspaceID = readString(args?.['workspace_id']);
  if (workspaceID) {
    params['workspace_id'] = workspaceID;
  }
  params['page'] = Math.max(1, Math.trunc(readNumber(args?.['page'], 1)));
  params['limit'] = Math.max(1, Math.min(100, Math.trunc(readNumber(args?.['limit'], 25))));
  return params;
};

const buildAssociationCreateBody = (args: Record<string, unknown> | undefined) =>
  buildAssociationBaseParams(args);

const buildAssociationDeleteParams = (args: Record<string, unknown> | undefined) => {
  const params = buildAssociationBaseParams(args);
  const workspaceID = readString(args?.['workspace_id']);
  const associationID =
    readAssociationIdentifier(args?.['association_id']) ??
    readAssociationIdentifier(args?.['associationId']) ??
    readAssociationIdentifier(args?.['id']);
  if (workspaceID) {
    params['workspace_id'] = workspaceID;
  }
  if (associationID) {
    params['association_id'] = associationID;
  }
  return params;
};

const hasAssociationSourceRef = (params: Record<string, unknown>) =>
  Boolean(readString(params['source_object']) && readString(params['source_id']));

const hasAssociationTargetRef = (params: Record<string, unknown>) =>
  Boolean(readString(params['target_object']) && readString(params['target_id']));

const hasAssociationLabelRef = (params: Record<string, unknown>) =>
  Boolean(readString(params['label_id']) || readString(params['label']));

const associationEndpointLabel = (
  association: Record<string, unknown> | undefined,
  key: 'source' | 'target',
) => {
  const endpoint = readRecord(association?.[key]);
  const object = readString(endpoint?.['object']) ?? readString(endpoint?.['object_type']);
  const id = readString(endpoint?.['id']);
  return [object, id].filter(Boolean).join(':') || key;
};

const buildAssociationMutationText = (
  payload: Record<string, unknown>,
  action: 'created' | 'loaded' | 'deleted',
) => {
  if (action === 'deleted') {
    return readBoolean(payload['deleted']) === false ?
        readString(payload['message']) ?? 'Association was not deleted.'
      : readString(payload['message']) ?? 'Deleted association.';
  }

  const association = readRecord(payload['association']);
  const source = associationEndpointLabel(association, 'source');
  const target = associationEndpointLabel(association, 'target');
  const label = readRecord(association?.['label']);
  const labelName =
    readString(label?.['label']) ?? readString(label?.['label_ja']) ?? readString(label?.['id']);
  const associationID = readString(association?.['id']);
  const verb =
    action === 'created' && readBoolean(payload['created']) === false ? 'Found existing' : 'Created';
  const labelText = labelName ? ` with label ${labelName}` : '';
  const idText = associationID ? ` (${associationID})` : '';
  return `${verb} association ${source} -> ${target}${labelText}${idText}.`;
};

const buildAssociationListResult = (payload: Record<string, unknown>): ToolCallResult => {
  const rows = Array.isArray(payload['data']) ? payload['data'] : [];
  const associations = rows
    .map((row) => readRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));
  const count = readNumber(payload['count'], associations.length);
  const total = readNumber(payload['total'], count);
  const page = readNumber(payload['page'], 1);
  const message = readString(payload['message']) ?? `Returned ${associations.length} associations.`;

  return {
    content: [
      {
        type: 'text',
        text: `Found ${total} association${total === 1 ? '' : 's'}.`,
      },
    ],
    structuredContent: {
      count,
      page,
      total,
      message,
      results: associations,
      ctx_id: readString(payload['ctx_id']) ?? undefined,
      limit: readNumber(payload['limit'], 0) || undefined,
      has_next: readBoolean(payload['has_next']) ?? undefined,
      next_page: readNumber(payload['next_page'], 0) || undefined,
      pagination: readRecord(payload['pagination']) ?? undefined,
    },
  };
};

const readIntegrationScope = (value: unknown): 'sanka' | 'integration' | undefined => {
  const scope = readString(value);
  if (scope === 'sanka' || scope === 'integration') {
    return scope;
  }
  return undefined;
};

const readIntegrationProvider = (
  value: unknown,
): 'freee' | 'hubspot' | 'moneyforward' | 'salesforce' | undefined => {
  const provider = readString(value);
  if (
    provider === 'freee' ||
    provider === 'hubspot' ||
    provider === 'moneyforward' ||
    provider === 'salesforce'
  ) {
    return provider;
  }
  return undefined;
};

const buildListParams = (args: Record<string, unknown> | undefined) => {
  const referenceID = readString(args?.['reference_id']);
  const scope = readIntegrationScope(args?.['scope'] ?? args?.['source']);
  const provider = readIntegrationProvider(args?.['provider']);
  const legacyProvider = provider === 'freee' || provider === 'moneyforward' ? undefined : provider;
  const channelID = readString(args?.['channel_id'] ?? args?.['channelId']);
  const externalObjectType = readString(args?.['external_object_type'] ?? args?.['externalObjectType']);
  const search = readString(args?.['search']);
  const sort = readString(args?.['sort']);
  const view = readString(args?.['view']);
  const language = readString(args?.['language']);

  return {
    limit: clampListLimit(args?.['limit'], 10),
    page: readNumber(args?.['page'], 1),
    ...(scope ? { scope } : undefined),
    ...(legacyProvider ? { provider: legacyProvider } : undefined),
    ...(channelID ? { channel_id: channelID } : undefined),
    ...(externalObjectType ? { external_object_type: externalObjectType } : undefined),
    ...(referenceID ? { reference_id: referenceID } : undefined),
    ...(search ? { search } : undefined),
    ...(sort ? { sort } : undefined),
    ...(view ? { view } : undefined),
    ...(language ? { 'Accept-Language': language } : undefined),
  };
};

const hasCompanyRecordRoutingArgs = (args: Record<string, unknown> | undefined): boolean => {
  if (!args) {
    return false;
  }
  return Boolean(
    readIntegrationScope(args['scope'] ?? args['source']) ||
      readIntegrationProvider(args['provider']) ||
      readString(args['channel_id'] ?? args['channelId']) ||
      readString(args['external_object_type'] ?? args['externalObjectType']) ||
      readStringArray(args['select']).length,
  );
};

const hasDealRecordRoutingArgs = (args: Record<string, unknown> | undefined): boolean => {
  if (!args) {
    return false;
  }
  return Boolean(
    readIntegrationScope(args['scope'] ?? args['source']) ||
      readIntegrationProvider(args['provider']) ||
      readString(args['channel_id'] ?? args['channelId']) ||
      readString(args['external_object_type'] ?? args['externalObjectType']) ||
      readString(args['search']) ||
      buildRecordFilters(args['filters']).length ||
      readStringArray(args['select']).length,
  );
};

const buildCompanyRecordQueryBody = (args: Record<string, unknown> | undefined) => {
  const body = buildRecordQueryBody({
    ...(args ?? {}),
    object_type: 'companies',
  });
  if (!Array.isArray(body['select'])) {
    body['select'] = ['id', 'name', 'url', 'phone_number', 'updated_at'];
  }
  return body;
};

const buildDealRecordQueryBody = (args: Record<string, unknown> | undefined) => {
  const body = buildRecordQueryBody({
    ...(args ?? {}),
    object_type: 'deals',
  });
  if (!Array.isArray(body['select'])) {
    body['select'] =
      (
        readIntegrationScope(args?.['scope'] ?? args?.['source']) ||
        readIntegrationProvider(args?.['provider'])
      ) ?
        ['id', 'name', 'amount', 'case_status', 'closed_at', 'updated_at']
      : ['id', 'name', 'case_status', 'closed_at', 'updated_at'];
  }
  return body;
};

const buildCompanyRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const companyID = readString(args?.['company_id']);
  const externalID = readString(args?.['external_id']);

  return {
    companyID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
    },
  };
};

const buildCompanyMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'address',
    'billing_cycle',
    'channel_id',
    'email',
    'external_id',
    'external_object_type',
    'name',
    'operation',
    'payment_cycle',
    'phone_number',
    'primary_external_id',
    'provider',
    'status',
    'target',
    'url',
  ]);
  assignBooleanFields(body, args, ['allowed_in_store', 'confirm', 'dry_run']);
  const secondaryExternalIDs = readStringArray(args?.['secondary_external_ids']);
  if (secondaryExternalIDs.length > 0) {
    body['secondary_external_ids'] = secondaryExternalIDs;
  }
  const customFields = readRecord(args?.['custom_fields']);
  if (customFields) {
    body['custom_fields'] = customFields;
  }
  return body;
};

const buildCompanyDeleteParams = (args: Record<string, unknown> | undefined) => {
  const externalID = readString(args?.['external_id']);
  const target = readString(args?.['target']);
  const companyID = readString(args?.['company_id']) ?? (target === 'integration' ? externalID : undefined);
  const params: Record<string, unknown> = {};
  assignStringFields(params, args, [
    'channel_id',
    'external_id',
    'external_object_type',
    'operation',
    'provider',
    'target',
  ]);
  assignBooleanFields(params, args, ['confirm', 'dry_run']);

  return {
    companyID,
    params,
  };
};

const buildContactRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const contactID = readString(args?.['contact_id']);
  const externalID = readString(args?.['external_id']);

  return {
    contactID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
    },
  };
};

const buildContactMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'channel_id',
    'company',
    'email',
    'external_id',
    'external_object_type',
    'last_name',
    'name',
    'operation',
    'phone_number',
    'provider',
    'status',
    'target',
  ]);
  assignBooleanFields(body, args, ['allowed_in_store', 'confirm', 'dry_run']);
  const customFields = readRecord(args?.['custom_fields']);
  if (customFields) {
    body['custom_fields'] = customFields;
  }
  return body;
};

const buildContactDeleteParams = (args: Record<string, unknown> | undefined) => {
  const contactID = readString(args?.['contact_id']);
  const params: Record<string, unknown> = {};
  assignStringFields(params, args, [
    'channel_id',
    'external_id',
    'external_object_type',
    'operation',
    'provider',
    'target',
  ]);
  assignBooleanFields(params, args, ['confirm', 'dry_run']);

  return {
    contactID,
    params,
  };
};

const buildExpenseListParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  const rawLimit = readNumber(args?.['limit'], 10);
  const rawPage = readNumber(args?.['page'], 1);
  const limit = Math.max(1, Math.min(100, rawLimit));
  const page = Math.max(1, rawPage);

  return {
    limit,
    page,
    params: {
      limit,
      page,
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
    },
    headers: language ? { 'Accept-Language': language } : undefined,
  };
};

const buildExpenseRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const expenseID = readString(args?.['expense_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);

  return {
    expenseID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildExpenseMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};

  if (typeof args?.['amount'] === 'number' && Number.isFinite(args['amount'])) {
    body['amount'] = args['amount'];
  }

  for (const key of [
    'company_external_id',
    'company_id',
    'contact_external_id',
    'contact_id',
    'currency',
    'description',
    'due_date',
    'external_id',
    'reimburse_date',
    'status',
  ] as const) {
    const value = readString(args?.[key]);
    if (value) {
      body[key] = value;
    }
  }

  const attachmentFileIDs = readStringArray(args?.['attachment_file_ids']);
  if (attachmentFileIDs.length > 0) {
    body['attachment_file'] = {
      files: attachmentFileIDs.map((fileID) => ({ file_id: fileID })),
    };
  }

  return body;
};

const buildPagedWorkspaceParams = (args: Record<string, unknown> | undefined, defaultLimit = 10) => {
  const rawLimit = readNumber(args?.['limit'], defaultLimit);
  const rawPage = readNumber(args?.['page'], 1);
  const limit = Math.max(1, Math.min(100, rawLimit));
  const page = Math.max(1, rawPage);
  const params: Record<string, unknown> = { limit, page };
  assignStringFields(params, args, ['workspace_id']);
  return { limit, page, params };
};

const buildAbsenceListParams = (args: Record<string, unknown> | undefined) => {
  const result = buildPagedWorkspaceParams(args, 10);
  assignStringFields(result.params, args, [
    'worker_id',
    'status',
    'usage_status',
    'start_date_from',
    'start_date_to',
  ]);
  return result;
};

const buildEmployeeListParams = (args: Record<string, unknown> | undefined) => {
  const result = buildPagedWorkspaceParams(args, 10);
  assignStringFields(result.params, args, ['search', 'sort', 'view', 'usage_status', 'language']);
  return result;
};

const buildWorkspaceQuery = (args: Record<string, unknown> | undefined) => {
  const params: Record<string, unknown> = {};
  assignStringFields(params, args, ['workspace_id']);
  return params;
};

const buildContractQuery = (args: Record<string, unknown> | undefined) => {
  const params = buildWorkspaceQuery(args);
  assignStringFields(params, args, ['language']);
  return params;
};

const CONTRACT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const CONTRACT_UPLOAD_MAX_BASE64_CHARS = Math.ceil((CONTRACT_UPLOAD_MAX_BYTES / 3) * 4) + 1024 * 1024;

const normalizeBase64Data = (data: string): string => data.replace(/\s/g, '');

const estimateBase64DecodedSize = (normalizedData: string): number => {
  if (!normalizedData) {
    return 0;
  }
  const padding =
    normalizedData.endsWith('==') ? 2
    : normalizedData.endsWith('=') ? 1
    : 0;
  return Math.floor((normalizedData.length * 3) / 4) - padding;
};

const isValidBase64Data = (normalizedData: string): boolean => {
  if (!normalizedData) {
    return false;
  }
  const paddingMatch = /=+$/.exec(normalizedData);
  const paddingLength = paddingMatch?.[0].length ?? 0;
  if (paddingLength > 2) {
    return false;
  }
  const body = paddingLength > 0 ? normalizedData.slice(0, -paddingLength) : normalizedData;
  if (!body || body.includes('=') || !/^[A-Za-z0-9+/]+$/.test(body)) {
    return false;
  }
  const remainder = body.length % 4;
  if (remainder === 1) {
    return false;
  }
  if (paddingLength === 1 && remainder !== 3) {
    return false;
  }
  if (paddingLength === 2 && remainder !== 2) {
    return false;
  }
  return true;
};

const sanitizeContractUploadFilename = (filename: string): string | undefined => {
  const lastSegment =
    filename
      .split(/[\\/]+/)
      .filter(Boolean)
      .pop() ?? filename;
  const cleaned = lastSegment.replace(/[\x00-\x1f"]/g, '_').trim();
  return cleaned || undefined;
};

const contractDataFromEnvelope = (payload: Record<string, unknown>): Record<string, unknown> => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  const data = readRecord(envelope?.data) ?? readRecord(payload['data']) ?? payload;
  return {
    ...data,
    ...(envelope?.meta?.['ctx_id'] ? { ctx_id: envelope.meta['ctx_id'] } : undefined),
  };
};

const buildContractUploadBody = (
  args: Record<string, unknown> | undefined,
  defaultMimeType: string,
): FormData | ToolCallResult => {
  const filename = readString(args?.['filename']);
  const contentBase64 = readString(args?.['content_base64']);
  const mimeType = readString(args?.['mime_type']);
  if (!filename) {
    return asErrorResult('`filename` is required.');
  }
  const safeFilename = sanitizeContractUploadFilename(filename);
  if (!safeFilename) {
    return asErrorResult('`filename` must include a valid file name.');
  }
  if (!contentBase64) {
    return asErrorResult('`content_base64` is required.');
  }
  if (contentBase64.length > CONTRACT_UPLOAD_MAX_BASE64_CHARS) {
    return asErrorResult('`content_base64` decoded size must be 20 MiB or smaller.');
  }

  const parsed = parseBase64Content(contentBase64);
  const normalizedData = normalizeBase64Data(parsed.data);
  if (!isValidBase64Data(normalizedData)) {
    return asErrorResult('`content_base64` must be valid base64 data.');
  }
  const decodedSize = estimateBase64DecodedSize(normalizedData);
  if (decodedSize > CONTRACT_UPLOAD_MAX_BYTES) {
    return asErrorResult('`content_base64` decoded size must be 20 MiB or smaller.');
  }

  const file = new File([Buffer.from(normalizedData, 'base64')], safeFilename, {
    type: mimeType || parsed.mimeType || defaultMimeType,
  });
  const form = new FormData();
  form.append('doc', file as unknown as Blob, safeFilename);
  return form;
};

const normalizeContractTemplateListPayload = (
  payload: Record<string, unknown>,
): {
  templates: Array<Record<string, unknown>>;
  message: string;
  total: number;
} => {
  const data = contractDataFromEnvelope(payload);
  const templates = readObjectArray(data['templates']) ?? [];
  return {
    templates,
    message: readString(data['message']) ?? `Returned ${templates.length} contract templates.`,
    total: templates.length,
  };
};

const buildContractCreateFromTemplateBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['template_id', 'title']);
  return body;
};

const buildContractMetadataBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['name', 'description']);
  return body;
};

const normalizeContractSignerRows = (rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> =>
  rows.map((row) => {
    const signer: Record<string, unknown> = {};
    assignStringFields(signer, row, ['name', 'email']);
    return signer;
  });

const normalizeContractPlaceFieldRows = (
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> =>
  rows.map((row) => {
    const field: Record<string, unknown> = {};
    assignStringFields(field, row, ['signer_id']);
    for (const key of ['left', 'top', 'width', 'height', 'page_width', 'page_height']) {
      const value = row[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        field[key] = value;
      }
    }
    const page = row['page'];
    if (typeof page === 'number' && Number.isInteger(page)) {
      field['page'] = page;
    }
    return field;
  });

const buildContractSignersBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  const signers = readObjectArray(args?.['signers']);
  if (signers) {
    body['signers'] = normalizeContractSignerRows(signers);
  }
  assignStringFields(body, args, ['signature_id']);
  assignBooleanFields(body, args, ['add_me_as_signer']);
  return body;
};

const buildContractPlaceFieldsBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  const fields = readObjectArray(args?.['fields']);
  if (fields) {
    body['fields'] = normalizeContractPlaceFieldRows(fields);
  }
  return body;
};

const buildContractSendBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['content', 'language']);
  assignBooleanFields(body, args, ['resend', 'no_send_request']);
  return body;
};

const buildContractScheduleSendBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['content', 'scheduled_at', 'language']);
  return body;
};

const buildPayrollPayslipDownloadParams = (args: Record<string, unknown> | undefined) => {
  const runID = readString(args?.['run_id']);
  const params = buildWorkspaceQuery(args);
  assignStringFields(params, args, ['result_id', 'employee_id', 'language']);
  return { runID, params };
};

const buildAbsenceMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'worker_id',
    'start_date',
    'end_date',
    'absence_type',
    'status',
    'requester_name',
    'note',
  ]);
  assignIntegerFields(body, args, ['requested_by_user_id', 'approved_by_user_id']);
  return body;
};

const buildAttendanceRecordListParams = (args: Record<string, unknown> | undefined) => {
  const result = buildPagedWorkspaceParams(args, 10);
  assignStringFields(result.params, args, ['search', 'usage_status', 'sort']);
  return result;
};

const buildAttendanceRecordMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['external_id', 'name', 'control_time_mode']);
  assignIntegerFields(body, args, ['assignee_user_id']);
  assignBooleanFields(body, args, ['timetracker_toggle']);
  const subtracks = readObjectArray(args?.['subtracks']);
  if (subtracks && subtracks.length > 0) {
    body['subtracks'] = subtracks;
  }
  const customFields = readRecord(args?.['custom_fields']);
  if (customFields) {
    body['custom_fields'] = customFields;
  }
  return body;
};

const buildPayrollProfileBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'employee_id',
    'jurisdiction_country_code',
    'pay_type',
    'tax_table_type',
    'health_insurance_prefecture_code',
    'effective_from',
    'effective_to',
  ]);
  assignIntegerFields(body, args, ['dependent_count']);
  assignMappedNumberFields(body, args, [
    ['base_salary', 'base_salary'],
    ['hourly_rate', 'hourly_rate'],
    ['scheduled_monthly_hours', 'scheduled_monthly_hours'],
    ['resident_tax_monthly_amount', 'resident_tax_monthly_amount'],
    ['standard_monthly_remuneration', 'standard_monthly_remuneration'],
  ]);
  assignBooleanFields(body, args, [
    'is_health_insurance_enrolled',
    'is_care_insurance_enrolled',
    'is_pension_enrolled',
    'is_employment_insurance_enrolled',
  ]);
  const extraSettings = readRecord(args?.['extra_settings']);
  if (extraSettings) {
    body['extra_settings'] = extraSettings;
  }
  return body;
};

const buildPayrollRunListParams = (args: Record<string, unknown> | undefined) => {
  const params = buildWorkspaceQuery(args);
  assignStringFields(params, args, ['period']);
  return params;
};

const buildPayrollRunCalculateBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['period', 'pay_date', 'country_code']);
  return body;
};

const buildPayrollJournalEntryBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['debit_account', 'credit_account', 'deductions_account', 'notes']);
  return body;
};

const readDataArray = (payload: Record<string, unknown>): Array<Record<string, unknown>> => {
  const data = payload['data'];
  if (Array.isArray(data)) {
    return data.map((row) => readRecord(row) ?? {}).filter(Boolean);
  }
  const dataRecord = readRecord(data);
  const items = dataRecord ? dataRecord['items'] : undefined;
  return Array.isArray(items) ? items.map((row) => readRecord(row) ?? {}).filter(Boolean) : [];
};

const readPayloadDataRecord = (payload: Record<string, unknown>): Record<string, unknown> => {
  return readRecord(payload['data']) ?? payload;
};

const readIntegerArgument = (value: unknown, fallback: number, min: number, max: number): number => {
  const numberValue = readNumber(value, fallback);
  return Math.max(min, Math.min(max, Math.trunc(numberValue)));
};

const readV2DataRecord = (payload: Record<string, unknown>): Record<string, unknown> => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  return readRecord(envelope?.data) ?? readPayloadDataRecord(payload);
};

const buildPipelineSnapshotCaptureBody = (args: Record<string, unknown> | undefined) => {
  const sourceSystem = readString(args?.['source_system']) ?? 'sanka';
  const body: Record<string, unknown> = {};

  if (sourceSystem === 'hubspot') {
    assignStringFields(body, args, ['channel_id', 'search']);
    body['limit'] = readIntegerArgument(args?.['limit'], 1000, 0, 10000);
    return { sourceSystem, body };
  }

  assignStringFields(body, args, ['pipeline_id']);
  const customFieldWhitelist = readStringArray(args?.['custom_field_whitelist']);
  if (customFieldWhitelist.length > 0) {
    body['custom_field_whitelist'] = customFieldWhitelist;
  }
  return { sourceSystem, body };
};

const buildPipelineSnapshotListParams = (args: Record<string, unknown> | undefined) => {
  const params: Record<string, unknown> = {
    page: readIntegerArgument(args?.['page'], 1, 1, 1000000),
    limit: readIntegerArgument(args?.['limit'], 20, 1, 200),
  };
  assignStringFields(params, args, ['pipeline_id', 'source_system']);
  return params;
};

const buildPipelineSnapshotCompareBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['from_batch_id', 'to_batch_id', 'pipeline_id', 'source_system']);
  return body;
};

const buildPipelineSnapshotHubSpotSyncBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'channel_id',
    'from_batch_id',
    'to_batch_id',
    'pipeline_id',
    'source_system',
    'checked_at',
  ]);
  body['limit'] = readIntegerArgument(args?.['limit'], 500, 0, 10000);
  body['offset'] = readIntegerArgument(args?.['offset'], 0, 0, 1000000);
  body['dry_run'] = readBoolean(args?.['dry_run']) ?? true;
  body['confirm'] = readBoolean(args?.['confirm']) ?? false;
  return body;
};

const buildPipelineSnapshotCaptureSummary = (payload: Record<string, unknown>): string => {
  const data = readV2DataRecord(payload);
  const batchID = readString(data['batch_id']) ?? 'unknown batch';
  const dealCount = readNumber(data['deal_count'], 0);
  const sourceSystem = readString(data['source_system']);
  const sourceText = sourceSystem ? ` from ${sourceSystem}` : '';
  return `Captured pipeline snapshot ${batchID}${sourceText} with ${dealCount} deal${
    dealCount === 1 ? '' : 's'
  }.`;
};

const buildPipelineSnapshotBatchSummary = (payload: Record<string, unknown>): string => {
  const data = readV2DataRecord(payload);
  const batch = readRecord(data['batch']) ?? data;
  const batchID = readString(batch['batch_id']) ?? 'unknown batch';
  const deals = Array.isArray(data['deals']) ? data['deals'] : [];
  const dealCount = readNumber(batch['deal_count'], deals.length);
  return `Loaded pipeline snapshot batch ${batchID} with ${dealCount} deal${dealCount === 1 ? '' : 's'}.`;
};

const buildPipelineSnapshotCompareSummary = (payload: Record<string, unknown>): string => {
  const data = readV2DataRecord(payload);
  const totals = readRecord(data['totals']) ?? {};
  const fromBatch = readRecord(data['from_batch']);
  const toBatch = readRecord(data['to_batch']);
  const amountDelta = readNumber(totals['amount_delta_cents'], 0);
  const weightedDelta = readNumber(totals['weighted_delta_cents'], 0);
  const dealDiffs = Array.isArray(data['per_deal_diff']) ? data['per_deal_diff'] : [];
  const fromBatchID = readString(fromBatch?.['batch_id']) ?? 'previous batch';
  const toBatchID = readString(toBatch?.['batch_id']) ?? 'current batch';
  return `Compared pipeline snapshots ${fromBatchID} -> ${toBatchID}: amount delta ${amountDelta} cents, weighted delta ${weightedDelta} cents, ${
    dealDiffs.length
  } changed deal${dealDiffs.length === 1 ? '' : 's'}.`;
};

const buildPipelineSnapshotHubSpotSyncSummary = (payload: Record<string, unknown>): string => {
  const data = readV2DataRecord(payload);
  const dryRun = readBoolean(data['dry_run']) ?? true;
  const attempted = readNumber(data['attempted'], 0);
  const succeeded = readNumber(data['succeeded'], 0);
  const failed = readNumber(data['failed'], 0);
  const action = dryRun ? 'Previewed' : 'Synced';
  return `${action} HubSpot snapshot property updates: attempted ${attempted}, succeeded ${succeeded}, failed ${failed}.`;
};

const buildPipelineSnapshotListResult = (payload: Record<string, unknown>): ToolCallResult => {
  const data = readV2DataRecord(payload);
  const rows =
    Array.isArray(data['data']) ? data['data'].map((row) => readRecord(row) ?? {}).filter(Boolean) : [];
  const count = rows.length;
  const page = readIntegerArgument(data['page'], 1, 1, 1000000);
  const total = readNumber(data['total'], count);

  return buildListResult({
    label: 'pipeline snapshot batches',
    payload: {
      count,
      data: rows,
      message: `Returned ${count} of ${total} pipeline snapshot batches.`,
      page,
      total,
    },
    previewKeys: ['batch_id', 'trigger', 'captured_at', 'deal_count', 'pipeline_id'],
  });
};

const buildRecordMutationSummary = ({
  entity,
  action,
  payload,
  idKeys,
}: {
  entity: string;
  action: 'created' | 'updated' | 'deleted' | 'upserted' | 'calculated' | 'approved';
  payload: Record<string, unknown>;
  idKeys: string[];
}): string => {
  const data = readPayloadDataRecord(payload);
  const reference =
    idKeys.map((key) => readString(data[key]) ?? String(data[key] ?? '')).find((value) => value.trim()) ||
    readString(payload['status']) ||
    entity;
  return `${entity} ${action}: ${reference}.`;
};

const buildIncentiveListParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  const rawLimit = readNumber(args?.['limit'], 25);
  const rawPage = readNumber(args?.['page'], 1);
  const limit = Math.max(1, Math.min(100, rawLimit));
  const page = Math.max(1, rawPage);
  const params: Record<string, unknown> = {
    limit,
    page,
  };
  assignStringFields(params, args, [
    'period',
    'status',
    'owner_user_id',
    'source_object_type',
    'search',
    'sort',
    'sort_direction',
  ]);
  if (workspaceID) {
    params['workspace_id'] = workspaceID;
  }
  if (language) {
    params['Accept-Language'] = language;
  }
  return { limit, page, params };
};

const buildIncentivePlanListParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  return {
    ...(workspaceID ? { workspace_id: workspaceID } : undefined),
    ...(language ? { 'Accept-Language': language } : undefined),
  };
};

const buildIncentiveCompanyOptionsParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  const q = readString(args?.['q']);
  const limit = Math.max(1, Math.min(100, readNumber(args?.['limit'], 30)));
  return {
    limit,
    ...(q ? { q } : undefined),
    ...(workspaceID ? { workspace_id: workspaceID } : undefined),
    ...(language ? { 'Accept-Language': language } : undefined),
  };
};

const buildIncentivePlanCreateBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'name',
    'base_event',
    'source_status',
    'source_company_id',
    'payee_type',
    'payee_company_id',
    'amount_basis',
    'rate_type',
    'effective_from',
    'effective_to',
    'status',
  ]);
  assignMappedNumberFields(body, args, [
    ['rate_value', 'rate_value'],
    ['min_amount', 'min_amount'],
    ['max_payout_amount', 'max_payout_amount'],
  ]);
  return body;
};

const buildIncentiveCalculateBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['period', 'plan_id', 'owner_user_id']);
  const dryRun = readBoolean(args?.['dry_run']);
  if (dryRun !== undefined) {
    body['dry_run'] = dryRun;
  }
  return body;
};

const buildIncentiveWorkspaceQuery = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  return workspaceID ? { workspace_id: workspaceID } : undefined;
};

const buildIncentiveMutationSummary = ({
  action,
  payload,
}: {
  action: string;
  payload: Record<string, unknown>;
}): string => {
  const data = readRecord(payload['data']) ?? payload;
  const reference =
    readString(data['name']) ||
    readString(data['id']) ||
    readString(data['period']) ||
    readString(payload['message']) ||
    'incentive';
  return `Incentive ${action}: ${reference}.`;
};

const normalizePeriod = (period: string | undefined): string | undefined => {
  const match = /^(\d{4})-(\d{2})$/.exec(period ?? '');
  if (!match) {
    return undefined;
  }
  return `${match[1]}-${match[2]}`;
};

const periodsBetween = (periodFrom: string, periodTo?: string): string[] => {
  const start = normalizePeriod(periodFrom);
  const end = normalizePeriod(periodTo) ?? start;
  if (!start || !end) {
    return [];
  }
  const [startYearRaw, startMonthRaw] = start.split('-').map((value) => Number.parseInt(value, 10));
  const [endYearRaw, endMonthRaw] = end.split('-').map((value) => Number.parseInt(value, 10));
  if (
    startYearRaw === undefined ||
    startMonthRaw === undefined ||
    endYearRaw === undefined ||
    endMonthRaw === undefined
  ) {
    return [];
  }
  const startYear = startYearRaw;
  const startMonth = startMonthRaw;
  const endYear = endYearRaw;
  const endMonth = endMonthRaw;
  if (
    !Number.isFinite(startYear) ||
    !Number.isFinite(startMonth) ||
    !Number.isFinite(endYear) ||
    !Number.isFinite(endMonth)
  ) {
    return [];
  }
  const results: string[] = [];
  let cursor = startYear * 12 + startMonth - 1;
  const endIndex = endYear * 12 + endMonth - 1;
  while (cursor <= endIndex && results.length < 24) {
    const year = Math.floor(cursor / 12);
    const month = (cursor % 12) + 1;
    results.push(`${year}-${String(month).padStart(2, '0')}`);
    cursor += 1;
  }
  return results;
};

const periodLabelJa = (period: string): string => {
  const [year, month] = period.split('-');
  return `${year}年${Number.parseInt(month ?? '1', 10)}月`;
};

const formatYen = (value: number): string =>
  new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value);

const buildIncentiveNotice = ({
  rows,
  periods,
  requestDate,
  payeeCompanyName,
}: {
  rows: Array<Record<string, unknown>>;
  periods: string[];
  requestDate: string;
  payeeCompanyName?: string;
}): { notice: string; totalPayout: number; totalBaseAmount: number } => {
  const totalPayout = rows.reduce((sum, row) => {
    const amount = row['incentive_amount'];
    return sum + (typeof amount === 'number' ? amount : 0);
  }, 0);
  const totalBaseAmount = rows.reduce((sum, row) => {
    const amount = row['base_amount'];
    return sum + (typeof amount === 'number' ? amount : 0);
  }, 0);
  const partnerName =
    payeeCompanyName ||
    rows
      .map((row) => readString(row['payee_company_name']))
      .find((value): value is string => Boolean(value)) ||
    'ご担当者様';
  const firstRate = rows.map((row) => row['rate_value']).find((value) => typeof value === 'number');
  const rateLabel = typeof firstRate === 'number' ? `${firstRate}%` : '-';
  const periodLabel =
    periods.length > 1 ?
      `${periodLabelJa(periods[0] ?? '')} - ${periodLabelJa(periods[periods.length - 1] ?? '')}`
    : periodLabelJa(periods[0] ?? '');
  const sourceLines = rows
    .map((row) => {
      const period = readString(row['period']) ?? '';
      const source = readString(row['source_label']) || readString(row['source_record_id']) || '-';
      const baseAmount = typeof row['base_amount'] === 'number' ? row['base_amount'] : 0;
      return `${period}  ${source}  ${formatYen(baseAmount)}`;
    })
    .join('\n');

  const notice = [
    `${partnerName}`,
    'ご担当者様',
    '',
    '【請求依頼書】',
    '',
    `■パートナー名（宛先）： ${partnerName}`,
    `■依頼日： ${requestDate}`,
    `■対象期間： ${periodLabel}`,
    '■計算対象案件： 以下参照',
    `■振込予定金額（税込）： ${formatYen(totalPayout)}（${rateLabel}）`,
    '',
    '貴社にて上記の金額で、「株式会社サンカ」宛へ請求書のご発行をお願いいたします。',
    '',
    '【計算対象請求】',
    sourceLines || '対象請求はありません。',
    '',
    '【請求宛先】',
    '株式会社サンカ',
    '東京都江東区豊洲1-3-2',
    '経理担当 (hey@sanka.com) へメールでご請求内容を送付いただければ幸いです。',
    '',
    '以上、何卒よろしくお願い致します。',
    '株式会社サンカ　経理担当',
  ].join('\n');

  return { notice, totalPayout, totalBaseAmount };
};

const parseBase64Content = (raw: string): { data: string; mimeType?: string } => {
  const normalized = raw.trim();
  const dataURLMatch = /^data:([^;,]+)?;base64,(.+)$/s.exec(normalized);
  if (!dataURLMatch) {
    return { data: normalized };
  }

  const [, detectedMimeType = '', base64Data = ''] = dataURLMatch;

  return {
    data: base64Data.trim(),
    ...(detectedMimeType ? { mimeType: detectedMimeType.trim() } : {}),
  };
};

const buildAttachmentFilePayload = (
  args: Record<string, unknown> | undefined,
): AttachmentFilePayload | undefined => {
  const attachmentFileIDs = readStringArray(args?.['attachment_file_ids']);
  if (attachmentFileIDs.length === 0) {
    return undefined;
  }

  return {
    files: attachmentFileIDs.map((fileID) => ({ file_id: fileID })),
  };
};

const uploadAttachmentFileFromArgs = async ({
  args,
  entityName,
  uploadAttachment,
}: {
  args: Record<string, unknown> | undefined;
  entityName: string;
  uploadAttachment: (file: File) => Promise<unknown>;
}): Promise<ToolCallResult> => {
  const filename = readString(args?.['filename']);
  const contentBase64 = readString(args?.['content_base64']);
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
  const response = (await uploadAttachment(file)) as {
    filename?: string | null;
    [key: string]: unknown;
  };

  return {
    content: [
      {
        type: 'text',
        text: `Uploaded ${entityName} attachment ${response.filename || filename}.`,
      },
    ],
    structuredContent: response as Record<string, unknown>,
  };
};

const expenseAttachmentUploadTools = createChunkedAttachmentUploadTools({
  resource: 'expenses',
  tags: ['crm', 'expenses'],
  httpPath: '/api/v2/expenses/files',
  operationIdPrefix: 'public.expenses',
  entityName: 'expense',
  attachmentLabel: 'expense attachment',
  fileKindLabel: 'receipt/invoice PDFs',
  directUploadToolName: 'upload_expense_attachment',
  createToolName: 'create_expense',
  updateToolName: 'update_expense',
  startToolName: 'start_expense_attachment_upload',
  appendToolName: 'append_expense_attachment_upload_chunk',
  finishToolName: 'finish_expense_attachment_upload',
  startToolTitle: 'Start expense attachment upload',
  appendToolTitle: 'Append expense attachment upload chunk',
  finishToolTitle: 'Finish expense attachment upload',
  uploadAttachment: (reqContext, file) =>
    reqContext.client.public.expenses.uploadAttachment({ file }, undefined),
});

const orderAttachmentUploadTools = createChunkedAttachmentUploadTools({
  resource: 'orders',
  tags: ['crm', 'orders'],
  httpPath: '/api/v2/orders/files',
  operationIdPrefix: 'public.orders',
  entityName: 'order',
  attachmentLabel: 'order attachment',
  fileKindLabel: 'order PDFs or attachments',
  directUploadToolName: 'upload_order_attachment',
  createToolName: 'create_order',
  updateToolName: 'update_order',
  startToolName: 'start_order_attachment_upload',
  appendToolName: 'append_order_attachment_upload_chunk',
  finishToolName: 'finish_order_attachment_upload',
  startToolTitle: 'Start order attachment upload',
  appendToolTitle: 'Append order attachment upload chunk',
  finishToolTitle: 'Finish order attachment upload',
  uploadAttachment: (reqContext, file) =>
    reqContext.client.public.orders.uploadAttachment({ file }, undefined),
});

const purchaseOrderAttachmentUploadTools = createChunkedAttachmentUploadTools({
  resource: 'purchaseOrders',
  tags: ['crm', 'purchase-orders'],
  httpPath: '/api/v2/purchase-orders/files',
  operationIdPrefix: 'public.purchaseOrders',
  entityName: 'purchase order',
  attachmentLabel: 'purchase order attachment',
  fileKindLabel: 'purchase order PDFs or attachments',
  directUploadToolName: 'upload_purchase_order_attachment',
  createToolName: 'create_purchase_order',
  updateToolName: 'update_purchase_order',
  startToolName: 'start_purchase_order_attachment_upload',
  appendToolName: 'append_purchase_order_attachment_upload_chunk',
  finishToolName: 'finish_purchase_order_attachment_upload',
  startToolTitle: 'Start purchase order attachment upload',
  appendToolTitle: 'Append purchase order attachment upload chunk',
  finishToolTitle: 'Finish purchase order attachment upload',
  uploadAttachment: (reqContext, file) =>
    reqContext.client.public.purchaseOrders.uploadAttachment({ file }, undefined),
});

const estimateAttachmentUploadTools = createChunkedAttachmentUploadTools({
  resource: 'estimates',
  tags: ['crm', 'estimates'],
  httpPath: '/api/v2/estimates/files',
  operationIdPrefix: 'public.estimates',
  entityName: 'estimate',
  attachmentLabel: 'estimate attachment',
  fileKindLabel: 'estimate PDFs or attachments',
  directUploadToolName: 'upload_estimate_attachment',
  createToolName: 'create_estimate',
  updateToolName: 'update_estimate',
  startToolName: 'start_estimate_attachment_upload',
  appendToolName: 'append_estimate_attachment_upload_chunk',
  finishToolName: 'finish_estimate_attachment_upload',
  startToolTitle: 'Start estimate attachment upload',
  appendToolTitle: 'Append estimate attachment upload chunk',
  finishToolTitle: 'Finish estimate attachment upload',
  uploadAttachment: (reqContext, file) =>
    reqContext.client.public.estimates.uploadAttachment({ file }, undefined),
});

const invoiceAttachmentUploadTools = createChunkedAttachmentUploadTools({
  resource: 'invoices',
  tags: ['crm', 'invoices'],
  httpPath: '/api/v2/invoices/files',
  operationIdPrefix: 'public.invoices',
  entityName: 'invoice',
  attachmentLabel: 'invoice attachment',
  fileKindLabel: 'invoice PDFs or attachments',
  directUploadToolName: 'upload_invoice_attachment',
  createToolName: 'create_invoice',
  updateToolName: 'update_invoice',
  startToolName: 'start_invoice_attachment_upload',
  appendToolName: 'append_invoice_attachment_upload_chunk',
  finishToolName: 'finish_invoice_attachment_upload',
  startToolTitle: 'Start invoice attachment upload',
  appendToolTitle: 'Append invoice attachment upload chunk',
  finishToolTitle: 'Finish invoice attachment upload',
  uploadAttachment: (reqContext, file) =>
    reqContext.client.public.invoices.uploadAttachment({ file }, undefined),
});

const billAttachmentUploadTools = createChunkedAttachmentUploadTools({
  resource: 'bills',
  tags: ['crm', 'bills'],
  httpPath: '/api/v2/bills/files',
  operationIdPrefix: 'public.bills',
  entityName: 'bill',
  attachmentLabel: 'bill attachment',
  fileKindLabel: 'supplier invoice PDFs',
  directUploadToolName: 'upload_bill_attachment',
  createToolName: 'create_bill',
  updateToolName: 'update_bill',
  startToolName: 'start_bill_attachment_upload',
  appendToolName: 'append_bill_attachment_upload_chunk',
  finishToolName: 'finish_bill_attachment_upload',
  startToolTitle: 'Start bill attachment upload',
  appendToolTitle: 'Append bill attachment upload chunk',
  finishToolTitle: 'Finish bill attachment upload',
  uploadAttachment: (reqContext, file) =>
    reqContext.client.public.bills.uploadAttachment({ file }, undefined),
});

const buildExpenseMutationSummary = ({
  action,
  payload,
}: {
  action: 'created' | 'updated' | 'deleted';
  payload: Record<string, unknown>;
}): string => {
  const reference =
    readString(payload['expense_id']) ||
    readString(payload['external_id']) ||
    readString(payload['status']) ||
    'expense';
  return appendGovernanceAdvisorySummary(`Expense ${action}: ${reference}.`, payload);
};

const buildExpenseDetailSummary = (expense: Record<string, unknown>): string => {
  const description = readString(expense['description']);
  const companyName = readString(expense['company_name']);
  const id = readString(expense['id']);
  const amount = typeof expense['amount'] === 'number' ? String(expense['amount']) : undefined;
  const currency = readString(expense['currency']);
  const attachmentFileCount =
    typeof expense['attachment_file_count'] === 'number' ? expense['attachment_file_count'] : 0;

  if (description) {
    return `Loaded expense: ${description}.${
      attachmentFileCount > 0 ? ` Attached files: ${attachmentFileCount}.` : ''
    }`;
  }
  if (companyName && amount && currency) {
    return `Loaded expense for ${companyName}: ${amount} ${currency}.${
      attachmentFileCount > 0 ? ` Attached files: ${attachmentFileCount}.` : ''
    }`;
  }
  return `Loaded expense ${id ?? ''}.`.trim();
};

type ExpenseFilesClient = {
  listFiles?: (
    expenseID: string,
    params?: { page?: number; page_size?: number } | null,
    options?: unknown,
  ) => Promise<unknown>;
};

const expenseAttachedFilesFromListPayload = (payload: unknown): Array<Record<string, unknown>> => {
  const data = readRecord(payload);
  if (!data) {
    return [];
  }
  const items = data['items'];
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => readRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
};

const expenseFileCountFromListPayload = (payload: unknown, files: Array<Record<string, unknown>>): number => {
  const total = readRecord(payload)?.['total'];
  return typeof total === 'number' && Number.isFinite(total) ? total : files.length;
};

const withExpenseAttachedFiles = (
  payload: Record<string, unknown>,
  files: Array<Record<string, unknown>>,
  attachmentFileCount = files.length,
): Record<string, unknown> => ({
  ...payload,
  attached_files: files,
  attachment_file_count: attachmentFileCount,
});

const withExpenseAttachmentVerification = (
  payload: Record<string, unknown>,
  files: Array<Record<string, unknown>>,
  expectedAttachmentFileIDs: string[],
  attachmentFileCount = files.length,
): Record<string, unknown> => {
  const expectedCount = expectedAttachmentFileIDs.length;
  if (expectedCount === 0) {
    return {
      ...withExpenseAttachedFiles(payload, files, attachmentFileCount),
      attachment_verification: {
        status: 'not_requested',
        verified: false,
        expected_uploaded_file_ids: expectedAttachmentFileIDs,
        attached_file_count: attachmentFileCount,
        message: 'No uploaded attachment file IDs were provided for verification.',
      },
    };
  }

  const ok = attachmentFileCount >= expectedCount;
  return {
    ...withExpenseAttachedFiles(payload, files, attachmentFileCount),
    attachment_verification: {
      status: ok ? 'verified' : 'mismatch',
      ok,
      mutation_succeeded: true,
      expected_uploaded_file_ids: expectedAttachmentFileIDs,
      attached_file_count: attachmentFileCount,
      ...(ok ? undefined : (
        { message: 'Sanka did not return enough attached file rows for the uploaded files.' }
      )),
    },
  };
};

const enrichExpenseWithAttachedFiles = async ({
  expensesClient,
  payload,
  expectedAttachmentFileIDs = [],
}: {
  expensesClient: unknown;
  payload: Record<string, unknown>;
  expectedAttachmentFileIDs?: string[];
}): Promise<Record<string, unknown>> => {
  const expenseID = readString(payload['id']) ?? readString(payload['expense_id']);
  if (!expenseID) {
    return payload;
  }

  const expensesWithFilesClient = expensesClient as ExpenseFilesClient;
  if (!expensesWithFilesClient.listFiles) {
    return expectedAttachmentFileIDs.length === 0 ?
        payload
      : {
          ...payload,
          attachment_verification: {
            status: 'unavailable',
            verified: false,
            mutation_succeeded: true,
            expected_uploaded_file_ids: expectedAttachmentFileIDs,
            message:
              'Expense was saved, but this Sanka SDK cannot verify attachments because listFiles is unavailable.',
          },
        };
  }

  try {
    const fileList = await expensesWithFilesClient.listFiles(
      expenseID,
      { page: 1, page_size: 100 },
      undefined,
    );
    const files = expenseAttachedFilesFromListPayload(fileList);
    const total = expenseFileCountFromListPayload(fileList, files);
    return expectedAttachmentFileIDs.length > 0 ?
        withExpenseAttachmentVerification(payload, files, expectedAttachmentFileIDs, total)
      : withExpenseAttachedFiles(payload, files, total);
  } catch (error) {
    return {
      ...payload,
      attachment_verification: {
        status: 'failed',
        verified: false,
        mutation_succeeded: true,
        expected_uploaded_file_ids: expectedAttachmentFileIDs,
        message:
          error instanceof Error ?
            `Expense was saved, but attachment verification failed: ${error.message}`
          : 'Expense was saved, but attachment verification failed.',
      },
    };
  }
};

const buildDealListParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  const rawLimit = readNumber(args?.['limit'], 10);
  const limit = Math.max(1, Math.min(100, rawLimit));

  return {
    limit,
    params: {
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildDealRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const caseID = readString(args?.['case_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);

  return {
    caseID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const readOptionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const buildPublicLineItems = (value: unknown): PublicLineItem[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map((entry) => {
      const record = readRecord(entry);
      if (!record) {
        return null;
      }

      const item: PublicLineItem = {};
      const itemID = readString(record['item_id'] ?? record['itemId'] ?? record['item'] ?? record['id']);
      const itemExternalID = readString(record['item_external_id'] ?? record['itemExternalId']);
      const itemName = readString(
        record['item_name'] ??
          record['itemName'] ??
          record['name'] ??
          record['custom_item_name'] ??
          record['customItemName'],
      );
      const quantity = readOptionalNumber(
        record['quantity'] ??
          record['qty'] ??
          record['amount_item'] ??
          record['amountItem'] ??
          record['amount'],
      );
      const unitPrice = readOptionalNumber(
        record['unit_price'] ??
          record['unitPrice'] ??
          record['amount_price'] ??
          record['amountPrice'] ??
          record['price'],
      );
      const taxRate = readOptionalNumber(record['tax_rate'] ?? record['taxRate']);
      const section = readString(record['section']);
      const sectionType = readString(record['section_type'] ?? record['sectionType']);
      const sectionPosition = readOptionalNumber(record['section_position'] ?? record['sectionPosition']);
      const lineItemProperties = readRecord(
        record['line_item_properties'] ??
          record['lineItemProperties'] ??
          record['custom_fields'] ??
          record['customFields'],
      );

      if (itemID) {
        item['item_id'] = itemID;
      }
      if (itemExternalID) {
        item['item_external_id'] = itemExternalID;
      }
      if (itemName) {
        item['item_name'] = itemName;
      }
      if (quantity !== undefined) {
        item['quantity'] = quantity;
      }
      if (unitPrice !== undefined) {
        item['unit_price'] = unitPrice;
      }
      if (taxRate !== undefined) {
        item['tax_rate'] = taxRate;
      }
      if (section) {
        item['section'] = section;
      }
      if (sectionType) {
        item['section_type'] = sectionType;
      }
      if (sectionPosition !== undefined) {
        item['section_position'] = sectionPosition;
      }
      if (lineItemProperties) {
        item['line_item_properties'] = lineItemProperties;
      }

      return Object.keys(item).length > 0 ? item : null;
    })
    .filter((entry): entry is PublicLineItem => Boolean(entry));

  return items.length > 0 ? items : undefined;
};

const assignPublicLineItems = (
  body: Record<string, unknown>,
  args: Record<string, unknown> | undefined,
  {
    targetKey = 'line_items',
    sourceKeys = ['line_items', 'lineItems'],
  }: { targetKey?: string; sourceKeys?: string[] } = {},
) => {
  const source = sourceKeys.map((key) => args?.[key]).find((candidate) => Array.isArray(candidate));
  const lineItems = buildPublicLineItems(source);
  if (lineItems) {
    body[targetKey] = lineItems;
  }
  return lineItems;
};

const buildDealMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'channel_id',
    'currency',
    'external_object_type',
    'name',
    'operation',
    'provider',
    'status',
    'target',
  ]);
  assignBooleanFields(body, args, ['confirm', 'dry_run']);

  const caseStatus = readString(args?.['case_status']);
  const companyExternalID = readString(args?.['company_external_id']);
  const companyID = readString(args?.['company_id']);
  const contactExternalID = readString(args?.['contact_external_id']);
  const contactID = readString(args?.['contact_id']);
  const externalID = readString(args?.['external_id']);

  if (caseStatus) {
    body['caseStatus'] = caseStatus;
  }
  if (companyExternalID) {
    body['companyExternalId'] = companyExternalID;
  }
  if (companyID) {
    body['companyId'] = companyID;
  }
  if (contactExternalID) {
    body['contactExternalId'] = contactExternalID;
  }
  if (contactID) {
    body['contactId'] = contactID;
  }
  if (externalID) {
    body['externalId'] = externalID;
  }
  assignPublicLineItems(body, args);
  const customFields = readRecord(args?.['custom_fields']);
  if (customFields) {
    body['custom_fields'] = customFields;
  }

  return body;
};

const buildDealUpdateParams = (args: Record<string, unknown> | undefined) => {
  const caseID = readString(args?.['case_id']);
  const lookupExternalID = readString(args?.['lookup_external_id']);

  return {
    caseID,
    params: {
      ...(lookupExternalID ? { external_id: lookupExternalID } : undefined),
      ...buildDealMutationBody(args),
    },
  };
};

const buildDealDeleteParams = (args: Record<string, unknown> | undefined) => {
  const caseID = readString(args?.['case_id']);
  const params: Record<string, unknown> = {};
  assignStringFields(params, args, [
    'channel_id',
    'external_id',
    'external_object_type',
    'operation',
    'provider',
    'target',
  ]);
  assignBooleanFields(params, args, ['confirm', 'dry_run']);

  return {
    caseID,
    params,
  };
};

const buildDealDetailSummary = (deal: Record<string, unknown>): string => {
  const name = readString(deal['name']);
  const stageLabel = readString(deal['stage_label']) || readString(deal['stage_key']);
  const pipelineName = readString(deal['pipeline_name']);

  if (name && stageLabel) {
    const pipelineSuffix = pipelineName ? ` in pipeline ${pipelineName}` : '';
    return `Loaded deal "${name}" at stage ${stageLabel}${pipelineSuffix}.`;
  }
  if (name) {
    return `Loaded deal "${name}".`;
  }
  return `Loaded deal ${readString(deal['id']) ?? ''}.`.trim();
};

const buildOrderLineItem = (value: unknown): OrderLineItem | null => {
  const record = readRecord(value);
  if (!record) {
    return null;
  }

  const item: OrderLineItem = {};
  assignStringFields(item, record, ['item_id']);

  const itemExternalID = readString(record['item_external_id']);
  if (itemExternalID) {
    item['itemExternalId'] = itemExternalID;
  }

  for (const key of ['price', 'tax', 'tax_rate'] as const) {
    const numericValue = record[key];
    if (typeof numericValue === 'number' && Number.isFinite(numericValue)) {
      item[key] = numericValue;
    }
  }

  const quantity = record['quantity'];
  if (typeof quantity === 'number' && Number.isInteger(quantity)) {
    item['quantity'] = quantity;
  }

  return Object.keys(item).length > 0 ? item : null;
};

const buildOrderBodyEntry = (value: unknown): OrderPayloadDraft | undefined => {
  const record = readRecord(value);
  if (!record) {
    return undefined;
  }

  const order: OrderPayloadDraft = {};
  const externalID = readString(record['external_id']);
  const companyExternalID = readString(record['company_external_id']);
  const companyID = readString(record['company_id']);
  const deliveryStatus = readString(record['delivery_status']);
  const orderAt = readString(record['order_at']);

  if (externalID) {
    order.externalId = externalID;
  }
  if (companyExternalID) {
    order.companyExternalId = companyExternalID;
  }
  if (companyID) {
    order.companyId = companyID;
  }
  if (deliveryStatus) {
    order.deliveryStatus = deliveryStatus;
  }
  if (orderAt) {
    order.orderAt = orderAt;
  }

  if (Array.isArray(record['items'])) {
    const items = record['items']
      .map((item) => buildOrderLineItem(item))
      .filter((item): item is OrderLineItem => Boolean(item));
    order.items = items;
  }

  const lineItems = buildPublicLineItems(record['line_items'] ?? record['lineItems']);
  if (lineItems) {
    order.line_items = lineItems;
  }

  return Object.keys(order).length > 0 ? order : undefined;
};

const buildOrderMutationBody = (args: Record<string, unknown> | undefined): OrderMutationPayloadDraft => {
  const body: OrderMutationPayloadDraft = {};
  const order = buildOrderBodyEntry(args?.['order']);
  if (order) {
    body.order = order;
  }

  const attachmentFilePayload = buildAttachmentFilePayload(args);
  if (attachmentFilePayload) {
    body.order = body.order || {};
    body.order.attachment_file = attachmentFilePayload;
  }

  const createMissingItems = readBoolean(args?.['create_missing_items']);
  const triggerWorkflows = readBoolean(args?.['trigger_workflows']);

  if (createMissingItems !== undefined) {
    body.createMissingItems = createMissingItems;
  }
  if (triggerWorkflows !== undefined) {
    body.triggerWorkflows = triggerWorkflows;
  }

  return body;
};

const buildOrderRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const orderID = readString(args?.['order_id']);
  const externalID = readString(args?.['external_id']);

  return {
    orderID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
    },
  };
};

const buildOrderDownloadPDFParams = (args: Record<string, unknown> | undefined) => {
  const orderID = readString(args?.['order_id']);
  const externalID = readString(args?.['external_id']);
  const templateSelect = readString(args?.['template_select']);
  const language = readDocumentPDFLanguage(args);

  return {
    orderID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(templateSelect ? { template_select: templateSelect } : undefined),
      ...(language ? { language } : undefined),
    },
  };
};

const buildOrderMutationSummary = (payload: Record<string, unknown>, action: 'created' | 'updated') => {
  const results = Array.isArray(payload['results']) ? payload['results'] : [];
  const firstResult = readRecord(results[0]);
  const reference =
    readString(firstResult?.['external_id']) ||
    readString(firstResult?.['order_id']) ||
    readString(payload['job_id']) ||
    'order';

  return `Order ${action}: ${reference}.`;
};

const buildLifecycleMutationSummary = ({
  entity,
  action,
  payload,
}: {
  entity: string;
  action: string;
  payload: Record<string, unknown>;
}): string => {
  const readReference = (value: unknown): string | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return readString(value);
  };
  const reference =
    readReference(payload['order_number']) ||
    readReference(payload['id_inv']) ||
    readString(payload['order_id']) ||
    readString(payload['invoice_id']) ||
    readString(payload['external_id']) ||
    entity;
  const usageStatus =
    readString(payload['usage_status_label']) ||
    readString(payload['usage_status']) ||
    readString(payload['status']);
  const statusText = usageStatus ? ` status=${usageStatus}` : '';
  return appendGovernanceAdvisorySummary(`${entity} ${action}: ${reference}.${statusText}`, payload);
};

const buildLifecycleVerification = async ({
  entity,
  id,
  params,
  expectedStatus,
  retrieve,
}: {
  entity: 'order' | 'invoice';
  id: string;
  params?: Record<string, unknown>;
  expectedStatus: string;
  retrieve: (id: string, params: Record<string, unknown>) => Promise<Record<string, unknown>>;
}): Promise<Record<string, unknown>> => {
  try {
    const record = await retrieve(id, params ?? {});
    const actualStatus =
      readString(record['usage_status']) ||
      readString(record['status_key']) ||
      readString(record['status']) ||
      null;
    return {
      entity,
      expected_status: expectedStatus,
      actual_status: actualStatus,
      matched: actualStatus === expectedStatus,
      record_id: readString(record['id']) || id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (expectedStatus === 'archived' && /\b404\b/.test(errorMessage)) {
      return {
        entity,
        expected_status: expectedStatus,
        actual_status: 'not_found',
        matched: true,
        record_id: id,
        verification_mode: 'not_found_after_archive',
      };
    }
    return {
      entity,
      expected_status: expectedStatus,
      actual_status: null,
      matched: false,
      error: errorMessage,
    };
  }
};

const buildPermanentDeleteVerification = async ({
  entity,
  id,
  retrieve,
}: {
  entity: 'order' | 'invoice';
  id: string;
  retrieve: (id: string) => Promise<Record<string, unknown>>;
}): Promise<Record<string, unknown>> => {
  try {
    const record = await retrieve(id);
    return {
      entity,
      expected_status: 'deleted',
      actual_status:
        readString(record['usage_status']) ||
        readString(record['status_key']) ||
        readString(record['status']) ||
        'found',
      matched: false,
      record_id: readString(record['id']) || id,
    };
  } catch (error) {
    return {
      entity,
      expected_status: 'deleted',
      actual_status: 'not_found',
      matched: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const buildFinancialDocumentMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'company_external_id',
    'company_id',
    'contact_external_id',
    'contact_id',
    'currency',
    'due_date',
    'external_id',
    'notes',
    'start_date',
    'status',
    'tax_option',
  ]);
  assignBooleanFields(body, args, ['tax_inclusive']);

  for (const key of ['tax_rate', 'total_price', 'total_price_without_tax'] as const) {
    const numericValue = args?.[key];
    if (typeof numericValue === 'number' && Number.isFinite(numericValue)) {
      body[key] = numericValue;
    }
  }
  assignPublicLineItems(body, args);
  const attachmentFilePayload = buildAttachmentFilePayload(args);
  if (attachmentFilePayload) {
    body['attachment_file'] = attachmentFilePayload;
  }
  assignPublicLineItems(body, args);

  return body;
};

const buildPurchaseOrderMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'company_external_id',
    'company_id',
    'contact_external_id',
    'contact_id',
    'currency',
    'date',
    'external_id',
    'notes',
    'status',
    'tax_option',
  ]);

  for (const key of ['tax_rate', 'total_price', 'total_price_without_tax'] as const) {
    const numericValue = args?.[key];
    if (typeof numericValue === 'number' && Number.isFinite(numericValue)) {
      body[key] = numericValue;
    }
  }
  assignPublicLineItems(body, args);
  const attachmentFilePayload = buildAttachmentFilePayload(args);
  if (attachmentFilePayload) {
    body['attachment_file'] = attachmentFilePayload;
  }
  assignPublicLineItems(body, args);

  return body;
};

const buildPurchaseOrderListParams = (args: Record<string, unknown> | undefined) =>
  buildEstimateInvoiceListParams(args);

const buildPurchaseOrderRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const purchaseOrderID = readString(args?.['purchase_order_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);

  return {
    purchaseOrderID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildPurchaseOrderDownloadPDFParams = (args: Record<string, unknown> | undefined) => {
  const purchaseOrderID = readString(args?.['purchase_order_id']);
  const externalID = readString(args?.['external_id']);
  const templateSelect = readString(args?.['template_select']);
  const language = readDocumentPDFLanguage(args);

  return {
    purchaseOrderID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(templateSelect ? { template_select: templateSelect } : undefined),
      ...(language ? { language } : undefined),
    },
  };
};

const buildSlipMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'company_external_id',
    'company_id',
    'contact_external_id',
    'contact_id',
    'currency',
    'external_id',
    'notes',
    'slip_type',
    'start_date',
    'status',
    'tax_option',
  ]);
  assignBooleanFields(body, args, ['tax_inclusive']);

  for (const key of ['tax_rate', 'total_price', 'total_price_without_tax'] as const) {
    const numericValue = args?.[key];
    if (typeof numericValue === 'number' && Number.isFinite(numericValue)) {
      body[key] = numericValue;
    }
  }
  assignPublicLineItems(body, args);

  return body;
};

const buildSlipListParams = (args: Record<string, unknown> | undefined) =>
  buildEstimateInvoiceListParams(args);

const buildSlipRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const slipID = readString(args?.['slip_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);

  return {
    slipID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildBillMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'company_external_id',
    'company_id',
    'contact_external_id',
    'contact_id',
    'currency',
    'description',
    'due_date',
    'external_id',
    'issued_date',
    'notes',
    'payment_date',
    'status',
    'tax_option',
  ]);
  assignBooleanFields(body, args, ['tax_inclusive']);

  for (const key of ['amount', 'amount_without_tax', 'tax_rate'] as const) {
    const numericValue = args?.[key];
    if (typeof numericValue === 'number' && Number.isFinite(numericValue)) {
      body[key] = numericValue;
    }
  }
  assignPublicLineItems(body, args);
  const attachmentFileIDs = readStringArray(args?.['attachment_file_ids']);
  if (attachmentFileIDs.length > 0) {
    body['attachment_file'] = {
      files: attachmentFileIDs.map((fileID) => ({ file_id: fileID })),
    };
  }

  return body;
};

const buildBillListParams = (args: Record<string, unknown> | undefined) =>
  buildEstimateInvoiceListParams(args);

const buildBillRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const billID = readString(args?.['bill_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);

  return {
    billID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildDisbursementMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'company_external_id',
    'company_id',
    'contact_external_id',
    'contact_id',
    'currency',
    'external_id',
    'notes',
    'start_date',
    'status',
    'tax_option',
  ]);
  assignBooleanFields(body, args, ['tax_inclusive']);

  for (const key of ['fee', 'tax_rate', 'total_price', 'total_price_without_tax'] as const) {
    const numericValue = args?.[key];
    if (typeof numericValue === 'number' && Number.isFinite(numericValue)) {
      body[key] = numericValue;
    }
  }
  assignPublicLineItems(body, args);

  return body;
};

const buildDisbursementListParams = (args: Record<string, unknown> | undefined) =>
  buildEstimateInvoiceListParams(args);

const buildDisbursementRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const disbursementID = readString(args?.['disbursement_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);

  return {
    disbursementID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildDisbursementAllocationQueryParams = (args: Record<string, unknown> | undefined) => {
  const disbursementID = readString(args?.['disbursement_id']);
  const allocationID = readString(args?.['allocation_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);

  return {
    disbursementID,
    allocationID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const readRecordIdentifier = (value: unknown) => {
  const stringValue = readString(value);
  if (stringValue) {
    return stringValue;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const buildDisbursementAllocationBody = (
  args: Record<string, unknown> | undefined,
  options: { partial?: boolean } = {},
) => {
  const body: Record<string, unknown> = {};
  for (const [sourceKey, targetKey] of [
    ['payable_type', 'payable_type'],
    ['payableType', 'payable_type'],
    ['payable_id', 'payable_id'],
    ['payableId', 'payable_id'],
    ['bill_id', 'bill_id'],
    ['billId', 'bill_id'],
    ['expense_id', 'expense_id'],
    ['expenseId', 'expense_id'],
    ['id_bill', 'id_bill'],
    ['idBill', 'id_bill'],
    ['id_pm', 'id_pm'],
    ['idPm', 'id_pm'],
    ['currency', 'currency'],
    ['source', 'source'],
    ['notes', 'notes'],
  ] as const) {
    const value = readRecordIdentifier(args?.[sourceKey]);
    if (value) {
      body[targetKey] = value;
    }
  }
  const amount = args?.['amount'];
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    body['amount'] = amount;
  } else if (!options.partial) {
    body['amount'] = amount;
  }
  return body;
};

const buildDisbursementAllocationsSummary = (
  payload: Record<string, unknown>,
  disbursementID: string,
  action: 'Loaded' | 'Created' | 'Updated' | 'Deleted',
) => {
  const disbursement = readRecord(payload['disbursement']);
  const allocations = Array.isArray(payload['allocations']) ? payload['allocations'] : [];
  const resolvedDisbursementID =
    readString(disbursement?.['id']) ??
    readString(disbursement?.['disbursement_id']) ??
    readRecordIdentifier(disbursement?.['id_dsb']) ??
    disbursementID;
  const allocatedAmount = disbursement?.['allocated_amount'];
  const unallocatedAmount = disbursement?.['unallocated_amount'];
  const totals =
    typeof allocatedAmount === 'number' || typeof unallocatedAmount === 'number' ?
      ` Allocated: ${typeof allocatedAmount === 'number' ? allocatedAmount : 0}; unallocated: ${
        typeof unallocatedAmount === 'number' ? unallocatedAmount : 0
      }.`
    : '';

  return `${action} ${allocations.length} disbursement payable allocation${
    allocations.length === 1 ? '' : 's'
  } for disbursement ${resolvedDisbursementID}.${totals}`;
};

const buildEstimateInvoiceListParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  const rawLimit = readNumber(args?.['limit'], 10);
  const limit = Math.max(1, Math.min(100, rawLimit));

  return {
    limit,
    params: {
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildOverdueInvoiceListParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const asOfDate = readString(args?.['as_of_date']);
  const language = readString(args?.['language']);
  const rawLimit = readNumber(args?.['limit'], 10);
  const limit = Math.max(1, Math.min(100, rawLimit));

  return {
    limit,
    params: {
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(asOfDate ? { as_of_date: asOfDate } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildJournalListParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  const viewID = readString(args?.['view_id']) ?? readString(args?.['view']);
  const search = readString(args?.['search']);
  const status = readString(args?.['status']);
  const rawLimit = readNumber(args?.['limit'], 25);
  const rawPage = readNumber(args?.['page'], 1);
  const limit = Math.max(1, Math.min(100, rawLimit));
  const page = Math.max(1, rawPage);

  return {
    limit,
    params: {
      ...(viewID ? { view_id: viewID } : undefined),
      ...(search ? { search } : undefined),
      ...(status ? { status } : undefined),
      page,
      page_size: limit,
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildJournalStatementViewCreateBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  const name = readString(args?.['name']) ?? readString(args?.['title']);
  const viewType = readString(args?.['view_type'] ?? args?.['viewType'] ?? args?.['statement_type']);
  const balanceSheetDisplay = readString(args?.['balance_sheet_display'] ?? args?.['balanceSheetDisplay']);
  const balanceSheetType = readString(args?.['balance_sheet_type'] ?? args?.['balanceSheetType']);
  const dateRange = readString(args?.['date_range'] ?? args?.['dateRange']);
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  const isPrivate = readBoolean(args?.['is_private'] ?? args?.['isPrivate'] ?? args?.['private']);
  const includePreview = readBoolean(args?.['include_preview'] ?? args?.['includePreview']);
  const rawLimit = readNumber(args?.['limit'], 25);
  const limit = Math.max(1, Math.min(100, rawLimit));

  if (name) body['name'] = name;
  if (viewType) body['view_type'] = viewType;
  if (isPrivate !== undefined) body['is_private'] = isPrivate;
  if (balanceSheetDisplay) body['balance_sheet_display'] = balanceSheetDisplay;
  if (balanceSheetType) body['balance_sheet_type'] = balanceSheetType;
  if (dateRange) body['date_range'] = dateRange;
  if (includePreview !== undefined) body['include_preview'] = includePreview;
  body['limit'] = limit;

  return {
    body,
    query: {
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildViewListParams = (args: Record<string, unknown> | undefined) => {
  const object = readString(args?.['object'] ?? args?.['object_type'] ?? args?.['target']);
  const customObjectID = readString(args?.['custom_object_id'] ?? args?.['customObjectId']);
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);

  return {
    object,
    params: {
      ...(object ? { object } : undefined),
      ...(customObjectID ? { custom_object_id: customObjectID } : undefined),
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildViewRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const viewID = readString(args?.['view_id']);
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  return {
    viewID,
    params: {
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildViewMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  const object = readString(args?.['object'] ?? args?.['object_type'] ?? args?.['target']);
  const customObjectID = readString(args?.['custom_object_id'] ?? args?.['customObjectId']);
  const name = readString(args?.['name'] ?? args?.['title']);
  const viewType = readString(args?.['view_type'] ?? args?.['viewType'] ?? args?.['view']);
  const sortOrderBy = readString(args?.['sort_order_by'] ?? args?.['sortOrderBy'] ?? args?.['order_by']);
  const sortOrderMethod = readString(
    args?.['sort_order_method'] ?? args?.['sortOrderMethod'] ?? args?.['sort_method'],
  );
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  const isPrivate = readBoolean(args?.['is_private'] ?? args?.['isPrivate'] ?? args?.['private']);
  const columns = readStringArray(args?.['columns']);
  const filters =
    Array.isArray(args?.['filters']) ?
      (args?.['filters'] as unknown[])
        .map((entry) => readRecord(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    : [];
  const formData = readRecord(args?.['form_data'] ?? args?.['formData']);
  const pagination = args?.['pagination'];

  if (object) {
    body['object'] = object;
    body['object_type'] = object;
  }
  if (customObjectID) body['custom_object_id'] = customObjectID;
  if (name) {
    body['name'] = name;
    body['title'] = name;
  }
  if (viewType) {
    body['view_type'] = viewType;
    body['mode'] = viewType === 'list' ? 'table' : viewType;
  }
  if (columns.length > 0) {
    body['columns'] = columns;
    body['column_field_ids'] = columns;
  }
  if (typeof pagination === 'number' && Number.isInteger(pagination)) body['pagination'] = pagination;
  if (isPrivate !== undefined) {
    body['is_private'] = isPrivate;
    body['visibility'] = isPrivate ? 'private' : 'workspace';
  }
  if (sortOrderBy) body['sort_order_by'] = sortOrderBy;
  if (sortOrderMethod) body['sort_order_method'] = sortOrderMethod;
  if (filters.length > 0) body['filters'] = filters;
  if (formData) body['form_data'] = formData;

  return {
    body,
    query: {
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildReportListParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const rawLimit = readNumber(args?.['limit'], 10);
  const rawPage = readNumber(args?.['page'], 1);
  return {
    limit: Math.max(1, Math.min(100, rawLimit)),
    params: {
      page: Math.max(1, rawPage),
      limit: Math.max(1, Math.min(100, rawLimit)),
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
    },
  };
};

const buildReportRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const reportID = readString(args?.['report_id']);
  const workspaceID = readString(args?.['workspace_id']);
  return {
    reportID,
    params: {
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
    },
  };
};

const buildReportMutationBody = (
  args: Record<string, unknown> | undefined,
  options: { defaultCreateDefaultPanel?: boolean } = {},
) => {
  const explicitMetadata = readRecord(args?.['report_metadata'] ?? args?.['reportMetadata']);
  const name = readString(args?.['name']);
  const description = readString(args?.['description']);
  const reportType = readString(args?.['report_type'] ?? args?.['reportType']);
  const reportFormat = readString(args?.['report_format'] ?? args?.['reportFormat']);
  const reportFilters = readRecord(args?.['report_filters'] ?? args?.['reportFilters']);
  const createDefaultPanel = readBoolean(args?.['create_default_panel'] ?? args?.['createDefaultPanel']);
  const panels =
    Array.isArray(args?.['panels']) ?
      (args?.['panels'] as unknown[])
        .map((entry) => readRecord(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    : undefined;

  const reportMetadata: Record<string, unknown> = explicitMetadata ? { ...explicitMetadata } : {};
  if (name) reportMetadata['name'] = name;
  if (description) reportMetadata['description'] = description;
  if (reportType) reportMetadata['reportType'] = { type: reportType };
  if (reportFormat) reportMetadata['reportFormat'] = reportFormat;
  if (reportFilters) reportMetadata['reportFilters'] = reportFilters;

  const body: Record<string, unknown> = {};
  if (Object.keys(reportMetadata).length > 0) body['reportMetadata'] = reportMetadata;
  if (panels) body['panels'] = panels;
  if (createDefaultPanel !== undefined) {
    body['createDefaultPanel'] = createDefaultPanel;
  } else if (options.defaultCreateDefaultPanel !== undefined) {
    body['createDefaultPanel'] = options.defaultCreateDefaultPanel;
  }

  return body;
};

const buildEstimateRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const estimateID = readString(args?.['estimate_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);

  return {
    estimateID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildEstimateDownloadPDFParams = (args: Record<string, unknown> | undefined) => {
  const estimateID = readString(args?.['estimate_id']);
  const externalID = readString(args?.['external_id']);
  const templateSelect = readString(args?.['template_select']);
  const language = readDocumentPDFLanguage(args);

  return {
    estimateID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(templateSelect ? { template_select: templateSelect } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildInvoiceRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const invoiceID = readString(args?.['invoice_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);

  return {
    invoiceID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildInvoiceDownloadPDFParams = (args: Record<string, unknown> | undefined) => {
  const invoiceID = readString(args?.['invoice_id']);
  const externalID = readString(args?.['external_id']);
  const templateSelect = readString(args?.['template_select']);
  const language = readDocumentPDFLanguage(args);

  return {
    invoiceID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(templateSelect ? { template_select: templateSelect } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildInvoiceEmailBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  const invoiceID = readString(args?.['invoice_id'] ?? args?.['invoiceId']);
  const action = readString(args?.['action']);
  const to = readStringArray(args?.['to'] ?? args?.['recipients'] ?? args?.['recipient_emails']);
  const cc = readStringArray(args?.['cc']);
  const subject = readString(args?.['subject']);
  const messageBody = readString(args?.['body']);
  const scheduledAt = readString(args?.['scheduled_at'] ?? args?.['schedule_at'] ?? args?.['scheduledAt']);
  const templateSelect = readString(args?.['template_select']);
  const additionalPdfAttachmentsRaw =
    args?.['additional_pdf_attachments'] ??
    args?.['additionalPdfAttachments'] ??
    args?.['attachment_templates'];
  const channelID = readString(args?.['channel_id'] ?? args?.['smtp_channel_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);
  const additionalPdfAttachments =
    Array.isArray(additionalPdfAttachmentsRaw) ?
      additionalPdfAttachmentsRaw
        .map((item) => readRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => {
          const attachment: Record<string, unknown> = {};
          assignStringFields(attachment, item, ['template_select', 'object_type', 'record_id', 'filename']);
          const objectType = readString(attachment['object_type']) ?? 'invoices';
          attachment['object_type'] = objectType;
          const normalizedObjectType = objectType.toLowerCase().replace(/-/g, '_');
          if (
            invoiceID &&
            !readString(attachment['record_id']) &&
            ['invoice', 'invoices'].includes(normalizedObjectType)
          ) {
            attachment['record_id'] = invoiceID;
          }
          return attachment;
        })
        .filter((item) => Object.keys(item).length > 0)
    : [];

  if (action) body['action'] = action;
  if (to.length > 0) body['to'] = to;
  if (cc.length > 0) body['cc'] = cc;
  if (subject) body['subject'] = subject;
  if (messageBody) body['body'] = messageBody;
  if (scheduledAt) body['scheduled_at'] = scheduledAt;
  if (templateSelect) body['template_select'] = templateSelect;
  if (additionalPdfAttachments.length > 0) body['additional_pdf_attachments'] = additionalPdfAttachments;
  if (channelID) body['channel_id'] = channelID;
  if (externalID) body['external_id'] = externalID;

  return {
    body,
    query: {
      ...(language ? { language } : undefined),
    },
  };
};

const buildInvoiceEmailSummary = (payload: Record<string, unknown>) => {
  const status = readString(payload['status']) ?? 'sent';
  const invoiceID = readString(payload['invoice_id']);
  const invoiceNumber = typeof payload['id_inv'] === 'number' ? payload['id_inv'] : undefined;
  const invoiceLabel =
    invoiceNumber !== undefined ? `Invoice No. ${invoiceNumber}`
    : invoiceID ? `invoice ${invoiceID}`
    : 'invoice';
  const threadIDs = readStringArray(payload['message_thread_ids']);
  const scheduledAt = readString(payload['scheduled_at']);
  if (status === 'scheduled') {
    return `Scheduled ${invoiceLabel} email${scheduledAt ? ` for ${scheduledAt}` : ''}. Message threads: ${
      threadIDs.length
    }.`;
  }
  if (status === 'draft') {
    return `Created draft ${invoiceLabel} email. Message threads: ${threadIDs.length}.`;
  }
  return `Sent ${invoiceLabel} email. Message threads: ${threadIDs.length}.`;
};

const buildPaymentDownloadPDFParams = (args: Record<string, unknown> | undefined) => {
  const paymentID = readString(args?.['payment_id']);
  const externalID = readString(args?.['external_id']);
  const templateSelect = readString(args?.['template_select']);
  const language = readDocumentPDFLanguage(args);

  return {
    paymentID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(templateSelect ? { template_select: templateSelect } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildSlipDownloadPDFParams = (args: Record<string, unknown> | undefined) => {
  const slipID = readString(args?.['slip_id']);
  const externalID = readString(args?.['external_id']);
  const templateSelect = readString(args?.['template_select']);
  const language = readDocumentPDFLanguage(args);

  return {
    slipID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(templateSelect ? { template_select: templateSelect } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildTicketListParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const rawLimit = readNumber(args?.['limit'], 10);
  const limit = Math.max(1, Math.min(100, rawLimit));

  return {
    limit,
    params: {
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
    },
  };
};

const buildTicketRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const ticketID = readString(args?.['ticket_id']);
  const externalID = readString(args?.['external_id']);
  const workspaceID = readString(args?.['workspace_id']);

  return {
    ticketID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
    },
  };
};

const buildTicketMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'description',
    'first_response_due_at',
    'owner_id',
    'priority',
    'resolution_due_at',
    'stage_key',
    'status',
    'title',
    'visibility',
  ]);

  const externalID = readString(args?.['external_id']);
  const dealIDs = readStringArray(args?.['deal_ids']);

  if (externalID) {
    body['body_external_id'] = externalID;
  }
  if (dealIDs.length > 0) {
    body['deal_ids'] = dealIDs;
  }

  return body;
};

const buildTicketUpdateParams = (args: Record<string, unknown> | undefined) => {
  const ticketID = readString(args?.['ticket_id']);
  const lookupExternalID = readString(args?.['lookup_external_id']);

  return {
    ticketID,
    params: {
      ...(lookupExternalID ? { external_id: lookupExternalID } : undefined),
      ...buildTicketMutationBody(args),
    },
  };
};

const buildTicketUpdateStatusParams = (args: Record<string, unknown> | undefined) => {
  const ticketID = readString(args?.['ticket_id']);
  const lookupExternalID = readString(args?.['lookup_external_id']);
  const stageKey = readString(args?.['stage_key']);
  const status = readString(args?.['status']);
  const language = readString(args?.['language']);

  return {
    ticketID,
    params: {
      ...(lookupExternalID ? { external_id: lookupExternalID } : undefined),
      ...(stageKey ? { stage_key: stageKey } : undefined),
      ...(status ? { status } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildTicketDetailSummary = (ticket: Record<string, unknown>): string => {
  const title = readString(ticket['title']);
  const stageKey = readString(ticket['stage_key']);
  const status = readString(ticket['status']);

  if (title && stageKey) {
    const statusSuffix = status ? ` with status ${status}` : '';
    return `Loaded ticket "${title}" in stage ${stageKey}${statusSuffix}.`;
  }
  if (title) {
    return `Loaded ticket "${title}".`;
  }
  return `Loaded ticket ${readString(ticket['id']) ?? ''}.`.trim();
};

const buildCalendarBootstrapParams = (args: Record<string, unknown> | undefined) => {
  const attendanceID = readString(args?.['attendance_id']);
  const mode = readString(args?.['mode']);
  const slug = readString(args?.['slug']);
  const url = readString(args?.['url']);

  return {
    ...(attendanceID ? { attendance_id: attendanceID } : undefined),
    ...(mode ? { mode } : undefined),
    ...(slug ? { slug } : undefined),
    ...(url ? { url } : undefined),
  };
};

const buildCalendarAvailabilityParams = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['event_id', 'start_date', 'timezone']);
  assignIntegerFields(body, args, ['days']);
  return body;
};

const buildCalendarAttendanceBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['comment', 'date', 'email', 'event_id', 'name', 'time', 'timezone']);
  return body;
};

const buildCalendarAttendanceRescheduleParams = (args: Record<string, unknown> | undefined) => {
  const attendanceID = readString(args?.['attendance_id']);
  const params: Record<string, unknown> = {};
  assignStringFields(params, args, ['comment', 'date', 'email', 'name', 'time', 'timezone']);

  return {
    attendanceID,
    params,
  };
};

const buildCalendarBootstrapSummary = (payload: Record<string, unknown>): string => {
  const event = readRecord(payload['event']);
  const attendance = readRecord(payload['attendance']);
  const title = readString(event?.['title']);
  const attendanceID = readString(attendance?.['id']);

  if (title) {
    return `Loaded calendar booking context for "${title}".`;
  }
  if (attendanceID) {
    return `Loaded calendar attendance ${attendanceID}.`;
  }
  return 'Loaded calendar booking context.';
};

const buildCalendarAvailabilitySummary = (payload: Record<string, unknown>): string => {
  const days = Array.isArray(payload['days']) ? payload['days'] : [];
  const slotCount = days.reduce((total, day) => {
    const record = readRecord(day);
    return total + (Array.isArray(record?.['slots']) ? record['slots'].length : 0);
  }, 0);
  const timezone = readString(payload['timezone']);

  return `Loaded ${slotCount} available calendar slots across ${days.length} day${
    days.length === 1 ? '' : 's'
  }${timezone ? ` in ${timezone}` : ''}.`;
};

const buildCalendarMutationSummary = (payload: Record<string, unknown>): string => {
  const message = readString(payload['message']);
  const attendance = readRecord(payload['attendance']);
  const attendanceID = readString(attendance?.['id']);

  if (message) {
    return message;
  }
  if (attendanceID) {
    return `Updated calendar attendance ${attendanceID}.`;
  }
  return 'Updated calendar attendance.';
};

const buildPropertyListParams = (args: Record<string, unknown> | undefined) => {
  const objectName = readString(args?.['object_name']);
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  const customOnly = readBoolean(args?.['custom_only']);
  const customObjectID = readString(args?.['custom_object_id'] ?? args?.['customObjectId']);
  const customObjectSlug = readString(
    args?.['custom_object_slug'] ??
      args?.['customObjectSlug'] ??
      args?.['custom_object'] ??
      args?.['customObject'],
  );
  const scope = readIntegrationScope(args?.['scope'] ?? args?.['source']);
  const provider = readIntegrationProvider(args?.['provider']);
  const channelID = readString(args?.['channel_id'] ?? args?.['channelId']);
  const externalObjectType = readString(args?.['external_object_type'] ?? args?.['externalObjectType']);
  const search = readString(args?.['search']);
  const rawLimit = readNumber(args?.['limit'], 25);
  const limit = Math.max(1, Math.min(100, rawLimit));

  return {
    objectName,
    limit,
    params: {
      ...(customOnly !== undefined ? { custom_only: customOnly } : undefined),
      ...(customObjectID ? { custom_object_id: customObjectID } : undefined),
      ...(customObjectSlug ? { custom_object_slug: customObjectSlug } : undefined),
      ...(scope ? { scope } : undefined),
      ...(provider ? { provider } : undefined),
      ...(channelID ? { channel_id: channelID } : undefined),
      ...(externalObjectType ? { external_object_type: externalObjectType } : undefined),
      ...(search ? { search } : undefined),
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildPropertyRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const objectName = readString(args?.['object_name']);
  const propertyRef = readString(args?.['property_ref']);
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  const customObjectID = readString(args?.['custom_object_id'] ?? args?.['customObjectId']);
  const customObjectSlug = readString(
    args?.['custom_object_slug'] ??
      args?.['customObjectSlug'] ??
      args?.['custom_object'] ??
      args?.['customObject'],
  );
  const scope = readIntegrationScope(args?.['scope'] ?? args?.['source']);
  const provider = readIntegrationProvider(args?.['provider']);
  const channelID = readString(args?.['channel_id'] ?? args?.['channelId']);
  const externalObjectType = readString(args?.['external_object_type'] ?? args?.['externalObjectType']);

  return {
    objectName,
    propertyRef,
    params: {
      ...(objectName ? { object_name: objectName } : undefined),
      ...(customObjectID ? { custom_object_id: customObjectID } : undefined),
      ...(customObjectSlug ? { custom_object_slug: customObjectSlug } : undefined),
      ...(scope ? { scope } : undefined),
      ...(provider ? { provider } : undefined),
      ...(channelID ? { channel_id: channelID } : undefined),
      ...(externalObjectType ? { external_object_type: externalObjectType } : undefined),
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildPropertyMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'badge_color',
    'channel_id',
    'description',
    'external_id',
    'external_object_type',
    'field_type',
    'group_name',
    'internal_name',
    'name',
    'number_format',
    'provider',
    'scope',
    'source',
    'target',
    'type',
  ]);
  assignBooleanFields(body, args, [
    'confirm',
    'dry_run',
    'multiple_select',
    'required_field',
    'show_badge',
    'unique',
  ]);
  assignIntegerFields(body, args, ['order']);

  const choiceValues = args?.['choice_values'];
  const conditionalChoiceMapping = readRecord(args?.['conditional_choice_mapping']);
  const tagValues = args?.['tag_values'];
  const options = args?.['options'];
  const customObjectID = readString(args?.['custom_object_id'] ?? args?.['customObjectId']);
  const customObjectSlug = readString(
    args?.['custom_object_slug'] ??
      args?.['customObjectSlug'] ??
      args?.['custom_object'] ??
      args?.['customObject'],
  );

  if (customObjectID) {
    body['custom_object_id'] = customObjectID;
  }
  if (customObjectSlug) {
    body['custom_object_slug'] = customObjectSlug;
  }

  if (Array.isArray(choiceValues)) {
    body['choice_values'] = readStringArray(choiceValues);
  } else {
    const choiceValueRecord = readRecord(choiceValues);
    if (choiceValueRecord) {
      body['choice_values'] = choiceValueRecord;
    }
  }

  if (conditionalChoiceMapping) {
    body['conditional_choice_mapping'] = conditionalChoiceMapping;
  }

  if (Array.isArray(tagValues)) {
    body['tag_values'] = readStringArray(tagValues);
  }

  if (Array.isArray(options)) {
    body['options'] = options
      .map((option) => readRecord(option))
      .filter((option): option is Record<string, unknown> => Boolean(option));
  }

  const scope = readLowerString(body['scope'] ?? body['source']);
  if (scope === 'integration' && !readString(body['target'])) {
    body['target'] = 'integration';
  }

  return body;
};

const validateAndNormalizePropertyMutationRouting = (params: Record<string, unknown>): string | undefined => {
  const target = readString(params['target']);
  const providerRaw = readString(params['provider']);
  const provider = readIntegrationProvider(providerRaw);

  if (target && target !== 'sanka' && target !== 'integration' && target !== 'both') {
    return '`target` must be "sanka", "integration", or "both".';
  }
  if (providerRaw && !provider) {
    return '`provider` must be "hubspot" or "salesforce" for property mutations.';
  }
  if (provider === 'freee' || provider === 'moneyforward') {
    return '`provider` must be "hubspot" or "salesforce" for property mutations.';
  }
  if (provider) {
    params['provider'] = provider;
    if (!target) {
      params['target'] = 'integration';
      return undefined;
    }
    if (target === 'sanka') {
      return '`provider` cannot be used with target="sanka"; omit `provider` for Sanka custom properties or use target="integration"/"both".';
    }
  }
  if (!provider && (target === 'integration' || target === 'both')) {
    return '`provider` is required when target is "integration" or "both".';
  }
  return undefined;
};

const buildPropertyDeleteParams = (args: Record<string, unknown> | undefined) => {
  const objectName = readString(args?.['object_name']);
  const propertyRef = readString(args?.['property_ref']);
  const customObjectID = readString(args?.['custom_object_id'] ?? args?.['customObjectId']);
  const customObjectSlug = readString(
    args?.['custom_object_slug'] ??
      args?.['customObjectSlug'] ??
      args?.['custom_object'] ??
      args?.['customObject'],
  );
  const scope = readLowerString(args?.['scope'] ?? args?.['source']);
  const target = readString(args?.['target']) ?? (scope === 'integration' ? 'integration' : undefined);
  const provider = readIntegrationProvider(args?.['provider']);
  const channelID = readString(args?.['channel_id'] ?? args?.['channelId']);
  const externalObjectType = readString(args?.['external_object_type'] ?? args?.['externalObjectType']);
  const dryRun = readBoolean(args?.['dry_run']);
  const confirm = readBoolean(args?.['confirm']);

  return {
    objectName,
    propertyRef,
    params: {
      ...(objectName ? { object_name: objectName } : undefined),
      ...(customObjectID ? { custom_object_id: customObjectID } : undefined),
      ...(customObjectSlug ? { custom_object_slug: customObjectSlug } : undefined),
      ...(target ? { target } : undefined),
      ...(provider ? { provider } : undefined),
      ...(channelID ? { channel_id: channelID } : undefined),
      ...(externalObjectType ? { external_object_type: externalObjectType } : undefined),
      ...(dryRun !== undefined ? { dry_run: dryRun } : undefined),
      ...(confirm !== undefined ? { confirm } : undefined),
    },
  };
};

const readArrayPayload = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) {
    return payload.map((row) => readRecord(row) ?? {}).filter(Boolean);
  }
  return readDataArray(readRecord(payload) ?? {});
};

const readRuleObjectName = (args: Record<string, unknown> | undefined): string | undefined =>
  readString(args?.['object']) ?? readString(args?.['object_name']) ?? readString(args?.['object_type']);

const buildRuleSettingsQuery = (args: Record<string, unknown> | undefined) => {
  const objectName = readRuleObjectName(args);
  const params: Record<string, unknown> = {};
  if (objectName) {
    params['object'] = objectName;
  }
  assignStringFields(params, args, ['workspace_id', 'language']);
  return { objectName, params };
};

const buildRuleSettingsOptionsQuery = (
  args: Record<string, unknown> | undefined,
  extraKeys: readonly string[] = [],
) => {
  const { objectName, params } = buildRuleSettingsQuery(args);
  assignStringFields(params, args, ['rule_id', ...extraKeys]);
  return { objectName, params };
};

const buildApprovalRuleBody = (args: Record<string, unknown> | undefined) => {
  const objectName = readRuleObjectName(args);
  const body: Record<string, unknown> = {};
  if (objectName) {
    body['object'] = objectName;
  }
  assignStringFields(body, args, ['rule_id', 'name', 'description', 'language', 'worker_scope_type']);
  assignBooleanFields(body, args, ['is_active', 'block_save']);
  assignIntegerFields(body, args, ['order']);

  const conditions = readRecord(args?.['conditions']);
  if (conditions) {
    body['conditions'] = conditions;
  }
  const blockTargets = readStringArray(args?.['block_targets']);
  if (blockTargets.length > 0) {
    body['block_targets'] = blockTargets;
  }
  const approverUserIDs = readStringArray(args?.['approver_user_ids']);
  if (approverUserIDs.length > 0) {
    body['approver_user_ids'] = approverUserIDs;
  }
  const workerIDs = readStringArray(args?.['worker_ids']);
  if (workerIDs.length > 0) {
    body['worker_ids'] = workerIDs;
  }
  return { objectName, body };
};

const buildApprovalRequestBody = (args: Record<string, unknown> | undefined) => {
  const objectName = readRuleObjectName(args);
  const body: Record<string, unknown> = {};
  if (objectName) {
    body['object'] = objectName;
  }
  const recordID = readString(args?.['record_id'] ?? args?.['recordId']);
  if (recordID) {
    body['record_id'] = recordID;
  }
  assignStringFields(body, args, ['title', 'description', 'requested_action', 'idempotency_key', 'language']);
  const approverUserIDs = readStringArray(args?.['approver_user_ids']);
  if (approverUserIDs.length > 0) {
    body['approver_user_ids'] = approverUserIDs;
  }
  const blockTargets = readStringArray(args?.['block_targets']);
  if (blockTargets.length > 0) {
    body['block_targets'] = blockTargets;
  }
  return { objectName, recordID, body };
};

const buildRecordApprovalsQuery = (args: Record<string, unknown> | undefined) => {
  const { objectName, params } = buildRuleSettingsQuery(args);
  const recordID = readString(args?.['record_id'] ?? args?.['recordId']);
  if (recordID) {
    params['record_id'] = recordID;
  }
  return { objectName, recordID, params };
};

const buildApprovalMutationQuery = (args: Record<string, unknown> | undefined) => {
  const params: Record<string, unknown> = {};
  assignStringFields(params, args, ['workspace_id']);
  return params;
};

const buildLockRuleBody = (args: Record<string, unknown> | undefined) => {
  const objectName = readRuleObjectName(args);
  const body: Record<string, unknown> = {};
  if (objectName) {
    body['object'] = objectName;
  }
  assignStringFields(body, args, ['rule_id', 'name', 'description', 'language', 'lock_scope']);
  assignBooleanFields(body, args, ['is_active']);
  assignIntegerFields(body, args, ['order']);

  const conditions = readRecord(args?.['conditions']);
  if (conditions) {
    body['conditions'] = conditions;
  }
  const lockConfig = readRecord(args?.['lock_config']);
  if (lockConfig) {
    body['lock_config'] = lockConfig;
  }
  return { objectName, body };
};

const buildDeliveryRuleBody = (args: Record<string, unknown> | undefined) => {
  const objectName = readRuleObjectName(args);
  const body: Record<string, unknown> = {};
  if (objectName) {
    body['object'] = objectName;
  }
  assignStringFields(body, args, ['rule_id', 'action', 'name', 'description', 'language']);
  assignBooleanFields(body, args, ['is_active']);
  assignIntegerFields(body, args, ['order']);

  const conditions = readRecord(args?.['conditions']);
  if (conditions) {
    body['conditions'] = conditions;
  }
  const requiredFields = readStringArray(args?.['required_fields']);
  if (requiredFields.length > 0) {
    body['required_fields'] = requiredFields;
  }
  return { objectName, body };
};

const unwrapRuleSettingsEnvelope = (payload: Record<string, unknown>): Record<string, unknown> =>
  readRecord(payload['data']) ?? payload;

const ruleRowsFromPayload = (payload: Record<string, unknown>): Array<Record<string, unknown>> => {
  const data = unwrapRuleSettingsEnvelope(payload);
  const rules = data['rules'];
  return Array.isArray(rules) ? rules.map((row) => readRecord(row) ?? {}).filter(Boolean) : [];
};

const buildRuleSettingsListResult = ({
  label,
  payload,
  limit,
}: {
  label: string;
  payload: Record<string, unknown>;
  limit: number;
}): ToolCallResult => {
  const data = unwrapRuleSettingsEnvelope(payload);
  const rows = ruleRowsFromPayload(payload).slice(0, limit);
  return buildListResult({
    label,
    payload: {
      count: rows.length,
      data: rows,
      message: readString(data['message']) ?? `Returned ${rows.length} ${label}.`,
      page: 1,
      total: ruleRowsFromPayload(payload).length,
    },
    previewKeys: ['name', 'action', 'summary', 'id'],
  });
};

const buildRuleSettingsDetailResult = (label: string, payload: Record<string, unknown>): ToolCallResult => {
  const data = unwrapRuleSettingsEnvelope(payload);
  return {
    content: [
      {
        type: 'text',
        text: `Loaded ${label}.`,
      },
    ],
    structuredContent: data,
  };
};

const buildRuleSettingsMutationResult = (
  label: string,
  action: 'created' | 'updated' | 'deleted',
  payload: Record<string, unknown>,
): ToolCallResult => {
  const data = unwrapRuleSettingsEnvelope(payload);
  return {
    content: [
      {
        type: 'text',
        text: buildEntityMutationSummary({
          entity: label,
          action,
          payload: readRecord(data['rule']) ?? data,
          idKeys: ['id'],
        }),
      },
    ],
    structuredContent: data,
  };
};

const unwrapApprovalRequestEnvelope = (payload: Record<string, unknown>): Record<string, unknown> =>
  readRecord(payload['data']) ?? payload;

const approvalRequestRowsFromPayload = (payload: Record<string, unknown>): Array<Record<string, unknown>> => {
  const data = unwrapApprovalRequestEnvelope(payload);
  const rows = data['approvalRequests'];
  return Array.isArray(rows) ? rows.map((row) => readRecord(row) ?? {}).filter(Boolean) : [];
};

const buildRecordApprovalsListResult = (payload: Record<string, unknown>, limit: number): ToolCallResult => {
  const data = unwrapApprovalRequestEnvelope(payload);
  const rows = approvalRequestRowsFromPayload(payload).slice(0, limit);
  return buildListResult({
    label: 'record approvals',
    payload: {
      count: rows.length,
      data: rows,
      message: readString(data['message']) ?? `Returned ${rows.length} record approvals.`,
      page: 1,
      total: approvalRequestRowsFromPayload(payload).length,
      hasBlockingPending: Boolean(data['hasBlockingPending']),
      rules: Array.isArray(data['rules']) ? data['rules'] : [],
    },
    previewKeys: ['title', 'status', 'source', 'historyId'],
  });
};

const buildApprovalRequestMutationResult = (
  action: 'created' | 'approved' | 'rejected',
  payload: Record<string, unknown>,
): ToolCallResult => {
  const data = unwrapApprovalRequestEnvelope(payload);
  const approvalRequest = readRecord(data['approvalRequest']) ?? data;
  const title = readString(approvalRequest['title']) ?? readString(data['historyId']) ?? 'approval request';
  return {
    content: [
      {
        type: 'text',
        text: `Approval request ${action}: ${title}.`,
      },
    ],
    structuredContent: data,
  };
};

const createRuleSettingsListTool = ({
  name,
  title,
  description,
  path,
  resource,
  inputSchema,
  label,
}: {
  name: string;
  title: string;
  description: string;
  path: string;
  resource: string;
  inputSchema: NonNullable<McpTool['tool']['inputSchema']>;
  label: string;
}): McpTool => ({
  metadata: {
    resource,
    operation: 'read',
    tags: ['crm', 'rules', resource],
    httpMethod: 'get',
    httpPath: path,
    operationId: `public.${resource}.list`,
  },
  tool: {
    name,
    title,
    description,
    inputSchema,
    outputSchema: RULE_SETTINGS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title,
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: title });
    if (authError) {
      return authError;
    }
    const { objectName, params } = buildRuleSettingsQuery(args);
    if (!objectName) {
      return asErrorResult('`object` is required.');
    }
    const limit = Math.max(1, Math.min(100, readNumber(args?.['limit'], 25)));
    const payload = (await reqContext.client.get(path, { query: params })) as Record<string, unknown>;
    return buildRuleSettingsListResult({ label, payload, limit });
  },
});

const createRuleSettingsOptionsTool = ({
  name,
  title,
  description,
  path,
  resource,
  inputSchema,
  label,
  extraQueryKeys = [],
}: {
  name: string;
  title: string;
  description: string;
  path: string;
  resource: string;
  inputSchema: NonNullable<McpTool['tool']['inputSchema']>;
  label: string;
  extraQueryKeys?: readonly string[];
}): McpTool => ({
  metadata: {
    resource,
    operation: 'read',
    tags: ['crm', 'rules', resource],
    httpMethod: 'get',
    httpPath: `${path}/options`,
    operationId: `public.${resource}.options`,
  },
  tool: {
    name,
    title,
    description,
    inputSchema,
    outputSchema: RULE_SETTINGS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title,
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: title });
    if (authError) {
      return authError;
    }
    const { objectName, params } = buildRuleSettingsOptionsQuery(args, extraQueryKeys);
    if (!objectName) {
      return asErrorResult('`object` is required.');
    }
    const payload = (await reqContext.client.get(`${path}/options`, { query: params })) as Record<
      string,
      unknown
    >;
    return buildRuleSettingsDetailResult(label, payload);
  },
});

const createRuleSettingsUpsertTool = ({
  name,
  title,
  description,
  path,
  resource,
  inputSchema,
  label,
  buildBody,
}: {
  name: string;
  title: string;
  description: string;
  path: string;
  resource: string;
  inputSchema: NonNullable<McpTool['tool']['inputSchema']>;
  label: string;
  buildBody: (args: Record<string, unknown> | undefined) => {
    objectName: string | undefined;
    body: Record<string, unknown>;
  };
}): McpTool => ({
  metadata: {
    resource,
    operation: 'write',
    tags: ['crm', 'rules', resource],
    httpMethod: 'post',
    httpPath: path,
    operationId: `public.${resource}.upsert`,
  },
  tool: {
    name,
    title,
    description,
    inputSchema,
    outputSchema: RULE_SETTINGS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title,
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: title });
    if (authError) {
      return authError;
    }
    const { objectName, body } = buildBody(args);
    if (!objectName) {
      return asErrorResult('`object` is required.');
    }
    if (!readString(body['name'])) {
      return asErrorResult('`name` is required.');
    }
    const response = (await reqContext.client.post(path, { body })) as Record<string, unknown>;
    return buildRuleSettingsMutationResult(
      label,
      readString(body['rule_id']) ? 'updated' : 'created',
      response,
    );
  },
});

const createRuleSettingsDeleteTool = ({
  name,
  title,
  description,
  path,
  resource,
  label,
}: {
  name: string;
  title: string;
  description: string;
  path: string;
  resource: string;
  label: string;
}): McpTool => ({
  metadata: {
    resource,
    operation: 'write',
    tags: ['crm', 'rules', resource],
    httpMethod: 'delete',
    httpPath: `${path}/{rule_id}`,
    operationId: `public.${resource}.delete`,
  },
  tool: {
    name,
    title,
    description,
    inputSchema: RULE_DELETE_INPUT_SCHEMA,
    outputSchema: RULE_SETTINGS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title,
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: title });
    if (authError) {
      return authError;
    }
    const ruleID = readString(args?.['rule_id']);
    if (!ruleID) {
      return asErrorResult('`rule_id` is required.');
    }
    const { objectName, params } = buildRuleSettingsQuery(args);
    if (!objectName) {
      return asErrorResult('`object` is required.');
    }
    const response = (await reqContext.client.delete(`${path}/${encodeURIComponent(ruleID)}`, {
      query: params,
    })) as Record<string, unknown>;
    return buildRuleSettingsMutationResult(label, 'deleted', response);
  },
});

const readObjectArray = (value: unknown): Array<Record<string, unknown>> | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const rows = value
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  return rows.length > 0 ? rows : undefined;
};

const buildObjectSchemaListParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const scope = readIntegrationScope(args?.['scope'] ?? args?.['source']);
  const provider = readIntegrationProvider(args?.['provider']);
  const channelID = readString(args?.['channel_id'] ?? args?.['channelId']);
  const customOnly = readBoolean(args?.['custom_only']);
  const search = readString(args?.['search']);
  const rawLimit = readNumber(args?.['limit'], 25);
  const limit = Math.max(1, Math.min(100, rawLimit));

  return {
    limit,
    params: {
      ...(scope ? { scope } : undefined),
      ...(provider ? { provider } : undefined),
      ...(channelID ? { channel_id: channelID } : undefined),
      ...(customOnly !== undefined ? { custom_only: customOnly } : undefined),
      ...(search ? { search } : undefined),
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
    },
  };
};

const buildObjectSchemaMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'channel_id',
    'description',
    'external_object_type',
    'name',
    'operation',
    'plural_label',
    'primary_display_property',
    'provider',
    'schema_ref',
    'singular_label',
    'slug',
    'target',
  ]);
  assignBooleanFields(body, args, ['confirm', 'dry_run']);
  const labels = readRecord(args?.['labels']);
  if (labels) {
    body['labels'] = labels;
  }
  const requiredProperties = readStringArray(args?.['required_properties'] ?? args?.['requiredProperties']);
  if (requiredProperties.length > 0) {
    body['required_properties'] = requiredProperties;
  }
  const searchableProperties = readStringArray(
    args?.['searchable_properties'] ?? args?.['searchableProperties'],
  );
  if (searchableProperties.length > 0) {
    body['searchable_properties'] = searchableProperties;
  }
  const secondaryDisplayProperties = readStringArray(
    args?.['secondary_display_properties'] ?? args?.['secondaryDisplayProperties'],
  );
  if (secondaryDisplayProperties.length > 0) {
    body['secondary_display_properties'] = secondaryDisplayProperties;
  }
  const properties = readObjectArray(args?.['properties']);
  if (properties) {
    body['properties'] = properties;
  }
  const associations = readObjectArray(args?.['associations']);
  if (associations) {
    body['associations'] = associations;
  }
  return body;
};

const normalizeObjectSchemaListPayload = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => readRecord(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  }
  const record = readRecord(payload);
  if (!record) {
    return [];
  }
  const envelope = unwrapV2EnvelopeRecord(record);
  if (envelope) {
    return normalizeObjectSchemaListPayload(envelope.data);
  }
  const rows = record['data'] ?? record['items'] ?? record['results'];
  return normalizeObjectSchemaListPayload(rows);
};

const normalizeObjectSchemaMutationPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  if (!envelope) {
    return payload;
  }
  const data = readRecord(envelope.data) ?? {};
  return {
    ...data,
    ...(envelope.meta?.['ctx_id'] ? { ctx_id: envelope.meta['ctx_id'] } : undefined),
  };
};

const normalizeV2MutationEnvelopePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  if (!envelope) {
    return payload;
  }
  const data = readRecord(envelope.data) ?? {};
  return {
    ...data,
    ...(envelope.meta?.['ctx_id'] ? { ctx_id: envelope.meta['ctx_id'] } : undefined),
  };
};

const normalizeV2ListEnvelopePayload = (payload: Record<string, unknown>): Record<string, unknown>[] => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  const value = envelope ? envelope.data : payload['data'];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
};

const normalizeViewDetailPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  if (!envelope) {
    return payload;
  }
  const data = readRecord(envelope.data) ?? {};
  const view = readRecord(data['view']);
  return {
    ...data,
    ...(view ? { data: view } : { data }),
    ...(envelope.meta?.['ctx_id'] ? { ctx_id: envelope.meta['ctx_id'] } : undefined),
  };
};

const normalizeJournalListPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  if (!envelope) {
    return payload;
  }
  const data = readRecord(envelope.data) ?? {};
  const pagination = readRecord(envelope.meta?.['pagination']);
  const rows =
    Array.isArray(data['items']) ? data['items']
    : Array.isArray(data['data']) ? data['data']
    : [];
  return {
    ...data,
    data: rows,
    count: rows.length,
    total: readNumber(pagination?.['total'], rows.length),
    page: readNumber(pagination?.['page'], 1),
    message: data['message'] ?? 'OK',
    ...(envelope.meta?.['ctx_id'] ? { ctx_id: envelope.meta['ctx_id'] } : undefined),
  };
};

const normalizeJournalStatementViewCreatePayload = (
  payload: Record<string, unknown>,
): Record<string, unknown> => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  if (!envelope) {
    return payload;
  }
  const data = readRecord(envelope.data) ?? {};
  const nestedData = readRecord(data['data']) ?? readRecord(data['view']) ?? data;
  return {
    data: nestedData,
    statement: data['statement'] ?? null,
    message: data['message'] ?? 'OK',
    ...(envelope.meta?.['ctx_id'] ? { ctx_id: envelope.meta['ctx_id'] } : undefined),
  };
};

const objectSchemaMutationAction = (
  response: Record<string, unknown>,
  body: Record<string, unknown>,
): 'created' | 'updated' | 'deleted' => {
  const status = readString(response['status']) ?? readString(body['operation']) ?? '';
  if (status === 'delete' || status === 'deleted') {
    return 'deleted';
  }
  if (status === 'update' || status === 'updated') {
    return 'updated';
  }
  return 'created';
};

const normalizeV2EnvelopeDataPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const envelope = unwrapV2EnvelopeRecord(payload);
  if (!envelope) {
    return payload;
  }
  const data = readRecord(envelope.data) ?? {};
  return {
    ...data,
    ...(envelope.meta?.['ctx_id'] ? { ctx_id: envelope.meta['ctx_id'] } : undefined),
  };
};

const buildAppBlueprintBody = (
  args: Record<string, unknown> | undefined,
  includeApplyFields = false,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  const templateSlug = readString(args?.['template_slug'] ?? args?.['templateSlug'] ?? args?.['template']);
  const prompt = readString(args?.['prompt'] ?? args?.['intent'] ?? args?.['natural_language_intent']);
  const language = readString(args?.['language']);
  if (templateSlug) {
    body['template_slug'] = templateSlug;
  }
  if (prompt) {
    body['prompt'] = prompt;
  }
  if (language) {
    body['language'] = language;
  }
  const modulesValue = args?.['modules'];
  const modules =
    Array.isArray(modulesValue) ?
      modulesValue
        .map((entry) => readRecord(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    : undefined;
  if (modules) {
    body['modules'] = modules;
  }
  const customObjectsValue = args?.['custom_objects'] ?? args?.['customObjects'];
  const customObjects =
    Array.isArray(customObjectsValue) ?
      customObjectsValue
        .map((entry) => readRecord(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    : undefined;
  if (customObjects) {
    body['custom_objects'] = customObjects;
  }
  const permissionSetsValue = args?.['permission_sets'] ?? args?.['permissionSets'];
  const permissionSets =
    Array.isArray(permissionSetsValue) ?
      permissionSetsValue
        .map((entry) => readRecord(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    : undefined;
  if (permissionSets) {
    body['permission_sets'] = permissionSets;
  }
  const blueprintDsl = readRecord(args?.['blueprint_dsl'] ?? args?.['blueprintDsl'] ?? args?.['blueprint']);
  if (blueprintDsl) {
    body['blueprint_dsl'] = blueprintDsl;
  }
  const overlay = readRecord(args?.['overlay']);
  if (overlay) {
    body['overlay'] = overlay;
  }
  const options = readRecord(args?.['options']);
  if (options) {
    body['options'] = options;
  }
  if (includeApplyFields) {
    assignMappedBooleanFields(body, args, [
      ['confirm', 'confirm'],
      ['update_existing_modules', 'update_existing_modules'],
      ['updateExistingModules', 'update_existing_modules'],
      ['update_existing_permission_sets', 'update_existing_permission_sets'],
      ['updateExistingPermissionSets', 'update_existing_permission_sets'],
      ['create_editable_guides', 'create_editable_guides'],
      ['createEditableGuides', 'create_editable_guides'],
      ['promote_guide_artifacts', 'create_editable_guides'],
      ['promoteGuideArtifacts', 'create_editable_guides'],
      ['allow_generated_blueprint_apply', 'allow_generated_blueprint_apply'],
      ['allowGeneratedBlueprintApply', 'allow_generated_blueprint_apply'],
    ]);
    const idempotencyKey = readString(args?.['idempotency_key'] ?? args?.['idempotencyKey']);
    if (idempotencyKey) {
      body['idempotency_key'] = idempotencyKey;
    }
  }
  return body;
};

const buildAppBlueprintToolResult = (
  payload: Record<string, unknown>,
  action: 'previewed' | 'applied',
): ToolCallResult => {
  const plan = readRecord(payload['plan']);
  const title = readString(plan?.['title']) ?? readString(plan?.['template_slug']) ?? 'app blueprint';
  const modules = Array.isArray(plan?.['modules']) ? plan?.['modules'] : [];
  const permissionSets = Array.isArray(plan?.['permission_sets']) ? plan?.['permission_sets'] : [];
  const artifacts = Array.isArray(plan?.['artifacts']) ? plan?.['artifacts'] : [];
  const mutationResults = Array.isArray(payload['mutation_results']) ? payload['mutation_results'] : [];
  const mutationText =
    action === 'applied' ? ` Mutation results: ${mutationResults.length}.` : ' No mutations were applied.';
  return {
    content: [
      {
        type: 'text',
        text: `${title} blueprint ${action}. Modules: ${modules.length}. Permission sets: ${permissionSets.length}. Artifacts: ${artifacts.length}.${mutationText}`,
      },
    ],
    structuredContent: payload,
  };
};

const buildPermissionSetListParams = (args: Record<string, unknown> | undefined) => {
  const q = readString(args?.['q'] ?? args?.['search']);
  const page = Math.max(1, readNumber(args?.['page'], 1));
  const limit = Math.max(1, Math.min(100, readNumber(args?.['limit'], 25)));
  return {
    limit,
    params: {
      page,
      limit,
      ...(q ? { q } : undefined),
    },
  };
};

const normalizePermissionSetListPayload = (
  payload: Record<string, unknown>,
): {
  rows: Array<Record<string, unknown>>;
  page: number;
  total: number;
  message: string;
} => {
  const data = normalizeV2EnvelopeDataPayload(payload);
  const rows = Array.isArray(data['data']) ? data['data'] : [];
  return {
    rows: rows
      .map((entry) => readRecord(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry)),
    page: readNumber(data['page'], 1),
    total: readNumber(data['total'], rows.length),
    message: readString(data['message']) ?? 'OK',
  };
};

const buildPermissionSetMutationBody = (
  args: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['name', 'description']);
  const permissions = readRecord(args?.['permissions'] ?? args?.['permission']);
  if (permissions) {
    body['permissions'] = permissions;
  }
  return body;
};

const buildWorkspaceLanguageListParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  const rawLimit = readNumber(args?.['limit'], 10);
  const limit = Math.max(1, Math.min(100, rawLimit));

  return {
    limit,
    params: {
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildSearchableWorkspaceLanguageListParams = (args: Record<string, unknown> | undefined) => {
  const { limit, params } = buildWorkspaceLanguageListParams(args);
  const search = readString(args?.['search']);

  return {
    limit,
    params: {
      ...params,
      ...(search ? { search } : undefined),
    },
  };
};

const buildObjectRecordListParams = (args: Record<string, unknown> | undefined) => {
  const result = buildPagedWorkspaceParams(args, 10);
  const language = readString(args?.['language']);
  const viewID = readString(args?.['view_id'] ?? args?.['view']);
  assignStringFields(result.params, args, ['search', 'sort']);
  if (viewID) {
    result.params['view_id'] = viewID;
  }
  if (language) {
    result.params['Accept-Language'] = language;
  }
  return result;
};

const buildItemRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const itemID = readString(args?.['item_id']);
  const externalID = readString(args?.['external_id']);

  return {
    itemID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
    },
  };
};

const recordMatchesAnyID = (
  record: Record<string, unknown>,
  ids: Array<string | undefined>,
  keys: readonly string[],
): boolean => {
  const expected = new Set(ids.filter((id): id is string => Boolean(id)).map((id) => id.toLowerCase()));
  if (expected.size === 0) {
    return false;
  }
  return keys.some((key) => {
    const value = record[key];
    return (
      (typeof value === 'string' || typeof value === 'number') && expected.has(String(value).toLowerCase())
    );
  });
};

const findInventoryFallbackFromList = async ({
  reqContext,
  args,
  inventoryID,
}: {
  reqContext: McpRequestContext;
  args: Record<string, unknown> | undefined;
  inventoryID: string;
}): Promise<Record<string, unknown> | undefined> => {
  const fallbackArgs = {
    ...(args ?? {}),
    limit: 100,
  };
  const { params } = buildObjectRecordListParams(fallbackArgs);
  const inventories = await reqContext.client.public.inventories.list(params, undefined);
  const rows = inventories.map((inventory) => inventory as unknown as Record<string, unknown>);
  const externalID = readString(args?.['external_id']);
  return rows.find((row) =>
    recordMatchesAnyID(row, [inventoryID, externalID], ['id', 'inventory_id', 'record_id', 'external_id']),
  );
};

const buildItemMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};

  assignMappedStringFields(body, args, [
    ['external_id', 'externalId'],
    ['currency', 'currency'],
    ['description', 'description'],
    ['name', 'name'],
    ['status', 'status'],
  ]);
  assignMappedNumberFields(body, args, [
    ['price', 'price'],
    ['purchase_price', 'purchasePrice'],
    ['tax', 'tax'],
  ]);

  return body;
};

const buildSubscriptionCreateBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};

  assignMappedStringFields(body, args, [
    ['customer_id', 'cid'],
    ['subscription_status', 'subscription_status'],
    ['currency', 'currency'],
    ['frequency_time', 'frequency_time'],
    ['shipping_cost_tax_status', 'shipping_cost_tax_status'],
    ['start_date', 'start_date'],
    ['end_date', 'end_date'],
    ['contract_id', 'contract_id'],
    ['discount_id', 'discount_id'],
    ['discount_number_format', 'discount_number_format'],
    ['discount_tax_option', 'discount_tax_option'],
    ['discount_mode', 'discount_mode'],
  ]);
  if (!body['discount_number_format']) {
    const discountOption = readString(args?.['discount_option']);
    if (discountOption) {
      body['discount_number_format'] = discountOption;
    }
  }
  const contractIDs = readStringArray(args?.['contract_ids']);
  if (contractIDs.length > 0) {
    body['contract_ids'] = contractIDs;
  }
  const contactID = readString(args?.['contact_id']);
  const companyID = readString(args?.['company_id']);
  if (contactID) {
    body['contact_id'] = contactID;
    body['cid'] = contactID;
  }
  if (companyID) {
    body['company_id'] = companyID;
    body['cid'] = companyID;
  }
  assignMappedIntegerFields(body, args, [['frequency', 'frequency']]);
  assignMappedNumberFields(body, args, [
    ['tax', 'tax'],
    ['total_price', 'total_price'],
    ['total_price_without_tax', 'total_price_without_tax'],
    ['discount_value', 'discount_value'],
  ]);
  assignMappedBooleanFields(body, args, [['clear_discount', 'clear_discount']]);

  assignPublicLineItems(body, args, {
    targetKey: 'items',
    sourceKeys: ['items', 'line_items', 'lineItems'],
  });

  return body;
};

const buildSubscriptionRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const subscriptionID = readString(args?.['subscription_id']);
  const externalID = readString(args?.['external_id']);

  return {
    subscriptionID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
    },
  };
};

const buildSubscriptionUpdateParams = (args: Record<string, unknown> | undefined) => {
  const subscriptionID = readString(args?.['subscription_id']);
  const lookupExternalID = readString(args?.['lookup_external_id']);
  const body: Record<string, unknown> = {};

  assignStringFields(body, args, [
    'contact',
    'contact_id',
    'company_id',
    'customer_id',
    'owner_id',
    'item_id',
    'item_variant_id',
    'channel_id',
    'platform_display_name',
    'currency',
    'status',
    'subscription_status',
    'start_date',
    'end_date',
    'frequency_time',
    'prior_to_time',
    'billing_timing',
    'billing_anchor',
    'charge_method',
    'payment_term_type',
    'auto_gen_invoice_statuses',
    'upcoming_invoice_date',
    'auto_invoice_start_policy',
    'auto_invoice_start_date',
    'tax_applied_to',
    'shipping_cost_id',
    'shipping_cost_tax_status',
    'contract_id',
    'discount_id',
    'discount_number_format',
    'discount_tax_option',
    'discount_mode',
  ]);
  if (!body['discount_number_format']) {
    const discountOption = readString(args?.['discount_option']);
    if (discountOption) {
      body['discount_number_format'] = discountOption;
    }
  }
  if (Object.prototype.hasOwnProperty.call(args ?? {}, 'contract_ids')) {
    body['contract_ids'] = readStringArray(args?.['contract_ids']);
  }
  assignMappedIntegerFields(body, args, [
    ['frequency', 'frequency'],
    ['payment_term_days', 'payment_term_days'],
    ['payment_term_closing_day', 'payment_term_closing_day'],
    ['payment_term_offset_months', 'payment_term_offset_months'],
    ['payment_term_payment_day', 'payment_term_payment_day'],
    ['number_item', 'number_item'],
  ]);
  assignMappedNumberFields(body, args, [
    ['prior_to_next', 'prior_to_next'],
    ['tax', 'tax'],
    ['tax_rate', 'tax_rate'],
    ['total_price', 'total_price'],
    ['total_price_without_tax', 'total_price_without_tax'],
    ['discount_value', 'discount_value'],
  ]);
  assignMappedBooleanFields(body, args, [
    ['auto_gen_invoice', 'auto_gen_invoice'],
    ['clear_discount', 'clear_discount'],
    ['quick_entry_mode', 'quick_entry_mode'],
  ]);
  const customFields = readRecord(args?.['custom_fields']);
  if (customFields) {
    body['custom_fields'] = customFields;
  }

  assignPublicLineItems(body, args, {
    targetKey: 'items',
    sourceKeys: ['items', 'line_items', 'lineItems'],
  });

  return {
    subscriptionID,
    params: {
      ...(lookupExternalID ? { external_id: lookupExternalID } : undefined),
      ...body,
    },
  };
};

const buildPaymentRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const paymentID = readString(args?.['payment_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);

  return {
    paymentID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildPaymentAllocationsParams = (args: Record<string, unknown> | undefined) => {
  const paymentID = readString(args?.['payment_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);

  return {
    paymentID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildPaymentAllocationRows = (args: Record<string, unknown> | undefined) => {
  const rows = Array.isArray(args?.['allocations']) ? args?.['allocations'] : [];
  const readIdentifier = (value: unknown) => {
    const stringValue = readString(value);
    if (stringValue) {
      return stringValue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  };
  return rows
    .map((row) => readRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => {
      const allocation: Record<string, unknown> = {};
      const invoiceID =
        readIdentifier(row['invoice_id']) ??
        readIdentifier(row['invoiceId']) ??
        readIdentifier(row['id_inv']) ??
        readIdentifier(row['idInv']);
      if (invoiceID) {
        allocation['invoice_id'] = invoiceID;
      }
      for (const [sourceKey, targetKey] of [
        ['amount', 'amount'],
        ['adjustment_amount', 'adjustment_amount'],
        ['adjustmentAmount', 'adjustment_amount'],
      ] as const) {
        const value = row[sourceKey];
        if (typeof value === 'number' && Number.isFinite(value)) {
          allocation[targetKey] = value;
        }
      }
      const adjustmentType = readString(row['adjustment_type']) ?? readString(row['adjustmentType']);
      if (adjustmentType) {
        allocation['adjustment_type'] = adjustmentType;
      }
      for (const key of ['currency', 'source', 'notes'] as const) {
        const value = readString(row[key]);
        if (value) {
          allocation[key] = value;
        }
      }
      return allocation;
    });
};

const buildPaymentAllocationsSummary = (
  payload: Record<string, unknown>,
  paymentID: string,
  action: 'Loaded' | 'Updated',
) => {
  const readAllocationReference = (value: unknown): string | undefined =>
    readString(value) ?? (typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined);
  const payment = readRecord(payload['payment']);
  const allocations = Array.isArray(payload['allocations']) ? payload['allocations'] : [];
  const resolvedPaymentID =
    readString(payment?.['id']) ??
    readString(payment?.['payment_id']) ??
    readString(payment?.['id_rcp']) ??
    paymentID;
  const allocatedAmount = payment?.['allocated_amount'];
  const unallocatedAmount = payment?.['unallocated_amount'];
  const totals =
    typeof allocatedAmount === 'number' || typeof unallocatedAmount === 'number' ?
      ` Allocated: ${typeof allocatedAmount === 'number' ? allocatedAmount : 0}; unallocated: ${
        typeof unallocatedAmount === 'number' ? unallocatedAmount : 0
      }.`
    : '';
  const summary = `${action} ${allocations.length} invoice allocation${
    allocations.length === 1 ? '' : 's'
  } for payment ${resolvedPaymentID}.${totals}`;

  if (action !== 'Updated') {
    return summary;
  }

  const invoiceIDs = allocations
    .map((allocation) => {
      const row = readRecord(allocation);
      const invoice = readRecord(row?.['invoice']);
      return (
        readAllocationReference(row?.['invoice_id']) ??
        readAllocationReference(row?.['id_inv']) ??
        readAllocationReference(invoice?.['id']) ??
        readAllocationReference(invoice?.['invoice_id']) ??
        readAllocationReference(invoice?.['id_inv'])
      );
    })
    .filter((invoiceID): invoiceID is string => Boolean(invoiceID));
  const invoiceSummary = invoiceIDs.length > 0 ? ` Linked invoices: ${invoiceIDs.join(', ')}.` : '';

  return `Payment reconciliation applied successfully (消し込み済み); allocation_applied=true. ${summary}${invoiceSummary}`;
};

const normalizeAllocationEnvelopePayload = (payload: Record<string, unknown>): Record<string, unknown> =>
  normalizeV2MutationEnvelopePayload(payload);

const buildPaymentMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};

  assignMappedStringFields(body, args, [
    ['company_external_id', 'companyExternalId'],
    ['company_id', 'companyId'],
    ['contact_external_id', 'contactExternalId'],
    ['contact_id', 'contactId'],
    ['currency', 'currency'],
    ['entry_type', 'entryType'],
    ['external_id', 'externalId'],
    ['notes', 'notes'],
    ['start_date', 'startDate'],
    ['status', 'status'],
    ['tax_option', 'taxOption'],
  ]);
  assignMappedBooleanFields(body, args, [['tax_inclusive', 'taxInclusive']]);
  assignMappedNumberFields(body, args, [
    ['tax_rate', 'taxRate'],
    ['total_price', 'totalPrice'],
    ['total_price_without_tax', 'totalPriceWithoutTax'],
    ['manual_price', 'manualPrice'],
  ]);
  assignPublicLineItems(body, args);

  return body;
};

const buildPaymentUpdateParams = (args: Record<string, unknown> | undefined) => {
  const paymentID = readString(args?.['payment_id']);
  const lookupExternalID = readString(args?.['lookup_external_id']);

  return {
    paymentID,
    params: {
      ...(lookupExternalID ? { external_id: lookupExternalID } : undefined),
      ...buildPaymentMutationBody(args),
    },
  };
};

const buildLocationRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const locationID = readString(args?.['location_id']);
  const externalID = readString(args?.['external_id']);

  return {
    locationID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
    },
  };
};

const buildLocationMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};

  assignMappedStringFields(body, args, [
    ['external_id', 'externalId'],
    ['warehouse', 'warehouse'],
    ['floor', 'floor'],
    ['zone', 'zone'],
    ['aisle', 'aisle'],
    ['rack', 'rack'],
    ['shelf', 'shelf'],
    ['bin', 'bin'],
    ['usage_status', 'usageStatus'],
  ]);

  return body;
};

const buildLocationUpdateParams = (args: Record<string, unknown> | undefined) => {
  const locationID = readString(args?.['location_id']);
  const lookupExternalID = readString(args?.['lookup_external_id']);

  return {
    locationID,
    params: {
      ...(lookupExternalID ? { external_id: lookupExternalID } : undefined),
      ...buildLocationMutationBody(args),
    },
  };
};

const buildInventoryRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const inventoryID = readString(args?.['inventory_id']);
  const externalID = readString(args?.['external_id']);
  const language = readString(args?.['language']);

  return {
    inventoryID,
    params: {
      ...(externalID ? { external_id: externalID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildInventoryMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};

  assignMappedStringFields(body, args, [
    ['external_id', 'externalId'],
    ['name', 'name'],
    ['item_id', 'itemId'],
    ['item_external_id', 'itemExternalId'],
    ['status', 'status'],
    ['inventory_status', 'inventoryStatus'],
    ['currency', 'currency'],
    ['date', 'date'],
    ['warehouse_id', 'warehouseId'],
  ]);
  assignMappedNumberFields(body, args, [['unit_price', 'unitPrice']]);
  assignMappedIntegerFields(body, args, [['initial_value', 'initialValue']]);

  return body;
};

const buildInventoryTransactionRetrieveParams = (args: Record<string, unknown> | undefined) => {
  const transactionID = readString(args?.['transaction_id']);
  const language = readString(args?.['language']);

  return {
    transactionID,
    params: {
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildInventoryTransactionMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};

  assignMappedStringFields(body, args, [
    ['inventory_id', 'inventoryId'],
    ['inventory_external_id', 'inventoryExternalId'],
    ['transaction_type', 'transactionType'],
    ['transaction_date', 'transactionDate'],
    ['status', 'status'],
    ['inventory_type', 'inventoryType'],
  ]);
  assignMappedNumberFields(body, args, [['price', 'price']]);
  assignMappedIntegerFields(body, args, [
    ['amount', 'amount'],
    ['transaction_amount', 'transactionAmount'],
  ]);
  assignMappedBooleanFields(body, args, [['use_unit_value', 'useUnitValue']]);

  return body;
};

const buildCompanyPriceTableQueryParams = (args: Record<string, unknown> | undefined) => {
  const companyID = readString(args?.['company_id']);
  const fieldRef = readString(args?.['field_ref']);
  const search = readString(args?.['search']);
  const page = Math.max(1, readNumber(args?.['page'], 1));
  const rawPageSize = readNumber(args?.['page_size'], 30);
  const pageSize = Math.max(1, Math.min(100, rawPageSize));

  return {
    companyID,
    params: {
      ...(fieldRef ? { field_ref: fieldRef } : undefined),
      ...(search ? { q: search } : undefined),
      page,
      page_size: pageSize,
    },
  };
};

const buildCompanyPriceTableCompanyUpdateBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};

  assignStringFields(body, args, ['field_ref', 'mode']);

  const pricePercentage = args?.['price_percentage'];
  if (typeof pricePercentage === 'number' && Number.isFinite(pricePercentage)) {
    body['price_percentage'] = pricePercentage;
  }

  return body;
};

const buildCompanyPriceTableItemUpdateBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  const clearOverride = readBoolean(args?.['clear_override']) === true;

  assignStringFields(body, args, ['field_ref']);

  const pricePercentage = args?.['price_percentage'];
  if (!clearOverride && typeof pricePercentage === 'number' && Number.isFinite(pricePercentage)) {
    body['price_percentage'] = pricePercentage;
  }

  return {
    body,
    clearOverride,
  };
};

const buildCompanyPriceTableApplyAllBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};

  assignStringFields(body, args, ['field_ref', 'mode']);

  const pricePercentage = args?.['price_percentage'];
  if (typeof pricePercentage === 'number' && Number.isFinite(pricePercentage)) {
    body['price_percentage'] = pricePercentage;
  }

  const excludeItemIDs = readStringArray(args?.['exclude_item_ids']);
  if (excludeItemIDs.length > 0) {
    body['exclude_item_ids'] = excludeItemIDs;
  }

  return body;
};

const buildCompanyPriceTableSummary = (payload: Record<string, unknown>): string => {
  const items = Array.isArray(payload['items']) ? payload['items'] : [];
  const pagination = readRecord(payload['pagination']);
  const totalCount =
    typeof pagination?.['total_count'] === 'number' ? pagination['total_count'] : items.length;
  const firstItem = readRecord(items[0]);

  if (firstItem) {
    const itemName = readString(firstItem['item_name']) || readString(firstItem['item_id']);
    const currency = readString(firstItem['currency']);
    const defaultPrice =
      typeof firstItem['default_price'] === 'number' ? String(firstItem['default_price']) : undefined;
    const discountPrice =
      typeof firstItem['discount_price'] === 'number' ? String(firstItem['discount_price']) : undefined;

    if (itemName && defaultPrice && discountPrice) {
      const currencySuffix = currency ? ` ${currency}` : '';
      return `Loaded company price table for ${totalCount} items. ${itemName}: default ${defaultPrice}${currencySuffix}, company price ${discountPrice}${currencySuffix}.`;
    }
  }

  return `Loaded company price table for ${totalCount} items.`;
};

const buildCompanyPriceTableMutationSummary = (payload: Record<string, unknown>): string => {
  const data = readRecord(payload['data']);
  const updatedCount = data?.['updated_count'];
  const deleted = readBoolean(data?.['deleted']);
  const itemID = readString(data?.['item_id']);
  const pricePercentage =
    typeof data?.['price_percentage'] === 'number' ? String(data['price_percentage']) : undefined;

  if (typeof updatedCount === 'number' && Number.isFinite(updatedCount)) {
    return `Applied company price table overrides to ${updatedCount} items.`;
  }
  if (deleted && itemID) {
    return `Deleted company price-table override for item ${itemID}.`;
  }
  if (itemID) {
    const percentageSuffix = pricePercentage ? ` to ${pricePercentage}%` : '';
    return `Updated company price-table override for item ${itemID}${percentageSuffix}.`;
  }
  if (pricePercentage) {
    return `Updated company price-table settings to ${pricePercentage}%.`;
  }
  return 'Updated company price-table settings.';
};

const buildReconnectMetadata = ({
  connectScopes,
  reqContext,
  requiredScopes,
}: {
  connectScopes?: string[] | undefined;
  reqContext: McpRequestContext;
  requiredScopes?: string[] | undefined;
}): Record<string, unknown> | undefined => {
  const oauth = reqContext.auth?.oauth;
  if (!oauth) {
    return undefined;
  }

  const reconnectScopes = connectScopes ?? requiredScopes;
  const connectUrl = oauth.connectUrlForScopes?.(reconnectScopes);
  const authorizationUrl = oauth.authorizationUrl ?? buildOAuthAuthorizationUrl(oauth.authorizationServerUrl);
  const clientName = reqContext.mcpClientInfo?.name?.trim();
  const isHosted = reqContext.toolProfile === 'hosted';
  const isCodex = mcpClientLooksLikeCodex(reqContext.mcpClientInfo);
  const isClaude = mcpClientLooksLikeClaude(reqContext.mcpClientInfo);
  const isNativeOAuthClient = isCodex || isClaude;
  const shouldIncludeConnectUrl = !isNativeOAuthClient;
  const base: Record<string, unknown> = {
    ...(clientName ? { client_name: clientName } : {}),
    authorization_server_url: oauth.authorizationServerUrl,
    authorization_url: authorizationUrl,
    ...(connectUrl && shouldIncludeConnectUrl ?
      {
        connect_url: connectUrl,
        connect_scopes: normalizeMcpConnectScopes(reconnectScopes),
        ...buildMcpConnectStructuredReply(connectUrl),
      }
    : undefined),
    resource_metadata_url: oauth.resourceMetadataUrl,
    resource_url: oauth.resourceUrl,
    reconnect_mode: 'client_native_oauth',
  };
  const hostedCodexReconnect =
    isHosted ?
      {
        reconnect_rpc_method: 'mcpServer/oauth/login',
        reconnect_server_name: 'sakura',
      }
    : {};

  if (isCodex) {
    return {
      ...base,
      ...hostedCodexReconnect,
      reconnect_instructions:
        'Use the MCP client native OAuth reconnect flow for this Sanka server, then retry the original request. Do not show a Connect URL to the user.',
    };
  }

  if (isClaude) {
    return {
      ...base,
      reconnect_instructions:
        'Use the MCP client native OAuth reconnect flow for this Sanka server, then retry the original request. Do not show a Connect URL to the user.',
    };
  }

  if (isHosted) {
    return {
      ...base,
      ...hostedCodexReconnect,
      reconnect_instructions:
        'If connect_url is present, the assistant must include required_user_facing_reply in the next visible response. Do not omit the URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. In clients with native OAuth UI, that UI may also be used, then retry the original request.',
    };
  }

  return {
    ...base,
    reconnect_instructions:
      'If connect_url is present, the assistant must include required_user_facing_reply in the next visible response. Do not omit the URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. Then retry the original request.',
  };
};

const buildReconnectVisibleMessage = ({
  message,
  reconnectMetadata,
}: {
  message: string;
  reconnectMetadata?: Record<string, unknown> | undefined;
}): string => {
  if (!reconnectMetadata) {
    return message;
  }

  return [
    message,
    typeof reconnectMetadata['connect_url'] === 'string' ?
      `Connect Sanka: ${buildMcpConnectMarkdownLink(reconnectMetadata['connect_url'])}`
    : undefined,
    typeof reconnectMetadata['connect_url'] === 'string' ?
      `Required user-facing reply: ${buildMcpConnectUserFacingReply(reconnectMetadata['connect_url'])}`
    : undefined,
    typeof reconnectMetadata['authorization_url'] === 'string' ?
      `OAuth authorization URL: ${reconnectMetadata['authorization_url']}`
    : undefined,
    typeof reconnectMetadata['resource_metadata_url'] === 'string' ?
      `MCP resource metadata URL: ${reconnectMetadata['resource_metadata_url']}`
    : undefined,
    typeof reconnectMetadata['reconnect_rpc_method'] === 'string' ?
      `Codex reconnect action: ${reconnectMetadata['reconnect_rpc_method']} for server ${String(
        reconnectMetadata['reconnect_server_name'] || 'sakura',
      )}.`
    : undefined,
    typeof reconnectMetadata['connect_url'] === 'string' ?
      'Claude: open the Connect Sanka URL or approve the Sanka connector OAuth prompt, then retry.'
    : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');
};

const buildAuthStatusChallenge = ({
  connected = false,
  connectScopes,
  error = 'invalid_token',
  message,
  missingScopes,
  reqContext,
  requiredScopes,
}: {
  connected?: boolean;
  connectScopes?: string[] | undefined;
  error?: 'insufficient_scope' | 'invalid_token';
  message: string;
  missingScopes?: string[] | undefined;
  reqContext: McpRequestContext;
  requiredScopes?: string[] | undefined;
}): ToolCallResult => {
  const oauth = reqContext.auth?.oauth;
  const reconnectMetadata = buildReconnectMetadata({ connectScopes, reqContext, requiredScopes });
  const wwwAuthenticate =
    oauth ?
      buildOAuthWwwAuthenticateHeader({
        authorizationServerUrl: oauth.authorizationServerUrl,
        description: message,
        error,
        resourceMetadataUrl: oauth.resourceMetadataUrl,
        ...(missingScopes?.length ? { scope: missingScopes.join(' ') } : undefined),
      })
    : undefined;

  return {
    content: [{ type: 'text', text: buildReconnectVisibleMessage({ message, reconnectMetadata }) }],
    isError: true,
    structuredContent: {
      connected,
      auth_mode: reqContext.auth?.authMode ?? 'none',
      tool_profile: reqContext.toolProfile ?? 'full',
      scopes: reqContext.auth?.oauth.scopes ?? [],
      message,
      ...(requiredScopes?.length ? { required_scopes: requiredScopes } : undefined),
      ...(missingScopes?.length ? { missing_scopes: missingScopes } : undefined),
      ...reconnectMetadata,
    },
    ...(wwwAuthenticate ?
      {
        _meta: {
          'mcp/www_authenticate': [wwwAuthenticate],
        },
      }
    : undefined),
  };
};

const buildConnectedAuthStatusResult = ({
  connectScopes,
  message,
  missingScopes,
  reqContext,
  requiredScopes,
}: {
  connectScopes?: string[] | undefined;
  message: string;
  missingScopes?: string[] | undefined;
  reqContext: McpRequestContext;
  requiredScopes?: string[] | undefined;
}): ToolCallResult => {
  const oauth = reqContext.auth?.oauth;
  const reconnectMetadata = buildReconnectMetadata({ connectScopes, reqContext, requiredScopes });
  const workspace = workspaceIdentityFromOauth(reqContext);

  return {
    content: [{ type: 'text', text: message }],
    structuredContent: {
      connected: true,
      auth_mode: reqContext.auth?.authMode ?? 'none',
      tool_profile: reqContext.toolProfile ?? 'full',
      scopes: oauth?.scopes ?? [],
      message,
      ...(requiredScopes?.length ? { required_scopes: requiredScopes } : undefined),
      ...(missingScopes?.length ? { missing_scopes: missingScopes } : undefined),
      ...workspace,
      ...reconnectMetadata,
    },
  };
};

const CONNECT_SANKA_PROMPT_MESSAGE =
  'Sanka CRM is not connected yet. Approve the OAuth prompt in your MCP client, then retry.';

const requestedScopesFromArgs = (args: Record<string, unknown> | undefined): string[] =>
  [...new Set(readStringArray(args?.['required_scopes']))].sort();

const resolveAuthStatusMissingScopes = ({
  authMode,
  grantedScopes,
  requiredScopes,
}: {
  authMode: string;
  grantedScopes: string[];
  requiredScopes: string[];
}): string[] => {
  if (requiredScopes.length === 0 || authMode === 'none') {
    return [];
  }

  const normalizedGrantedScopes = new Set(grantedScopes);
  return resolveMissingScopes({
    grantedScopes: normalizedGrantedScopes,
    requiredScopes,
  });
};

export const crmConnectSankaTool: McpTool = {
  metadata: {
    resource: 'auth',
    operation: 'read',
    tags: ['crm', 'auth'],
    operationId: 'connect_sanka',
  },
  tool: {
    name: 'connect_sanka',
    title: 'Connect Sanka CRM',
    description:
      'Start or resume the Sanka OAuth connection flow. Use this when the user explicitly asks to connect or reconnect Sanka.',
    inputSchema: AUTH_STATUS_INPUT_SCHEMA,
    outputSchema: AUTH_STATUS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'noauth' }],
    annotations: {
      title: 'Connect Sanka CRM',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authMode = reqContext.auth?.authMode ?? 'none';
    const requestedScopes = requestedScopesFromArgs(args);
    const requiredScopes = requestedScopes;
    const connectScopes = requestedScopes.length > 0 ? requestedScopes : [...DEFAULT_CONNECT_SANKA_SCOPES];
    const missingScopes = resolveAuthStatusMissingScopes({
      authMode,
      grantedScopes: reqContext.auth?.oauth.scopes ?? [],
      requiredScopes,
    });

    if (authMode === 'none') {
      return buildAuthStatusChallenge({
        connectScopes,
        message: CONNECT_SANKA_PROMPT_MESSAGE,
        requiredScopes,
        reqContext,
      });
    }

    if (missingScopes.length > 0) {
      return buildAuthStatusChallenge({
        connected: true,
        error: 'insufficient_scope',
        message: `Sanka CRM is connected, but missing required OAuth scopes: ${missingScopes.join(
          ', ',
        )}. Reconnect and approve the requested permissions, then retry.`,
        missingScopes,
        requiredScopes,
        reqContext,
      });
    }

    return buildConnectedAuthStatusResult({
      message: 'Sanka CRM is already connected with Sanka OAuth.',
      requiredScopes,
      reqContext,
    });
  },
};

export const crmAuthStatusTool: McpTool = {
  metadata: {
    resource: 'auth',
    operation: 'read',
    tags: ['crm'],
    operationId: 'auth_status',
  },
  tool: {
    name: 'auth_status',
    title: 'Check CRM authentication status',
    description:
      'Debug whether the Sanka CRM connector is authenticated. Do not use this as a preflight before company or contact lookup tools.',
    inputSchema: AUTH_STATUS_INPUT_SCHEMA,
    outputSchema: AUTH_STATUS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'noauth' }],
    annotations: {
      title: 'Check CRM authentication status',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authMode = reqContext.auth?.authMode ?? 'none';
    const requiredScopes = requestedScopesFromArgs(args);
    const missingScopes = resolveAuthStatusMissingScopes({
      authMode,
      grantedScopes: reqContext.auth?.oauth.scopes ?? [],
      requiredScopes,
    });

    if (authMode === 'none') {
      return buildAuthStatusChallenge({
        message: CONNECT_SANKA_PROMPT_MESSAGE,
        requiredScopes,
        reqContext,
      });
    }

    if (missingScopes.length > 0) {
      return buildAuthStatusChallenge({
        connected: true,
        error: 'insufficient_scope',
        message: `Sanka CRM is connected, but missing required OAuth scopes: ${missingScopes.join(
          ', ',
        )}. Reconnect and approve the requested permissions, then retry.`,
        missingScopes,
        requiredScopes,
        reqContext,
      });
    }

    return buildConnectedAuthStatusResult({
      message: 'Sanka CRM is connected with Sanka OAuth.',
      requiredScopes,
      reqContext,
    });
  },
};

export const crmCurrentWorkspaceTool: McpTool = {
  metadata: {
    resource: 'auth',
    operation: 'read',
    tags: ['crm', 'auth'],
    httpMethod: 'get',
    httpPath: '/api/v2/auth/session',
    operationId: 'current_workspace',
  },
  tool: {
    name: 'current_workspace',
    title: 'Get current Sanka workspace',
    description:
      'Return the Sanka workspace currently bound to this OAuth credential, including workspace_name, workspace_code, and internal workspace_id. Use this to verify workspace context before live Sanka operations.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: CURRENT_WORKSPACE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get current Sanka workspace',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get current Sanka workspace',
    });
    if (authError) {
      return authError;
    }

    const response = await reqContext.client.public.auth.getCurrentIdentity(undefined);
    const data = readRecord((response as unknown as Record<string, unknown>)['data']);
    const workspace = workspaceIdentityFromRecord(data);
    const authMode = readString(data?.['auth_mode']) ?? reqContext.auth?.authMode ?? 'oauth_bearer';
    const message =
      workspace.workspace_id ?
        `Current Sanka workspace is ${currentWorkspaceLabel(workspace)}.`
      : 'Sanka is connected, but no workspace is bound to this credential.';

    return {
      content: [{ type: 'text', text: message }],
      structuredContent: buildCurrentWorkspaceStructuredContent({
        authMode,
        connected: true,
        message,
        workspace,
      }),
    };
  },
};

export const crmListWorkspacesTool: McpTool = {
  metadata: {
    resource: 'auth',
    operation: 'read',
    tags: ['crm', 'auth'],
    httpMethod: 'get',
    httpPath: '/api/v2/auth/session',
    operationId: 'list_workspaces',
  },
  tool: {
    name: 'list_workspaces',
    title: 'List available Sanka workspaces',
    description:
      'List workspaces available to the authenticated Sanka OAuth session. Use the returned internal id with switch_workspace; do not use the short workspace_code as workspace_id.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: LIST_WORKSPACES_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List available Sanka workspaces',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List available Sanka workspaces',
    });
    if (authError) {
      return authError;
    }

    const response = await reqContext.client.get<PublicAuthSessionResponse>(
      '/api/v2/auth/session',
      undefined,
    );
    const data = readRecord((response as unknown as Record<string, unknown>)['data']);
    const availableWorkspaces = normalizeSessionWorkspaceOptions(data);
    const currentWorkspace = workspaceIdentityFromSessionRecord(data);
    const message = `Returned ${availableWorkspaces.length} available Sanka workspaces.`;
    const workspacePreview = buildStructuredTextPreview('Available Sanka workspaces preview', {
      current_workspace: currentWorkspace,
      total: availableWorkspaces.length,
      available_workspaces: availableWorkspaces.slice(0, STRUCTURED_TEXT_PREVIEW_ITEM_LIMIT),
    });

    return {
      content: [{ type: 'text', text: [message, workspacePreview].filter(Boolean).join('\n\n') }],
      structuredContent: {
        ...(currentWorkspace.workspace_id ?
          { current_workspace_id: currentWorkspace.workspace_id }
        : undefined),
        ...(currentWorkspace.workspace_code ?
          { current_workspace_code: currentWorkspace.workspace_code }
        : undefined),
        ...(currentWorkspace.workspace_name ?
          { current_workspace_name: currentWorkspace.workspace_name }
        : undefined),
        available_workspaces: availableWorkspaces,
        message,
      },
    };
  },
};

export const crmSwitchWorkspaceTool: McpTool = {
  metadata: {
    resource: 'auth',
    operation: 'write',
    tags: ['crm', 'auth'],
    httpMethod: 'post',
    httpPath: '/api/v2/workspaces/switch',
    operationId: 'switch_workspace',
  },
  tool: {
    name: 'switch_workspace',
    title: 'Switch Sanka workspace',
    description:
      'Switch the authenticated Sanka workspace. Pass the internal workspace_id from list_workspaces, not the short workspace_code. After switching, omit workspace_id on normal data tools.',
    inputSchema: SWITCH_WORKSPACE_INPUT_SCHEMA,
    outputSchema: LIST_WORKSPACES_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Switch Sanka workspace',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Switch Sanka workspace',
    });
    if (authError) {
      return authError;
    }

    const workspaceID = readString(args?.['workspace_id']);
    if (!workspaceID) {
      return asErrorResult(
        '`workspace_id` is required. Use the internal id from list_workspaces, not the short workspace code.',
      );
    }

    const switchResponse = await reqContext.client.post<Record<string, unknown>>(
      '/api/v2/workspaces/switch',
      {
        body: { target_workspace_id: workspaceID },
        ...(reqContext.mcpSessionId ?
          {
            headers: {
              'X-Sanka-MCP-Session-ID': reqContext.mcpSessionId,
            },
          }
        : undefined),
      },
    );

    const switchEnvelope = unwrapV2EnvelopeRecord(switchResponse);
    const switchData =
      readRecord(switchEnvelope?.data) ??
      readRecord((switchResponse as Record<string, unknown>)['data']) ??
      readRecord(switchResponse);
    const sessionResponse = await reqContext.client.get<Record<string, unknown>>(
      '/api/v2/auth/session',
      undefined,
    );
    const sessionEnvelope = unwrapV2EnvelopeRecord(sessionResponse);
    const sessionData =
      readRecord(sessionEnvelope?.data) ?? readRecord((sessionResponse as Record<string, unknown>)['data']);
    const availableWorkspaces = normalizeSessionWorkspaceOptions(sessionData);
    const currentWorkspace = {
      ...workspaceIdentityFromSessionRecord(switchData),
      ...workspaceIdentityFromSessionRecord(sessionData),
    };
    const message = `Switched Sanka workspace to ${currentWorkspaceLabel(currentWorkspace)}.`;

    return {
      content: [{ type: 'text', text: message }],
      structuredContent: {
        ...(currentWorkspace.workspace_id ?
          { current_workspace_id: currentWorkspace.workspace_id }
        : undefined),
        ...(currentWorkspace.workspace_code ?
          { current_workspace_code: currentWorkspace.workspace_code }
        : undefined),
        ...(currentWorkspace.workspace_name ?
          { current_workspace_name: currentWorkspace.workspace_name }
        : undefined),
        available_workspaces: availableWorkspaces,
        message,
      },
    };
  },
};

export const crmQueryRecordsTool: McpTool = {
  metadata: {
    resource: 'records',
    operation: 'read',
    tags: ['crm'],
    httpMethod: 'post',
    httpPath: '/api/v2/records/query',
    operationId: 'public.records.query',
  },
  tool: {
    name: 'query_records',
    title: 'Query records',
    description:
      'Query Sanka or live integration records with server-side filters and field projection. Use scope="integration" with provider="hubspot" or provider="salesforce" for provider-side rows; use this instead of list_* when the user asks for filtered rows or only a few fields.',
    inputSchema: RECORD_QUERY_INPUT_SCHEMA,
    outputSchema: RECORD_QUERY_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Query records',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Query records',
    });
    if (authError) {
      return authError;
    }

    const filtersError = invalidRecordFiltersResult(args?.['filters']);
    if (filtersError) {
      return filtersError;
    }

    const body = buildRecordQueryBody(args);
    if (!body['object_type']) {
      return asErrorResult('`object_type` is required.');
    }

    const payload = (await reqContext.client.post(recordQueryPathForBody(body), {
      body,
    })) as Record<string, unknown>;

    return buildRecordQueryResult(normalizeRecordQueryPayload(payload, body));
  },
};

export const crmAggregateRecordsTool: McpTool = {
  metadata: {
    resource: 'records',
    operation: 'read',
    tags: ['crm'],
    httpMethod: 'post',
    httpPath: '/api/v2/records/aggregate',
    operationId: 'public.records.aggregate',
  },
  tool: {
    name: 'aggregate_records',
    title: 'Aggregate records',
    description:
      'Compute counts and grouped counts for Sanka or live integration records with server-side filters. Use scope="integration" with provider="hubspot" or provider="salesforce" for provider-side counts. For “how many”, totals, or empty-field count questions, use this tool instead of paging through list_* results.',
    inputSchema: RECORD_AGGREGATE_INPUT_SCHEMA,
    outputSchema: RECORD_AGGREGATE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Aggregate records',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Aggregate records',
    });
    if (authError) {
      return authError;
    }

    const filtersError = invalidRecordFiltersResult(args?.['filters']);
    if (filtersError) {
      return filtersError;
    }

    const body = buildRecordAggregateBody(args);
    if (!body['object_type']) {
      return asErrorResult('`object_type` is required.');
    }

    const payload = (await reqContext.client.post(recordAggregatePathForBody(body), {
      body,
    })) as Record<string, unknown>;

    return buildRecordAggregateResult(normalizeRecordAggregatePayload(payload, body));
  },
};

export const crmPreviewRecordMergeTool: McpTool = {
  metadata: {
    resource: 'records',
    operation: 'read',
    tags: ['crm'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/records/merge/preview',
    operationId: 'public.records.merge.preview',
  },
  tool: {
    name: 'preview_record_merge',
    title: 'Preview record merge',
    description:
      'Preview a Sanka-native merge plan for duplicate companies or contacts. Use after query_records mode="dedupe_candidates" and before merge_records. Returns primary/duplicate records, field resolution, related record relink plan, archive behavior, and required confirmation.',
    inputSchema: RECORD_MERGE_INPUT_SCHEMA,
    outputSchema: RECORD_MERGE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Preview record merge',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Preview record merge',
    });
    if (authError) {
      return authError;
    }

    const body = buildRecordMergeBody({ ...args, dry_run: true });
    delete body['confirm'];
    if (!body['object_type']) {
      return asErrorResult('`object_type` is required.');
    }
    if (!body['primary_record_id']) {
      return asErrorResult('`primary_record_id` or `canonical_record_id` is required.');
    }
    if (!Array.isArray(body['duplicate_record_ids']) || body['duplicate_record_ids'].length === 0) {
      return asErrorResult('`duplicate_record_ids` must include at least one record id.');
    }

    const payload = (await reqContext.client.post('/api/v2/public/records/merge/preview', {
      body,
    })) as Record<string, unknown>;

    return buildRecordMergeResult('preview_record_merge', normalizeRecordMergePayload(payload));
  },
};

export const crmMergeRecordsTool: McpTool = {
  metadata: {
    resource: 'records',
    operation: 'write',
    tags: ['crm'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/records/merge/apply',
    operationId: 'public.records.merge.apply',
  },
  tool: {
    name: 'merge_records',
    title: 'Merge records',
    description:
      'Apply a confirmed Sanka-native merge for duplicate companies or contacts. Call preview_record_merge first, then call this only after the user explicitly approves the merge plan. Requires confirm=true.',
    inputSchema: RECORD_MERGE_INPUT_SCHEMA,
    outputSchema: RECORD_MERGE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Merge records',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Merge records',
    });
    if (authError) {
      return authError;
    }

    const body = buildRecordMergeBody(args);
    if (!body['object_type']) {
      return asErrorResult('`object_type` is required.');
    }
    if (!body['primary_record_id']) {
      return asErrorResult('`primary_record_id` or `canonical_record_id` is required.');
    }
    if (!Array.isArray(body['duplicate_record_ids']) || body['duplicate_record_ids'].length === 0) {
      return asErrorResult('`duplicate_record_ids` must include at least one record id.');
    }
    if (body['confirm'] !== true) {
      return asErrorResult('`confirm=true` is required after reviewing preview_record_merge.');
    }

    const payload = (await reqContext.client.post('/api/v2/public/records/merge/apply', {
      body,
    })) as Record<string, unknown>;

    return buildRecordMergeResult('merge_records', normalizeRecordMergePayload(payload));
  },
};

export const crmCreateCustomObjectRecordTool: McpTool = {
  metadata: {
    resource: 'records',
    operation: 'write',
    tags: ['crm'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/records/custom-objects/records',
    operationId: 'public.records.custom_objects.create',
  },
  tool: {
    name: 'create_custom_object_record',
    title: 'Create custom object record',
    description:
      'Create a Sanka custom object row. Set custom_object or custom_object_slug to the custom object slug/internal key or id. Use data keys as field names, internal_name values, or field UUIDs.',
    inputSchema: CUSTOM_OBJECT_RECORD_CREATE_INPUT_SCHEMA,
    outputSchema: CUSTOM_OBJECT_RECORD_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create custom object record',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create custom object record',
    });
    if (authError) {
      return authError;
    }

    const body = buildCustomObjectRecordMutationBody(args);
    if (!body['external_object_type']) {
      return asErrorResult('`custom_object` or `custom_object_slug` is required.');
    }

    const payload = (await reqContext.client.post('/api/v2/public/records/custom-objects/records', {
      body,
    })) as Record<string, unknown>;

    return buildCustomObjectRecordMutationResult({
      toolName: 'create_custom_object_record',
      action: 'created',
      payload,
    });
  },
};

export const crmUpdateCustomObjectRecordTool: McpTool = {
  metadata: {
    resource: 'records',
    operation: 'write',
    tags: ['crm'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/records/custom-objects/records/{record_id}',
    operationId: 'public.records.custom_objects.update',
  },
  tool: {
    name: 'update_custom_object_record',
    title: 'Update custom object record',
    description:
      'Update a Sanka custom object row by row UUID. Use data keys as field names, internal_name values, or field UUIDs.',
    inputSchema: CUSTOM_OBJECT_RECORD_UPDATE_INPUT_SCHEMA,
    outputSchema: CUSTOM_OBJECT_RECORD_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update custom object record',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update custom object record',
    });
    if (authError) {
      return authError;
    }

    const recordID = readString(args?.['record_id'] ?? args?.['recordId']);
    if (!recordID) {
      return asErrorResult('`record_id` is required.');
    }
    const body = buildCustomObjectRecordMutationBody(args);
    delete body['external_object_type'];

    const payload = (await reqContext.client.post(
      `/api/v2/public/records/custom-objects/records/${recordID}`,
      {
        body,
      },
    )) as Record<string, unknown>;

    return buildCustomObjectRecordMutationResult({
      toolName: 'update_custom_object_record',
      action: 'updated',
      payload,
    });
  },
};

export const crmArchiveCustomObjectRecordTool: McpTool = {
  metadata: {
    resource: 'records',
    operation: 'write',
    tags: ['crm'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/records/custom-objects/records/{record_id}/archive',
    operationId: 'public.records.custom_objects.archive',
  },
  tool: {
    name: 'archive_custom_object_record',
    title: 'Archive custom object record',
    description:
      'Archive a Sanka custom object row by row UUID. This is a soft archive, not a permanent delete.',
    inputSchema: CUSTOM_OBJECT_RECORD_ARCHIVE_INPUT_SCHEMA,
    outputSchema: CUSTOM_OBJECT_RECORD_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Archive custom object record',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Archive custom object record',
    });
    if (authError) {
      return authError;
    }

    const recordID = readString(args?.['record_id'] ?? args?.['recordId']);
    if (!recordID) {
      return asErrorResult('`record_id` is required.');
    }

    const payload = (await reqContext.client.post(
      `/api/v2/public/records/custom-objects/records/${recordID}/archive`,
      {
        body: {},
      },
    )) as Record<string, unknown>;

    return buildCustomObjectRecordMutationResult({
      toolName: 'archive_custom_object_record',
      action: 'archived',
      payload,
    });
  },
};

export const crmListAssociationsTool: McpTool = {
  metadata: {
    resource: 'associations',
    operation: 'read',
    tags: ['crm', 'associations'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/associations',
    operationId: 'public.associations.list',
  },
  tool: {
    name: 'list_associations',
    title: 'List associations',
    description:
      'Review associations between Sanka records. Provide source_object/source_id or target_object/target_id; optionally filter by label_id or label.',
    inputSchema: ASSOCIATION_LIST_INPUT_SCHEMA,
    outputSchema: ASSOCIATION_LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List associations',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List associations',
    });
    if (authError) {
      return authError;
    }

    const params = buildAssociationListParams(args);
    if (!hasAssociationSourceRef(params) && !hasAssociationTargetRef(params)) {
      return asErrorResult('`source_object`/`source_id` or `target_object`/`target_id` is required.');
    }

    const payload = (await reqContext.client.public.associations.list(
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return buildAssociationListResult(payload);
  },
};

export const crmCreateAssociationTool: McpTool = {
  metadata: {
    resource: 'associations',
    operation: 'write',
    tags: ['crm', 'associations'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/associations',
    operationId: 'public.associations.create',
  },
  tool: {
    name: 'create_association',
    title: 'Create association',
    description:
      'Create an association between two Sanka records using a workspace association label. Pass label_id when known; otherwise pass label.',
    inputSchema: ASSOCIATION_CREATE_INPUT_SCHEMA,
    outputSchema: ASSOCIATION_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create association',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create association',
    });
    if (authError) {
      return authError;
    }

    const body = buildAssociationCreateBody(args);
    if (!hasAssociationSourceRef(body) || !hasAssociationTargetRef(body)) {
      return asErrorResult('`source_object`, `source_id`, `target_object`, and `target_id` are required.');
    }
    if (!hasAssociationLabelRef(body)) {
      return asErrorResult('`label_id` or `label` is required.');
    }

    const payload = (await reqContext.client.public.associations.create(
      body,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildAssociationMutationText(payload, 'created') }],
      structuredContent: payload,
    };
  },
};

export const crmDeleteAssociationTool: McpTool = {
  metadata: {
    resource: 'associations',
    operation: 'write',
    tags: ['crm', 'associations'],
    httpMethod: 'delete',
    httpPath: '/api/v2/public/associations',
    operationId: 'public.associations.delete',
  },
  tool: {
    name: 'delete_association',
    title: 'Delete association',
    description:
      'Delete an association between two Sanka records. Prefer association_id; otherwise pass source_object/source_id, target_object/target_id, and label_id or label.',
    inputSchema: ASSOCIATION_DELETE_INPUT_SCHEMA,
    outputSchema: ASSOCIATION_DELETE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete association',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete association',
    });
    if (authError) {
      return authError;
    }

    const params = buildAssociationDeleteParams(args);
    if (!readString(params['association_id'])) {
      if (!hasAssociationSourceRef(params) || !hasAssociationTargetRef(params)) {
        return asErrorResult(
          '`association_id` is required unless source_object/source_id and target_object/target_id are provided.',
        );
      }
      if (!hasAssociationLabelRef(params)) {
        return asErrorResult('`label_id` or `label` is required when deleting without `association_id`.');
      }
    }

    const payload = (await reqContext.client.public.associations.delete(
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildAssociationMutationText(payload, 'deleted') }],
      structuredContent: payload,
    };
  },
};

export const crmListCompaniesTool: McpTool = defineListTool({
  resource: 'companies',
  tags: ['crm'],
  httpMethod: 'get',
  httpPath: '/api/v2/companies',
  operationId: 'public.companies.list',
  name: 'list_companies',
  title: 'List companies',
  description:
    'Search and review companies. Default scope=sanka lists Sanka companies; scope=sanka with provider=salesforce lists Sanka companies linked to Salesforce Accounts; scope=integration with provider=salesforce lists live Salesforce Accounts; scope=integration with provider=freee or provider=moneyforward lists live accounting partners as companies.',
  inputSchema: LIST_INPUT_SCHEMA,
  outputSchema: LIST_OUTPUT_SCHEMA,
  label: 'companies',
  validateArgs: (args) => invalidRecordFiltersResult(args?.['filters']),
  fetchList: async ({ reqContext, args }) => {
    if (hasCompanyRecordRoutingArgs(args)) {
      const body = buildCompanyRecordQueryBody(args);
      const rawPayload = (await reqContext.client.post(recordQueryPathForBody(body), {
        body,
      })) as Record<string, unknown>;
      return normalizeRecordQueryPayload(rawPayload, body) as ListToolPayload;
    }
    return await reqContext.client.public.companies.list(buildListParams(args), undefined);
  },
});

export const crmGetCompanyTool: McpTool = defineDetailTool({
  resource: 'companies',
  tags: ['crm'],
  httpMethod: 'get',
  httpPath: '/api/v2/companies/{company_id}',
  operationId: 'public.companies.retrieve',
  name: 'get_company',
  title: 'Get company',
  description: 'Load one company from Sanka by company id, numeric id, or external reference.',
  inputSchema: COMPANY_RETRIEVE_INPUT_SCHEMA,
  outputSchema: COMPANY_OUTPUT_SCHEMA,
  entity: 'company',
  previewKeys: ['name', 'email', 'company_id'],
  missingTargetError: '`company_id` is required.',
  resolveTarget: (args) => {
    const { companyID, params } = buildCompanyRetrieveParams(args);
    return { id: companyID, params };
  },
  retrieve: ({ reqContext, id, params }) =>
    reqContext.client.public.companies.retrieve(id, params, undefined),
});

export const crmCreateCompanyTool: McpTool = defineMutationTool({
  resource: 'companies',
  tags: ['crm'],
  httpMethod: 'post',
  httpPath: '/api/v2/companies',
  operationId: 'public.companies.create',
  name: 'create_company',
  title: 'Create company',
  description:
    'Create or upsert a company. Default target=sanka mutates Sanka only; external_id is optional and should be used for idempotent upserts. Use target=integration with provider=salesforce to mutate Salesforce only, or target=both when the API allows both-side sync. freee/MoneyForward partner creation is handled by invoice_export, not this tool.',
  inputSchema: COMPANY_CREATE_INPUT_SCHEMA,
  outputSchema: COMPANY_MUTATION_OUTPUT_SCHEMA,
  entity: 'Company',
  action: 'created',
  idKeys: ['company_id'],
  execute: ({ reqContext, args }) =>
    reqContext.client.public.companies.create(buildCompanyMutationBody(args), undefined),
});

export const crmUpdateCompanyTool: McpTool = defineMutationTool({
  resource: 'companies',
  tags: ['crm'],
  httpMethod: 'patch',
  httpPath: '/api/v2/companies/{company_id}',
  operationId: 'public.companies.update',
  name: 'update_company',
  title: 'Update company',
  description:
    'Update an existing company. Default target="sanka" mutates Sanka only; use target="integration" or target="both" with provider="hubspot" or provider="salesforce" when allowed. freee/MoneyForward partner updates are not supported here. For company dedupe, use operation="dedupe_preview" first; execute operation="dedupe_apply" with confirm=true only after explicit user approval.',
  inputSchema: COMPANY_UPDATE_INPUT_SCHEMA,
  outputSchema: COMPANY_MUTATION_OUTPUT_SCHEMA,
  entity: 'Company',
  action: 'updated',
  idKeys: ['company_id'],
  missingTargetError: '`company_id` is required.',
  resolveTarget: (args) => ({ id: readString(args?.['company_id']), params: undefined }),
  execute: ({ reqContext, args, id }) =>
    reqContext.client.public.companies.update(id, buildCompanyMutationBody(args), undefined),
});

export const crmDeleteCompanyTool: McpTool = defineMutationTool({
  resource: 'companies',
  tags: ['crm'],
  httpMethod: 'delete',
  httpPath: '/api/v2/companies/{company_id}',
  operationId: 'public.companies.delete',
  name: 'delete_company',
  title: 'Delete company',
  description:
    'Archive or delete a company. Default target=sanka archives in Sanka only. Use target=integration with provider=salesforce to delete a Salesforce record by external_id, or provider=freee/provider=moneyforward to delete an accounting partner by external_id. Always run dry_run=true first and set confirm=true only after explicit approval.',
  inputSchema: COMPANY_DELETE_INPUT_SCHEMA,
  outputSchema: COMPANY_MUTATION_OUTPUT_SCHEMA,
  entity: 'Company',
  action: 'deleted',
  idKeys: ['company_id'],
  missingTargetError: '`company_id` is required unless target="integration" and `external_id` is provided.',
  resolveTarget: (args) => {
    const { companyID, params } = buildCompanyDeleteParams(args);
    return { id: companyID, params };
  },
  execute: ({ reqContext, id, params }) => reqContext.client.public.companies.delete(id, params, undefined),
});

export const crmListContactsTool: McpTool = defineListTool({
  resource: 'contacts',
  tags: ['crm'],
  httpMethod: 'get',
  httpPath: '/api/v2/contacts',
  operationId: 'public.contacts.list',
  name: 'list_contacts',
  title: 'List contacts',
  description:
    'Search and review contacts in Sanka. Use this when the user wants to find or inspect contacts, not to create or update them.',
  inputSchema: LIST_INPUT_SCHEMA,
  outputSchema: LIST_OUTPUT_SCHEMA,
  label: 'contacts',
  fetchList: ({ reqContext, args }) =>
    reqContext.client.public.contacts.list(buildListParams(args), undefined),
});

export const crmGetContactTool: McpTool = defineDetailTool({
  resource: 'contacts',
  tags: ['crm'],
  httpMethod: 'get',
  httpPath: '/api/v2/contacts/{contact_id}',
  operationId: 'public.contacts.retrieve',
  name: 'get_contact',
  title: 'Get contact',
  description: 'Load one contact from Sanka by contact id, numeric id, or external reference.',
  inputSchema: CONTACT_RETRIEVE_INPUT_SCHEMA,
  outputSchema: CONTACT_OUTPUT_SCHEMA,
  entity: 'contact',
  previewKeys: ['name', 'email', 'contact_id'],
  missingTargetError: '`contact_id` is required.',
  resolveTarget: (args) => {
    const { contactID, params } = buildContactRetrieveParams(args);
    return { id: contactID, params };
  },
  retrieve: ({ reqContext, id, params }) => reqContext.client.public.contacts.retrieve(id, params, undefined),
});

export const crmCreateContactTool: McpTool = defineMutationTool({
  resource: 'contacts',
  tags: ['crm'],
  httpMethod: 'post',
  httpPath: '/api/v2/contacts',
  operationId: 'public.contacts.create',
  name: 'create_contact',
  title: 'Create contact',
  description:
    'Create a contact in Sanka or a connected CRM. `external_id` is optional for Sanka-local creates and should be used for idempotent upserts; integration-only creates can omit it and use the returned provider id.',
  inputSchema: CONTACT_CREATE_INPUT_SCHEMA,
  outputSchema: CONTACT_MUTATION_OUTPUT_SCHEMA,
  entity: 'Contact',
  action: 'created',
  idKeys: ['contact_id'],
  execute: ({ reqContext, args }) =>
    reqContext.client.public.contacts.create(buildContactMutationBody(args), undefined),
});

export const crmUpdateContactTool: McpTool = defineMutationTool({
  resource: 'contacts',
  tags: ['crm'],
  httpMethod: 'patch',
  httpPath: '/api/v2/contacts/{contact_id}',
  operationId: 'public.contacts.update',
  name: 'update_contact',
  title: 'Update contact',
  description: 'Update an existing contact in Sanka or a connected CRM.',
  inputSchema: CONTACT_UPDATE_INPUT_SCHEMA,
  outputSchema: CONTACT_MUTATION_OUTPUT_SCHEMA,
  entity: 'Contact',
  action: 'updated',
  idKeys: ['contact_id'],
  missingTargetError: '`contact_id` is required.',
  resolveTarget: (args) => ({ id: readString(args?.['contact_id']), params: undefined }),
  execute: ({ reqContext, args, id }) =>
    reqContext.client.public.contacts.update(id, buildContactMutationBody(args), undefined),
});

export const crmDeleteContactTool: McpTool = defineMutationTool({
  resource: 'contacts',
  tags: ['crm'],
  httpMethod: 'delete',
  httpPath: '/api/v2/contacts/{contact_id}',
  operationId: 'public.contacts.delete',
  name: 'delete_contact',
  title: 'Delete contact',
  description: 'Archive or delete a contact in Sanka or a connected CRM by contact id or external reference.',
  inputSchema: CONTACT_DELETE_INPUT_SCHEMA,
  outputSchema: CONTACT_MUTATION_OUTPUT_SCHEMA,
  entity: 'Contact',
  action: 'deleted',
  idKeys: ['contact_id'],
  missingTargetError: '`contact_id` is required.',
  resolveTarget: (args) => {
    const { contactID, params } = buildContactDeleteParams(args);
    return { id: contactID, params };
  },
  execute: ({ reqContext, id, params }) => reqContext.client.public.contacts.delete(id, params, undefined),
});

export const crmListContractTemplatesTool: McpTool = {
  metadata: {
    resource: 'contract_templates',
    operation: 'read',
    tags: ['crm', 'contracts'],
    httpMethod: 'get',
    httpPath: '/api/v2/contracts/templates',
    operationId: 'public.contracts.templates.list',
  },
  tool: {
    name: 'list_contract_templates',
    title: 'List contract templates',
    description: 'Review uploaded Sanka Contract templates available in the current workspace.',
    inputSchema: CONTRACT_TEMPLATE_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List contract templates',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List contract templates' });
    if (authError) {
      return authError;
    }

    const { data: payload } = await reqContext.client
      .v2Get<Record<string, unknown>>('/contracts/templates', {
        query: buildWorkspaceQuery(args),
      })
      .withResponse();
    const { templates, message, total } = normalizeContractTemplateListPayload(payload);

    return buildListResult({
      label: 'contract templates',
      payload: {
        count: templates.length,
        data: templates,
        message,
        page: 1,
        total,
      },
      previewKeys: ['name', 'source_file_name', 'file_name'],
    });
  },
};

export const crmDownloadContractTemplateTool: McpTool = {
  metadata: {
    resource: 'contract_templates',
    operation: 'read',
    tags: ['crm', 'contracts'],
    httpMethod: 'get',
    httpPath: '/api/v2/contracts/templates/{template_id}/download',
    operationId: 'public.contracts.templates.download',
  },
  tool: {
    name: 'download_contract_template',
    title: 'Download contract template',
    description:
      'Download an uploaded Sanka Contract template. By default this returns the retained source document when available; pass source=false to download the signing PDF.',
    inputSchema: CONTRACT_TEMPLATE_DOWNLOAD_INPUT_SCHEMA,
    outputSchema: BINARY_DOWNLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Download contract template',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Download contract template' });
    if (authError) {
      return authError;
    }
    const templateID = readString(args?.['template_id']);
    if (!templateID) {
      return asErrorResult('`template_id` is required.');
    }
    const query = buildWorkspaceQuery(args);
    const source = readBoolean(args?.['source']);
    if (source !== undefined) {
      query['source'] = source;
    }
    const response = await reqContext.client
      .v2Get<unknown>(`/contracts/templates/${encodeURIComponent(templateID)}/download`, {
        query,
      })
      .asResponse();
    return asStoredBinaryDownloadResult(reqContext, response, 'contract-template');
  },
};

export const crmUploadContractTemplateTool: McpTool = {
  metadata: {
    resource: 'contract_templates',
    operation: 'write',
    tags: ['crm', 'contracts'],
    httpMethod: 'post',
    httpPath: '/api/v2/contracts/templates',
    operationId: 'public.contracts.templates.create',
  },
  tool: {
    name: 'upload_contract_template',
    title: 'Upload contract template',
    description:
      'Upload a Contract template to Sanka from base64 PDF, DOC, or DOCX bytes. Word documents are converted to signing PDFs by the Sanka API and retained for later source download.',
    inputSchema: CONTRACT_TEMPLATE_UPLOAD_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Upload contract template',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Upload contract template' });
    if (authError) {
      return authError;
    }
    const formOrError = buildContractUploadBody(args, 'application/octet-stream');
    if ('content' in formOrError) {
      return formOrError;
    }
    const name = readString(args?.['name']);
    if (name) {
      formOrError.append('name', name);
    }
    const payload = normalizeV2MutationEnvelopePayload(
      (await reqContext.client.v2Post<Record<string, unknown>>('/contracts/templates', {
        body: formOrError,
        query: buildWorkspaceQuery(args),
      })) as unknown as Record<string, unknown>,
    );
    return {
      content: [
        {
          type: 'text',
          text: `Uploaded contract template ${
            readString(payload['name']) ?? name ?? readString(payload['id']) ?? 'document'
          }.`,
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmUploadContractPDFTool: McpTool = {
  metadata: {
    resource: 'contracts',
    operation: 'write',
    tags: ['crm', 'contracts'],
    httpMethod: 'post',
    httpPath: '/api/v2/contracts/manual-upload',
    operationId: 'public.contracts.manualUpload',
  },
  tool: {
    name: 'upload_contract_pdf',
    title: 'Upload contract PDF',
    description: 'Upload a PDF and create a draft Sanka Contract from it.',
    inputSchema: CONTRACT_PDF_UPLOAD_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Upload contract PDF',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Upload contract PDF' });
    if (authError) {
      return authError;
    }
    const formOrError = buildContractUploadBody(args, 'application/pdf');
    if ('content' in formOrError) {
      return formOrError;
    }
    const title = readString(args?.['title']);
    const fileNameOverride = readString(args?.['file_name_override']);
    if (title) {
      formOrError.append('title', title);
    }
    if (fileNameOverride) {
      formOrError.append('file_name_override', fileNameOverride);
    }
    const payload = normalizeV2MutationEnvelopePayload(
      (await reqContext.client.v2Post<Record<string, unknown>>('/contracts/manual-upload', {
        body: formOrError,
        query: buildWorkspaceQuery(args),
      })) as unknown as Record<string, unknown>,
    );
    return {
      content: [
        {
          type: 'text',
          text: `Created contract draft ${
            readString(payload['name']) ?? readString(payload['contract_id']) ?? 'uploaded PDF'
          }.`,
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmCreateContractFromTemplateTool: McpTool = {
  metadata: {
    resource: 'contracts',
    operation: 'write',
    tags: ['crm', 'contracts'],
    httpMethod: 'post',
    httpPath: '/api/v2/contracts/create-from-template',
    operationId: 'public.contracts.createFromTemplate',
  },
  tool: {
    name: 'create_contract_from_template',
    title: 'Create contract from template',
    description: 'Create a draft Sanka Contract from an uploaded contract template.',
    inputSchema: CONTRACT_CREATE_FROM_TEMPLATE_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create contract from template',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Create contract from template' });
    if (authError) {
      return authError;
    }
    const templateID = readString(args?.['template_id']);
    if (!templateID) {
      return asErrorResult('`template_id` is required.');
    }
    const payload = normalizeV2MutationEnvelopePayload(
      (await reqContext.client.v2Post<Record<string, unknown>>('/contracts/create-from-template', {
        body: buildContractCreateFromTemplateBody(args),
        query: buildContractQuery(args),
      })) as unknown as Record<string, unknown>,
    );
    return {
      content: [
        {
          type: 'text',
          text: `Created contract draft ${
            readString(payload['name']) ?? readString(payload['contract_id']) ?? templateID
          }.`,
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmGetContractWorkflowStateTool: McpTool = {
  metadata: {
    resource: 'contracts',
    operation: 'read',
    tags: ['crm', 'contracts'],
    httpMethod: 'get',
    httpPath: '/api/v2/contracts/{contract_id}/workflow-state',
    operationId: 'public.contracts.workflowState',
  },
  tool: {
    name: 'get_contract_workflow_state',
    title: 'Get contract workflow state',
    description:
      'Load a Sanka Contract workflow state including draft metadata, signers, signature fields, timeline, and editability.',
    inputSchema: CONTRACT_RETRIEVE_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get contract workflow state',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Get contract workflow state' });
    if (authError) {
      return authError;
    }
    const contractID = readString(args?.['contract_id']);
    if (!contractID) {
      return asErrorResult('`contract_id` is required.');
    }
    const payload = contractDataFromEnvelope(
      (await reqContext.client.v2Get<Record<string, unknown>>(
        `/contracts/${encodeURIComponent(contractID)}/workflow-state`,
        { query: buildWorkspaceQuery(args) },
      )) as unknown as Record<string, unknown>,
    );
    const contract = readRecord(payload['contract']);
    return {
      content: [
        {
          type: 'text',
          text: `Loaded contract workflow state for ${readString(contract?.['name']) ?? contractID}.`,
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmUpdateContractMetadataTool: McpTool = {
  metadata: {
    resource: 'contracts',
    operation: 'write',
    tags: ['crm', 'contracts'],
    httpMethod: 'patch',
    httpPath: '/api/v2/contracts/{contract_id}/metadata',
    operationId: 'public.contracts.metadata.update',
  },
  tool: {
    name: 'update_contract_metadata',
    title: 'Update contract metadata',
    description: 'Update a Sanka Contract draft name or description before sending.',
    inputSchema: CONTRACT_METADATA_UPDATE_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update contract metadata',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Update contract metadata' });
    if (authError) {
      return authError;
    }
    const contractID = readString(args?.['contract_id']);
    if (!contractID) {
      return asErrorResult('`contract_id` is required.');
    }
    const body = buildContractMetadataBody(args);
    if (Object.keys(body).length === 0) {
      return asErrorResult('At least one of `name` or `description` is required.');
    }
    const payload = normalizeV2MutationEnvelopePayload(
      (await reqContext.client.v2Patch<Record<string, unknown>>(
        `/contracts/${encodeURIComponent(contractID)}/metadata`,
        { body, query: buildWorkspaceQuery(args) },
      )) as unknown as Record<string, unknown>,
    );
    return {
      content: [{ type: 'text', text: `Updated contract metadata for ${contractID}.` }],
      structuredContent: payload,
    };
  },
};

export const crmSaveContractSignersTool: McpTool = {
  metadata: {
    resource: 'contracts',
    operation: 'write',
    tags: ['crm', 'contracts'],
    httpMethod: 'post',
    httpPath: '/api/v2/contracts/{contract_id}/signers',
    operationId: 'public.contracts.signers.save',
  },
  tool: {
    name: 'save_contract_signers',
    title: 'Save contract signers',
    description: 'Save signer rows for a Sanka Contract draft.',
    inputSchema: CONTRACT_SIGNERS_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Save contract signers',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Save contract signers' });
    if (authError) {
      return authError;
    }
    const contractID = readString(args?.['contract_id']);
    if (!contractID) {
      return asErrorResult('`contract_id` is required.');
    }
    const payload = normalizeV2MutationEnvelopePayload(
      (await reqContext.client.v2Post<Record<string, unknown>>(
        `/contracts/${encodeURIComponent(contractID)}/signers`,
        { body: buildContractSignersBody(args), query: buildWorkspaceQuery(args) },
      )) as unknown as Record<string, unknown>,
    );
    return {
      content: [{ type: 'text', text: `Saved signers for contract ${contractID}.` }],
      structuredContent: payload,
    };
  },
};

export const crmSaveContractPlaceFieldsTool: McpTool = {
  metadata: {
    resource: 'contracts',
    operation: 'write',
    tags: ['crm', 'contracts'],
    httpMethod: 'post',
    httpPath: '/api/v2/contracts/{contract_id}/place-fields',
    operationId: 'public.contracts.placeFields.save',
  },
  tool: {
    name: 'save_contract_place_fields',
    title: 'Save contract place fields',
    description: 'Save signature field placements for a Sanka Contract draft.',
    inputSchema: CONTRACT_PLACE_FIELDS_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Save contract place fields',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Save contract place fields' });
    if (authError) {
      return authError;
    }
    const contractID = readString(args?.['contract_id']);
    if (!contractID) {
      return asErrorResult('`contract_id` is required.');
    }
    const body = buildContractPlaceFieldsBody(args);
    if (!Array.isArray(body['fields'])) {
      return asErrorResult('`fields` is required.');
    }
    const payload = normalizeV2MutationEnvelopePayload(
      (await reqContext.client.v2Post<Record<string, unknown>>(
        `/contracts/${encodeURIComponent(contractID)}/place-fields`,
        { body, query: buildWorkspaceQuery(args) },
      )) as unknown as Record<string, unknown>,
    );
    return {
      content: [{ type: 'text', text: `Saved signature fields for contract ${contractID}.` }],
      structuredContent: payload,
    };
  },
};

export const crmSendContractRequestTool: McpTool = {
  metadata: {
    resource: 'contracts',
    operation: 'write',
    tags: ['crm', 'contracts'],
    httpMethod: 'post',
    httpPath: '/api/v2/contracts/{contract_id}/send-request',
    operationId: 'public.contracts.sendRequest',
  },
  tool: {
    name: 'send_contract_request',
    title: 'Send contract request',
    description: 'Send or resend a Sanka Contract signature request.',
    inputSchema: CONTRACT_SEND_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Send contract request',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Send contract request' });
    if (authError) {
      return authError;
    }
    const contractID = readString(args?.['contract_id']);
    if (!contractID) {
      return asErrorResult('`contract_id` is required.');
    }
    if (readBoolean(args?.['confirm']) !== true) {
      return asErrorResult(
        '`confirm=true` is required after explicit user approval before sending a contract signature request.',
      );
    }
    const payload = normalizeV2MutationEnvelopePayload(
      (await reqContext.client.v2Post<Record<string, unknown>>(
        `/contracts/${encodeURIComponent(contractID)}/send-request`,
        { body: buildContractSendBody(args), query: buildWorkspaceQuery(args) },
      )) as unknown as Record<string, unknown>,
    );
    return {
      content: [{ type: 'text', text: `Sent contract signature request for ${contractID}.` }],
      structuredContent: payload,
    };
  },
};

export const crmScheduleContractRequestTool: McpTool = {
  metadata: {
    resource: 'contracts',
    operation: 'write',
    tags: ['crm', 'contracts'],
    httpMethod: 'post',
    httpPath: '/api/v2/contracts/{contract_id}/schedule-send',
    operationId: 'public.contracts.scheduleRequest',
  },
  tool: {
    name: 'schedule_contract_request',
    title: 'Schedule contract request',
    description: 'Schedule a Sanka Contract signature request for later sending.',
    inputSchema: CONTRACT_SCHEDULE_SEND_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Schedule contract request',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Schedule contract request' });
    if (authError) {
      return authError;
    }
    const contractID = readString(args?.['contract_id']);
    if (!contractID) {
      return asErrorResult('`contract_id` is required.');
    }
    if (!readString(args?.['scheduled_at'])) {
      return asErrorResult('`scheduled_at` is required.');
    }
    if (readBoolean(args?.['confirm']) !== true) {
      return asErrorResult(
        '`confirm=true` is required after explicit user approval before scheduling a contract signature request.',
      );
    }
    const payload = normalizeV2MutationEnvelopePayload(
      (await reqContext.client.v2Post<Record<string, unknown>>(
        `/contracts/${encodeURIComponent(contractID)}/schedule-send`,
        { body: buildContractScheduleSendBody(args), query: buildWorkspaceQuery(args) },
      )) as unknown as Record<string, unknown>,
    );
    return {
      content: [{ type: 'text', text: `Scheduled contract signature request for ${contractID}.` }],
      structuredContent: payload,
    };
  },
};

export const crmListExpensesTool: McpTool = {
  metadata: {
    resource: 'expenses',
    operation: 'read',
    tags: ['crm', 'expenses'],
    httpMethod: 'get',
    httpPath: '/api/v2/expenses',
    operationId: 'public.expenses.list',
  },
  tool: {
    name: 'list_expenses',
    title: 'List expenses',
    description:
      'Review expenses in Sanka. Use this when the user wants to inspect recent expenses, review reimbursements, or check expense records in the current workspace.',
    inputSchema: EXPENSE_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List expenses',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List expenses',
    });
    if (authError) {
      return authError;
    }

    const { limit, params, headers } = buildExpenseListParams(args);
    const { data: payload } = await reqContext.client
      .v2Get<Record<string, unknown>>('/expenses', {
        query: params,
        ...(headers ? { headers } : undefined),
      })
      .withResponse();
    const { rows, total, page } = normalizeV2ObjectRecordListPayload(payload, 'id_pm');
    const results = rows.slice(0, limit);

    return buildListResult({
      label: 'expenses',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${total} expenses.`,
        page,
        total,
      },
      previewKeys: ['description', 'company_name', 'contact_name', 'id_pm'],
    });
  },
};

export const crmGetExpenseTool: McpTool = {
  metadata: {
    resource: 'expenses',
    operation: 'read',
    tags: ['crm', 'expenses'],
    httpMethod: 'get',
    httpPath: '/api/v2/expenses/{expense_id}',
    operationId: 'public.expenses.retrieve',
  },
  tool: {
    name: 'get_expense',
    title: 'Get expense',
    description: 'Load one expense from Sanka by expense id, PM id, or external reference.',
    inputSchema: EXPENSE_RETRIEVE_INPUT_SCHEMA,
    outputSchema: EXPENSE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get expense',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get expense',
    });
    if (authError) {
      return authError;
    }

    const { expenseID, params } = buildExpenseRetrieveParams(args);
    if (!expenseID) {
      return asErrorResult('`expense_id` is required.');
    }

    const expense = (await reqContext.client.public.expenses.retrieve(
      expenseID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;
    const expenseWithFiles = await enrichExpenseWithAttachedFiles({
      expensesClient: reqContext.client.public.expenses,
      payload: expense,
    });

    return {
      content: [{ type: 'text', text: buildExpenseDetailSummary(expenseWithFiles) }],
      structuredContent: expenseWithFiles,
    };
  },
};

export const crmUploadExpenseAttachmentTool: McpTool = {
  metadata: {
    resource: 'expenses',
    operation: 'write',
    tags: ['crm', 'expenses'],
    httpMethod: 'post',
    httpPath: '/api/v2/expenses/files',
    operationId: 'public.expenses.uploadAttachment',
  },
  tool: {
    name: 'upload_expense_attachment',
    title: 'Upload expense attachment',
    description:
      'Upload an expense attachment to Sanka from an already available base64 payload. Prefer this direct upload for ordinary receipt/invoice PDFs when the client can pass content_base64 reliably. For client-local PDFs or payloads that are too large or unreliable to pass as one content_base64 string, use start_expense_attachment_upload, append_expense_attachment_upload_chunk until done, then finish_expense_attachment_upload. Use the returned file_id in create_expense or update_expense. Ordinary receipt and invoice PDFs should be uploaded as-is; do not compress or substitute extracted text unless the original upload actually fails.',
    inputSchema: EXPENSE_UPLOAD_INPUT_SCHEMA,
    outputSchema: EXPENSE_UPLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Upload expense attachment',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Upload expense attachment',
    });
    if (authError) {
      return authError;
    }

    return uploadAttachmentFileFromArgs({
      args,
      entityName: 'expense',
      uploadAttachment: (file) => reqContext.client.public.expenses.uploadAttachment({ file }, undefined),
    });
  },
};

export const crmStartExpenseAttachmentUploadTool = expenseAttachmentUploadTools.startTool;
export const crmAppendExpenseAttachmentUploadChunkTool = expenseAttachmentUploadTools.appendTool;
export const crmFinishExpenseAttachmentUploadTool = expenseAttachmentUploadTools.finishTool;

export const crmCreateExpenseTool: McpTool = {
  metadata: {
    resource: 'expenses',
    operation: 'write',
    tags: ['crm', 'expenses'],
    httpMethod: 'post',
    httpPath: '/api/v2/expenses',
    operationId: 'public.expenses.create',
  },
  tool: {
    name: 'create_expense',
    title: 'Create expense',
    description:
      'Create an expense in Sanka. Attachments are optional when the user did not provide or require one. When a receipt or invoice is provided or required, upload the original file first: use upload_expense_attachment for already available base64 payloads, or start_expense_attachment_upload plus append_expense_attachment_upload_chunk until done and finish_expense_attachment_upload for client-local PDFs or unreliable large payloads. Attach uploaded file ids with `attachment_file_ids` in the same create call. Do not silently drop a provided or required attachment unless upload failed or the user explicitly approved skipping it. Read the created expense back with get_expense when base currency or attachment confirmation matters.',
    inputSchema: EXPENSE_CREATE_INPUT_SCHEMA,
    outputSchema: EXPENSE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create expense',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create expense',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.expenses.create(
      buildExpenseMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;
    const attachmentFileIDs = readStringArray(args?.['attachment_file_ids']);
    const responseWithFiles =
      attachmentFileIDs.length > 0 ?
        await enrichExpenseWithAttachedFiles({
          expensesClient: reqContext.client.public.expenses,
          payload: response,
          expectedAttachmentFileIDs: attachmentFileIDs,
        })
      : response;

    return {
      content: [
        {
          type: 'text',
          text: buildExpenseMutationSummary({ action: 'created', payload: responseWithFiles }),
        },
      ],
      structuredContent: responseWithFiles,
    };
  },
};

export const crmUpdateExpenseTool: McpTool = {
  metadata: {
    resource: 'expenses',
    operation: 'write',
    tags: ['crm', 'expenses'],
    httpMethod: 'patch',
    httpPath: '/api/v2/expenses/{expense_id}',
    operationId: 'public.expenses.update',
  },
  tool: {
    name: 'update_expense',
    title: 'Update expense',
    description:
      'Update an existing expense in Sanka. To attach a receipt or invoice, upload the original file first with upload_expense_attachment for already available base64 payloads, or with start_expense_attachment_upload plus append_expense_attachment_upload_chunk until done and finish_expense_attachment_upload for client-local PDFs or unreliable large payloads. Pass returned file_id values in `attachment_file_ids`.',
    inputSchema: EXPENSE_UPDATE_INPUT_SCHEMA,
    outputSchema: EXPENSE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update expense',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update expense',
    });
    if (authError) {
      return authError;
    }

    const expenseID = readString(args?.['expense_id']);
    if (!expenseID) {
      return asErrorResult('`expense_id` is required.');
    }

    const response = (await reqContext.client.public.expenses.update(
      expenseID,
      buildExpenseMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;
    const attachmentFileIDs = readStringArray(args?.['attachment_file_ids']);
    const responseWithFiles =
      attachmentFileIDs.length > 0 ?
        await enrichExpenseWithAttachedFiles({
          expensesClient: reqContext.client.public.expenses,
          payload: response,
          expectedAttachmentFileIDs: attachmentFileIDs,
        })
      : response;

    return {
      content: [
        {
          type: 'text',
          text: buildExpenseMutationSummary({ action: 'updated', payload: responseWithFiles }),
        },
      ],
      structuredContent: responseWithFiles,
    };
  },
};

export const crmDeleteExpenseTool: McpTool = {
  metadata: {
    resource: 'expenses',
    operation: 'write',
    tags: ['crm', 'expenses'],
    httpMethod: 'delete',
    httpPath: '/api/v2/expenses/{expense_id}',
    operationId: 'public.expenses.delete',
  },
  tool: {
    name: 'delete_expense',
    title: 'Delete expense',
    description: 'Delete an expense in Sanka by expense id, PM id, or external reference.',
    inputSchema: EXPENSE_DELETE_INPUT_SCHEMA,
    outputSchema: EXPENSE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete expense',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete expense',
    });
    if (authError) {
      return authError;
    }

    const expenseID = readString(args?.['expense_id']);
    const externalID = readString(args?.['external_id']);
    if (!expenseID) {
      return asErrorResult('`expense_id` is required.');
    }

    const response = (await reqContext.client.public.expenses.delete(
      expenseID,
      {
        ...(externalID ? { external_id: externalID } : undefined),
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        { type: 'text', text: buildExpenseMutationSummary({ action: 'deleted', payload: response }) },
      ],
      structuredContent: response,
    };
  },
};

export const crmListEmployeesTool: McpTool = {
  metadata: {
    resource: 'employees',
    operation: 'read',
    tags: ['crm', 'hr', 'employees'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/employees',
    operationId: 'public.employees.list',
  },
  tool: {
    name: 'list_employees',
    title: 'List employees',
    description:
      'Review the Sanka employee directory. Use this to resolve worker_id values before creating absences, attendance records, or payroll profiles.',
    inputSchema: EMPLOYEE_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List employees',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List employees' });
    if (authError) {
      return authError;
    }

    const { limit, page, params } = buildEmployeeListParams(args);
    const payload = (await reqContext.client.get('/api/v2/public/employees', {
      query: params,
    })) as Record<string, unknown>;
    const data = readDataArray(payload).slice(0, limit);
    return buildListResult({
      label: 'employees',
      payload: {
        count: data.length,
        data,
        message: readString(payload['message']) ?? `Returned ${data.length} employees.`,
        page: readNumber(payload['page'], page),
        total: readNumber(payload['total'], data.length),
        permission: readString(payload['permission']) ?? null,
      },
      previewKeys: ['id_user', 'id_worker', 'worker_id', 'name', 'email', 'role', 'status'],
    });
  },
};

export const crmListAbsencesTool: McpTool = {
  metadata: {
    resource: 'absences',
    operation: 'read',
    tags: ['crm', 'hr', 'absences'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/absences',
    operationId: 'public.absences.list',
  },
  tool: {
    name: 'list_absences',
    title: 'List absences',
    description:
      'Review leave and absence records in Sanka. Use this for vacation, PTO, sick leave, and other absence requests.',
    inputSchema: ABSENCE_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List absences',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List absences' });
    if (authError) {
      return authError;
    }

    const { limit, page, params } = buildAbsenceListParams(args);
    const payload = (await reqContext.client.get('/api/v2/public/absences', {
      query: params,
    })) as Record<string, unknown>;
    const data = readDataArray(payload).slice(0, limit);
    return buildListResult({
      label: 'absences',
      payload: {
        count: data.length,
        data,
        message: readString(payload['message']) ?? `Returned ${data.length} absences.`,
        page: readNumber(payload['page'], page),
        total: readNumber(payload['total'], data.length),
      },
      previewKeys: ['absence_id', 'absence_type', 'status', 'worker_name', 'start_date', 'end_date'],
    });
  },
};

export const crmGetAbsenceTool: McpTool = {
  metadata: {
    resource: 'absences',
    operation: 'read',
    tags: ['crm', 'hr', 'absences'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/absences/{absence_id}',
    operationId: 'public.absences.retrieve',
  },
  tool: {
    name: 'get_absence',
    title: 'Get absence',
    description: 'Load one leave or absence record from Sanka by UUID or workspace absence number.',
    inputSchema: ABSENCE_RETRIEVE_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get absence',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Get absence' });
    if (authError) {
      return authError;
    }
    const absenceID = readString(args?.['absence_id']);
    if (!absenceID) {
      return asErrorResult('`absence_id` is required.');
    }
    const payload = (await reqContext.client.get(`/api/v2/public/absences/${encodeURIComponent(absenceID)}`, {
      query: buildWorkspaceQuery(args),
    })) as Record<string, unknown>;
    return {
      content: [
        { type: 'text', text: `Loaded absence ${payload['absence_id'] ?? payload['id'] ?? absenceID}.` },
      ],
      structuredContent: payload,
    };
  },
};

export const crmCreateAbsenceTool: McpTool = {
  metadata: {
    resource: 'absences',
    operation: 'write',
    tags: ['crm', 'hr', 'absences'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/absences',
    operationId: 'public.absences.create',
  },
  tool: {
    name: 'create_absence',
    title: 'Create absence',
    description: 'Create a leave or absence request in Sanka.',
    inputSchema: ABSENCE_CREATE_INPUT_SCHEMA,
    outputSchema: RECORD_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create absence',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Create absence' });
    if (authError) {
      return authError;
    }
    const response = (await reqContext.client.post('/api/v2/public/absences', {
      body: buildAbsenceMutationBody(args),
    })) as Record<string, unknown>;
    return {
      content: [
        {
          type: 'text',
          text: buildRecordMutationSummary({
            entity: 'Absence',
            action: 'created',
            payload: response,
            idKeys: ['absence_id', 'id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateAbsenceTool: McpTool = {
  metadata: {
    resource: 'absences',
    operation: 'write',
    tags: ['crm', 'hr', 'absences'],
    httpMethod: 'put',
    httpPath: '/api/v2/public/absences/{absence_id}',
    operationId: 'public.absences.update',
  },
  tool: {
    name: 'update_absence',
    title: 'Update absence',
    description: 'Update an existing leave or absence record in Sanka.',
    inputSchema: ABSENCE_UPDATE_INPUT_SCHEMA,
    outputSchema: RECORD_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update absence',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Update absence' });
    if (authError) {
      return authError;
    }
    const absenceID = readString(args?.['absence_id']);
    if (!absenceID) {
      return asErrorResult('`absence_id` is required.');
    }
    const response = (await reqContext.client.put(
      `/api/v2/public/absences/${encodeURIComponent(absenceID)}`,
      {
        body: buildAbsenceMutationBody(args),
      },
    )) as Record<string, unknown>;
    return {
      content: [
        {
          type: 'text',
          text: buildRecordMutationSummary({
            entity: 'Absence',
            action: 'updated',
            payload: response,
            idKeys: ['absence_id', 'id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteAbsenceTool: McpTool = {
  metadata: {
    resource: 'absences',
    operation: 'write',
    tags: ['crm', 'hr', 'absences'],
    httpMethod: 'delete',
    httpPath: '/api/v2/public/absences/{absence_id}',
    operationId: 'public.absences.delete',
  },
  tool: {
    name: 'delete_absence',
    title: 'Delete absence',
    description: 'Archive/delete an absence record in Sanka.',
    inputSchema: ABSENCE_RETRIEVE_INPUT_SCHEMA,
    outputSchema: RECORD_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete absence',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Delete absence' });
    if (authError) {
      return authError;
    }
    const absenceID = readString(args?.['absence_id']);
    if (!absenceID) {
      return asErrorResult('`absence_id` is required.');
    }
    const response = (await reqContext.client.delete(
      `/api/v2/public/absences/${encodeURIComponent(absenceID)}`,
      {
        query: buildWorkspaceQuery(args),
      },
    )) as Record<string, unknown>;
    return {
      content: [
        {
          type: 'text',
          text: buildRecordMutationSummary({
            entity: 'Absence',
            action: 'deleted',
            payload: response,
            idKeys: ['absence_id', 'id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListAttendanceRecordsTool: McpTool = {
  metadata: {
    resource: 'attendance_records',
    operation: 'read',
    tags: ['crm', 'hr', 'attendance_records'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/attendance-records',
    operationId: 'public.attendanceRecords.list',
  },
  tool: {
    name: 'list_attendance_records',
    title: 'List attendance records',
    description:
      'Review Sanka work attendance records. This is for employee attendance/time tracking, not public calendar attendance bookings.',
    inputSchema: ATTENDANCE_RECORD_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List attendance records',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List attendance records' });
    if (authError) {
      return authError;
    }
    const { limit, page, params } = buildAttendanceRecordListParams(args);
    const payload = (await reqContext.client.get('/api/v2/public/attendance-records', {
      query: params,
    })) as Record<string, unknown>;
    const data = readDataArray(payload).slice(0, limit);
    return buildListResult({
      label: 'attendance records',
      payload: {
        count: data.length,
        data,
        message: readString(payload['message']) ?? `Returned ${data.length} attendance records.`,
        page: readNumber(payload['page'], page),
        total: readNumber(payload['total'], data.length),
      },
      previewKeys: ['track_id', 'external_id', 'name', 'status', 'start_time', 'duration'],
    });
  },
};

export const crmGetAttendanceRecordTool: McpTool = {
  metadata: {
    resource: 'attendance_records',
    operation: 'read',
    tags: ['crm', 'hr', 'attendance_records'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/attendance-records/{attendance_record_id}',
    operationId: 'public.attendanceRecords.retrieve',
  },
  tool: {
    name: 'get_attendance_record',
    title: 'Get attendance record',
    description: 'Load one employee attendance record by UUID, numeric track id, or external_id.',
    inputSchema: ATTENDANCE_RECORD_RETRIEVE_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get attendance record',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Get attendance record' });
    if (authError) {
      return authError;
    }
    const attendanceRecordID = readString(args?.['attendance_record_id']);
    if (!attendanceRecordID) {
      return asErrorResult('`attendance_record_id` is required.');
    }
    const payload = (await reqContext.client.get(
      `/api/v2/public/attendance-records/${encodeURIComponent(attendanceRecordID)}`,
      {
        query: buildWorkspaceQuery(args),
      },
    )) as Record<string, unknown>;
    return {
      content: [{ type: 'text', text: `Loaded attendance record ${payload['track_id'] ?? payload['id']}.` }],
      structuredContent: payload,
    };
  },
};

export const crmCreateAttendanceRecordTool: McpTool = {
  metadata: {
    resource: 'attendance_records',
    operation: 'write',
    tags: ['crm', 'hr', 'attendance_records'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/attendance-records',
    operationId: 'public.attendanceRecords.create',
  },
  tool: {
    name: 'create_attendance_record',
    title: 'Create attendance record',
    description: 'Create an employee attendance/time tracking record in Sanka.',
    inputSchema: ATTENDANCE_RECORD_CREATE_INPUT_SCHEMA,
    outputSchema: RECORD_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create attendance record',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Create attendance record' });
    if (authError) {
      return authError;
    }
    const response = (await reqContext.client.post('/api/v2/public/attendance-records', {
      body: buildAttendanceRecordMutationBody(args),
    })) as Record<string, unknown>;
    return {
      content: [
        {
          type: 'text',
          text: buildRecordMutationSummary({
            entity: 'Attendance record',
            action: 'created',
            payload: response,
            idKeys: ['track_id', 'external_id', 'id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateAttendanceRecordTool: McpTool = {
  metadata: {
    resource: 'attendance_records',
    operation: 'write',
    tags: ['crm', 'hr', 'attendance_records'],
    httpMethod: 'put',
    httpPath: '/api/v2/public/attendance-records/{attendance_record_id}',
    operationId: 'public.attendanceRecords.update',
  },
  tool: {
    name: 'update_attendance_record',
    title: 'Update attendance record',
    description: 'Update an employee attendance/time tracking record in Sanka.',
    inputSchema: ATTENDANCE_RECORD_UPDATE_INPUT_SCHEMA,
    outputSchema: RECORD_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update attendance record',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Update attendance record' });
    if (authError) {
      return authError;
    }
    const attendanceRecordID = readString(args?.['attendance_record_id']);
    if (!attendanceRecordID) {
      return asErrorResult('`attendance_record_id` is required.');
    }
    const response = (await reqContext.client.put(
      `/api/v2/public/attendance-records/${encodeURIComponent(attendanceRecordID)}`,
      {
        body: buildAttendanceRecordMutationBody(args),
      },
    )) as Record<string, unknown>;
    return {
      content: [
        {
          type: 'text',
          text: buildRecordMutationSummary({
            entity: 'Attendance record',
            action: 'updated',
            payload: response,
            idKeys: ['track_id', 'external_id', 'id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteAttendanceRecordTool: McpTool = {
  metadata: {
    resource: 'attendance_records',
    operation: 'write',
    tags: ['crm', 'hr', 'attendance_records'],
    httpMethod: 'delete',
    httpPath: '/api/v2/public/attendance-records/{attendance_record_id}',
    operationId: 'public.attendanceRecords.delete',
  },
  tool: {
    name: 'delete_attendance_record',
    title: 'Delete attendance record',
    description: 'Archive/delete an employee attendance record in Sanka.',
    inputSchema: ATTENDANCE_RECORD_RETRIEVE_INPUT_SCHEMA,
    outputSchema: RECORD_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete attendance record',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Delete attendance record' });
    if (authError) {
      return authError;
    }
    const attendanceRecordID = readString(args?.['attendance_record_id']);
    if (!attendanceRecordID) {
      return asErrorResult('`attendance_record_id` is required.');
    }
    const response = (await reqContext.client.delete(
      `/api/v2/public/attendance-records/${encodeURIComponent(attendanceRecordID)}`,
      {
        query: buildWorkspaceQuery(args),
      },
    )) as Record<string, unknown>;
    return {
      content: [
        {
          type: 'text',
          text: buildRecordMutationSummary({
            entity: 'Attendance record',
            action: 'deleted',
            payload: response,
            idKeys: ['track_id', 'external_id', 'id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListPayrollProfilesTool: McpTool = {
  metadata: {
    resource: 'payroll_profiles',
    operation: 'read',
    tags: ['crm', 'hr', 'payroll'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/payroll/profiles',
    operationId: 'public.payroll.profiles.list',
  },
  tool: {
    name: 'list_payroll_profiles',
    title: 'List payroll profiles',
    description: 'Review employee payroll profiles in Sanka.',
    inputSchema: PAYROLL_PROFILE_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List payroll profiles',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List payroll profiles' });
    if (authError) {
      return authError;
    }
    const params = buildWorkspaceQuery(args);
    assignStringFields(params, args, ['employee_id']);
    const payload = (await reqContext.client.get('/api/v2/public/payroll/profiles', {
      query: params,
    })) as Record<string, unknown>;
    const data = readDataArray(payload);
    return buildListResult({
      label: 'payroll profiles',
      payload: {
        count: readNumber(payload['count'], data.length),
        data,
        message: readString(payload['message']) ?? `Returned ${data.length} payroll profiles.`,
        page: 1,
        total: readNumber(payload['count'], data.length),
      },
      previewKeys: ['employee_name', 'pay_type', 'base_salary', 'jurisdiction_country_code'],
    });
  },
};

export const crmUpsertPayrollProfileTool: McpTool = {
  metadata: {
    resource: 'payroll_profiles',
    operation: 'write',
    tags: ['crm', 'hr', 'payroll'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/payroll/profiles',
    operationId: 'public.payroll.profiles.upsert',
  },
  tool: {
    name: 'upsert_payroll_profile',
    title: 'Upsert payroll profile',
    description: 'Create or update an employee payroll profile in Sanka.',
    inputSchema: PAYROLL_PROFILE_INPUT_SCHEMA,
    outputSchema: RECORD_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Upsert payroll profile',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Upsert payroll profile' });
    if (authError) {
      return authError;
    }
    const employeeID = readString(args?.['employee_id']);
    if (!employeeID) {
      return asErrorResult('`employee_id` is required.');
    }
    const response = (await reqContext.client.post('/api/v2/public/payroll/profiles', {
      body: buildPayrollProfileBody(args),
    })) as Record<string, unknown>;
    return {
      content: [
        {
          type: 'text',
          text: buildRecordMutationSummary({
            entity: 'Payroll profile',
            action: 'upserted',
            payload: response,
            idKeys: ['employee_id', 'id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListPayrollRunsTool: McpTool = {
  metadata: {
    resource: 'payroll_runs',
    operation: 'read',
    tags: ['crm', 'hr', 'payroll'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/payroll/runs',
    operationId: 'public.payroll.runs.list',
  },
  tool: {
    name: 'list_payroll_runs',
    title: 'List payroll runs',
    description: 'Review payroll runs in Sanka.',
    inputSchema: PAYROLL_RUN_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List payroll runs',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List payroll runs' });
    if (authError) {
      return authError;
    }
    const payload = (await reqContext.client.get('/api/v2/public/payroll/runs', {
      query: buildPayrollRunListParams(args),
    })) as Record<string, unknown>;
    const data = readDataArray(payload);
    return buildListResult({
      label: 'payroll runs',
      payload: {
        count: readNumber(payload['count'], data.length),
        data,
        message: readString(payload['message']) ?? `Returned ${data.length} payroll runs.`,
        page: 1,
        total: readNumber(payload['count'], data.length),
      },
      previewKeys: ['period', 'status', 'employee_count', 'total_net_pay'],
    });
  },
};

export const crmGetPayrollRunTool: McpTool = {
  metadata: {
    resource: 'payroll_runs',
    operation: 'read',
    tags: ['crm', 'hr', 'payroll'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/payroll/runs/{run_id}',
    operationId: 'public.payroll.runs.retrieve',
  },
  tool: {
    name: 'get_payroll_run',
    title: 'Get payroll run',
    description: 'Load a payroll run and employee calculation results from Sanka.',
    inputSchema: PAYROLL_RUN_RETRIEVE_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get payroll run',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Get payroll run' });
    if (authError) {
      return authError;
    }
    const runID = readString(args?.['run_id']);
    if (!runID) {
      return asErrorResult('`run_id` is required.');
    }
    const payload = (await reqContext.client.get(`/api/v2/public/payroll/runs/${encodeURIComponent(runID)}`, {
      query: buildWorkspaceQuery(args),
    })) as Record<string, unknown>;
    const data = readPayloadDataRecord(payload);
    const run = readRecord(data['run']) ?? data;
    return {
      content: [{ type: 'text', text: `Loaded payroll run ${run['period'] ?? runID}.` }],
      structuredContent: payload,
    };
  },
};

export const crmDownloadPayrollPayslipPDFTool: McpTool = {
  metadata: {
    resource: 'payroll_runs',
    operation: 'read',
    tags: ['crm', 'hr', 'payroll'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/payroll/runs/{run_id}/payslips/pdf',
    operationId: 'public.payroll.runs.payslips.downloadPDF',
  },
  tool: {
    name: 'download_payroll_payslip_pdf',
    title: 'Download payroll payslip PDF',
    description:
      'Download payroll payslips from Sanka as a PDF document. Pass result_id or employee_id for one employee, or omit both to download the full payroll run.',
    inputSchema: PAYROLL_PAYSLIP_PDF_INPUT_SCHEMA,
    outputSchema: BINARY_DOWNLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Download payroll payslip PDF',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Download payroll payslip PDF' });
    if (authError) {
      return authError;
    }
    const { runID, params } = buildPayrollPayslipDownloadParams(args);
    if (!runID) {
      return asErrorResult('`run_id` is required.');
    }
    const response = await reqContext.client
      .get(`/api/v2/public/payroll/runs/${encodeURIComponent(runID)}/payslips/pdf`, {
        query: params,
      })
      .asResponse();
    return asStoredBinaryDownloadResult(reqContext, response, 'payroll-payslip.pdf');
  },
};

export const crmCalculatePayrollRunTool: McpTool = {
  metadata: {
    resource: 'payroll_runs',
    operation: 'write',
    tags: ['crm', 'hr', 'payroll'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/payroll/runs/calculate',
    operationId: 'public.payroll.runs.calculate',
  },
  tool: {
    name: 'calculate_payroll_run',
    title: 'Calculate payroll run',
    description: 'Calculate a payroll run for a period in Sanka.',
    inputSchema: PAYROLL_RUN_CALCULATE_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Calculate payroll run',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Calculate payroll run' });
    if (authError) {
      return authError;
    }
    if (!readString(args?.['period'])) {
      return asErrorResult('`period` is required.');
    }
    const response = (await reqContext.client.post('/api/v2/public/payroll/runs/calculate', {
      body: buildPayrollRunCalculateBody(args),
    })) as Record<string, unknown>;
    const data = readPayloadDataRecord(response);
    const run = readRecord(data['run']) ?? data;
    return {
      content: [
        {
          type: 'text',
          text: `Payroll run calculated: ${run['period'] ?? run['id'] ?? readString(args?.['period'])}.`,
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmCreatePayrollJournalEntryTool: McpTool = {
  metadata: {
    resource: 'payroll_runs',
    operation: 'write',
    tags: ['crm', 'hr', 'payroll', 'journals'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/payroll/runs/{run_id}/journal-entry',
    operationId: 'public.payroll.runs.journalEntry.create',
  },
  tool: {
    name: 'create_payroll_journal_entry',
    title: 'Create payroll journal entry',
    description:
      'Create or reuse one monthly Sanka Journal Entry from a payroll run. Use after calculate_payroll_run when the user wants payroll posted to accounting.',
    inputSchema: PAYROLL_JOURNAL_ENTRY_INPUT_SCHEMA,
    outputSchema: RECORD_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create payroll journal entry',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Create payroll journal entry' });
    if (authError) {
      return authError;
    }
    const runID = readString(args?.['run_id']);
    if (!runID) {
      return asErrorResult('`run_id` is required.');
    }
    const response = (await reqContext.client.post(
      `/api/v2/public/payroll/runs/${encodeURIComponent(runID)}/journal-entry`,
      {
        query: buildWorkspaceQuery(args),
        body: buildPayrollJournalEntryBody(args),
      },
    )) as Record<string, unknown>;
    const data = readPayloadDataRecord(response);
    const journalID = data['id_journal'] ?? data['id'] ?? runID;
    const created = data['created'] === false ? 'already exists' : 'created';
    return {
      content: [
        {
          type: 'text',
          text: `Payroll journal entry ${created}: ${journalID}.`,
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmApprovePayrollRunTool: McpTool = {
  metadata: {
    resource: 'payroll_runs',
    operation: 'write',
    tags: ['crm', 'hr', 'payroll'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/payroll/runs/{run_id}/approve',
    operationId: 'public.payroll.runs.approve',
  },
  tool: {
    name: 'approve_payroll_run',
    title: 'Approve payroll run',
    description: 'Approve a calculated payroll run in Sanka after the user explicitly confirms approval.',
    inputSchema: PAYROLL_RUN_RETRIEVE_INPUT_SCHEMA,
    outputSchema: RECORD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Approve payroll run',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Approve payroll run' });
    if (authError) {
      return authError;
    }
    const runID = readString(args?.['run_id']);
    if (!runID) {
      return asErrorResult('`run_id` is required.');
    }
    const response = (await reqContext.client.post(
      `/api/v2/public/payroll/runs/${encodeURIComponent(runID)}/approve`,
      {
        query: buildWorkspaceQuery(args),
      },
    )) as Record<string, unknown>;
    const data = readPayloadDataRecord(response);
    const run = readRecord(data['run']) ?? data;
    return {
      content: [
        {
          type: 'text',
          text: `Payroll run approved: ${run['period'] ?? run['id'] ?? runID}.`,
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListIncentivesTool: McpTool = {
  metadata: {
    resource: 'incentives',
    operation: 'read',
    tags: ['crm', 'incentives', 'finance'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/incentives',
    operationId: 'public.incentives.list',
  },
  tool: {
    name: 'list_incentives',
    title: 'List incentives',
    description:
      'Review calculated incentive and commission records in Sanka. Use this for partner commission or employee incentive payout checks.',
    inputSchema: INCENTIVE_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List incentives',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List incentives',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildIncentiveListParams(args);
    const payload = (await reqContext.client.get('/api/v2/public/incentives', {
      query: params,
    })) as Record<string, unknown>;
    const incentives = readDataArray(payload);
    const dataRecord = readPayloadDataRecord(payload);
    const results = incentives.slice(0, limit).map((incentive) => incentive as Record<string, unknown>);
    const total = readNumber(dataRecord['total'], incentives.length);
    const page = readNumber(dataRecord['page'], Number(params['page'] ?? 1));

    return buildListResult({
      label: 'incentives',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${total} incentives.`,
        page,
        total,
      },
      previewKeys: ['payee_company_name', 'owner_name', 'plan_name', 'source_label', 'id_inc'],
    });
  },
};

export const crmListIncentivePlansTool: McpTool = {
  metadata: {
    resource: 'incentives',
    operation: 'read',
    tags: ['crm', 'incentives', 'finance'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/incentives/plans',
    operationId: 'public.incentives.plans.list',
  },
  tool: {
    name: 'list_incentive_plans',
    title: 'List incentive plans',
    description: 'Review active and inactive incentive rules in Sanka.',
    inputSchema: INCENTIVE_PLAN_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List incentive plans',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List incentive plans',
    });
    if (authError) {
      return authError;
    }

    const payload = (await reqContext.client.get('/api/v2/public/incentives/plans', {
      query: buildIncentivePlanListParams(args),
    })) as Record<string, unknown>;
    const plans = readDataArray(payload);

    return buildListResult({
      label: 'incentive plans',
      payload: {
        count: plans.length,
        data: plans,
        message: `Returned ${plans.length} incentive plans.`,
        page: 1,
        total: plans.length,
      },
      previewKeys: ['name', 'base_event', 'payee_company_name'],
    });
  },
};

export const crmListIncentiveCompanyOptionsTool: McpTool = {
  metadata: {
    resource: 'incentives',
    operation: 'read',
    tags: ['crm', 'incentives', 'finance', 'companies'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/incentives/company-options',
    operationId: 'public.incentives.companyOptions.list',
  },
  tool: {
    name: 'list_incentive_company_options',
    title: 'List incentive company options',
    description: 'Search companies that can be used as incentive source companies or partner company payees.',
    inputSchema: INCENTIVE_COMPANY_OPTIONS_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List incentive company options',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List incentive company options',
    });
    if (authError) {
      return authError;
    }

    const payload = (await reqContext.client.get('/api/v2/public/incentives/company-options', {
      query: buildIncentiveCompanyOptionsParams(args),
    })) as Record<string, unknown>;
    const companies = readDataArray(payload);

    return buildListResult({
      label: 'incentive company options',
      payload: {
        count: companies.length,
        data: companies,
        message: `Returned ${companies.length} company options.`,
        page: 1,
        total: companies.length,
      },
      previewKeys: ['label', 'id'],
    });
  },
};

export const crmCreateIncentivePlanTool: McpTool = {
  metadata: {
    resource: 'incentives',
    operation: 'write',
    tags: ['crm', 'incentives', 'finance'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/incentives/plans',
    operationId: 'public.incentives.plans.create',
  },
  tool: {
    name: 'create_incentive_plan',
    title: 'Create incentive plan',
    description:
      'Create an incentive or partner commission rule in Sanka. Use company payee type for partner commissions.',
    inputSchema: INCENTIVE_PLAN_CREATE_INPUT_SCHEMA,
    outputSchema: INCENTIVE_ACTION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create incentive plan',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create incentive plan',
    });
    if (authError) {
      return authError;
    }

    const body = buildIncentivePlanCreateBody(args);
    if (!readString(body['name'])) {
      return asErrorResult('`name` is required.');
    }
    if (!readString(body['base_event'])) {
      return asErrorResult('`base_event` is required.');
    }
    if (!readString(body['rate_type'])) {
      return asErrorResult('`rate_type` is required.');
    }
    if (typeof body['rate_value'] !== 'number') {
      return asErrorResult('`rate_value` is required.');
    }
    if (!readString(body['effective_from'])) {
      return asErrorResult('`effective_from` is required.');
    }

    const response = (await reqContext.client.post('/api/v2/public/incentives/plans', {
      body,
      query: buildIncentiveWorkspaceQuery(args),
    })) as Record<string, unknown>;

    return {
      content: [
        { type: 'text', text: buildIncentiveMutationSummary({ action: 'plan created', payload: response }) },
      ],
      structuredContent: response,
    };
  },
};

export const crmCalculateIncentivesTool: McpTool = {
  metadata: {
    resource: 'incentives',
    operation: 'write',
    tags: ['crm', 'incentives', 'finance'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/incentives/calculate',
    operationId: 'public.incentives.calculate',
  },
  tool: {
    name: 'calculate_incentives',
    title: 'Calculate incentives',
    description:
      'Calculate incentives for a period. Defaults to dry_run=true for a safe preview; set dry_run=false only when the user explicitly wants drafts stored.',
    inputSchema: INCENTIVE_CALCULATE_INPUT_SCHEMA,
    outputSchema: INCENTIVE_ACTION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Calculate incentives',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Calculate incentives',
    });
    if (authError) {
      return authError;
    }

    const body = buildIncentiveCalculateBody(args);
    if (!readString(body['period'])) {
      return asErrorResult('`period` is required.');
    }
    if (body['dry_run'] === undefined) {
      body['dry_run'] = true;
    }

    const response = (await reqContext.client.post('/api/v2/public/incentives/calculate', {
      body,
      query: buildIncentiveWorkspaceQuery(args),
    })) as Record<string, unknown>;
    const data = readRecord(response['data']) ?? {};
    const summary = readRecord(data['summary']) ?? {};
    const storedCount = typeof summary['stored_count'] === 'number' ? summary['stored_count'] : 0;
    const candidateCount = typeof summary['candidate_count'] === 'number' ? summary['candidate_count'] : 0;
    const dryRun = readBoolean(summary['dry_run']) ?? readBoolean(body['dry_run']) ?? false;

    return {
      content: [
        {
          type: 'text',
          text:
            dryRun ?
              `Previewed ${candidateCount} incentive candidates.`
            : `Calculated incentives and stored ${storedCount} drafts from ${candidateCount} candidates.`,
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmApproveIncentivesTool: McpTool = {
  metadata: {
    resource: 'incentives',
    operation: 'write',
    tags: ['crm', 'incentives', 'finance'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/incentives/approve-bulk',
    operationId: 'public.incentives.approve',
  },
  tool: {
    name: 'approve_incentives',
    title: 'Approve incentives',
    description: 'Approve one or more draft incentives after the user explicitly confirms approval.',
    inputSchema: INCENTIVE_APPROVE_INPUT_SCHEMA,
    outputSchema: INCENTIVE_ACTION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Approve incentives',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Approve incentives',
    });
    if (authError) {
      return authError;
    }

    const incentiveID = readString(args?.['incentive_id']);
    const ids = readStringArray(args?.['ids']);
    if (!incentiveID && ids.length === 0) {
      return asErrorResult('`incentive_id` or `ids` is required.');
    }

    const query = buildIncentiveWorkspaceQuery(args);
    const response =
      ids.length > 0 ?
        ((await reqContext.client.post('/api/v2/public/incentives/approve-bulk', {
          body: { ids },
          query,
        })) as Record<string, unknown>)
      : ((await reqContext.client.post(`/api/v2/public/incentives/${incentiveID}/approve`, {
          query,
        })) as Record<string, unknown>);

    return {
      content: [
        { type: 'text', text: buildIncentiveMutationSummary({ action: 'approved', payload: response }) },
      ],
      structuredContent: response,
    };
  },
};

export const crmGenerateIncentivePaymentNoticeTool: McpTool = {
  metadata: {
    resource: 'incentives',
    operation: 'read',
    tags: ['crm', 'incentives', 'finance'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/incentives',
    operationId: 'public.incentives.paymentNotice.generate',
  },
  tool: {
    name: 'generate_incentive_payment_notice',
    title: 'Generate incentive payment notice',
    description:
      'Generate a Japanese partner payment request notice from calculated incentive rows. This does not create or update Sanka records.',
    inputSchema: INCENTIVE_NOTICE_INPUT_SCHEMA,
    outputSchema: INCENTIVE_NOTICE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Generate incentive payment notice',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Generate incentive payment notice',
    });
    if (authError) {
      return authError;
    }

    const periodFrom = readString(args?.['period_from']);
    const periods = periodFrom ? periodsBetween(periodFrom, readString(args?.['period_to'])) : [];
    if (!periodFrom || periods.length === 0) {
      return asErrorResult('`period_from` must be YYYY-MM.');
    }

    const payeeCompanyID = readString(args?.['payee_company_id']);
    const payeeCompanyName = readString(args?.['payee_company_name']);
    const status = readString(args?.['status']);
    const workspaceID = readString(args?.['workspace_id']);
    const language = readString(args?.['language']);
    const rows: Array<Record<string, unknown>> = [];

    for (const period of periods) {
      const payload = (await reqContext.client.get('/api/v2/public/incentives', {
        query: {
          period,
          limit: 100,
          page: 1,
          ...(status ? { status } : undefined),
          ...(workspaceID ? { workspace_id: workspaceID } : undefined),
          ...(language ? { 'Accept-Language': language } : undefined),
        },
      })) as Record<string, unknown>;
      const incentives = readDataArray(payload);
      rows.push(
        ...incentives.filter((row) => {
          if (!payeeCompanyID) {
            return true;
          }
          return readString(row['payee_company_id']) === payeeCompanyID;
        }),
      );
    }

    const requestDate = readString(args?.['request_date']) ?? new Date().toISOString().slice(0, 10);
    const { notice, totalPayout, totalBaseAmount } = buildIncentiveNotice({
      rows,
      periods,
      requestDate,
      ...(payeeCompanyName ? { payeeCompanyName } : undefined),
    });

    return {
      content: [{ type: 'text', text: notice }],
      structuredContent: {
        notice,
        count: rows.length,
        total_payout: totalPayout,
        total_base_amount: totalBaseAmount,
        periods,
        results: rows,
      },
    };
  },
};

export const crmListDealsTool: McpTool = {
  metadata: {
    resource: 'deals',
    operation: 'read',
    tags: ['crm', 'deals'],
    httpMethod: 'get',
    httpPath: '/api/v2/deals',
    operationId: 'public.deals.list',
  },
  tool: {
    name: 'list_deals',
    title: 'List deals',
    description:
      'Review deals. By default this lists Sanka pipeline records; use scope="integration" with provider="hubspot" or provider="salesforce" to read live CRM-side deals/opportunities from the connected channel.',
    inputSchema: DEAL_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List deals',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List deals',
    });
    if (authError) {
      return authError;
    }

    const filtersError = invalidRecordFiltersResult(args?.['filters']);
    if (filtersError) {
      return filtersError;
    }

    if (hasDealRecordRoutingArgs(args)) {
      const body = buildDealRecordQueryBody(args);
      const rawPayload = (await reqContext.client.post(recordQueryPathForBody(body), {
        body,
      })) as Record<string, unknown>;
      const payload = normalizeRecordQueryPayload(rawPayload, body) as {
        count: number;
        data: Array<Record<string, unknown>>;
        message: string;
        page: number;
        total: number;
        permission?: string | null;
      };
      return buildListResult({
        label: 'deals',
        payload,
        previewKeys: ['name', 'case_status', 'stage_key', 'deal_id'],
        includeStructuredTextPreview: true,
      });
    }

    const { limit, params } = buildDealListParams(args);
    const deals = await reqContext.client.public.deals.list(params, undefined);
    const results = deals.slice(0, limit).map((deal) => deal as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'deals',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${deals.length} deals.`,
        page: 1,
        total: deals.length,
      },
      previewKeys: ['name', 'stage_label', 'deal_id'],
      includeStructuredTextPreview: true,
    });
  },
};

export const crmGetDealTool: McpTool = {
  metadata: {
    resource: 'deals',
    operation: 'read',
    tags: ['crm', 'deals'],
    httpMethod: 'get',
    httpPath: '/api/v2/deals/{case_id}',
    operationId: 'public.deals.retrieve',
  },
  tool: {
    name: 'get_deal',
    title: 'Get deal',
    description: 'Load one deal from Sanka by case id, deal numeric id, or external reference.',
    inputSchema: DEAL_RETRIEVE_INPUT_SCHEMA,
    outputSchema: DEAL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get deal',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get deal',
    });
    if (authError) {
      return authError;
    }

    const { caseID, params } = buildDealRetrieveParams(args);
    if (!caseID) {
      return asErrorResult('`case_id` is required.');
    }

    const deal = (await reqContext.client.public.deals.retrieve(
      caseID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildDealDetailSummary(deal) }],
      structuredContent: deal,
    };
  },
};

export const crmListDealPipelinesTool: McpTool = {
  metadata: {
    resource: 'deals',
    operation: 'read',
    tags: ['crm', 'deals'],
    httpMethod: 'get',
    httpPath: '/api/v2/deals/pipelines',
    operationId: 'public.deals.listPipelines',
  },
  tool: {
    name: 'list_deal_pipelines',
    title: 'List deal pipelines',
    description:
      'Discover the deal pipelines and stages defined in the current workspace. Use this when the user wants to understand pipeline structure, list available stages, or describe deal positions in context.',
    inputSchema: DEAL_PIPELINES_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List deal pipelines',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List deal pipelines',
    });
    if (authError) {
      return authError;
    }

    const workspaceID = readString(args?.['workspace_id']);
    const params = workspaceID ? { workspace_id: workspaceID } : {};
    const pipelines = await reqContext.client.public.deals.listPipelines(params, undefined);
    const results = pipelines.map((pipeline) => pipeline as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'deal pipelines',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} deal pipelines.`,
        page: 1,
        total: results.length,
      },
      previewKeys: ['name', 'internal_name'],
    });
  },
};

export const crmCapturePipelineSnapshotTool: McpTool = {
  metadata: {
    resource: 'pipeline_snapshots',
    operation: 'write',
    tags: ['crm', 'deals', 'pipeline_snapshots'],
    httpMethod: 'post',
    httpPath: '/api/v2/pipeline-snapshots/capture',
    operationId: 'pipeline_snapshots.capture',
  },
  tool: {
    name: 'capture_pipeline_snapshot',
    title: 'Capture pipeline snapshot',
    description:
      'Capture a point-in-time pipeline snapshot from Sanka Deals or live HubSpot Deals. Use source_system="hubspot" with a connected channel_id for HubSpot snapshot demos.',
    inputSchema: PIPELINE_SNAPSHOT_CAPTURE_INPUT_SCHEMA,
    outputSchema: PIPELINE_SNAPSHOT_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Capture pipeline snapshot',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Capture pipeline snapshot',
    });
    if (authError) {
      return authError;
    }

    const { sourceSystem, body } = buildPipelineSnapshotCaptureBody(args);
    if (sourceSystem === 'hubspot' && !readString(body['channel_id'])) {
      return asErrorResult('`channel_id` is required when `source_system` is "hubspot".');
    }

    const path =
      sourceSystem === 'hubspot' ?
        '/api/v2/pipeline-snapshots/hubspot/capture'
      : '/api/v2/pipeline-snapshots/capture';
    const payload = (await reqContext.client.post(path, { body })) as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildPipelineSnapshotCaptureSummary(payload) }],
      structuredContent: payload,
    };
  },
};

export const crmListPipelineSnapshotBatchesTool: McpTool = {
  metadata: {
    resource: 'pipeline_snapshots',
    operation: 'read',
    tags: ['crm', 'deals', 'pipeline_snapshots'],
    httpMethod: 'get',
    httpPath: '/api/v2/pipeline-snapshots/batches',
    operationId: 'pipeline_snapshots.list_batches',
  },
  tool: {
    name: 'list_pipeline_snapshot_batches',
    title: 'List pipeline snapshot batches',
    description:
      'List captured pipeline snapshot batches. Use this before comparing snapshots when the user did not provide batch ids.',
    inputSchema: PIPELINE_SNAPSHOT_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List pipeline snapshot batches',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List pipeline snapshot batches',
    });
    if (authError) {
      return authError;
    }

    const payload = (await reqContext.client.get('/api/v2/pipeline-snapshots/batches', {
      query: buildPipelineSnapshotListParams(args),
    })) as Record<string, unknown>;

    return buildPipelineSnapshotListResult(payload);
  },
};

export const crmGetPipelineSnapshotBatchTool: McpTool = {
  metadata: {
    resource: 'pipeline_snapshots',
    operation: 'read',
    tags: ['crm', 'deals', 'pipeline_snapshots'],
    httpMethod: 'get',
    httpPath: '/api/v2/pipeline-snapshots/batches/{batch_id}',
    operationId: 'pipeline_snapshots.get_batch',
  },
  tool: {
    name: 'get_pipeline_snapshot_batch',
    title: 'Get pipeline snapshot batch',
    description:
      'Load one pipeline snapshot batch and its captured deal rows. Use this to inspect the frozen deal values behind a snapshot diff.',
    inputSchema: PIPELINE_SNAPSHOT_GET_INPUT_SCHEMA,
    outputSchema: PIPELINE_SNAPSHOT_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get pipeline snapshot batch',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get pipeline snapshot batch',
    });
    if (authError) {
      return authError;
    }

    const batchID = readString(args?.['batch_id']);
    if (!batchID) {
      return asErrorResult('`batch_id` is required.');
    }
    const pipelineID = readString(args?.['pipeline_id']);
    const payload = (await reqContext.client.get(
      `/api/v2/pipeline-snapshots/batches/${encodeURIComponent(batchID)}`,
      {
        query: pipelineID ? { pipeline_id: pipelineID } : {},
      },
    )) as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildPipelineSnapshotBatchSummary(payload) }],
      structuredContent: payload,
    };
  },
};

export const crmComparePipelineSnapshotsTool: McpTool = {
  metadata: {
    resource: 'pipeline_snapshots',
    operation: 'read',
    tags: ['crm', 'deals', 'pipeline_snapshots'],
    httpMethod: 'post',
    httpPath: '/api/v2/pipeline-snapshots/compare',
    operationId: 'pipeline_snapshots.compare',
  },
  tool: {
    name: 'compare_pipeline_snapshots',
    title: 'Compare pipeline snapshots',
    description:
      'Compare two pipeline snapshot batches and return amount, weighted amount, stage transition, close-date, and per-deal deltas. Omit batch ids to compare the latest two matching batches.',
    inputSchema: PIPELINE_SNAPSHOT_COMPARE_INPUT_SCHEMA,
    outputSchema: PIPELINE_SNAPSHOT_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Compare pipeline snapshots',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Compare pipeline snapshots',
    });
    if (authError) {
      return authError;
    }

    const payload = (await reqContext.client.post('/api/v2/pipeline-snapshots/compare', {
      body: buildPipelineSnapshotCompareBody(args),
    })) as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildPipelineSnapshotCompareSummary(payload) }],
      structuredContent: payload,
    };
  },
};

export const crmSyncPipelineSnapshotHubSpotPropertiesTool: McpTool = {
  metadata: {
    resource: 'pipeline_snapshots',
    operation: 'write',
    tags: ['crm', 'deals', 'pipeline_snapshots', 'hubspot'],
    httpMethod: 'post',
    httpPath: '/api/v2/pipeline-snapshots/hubspot/sync-properties',
    operationId: 'pipeline_snapshots.hubspot.sync_properties',
  },
  tool: {
    name: 'sync_pipeline_snapshot_hubspot_properties',
    title: 'Sync pipeline snapshot HubSpot properties',
    description:
      'Write pipeline snapshot diffs into HubSpot sanka_test_* deal properties. Defaults to dry_run=true; set dry_run=false and confirm=true only after reviewing the preview.',
    inputSchema: PIPELINE_SNAPSHOT_HUBSPOT_SYNC_INPUT_SCHEMA,
    outputSchema: PIPELINE_SNAPSHOT_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Sync pipeline snapshot HubSpot properties',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Sync pipeline snapshot HubSpot properties',
    });
    if (authError) {
      return authError;
    }

    const body = buildPipelineSnapshotHubSpotSyncBody(args);
    if (!readString(body['channel_id'])) {
      return asErrorResult('`channel_id` is required.');
    }
    if (body['dry_run'] === false && body['confirm'] !== true) {
      return asErrorResult('`confirm=true` is required when `dry_run=false`. Run a dry run first.');
    }

    const payload = (await reqContext.client.post('/api/v2/pipeline-snapshots/hubspot/sync-properties', {
      body,
    })) as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildPipelineSnapshotHubSpotSyncSummary(payload) }],
      structuredContent: payload,
    };
  },
};

export const crmCreateDealTool: McpTool = {
  metadata: {
    resource: 'deals',
    operation: 'write',
    tags: ['crm', 'deals'],
    httpMethod: 'post',
    httpPath: '/api/v2/deals',
    operationId: 'public.deals.create',
  },
  tool: {
    name: 'create_deal',
    title: 'Create deal',
    description:
      'Create a deal in Sanka or a connected CRM. `external_id` is optional for Sanka-local creates and should be used for idempotent upserts; integration-only creates can omit it and use the returned provider id.',
    inputSchema: DEAL_CREATE_INPUT_SCHEMA,
    outputSchema: DEAL_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create deal',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create deal',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.deals.create(
      buildDealMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Deal',
            action: 'created',
            payload: response,
            idKeys: ['case_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateDealTool: McpTool = {
  metadata: {
    resource: 'deals',
    operation: 'write',
    tags: ['crm', 'deals'],
    httpMethod: 'patch',
    httpPath: '/api/v2/deals/{case_id}',
    operationId: 'public.deals.update',
  },
  tool: {
    name: 'update_deal',
    title: 'Update deal',
    description:
      'Update an existing deal in Sanka or a connected CRM. Use `lookup_external_id` when the path identifier is not the external reference you want to resolve by.',
    inputSchema: DEAL_UPDATE_INPUT_SCHEMA,
    outputSchema: DEAL_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update deal',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update deal',
    });
    if (authError) {
      return authError;
    }

    const { caseID, params } = buildDealUpdateParams(args);
    if (!caseID) {
      return asErrorResult('`case_id` is required.');
    }

    const response = (await reqContext.client.public.deals.update(
      caseID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Deal',
            action: 'updated',
            payload: response,
            idKeys: ['case_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteDealTool: McpTool = {
  metadata: {
    resource: 'deals',
    operation: 'write',
    tags: ['crm', 'deals'],
    httpMethod: 'delete',
    httpPath: '/api/v2/deals/{case_id}',
    operationId: 'public.deals.delete',
  },
  tool: {
    name: 'delete_deal',
    title: 'Delete deal',
    description:
      'Archive or delete a deal in Sanka or a connected CRM by case id, numeric id, or external reference.',
    inputSchema: DEAL_DELETE_INPUT_SCHEMA,
    outputSchema: DEAL_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete deal',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete deal',
    });
    if (authError) {
      return authError;
    }

    const { caseID, params } = buildDealDeleteParams(args);
    if (!caseID) {
      return asErrorResult('`case_id` is required.');
    }

    const response = (await reqContext.client.public.deals.delete(
      caseID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Deal',
            action: 'deleted',
            payload: response,
            idKeys: ['case_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListOrdersTool: McpTool = {
  metadata: {
    resource: 'orders',
    operation: 'read',
    tags: ['crm', 'orders'],
    httpMethod: 'get',
    httpPath: '/api/v2/orders',
    operationId: 'public.orders.list',
  },
  tool: {
    name: 'list_orders',
    title: 'List orders',
    description: 'Search and review orders in Sanka.',
    inputSchema: LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List orders',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List orders',
    });
    if (authError) {
      return authError;
    }

    const payload = await reqContext.client.public.orders.list(buildListParams(args), undefined);

    return buildListResult({
      label: 'orders',
      payload,
      previewKeys: ['id', 'order_id'],
    });
  },
};

export const crmGetOrderTool: McpTool = {
  metadata: {
    resource: 'orders',
    operation: 'read',
    tags: ['crm', 'orders'],
    httpMethod: 'get',
    httpPath: '/api/v2/orders/{order_id}',
    operationId: 'public.orders.retrieve',
  },
  tool: {
    name: 'get_order',
    title: 'Get order',
    description: 'Load one order from Sanka by order id, numeric id, or external reference.',
    inputSchema: ORDER_RETRIEVE_INPUT_SCHEMA,
    outputSchema: ORDER_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get order',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get order',
    });
    if (authError) {
      return authError;
    }

    const { orderID, params } = buildOrderRetrieveParams(args);
    if (!orderID) {
      return asErrorResult('`order_id` is required.');
    }

    const order = (await reqContext.client.public.orders.retrieve(
      orderID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'order',
            payload: order,
            previewKeys: ['order_id', 'id'],
          }),
        },
      ],
      structuredContent: order,
    };
  },
};

export const crmDownloadOrderPDFTool: McpTool = {
  metadata: {
    resource: 'orders',
    operation: 'read',
    tags: ['crm', 'orders'],
    httpMethod: 'get',
    httpPath: '/api/v2/orders/{order_id}/pdf',
    operationId: 'public.orders.downloadPDF',
  },
  tool: {
    name: 'download_order_pdf',
    title: 'Download order PDF',
    description: 'Download an order from Sanka as a PDF document.',
    inputSchema: ORDER_DOWNLOAD_PDF_INPUT_SCHEMA,
    outputSchema: BINARY_DOWNLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Download order PDF',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Download order PDF',
    });
    if (authError) {
      return authError;
    }

    const { orderID, params } = buildOrderDownloadPDFParams(args);
    if (!orderID) {
      return asErrorResult('`order_id` is required.');
    }

    const response = await reqContext.client.public.orders.downloadPDF(orderID, params, undefined);
    return asStoredBinaryDownloadResult(reqContext, response, 'order.pdf');
  },
};

export const crmUploadOrderAttachmentTool: McpTool = {
  metadata: {
    resource: 'orders',
    operation: 'write',
    tags: ['crm', 'orders'],
    httpMethod: 'post',
    httpPath: '/api/v2/orders/files',
    operationId: 'public.orders.uploadAttachment',
  },
  tool: {
    name: 'upload_order_attachment',
    title: 'Upload order attachment',
    description:
      'Upload an order attachment to Sanka from an already available base64 payload. Prefer this direct upload when the client can pass content_base64 reliably. For client-local PDFs or payloads that are too large or unreliable to pass as one content_base64 string, use start_order_attachment_upload, append_order_attachment_upload_chunk until done, then finish_order_attachment_upload. Use the returned file_id in create_order or update_order.',
    inputSchema: ORDER_UPLOAD_INPUT_SCHEMA,
    outputSchema: ORDER_UPLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Upload order attachment',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Upload order attachment',
    });
    if (authError) {
      return authError;
    }

    return uploadAttachmentFileFromArgs({
      args,
      entityName: 'order',
      uploadAttachment: (file) => reqContext.client.public.orders.uploadAttachment({ file }, undefined),
    });
  },
};

export const crmStartOrderAttachmentUploadTool = orderAttachmentUploadTools.startTool;
export const crmAppendOrderAttachmentUploadChunkTool = orderAttachmentUploadTools.appendTool;
export const crmFinishOrderAttachmentUploadTool = orderAttachmentUploadTools.finishTool;

export const crmCreateOrderTool: McpTool = {
  metadata: {
    resource: 'orders',
    operation: 'write',
    tags: ['crm', 'orders'],
    httpMethod: 'post',
    httpPath: '/api/v2/orders',
    operationId: 'public.orders.create',
  },
  tool: {
    name: 'create_order',
    title: 'Create order',
    description:
      'Create an order in Sanka. Provide the nested `order` payload with line items and optional workflow flags. Attach uploaded file ids with `attachment_file_ids` when needed.',
    inputSchema: ORDER_CREATE_INPUT_SCHEMA,
    outputSchema: ORDER_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create order',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create order',
    });
    if (authError) {
      return authError;
    }

    const body = buildOrderMutationBody(args);
    if (!body.order?.externalId) {
      return asErrorResult('`order.external_id` is required.');
    }
    if (!body.order.items?.length && !body.order.line_items?.length) {
      return asErrorResult('`order.items` or `order.line_items` must contain at least one line item.');
    }

    const payload: OrderMutationPayload = {
      order: {
        externalId: body.order.externalId,
        ...(body.order.items !== undefined ? { items: body.order.items } : {}),
        ...(body.order.line_items !== undefined ? { line_items: body.order.line_items } : {}),
        ...(body.order.attachment_file !== undefined ? { attachment_file: body.order.attachment_file } : {}),
        ...(body.order.companyExternalId ? { companyExternalId: body.order.companyExternalId } : {}),
        ...(body.order.companyId ? { companyId: body.order.companyId } : {}),
        ...(body.order.deliveryStatus ? { deliveryStatus: body.order.deliveryStatus } : {}),
        ...(body.order.orderAt ? { orderAt: body.order.orderAt } : {}),
      },
      ...(body.createMissingItems !== undefined ? { createMissingItems: body.createMissingItems } : {}),
      ...(body.triggerWorkflows !== undefined ? { triggerWorkflows: body.triggerWorkflows } : {}),
    };

    const response = (await reqContext.client.public.orders.create(
      payload as Parameters<typeof reqContext.client.public.orders.create>[0],
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildOrderMutationSummary(response, 'created') }],
      structuredContent: response,
    };
  },
};

export const crmUpdateOrderTool: McpTool = {
  metadata: {
    resource: 'orders',
    operation: 'write',
    tags: ['crm', 'orders'],
    httpMethod: 'patch',
    httpPath: '/api/v2/orders/{order_id}',
    operationId: 'public.orders.update',
  },
  tool: {
    name: 'update_order',
    title: 'Update order',
    description:
      'Update an existing order in Sanka. Attach uploaded file ids with `attachment_file_ids` when needed.',
    inputSchema: ORDER_UPDATE_INPUT_SCHEMA,
    outputSchema: ORDER_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update order',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update order',
    });
    if (authError) {
      return authError;
    }

    const orderID = readString(args?.['order_id']);
    if (!orderID) {
      return asErrorResult('`order_id` is required.');
    }

    const body = buildOrderMutationBody(args);
    if (!body.order?.externalId) {
      return asErrorResult('`order.external_id` is required.');
    }
    if (!body.order.items?.length && !body.order.line_items?.length) {
      return asErrorResult('`order.items` or `order.line_items` must contain at least one line item.');
    }

    const payload: OrderMutationPayload = {
      order: {
        externalId: body.order.externalId,
        ...(body.order.items !== undefined ? { items: body.order.items } : {}),
        ...(body.order.line_items !== undefined ? { line_items: body.order.line_items } : {}),
        ...(body.order.attachment_file !== undefined ? { attachment_file: body.order.attachment_file } : {}),
        ...(body.order.companyExternalId ? { companyExternalId: body.order.companyExternalId } : {}),
        ...(body.order.companyId ? { companyId: body.order.companyId } : {}),
        ...(body.order.deliveryStatus ? { deliveryStatus: body.order.deliveryStatus } : {}),
        ...(body.order.orderAt ? { orderAt: body.order.orderAt } : {}),
      },
      ...(body.createMissingItems !== undefined ? { createMissingItems: body.createMissingItems } : {}),
      ...(body.triggerWorkflows !== undefined ? { triggerWorkflows: body.triggerWorkflows } : {}),
    };

    const response = (await reqContext.client.public.orders.update(
      orderID,
      payload as Parameters<typeof reqContext.client.public.orders.update>[1],
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildOrderMutationSummary(response, 'updated') }],
      structuredContent: response,
    };
  },
};

export const crmActivateOrderTool: McpTool = {
  metadata: {
    resource: 'orders',
    operation: 'write',
    tags: ['crm', 'orders'],
    httpMethod: 'post',
    httpPath: '/api/v2/orders/{order_id}/activate',
    operationId: 'public.orders.activate',
  },
  tool: {
    name: 'activate_order',
    title: 'Activate order',
    description: 'Restore an archived order to active status in Sanka.',
    inputSchema: ORDER_RETRIEVE_INPUT_SCHEMA,
    outputSchema: ORDER_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Activate order',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Activate order',
    });
    if (authError) {
      return authError;
    }

    const { orderID, params } = buildOrderRetrieveParams(args);
    if (!orderID) {
      return asErrorResult('`order_id` is required.');
    }

    const response = (await reqContext.client.public.orders.activate(
      orderID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;
    const verification = await buildLifecycleVerification({
      entity: 'order',
      id: orderID,
      params,
      expectedStatus: 'active',
      retrieve: async (id, query) =>
        (await reqContext.client.public.orders.retrieve(id, query, undefined)) as unknown as Record<
          string,
          unknown
        >,
    });
    const payload = { ...response, verification };

    return {
      content: [
        {
          type: 'text',
          text: buildLifecycleMutationSummary({ entity: 'Order', action: 'activated', payload }),
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmDeleteOrderTool: McpTool = {
  metadata: {
    resource: 'orders',
    operation: 'write',
    tags: ['crm', 'orders'],
    httpMethod: 'delete',
    httpPath: '/api/v2/orders/{order_id}',
    operationId: 'public.orders.delete',
  },
  tool: {
    name: 'delete_order',
    title: 'Archive order',
    description:
      'Archive an order in Sanka by order id, numeric id, or external reference. This is a soft delete; use permanent_delete_order only after explicit confirmation.',
    inputSchema: ORDER_DELETE_INPUT_SCHEMA,
    outputSchema: ORDER_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Archive order',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete order',
    });
    if (authError) {
      return authError;
    }

    const { orderID, params } = buildOrderRetrieveParams(args);
    if (!orderID) {
      return asErrorResult('`order_id` is required.');
    }

    const response = (await reqContext.client.public.orders.delete(
      orderID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;
    const verification = await buildLifecycleVerification({
      entity: 'order',
      id: orderID,
      params,
      expectedStatus: 'archived',
      retrieve: async (id, query) =>
        (await reqContext.client.public.orders.retrieve(id, query, undefined)) as unknown as Record<
          string,
          unknown
        >,
    });
    const payload = { ...response, verification };

    return {
      content: [
        {
          type: 'text',
          text: buildLifecycleMutationSummary({ entity: 'Order', action: 'archived', payload }),
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmPermanentDeleteOrderTool: McpTool = {
  metadata: {
    resource: 'orders',
    operation: 'write',
    tags: ['crm', 'orders'],
    httpMethod: 'delete',
    httpPath: '/api/v2/orders/{order_id}/permanent-delete',
    operationId: 'public.orders.permanentDelete',
  },
  tool: {
    name: 'permanent_delete_order',
    title: 'Permanently delete order',
    description:
      'Permanently delete an already archived order in Sanka. Requires confirm=true and cannot be undone.',
    inputSchema: ORDER_PERMANENT_DELETE_INPUT_SCHEMA,
    outputSchema: ORDER_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Permanently delete order',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Permanently delete order',
    });
    if (authError) {
      return authError;
    }

    const { orderID, params } = buildOrderRetrieveParams(args);
    if (!orderID) {
      return asErrorResult('`order_id` is required.');
    }
    if (readBoolean(args?.['confirm']) !== true) {
      return asErrorResult('`confirm=true` is required for permanent delete.');
    }

    const response = normalizeV2MutationEnvelopePayload(
      (await reqContext.client.v2Delete<Record<string, unknown>>(
        `/orders/${encodeURIComponent(orderID)}/permanent-delete`,
        { query: { ...params, confirm: true } },
      )) as unknown as Record<string, unknown>,
    );
    const responseMeta = readRecord(response['meta']);
    const operation = readString(response['operation']) ?? readString(responseMeta?.['operation']);
    const deletionPayload = {
      ok: true,
      permanently_deleted: true,
      ...(operation ? { operation } : undefined),
      ...response,
    };
    const verification = await buildPermanentDeleteVerification({
      entity: 'order',
      id: orderID,
      retrieve: async (id) =>
        (await reqContext.client.public.orders.retrieve(id, params, undefined)) as unknown as Record<
          string,
          unknown
        >,
    });
    const payload = { ...deletionPayload, verification };

    return {
      content: [
        {
          type: 'text',
          text: buildLifecycleMutationSummary({ entity: 'Order', action: 'permanently deleted', payload }),
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmListPurchaseOrdersTool: McpTool = {
  metadata: {
    resource: 'purchaseOrders',
    operation: 'read',
    tags: ['crm', 'purchase-orders'],
    httpMethod: 'get',
    httpPath: '/api/v2/purchase-orders',
    operationId: 'public.purchaseOrders.list',
  },
  tool: {
    name: 'list_purchase_orders',
    title: 'List purchase orders',
    description: 'Review purchase orders in Sanka.',
    inputSchema: PURCHASE_ORDER_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List purchase orders',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List purchase orders',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildPurchaseOrderListParams(args);
    const purchaseOrders = await reqContext.client.public.purchaseOrders.list(params, undefined);
    const results = purchaseOrders
      .slice(0, limit)
      .map((purchaseOrder) => purchaseOrder as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'purchase orders',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${purchaseOrders.length} purchase orders.`,
        page: 1,
        total: purchaseOrders.length,
      },
      previewKeys: ['id_po', 'company_name', 'contact_name'],
    });
  },
};

export const crmGetPurchaseOrderTool: McpTool = {
  metadata: {
    resource: 'purchaseOrders',
    operation: 'read',
    tags: ['crm', 'purchase-orders'],
    httpMethod: 'get',
    httpPath: '/api/v2/purchase-orders/{purchase_order_id}',
    operationId: 'public.purchaseOrders.retrieve',
  },
  tool: {
    name: 'get_purchase_order',
    title: 'Get purchase order',
    description:
      'Load one purchase order from Sanka by purchase order id, numeric id, or external reference.',
    inputSchema: PURCHASE_ORDER_RETRIEVE_INPUT_SCHEMA,
    outputSchema: PURCHASE_ORDER_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get purchase order',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get purchase order',
    });
    if (authError) {
      return authError;
    }

    const { purchaseOrderID, params } = buildPurchaseOrderRetrieveParams(args);
    if (!purchaseOrderID) {
      return asErrorResult('`purchase_order_id` is required.');
    }

    const purchaseOrder = (await reqContext.client.public.purchaseOrders.retrieve(
      purchaseOrderID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'purchase order',
            payload: purchaseOrder,
            previewKeys: ['id_po', 'company_name', 'contact_name'],
          }),
        },
      ],
      structuredContent: purchaseOrder,
    };
  },
};

export const crmDownloadPurchaseOrderPDFTool: McpTool = {
  metadata: {
    resource: 'purchaseOrders',
    operation: 'read',
    tags: ['crm', 'purchase-orders'],
    httpMethod: 'get',
    httpPath: '/api/v2/purchase-orders/{purchase_order_id}/pdf',
    operationId: 'public.purchaseOrders.downloadPDF',
  },
  tool: {
    name: 'download_purchase_order_pdf',
    title: 'Download purchase order PDF',
    description: 'Download a purchase order from Sanka as a PDF document.',
    inputSchema: PURCHASE_ORDER_DOWNLOAD_PDF_INPUT_SCHEMA,
    outputSchema: BINARY_DOWNLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Download purchase order PDF',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Download purchase order PDF',
    });
    if (authError) {
      return authError;
    }

    const { purchaseOrderID, params } = buildPurchaseOrderDownloadPDFParams(args);
    if (!purchaseOrderID) {
      return asErrorResult('`purchase_order_id` is required.');
    }

    const response = await reqContext.client.public.purchaseOrders.downloadPDF(
      purchaseOrderID,
      params,
      undefined,
    );
    return asStoredBinaryDownloadResult(reqContext, response, 'purchase-order.pdf');
  },
};

export const crmUploadPurchaseOrderAttachmentTool: McpTool = {
  metadata: {
    resource: 'purchaseOrders',
    operation: 'write',
    tags: ['crm', 'purchase-orders'],
    httpMethod: 'post',
    httpPath: '/api/v2/purchase-orders/files',
    operationId: 'public.purchaseOrders.uploadAttachment',
  },
  tool: {
    name: 'upload_purchase_order_attachment',
    title: 'Upload purchase order attachment',
    description:
      'Upload a purchase order attachment to Sanka from an already available base64 payload. Prefer this direct upload when the client can pass content_base64 reliably. For client-local PDFs or payloads that are too large or unreliable to pass as one content_base64 string, use start_purchase_order_attachment_upload, append_purchase_order_attachment_upload_chunk until done, then finish_purchase_order_attachment_upload. Use the returned file_id in create_purchase_order or update_purchase_order.',
    inputSchema: PURCHASE_ORDER_UPLOAD_INPUT_SCHEMA,
    outputSchema: PURCHASE_ORDER_UPLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Upload purchase order attachment',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Upload purchase order attachment',
    });
    if (authError) {
      return authError;
    }

    return uploadAttachmentFileFromArgs({
      args,
      entityName: 'purchase order',
      uploadAttachment: (file) =>
        reqContext.client.public.purchaseOrders.uploadAttachment({ file }, undefined),
    });
  },
};

export const crmStartPurchaseOrderAttachmentUploadTool = purchaseOrderAttachmentUploadTools.startTool;
export const crmAppendPurchaseOrderAttachmentUploadChunkTool = purchaseOrderAttachmentUploadTools.appendTool;
export const crmFinishPurchaseOrderAttachmentUploadTool = purchaseOrderAttachmentUploadTools.finishTool;

export const crmCreatePurchaseOrderTool: McpTool = {
  metadata: {
    resource: 'purchaseOrders',
    operation: 'write',
    tags: ['crm', 'purchase-orders'],
    httpMethod: 'post',
    httpPath: '/api/v2/purchase-orders',
    operationId: 'public.purchaseOrders.create',
  },
  tool: {
    name: 'create_purchase_order',
    title: 'Create purchase order',
    description:
      'Create a purchase order in Sanka from explicit supplier and line item data. Attach uploaded file ids with `attachment_file_ids` when needed. For CRM deal/opportunity-sourced procurement, use deal_to_order first and create purchase orders from the Sanka Order context.',
    inputSchema: PURCHASE_ORDER_CREATE_INPUT_SCHEMA,
    outputSchema: PURCHASE_ORDER_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create purchase order',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create purchase order',
    });
    if (authError) {
      return authError;
    }
    if (isDirectCrmSourceContext(args)) {
      return asErrorResult(DIRECT_CRM_SOURCE_LOCK_MESSAGE);
    }

    const response = (await reqContext.client.public.purchaseOrders.create(
      buildPurchaseOrderMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Purchase order',
            action: 'created',
            payload: response,
            idKeys: ['purchase_order_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdatePurchaseOrderTool: McpTool = {
  metadata: {
    resource: 'purchaseOrders',
    operation: 'write',
    tags: ['crm', 'purchase-orders'],
    httpMethod: 'patch',
    httpPath: '/api/v2/purchase-orders/{purchase_order_id}',
    operationId: 'public.purchaseOrders.update',
  },
  tool: {
    name: 'update_purchase_order',
    title: 'Update purchase order',
    description:
      'Update an existing purchase order in Sanka. Attach uploaded file ids with `attachment_file_ids` when needed.',
    inputSchema: PURCHASE_ORDER_UPDATE_INPUT_SCHEMA,
    outputSchema: PURCHASE_ORDER_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update purchase order',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update purchase order',
    });
    if (authError) {
      return authError;
    }

    const purchaseOrderID = readString(args?.['purchase_order_id']);
    if (!purchaseOrderID) {
      return asErrorResult('`purchase_order_id` is required.');
    }

    const response = (await reqContext.client.public.purchaseOrders.update(
      purchaseOrderID,
      buildPurchaseOrderMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Purchase order',
            action: 'updated',
            payload: response,
            idKeys: ['purchase_order_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeletePurchaseOrderTool: McpTool = {
  metadata: {
    resource: 'purchaseOrders',
    operation: 'write',
    tags: ['crm', 'purchase-orders'],
    httpMethod: 'delete',
    httpPath: '/api/v2/purchase-orders/{purchase_order_id}',
    operationId: 'public.purchaseOrders.delete',
  },
  tool: {
    name: 'delete_purchase_order',
    title: 'Delete purchase order',
    description: 'Delete a purchase order in Sanka by purchase order id or external reference.',
    inputSchema: PURCHASE_ORDER_DELETE_INPUT_SCHEMA,
    outputSchema: PURCHASE_ORDER_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete purchase order',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete purchase order',
    });
    if (authError) {
      return authError;
    }

    const purchaseOrderID = readString(args?.['purchase_order_id']);
    const externalID = readString(args?.['external_id']);
    if (!purchaseOrderID) {
      return asErrorResult('`purchase_order_id` is required.');
    }

    const response = (await reqContext.client.public.purchaseOrders.delete(
      purchaseOrderID,
      externalID ? { external_id: externalID } : {},
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Purchase order',
            action: 'deleted',
            payload: response,
            idKeys: ['purchase_order_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListTasksTool: McpTool = {
  metadata: {
    resource: 'tasks',
    operation: 'read',
    tags: ['crm', 'tasks'],
    httpMethod: 'get',
    httpPath: '/api/v2/tasks',
    operationId: 'public.tasks.list',
  },
  tool: {
    name: 'list_tasks',
    title: 'List tasks',
    description: 'Search and review tasks in Sanka.',
    inputSchema: TASK_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List tasks',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List tasks',
    });
    if (authError) {
      return authError;
    }

    const payload = await reqContext.client.public.tasks.list(buildTaskListParams(args).params, undefined);

    return buildListResult({
      label: 'tasks',
      payload: {
        count: payload.count,
        data: payload.data.map((task) => ({ ...task })),
        message: payload.message,
        page: payload.page,
        total: payload.total,
      },
      previewKeys: ['title', 'task_id', 'id'],
    });
  },
};

export const crmGetTaskTool: McpTool = {
  metadata: {
    resource: 'tasks',
    operation: 'read',
    tags: ['crm', 'tasks'],
    httpMethod: 'get',
    httpPath: '/api/v2/tasks/{task_id}',
    operationId: 'public.tasks.retrieve',
  },
  tool: {
    name: 'get_task',
    title: 'Get task',
    description: 'Load one task from Sanka by task id, numeric id, or external reference.',
    inputSchema: TASK_RETRIEVE_INPUT_SCHEMA,
    outputSchema: TASK_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get task',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get task',
    });
    if (authError) {
      return authError;
    }

    const { taskID, params } = buildTaskRetrieveParams(args);
    if (!taskID) {
      return asErrorResult('`task_id` is required.');
    }

    const task = (await reqContext.client.public.tasks.retrieve(
      taskID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'task',
            payload: task,
            previewKeys: ['title', 'task_id', 'id'],
          }),
        },
      ],
      structuredContent: task,
    };
  },
};

export const crmCreateTaskTool: McpTool = {
  metadata: {
    resource: 'tasks',
    operation: 'write',
    tags: ['crm', 'tasks'],
    httpMethod: 'post',
    httpPath: '/api/v2/tasks',
    operationId: 'public.tasks.create',
  },
  tool: {
    name: 'create_task',
    title: 'Create task',
    description: 'Create a task in Sanka.',
    inputSchema: TASK_CREATE_INPUT_SCHEMA,
    outputSchema: TASK_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create task',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create task',
    });
    if (authError) {
      return authError;
    }

    const body = buildTaskMutationBody(args);
    if (Object.keys(body).length === 0) {
      return asErrorResult('At least one task field is required.');
    }

    const response = (await reqContext.client.public.tasks.create(body, undefined)) as unknown as Record<
      string,
      unknown
    >;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Task',
            action: 'created',
            payload: response,
            idKeys: ['task_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateTaskTool: McpTool = {
  metadata: {
    resource: 'tasks',
    operation: 'write',
    tags: ['crm', 'tasks'],
    httpMethod: 'patch',
    httpPath: '/api/v2/tasks/{task_id}',
    operationId: 'public.tasks.update',
  },
  tool: {
    name: 'update_task',
    title: 'Update task',
    description:
      'Update an existing task in Sanka. When you need to append to a description, load the task first and then send the full updated description.',
    inputSchema: TASK_UPDATE_INPUT_SCHEMA,
    outputSchema: TASK_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update task',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update task',
    });
    if (authError) {
      return authError;
    }

    const taskID = readString(args?.['task_id']);
    if (!taskID) {
      return asErrorResult('`task_id` is required.');
    }

    const body = buildTaskMutationBody(args);
    if (Object.keys(body).length === 0) {
      return asErrorResult('At least one task field is required.');
    }

    const lookupExternalID = readString(args?.['lookup_external_id']);
    const { external_id: bodyExternalID, ...restBody } = body;
    const params = {
      ...(lookupExternalID ? { external_id: lookupExternalID } : undefined),
      ...(bodyExternalID !== undefined ? { body_external_id: bodyExternalID } : undefined),
      ...restBody,
    };

    const response = (await reqContext.client.public.tasks.update(
      taskID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Task',
            action: 'updated',
            payload: response,
            idKeys: ['task_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteTaskTool: McpTool = {
  metadata: {
    resource: 'tasks',
    operation: 'write',
    tags: ['crm', 'tasks'],
    httpMethod: 'delete',
    httpPath: '/api/v2/tasks/{task_id}',
    operationId: 'public.tasks.delete',
  },
  tool: {
    name: 'delete_task',
    title: 'Delete task',
    description: 'Archive or delete a task in Sanka by task id or external reference.',
    inputSchema: TASK_DELETE_INPUT_SCHEMA,
    outputSchema: TASK_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete task',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete task',
    });
    if (authError) {
      return authError;
    }

    const taskID = readString(args?.['task_id']);
    if (!taskID) {
      return asErrorResult('`task_id` is required.');
    }

    const externalID = readString(args?.['external_id']);
    const response = (await reqContext.client.public.tasks.delete(
      taskID,
      externalID ? { external_id: externalID } : {},
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Task',
            action: 'deleted',
            payload: response,
            idKeys: ['task_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};
export const crmListEstimatesTool: McpTool = {
  metadata: {
    resource: 'estimates',
    operation: 'read',
    tags: ['crm', 'estimates'],
    httpMethod: 'get',
    httpPath: '/api/v2/estimates',
    operationId: 'public.estimates.list',
  },
  tool: {
    name: 'list_estimates',
    title: 'List estimates',
    description: 'Review estimates in Sanka.',
    inputSchema: ESTIMATE_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List estimates',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List estimates',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildEstimateInvoiceListParams(args);
    const estimates = await reqContext.client.public.estimates.list(params, undefined);
    const results = estimates
      .slice(0, limit)
      .map((estimate) => estimate as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'estimates',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${estimates.length} estimates.`,
        page: 1,
        total: estimates.length,
      },
      previewKeys: ['id_est', 'company_name', 'contact_name'],
    });
  },
};

export const crmGetEstimateTool: McpTool = {
  metadata: {
    resource: 'estimates',
    operation: 'read',
    tags: ['crm', 'estimates'],
    httpMethod: 'get',
    httpPath: '/api/v2/estimates/{estimate_id}',
    operationId: 'public.estimates.retrieve',
  },
  tool: {
    name: 'get_estimate',
    title: 'Get estimate',
    description: 'Load one estimate from Sanka by estimate id, numeric id, or external reference.',
    inputSchema: ESTIMATE_RETRIEVE_INPUT_SCHEMA,
    outputSchema: ESTIMATE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get estimate',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get estimate',
    });
    if (authError) {
      return authError;
    }

    const { estimateID, params } = buildEstimateRetrieveParams(args);
    if (!estimateID) {
      return asErrorResult('`estimate_id` is required.');
    }

    const estimate = (await reqContext.client.public.estimates.retrieve(
      estimateID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'estimate',
            payload: estimate,
            previewKeys: ['id_est', 'company_name', 'contact_name'],
          }),
        },
      ],
      structuredContent: estimate,
    };
  },
};

export const crmDownloadEstimatePDFTool: McpTool = {
  metadata: {
    resource: 'estimates',
    operation: 'read',
    tags: ['crm', 'estimates'],
    httpMethod: 'get',
    httpPath: '/api/v2/estimates/{estimate_id}/pdf',
    operationId: 'public.estimates.downloadPDF',
  },
  tool: {
    name: 'download_estimate_pdf',
    title: 'Download estimate PDF',
    description: 'Download an estimate from Sanka as a PDF document.',
    inputSchema: ESTIMATE_DOWNLOAD_PDF_INPUT_SCHEMA,
    outputSchema: BINARY_DOWNLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Download estimate PDF',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Download estimate PDF',
    });
    if (authError) {
      return authError;
    }

    const { estimateID, params } = buildEstimateDownloadPDFParams(args);
    if (!estimateID) {
      return asErrorResult('`estimate_id` is required.');
    }

    const response = await reqContext.client.public.estimates.downloadPDF(estimateID, params, undefined);
    return asStoredBinaryDownloadResult(reqContext, response, 'estimate.pdf');
  },
};

export const crmUploadEstimateAttachmentTool: McpTool = {
  metadata: {
    resource: 'estimates',
    operation: 'write',
    tags: ['crm', 'estimates'],
    httpMethod: 'post',
    httpPath: '/api/v2/estimates/files',
    operationId: 'public.estimates.uploadAttachment',
  },
  tool: {
    name: 'upload_estimate_attachment',
    title: 'Upload estimate attachment',
    description:
      'Upload an estimate attachment to Sanka from an already available base64 payload. Prefer this direct upload when the client can pass content_base64 reliably. For client-local PDFs or payloads that are too large or unreliable to pass as one content_base64 string, use start_estimate_attachment_upload, append_estimate_attachment_upload_chunk until done, then finish_estimate_attachment_upload. Use the returned file_id in create_estimate or update_estimate.',
    inputSchema: ESTIMATE_UPLOAD_INPUT_SCHEMA,
    outputSchema: ESTIMATE_UPLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Upload estimate attachment',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Upload estimate attachment',
    });
    if (authError) {
      return authError;
    }

    return uploadAttachmentFileFromArgs({
      args,
      entityName: 'estimate',
      uploadAttachment: (file) => reqContext.client.public.estimates.uploadAttachment({ file }, undefined),
    });
  },
};

export const crmStartEstimateAttachmentUploadTool = estimateAttachmentUploadTools.startTool;
export const crmAppendEstimateAttachmentUploadChunkTool = estimateAttachmentUploadTools.appendTool;
export const crmFinishEstimateAttachmentUploadTool = estimateAttachmentUploadTools.finishTool;

export const crmCreateEstimateTool: McpTool = {
  metadata: {
    resource: 'estimates',
    operation: 'write',
    tags: ['crm', 'estimates'],
    httpMethod: 'post',
    httpPath: '/api/v2/estimates',
    operationId: 'public.estimates.create',
  },
  tool: {
    name: 'create_estimate',
    title: 'Create estimate',
    description:
      'Create an estimate in Sanka. Attach uploaded file ids with `attachment_file_ids` when needed.',
    inputSchema: ESTIMATE_CREATE_INPUT_SCHEMA,
    outputSchema: ESTIMATE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create estimate',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create estimate',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.estimates.create(
      buildFinancialDocumentMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Estimate',
            action: 'created',
            payload: response,
            idKeys: ['estimate_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateEstimateTool: McpTool = {
  metadata: {
    resource: 'estimates',
    operation: 'write',
    tags: ['crm', 'estimates'],
    httpMethod: 'patch',
    httpPath: '/api/v2/estimates/{estimate_id}',
    operationId: 'public.estimates.update',
  },
  tool: {
    name: 'update_estimate',
    title: 'Update estimate',
    description:
      'Update an existing estimate in Sanka. Attach uploaded file ids with `attachment_file_ids` when needed.',
    inputSchema: ESTIMATE_UPDATE_INPUT_SCHEMA,
    outputSchema: ESTIMATE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update estimate',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update estimate',
    });
    if (authError) {
      return authError;
    }

    const estimateID = readString(args?.['estimate_id']);
    if (!estimateID) {
      return asErrorResult('`estimate_id` is required.');
    }

    const response = (await reqContext.client.public.estimates.update(
      estimateID,
      buildFinancialDocumentMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Estimate',
            action: 'updated',
            payload: response,
            idKeys: ['estimate_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteEstimateTool: McpTool = {
  metadata: {
    resource: 'estimates',
    operation: 'write',
    tags: ['crm', 'estimates'],
    httpMethod: 'delete',
    httpPath: '/api/v2/estimates/{estimate_id}',
    operationId: 'public.estimates.delete',
  },
  tool: {
    name: 'delete_estimate',
    title: 'Delete estimate',
    description: 'Delete an estimate in Sanka by estimate id or external reference.',
    inputSchema: ESTIMATE_DELETE_INPUT_SCHEMA,
    outputSchema: ESTIMATE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete estimate',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete estimate',
    });
    if (authError) {
      return authError;
    }

    const estimateID = readString(args?.['estimate_id']);
    const externalID = readString(args?.['external_id']);
    if (!estimateID) {
      return asErrorResult('`estimate_id` is required.');
    }

    const response = (await reqContext.client.public.estimates.delete(
      estimateID,
      externalID ? { external_id: externalID } : {},
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Estimate',
            action: 'deleted',
            payload: response,
            idKeys: ['estimate_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListPrivateMessagesTool: McpTool = {
  metadata: {
    resource: 'account_messages',
    operation: 'read',
    tags: ['crm', 'messages'],
    httpMethod: 'get',
    httpPath: '/api/v2/me/messages',
    operationId: 'public.accountMessages.list',
  },
  tool: {
    name: 'list_private_messages',
    title: 'List private messages',
    description:
      'Review ONLY the authenticated user private/personal account-level inbox in Sanka. Do not use for Sanka-connected Gmail integrations, workspace integration inbox, /conversation, Contact Conversation, shared inbox, group inbox, or workspace inbox; use list_workspace_messages for those.',
    inputSchema: PRIVATE_MESSAGE_LIST_INPUT_SCHEMA,
    outputSchema: PRIVATE_MESSAGES_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List private messages',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List private messages',
    });
    if (authError) {
      return authError;
    }

    const payload = (await reqContext.client.public.accountMessages.list(
      buildPrivateMessageListParams(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return buildPrivateMessagesResult({
      action: 'Loaded',
      payload,
    });
  },
};

export const crmSyncPrivateMessagesTool: McpTool = {
  metadata: {
    resource: 'account_messages',
    operation: 'write',
    tags: ['crm', 'messages'],
    httpMethod: 'post',
    httpPath: '/api/v2/me/messages/sync',
    operationId: 'public.accountMessages.sync',
  },
  tool: {
    name: 'sync_private_messages',
    title: 'Sync private messages',
    description:
      'Pull latest messages ONLY for the authenticated user private/personal account-level inbox. Do not use for Sanka-connected Gmail integrations, workspace integration inbox, /conversation, shared inbox, group inbox, or workspace inbox; use sync_workspace_messages for those.',
    inputSchema: PRIVATE_MESSAGE_SYNC_INPUT_SCHEMA,
    outputSchema: PRIVATE_MESSAGES_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Sync private messages',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Sync private messages',
    });
    if (authError) {
      return authError;
    }

    const payload = (await reqContext.client.public.accountMessages.sync(
      buildPrivateMessageSyncParams(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return buildPrivateMessagesResult({
      action: 'Synced',
      payload,
    });
  },
};

export const crmGetPrivateMessageThreadTool: McpTool = {
  metadata: {
    resource: 'account_messages',
    operation: 'read',
    tags: ['crm', 'messages'],
    httpMethod: 'get',
    httpPath: '/api/v2/me/messages/threads/{thread_id}',
    operationId: 'public.accountMessages.threads.retrieve',
  },
  tool: {
    name: 'get_private_message_thread',
    title: 'Get private message thread',
    description:
      'Load one authenticated user private/personal account-level inbox thread, including message history and reply metadata. Do not use for /conversation or shared workspace inbox threads; use get_workspace_message_thread for those.',
    inputSchema: PRIVATE_MESSAGE_THREAD_INPUT_SCHEMA,
    outputSchema: PRIVATE_MESSAGE_THREAD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get private message thread',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get private message thread',
    });
    if (authError) {
      return authError;
    }

    const threadID = readString(args?.['thread_id']);
    if (!threadID) {
      return asErrorResult('`thread_id` is required.');
    }

    const payload = (await reqContext.client.public.accountMessages.threads.retrieve(
      threadID,
      buildPrivateMessageThreadLanguageParams(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return buildPrivateMessageThreadResult(payload);
  },
};

export const crmReplyPrivateMessageThreadTool: McpTool = {
  metadata: {
    resource: 'account_messages',
    operation: 'write',
    tags: ['crm', 'messages'],
    httpMethod: 'post',
    httpPath: '/api/v2/me/messages/threads/{thread_id}/reply',
    operationId: 'public.accountMessages.threads.reply',
  },
  tool: {
    name: 'reply_private_message_thread',
    title: 'Reply private message thread',
    description:
      'Send a reply on an authenticated user private/personal account-level inbox thread in Sanka. This is not for workspace integration inbox, /conversation, shared inbox, group inbox, or workspace inbox threads.',
    inputSchema: PRIVATE_MESSAGE_REPLY_INPUT_SCHEMA,
    outputSchema: PRIVATE_MESSAGE_REPLY_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Reply private message thread',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Reply private message thread',
    });
    if (authError) {
      return authError;
    }

    const threadID = readString(args?.['thread_id']);
    if (!threadID) {
      return asErrorResult('`thread_id` is required.');
    }

    const body = readString(args?.['body']);
    if (!body) {
      return asErrorResult('`body` is required.');
    }

    const payload = (await reqContext.client.public.accountMessages.threads.reply(
      threadID,
      buildPrivateMessageReplyParams(args) as { body: string; 'Accept-Language'?: string },
      undefined,
    )) as unknown as Record<string, unknown>;

    return buildPrivateMessageReplyResult(payload);
  },
};

export const crmArchivePrivateMessageThreadTool: McpTool = {
  metadata: {
    resource: 'account_messages',
    operation: 'write',
    tags: ['crm', 'messages'],
    httpMethod: 'post',
    httpPath: '/api/v2/me/messages/threads/{thread_id}/archive',
    operationId: 'public.accountMessages.threads.archive',
  },
  tool: {
    name: 'archive_private_message_thread',
    title: 'Archive private message thread',
    description:
      'Archive an authenticated user private/personal account-level inbox thread in Sanka. Do not use for /conversation or shared workspace inbox threads.',
    inputSchema: PRIVATE_MESSAGE_THREAD_INPUT_SCHEMA,
    outputSchema: PRIVATE_MESSAGES_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Archive private message thread',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Archive private message thread',
    });
    if (authError) {
      return authError;
    }

    const threadID = readString(args?.['thread_id']);
    if (!threadID) {
      return asErrorResult('`thread_id` is required.');
    }

    const payload = (await reqContext.client.public.accountMessages.threads.archive(
      threadID,
      buildPrivateMessageThreadLanguageParams(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return buildPrivateMessagesResult({
      action: 'Updated',
      payload,
    });
  },
};

export const crmListWorkspaceMessagesTool: McpTool = {
  metadata: {
    resource: 'workspace_messages',
    operation: 'read',
    tags: ['crm', 'messages'],
    httpMethod: 'get',
    httpPath: '/api/v2/workspace/messages',
    operationId: 'public.workspaceMessages.list',
  },
  tool: {
    name: 'list_workspace_messages',
    title: 'List workspace messages',
    description:
      'Review shared workspace/integration inbox threads in Sanka. Prefer this for Sanka-connected Gmail, Gmail integrations, integration inbox, /conversation, Contact Conversation, shared inbox, group inbox, and workspace inbox. This is not the authenticated user private/personal inbox.',
    inputSchema: WORKSPACE_MESSAGE_LIST_INPUT_SCHEMA,
    outputSchema: WORKSPACE_MESSAGES_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List workspace messages',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List workspace messages',
    });
    if (authError) {
      return authError;
    }

    const payload = (await reqContext.client.public.workspaceMessages.list(
      buildWorkspaceMessageListParams(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return buildWorkspaceMessagesResult({
      action: 'Loaded',
      payload,
    });
  },
};

export const crmSyncWorkspaceMessagesTool: McpTool = {
  metadata: {
    resource: 'workspace_messages',
    operation: 'write',
    tags: ['crm', 'messages'],
    httpMethod: 'post',
    httpPath: '/api/v2/workspace/messages/sync',
    operationId: 'public.workspaceMessages.sync',
  },
  tool: {
    name: 'sync_workspace_messages',
    title: 'Sync workspace messages',
    description:
      'Pull latest shared workspace/integration inbox messages into Sanka from integration-linked channels such as Gmail. Prefer this for "Sanka-connected Gmail", Gmail integration inbox, /conversation, Contact Conversation, shared inbox, group inbox, and workspace inbox requests.',
    inputSchema: WORKSPACE_MESSAGE_SYNC_INPUT_SCHEMA,
    outputSchema: WORKSPACE_MESSAGES_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Sync workspace messages',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Sync workspace messages',
    });
    if (authError) {
      return authError;
    }

    const payload = (await reqContext.client.public.workspaceMessages.sync(
      buildWorkspaceMessageSyncParams(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return buildWorkspaceMessagesResult({
      action: 'Synced',
      payload,
    });
  },
};

export const crmGetWorkspaceMessageThreadTool: McpTool = {
  metadata: {
    resource: 'workspace_messages',
    operation: 'read',
    tags: ['crm', 'messages'],
    httpMethod: 'get',
    httpPath: '/api/v2/workspace/messages/threads/{thread_id}',
    operationId: 'public.workspaceMessages.threads.retrieve',
  },
  tool: {
    name: 'get_workspace_message_thread',
    title: 'Get workspace message thread',
    description:
      'Load one shared workspace/integration inbox thread from Sanka, including message history/body. Use this for /conversation, Contact Conversation, shared inbox, group inbox, workspace inbox, and integration-linked Gmail threads, not private/personal account inbox threads.',
    inputSchema: WORKSPACE_MESSAGE_THREAD_INPUT_SCHEMA,
    outputSchema: WORKSPACE_MESSAGE_THREAD_DETAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get workspace message thread',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get workspace message thread',
    });
    if (authError) {
      return authError;
    }

    const threadID = readString(args?.['thread_id']);
    if (!threadID) {
      return asErrorResult('`thread_id` is required.');
    }

    const payload = (await reqContext.client.public.workspaceMessages.threads.retrieve(
      threadID,
      buildWorkspaceMessageThreadLanguageParams(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return buildWorkspaceMessageThreadResult(payload);
  },
};
export const crmListInvoicesTool: McpTool = {
  metadata: {
    resource: 'invoices',
    operation: 'read',
    tags: ['crm', 'invoices'],
    httpMethod: 'get',
    httpPath: '/api/v2/invoices',
    operationId: 'public.invoices.list',
  },
  tool: {
    name: 'list_invoices',
    title: 'List invoices',
    description: 'Review invoices in Sanka.',
    inputSchema: INVOICE_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List invoices',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List invoices',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildEstimateInvoiceListParams(args);
    const invoices = await reqContext.client.public.invoices.list(params, undefined);
    const results = invoices.slice(0, limit).map((invoice) => invoice as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'invoices',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${invoices.length} invoices.`,
        page: 1,
        total: invoices.length,
      },
      previewKeys: ['id_inv', 'company_name', 'contact_name', 'app_url'],
    });
  },
};

export const crmListOverdueInvoicesTool: McpTool = {
  metadata: {
    resource: 'invoices',
    operation: 'read',
    tags: ['crm', 'invoices'],
    httpMethod: 'get',
    httpPath: '/api/v2/invoices/overdue',
    operationId: 'public.invoices.listOverdue',
  },
  tool: {
    name: 'list_overdue_invoices',
    title: 'List overdue invoices',
    description: 'Review overdue invoices in Sanka that still have outstanding balance.',
    inputSchema: INVOICE_OVERDUE_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List overdue invoices',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List overdue invoices',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildOverdueInvoiceListParams(args);
    const invoices = await reqContext.client.public.invoices.listOverdue(params, undefined);
    const results = invoices.slice(0, limit).map((invoice) => invoice as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'overdue invoices',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${invoices.length} overdue invoices.`,
        page: 1,
        total: invoices.length,
      },
      previewKeys: [
        'id_inv',
        'company_name',
        'contact_name',
        'outstanding_balance',
        'days_overdue',
        'app_url',
      ],
    });
  },
};

export const crmListJournalEntriesTool: McpTool = {
  metadata: {
    resource: 'journals',
    operation: 'read',
    tags: ['finance', 'journals'],
    httpMethod: 'get',
    httpPath: '/api/v2/journals',
    operationId: 'public.journals.list',
  },
  tool: {
    name: 'list_journal_entries',
    title: 'List journal entries',
    description:
      'Review Sanka journal entries. Pass a profit_and_loss, balance_sheet, or cash_flow view_id to return statement rows for that saved journal view.',
    inputSchema: JOURNAL_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List journal entries',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List journal entries',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildJournalListParams(args);
    const payload = normalizeJournalListPayload(
      (await reqContext.client.get('/api/v2/journals', {
        query: params,
      })) as Record<string, unknown>,
    );
    const rows = Array.isArray(payload['data']) ? payload['data'] : [];
    const results = rows.slice(0, limit).map((row) => row as Record<string, unknown>);
    const count = readNumber(payload['count'], results.length);
    const total = readNumber(payload['total'], count);
    const page = readNumber(payload['page'], 1);
    const listResult = buildListResult({
      label: readString(payload['view_type']) ?? 'journal entries',
      payload: {
        count: results.length,
        data: results,
        message: readString(payload['message']) ?? `Returned ${results.length} journal rows.`,
        page,
        total,
        permission: readString(payload['permission']) ?? null,
      },
      previewKeys:
        readString(payload['view_type']) ? ['account', 'amount', 'balance', 'section'] : ['id_journal'],
    });

    return {
      ...listResult,
      structuredContent: {
        ...(listResult.structuredContent as Record<string, unknown>),
        view_type: payload['view_type'],
        balance_sheet_display: payload['balance_sheet_display'],
        columns: payload['columns'],
        column_labels: payload['column_labels'],
      },
    };
  },
};

export const crmCreateJournalStatementViewTool: McpTool = {
  metadata: {
    resource: 'journals',
    operation: 'write',
    tags: ['finance', 'journals', 'views'],
    httpMethod: 'post',
    httpPath: '/api/v2/journals/views',
    operationId: 'public.journals.views.create',
  },
  tool: {
    name: 'create_journal_statement_view',
    title: 'Create journal statement view',
    description:
      'Create a Sanka journal view for Profit and Loss, Balance Sheet, or Cash Flow from existing journal entries. Use this when the user asks to create a PL/BS/CF view from Sanka journal data.',
    inputSchema: JOURNAL_STATEMENT_VIEW_CREATE_INPUT_SCHEMA,
    outputSchema: JOURNAL_STATEMENT_VIEW_CREATE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create journal statement view',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create journal statement view',
    });
    if (authError) {
      return authError;
    }

    const { body, query } = buildJournalStatementViewCreateBody(args);
    const payload = normalizeJournalStatementViewCreatePayload(
      (await reqContext.client.post('/api/v2/journals/views', {
        body,
        query,
      })) as Record<string, unknown>,
    );
    const data = readRecord(payload['data']) ?? {};
    const statement = readRecord(payload['statement']);
    const viewID = readString(data['view_id']);
    const viewType = readString(data['view_type']) ?? readString(statement?.['view_type']);
    const rowCount =
      statement ? readNumber(statement['total'], readNumber(statement['count'], 0)) : undefined;

    return {
      content: [
        {
          type: 'text',
          text: `Created ${viewType ?? 'journal statement'} view${viewID ? ` ${viewID}` : ''}${
            rowCount !== undefined ? ` with ${rowCount} preview rows` : ''
          }.`,
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmListViewsTool: McpTool = {
  metadata: {
    resource: 'views',
    operation: 'read',
    tags: ['views'],
    httpMethod: 'get',
    httpPath: '/api/v2/views',
    operationId: 'public.views.list',
  },
  tool: {
    name: 'list_views',
    title: 'List saved views',
    description: 'List saved Sanka views for any supported object.',
    inputSchema: VIEW_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List saved views',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List saved views',
    });
    if (authError) {
      return authError;
    }

    const { object, params } = buildViewListParams(args);
    const payload = (await reqContext.client.get('/api/v2/views', {
      query: params,
    })) as Record<string, unknown>;
    const results = normalizeV2ListEnvelopePayload(payload);
    return buildListResult({
      label: `${object ?? 'object'} views`,
      payload: {
        count: results.length,
        data: results,
        message: readString(payload['message']) ?? `Returned ${results.length} saved views.`,
        page: 1,
        total: results.length,
      },
      previewKeys: ['label', 'title', 'id'],
    });
  },
};

export const crmGetViewTool: McpTool = {
  metadata: {
    resource: 'views',
    operation: 'read',
    tags: ['views'],
    httpMethod: 'get',
    httpPath: '/api/v2/views/{view_id}',
    operationId: 'public.views.retrieve',
  },
  tool: {
    name: 'get_view',
    title: 'Get saved view',
    description: 'Load one saved Sanka view by id.',
    inputSchema: VIEW_RETRIEVE_INPUT_SCHEMA,
    outputSchema: { type: 'object' as const },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get saved view',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get saved view',
    });
    if (authError) {
      return authError;
    }

    const { viewID, params } = buildViewRetrieveParams(args);
    if (!viewID) {
      return asErrorResult('`view_id` is required.');
    }
    const payload = normalizeViewDetailPayload(
      (await reqContext.client.get(`/api/v2/views/${encodeURIComponent(viewID)}`, {
        query: params,
      })) as Record<string, unknown>,
    );
    const view = readRecord(payload['view']) ?? readRecord(payload['data']);
    const title = readString(view?.['label']) ?? readString(view?.['title']) ?? viewID;
    return {
      content: [{ type: 'text', text: `Loaded saved view ${title}.` }],
      structuredContent: payload,
    };
  },
};

export const crmGetViewColumnsTool: McpTool = {
  metadata: {
    resource: 'views',
    operation: 'read',
    tags: ['views'],
    httpMethod: 'get',
    httpPath: '/api/v2/views/{view_id}/columns',
    operationId: 'public.views.columns',
  },
  tool: {
    name: 'get_view_columns',
    title: 'Get saved view columns',
    description: 'Load resolved display columns for one saved Sanka view.',
    inputSchema: VIEW_RETRIEVE_INPUT_SCHEMA,
    outputSchema: { type: 'object' as const },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get saved view columns',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get saved view columns',
    });
    if (authError) {
      return authError;
    }

    const { viewID, params } = buildViewRetrieveParams(args);
    if (!viewID) {
      return asErrorResult('`view_id` is required.');
    }
    const payload = normalizeViewDetailPayload(
      (await reqContext.client.get(`/api/v2/views/${encodeURIComponent(viewID)}/columns`, {
        query: params,
      })) as Record<string, unknown>,
    );
    const columns = Array.isArray(payload['columns']) ? payload['columns'] : [];
    return {
      content: [{ type: 'text', text: `Loaded ${columns.length} columns for saved view ${viewID}.` }],
      structuredContent: payload,
    };
  },
};

export const crmCreateViewTool: McpTool = {
  metadata: {
    resource: 'views',
    operation: 'write',
    tags: ['views'],
    httpMethod: 'post',
    httpPath: '/api/v2/views',
    operationId: 'public.views.create',
  },
  tool: {
    name: 'create_view',
    title: 'Create saved view',
    description: 'Create a saved Sanka view for any supported object.',
    inputSchema: VIEW_MUTATION_INPUT_SCHEMA,
    outputSchema: { type: 'object' as const },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create saved view',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create saved view',
    });
    if (authError) {
      return authError;
    }

    const { body, query } = buildViewMutationBody(args);
    const payload = normalizeViewDetailPayload(
      (await reqContext.client.post('/api/v2/views', {
        body,
        query,
      })) as Record<string, unknown>,
    );
    const data = readRecord(payload['data']) ?? {};
    const viewID = readString(data['view_id']);
    return {
      content: [{ type: 'text', text: `Created saved view${viewID ? ` ${viewID}` : ''}.` }],
      structuredContent: payload,
    };
  },
};

export const crmUpdateViewTool: McpTool = {
  metadata: {
    resource: 'views',
    operation: 'write',
    tags: ['views'],
    httpMethod: 'patch',
    httpPath: '/api/v2/views/{view_id}',
    operationId: 'public.views.update',
  },
  tool: {
    name: 'update_view',
    title: 'Update saved view',
    description: 'Update a saved Sanka view for any supported object.',
    inputSchema: VIEW_UPDATE_INPUT_SCHEMA,
    outputSchema: { type: 'object' as const },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update saved view',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update saved view',
    });
    if (authError) {
      return authError;
    }

    const viewID = readString(args?.['view_id']);
    if (!viewID) {
      return asErrorResult('`view_id` is required.');
    }
    const { body, query } = buildViewMutationBody(args);
    const payload = normalizeViewDetailPayload(
      (await reqContext.client.patch(`/api/v2/views/${encodeURIComponent(viewID)}`, {
        body,
        query,
      })) as Record<string, unknown>,
    );
    return {
      content: [{ type: 'text', text: `Updated saved view ${viewID}.` }],
      structuredContent: payload,
    };
  },
};

export const crmDeleteViewTool: McpTool = {
  metadata: {
    resource: 'views',
    operation: 'write',
    tags: ['views'],
    httpMethod: 'delete',
    httpPath: '/api/v2/views/{view_id}',
    operationId: 'public.views.delete',
  },
  tool: {
    name: 'delete_view',
    title: 'Delete saved view',
    description: 'Delete a saved Sanka view for any supported object.',
    inputSchema: VIEW_DELETE_INPUT_SCHEMA,
    outputSchema: { type: 'object' as const },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete saved view',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete saved view',
    });
    if (authError) {
      return authError;
    }

    const viewID = readString(args?.['view_id']);
    if (!viewID) {
      return asErrorResult('`view_id` is required.');
    }
    const { body, query } = buildViewMutationBody(args);
    const payload = normalizeViewDetailPayload(
      (await reqContext.client.delete(`/api/v2/views/${encodeURIComponent(viewID)}`, {
        body,
        query,
      })) as Record<string, unknown>,
    );
    return {
      content: [{ type: 'text', text: `Deleted saved view ${viewID}.` }],
      structuredContent: payload,
    };
  },
};

export const crmListReportsTool: McpTool = {
  metadata: {
    resource: 'reports',
    operation: 'read',
    tags: ['reports'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/reports',
    operationId: 'public.reports.list',
  },
  tool: {
    name: 'list_reports',
    title: 'List reports',
    description: 'List Sanka reports and dashboards.',
    inputSchema: REPORT_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List reports',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List reports',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildReportListParams(args);
    const rows = (await reqContext.client.public.reports.list(params, undefined)) as unknown[];
    const results =
      Array.isArray(rows) ? rows.slice(0, limit).map((row) => row as Record<string, unknown>) : [];
    return buildListResult({
      label: 'reports',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} reports.`,
        page: readNumber(params['page'], 1),
        total: results.length,
      },
      previewKeys: ['name', 'report_type', 'id'],
    });
  },
};

export const crmGetReportTool: McpTool = {
  metadata: {
    resource: 'reports',
    operation: 'read',
    tags: ['reports'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/reports/{report_id}',
    operationId: 'public.reports.retrieve',
  },
  tool: {
    name: 'get_report',
    title: 'Get report',
    description: 'Load one Sanka report by id.',
    inputSchema: REPORT_RETRIEVE_INPUT_SCHEMA,
    outputSchema: { type: 'object' as const },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get report',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get report',
    });
    if (authError) {
      return authError;
    }

    const { reportID, params } = buildReportRetrieveParams(args);
    if (!reportID) {
      return asErrorResult('`report_id` is required.');
    }
    const payload = (await reqContext.client.public.reports.retrieve(
      reportID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;
    return {
      content: [{ type: 'text', text: `Loaded report ${readString(payload['name']) ?? reportID}.` }],
      structuredContent: payload,
    };
  },
};

export const crmCreateReportTool: McpTool = {
  metadata: {
    resource: 'reports',
    operation: 'write',
    tags: ['reports'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/reports',
    operationId: 'public.reports.create',
  },
  tool: {
    name: 'create_report',
    title: 'Create report',
    description: 'Create a Sanka report/dashboard with optional panels.',
    inputSchema: REPORT_MUTATION_INPUT_SCHEMA,
    outputSchema: { type: 'object' as const },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create report',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create report',
    });
    if (authError) {
      return authError;
    }

    const body = buildReportMutationBody(args, { defaultCreateDefaultPanel: true });
    const payload = (await reqContext.client.public.reports.create(
      body as never,
      undefined,
    )) as unknown as Record<string, unknown>;
    return {
      content: [{ type: 'text', text: `Created report ${readString(payload['report_id']) ?? ''}.`.trim() }],
      structuredContent: payload,
    };
  },
};

export const crmUpdateReportTool: McpTool = {
  metadata: {
    resource: 'reports',
    operation: 'write',
    tags: ['reports'],
    httpMethod: 'put',
    httpPath: '/api/v2/public/reports/{report_id}',
    operationId: 'public.reports.update',
  },
  tool: {
    name: 'update_report',
    title: 'Update report',
    description: 'Update a Sanka report/dashboard and optionally replace panels.',
    inputSchema: REPORT_UPDATE_INPUT_SCHEMA,
    outputSchema: { type: 'object' as const },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update report',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update report',
    });
    if (authError) {
      return authError;
    }

    const { reportID, params } = buildReportRetrieveParams(args);
    if (!reportID) {
      return asErrorResult('`report_id` is required.');
    }
    const body = buildReportMutationBody(args);
    const payload = (await reqContext.client.public.reports.update(
      reportID,
      { ...body, ...params } as never,
      undefined,
    )) as unknown as Record<string, unknown>;
    return {
      content: [{ type: 'text', text: `Updated report ${reportID}.` }],
      structuredContent: payload,
    };
  },
};

export const crmDeleteReportTool: McpTool = {
  metadata: {
    resource: 'reports',
    operation: 'write',
    tags: ['reports'],
    httpMethod: 'delete',
    httpPath: '/api/v2/public/reports/{report_id}',
    operationId: 'public.reports.delete',
  },
  tool: {
    name: 'delete_report',
    title: 'Delete report',
    description: 'Delete one Sanka report/dashboard.',
    inputSchema: REPORT_RETRIEVE_INPUT_SCHEMA,
    outputSchema: { type: 'object' as const },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete report',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete report',
    });
    if (authError) {
      return authError;
    }

    const { reportID, params } = buildReportRetrieveParams(args);
    if (!reportID) {
      return asErrorResult('`report_id` is required.');
    }
    const payload = (await reqContext.client.public.reports.delete(
      reportID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;
    return {
      content: [{ type: 'text', text: `Deleted report ${reportID}.` }],
      structuredContent: payload,
    };
  },
};

export const crmGetInvoiceTool: McpTool = {
  metadata: {
    resource: 'invoices',
    operation: 'read',
    tags: ['crm', 'invoices'],
    httpMethod: 'get',
    httpPath: '/api/v2/invoices/{invoice_id}',
    operationId: 'public.invoices.retrieve',
  },
  tool: {
    name: 'get_invoice',
    title: 'Get invoice',
    description: 'Load one invoice from Sanka by invoice id, numeric id, or external reference.',
    inputSchema: INVOICE_RETRIEVE_INPUT_SCHEMA,
    outputSchema: INVOICE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get invoice',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get invoice',
    });
    if (authError) {
      return authError;
    }

    const { invoiceID, params } = buildInvoiceRetrieveParams(args);
    if (!invoiceID) {
      return asErrorResult('`invoice_id` is required.');
    }

    const invoice = (await reqContext.client.public.invoices.retrieve(
      invoiceID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;
    const summary = buildEntityDetailSummary({
      entity: 'invoice',
      payload: invoice,
      previewKeys: ['id_inv', 'company_name', 'contact_name'],
    });
    const appURL = readString(invoice['app_url']);

    return {
      content: [
        {
          type: 'text',
          text: appURL ? `${summary} app_url: ${appURL}` : summary,
        },
      ],
      structuredContent: invoice,
    };
  },
};

export const crmDownloadInvoicePDFTool: McpTool = {
  metadata: {
    resource: 'invoices',
    operation: 'read',
    tags: ['crm', 'invoices'],
    httpMethod: 'get',
    httpPath: '/api/v2/invoices/{invoice_id}/pdf',
    operationId: 'public.invoices.downloadPDF',
  },
  tool: {
    name: 'download_invoice_pdf',
    title: 'Download invoice PDF',
    description: 'Download an invoice from Sanka as a PDF document.',
    inputSchema: INVOICE_DOWNLOAD_PDF_INPUT_SCHEMA,
    outputSchema: BINARY_DOWNLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Download invoice PDF',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Download invoice PDF',
    });
    if (authError) {
      return authError;
    }

    const { invoiceID, params } = buildInvoiceDownloadPDFParams(args);
    if (!invoiceID) {
      return asErrorResult('`invoice_id` is required.');
    }

    const response = await reqContext.client.public.invoices.downloadPDF(invoiceID, params, undefined);
    return asStoredBinaryDownloadResult(reqContext, response, 'invoice.pdf');
  },
};

export const crmSendInvoiceEmailTool: McpTool = {
  metadata: {
    resource: 'invoices',
    operation: 'write',
    tags: ['crm', 'invoices', 'messages'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/invoices/{invoice_id}/email',
    operationId: 'public.invoices.email',
  },
  tool: {
    name: 'send_invoice_email',
    title: 'Send invoice email',
    description:
      'Send or schedule an invoice PDF email from Sanka. Use action="schedule" with scheduled_at for future sending; omit to to use the invoice customer email.',
    inputSchema: INVOICE_EMAIL_INPUT_SCHEMA,
    outputSchema: INVOICE_EMAIL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Send invoice email',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Send invoice email',
    });
    if (authError) {
      return authError;
    }

    const invoiceID = readString(args?.['invoice_id']);
    if (!invoiceID) {
      return asErrorResult('`invoice_id` is required.');
    }
    const { body, query } = buildInvoiceEmailBody(args);
    const response = (await reqContext.client.post(
      `/api/v2/public/invoices/${encodeURIComponent(invoiceID)}/email`,
      {
        body,
        query,
      },
    )) as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildInvoiceEmailSummary(response),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUploadInvoiceAttachmentTool: McpTool = {
  metadata: {
    resource: 'invoices',
    operation: 'write',
    tags: ['crm', 'invoices'],
    httpMethod: 'post',
    httpPath: '/api/v2/invoices/files',
    operationId: 'public.invoices.uploadAttachment',
  },
  tool: {
    name: 'upload_invoice_attachment',
    title: 'Upload invoice attachment',
    description:
      'Upload an invoice attachment to Sanka from an already available base64 payload. Prefer this direct upload when the client can pass content_base64 reliably. For client-local PDFs or payloads that are too large or unreliable to pass as one content_base64 string, use start_invoice_attachment_upload, append_invoice_attachment_upload_chunk until done, then finish_invoice_attachment_upload. Use the returned file_id in create_invoice or update_invoice.',
    inputSchema: INVOICE_UPLOAD_INPUT_SCHEMA,
    outputSchema: INVOICE_UPLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Upload invoice attachment',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Upload invoice attachment',
    });
    if (authError) {
      return authError;
    }

    return uploadAttachmentFileFromArgs({
      args,
      entityName: 'invoice',
      uploadAttachment: (file) => reqContext.client.public.invoices.uploadAttachment({ file }, undefined),
    });
  },
};

export const crmStartInvoiceAttachmentUploadTool = invoiceAttachmentUploadTools.startTool;
export const crmAppendInvoiceAttachmentUploadChunkTool = invoiceAttachmentUploadTools.appendTool;
export const crmFinishInvoiceAttachmentUploadTool = invoiceAttachmentUploadTools.finishTool;

export const crmCreateInvoiceTool: McpTool = {
  metadata: {
    resource: 'invoices',
    operation: 'write',
    tags: ['crm', 'invoices'],
    httpMethod: 'post',
    httpPath: '/api/v2/invoices',
    operationId: 'public.invoices.create',
  },
  tool: {
    name: 'create_invoice',
    title: 'Create invoice',
    description:
      'Create an invoice in Sanka from explicit customer and line item data. Attach uploaded file ids with `attachment_file_ids` when needed. For CRM deal/opportunity-sourced billing, use deal_to_order first and create invoices from the Sanka Order context.',
    inputSchema: INVOICE_CREATE_INPUT_SCHEMA,
    outputSchema: INVOICE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create invoice',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create invoice',
    });
    if (authError) {
      return authError;
    }
    if (isDirectCrmSourceContext(args)) {
      return asErrorResult(DIRECT_CRM_SOURCE_LOCK_MESSAGE);
    }

    const response = (await reqContext.client.public.invoices.create(
      buildFinancialDocumentMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Invoice',
            action: 'created',
            payload: response,
            idKeys: ['invoice_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateInvoiceTool: McpTool = {
  metadata: {
    resource: 'invoices',
    operation: 'write',
    tags: ['crm', 'invoices'],
    httpMethod: 'patch',
    httpPath: '/api/v2/invoices/{invoice_id}',
    operationId: 'public.invoices.update',
  },
  tool: {
    name: 'update_invoice',
    title: 'Update invoice',
    description:
      'Update an existing invoice in Sanka. Attach uploaded file ids with `attachment_file_ids` when needed.',
    inputSchema: INVOICE_UPDATE_INPUT_SCHEMA,
    outputSchema: INVOICE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update invoice',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update invoice',
    });
    if (authError) {
      return authError;
    }

    const invoiceID = readString(args?.['invoice_id']);
    if (!invoiceID) {
      return asErrorResult('`invoice_id` is required.');
    }

    const response = (await reqContext.client.public.invoices.update(
      invoiceID,
      buildFinancialDocumentMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Invoice',
            action: 'updated',
            payload: response,
            idKeys: ['invoice_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmActivateInvoiceTool: McpTool = {
  metadata: {
    resource: 'invoices',
    operation: 'write',
    tags: ['crm', 'invoices'],
    httpMethod: 'post',
    httpPath: '/api/v2/invoices/{invoice_id}/activate',
    operationId: 'public.invoices.activate',
  },
  tool: {
    name: 'activate_invoice',
    title: 'Activate invoice',
    description: 'Restore an archived invoice to active usage status in Sanka.',
    inputSchema: INVOICE_RETRIEVE_INPUT_SCHEMA,
    outputSchema: INVOICE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Activate invoice',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Activate invoice',
    });
    if (authError) {
      return authError;
    }

    const { invoiceID, params } = buildInvoiceRetrieveParams(args);
    if (!invoiceID) {
      return asErrorResult('`invoice_id` is required.');
    }

    const response = normalizeV2MutationEnvelopePayload(
      (await reqContext.client.v2Post<Record<string, unknown>>(
        `/invoices/${encodeURIComponent(invoiceID)}/activate`,
        { query: params },
      )) as unknown as Record<string, unknown>,
    );
    const responseMeta = readRecord(response['meta']);
    const operation = readString(response['operation']) ?? readString(responseMeta?.['operation']);
    const activationPayload = {
      ok: true,
      ...(operation ? { operation } : { operation: 'activate' }),
      invoice_id: readString(response['invoice_id']) ?? readString(response['id']) ?? invoiceID,
      ...response,
    };
    const verification = await buildLifecycleVerification({
      entity: 'invoice',
      id: invoiceID,
      params,
      expectedStatus: 'active',
      retrieve: async (id, query) =>
        (await reqContext.client.public.invoices.retrieve(id, query, undefined)) as unknown as Record<
          string,
          unknown
        >,
    });
    const payload = { ...activationPayload, verification };

    return {
      content: [
        {
          type: 'text',
          text: buildLifecycleMutationSummary({ entity: 'Invoice', action: 'activated', payload }),
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmDeleteInvoiceTool: McpTool = {
  metadata: {
    resource: 'invoices',
    operation: 'write',
    tags: ['crm', 'invoices'],
    httpMethod: 'delete',
    httpPath: '/api/v2/invoices/{invoice_id}',
    operationId: 'public.invoices.delete',
  },
  tool: {
    name: 'delete_invoice',
    title: 'Archive invoice',
    description:
      'Archive an invoice in Sanka by invoice id or external reference. This is a soft delete; use permanent_delete_invoice only after explicit confirmation.',
    inputSchema: INVOICE_DELETE_INPUT_SCHEMA,
    outputSchema: INVOICE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Archive invoice',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete invoice',
    });
    if (authError) {
      return authError;
    }

    const invoiceID = readString(args?.['invoice_id']);
    const externalID = readString(args?.['external_id']);
    if (!invoiceID) {
      return asErrorResult('`invoice_id` is required.');
    }

    const response = (await reqContext.client.public.invoices.delete(
      invoiceID,
      externalID ? { external_id: externalID } : {},
      undefined,
    )) as unknown as Record<string, unknown>;
    const params = externalID ? { external_id: externalID } : {};
    const verification = await buildLifecycleVerification({
      entity: 'invoice',
      id: invoiceID,
      params,
      expectedStatus: 'archived',
      retrieve: async (id, query) =>
        (await reqContext.client.public.invoices.retrieve(id, query, undefined)) as unknown as Record<
          string,
          unknown
        >,
    });
    const payload = { ...response, verification };

    return {
      content: [
        {
          type: 'text',
          text: buildLifecycleMutationSummary({ entity: 'Invoice', action: 'archived', payload }),
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmPermanentDeleteInvoiceTool: McpTool = {
  metadata: {
    resource: 'invoices',
    operation: 'write',
    tags: ['crm', 'invoices'],
    httpMethod: 'delete',
    httpPath: '/api/v2/public/invoices/{invoice_id}/permanent-delete',
    operationId: 'public.invoices.permanentDelete',
  },
  tool: {
    name: 'permanent_delete_invoice',
    title: 'Permanently delete invoice',
    description:
      'Permanently delete an already archived invoice in Sanka. Requires confirm=true and cannot be undone.',
    inputSchema: INVOICE_PERMANENT_DELETE_INPUT_SCHEMA,
    outputSchema: INVOICE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Permanently delete invoice',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Permanently delete invoice',
    });
    if (authError) {
      return authError;
    }

    const { invoiceID, params } = buildInvoiceRetrieveParams(args);
    if (!invoiceID) {
      return asErrorResult('`invoice_id` is required.');
    }
    if (readBoolean(args?.['confirm']) !== true) {
      return asErrorResult('`confirm=true` is required for permanent delete.');
    }

    const response = (await reqContext.client.delete(
      `/api/v2/public/invoices/${encodeURIComponent(invoiceID)}/permanent-delete`,
      { query: { ...params, confirm: true } },
    )) as Record<string, unknown>;
    const verification = await buildPermanentDeleteVerification({
      entity: 'invoice',
      id: invoiceID,
      retrieve: async (id) =>
        (await reqContext.client.public.invoices.retrieve(id, params, undefined)) as unknown as Record<
          string,
          unknown
        >,
    });
    const payload = { ...response, verification };

    return {
      content: [
        {
          type: 'text',
          text: buildLifecycleMutationSummary({ entity: 'Invoice', action: 'permanently deleted', payload }),
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmDownloadPaymentPDFTool: McpTool = {
  metadata: {
    resource: 'payments',
    operation: 'read',
    tags: ['crm', 'payments'],
    httpMethod: 'get',
    httpPath: '/api/v2/payments/{payment_id}/pdf',
    operationId: 'public.payments.downloadPDF',
  },
  tool: {
    name: 'download_payment_pdf',
    title: 'Download payment PDF',
    description: 'Download a payment from Sanka as a PDF document.',
    inputSchema: PAYMENT_DOWNLOAD_PDF_INPUT_SCHEMA,
    outputSchema: BINARY_DOWNLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Download payment PDF',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Download payment PDF',
    });
    if (authError) {
      return authError;
    }

    const { paymentID, params } = buildPaymentDownloadPDFParams(args);
    if (!paymentID) {
      return asErrorResult('`payment_id` is required.');
    }

    const response = await reqContext.client.public.payments.downloadPDF(paymentID, params, undefined);
    return asStoredBinaryDownloadResult(reqContext, response, 'payment.pdf');
  },
};

export const crmListSlipsTool: McpTool = {
  metadata: {
    resource: 'slips',
    operation: 'read',
    tags: ['crm', 'slips'],
    httpMethod: 'get',
    httpPath: '/api/v2/revenues',
    operationId: 'public.slips.list',
  },
  tool: {
    name: 'list_slips',
    title: 'List slips',
    description: 'Review slips in Sanka.',
    inputSchema: SLIP_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List slips',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List slips',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildSlipListParams(args);
    const slips = await reqContext.client.public.slips.list(params, undefined);
    const results = slips.slice(0, limit).map((slip) => slip as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'slips',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${slips.length} slips.`,
        page: 1,
        total: slips.length,
      },
      previewKeys: ['id_slip', 'company_name', 'contact_name'],
    });
  },
};

export const crmGetSlipTool: McpTool = {
  metadata: {
    resource: 'slips',
    operation: 'read',
    tags: ['crm', 'slips'],
    httpMethod: 'get',
    httpPath: '/api/v2/revenues/{slip_id}',
    operationId: 'public.slips.retrieve',
  },
  tool: {
    name: 'get_slip',
    title: 'Get slip',
    description: 'Load one slip from Sanka by slip id, numeric id, or external reference.',
    inputSchema: SLIP_RETRIEVE_INPUT_SCHEMA,
    outputSchema: SLIP_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get slip',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get slip',
    });
    if (authError) {
      return authError;
    }

    const { slipID, params } = buildSlipRetrieveParams(args);
    if (!slipID) {
      return asErrorResult('`slip_id` is required.');
    }

    const slip = (await reqContext.client.public.slips.retrieve(
      slipID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'slip',
            payload: slip,
            previewKeys: ['id_slip', 'company_name', 'contact_name'],
          }),
        },
      ],
      structuredContent: slip,
    };
  },
};

export const crmCreateSlipTool: McpTool = {
  metadata: {
    resource: 'slips',
    operation: 'write',
    tags: ['crm', 'slips'],
    httpMethod: 'post',
    httpPath: '/api/v2/revenues',
    operationId: 'public.slips.create',
  },
  tool: {
    name: 'create_slip',
    title: 'Create slip',
    description: 'Create a slip in Sanka.',
    inputSchema: SLIP_CREATE_INPUT_SCHEMA,
    outputSchema: SLIP_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create slip',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create slip',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.slips.create(
      buildSlipMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Slip',
            action: 'created',
            payload: response,
            idKeys: ['slip_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateSlipTool: McpTool = {
  metadata: {
    resource: 'slips',
    operation: 'write',
    tags: ['crm', 'slips'],
    httpMethod: 'patch',
    httpPath: '/api/v2/revenues/{slip_id}',
    operationId: 'public.slips.update',
  },
  tool: {
    name: 'update_slip',
    title: 'Update slip',
    description: 'Update an existing slip in Sanka.',
    inputSchema: SLIP_UPDATE_INPUT_SCHEMA,
    outputSchema: SLIP_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update slip',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update slip',
    });
    if (authError) {
      return authError;
    }

    const slipID = readString(args?.['slip_id']);
    if (!slipID) {
      return asErrorResult('`slip_id` is required.');
    }

    const response = (await reqContext.client.public.slips.update(
      slipID,
      buildSlipMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Slip',
            action: 'updated',
            payload: response,
            idKeys: ['slip_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteSlipTool: McpTool = {
  metadata: {
    resource: 'slips',
    operation: 'write',
    tags: ['crm', 'slips'],
    httpMethod: 'delete',
    httpPath: '/api/v2/revenues/{slip_id}',
    operationId: 'public.slips.delete',
  },
  tool: {
    name: 'delete_slip',
    title: 'Delete slip',
    description: 'Delete a slip in Sanka by slip id or external reference.',
    inputSchema: SLIP_DELETE_INPUT_SCHEMA,
    outputSchema: SLIP_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete slip',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete slip',
    });
    if (authError) {
      return authError;
    }

    const slipID = readString(args?.['slip_id']);
    const externalID = readString(args?.['external_id']);
    if (!slipID) {
      return asErrorResult('`slip_id` is required.');
    }

    const response = (await reqContext.client.public.slips.delete(
      slipID,
      externalID ? { external_id: externalID } : {},
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Slip',
            action: 'deleted',
            payload: response,
            idKeys: ['slip_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDownloadSlipPDFTool: McpTool = {
  metadata: {
    resource: 'slips',
    operation: 'read',
    tags: ['crm', 'slips'],
    httpMethod: 'get',
    httpPath: '/api/v2/revenues/{slip_id}/pdf',
    operationId: 'public.slips.downloadPDF',
  },
  tool: {
    name: 'download_slip_pdf',
    title: 'Download slip PDF',
    description: 'Download a slip from Sanka as a PDF document.',
    inputSchema: SLIP_DOWNLOAD_PDF_INPUT_SCHEMA,
    outputSchema: BINARY_DOWNLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Download slip PDF',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Download slip PDF',
    });
    if (authError) {
      return authError;
    }

    const { slipID, params } = buildSlipDownloadPDFParams(args);
    if (!slipID) {
      return asErrorResult('`slip_id` is required.');
    }

    const response = await reqContext.client.public.slips.downloadPDF(slipID, params, undefined);
    return asStoredBinaryDownloadResult(reqContext, response, 'slip.pdf');
  },
};

export const crmListBillsTool: McpTool = {
  metadata: {
    resource: 'bills',
    operation: 'read',
    tags: ['crm', 'bills'],
    httpMethod: 'get',
    httpPath: '/api/v2/bills',
    operationId: 'public.bills.list',
  },
  tool: {
    name: 'list_bills',
    title: 'List bills',
    description: 'Review bills in Sanka.',
    inputSchema: BILL_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List bills',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List bills',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildBillListParams(args);
    const bills = await reqContext.client.public.bills.list(params, undefined);
    const results = bills.slice(0, limit).map((bill) => bill as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'bills',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${bills.length} bills.`,
        page: 1,
        total: bills.length,
      },
      previewKeys: ['id_bill', 'company_name', 'contact_name'],
    });
  },
};

export const crmGetBillTool: McpTool = {
  metadata: {
    resource: 'bills',
    operation: 'read',
    tags: ['crm', 'bills'],
    httpMethod: 'get',
    httpPath: '/api/v2/bills/{bill_id}',
    operationId: 'public.bills.retrieve',
  },
  tool: {
    name: 'get_bill',
    title: 'Get bill',
    description: 'Load one bill from Sanka by bill id, numeric id, or external reference.',
    inputSchema: BILL_RETRIEVE_INPUT_SCHEMA,
    outputSchema: BILL_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get bill',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get bill',
    });
    if (authError) {
      return authError;
    }

    const { billID, params } = buildBillRetrieveParams(args);
    if (!billID) {
      return asErrorResult('`bill_id` is required.');
    }

    const bill = (await reqContext.client.public.bills.retrieve(
      billID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'bill',
            payload: bill,
            previewKeys: ['id_bill', 'company_name', 'contact_name'],
          }),
        },
      ],
      structuredContent: bill,
    };
  },
};

export const crmUploadBillAttachmentTool: McpTool = {
  metadata: {
    resource: 'bills',
    operation: 'write',
    tags: ['crm', 'bills'],
    httpMethod: 'post',
    httpPath: '/api/v2/bills/files',
    operationId: 'public.bills.uploadAttachment',
  },
  tool: {
    name: 'upload_bill_attachment',
    title: 'Upload bill attachment',
    description:
      'Upload a bill attachment to Sanka from an already available base64 payload. Prefer this direct upload when the client can pass content_base64 reliably. For client-local invoice PDFs or payloads that are too large or unreliable to pass as one content_base64 string, use start_bill_attachment_upload, append_bill_attachment_upload_chunk until done, then finish_bill_attachment_upload. Use the returned file_id in create_bill or update_bill.',
    inputSchema: BILL_UPLOAD_INPUT_SCHEMA,
    outputSchema: BILL_UPLOAD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Upload bill attachment',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Upload bill attachment',
    });
    if (authError) {
      return authError;
    }

    return uploadAttachmentFileFromArgs({
      args,
      entityName: 'bill',
      uploadAttachment: (file) => reqContext.client.public.bills.uploadAttachment({ file }, undefined),
    });
  },
};

export const crmStartBillAttachmentUploadTool = billAttachmentUploadTools.startTool;
export const crmAppendBillAttachmentUploadChunkTool = billAttachmentUploadTools.appendTool;
export const crmFinishBillAttachmentUploadTool = billAttachmentUploadTools.finishTool;

export const crmCreateBillTool: McpTool = {
  metadata: {
    resource: 'bills',
    operation: 'write',
    tags: ['crm', 'bills'],
    httpMethod: 'post',
    httpPath: '/api/v2/bills',
    operationId: 'public.bills.create',
  },
  tool: {
    name: 'create_bill',
    title: 'Create bill',
    description:
      'Create a bill in Sanka. When a supplier invoice PDF is provided or required, upload the original file first: use upload_bill_attachment for already available base64 payloads, or start_bill_attachment_upload plus append_bill_attachment_upload_chunk until done and finish_bill_attachment_upload for client-local PDFs or unreliable large payloads. Attach uploaded file ids with `attachment_file_ids`. Do not silently drop a provided or required attachment unless upload failed or the user explicitly approved skipping it.',
    inputSchema: BILL_CREATE_INPUT_SCHEMA,
    outputSchema: BILL_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create bill',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create bill',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.bills.create(
      buildBillMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Bill',
            action: 'created',
            payload: response,
            idKeys: ['bill_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateBillTool: McpTool = {
  metadata: {
    resource: 'bills',
    operation: 'write',
    tags: ['crm', 'bills'],
    httpMethod: 'patch',
    httpPath: '/api/v2/bills/{bill_id}',
    operationId: 'public.bills.update',
  },
  tool: {
    name: 'update_bill',
    title: 'Update bill',
    description:
      'Update an existing bill in Sanka. To attach a supplier invoice PDF, upload the original file first with upload_bill_attachment for already available base64 payloads, or with start_bill_attachment_upload plus append_bill_attachment_upload_chunk until done and finish_bill_attachment_upload for client-local PDFs or unreliable large payloads. Pass returned file_id values in `attachment_file_ids`.',
    inputSchema: BILL_UPDATE_INPUT_SCHEMA,
    outputSchema: BILL_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update bill',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update bill',
    });
    if (authError) {
      return authError;
    }

    const billID = readString(args?.['bill_id']);
    if (!billID) {
      return asErrorResult('`bill_id` is required.');
    }

    const response = (await reqContext.client.public.bills.update(
      billID,
      buildBillMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Bill',
            action: 'updated',
            payload: response,
            idKeys: ['bill_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteBillTool: McpTool = {
  metadata: {
    resource: 'bills',
    operation: 'write',
    tags: ['crm', 'bills'],
    httpMethod: 'delete',
    httpPath: '/api/v2/bills/{bill_id}',
    operationId: 'public.bills.delete',
  },
  tool: {
    name: 'delete_bill',
    title: 'Delete bill',
    description: 'Delete a bill in Sanka by bill id or external reference.',
    inputSchema: BILL_DELETE_INPUT_SCHEMA,
    outputSchema: BILL_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete bill',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete bill',
    });
    if (authError) {
      return authError;
    }

    const billID = readString(args?.['bill_id']);
    const externalID = readString(args?.['external_id']);
    if (!billID) {
      return asErrorResult('`bill_id` is required.');
    }

    const response = (await reqContext.client.public.bills.delete(
      billID,
      externalID ? { external_id: externalID } : {},
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Bill',
            action: 'deleted',
            payload: response,
            idKeys: ['bill_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListDisbursementsTool: McpTool = {
  metadata: {
    resource: 'disbursements',
    operation: 'read',
    tags: ['crm', 'disbursements'],
    httpMethod: 'get',
    httpPath: '/api/v2/disbursements',
    operationId: 'public.disbursements.list',
  },
  tool: {
    name: 'list_disbursements',
    title: 'List disbursements',
    description: 'Review disbursements in Sanka.',
    inputSchema: DISBURSEMENT_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List disbursements',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List disbursements',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildDisbursementListParams(args);
    const disbursements = await reqContext.client.public.disbursements.list(params, undefined);
    const results = disbursements
      .slice(0, limit)
      .map((disbursement) => disbursement as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'disbursements',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${disbursements.length} disbursements.`,
        page: 1,
        total: disbursements.length,
      },
      previewKeys: ['id_dsb', 'company_name', 'contact_name'],
    });
  },
};

export const crmGetDisbursementTool: McpTool = {
  metadata: {
    resource: 'disbursements',
    operation: 'read',
    tags: ['crm', 'disbursements'],
    httpMethod: 'get',
    httpPath: '/api/v2/disbursements/{disbursement_id}',
    operationId: 'public.disbursements.retrieve',
  },
  tool: {
    name: 'get_disbursement',
    title: 'Get disbursement',
    description: 'Load one disbursement from Sanka by disbursement id, numeric id, or external reference.',
    inputSchema: DISBURSEMENT_RETRIEVE_INPUT_SCHEMA,
    outputSchema: DISBURSEMENT_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get disbursement',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get disbursement',
    });
    if (authError) {
      return authError;
    }

    const { disbursementID, params } = buildDisbursementRetrieveParams(args);
    if (!disbursementID) {
      return asErrorResult('`disbursement_id` is required.');
    }

    const disbursement = (await reqContext.client.public.disbursements.retrieve(
      disbursementID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'disbursement',
            payload: disbursement,
            previewKeys: ['id_dsb', 'company_name', 'contact_name'],
          }),
        },
      ],
      structuredContent: disbursement,
    };
  },
};

export const crmCreateDisbursementTool: McpTool = {
  metadata: {
    resource: 'disbursements',
    operation: 'write',
    tags: ['crm', 'disbursements'],
    httpMethod: 'post',
    httpPath: '/api/v2/disbursements',
    operationId: 'public.disbursements.create',
  },
  tool: {
    name: 'create_disbursement',
    title: 'Create disbursement',
    description: 'Create a disbursement in Sanka.',
    inputSchema: DISBURSEMENT_CREATE_INPUT_SCHEMA,
    outputSchema: DISBURSEMENT_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create disbursement',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create disbursement',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.disbursements.create(
      buildDisbursementMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Disbursement',
            action: 'created',
            payload: response,
            idKeys: ['disbursement_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateDisbursementTool: McpTool = {
  metadata: {
    resource: 'disbursements',
    operation: 'write',
    tags: ['crm', 'disbursements'],
    httpMethod: 'patch',
    httpPath: '/api/v2/disbursements/{disbursement_id}',
    operationId: 'public.disbursements.update',
  },
  tool: {
    name: 'update_disbursement',
    title: 'Update disbursement',
    description: 'Update an existing disbursement in Sanka.',
    inputSchema: DISBURSEMENT_UPDATE_INPUT_SCHEMA,
    outputSchema: DISBURSEMENT_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update disbursement',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update disbursement',
    });
    if (authError) {
      return authError;
    }

    const disbursementID = readString(args?.['disbursement_id']);
    if (!disbursementID) {
      return asErrorResult('`disbursement_id` is required.');
    }

    const response = (await reqContext.client.public.disbursements.update(
      disbursementID,
      buildDisbursementMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Disbursement',
            action: 'updated',
            payload: response,
            idKeys: ['disbursement_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteDisbursementTool: McpTool = {
  metadata: {
    resource: 'disbursements',
    operation: 'write',
    tags: ['crm', 'disbursements'],
    httpMethod: 'delete',
    httpPath: '/api/v2/disbursements/{disbursement_id}',
    operationId: 'public.disbursements.delete',
  },
  tool: {
    name: 'delete_disbursement',
    title: 'Delete disbursement',
    description: 'Delete a disbursement in Sanka by disbursement id or external reference.',
    inputSchema: DISBURSEMENT_DELETE_INPUT_SCHEMA,
    outputSchema: DISBURSEMENT_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete disbursement',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete disbursement',
    });
    if (authError) {
      return authError;
    }

    const disbursementID = readString(args?.['disbursement_id']);
    const externalID = readString(args?.['external_id']);
    if (!disbursementID) {
      return asErrorResult('`disbursement_id` is required.');
    }

    const response = (await reqContext.client.public.disbursements.delete(
      disbursementID,
      externalID ? { external_id: externalID } : {},
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Disbursement',
            action: 'deleted',
            payload: response,
            idKeys: ['disbursement_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListDisbursementAllocationsTool: McpTool = {
  metadata: {
    resource: 'disbursements',
    operation: 'read',
    tags: ['crm', 'disbursements', 'allocations'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/disbursements/{disbursement_id}/allocations',
    operationId: 'public.disbursements.listAllocations',
  },
  tool: {
    name: 'list_disbursement_allocations',
    title: 'List disbursement allocations',
    description: 'Review bill and expense payable allocation rows for one disbursement in Sanka.',
    inputSchema: DISBURSEMENT_ALLOCATIONS_LIST_INPUT_SCHEMA,
    outputSchema: DISBURSEMENT_ALLOCATIONS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List disbursement allocations',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List disbursement allocations',
    });
    if (authError) {
      return authError;
    }

    const { disbursementID, params } = buildDisbursementAllocationQueryParams(args);
    if (!disbursementID) {
      return asErrorResult('`disbursement_id` is required.');
    }

    const response = (await reqContext.client.get(
      `/api/v2/public/disbursements/${encodeURIComponent(disbursementID)}/allocations`,
      { query: params },
    )) as Record<string, unknown>;
    const payload = normalizeAllocationEnvelopePayload(response);

    return {
      content: [
        {
          type: 'text',
          text: buildDisbursementAllocationsSummary(payload, disbursementID, 'Loaded'),
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmCreateDisbursementAllocationTool: McpTool = {
  metadata: {
    resource: 'disbursements',
    operation: 'write',
    tags: ['crm', 'disbursements', 'allocations'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/disbursements/{disbursement_id}/allocations',
    operationId: 'public.disbursements.createAllocation',
  },
  tool: {
    name: 'create_disbursement_allocation',
    title: 'Create disbursement allocation',
    description:
      'Add one bill or expense payable allocation row to a disbursement without replacing existing allocation rows.',
    inputSchema: DISBURSEMENT_ALLOCATION_CREATE_INPUT_SCHEMA,
    outputSchema: DISBURSEMENT_ALLOCATIONS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create disbursement allocation',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create disbursement allocation',
    });
    if (authError) {
      return authError;
    }

    const { disbursementID, params } = buildDisbursementAllocationQueryParams(args);
    if (!disbursementID) {
      return asErrorResult('`disbursement_id` is required.');
    }

    const response = (await reqContext.client.post(
      `/api/v2/public/disbursements/${encodeURIComponent(disbursementID)}/allocations`,
      {
        query: params,
        body: buildDisbursementAllocationBody(args),
      },
    )) as Record<string, unknown>;
    const payload = normalizeAllocationEnvelopePayload(response);

    return {
      content: [
        {
          type: 'text',
          text: buildDisbursementAllocationsSummary(payload, disbursementID, 'Created'),
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmUpdateDisbursementAllocationTool: McpTool = {
  metadata: {
    resource: 'disbursements',
    operation: 'write',
    tags: ['crm', 'disbursements', 'allocations'],
    httpMethod: 'patch',
    httpPath: '/api/v2/public/disbursements/{disbursement_id}/allocations/{allocation_id}',
    operationId: 'public.disbursements.updateAllocation',
  },
  tool: {
    name: 'update_disbursement_allocation',
    title: 'Update disbursement allocation',
    description: 'Update one bill or expense payable allocation row on a disbursement.',
    inputSchema: DISBURSEMENT_ALLOCATION_UPDATE_INPUT_SCHEMA,
    outputSchema: DISBURSEMENT_ALLOCATIONS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update disbursement allocation',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update disbursement allocation',
    });
    if (authError) {
      return authError;
    }

    const { disbursementID, allocationID, params } = buildDisbursementAllocationQueryParams(args);
    if (!disbursementID) {
      return asErrorResult('`disbursement_id` is required.');
    }
    if (!allocationID) {
      return asErrorResult('`allocation_id` is required.');
    }

    const response = (await reqContext.client.patch(
      `/api/v2/public/disbursements/${encodeURIComponent(disbursementID)}/allocations/${encodeURIComponent(
        allocationID,
      )}`,
      {
        query: params,
        body: buildDisbursementAllocationBody(args, { partial: true }),
      },
    )) as Record<string, unknown>;
    const payload = normalizeAllocationEnvelopePayload(response);

    return {
      content: [
        {
          type: 'text',
          text: buildDisbursementAllocationsSummary(payload, disbursementID, 'Updated'),
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmDeleteDisbursementAllocationTool: McpTool = {
  metadata: {
    resource: 'disbursements',
    operation: 'write',
    tags: ['crm', 'disbursements', 'allocations'],
    httpMethod: 'delete',
    httpPath: '/api/v2/public/disbursements/{disbursement_id}/allocations/{allocation_id}',
    operationId: 'public.disbursements.deleteAllocation',
  },
  tool: {
    name: 'delete_disbursement_allocation',
    title: 'Delete disbursement allocation',
    description: 'Archive/delete one bill or expense payable allocation row from a disbursement.',
    inputSchema: DISBURSEMENT_ALLOCATION_DELETE_INPUT_SCHEMA,
    outputSchema: DISBURSEMENT_ALLOCATIONS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete disbursement allocation',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete disbursement allocation',
    });
    if (authError) {
      return authError;
    }

    const { disbursementID, allocationID, params } = buildDisbursementAllocationQueryParams(args);
    if (!disbursementID) {
      return asErrorResult('`disbursement_id` is required.');
    }
    if (!allocationID) {
      return asErrorResult('`allocation_id` is required.');
    }

    const response = (await reqContext.client.delete(
      `/api/v2/public/disbursements/${encodeURIComponent(disbursementID)}/allocations/${encodeURIComponent(
        allocationID,
      )}`,
      { query: params },
    )) as Record<string, unknown>;
    const payload = normalizeAllocationEnvelopePayload(response);

    return {
      content: [
        {
          type: 'text',
          text: buildDisbursementAllocationsSummary(payload, disbursementID, 'Deleted'),
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmListTicketsTool: McpTool = {
  metadata: {
    resource: 'tickets',
    operation: 'read',
    tags: ['crm', 'tickets'],
    httpMethod: 'get',
    httpPath: '/api/v2/tickets',
    operationId: 'public.tickets.list',
  },
  tool: {
    name: 'list_tickets',
    title: 'List tickets',
    description:
      'Review tickets in Sanka. Use this when the user wants to inspect support or service tickets in the current workspace.',
    inputSchema: TICKET_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List tickets',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List tickets',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildTicketListParams(args);
    const tickets = await reqContext.client.public.tickets.list(params, undefined);
    const results = tickets.slice(0, limit).map((ticket) => ticket as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'tickets',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${tickets.length} tickets.`,
        page: 1,
        total: tickets.length,
      },
      previewKeys: ['title', 'ticket_id', 'id'],
    });
  },
};

export const crmGetTicketTool: McpTool = {
  metadata: {
    resource: 'tickets',
    operation: 'read',
    tags: ['crm', 'tickets'],
    httpMethod: 'get',
    httpPath: '/api/v2/tickets/{ticket_id}',
    operationId: 'public.tickets.retrieve',
  },
  tool: {
    name: 'get_ticket',
    title: 'Get ticket',
    description: 'Load one ticket from Sanka by ticket id, numeric id, or external reference.',
    inputSchema: TICKET_RETRIEVE_INPUT_SCHEMA,
    outputSchema: TICKET_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get ticket',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get ticket',
    });
    if (authError) {
      return authError;
    }

    const { ticketID, params } = buildTicketRetrieveParams(args);
    if (!ticketID) {
      return asErrorResult('`ticket_id` is required.');
    }

    const ticket = (await reqContext.client.public.tickets.retrieve(
      ticketID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildTicketDetailSummary(ticket) }],
      structuredContent: ticket,
    };
  },
};

export const crmCreateTicketTool: McpTool = {
  metadata: {
    resource: 'tickets',
    operation: 'write',
    tags: ['crm', 'tickets'],
    httpMethod: 'post',
    httpPath: '/api/v2/tickets',
    operationId: 'public.tickets.create',
  },
  tool: {
    name: 'create_ticket',
    title: 'Create ticket',
    description: 'Create a ticket in Sanka for support or service workflows.',
    inputSchema: TICKET_CREATE_INPUT_SCHEMA,
    outputSchema: TICKET_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create ticket',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create ticket',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.tickets.create(
      buildTicketMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Ticket',
            action: 'created',
            payload: response,
            idKeys: ['ticket_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateTicketTool: McpTool = {
  metadata: {
    resource: 'tickets',
    operation: 'write',
    tags: ['crm', 'tickets'],
    httpMethod: 'patch',
    httpPath: '/api/v2/tickets/{ticket_id}',
    operationId: 'public.tickets.update',
  },
  tool: {
    name: 'update_ticket',
    title: 'Update ticket',
    description:
      'Update an existing ticket in Sanka. Use `lookup_external_id` when the path identifier is not the external reference you want to resolve by.',
    inputSchema: TICKET_UPDATE_INPUT_SCHEMA,
    outputSchema: TICKET_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update ticket',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update ticket',
    });
    if (authError) {
      return authError;
    }

    const { ticketID, params } = buildTicketUpdateParams(args);
    if (!ticketID) {
      return asErrorResult('`ticket_id` is required.');
    }

    const response = (await reqContext.client.public.tickets.update(
      ticketID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Ticket',
            action: 'updated',
            payload: response,
            idKeys: ['ticket_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteTicketTool: McpTool = {
  metadata: {
    resource: 'tickets',
    operation: 'write',
    tags: ['crm', 'tickets'],
    httpMethod: 'delete',
    httpPath: '/api/v2/tickets/{ticket_id}',
    operationId: 'public.tickets.delete',
  },
  tool: {
    name: 'delete_ticket',
    title: 'Delete ticket',
    description: 'Archive or delete a ticket in Sanka by ticket id, numeric id, or external reference.',
    inputSchema: TICKET_DELETE_INPUT_SCHEMA,
    outputSchema: TICKET_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete ticket',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete ticket',
    });
    if (authError) {
      return authError;
    }

    const { ticketID, params } = buildTicketRetrieveParams(args);
    if (!ticketID) {
      return asErrorResult('`ticket_id` is required.');
    }

    const externalID =
      'external_id' in params && typeof params.external_id === 'string' ? params.external_id : undefined;
    const response = (await reqContext.client.public.tickets.delete(
      ticketID,
      externalID ? { external_id: externalID } : {},
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Ticket',
            action: 'deleted',
            payload: response,
            idKeys: ['ticket_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListTicketPipelinesTool: McpTool = {
  metadata: {
    resource: 'tickets',
    operation: 'read',
    tags: ['crm', 'tickets'],
    httpMethod: 'get',
    httpPath: '/api/v2/tickets/pipelines',
    operationId: 'public.tickets.listPipelines',
  },
  tool: {
    name: 'list_ticket_pipelines',
    title: 'List ticket pipelines',
    description:
      'Discover the ticket pipelines and stages defined in the current workspace. Use this before stage-based ticket updates so the stage keys match the workspace configuration.',
    inputSchema: TICKET_PIPELINES_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List ticket pipelines',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List ticket pipelines',
    });
    if (authError) {
      return authError;
    }

    const workspaceID = readString(args?.['workspace_id']);
    const params = workspaceID ? { workspace_id: workspaceID } : {};
    const pipelines = await reqContext.client.public.tickets.listPipelines(params, undefined);
    const results = pipelines.map((pipeline) => pipeline as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'ticket pipelines',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} ticket pipelines.`,
        page: 1,
        total: results.length,
      },
      previewKeys: ['name', 'internal_name'],
    });
  },
};

export const crmUpdateTicketStatusTool: McpTool = {
  metadata: {
    resource: 'tickets',
    operation: 'write',
    tags: ['crm', 'tickets'],
    httpMethod: 'patch',
    httpPath: '/api/v2/tickets/{ticket_id}/status',
    operationId: 'public.tickets.updateStatus',
  },
  tool: {
    name: 'update_ticket_status',
    title: 'Update ticket status',
    description:
      'Update only the stage or status of a ticket in Sanka. Prefer this over update_ticket when you only need a stage move or status change.',
    inputSchema: TICKET_STATUS_UPDATE_INPUT_SCHEMA,
    outputSchema: TICKET_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update ticket status',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update ticket status',
    });
    if (authError) {
      return authError;
    }

    const { ticketID, params } = buildTicketUpdateStatusParams(args);
    if (!ticketID) {
      return asErrorResult('`ticket_id` is required.');
    }
    if (!params.stage_key && !params.status) {
      return asErrorResult('At least one of `stage_key` or `status` is required.');
    }

    const response = (await reqContext.client.public.tickets.updateStatus(
      ticketID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Ticket',
            action: 'updated',
            payload: response,
            idKeys: ['ticket_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListObjectSchemasTool: McpTool = {
  metadata: {
    resource: 'object-schemas',
    operation: 'read',
    tags: ['crm', 'schema', 'custom-objects'],
    httpMethod: 'get',
    httpPath: '/api/v2/object-schemas',
    operationId: 'public.objectSchemas.list',
  },
  tool: {
    name: 'list_object_schemas',
    title: 'List object schemas',
    description:
      'List Sanka custom object schemas. Integration schema listing is a V2 backend gap and will be rejected by the API.',
    inputSchema: OBJECT_SCHEMA_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List object schemas',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List object schemas',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildObjectSchemaListParams(args);
    const schemas = normalizeObjectSchemaListPayload(
      await reqContext.client.get('/api/v2/object-schemas', {
        query: params,
      }),
    );
    const results = schemas.slice(0, limit);

    return buildListResult({
      label: 'object schemas',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${schemas.length} object schemas.`,
        page: 1,
        total: schemas.length,
      },
      previewKeys: ['name', 'slug', 'external_id'],
    });
  },
};

export const crmMutateObjectSchemaTool: McpTool = {
  metadata: {
    resource: 'object-schemas',
    operation: 'write',
    tags: ['crm', 'schema', 'custom-objects'],
    httpMethod: 'post',
    httpPath: '/api/v2/object-schemas',
    operationId: 'public.objectSchemas.mutate',
  },
  tool: {
    name: 'mutate_object_schema',
    title: 'Mutate object schema',
    description:
      'Create, update, or delete a Sanka custom object schema through routed arguments. Integration schema mutation is a V2 backend gap and will be rejected by the API.',
    inputSchema: OBJECT_SCHEMA_MUTATION_INPUT_SCHEMA,
    outputSchema: OBJECT_SCHEMA_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Mutate object schema',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Mutate object schema',
    });
    if (authError) {
      return authError;
    }

    const body = buildObjectSchemaMutationBody(args);
    if (!body['operation']) {
      return asErrorResult('`operation` is required.');
    }

    const response = normalizeObjectSchemaMutationPayload(
      (await reqContext.client.post('/api/v2/object-schemas', {
        body,
      })) as Record<string, unknown>,
    );

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Object schema',
            action: objectSchemaMutationAction(response, body),
            payload: response,
            idKeys: ['object_schema_id', 'external_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListAppBlueprintTemplatesTool: McpTool = {
  metadata: {
    resource: 'app-builder',
    operation: 'read',
    tags: ['crm', 'app-builder', 'schema', 'modules'],
    httpMethod: 'get',
    httpPath: '/api/v2/app-builder/templates',
    operationId: 'public.appBuilder.templates',
  },
  tool: {
    name: 'list_app_blueprint_templates',
    title: 'List app blueprint templates',
    description:
      'List Sanka app-builder templates such as CRM, ERP, expense management, inventory, procurement, billing, HR, IT asset management, project management, and support desk before previewing or applying a workspace blueprint.',
    inputSchema: PERMISSION_SET_EDITOR_INPUT_SCHEMA,
    outputSchema: APP_BLUEPRINT_TEMPLATES_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List app blueprint templates',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List app blueprint templates',
    });
    if (authError) {
      return authError;
    }

    const response = normalizeV2EnvelopeDataPayload(
      (await reqContext.client.get('/api/v2/app-builder/templates')) as Record<string, unknown>,
    );
    const templates = Array.isArray(response['templates']) ? response['templates'] : [];
    return {
      content: [
        {
          type: 'text',
          text: `Returned ${templates.length} app blueprint templates.`,
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmPreviewAppBlueprintTool: McpTool = {
  metadata: {
    resource: 'app-builder',
    operation: 'read',
    tags: ['crm', 'app-builder', 'schema', 'modules', 'permissions'],
    httpMethod: 'post',
    httpPath: '/api/v2/app-builder/blueprints/preview',
    operationId: 'public.appBuilder.preview',
  },
  tool: {
    name: 'preview_app_blueprint',
    title: 'Preview app blueprint',
    description:
      'Preview a Sanka workspace blueprint including side-menu modules, object schema references, permission sets, guides, flowcharts, and ER diagrams. Use template_slug for exact template matches, overlay for template + AI overlay partial matches, or blueprint_dsl for unknown generated blueprints. This does not mutate records.',
    inputSchema: APP_BLUEPRINT_INPUT_SCHEMA,
    outputSchema: APP_BLUEPRINT_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Preview app blueprint',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Preview app blueprint',
    });
    if (authError) {
      return authError;
    }

    const response = normalizeV2EnvelopeDataPayload(
      (await reqContext.client.post('/api/v2/app-builder/blueprints/preview', {
        body: buildAppBlueprintBody(args),
      })) as Record<string, unknown>,
    );
    return buildAppBlueprintToolResult(response, 'previewed');
  },
};

export const crmApplyAppBlueprintTool: McpTool = {
  metadata: {
    resource: 'app-builder',
    operation: 'write',
    tags: ['crm', 'app-builder', 'schema', 'modules', 'permissions'],
    httpMethod: 'post',
    httpPath: '/api/v2/app-builder/blueprints/apply',
    operationId: 'public.appBuilder.apply',
  },
  tool: {
    name: 'apply_app_blueprint',
    title: 'Apply app blueprint',
    description:
      'Apply a validator-approved Sanka workspace blueprint by mutating global side-menu modules, creating missing custom objects, creating or updating permission sets, saving generated guide/Mermaid artifacts, and optionally promoting them to editable guide manuals. Requires confirm=true after explicit user approval; generated blueprints also require allow_generated_blueprint_apply=true.',
    inputSchema: APP_BLUEPRINT_APPLY_INPUT_SCHEMA,
    outputSchema: APP_BLUEPRINT_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Apply app blueprint',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Apply app blueprint',
    });
    if (authError) {
      return authError;
    }
    if (readBoolean(args?.['confirm']) !== true) {
      return asErrorResult(
        '`confirm=true` is required after explicit user approval before applying an app blueprint.',
      );
    }

    const response = normalizeV2EnvelopeDataPayload(
      (await reqContext.client.post('/api/v2/app-builder/blueprints/apply', {
        body: buildAppBlueprintBody(args, true),
      })) as Record<string, unknown>,
    );
    return buildAppBlueprintToolResult(response, 'applied');
  },
};

export const crmListPermissionSetsTool: McpTool = {
  metadata: {
    resource: 'permission-sets',
    operation: 'read',
    tags: ['crm', 'permission-sets', 'governance'],
    httpMethod: 'get',
    httpPath: '/api/v2/permission-sets',
    operationId: 'public.permissionSets.list',
  },
  tool: {
    name: 'list_permission_sets',
    title: 'List permission sets',
    description: 'Review permission sets for Sanka workspace governance and access-control planning.',
    inputSchema: PERMISSION_SET_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List permission sets',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List permission sets',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildPermissionSetListParams(args);
    const payload = normalizePermissionSetListPayload(
      (await reqContext.client.get('/api/v2/permission-sets', { query: params })) as Record<string, unknown>,
    );
    const results = payload.rows.slice(0, limit);
    return buildListResult({
      label: 'permission sets',
      payload: {
        count: results.length,
        data: results,
        message: payload.message,
        page: payload.page,
        total: payload.total,
      },
      previewKeys: ['name', 'id'],
    });
  },
};

export const crmGetPermissionSetEditorTool: McpTool = {
  metadata: {
    resource: 'permission-sets',
    operation: 'read',
    tags: ['crm', 'permission-sets', 'governance'],
    httpMethod: 'get',
    httpPath: '/api/v2/permission-sets/editor',
    operationId: 'public.permissionSets.editor',
  },
  tool: {
    name: 'get_permission_set_editor',
    title: 'Get permission set editor',
    description:
      'Load permission dictionary, object labels, system settings, and existing permission sets for governance design.',
    inputSchema: PERMISSION_SET_EDITOR_INPUT_SCHEMA,
    outputSchema: PERMISSION_SET_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get permission set editor',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get permission set editor',
    });
    if (authError) {
      return authError;
    }

    const response = normalizeV2EnvelopeDataPayload(
      (await reqContext.client.get('/api/v2/permission-sets/editor')) as Record<string, unknown>,
    );
    return {
      content: [{ type: 'text', text: 'Loaded permission set editor metadata.' }],
      structuredContent: response,
    };
  },
};

export const crmCreatePermissionSetTool: McpTool = {
  metadata: {
    resource: 'permission-sets',
    operation: 'write',
    tags: ['crm', 'permission-sets', 'governance'],
    httpMethod: 'post',
    httpPath: '/api/v2/permission-sets',
    operationId: 'public.permissionSets.create',
  },
  tool: {
    name: 'create_permission_set',
    title: 'Create permission set',
    description: 'Create a Sanka permission set for workspace governance.',
    inputSchema: PERMISSION_SET_CREATE_INPUT_SCHEMA,
    outputSchema: PERMISSION_SET_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create permission set',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create permission set',
    });
    if (authError) {
      return authError;
    }

    const body = buildPermissionSetMutationBody(args);
    if (!readString(body['name'])) {
      return asErrorResult('`name` is required.');
    }
    const response = normalizeV2MutationEnvelopePayload(
      (await reqContext.client.post('/api/v2/permission-sets', { body })) as Record<string, unknown>,
    );
    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Permission set',
            action: 'created',
            payload: response,
            idKeys: ['id', 'permission_set_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdatePermissionSetTool: McpTool = {
  metadata: {
    resource: 'permission-sets',
    operation: 'write',
    tags: ['crm', 'permission-sets', 'governance'],
    httpMethod: 'put',
    httpPath: '/api/v2/permission-sets/{permission_set_id}',
    operationId: 'public.permissionSets.update',
  },
  tool: {
    name: 'update_permission_set',
    title: 'Update permission set',
    description: 'Update an existing Sanka permission set for workspace governance.',
    inputSchema: PERMISSION_SET_UPDATE_INPUT_SCHEMA,
    outputSchema: PERMISSION_SET_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update permission set',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update permission set',
    });
    if (authError) {
      return authError;
    }

    const permissionSetID = readString(args?.['permission_set_id'] ?? args?.['permissionSetId']);
    if (!permissionSetID) {
      return asErrorResult('`permission_set_id` is required.');
    }
    const body = buildPermissionSetMutationBody(args);
    if (!readString(body['name'])) {
      return asErrorResult('`name` is required.');
    }
    const response = normalizeV2MutationEnvelopePayload(
      (await reqContext.client.put(`/api/v2/permission-sets/${encodeURIComponent(permissionSetID)}`, {
        body,
      })) as Record<string, unknown>,
    );
    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Permission set',
            action: 'updated',
            payload: response,
            idKeys: ['id', 'permission_set_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListPropertiesTool: McpTool = {
  metadata: {
    resource: 'properties',
    operation: 'read',
    tags: ['crm', 'properties'],
    httpMethod: 'get',
    httpPath: '/api/v2/properties/{object_name}',
    operationId: 'public.properties.list',
  },
  tool: {
    name: 'list_properties',
    title: 'List properties',
    description:
      'List properties for a Sanka object family such as orders, companies, or deals. Use this before creating or updating object records when you need the current property schema. Company billing_cycle and payment_cycle are standard company fields, not a custom-property discovery flow.',
    inputSchema: PROPERTY_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List properties',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List properties',
    });
    if (authError) {
      return authError;
    }

    const { objectName, limit, params } = buildPropertyListParams(args);
    if (!objectName) {
      return asErrorResult('`object_name` is required.');
    }

    const properties = await reqContext.client.public.properties.list(objectName, params, undefined);
    const results = properties
      .slice(0, limit)
      .map((property) => property as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'properties',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${properties.length} properties.`,
        page: 1,
        total: properties.length,
      },
      previewKeys: ['name', 'internal_name', 'id'],
    });
  },
};

export const crmGetPropertyTool: McpTool = {
  metadata: {
    resource: 'properties',
    operation: 'read',
    tags: ['crm', 'properties'],
    httpMethod: 'get',
    httpPath: '/api/v2/properties/{object_name}/{property_ref}',
    operationId: 'public.properties.retrieve',
  },
  tool: {
    name: 'get_property',
    title: 'Get property',
    description: 'Load one property definition from Sanka for a given object family and property reference.',
    inputSchema: PROPERTY_RETRIEVE_INPUT_SCHEMA,
    outputSchema: PROPERTY_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get property',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get property',
    });
    if (authError) {
      return authError;
    }

    const { objectName, propertyRef, params } = buildPropertyRetrieveParams(args);
    if (!objectName) {
      return asErrorResult('`object_name` is required.');
    }
    if (!propertyRef) {
      return asErrorResult('`property_ref` is required.');
    }

    const property = (await reqContext.client.public.properties.retrieve(
      propertyRef,
      params as { object_name: string; workspace_id?: string; 'Accept-Language'?: string },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'property',
            payload: property,
            previewKeys: ['name', 'internal_name', 'id'],
          }),
        },
      ],
      structuredContent: property,
    };
  },
};

export const crmCreatePropertyTool: McpTool = {
  metadata: {
    resource: 'properties',
    operation: 'write',
    tags: ['crm', 'properties'],
    httpMethod: 'post',
    httpPath: '/api/v2/properties/{object_name}',
    operationId: 'public.properties.create',
  },
  tool: {
    name: 'create_property',
    title: 'Create property',
    description:
      'Create a custom property in Sanka or a connected CRM. When provider is supplied, the MCP never performs a Sanka-only mutation; omit provider for Sanka properties. Do not use this for company billing_cycle or payment_cycle; those are standard company fields set through create_company/update_company.',
    inputSchema: PROPERTY_CREATE_INPUT_SCHEMA,
    outputSchema: PROPERTY_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create property',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create property',
    });
    if (authError) {
      return authError;
    }

    const objectName = readString(args?.['object_name']);
    if (!objectName) {
      return asErrorResult('`object_name` is required.');
    }

    const body = buildPropertyMutationBody(args);
    const routingError = validateAndNormalizePropertyMutationRouting(body);
    if (routingError) {
      return asErrorResult(routingError);
    }

    const response = (await reqContext.client.public.properties.create(
      objectName,
      body,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Property',
            action: 'created',
            payload: response,
            idKeys: ['property_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdatePropertyTool: McpTool = {
  metadata: {
    resource: 'properties',
    operation: 'write',
    tags: ['crm', 'properties'],
    httpMethod: 'put',
    httpPath: '/api/v2/properties/{object_name}/{property_ref}',
    operationId: 'public.properties.update',
  },
  tool: {
    name: 'update_property',
    title: 'Update property',
    description:
      'Update an existing custom property in Sanka or a connected CRM. When provider is supplied, the MCP never performs a Sanka-only mutation; omit provider for Sanka properties.',
    inputSchema: PROPERTY_UPDATE_INPUT_SCHEMA,
    outputSchema: PROPERTY_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update property',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update property',
    });
    if (authError) {
      return authError;
    }

    const objectName = readString(args?.['object_name']);
    const propertyRef = readString(args?.['property_ref']);
    if (!objectName) {
      return asErrorResult('`object_name` is required.');
    }
    if (!propertyRef) {
      return asErrorResult('`property_ref` is required.');
    }

    const body = buildPropertyMutationBody(args);
    const routingError = validateAndNormalizePropertyMutationRouting(body);
    if (routingError) {
      return asErrorResult(routingError);
    }

    const response = (await reqContext.client.public.properties.update(
      propertyRef,
      {
        object_name: objectName,
        ...body,
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Property',
            action: 'updated',
            payload: response,
            idKeys: ['property_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeletePropertyTool: McpTool = {
  metadata: {
    resource: 'properties',
    operation: 'write',
    tags: ['crm', 'properties'],
    httpMethod: 'delete',
    httpPath: '/api/v2/properties/{object_name}/{property_ref}',
    operationId: 'public.properties.delete',
  },
  tool: {
    name: 'delete_property',
    title: 'Delete property',
    description:
      'Delete a custom property in Sanka or a connected CRM for the specified object family. When provider is supplied, the MCP never performs a Sanka-only mutation; omit provider for Sanka properties.',
    inputSchema: PROPERTY_DELETE_INPUT_SCHEMA,
    outputSchema: PROPERTY_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete property',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete property',
    });
    if (authError) {
      return authError;
    }

    const { objectName, propertyRef, params } = buildPropertyDeleteParams(args);
    if (!objectName) {
      return asErrorResult('`object_name` is required.');
    }
    if (!propertyRef) {
      return asErrorResult('`property_ref` is required.');
    }

    const routingError = validateAndNormalizePropertyMutationRouting(params);
    if (routingError) {
      return asErrorResult(routingError);
    }

    const response = (await reqContext.client.public.properties.delete(
      propertyRef,
      params as {
        object_name: string;
        target?: string;
        provider?: string;
        channel_id?: string;
        external_object_type?: string;
        dry_run?: boolean;
        confirm?: boolean;
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Property',
            action: 'deleted',
            payload: response,
            idKeys: ['property_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

const APPROVAL_REQUEST_PATH = '/api/v2/approval-requests';

export const crmCreateApprovalRequestTool: McpTool = {
  metadata: {
    resource: 'approval-requests',
    operation: 'write',
    tags: ['crm', 'approvals'],
    httpMethod: 'post',
    httpPath: APPROVAL_REQUEST_PATH,
    operationId: 'public.approval-requests.create',
  },
  tool: {
    name: 'create_approval_request',
    title: 'Create approval request',
    description:
      'Create an ad hoc approval request for a Sanka record. Use this when a specific estimate, invoice, expense, or other supported record needs approval even if no approval rule exists.',
    inputSchema: APPROVAL_REQUEST_CREATE_INPUT_SCHEMA,
    outputSchema: RULE_SETTINGS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create approval request',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Create approval request' });
    if (authError) {
      return authError;
    }
    const { objectName, recordID, body } = buildApprovalRequestBody(args);
    if (!objectName) {
      return asErrorResult('`object` is required.');
    }
    if (!recordID) {
      return asErrorResult('`record_id` is required.');
    }
    if (readStringArray(args?.['approver_user_ids']).length === 0) {
      return asErrorResult('`approver_user_ids` is required.');
    }
    const query = buildApprovalMutationQuery(args);
    const response = (await reqContext.client.post(APPROVAL_REQUEST_PATH, {
      body,
      ...(Object.keys(query).length > 0 ? { query } : undefined),
    })) as Record<string, unknown>;
    return buildApprovalRequestMutationResult('created', response);
  },
};

export const crmListRecordApprovalsTool: McpTool = {
  metadata: {
    resource: 'approval-requests',
    operation: 'read',
    tags: ['crm', 'approvals'],
    httpMethod: 'get',
    httpPath: APPROVAL_REQUEST_PATH,
    operationId: 'public.approval-requests.list',
  },
  tool: {
    name: 'list_record_approvals',
    title: 'List record approvals',
    description:
      'List approval rules and ad hoc approval requests currently associated with one Sanka record.',
    inputSchema: RECORD_APPROVAL_LIST_INPUT_SCHEMA,
    outputSchema: RULE_SETTINGS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List record approvals',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List record approvals' });
    if (authError) {
      return authError;
    }
    const { objectName, recordID, params } = buildRecordApprovalsQuery(args);
    if (!objectName) {
      return asErrorResult('`object` is required.');
    }
    if (!recordID) {
      return asErrorResult('`record_id` is required.');
    }
    const limit = Math.max(1, Math.min(100, readNumber(args?.['limit'], 25)));
    const payload = (await reqContext.client.get(APPROVAL_REQUEST_PATH, { query: params })) as Record<
      string,
      unknown
    >;
    return buildRecordApprovalsListResult(payload, limit);
  },
};

const createRecordApprovalDecisionTool = ({
  name,
  title,
  decision,
}: {
  name: string;
  title: string;
  decision: 'approve' | 'reject';
}): McpTool => ({
  metadata: {
    resource: 'approval-requests',
    operation: 'write',
    tags: ['crm', 'approvals'],
    httpMethod: 'post',
    httpPath: `${APPROVAL_REQUEST_PATH}/{history_id}/${decision}`,
    operationId: `public.approval-requests.${decision}`,
  },
  tool: {
    name,
    title,
    description: `${title} by WorkflowHistory UUID. The authenticated user must be one of the assigned approvers.`,
    inputSchema: RECORD_APPROVAL_MUTATION_INPUT_SCHEMA,
    outputSchema: RULE_SETTINGS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title,
      readOnlyHint: false,
      destructiveHint: decision === 'reject',
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: title });
    if (authError) {
      return authError;
    }
    const historyID = readString(args?.['history_id'] ?? args?.['historyId']);
    if (!historyID) {
      return asErrorResult('`history_id` is required.');
    }
    const query = buildApprovalMutationQuery(args);
    const response = (await reqContext.client.post(
      `${APPROVAL_REQUEST_PATH}/${encodeURIComponent(historyID)}/${decision}`,
      Object.keys(query).length > 0 ? { query } : {},
    )) as Record<string, unknown>;
    return buildApprovalRequestMutationResult(decision === 'approve' ? 'approved' : 'rejected', response);
  },
});

export const crmApproveRecordApprovalTool: McpTool = createRecordApprovalDecisionTool({
  name: 'approve_record_approval',
  title: 'Approve record approval',
  decision: 'approve',
});

export const crmRejectRecordApprovalTool: McpTool = createRecordApprovalDecisionTool({
  name: 'reject_record_approval',
  title: 'Reject record approval',
  decision: 'reject',
});

export const crmListApprovalRulesTool: McpTool = createRuleSettingsListTool({
  name: 'list_approval_rules',
  title: 'List approval rules',
  description:
    'List approval rules for a Sanka object. Use this before changing approval gates that block save, send, download, export, convert, CRUD, or bulk actions.',
  path: '/api/v2/approval-rules',
  resource: 'approval-rules',
  inputSchema: APPROVAL_RULE_LIST_INPUT_SCHEMA,
  label: 'approval rules',
});

export const crmGetApprovalRuleOptionsTool: McpTool = createRuleSettingsOptionsTool({
  name: 'get_approval_rule_options',
  title: 'Get approval rule options',
  description:
    'Load approval rule options for an object, including available fields, operators, approvers, and block targets.',
  path: '/api/v2/approval-rules',
  resource: 'approval-rules',
  inputSchema: APPROVAL_RULE_OPTIONS_INPUT_SCHEMA,
  label: 'approval rule options',
});

export const crmUpsertApprovalRuleTool: McpTool = createRuleSettingsUpsertTool({
  name: 'upsert_approval_rule',
  title: 'Upsert approval rule',
  description:
    'Create or update an approval rule for an object. Use block_targets to choose what waits for approval, for example document_download, delivery_send, status_sent, export, or convert.',
  path: '/api/v2/approval-rules',
  resource: 'approval-rules',
  inputSchema: APPROVAL_RULE_UPSERT_INPUT_SCHEMA,
  label: 'Approval rule',
  buildBody: buildApprovalRuleBody,
});

export const crmDeleteApprovalRuleTool: McpTool = createRuleSettingsDeleteTool({
  name: 'delete_approval_rule',
  title: 'Delete approval rule',
  description: 'Delete one approval rule for the specified object.',
  path: '/api/v2/approval-rules',
  resource: 'approval-rules',
  label: 'Approval rule',
});

export const crmListLockRulesTool: McpTool = createRuleSettingsListTool({
  name: 'list_lock_rules',
  title: 'List lock rules',
  description: 'List record lock rules for a Sanka object.',
  path: '/api/v2/lock-rules',
  resource: 'lock-rules',
  inputSchema: LOCK_RULE_LIST_INPUT_SCHEMA,
  label: 'lock rules',
});

export const crmGetLockRuleOptionsTool: McpTool = createRuleSettingsOptionsTool({
  name: 'get_lock_rule_options',
  title: 'Get lock rule options',
  description:
    'Load lock rule options for an object, including fields, operators, lock scopes, and lockable invoice fields.',
  path: '/api/v2/lock-rules',
  resource: 'lock-rules',
  inputSchema: LOCK_RULE_OPTIONS_INPUT_SCHEMA,
  label: 'lock rule options',
});

export const crmUpsertLockRuleTool: McpTool = createRuleSettingsUpsertTool({
  name: 'upsert_lock_rule',
  title: 'Upsert lock rule',
  description:
    'Create or update a record lock rule. For invoices, use lock_scope selected_fields with lock_config.locked_field_keys to lock only chosen fields.',
  path: '/api/v2/lock-rules',
  resource: 'lock-rules',
  inputSchema: LOCK_RULE_UPSERT_INPUT_SCHEMA,
  label: 'Lock rule',
  buildBody: buildLockRuleBody,
});

export const crmDeleteLockRuleTool: McpTool = createRuleSettingsDeleteTool({
  name: 'delete_lock_rule',
  title: 'Delete lock rule',
  description: 'Delete one record lock rule for the specified object.',
  path: '/api/v2/lock-rules',
  resource: 'lock-rules',
  label: 'Lock rule',
});

export const crmListDeliveryRulesTool: McpTool = createRuleSettingsListTool({
  name: 'list_delivery_rules',
  title: 'List delivery rules',
  description: 'List delivery rules. Delivery rules currently apply to invoices only.',
  path: '/api/v2/delivery-rules',
  resource: 'delivery-rules',
  inputSchema: DELIVERY_RULE_LIST_INPUT_SCHEMA,
  label: 'delivery rules',
});

export const crmGetDeliveryRuleOptionsTool: McpTool = createRuleSettingsOptionsTool({
  name: 'get_delivery_rule_options',
  title: 'Get delivery rule options',
  description:
    'Load invoice delivery rule options, including send/schedule actions, fields, operators, and required-field groups.',
  path: '/api/v2/delivery-rules',
  resource: 'delivery-rules',
  inputSchema: DELIVERY_RULE_OPTIONS_INPUT_SCHEMA,
  label: 'delivery rule options',
  extraQueryKeys: ['action'],
});

export const crmUpsertDeliveryRuleTool: McpTool = createRuleSettingsUpsertTool({
  name: 'upsert_delivery_rule',
  title: 'Upsert delivery rule',
  description:
    'Create or update an invoice delivery rule that controls when invoices can be sent or scheduled and which fields are required first.',
  path: '/api/v2/delivery-rules',
  resource: 'delivery-rules',
  inputSchema: DELIVERY_RULE_UPSERT_INPUT_SCHEMA,
  label: 'Delivery rule',
  buildBody: buildDeliveryRuleBody,
});

export const crmDeleteDeliveryRuleTool: McpTool = createRuleSettingsDeleteTool({
  name: 'delete_delivery_rule',
  title: 'Delete delivery rule',
  description: 'Delete one invoice delivery rule for the specified object.',
  path: '/api/v2/delivery-rules',
  resource: 'delivery-rules',
  label: 'Delivery rule',
});

export const crmGetCalendarBootstrapTool: McpTool = {
  metadata: {
    resource: 'calendar',
    operation: 'read',
    tags: ['crm', 'calendar'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/calendar/bootstrap',
    operationId: 'public.calendar.bootstrap',
  },
  tool: {
    name: 'get_calendar_bootstrap',
    title: 'Get calendar bootstrap',
    description:
      'Load the public calendar booking context for an event or existing attendance. Use this at the start of booking, rescheduling, or cancellation flows.',
    inputSchema: CALENDAR_BOOTSTRAP_INPUT_SCHEMA,
    outputSchema: CALENDAR_BOOTSTRAP_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get calendar bootstrap',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get calendar bootstrap',
    });
    if (authError) {
      return authError;
    }

    const payload = (await reqContext.client.public.calendar.bootstrap(
      buildCalendarBootstrapParams(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildCalendarBootstrapSummary(payload) }],
      structuredContent: payload,
    };
  },
};

export const crmCheckCalendarAvailabilityTool: McpTool = {
  metadata: {
    resource: 'calendar',
    operation: 'read',
    tags: ['crm', 'calendar'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/calendar/availability',
    operationId: 'public.calendar.checkAvailability',
  },
  tool: {
    name: 'check_calendar_availability',
    title: 'Check calendar availability',
    description: 'Check available booking slots for a public calendar event in Sanka.',
    inputSchema: CALENDAR_AVAILABILITY_INPUT_SCHEMA,
    outputSchema: CALENDAR_AVAILABILITY_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Check calendar availability',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Check calendar availability',
    });
    if (authError) {
      return authError;
    }

    const payload = (await reqContext.client.public.calendar.checkAvailability(
      buildCalendarAvailabilityParams(args) as {
        event_id: string;
        start_date: string;
        days?: number;
        timezone?: string;
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildCalendarAvailabilitySummary(payload) }],
      structuredContent: payload,
    };
  },
};

export const crmCreateCalendarAttendanceTool: McpTool = {
  metadata: {
    resource: 'calendar',
    operation: 'write',
    tags: ['crm', 'calendar'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/calendar/attendance',
    operationId: 'public.calendar.attendance.create',
  },
  tool: {
    name: 'create_calendar_attendance',
    title: 'Create calendar attendance',
    description: 'Book a new calendar attendance for a public Sanka event.',
    inputSchema: CALENDAR_ATTENDANCE_CREATE_INPUT_SCHEMA,
    outputSchema: CALENDAR_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create calendar attendance',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create calendar attendance',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.calendar.attendance.create(
      buildCalendarAttendanceBody(args) as {
        date: string;
        email: string;
        event_id: string;
        name: string;
        time: string;
        comment?: string;
        timezone?: string;
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildCalendarMutationSummary(response) }],
      structuredContent: response,
    };
  },
};

export const crmCancelCalendarAttendanceTool: McpTool = {
  metadata: {
    resource: 'calendar',
    operation: 'write',
    tags: ['crm', 'calendar'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/calendar/attendance/{attendance_id}/cancel',
    operationId: 'public.calendar.attendance.cancel',
  },
  tool: {
    name: 'cancel_calendar_attendance',
    title: 'Cancel calendar attendance',
    description: 'Cancel an existing public calendar attendance in Sanka.',
    inputSchema: CALENDAR_ATTENDANCE_CANCEL_INPUT_SCHEMA,
    outputSchema: CALENDAR_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Cancel calendar attendance',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Cancel calendar attendance',
    });
    if (authError) {
      return authError;
    }

    const attendanceID = readString(args?.['attendance_id']);
    if (!attendanceID) {
      return asErrorResult('`attendance_id` is required.');
    }

    const response = (await reqContext.client.public.calendar.attendance.cancel(
      attendanceID,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildCalendarMutationSummary(response) }],
      structuredContent: response,
    };
  },
};

export const crmRescheduleCalendarAttendanceTool: McpTool = {
  metadata: {
    resource: 'calendar',
    operation: 'write',
    tags: ['crm', 'calendar'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/calendar/attendance/{attendance_id}/reschedule',
    operationId: 'public.calendar.attendance.reschedule',
  },
  tool: {
    name: 'reschedule_calendar_attendance',
    title: 'Reschedule calendar attendance',
    description: 'Reschedule an existing public calendar attendance in Sanka.',
    inputSchema: CALENDAR_ATTENDANCE_RESCHEDULE_INPUT_SCHEMA,
    outputSchema: CALENDAR_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Reschedule calendar attendance',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Reschedule calendar attendance',
    });
    if (authError) {
      return authError;
    }

    const { attendanceID, params } = buildCalendarAttendanceRescheduleParams(args);
    if (!attendanceID) {
      return asErrorResult('`attendance_id` is required.');
    }

    const response = (await reqContext.client.public.calendar.attendance.reschedule(
      attendanceID,
      params as {
        date: string;
        time: string;
        comment?: string;
        email?: string;
        name?: string;
        timezone?: string;
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildCalendarMutationSummary(response) }],
      structuredContent: response,
    };
  },
};

export const crmListItemsTool: McpTool = {
  metadata: {
    resource: 'items',
    operation: 'read',
    tags: ['crm', 'items'],
    httpMethod: 'get',
    httpPath: '/api/v2/items',
    operationId: 'public.items.list',
  },
  tool: {
    name: 'list_items',
    title: 'List items',
    description:
      'Review items in Sanka. Use `search` to find a named item instead of query_records or broad full-list scans.',
    inputSchema: OBJECT_RECORD_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List items',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List items',
    });
    if (authError) {
      return authError;
    }

    const { limit, page, params } = buildObjectRecordListParams(args);
    const items = await reqContext.client.public.items.list(params, undefined);
    const results = items.slice(0, limit).map((item) => item as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'items',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${items.length} items.`,
        page,
        total: items.length,
      },
      previewKeys: ['name', 'item_id', 'id'],
    });
  },
};

export const crmGetItemTool: McpTool = {
  metadata: {
    resource: 'items',
    operation: 'read',
    tags: ['crm', 'items'],
    httpMethod: 'get',
    httpPath: '/api/v2/items/{item_id}',
    operationId: 'public.items.retrieve',
  },
  tool: {
    name: 'get_item',
    title: 'Get item',
    description: 'Load one item from Sanka by item id, numeric id, or external reference.',
    inputSchema: ITEM_RETRIEVE_INPUT_SCHEMA,
    outputSchema: ITEM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get item',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get item',
    });
    if (authError) {
      return authError;
    }

    const { itemID, params } = buildItemRetrieveParams(args);
    if (!itemID) {
      return asErrorResult('`item_id` is required.');
    }

    const item = (await reqContext.client.public.items.retrieve(
      itemID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'item',
            payload: item,
            previewKeys: ['name', 'item_id', 'id'],
          }),
        },
      ],
      structuredContent: item,
    };
  },
};

export const crmCreateItemTool: McpTool = {
  metadata: {
    resource: 'items',
    operation: 'write',
    tags: ['crm', 'items'],
    httpMethod: 'post',
    httpPath: '/api/v2/items',
    operationId: 'public.items.create',
  },
  tool: {
    name: 'create_item',
    title: 'Create item',
    description:
      'Create an item in Sanka. `external_id` is required so repeated calls can upsert safely against the same external reference.',
    inputSchema: ITEM_CREATE_INPUT_SCHEMA,
    outputSchema: ITEM_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create item',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create item',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.items.create(
      buildItemMutationBody(args) as {
        externalId: string;
        currency?: string;
        description?: string;
        name?: string;
        price?: number;
        purchasePrice?: number;
        status?: string;
        tax?: number;
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Item',
            action: 'created',
            payload: response,
            idKeys: ['item_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateItemTool: McpTool = {
  metadata: {
    resource: 'items',
    operation: 'write',
    tags: ['crm', 'items'],
    httpMethod: 'patch',
    httpPath: '/api/v2/items/{item_id}',
    operationId: 'public.items.update',
  },
  tool: {
    name: 'update_item',
    title: 'Update item',
    description: 'Update an existing item in Sanka.',
    inputSchema: ITEM_UPDATE_INPUT_SCHEMA,
    outputSchema: ITEM_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update item',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update item',
    });
    if (authError) {
      return authError;
    }

    const itemID = readString(args?.['item_id']);
    if (!itemID) {
      return asErrorResult('`item_id` is required.');
    }

    const response = (await reqContext.client.public.items.update(
      itemID,
      buildItemMutationBody(args) as {
        externalId: string;
        currency?: string;
        description?: string;
        name?: string;
        price?: number;
        purchasePrice?: number;
        status?: string;
        tax?: number;
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Item',
            action: 'updated',
            payload: response,
            idKeys: ['item_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteItemTool: McpTool = {
  metadata: {
    resource: 'items',
    operation: 'write',
    tags: ['crm', 'items'],
    httpMethod: 'delete',
    httpPath: '/api/v2/items/{item_id}',
    operationId: 'public.items.delete',
  },
  tool: {
    name: 'delete_item',
    title: 'Delete item',
    description: 'Archive or delete an item in Sanka by item id or external reference.',
    inputSchema: ITEM_DELETE_INPUT_SCHEMA,
    outputSchema: ITEM_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete item',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete item',
    });
    if (authError) {
      return authError;
    }

    const { itemID, params } = buildItemRetrieveParams(args);
    if (!itemID) {
      return asErrorResult('`item_id` is required.');
    }

    const response = (await reqContext.client.public.items.delete(
      itemID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Item',
            action: 'deleted',
            payload: response,
            idKeys: ['item_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListSubscriptionsTool: McpTool = {
  metadata: {
    resource: 'subscriptions',
    operation: 'read',
    tags: ['crm', 'subscriptions'],
    httpMethod: 'get',
    httpPath: '/api/v2/subscriptions',
    operationId: 'public.subscriptions.list',
  },
  tool: {
    name: 'list_subscriptions',
    title: 'List subscriptions',
    description: 'Review subscriptions in Sanka.',
    inputSchema: WORKSPACE_LANGUAGE_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List subscriptions',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List subscriptions',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildWorkspaceLanguageListParams(args);
    const subscriptions = await reqContext.client.public.subscriptions.list(params, undefined);
    const results = subscriptions
      .slice(0, limit)
      .map((subscription) => subscription as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'subscriptions',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${subscriptions.length} subscriptions.`,
        page: 1,
        total: subscriptions.length,
      },
      previewKeys: ['id', 'status', 'subscription_status'],
    });
  },
};

export const crmGetSubscriptionTool: McpTool = {
  metadata: {
    resource: 'subscriptions',
    operation: 'read',
    tags: ['crm', 'subscriptions'],
    httpMethod: 'get',
    httpPath: '/api/v2/subscriptions/{subscription_id}',
    operationId: 'public.subscriptions.retrieve',
  },
  tool: {
    name: 'get_subscription',
    title: 'Get subscription',
    description: 'Load one subscription from Sanka by subscription id or external reference.',
    inputSchema: SUBSCRIPTION_RETRIEVE_INPUT_SCHEMA,
    outputSchema: SUBSCRIPTION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get subscription',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get subscription',
    });
    if (authError) {
      return authError;
    }

    const { subscriptionID, params } = buildSubscriptionRetrieveParams(args);
    if (!subscriptionID) {
      return asErrorResult('`subscription_id` is required.');
    }

    const subscription = (await reqContext.client.public.subscriptions.retrieve(
      subscriptionID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'subscription',
            payload: subscription,
            previewKeys: ['id', 'status', 'subscription_status'],
          }),
        },
      ],
      structuredContent: subscription,
    };
  },
};

export const crmCreateSubscriptionTool: McpTool = {
  metadata: {
    resource: 'subscriptions',
    operation: 'write',
    tags: ['crm', 'subscriptions'],
    httpMethod: 'post',
    httpPath: '/api/v2/subscriptions',
    operationId: 'public.subscriptions.create',
  },
  tool: {
    name: 'create_subscription',
    title: 'Create subscription',
    description:
      'Create a subscription in Sanka from explicit customer and subscription item data. For CRM deal/opportunity-sourced subscriptions, use deal_to_order first and create subscriptions from the Sanka Order context.',
    inputSchema: SUBSCRIPTION_CREATE_INPUT_SCHEMA,
    outputSchema: SUBSCRIPTION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create subscription',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create subscription',
    });
    if (authError) {
      return authError;
    }
    if (isDirectCrmSourceContext(args)) {
      return asErrorResult(DIRECT_CRM_SOURCE_LOCK_MESSAGE);
    }

    const body = buildSubscriptionCreateBody(args);
    if (!readString(body['cid'])) {
      return asErrorResult('`contact_id`, `company_id`, or `customer_id` is required.');
    }
    const providedCustomerIDs = ['contact_id', 'company_id', 'customer_id']
      .map((key) => readString(args?.[key]))
      .filter(Boolean);
    if (providedCustomerIDs.length > 1) {
      return asErrorResult('Provide only one of `contact_id`, `company_id`, or `customer_id`.');
    }
    if (!Array.isArray(body['items']) || body['items'].length === 0) {
      return asErrorResult('`items` must contain at least one subscription item.');
    }
    if (!readString(body['subscription_status'])) {
      return asErrorResult('`subscription_status` is required.');
    }

    const response = (await reqContext.client.public.subscriptions.create(
      body as {
        cid: string;
        contact_id?: string;
        company_id?: string;
        items: PublicLineItem[];
        subscription_status: string;
        currency?: string;
        frequency?: number;
        frequency_time?: string;
        shipping_cost_tax_status?: string;
        start_date?: string;
        end_date?: string;
        tax?: number;
        total_price?: number;
        total_price_without_tax?: number;
        contract_id?: string;
        contract_ids?: string[];
        discount_id?: string;
        discount_value?: number;
        discount_number_format?: string;
        discount_tax_option?: string;
        discount_mode?: string;
        clear_discount?: boolean;
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'subscription',
            payload: response,
            previewKeys: ['id', 'status', 'subscription_status'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateSubscriptionTool: McpTool = {
  metadata: {
    resource: 'subscriptions',
    operation: 'write',
    tags: ['crm', 'subscriptions'],
    httpMethod: 'patch',
    httpPath: '/api/v2/subscriptions/{subscription_id}',
    operationId: 'public.subscriptions.update',
  },
  tool: {
    name: 'update_subscription',
    title: 'Update subscription',
    description: 'Update an existing subscription in Sanka.',
    inputSchema: SUBSCRIPTION_UPDATE_INPUT_SCHEMA,
    outputSchema: SUBSCRIPTION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update subscription',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update subscription',
    });
    if (authError) {
      return authError;
    }

    const { subscriptionID, params } = buildSubscriptionUpdateParams(args);
    if (!subscriptionID) {
      return asErrorResult('`subscription_id` is required.');
    }
    if (Object.keys(params).length === 0) {
      return asErrorResult('Provide at least one field to update.');
    }
    if (Object.keys(params).length === 1 && typeof params['external_id'] === 'string') {
      return asErrorResult('Provide at least one body field in addition to `lookup_external_id`.');
    }

    const response = (await reqContext.client.public.subscriptions.update(
      subscriptionID,
      params as {
        external_id?: string;
        contact?: string;
        contact_id?: string;
        company_id?: string;
        customer_id?: string;
        owner_id?: string;
        item_id?: string;
        item_variant_id?: string;
        channel_id?: string;
        platform_display_name?: string;
        items?: Array<{ id: string; amount: number; name?: string; price?: number }>;
        line_items?: Array<{ id: string; amount: number; name?: string; price?: number }>;
        status?: string;
        subscription_status?: string;
        start_date?: string;
        end_date?: string;
        currency?: string;
        frequency?: number;
        frequency_time?: string;
        prior_to_next?: number;
        prior_to_time?: string;
        billing_timing?: string;
        billing_anchor?: string;
        charge_method?: string;
        payment_term_type?: string;
        payment_term_days?: number;
        payment_term_closing_day?: number;
        payment_term_offset_months?: number;
        payment_term_payment_day?: number;
        auto_gen_invoice?: boolean;
        auto_gen_invoice_statuses?: string;
        upcoming_invoice_date?: string;
        auto_invoice_start_policy?: string;
        auto_invoice_start_date?: string;
        number_item?: number;
        total_price?: number;
        total_price_without_tax?: number;
        tax_rate?: number;
        tax?: number;
        tax_applied_to?: string;
        shipping_cost_id?: string;
        shipping_cost_tax_status?: string;
        contract_id?: string;
        contract_ids?: string[];
        discount_id?: string;
        discount_value?: number;
        discount_number_format?: string;
        discount_tax_option?: string;
        discount_mode?: string;
        clear_discount?: boolean;
        quick_entry_mode?: boolean;
        custom_fields?: Record<string, unknown>;
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'subscription',
            payload: response,
            previewKeys: ['id', 'status', 'subscription_status'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteSubscriptionTool: McpTool = {
  metadata: {
    resource: 'subscriptions',
    operation: 'write',
    tags: ['crm', 'subscriptions'],
    httpMethod: 'delete',
    httpPath: '/api/v2/subscriptions/{subscription_id}',
    operationId: 'public.subscriptions.delete',
  },
  tool: {
    name: 'delete_subscription',
    title: 'Delete subscription',
    description: 'Delete a subscription in Sanka by subscription id or external reference.',
    inputSchema: SUBSCRIPTION_DELETE_INPUT_SCHEMA,
    outputSchema: SUBSCRIPTION_DELETE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete subscription',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete subscription',
    });
    if (authError) {
      return authError;
    }

    const { subscriptionID, params } = buildSubscriptionRetrieveParams(args);
    if (!subscriptionID) {
      return asErrorResult('`subscription_id` is required.');
    }

    const response = (await reqContext.client.public.subscriptions.delete(
      subscriptionID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Subscription',
            action: 'deleted',
            payload: response,
            idKeys: ['subscription_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListPaymentsTool: McpTool = {
  metadata: {
    resource: 'payments',
    operation: 'read',
    tags: ['crm', 'payments'],
    httpMethod: 'get',
    httpPath: '/api/v2/payments',
    operationId: 'public.payments.list',
  },
  tool: {
    name: 'list_payments',
    title: 'List payments',
    description: 'Review payments in Sanka.',
    inputSchema: WORKSPACE_LANGUAGE_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List payments',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List payments',
    });
    if (authError) {
      return authError;
    }

    const { limit, params } = buildWorkspaceLanguageListParams(args);
    const payments = await reqContext.client.public.payments.list(params, undefined);
    const results = payments.slice(0, limit).map((payment) => payment as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'payments',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${payments.length} payments.`,
        page: 1,
        total: payments.length,
      },
      previewKeys: ['id_rcp', 'company_name', 'contact_name'],
    });
  },
};

export const crmGetPaymentTool: McpTool = {
  metadata: {
    resource: 'payments',
    operation: 'read',
    tags: ['crm', 'payments'],
    httpMethod: 'get',
    httpPath: '/api/v2/payments/{payment_id}',
    operationId: 'public.payments.retrieve',
  },
  tool: {
    name: 'get_payment',
    title: 'Get payment',
    description: 'Load one payment from Sanka by payment id, numeric id, or external reference.',
    inputSchema: PAYMENT_RETRIEVE_INPUT_SCHEMA,
    outputSchema: PAYMENT_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get payment',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get payment',
    });
    if (authError) {
      return authError;
    }

    const { paymentID, params } = buildPaymentRetrieveParams(args);
    if (!paymentID) {
      return asErrorResult('`payment_id` is required.');
    }

    const payment = (await reqContext.client.public.payments.retrieve(
      paymentID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'payment',
            payload: payment,
            previewKeys: ['id_rcp', 'company_name', 'contact_name'],
          }),
        },
      ],
      structuredContent: payment,
    };
  },
};

export const crmListPaymentAllocationsTool: McpTool = {
  metadata: {
    resource: 'payments',
    operation: 'read',
    tags: ['crm', 'payments', 'allocations'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/payments/{payment_id}/allocations',
    operationId: 'public.payments.listAllocations',
  },
  tool: {
    name: 'list_payment_allocations',
    title: 'List payment allocations',
    description: 'Review invoice allocation rows for one payment in Sanka.',
    inputSchema: PAYMENT_ALLOCATIONS_LIST_INPUT_SCHEMA,
    outputSchema: PAYMENT_ALLOCATIONS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List payment allocations',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List payment allocations',
    });
    if (authError) {
      return authError;
    }

    const { paymentID, params } = buildPaymentAllocationsParams(args);
    if (!paymentID) {
      return asErrorResult('`payment_id` is required.');
    }

    const response = (await reqContext.client.get(
      `/api/v2/public/payments/${encodeURIComponent(paymentID)}/allocations`,
      {
        query: params,
      },
    )) as Record<string, unknown>;
    const payload = normalizeAllocationEnvelopePayload(response);

    return {
      content: [
        {
          type: 'text',
          text: buildPaymentAllocationsSummary(payload, paymentID, 'Loaded'),
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmUpdatePaymentAllocationsTool: McpTool = {
  metadata: {
    resource: 'payments',
    operation: 'write',
    tags: ['crm', 'payments', 'allocations'],
    httpMethod: 'put',
    httpPath: '/api/v2/public/payments/{payment_id}/allocations',
    operationId: 'public.payments.updateAllocations',
  },
  tool: {
    name: 'update_payment_allocations',
    title: 'Update payment allocations',
    description:
      'Replace invoice allocation rows for one payment in Sanka. Use this to apply full or partial payments to invoices after creating or loading a payment.',
    inputSchema: PAYMENT_ALLOCATIONS_UPDATE_INPUT_SCHEMA,
    outputSchema: PAYMENT_ALLOCATIONS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update payment allocations',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update payment allocations',
    });
    if (authError) {
      return authError;
    }

    const { paymentID, params } = buildPaymentAllocationsParams(args);
    if (!paymentID) {
      return asErrorResult('`payment_id` is required.');
    }

    const response = (await reqContext.client.put(
      `/api/v2/public/payments/${encodeURIComponent(paymentID)}/allocations`,
      {
        query: params,
        body: {
          allocations: buildPaymentAllocationRows(args) as Array<{
            invoice_id: string;
            amount: number;
            adjustment_amount?: number;
            adjustment_type?: string;
            currency?: string;
            source?: string;
            notes?: string;
          }>,
        },
      },
    )) as unknown as Record<string, unknown>;
    const payload = normalizeAllocationEnvelopePayload(response);

    return {
      content: [
        {
          type: 'text',
          text: buildPaymentAllocationsSummary(payload, paymentID, 'Updated'),
        },
      ],
      structuredContent: payload,
    };
  },
};

export const crmCreatePaymentTool: McpTool = {
  metadata: {
    resource: 'payments',
    operation: 'write',
    tags: ['crm', 'payments'],
    httpMethod: 'post',
    httpPath: '/api/v2/payments',
    operationId: 'public.payments.create',
  },
  tool: {
    name: 'create_payment',
    title: 'Create payment',
    description: 'Create a payment in Sanka.',
    inputSchema: PAYMENT_CREATE_INPUT_SCHEMA,
    outputSchema: PAYMENT_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create payment',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create payment',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.payments.create(
      buildPaymentMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Payment',
            action: 'created',
            payload: response,
            idKeys: ['payment_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdatePaymentTool: McpTool = {
  metadata: {
    resource: 'payments',
    operation: 'write',
    tags: ['crm', 'payments'],
    httpMethod: 'patch',
    httpPath: '/api/v2/payments/{payment_id}',
    operationId: 'public.payments.update',
  },
  tool: {
    name: 'update_payment',
    title: 'Update payment',
    description: 'Update an existing payment in Sanka.',
    inputSchema: PAYMENT_UPDATE_INPUT_SCHEMA,
    outputSchema: PAYMENT_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update payment',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update payment',
    });
    if (authError) {
      return authError;
    }

    const { paymentID, params } = buildPaymentUpdateParams(args);
    if (!paymentID) {
      return asErrorResult('`payment_id` is required.');
    }

    const response = (await reqContext.client.public.payments.update(
      paymentID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Payment',
            action: 'updated',
            payload: response,
            idKeys: ['payment_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeletePaymentTool: McpTool = {
  metadata: {
    resource: 'payments',
    operation: 'write',
    tags: ['crm', 'payments'],
    httpMethod: 'delete',
    httpPath: '/api/v2/payments/{payment_id}',
    operationId: 'public.payments.delete',
  },
  tool: {
    name: 'delete_payment',
    title: 'Delete payment',
    description: 'Delete a payment in Sanka by payment id or external reference.',
    inputSchema: PAYMENT_DELETE_INPUT_SCHEMA,
    outputSchema: PAYMENT_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete payment',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete payment',
    });
    if (authError) {
      return authError;
    }

    const { paymentID, params } = buildPaymentRetrieveParams(args);
    if (!paymentID) {
      return asErrorResult('`payment_id` is required.');
    }

    const response = (await reqContext.client.public.payments.delete(
      paymentID,
      'external_id' in params && typeof params.external_id === 'string' ?
        { external_id: params.external_id }
      : {},
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Payment',
            action: 'deleted',
            payload: response,
            idKeys: ['payment_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListLocationsTool: McpTool = defineListTool({
  resource: 'locations',
  tags: ['crm', 'locations'],
  httpMethod: 'get',
  httpPath: '/api/v2/locations',
  operationId: 'public.locations.list',
  name: 'list_locations',
  title: 'List locations',
  description: 'Review locations in Sanka.',
  inputSchema: SEARCHABLE_WORKSPACE_LANGUAGE_LIST_INPUT_SCHEMA,
  outputSchema: LIST_OUTPUT_SCHEMA,
  label: 'locations',
  previewKeys: ['location', 'warehouse', 'id_iw'],
  fetchList: async ({ reqContext, args }) => {
    const { limit, params } = buildSearchableWorkspaceLanguageListParams(args);
    const locations = await reqContext.client.public.locations.list(params, undefined);
    const results = locations
      .slice(0, limit)
      .map((location) => location as unknown as Record<string, unknown>);
    return {
      count: results.length,
      data: results,
      message: `Returned ${results.length} of ${locations.length} locations.`,
      page: 1,
      total: locations.length,
    };
  },
});

export const crmGetLocationTool: McpTool = defineDetailTool({
  resource: 'locations',
  tags: ['crm', 'locations'],
  httpMethod: 'get',
  httpPath: '/api/v2/locations/{location_id}',
  operationId: 'public.locations.retrieve',
  name: 'get_location',
  title: 'Get location',
  description: 'Load one location from Sanka by location id, numeric id, or external reference.',
  inputSchema: LOCATION_RETRIEVE_INPUT_SCHEMA,
  outputSchema: LOCATION_OUTPUT_SCHEMA,
  entity: 'location',
  previewKeys: ['location', 'warehouse', 'id_iw'],
  missingTargetError: '`location_id` is required.',
  resolveTarget: (args) => {
    const { locationID, params } = buildLocationRetrieveParams(args);
    return { id: locationID, params };
  },
  retrieve: ({ reqContext, id, params }) =>
    reqContext.client.public.locations.retrieve(id, params, undefined),
});

export const crmCreateLocationTool: McpTool = defineMutationTool({
  resource: 'locations',
  tags: ['crm', 'locations'],
  httpMethod: 'post',
  httpPath: '/api/v2/locations',
  operationId: 'public.locations.create',
  name: 'create_location',
  title: 'Create location',
  description:
    'Create a location in Sanka. `external_id` is required so repeated calls can upsert safely against the same external reference.',
  inputSchema: LOCATION_CREATE_INPUT_SCHEMA,
  outputSchema: LOCATION_MUTATION_OUTPUT_SCHEMA,
  entity: 'Location',
  action: 'created',
  idKeys: ['location_id'],
  execute: ({ reqContext, args }) =>
    reqContext.client.public.locations.create(
      buildLocationMutationBody(args) as {
        externalId: string;
        aisle?: string;
        bin?: string;
        floor?: string;
        rack?: string;
        shelf?: string;
        usageStatus?: string;
        warehouse?: string;
        zone?: string;
      },
      undefined,
    ),
});

export const crmUpdateLocationTool: McpTool = defineMutationTool({
  resource: 'locations',
  tags: ['crm', 'locations'],
  httpMethod: 'patch',
  httpPath: '/api/v2/locations/{location_id}',
  operationId: 'public.locations.update',
  name: 'update_location',
  title: 'Update location',
  description: 'Update an existing location in Sanka.',
  inputSchema: LOCATION_UPDATE_INPUT_SCHEMA,
  outputSchema: LOCATION_MUTATION_OUTPUT_SCHEMA,
  entity: 'Location',
  action: 'updated',
  idKeys: ['location_id'],
  missingTargetError: '`location_id` is required.',
  resolveTarget: (args) => {
    const { locationID, params } = buildLocationUpdateParams(args);
    return { id: locationID, params };
  },
  execute: ({ reqContext, id, params }) =>
    reqContext.client.public.locations.update(
      id,
      params as {
        external_id?: string;
        externalId?: string;
        aisle?: string;
        bin?: string;
        floor?: string;
        rack?: string;
        shelf?: string;
        usageStatus?: string;
        warehouse?: string;
        zone?: string;
      },
      undefined,
    ),
});

export const crmDeleteLocationTool: McpTool = defineMutationTool({
  resource: 'locations',
  tags: ['crm', 'locations'],
  httpMethod: 'delete',
  httpPath: '/api/v2/locations/{location_id}',
  operationId: 'public.locations.delete',
  name: 'delete_location',
  title: 'Delete location',
  description: 'Delete a location in Sanka by location id or external reference.',
  inputSchema: LOCATION_DELETE_INPUT_SCHEMA,
  outputSchema: LOCATION_MUTATION_OUTPUT_SCHEMA,
  entity: 'Location',
  action: 'deleted',
  idKeys: ['location_id'],
  missingTargetError: '`location_id` is required.',
  resolveTarget: (args) => {
    const { locationID, params } = buildLocationRetrieveParams(args);
    return { id: locationID, params };
  },
  execute: ({ reqContext, id, params }) => reqContext.client.public.locations.delete(id, params, undefined),
});

export const crmListInventoriesTool: McpTool = {
  metadata: {
    resource: 'inventories',
    operation: 'read',
    tags: ['crm', 'inventories'],
    httpMethod: 'get',
    httpPath: '/api/v2/inventories',
    operationId: 'public.inventories.list',
  },
  tool: {
    name: 'list_inventories',
    title: 'List inventories',
    description:
      'Review inventories in Sanka. Use `search` for item or inventory names and prefer list rows for availability fields such as total_inventory, available, committed, unavailable, and item_ids.',
    inputSchema: OBJECT_RECORD_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List inventories',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List inventories',
    });
    if (authError) {
      return authError;
    }

    const { limit, page, params } = buildObjectRecordListParams(args);
    const inventories = await reqContext.client.public.inventories.list(params, undefined);
    const results = inventories
      .slice(0, limit)
      .map((inventory) => inventory as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'inventories',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${inventories.length} inventories.`,
        page,
        total: inventories.length,
      },
      previewKeys: ['name', 'inventory_id', 'id', 'total_inventory', 'available'],
    });
  },
};

export const crmGetInventoryTool: McpTool = {
  metadata: {
    resource: 'inventories',
    operation: 'read',
    tags: ['crm', 'inventories'],
    httpMethod: 'get',
    httpPath: '/api/v2/inventories/{inventory_id}',
    operationId: 'public.inventories.retrieve',
  },
  tool: {
    name: 'get_inventory',
    title: 'Get inventory',
    description: 'Load one inventory from Sanka by inventory id, numeric id, or external reference.',
    inputSchema: INVENTORY_RETRIEVE_INPUT_SCHEMA,
    outputSchema: INVENTORY_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get inventory',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get inventory',
    });
    if (authError) {
      return authError;
    }

    const { inventoryID, params } = buildInventoryRetrieveParams(args);
    if (!inventoryID) {
      return asErrorResult('`inventory_id` is required.');
    }

    let inventory: Record<string, unknown>;
    try {
      inventory = (await reqContext.client.public.inventories.retrieve(
        inventoryID,
        params,
        undefined,
      )) as unknown as Record<string, unknown>;
    } catch (error) {
      let fallback: Record<string, unknown> | undefined;
      try {
        fallback = await findInventoryFallbackFromList({ reqContext, args, inventoryID });
      } catch (fallbackError) {
        const detailMessage =
          error instanceof Error && error.message ? ` Detail error: ${error.message}` : '';
        const fallbackMessage =
          fallbackError instanceof Error && fallbackError.message ?
            ` Fallback list error: ${fallbackError.message}`
          : '';
        return asErrorResult(`Unable to load inventory ${inventoryID}.${detailMessage}${fallbackMessage}`);
      }
      if (!fallback) {
        const message = error instanceof Error && error.message ? ` ${error.message}` : '';
        return asErrorResult(`Unable to load inventory ${inventoryID}.${message}`);
      }
      inventory = {
        ...fallback,
        detail_fetch_status: 'fallback_from_list',
        detail_fetch_note:
          'The inventory detail endpoint failed, so this result was recovered from list_inventories.',
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'inventory',
            payload: inventory,
            previewKeys: ['name', 'inventory_id', 'id'],
          }),
        },
      ],
      structuredContent: inventory,
    };
  },
};

export const crmCreateInventoryTool: McpTool = {
  metadata: {
    resource: 'inventories',
    operation: 'write',
    tags: ['crm', 'inventories'],
    httpMethod: 'post',
    httpPath: '/api/v2/inventories',
    operationId: 'public.inventories.create',
  },
  tool: {
    name: 'create_inventory',
    title: 'Create inventory',
    description:
      'Create an inventory record in Sanka. `external_id` is required so repeated calls can upsert safely against the same external reference.',
    inputSchema: INVENTORY_CREATE_INPUT_SCHEMA,
    outputSchema: INVENTORY_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create inventory',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create inventory',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.inventories.create(
      buildInventoryMutationBody(args) as {
        externalId: string;
        currency?: string;
        date?: string;
        initialValue?: number;
        inventoryStatus?: string;
        itemExternalId?: string;
        itemId?: string;
        name?: string;
        status?: string;
        unitPrice?: number;
        warehouseId?: string;
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Inventory',
            action: 'created',
            payload: response,
            idKeys: ['inventory_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateInventoryTool: McpTool = {
  metadata: {
    resource: 'inventories',
    operation: 'write',
    tags: ['crm', 'inventories'],
    httpMethod: 'patch',
    httpPath: '/api/v2/inventories/{inventory_id}',
    operationId: 'public.inventories.update',
  },
  tool: {
    name: 'update_inventory',
    title: 'Update inventory',
    description: 'Update an existing inventory in Sanka.',
    inputSchema: INVENTORY_UPDATE_INPUT_SCHEMA,
    outputSchema: INVENTORY_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update inventory',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update inventory',
    });
    if (authError) {
      return authError;
    }

    const inventoryID = readString(args?.['inventory_id']);
    if (!inventoryID) {
      return asErrorResult('`inventory_id` is required.');
    }

    const response = (await reqContext.client.public.inventories.update(
      inventoryID,
      buildInventoryMutationBody(args) as {
        externalId: string;
        currency?: string;
        date?: string;
        initialValue?: number;
        inventoryStatus?: string;
        itemExternalId?: string;
        itemId?: string;
        name?: string;
        status?: string;
        unitPrice?: number;
        warehouseId?: string;
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Inventory',
            action: 'updated',
            payload: response,
            idKeys: ['inventory_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteInventoryTool: McpTool = {
  metadata: {
    resource: 'inventories',
    operation: 'write',
    tags: ['crm', 'inventories'],
    httpMethod: 'delete',
    httpPath: '/api/v2/inventories/{inventory_id}',
    operationId: 'public.inventories.delete',
  },
  tool: {
    name: 'delete_inventory',
    title: 'Delete inventory',
    description: 'Delete an inventory in Sanka by inventory id or external reference.',
    inputSchema: INVENTORY_DELETE_INPUT_SCHEMA,
    outputSchema: INVENTORY_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete inventory',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete inventory',
    });
    if (authError) {
      return authError;
    }

    const { inventoryID, params } = buildInventoryRetrieveParams(args);
    if (!inventoryID) {
      return asErrorResult('`inventory_id` is required.');
    }

    const response = (await reqContext.client.public.inventories.delete(
      inventoryID,
      'external_id' in params && typeof params.external_id === 'string' ?
        { external_id: params.external_id }
      : {},
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Inventory',
            action: 'deleted',
            payload: response,
            idKeys: ['inventory_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListInventoryTransactionsTool: McpTool = {
  metadata: {
    resource: 'inventory_transactions',
    operation: 'read',
    tags: ['crm', 'inventories'],
    httpMethod: 'get',
    httpPath: '/api/v2/inventory-transactions',
    operationId: 'public.inventoryTransactions.list',
  },
  tool: {
    name: 'list_inventory_transactions',
    title: 'List inventory transactions',
    description:
      'Review inventory transactions in Sanka. Use `search`, `limit`, and `page` to keep inventory checks narrow.',
    inputSchema: OBJECT_RECORD_LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List inventory transactions',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List inventory transactions',
    });
    if (authError) {
      return authError;
    }

    const { limit, page, params } = buildObjectRecordListParams(args);
    const transactions = await reqContext.client.public.inventoryTransactions.list(params, undefined);
    const results = transactions
      .slice(0, limit)
      .map((transaction) => transaction as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'inventory transactions',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${transactions.length} inventory transactions.`,
        page,
        total: transactions.length,
      },
      previewKeys: ['transaction_id', 'inventory_id', 'id'],
    });
  },
};

export const crmGetInventoryTransactionTool: McpTool = {
  metadata: {
    resource: 'inventory_transactions',
    operation: 'read',
    tags: ['crm', 'inventories'],
    httpMethod: 'get',
    httpPath: '/api/v2/inventory-transactions/{transaction_id}',
    operationId: 'public.inventoryTransactions.retrieve',
  },
  tool: {
    name: 'get_inventory_transaction',
    title: 'Get inventory transaction',
    description:
      'Load one inventory transaction from Sanka by transaction id or numeric transaction reference.',
    inputSchema: INVENTORY_TRANSACTION_RETRIEVE_INPUT_SCHEMA,
    outputSchema: INVENTORY_TRANSACTION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get inventory transaction',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get inventory transaction',
    });
    if (authError) {
      return authError;
    }

    const { transactionID, params } = buildInventoryTransactionRetrieveParams(args);
    if (!transactionID) {
      return asErrorResult('`transaction_id` is required.');
    }

    const transaction = (await reqContext.client.public.inventoryTransactions.retrieve(
      transactionID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'inventory transaction',
            payload: transaction,
            previewKeys: ['transaction_id', 'inventory_id', 'id'],
          }),
        },
      ],
      structuredContent: transaction,
    };
  },
};

export const crmCreateInventoryTransactionTool: McpTool = {
  metadata: {
    resource: 'inventory_transactions',
    operation: 'write',
    tags: ['crm', 'inventories'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/inventory-transactions',
    operationId: 'public.inventoryTransactions.create',
  },
  tool: {
    name: 'create_inventory_transaction',
    title: 'Create inventory transaction',
    description: 'Create an inventory transaction in Sanka.',
    inputSchema: INVENTORY_TRANSACTION_CREATE_INPUT_SCHEMA,
    outputSchema: INVENTORY_TRANSACTION_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create inventory transaction',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create inventory transaction',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.inventoryTransactions.create(
      buildInventoryTransactionMutationBody(args) as {
        transactionType: string;
        amount?: number;
        inventoryExternalId?: string;
        inventoryId?: string;
        inventoryType?: string;
        price?: number;
        status?: string;
        transactionAmount?: number;
        transactionDate?: string;
        useUnitValue?: boolean;
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Inventory transaction',
            action: 'created',
            payload: response,
            idKeys: ['transaction_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateInventoryTransactionTool: McpTool = {
  metadata: {
    resource: 'inventory_transactions',
    operation: 'write',
    tags: ['crm', 'inventories'],
    httpMethod: 'patch',
    httpPath: '/api/v2/inventory-transactions/{transaction_id}',
    operationId: 'public.inventoryTransactions.update',
  },
  tool: {
    name: 'update_inventory_transaction',
    title: 'Update inventory transaction',
    description: 'Update an existing inventory transaction in Sanka.',
    inputSchema: INVENTORY_TRANSACTION_UPDATE_INPUT_SCHEMA,
    outputSchema: INVENTORY_TRANSACTION_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update inventory transaction',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update inventory transaction',
    });
    if (authError) {
      return authError;
    }

    const transactionID = readString(args?.['transaction_id']);
    if (!transactionID) {
      return asErrorResult('`transaction_id` is required.');
    }

    const response = (await reqContext.client.public.inventoryTransactions.update(
      transactionID,
      buildInventoryTransactionMutationBody(args) as {
        transactionType: string;
        amount?: number;
        inventoryExternalId?: string;
        inventoryId?: string;
        inventoryType?: string;
        price?: number;
        status?: string;
        transactionAmount?: number;
        transactionDate?: string;
        useUnitValue?: boolean;
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Inventory transaction',
            action: 'updated',
            payload: response,
            idKeys: ['transaction_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteInventoryTransactionTool: McpTool = {
  metadata: {
    resource: 'inventory_transactions',
    operation: 'write',
    tags: ['crm', 'inventories'],
    httpMethod: 'delete',
    httpPath: '/api/v2/inventory-transactions/{transaction_id}',
    operationId: 'public.inventoryTransactions.delete',
  },
  tool: {
    name: 'delete_inventory_transaction',
    title: 'Delete inventory transaction',
    description: 'Delete an inventory transaction in Sanka.',
    inputSchema: INVENTORY_TRANSACTION_DELETE_INPUT_SCHEMA,
    outputSchema: INVENTORY_TRANSACTION_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete inventory transaction',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete inventory transaction',
    });
    if (authError) {
      return authError;
    }

    const transactionID = readString(args?.['transaction_id']);
    if (!transactionID) {
      return asErrorResult('`transaction_id` is required.');
    }

    const response = (await reqContext.client.public.inventoryTransactions.delete(
      transactionID,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Inventory transaction',
            action: 'deleted',
            payload: response,
            idKeys: ['transaction_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmGetCompanyPriceTableTool: McpTool = {
  metadata: {
    resource: 'companies',
    operation: 'read',
    tags: ['crm', 'companies', 'pricing'],
    httpMethod: 'get',
    httpPath: '/api/v2/companies/{company_id}/price-table',
    operationId: 'public.companies.getPriceTable',
  },
  tool: {
    name: 'get_company_price_table',
    title: 'Get company price table',
    description:
      'Load company-level item pricing for one company. Use `search` to answer questions like "what price is item X set to for company Y?"',
    inputSchema: COMPANY_PRICE_TABLE_QUERY_INPUT_SCHEMA,
    outputSchema: COMPANY_PRICE_TABLE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get company price table',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get company price table',
    });
    if (authError) {
      return authError;
    }

    const { companyID, params } = buildCompanyPriceTableQueryParams(args);
    if (!companyID) {
      return asErrorResult('`company_id` is required.');
    }

    const payload = (await reqContext.client.public.companies.getPriceTable(
      companyID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildCompanyPriceTableSummary(payload) }],
      structuredContent: payload,
    };
  },
};

export const crmUpdateCompanyPriceTableCompanyTool: McpTool = {
  metadata: {
    resource: 'companies',
    operation: 'write',
    tags: ['crm', 'companies', 'pricing'],
    httpMethod: 'patch',
    httpPath: '/api/v2/companies/{company_id}/price-table/company',
    operationId: 'public.companies.updatePriceTableCompany',
  },
  tool: {
    name: 'update_company_price_table_company',
    title: 'Update company price table company settings',
    description: 'Update the company-wide price-table mode or default company percentage for one company.',
    inputSchema: COMPANY_PRICE_TABLE_COMPANY_UPDATE_INPUT_SCHEMA,
    outputSchema: COMPANY_PRICE_TABLE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update company price table company settings',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update company price table company settings',
    });
    if (authError) {
      return authError;
    }

    const companyID = readString(args?.['company_id']);
    if (!companyID) {
      return asErrorResult('`company_id` is required.');
    }

    const response = (await reqContext.client.public.companies.updatePriceTableCompany(
      companyID,
      buildCompanyPriceTableCompanyUpdateBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildCompanyPriceTableMutationSummary(response) }],
      structuredContent: response,
    };
  },
};

export const crmUpdateCompanyPriceTableItemTool: McpTool = {
  metadata: {
    resource: 'companies',
    operation: 'write',
    tags: ['crm', 'companies', 'pricing'],
    httpMethod: 'patch',
    httpPath: '/api/v2/companies/{company_id}/price-table/items/{item_id}',
    operationId: 'public.companies.updatePriceTableItem',
  },
  tool: {
    name: 'update_company_price_table_item',
    title: 'Update company price table item override',
    description:
      'Set or clear a company-specific price override for one item. Use `clear_override` to remove the item-specific override.',
    inputSchema: COMPANY_PRICE_TABLE_ITEM_UPDATE_INPUT_SCHEMA,
    outputSchema: COMPANY_PRICE_TABLE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update company price table item override',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update company price table item override',
    });
    if (authError) {
      return authError;
    }

    const companyID = readString(args?.['company_id']);
    const itemID = readString(args?.['item_id']);
    if (!companyID) {
      return asErrorResult('`company_id` is required.');
    }
    if (!itemID) {
      return asErrorResult('`item_id` is required.');
    }

    const { body, clearOverride } = buildCompanyPriceTableItemUpdateBody(args);
    if (!clearOverride && typeof body['price_percentage'] !== 'number') {
      return asErrorResult('Provide `price_percentage` or set `clear_override` to true.');
    }

    const response = (await reqContext.client.public.companies.updatePriceTableItem(
      companyID,
      itemID,
      body,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildCompanyPriceTableMutationSummary(response) }],
      structuredContent: response,
    };
  },
};

export const crmApplyCompanyPriceTableItemsTool: McpTool = {
  metadata: {
    resource: 'companies',
    operation: 'write',
    tags: ['crm', 'companies', 'pricing'],
    httpMethod: 'post',
    httpPath: '/api/v2/companies/{company_id}/price-table/items/apply-all',
    operationId: 'public.companies.applyPriceTableItems',
  },
  tool: {
    name: 'apply_company_price_table_items',
    title: 'Apply company price table to all items',
    description: 'Apply one company-level percentage override across all items for a company.',
    inputSchema: COMPANY_PRICE_TABLE_APPLY_ALL_INPUT_SCHEMA,
    outputSchema: COMPANY_PRICE_TABLE_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Apply company price table to all items',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Apply company price table to all items',
    });
    if (authError) {
      return authError;
    }

    const companyID = readString(args?.['company_id']);
    if (!companyID) {
      return asErrorResult('`company_id` is required.');
    }

    const response = (await reqContext.client.public.companies.applyPriceTableItems(
      companyID,
      buildCompanyPriceTableApplyAllBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [{ type: 'text', text: buildCompanyPriceTableMutationSummary(response) }],
      structuredContent: response,
    };
  },
};

const PROSPECT_COMPANIES_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    query: {
      type: 'string',
      description: 'Search query for prospecting (e.g. "manufacturing companies in Tokyo").',
    },
    location: {
      type: 'string',
      description: 'Geographic location filter (city, region, or country).',
    },
    industry: {
      type: 'string',
      description: 'Industry or vertical filter.',
    },
    min_employee_count: {
      type: 'integer',
      description: 'Minimum employee count filter.',
    },
    max_employee_count: {
      type: 'integer',
      description: 'Maximum employee count filter.',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return.',
      minimum: 1,
      maximum: 20,
      default: 10,
    },
  },
};

const PROSPECT_COMPANIES_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    query: { type: 'string' },
    parsed_filters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        location: { type: 'string' },
        industry: { type: 'string' },
        min_employee_count: { type: 'integer' },
        max_employee_count: { type: 'integer' },
      },
    },
    count: { type: 'integer' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          url: { type: 'string' },
          domain: { type: 'string' },
          industry: { type: 'string' },
          employee_count: { type: 'integer' },
          employee_count_display: { type: 'string' },
          address: { type: 'string' },
          email: { type: 'string' },
          phone_number: { type: 'string' },
          linkedin_url: { type: 'string' },
          description: { type: 'string' },
          relevance_score: { type: 'number' },
          match_reasons: { type: 'array', items: { type: 'string' } },
          source_urls: { type: 'array', items: { type: 'string' } },
          sources: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    message: { type: 'string' },
  },
  required: ['count', 'results', 'message'],
};

const SCORE_RECORD_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: {
      type: 'string',
      description: 'Record family to score. Supported values are `company` and `deal`.',
      enum: ['company', 'deal'],
    },
    record_id: {
      type: 'string',
      description: 'UUID of the company or deal record to score.',
    },
    score_model_id: {
      type: 'string',
      description: 'Optional custom score model id. Omit to use the built-in transparent scoring path.',
    },
  },
  required: ['object_type', 'record_id'],
};

const SCORE_RECORD_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    data: {
      type: 'object',
      properties: {
        object_type: { type: 'string' },
        record_id: { type: 'string' },
        snapshot_id: { type: 'string' },
        algorithm_key: { type: 'string' },
        algorithm_version: { type: 'string' },
        score_model_id: { type: 'string' },
        score_model_name: { type: 'string' },
        score_model_version: { type: 'integer' },
        input_hash: { type: 'string' },
        output_hash: { type: 'string' },
        score: { type: 'integer' },
        band: { type: 'string' },
        dimensions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
          },
        },
        reasons: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
          },
        },
        explanation: { type: 'string' },
      },
      required: [
        'object_type',
        'record_id',
        'snapshot_id',
        'algorithm_key',
        'algorithm_version',
        'input_hash',
        'output_hash',
        'score',
        'band',
      ],
    },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
  required: ['data', 'message'],
};

const buildProspectSummary = (
  rows: Array<Record<string, unknown>>,
  count: number,
  query?: string | null,
): string => {
  if (rows.length === 0) {
    return query ? `No companies found for "${query}".` : 'No companies found matching the given filters.';
  }

  const preview = rows
    .slice(0, 3)
    .map((row) => {
      const name = row['name'];
      return typeof name === 'string' && name.trim().length > 0 ? name.trim() : null;
    })
    .filter((name): name is string => Boolean(name));

  const previewText = preview.length > 0 ? ` Top matches: ${preview.join(', ')}.` : '';
  const queryText = query ? ` for "${query}"` : '';
  return `Found ${count} prospected companies${queryText}.${previewText}`;
};

const buildScoreSummary = (payload: Record<string, unknown>, message?: string | null): string => {
  const objectType = readString(payload['object_type']) ?? 'record';
  const recordID = readString(payload['record_id']);
  const band = readString(payload['band']);
  const scoreValue = payload['score'];

  if (typeof scoreValue === 'number' && Number.isFinite(scoreValue)) {
    const target = recordID ? `${objectType} ${recordID}` : objectType;
    return `Scored ${target} at ${scoreValue}${band ? ` (${band})` : ''}.`;
  }

  return readString(message) ?? 'Scoring completed.';
};

export const crmProspectCompaniesTool: McpTool = {
  metadata: {
    resource: 'prospect',
    operation: 'read',
    tags: ['crm', 'prospecting'],
    httpMethod: 'post',
    httpPath: '/api/v2/prospect/companies',
    operationId: 'prospect.companies.create',
  },
  tool: {
    name: 'prospect_companies',
    title: 'Prospect companies',
    description:
      'Research and discover companies from external sources. Use this when the user wants to find new companies to target, research potential customers, or build prospecting lists. Returns company details including name, domain, industry, size, and relevance scores.',
    inputSchema: PROSPECT_COMPANIES_INPUT_SCHEMA,
    outputSchema: PROSPECT_COMPANIES_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Prospect companies',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Prospect companies',
    });
    if (authError) {
      return authError;
    }

    const body: Record<string, unknown> = {};
    const query = readString(args?.['query']);
    const location = readString(args?.['location']);
    const industry = readString(args?.['industry']);

    if (query) body['query'] = query;
    if (location) body['location'] = location;
    if (industry) body['industry'] = industry;
    if (typeof args?.['min_employee_count'] === 'number') {
      body['min_employee_count'] = args['min_employee_count'];
    }
    if (typeof args?.['max_employee_count'] === 'number') {
      body['max_employee_count'] = args['max_employee_count'];
    }
    body['limit'] = readNumber(args?.['limit'], 10);

    const response = await reqContext.client.prospect.companies.create(body as any);

    const data = response.data;
    const results = (data.results ?? []) as Array<Record<string, unknown>>;

    return {
      content: [
        {
          type: 'text',
          text: buildProspectSummary(results, data.count, data.query),
        },
      ],
      structuredContent: {
        query: data.query,
        parsed_filters: data.parsed_filters,
        count: data.count,
        results: data.results,
        message: response.message,
      },
    };
  },
};

export const crmScoreRecordTool: McpTool = {
  metadata: {
    resource: 'score',
    operation: 'read',
    tags: ['crm', 'scoring'],
    httpMethod: 'post',
    httpPath: '/api/v2/score',
    operationId: 'score.create',
  },
  tool: {
    name: 'score_record',
    title: 'Score record',
    description:
      'Score a company or deal in Sanka. Use this when the user wants qualification, prioritization, or an explanation of how a company or deal ranks.',
    inputSchema: SCORE_RECORD_INPUT_SCHEMA,
    outputSchema: SCORE_RECORD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Score record',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Score record',
    });
    if (authError) {
      return authError;
    }

    const objectType = readString(args?.['object_type']);
    const recordID = readString(args?.['record_id']);
    const scoreModelID = readString(args?.['score_model_id']);

    if (!objectType) {
      return asErrorResult('`object_type` is required.');
    }
    if (!recordID) {
      return asErrorResult('`record_id` is required.');
    }

    const response = (await reqContext.client.score.create(
      {
        object_type: objectType,
        record_id: recordID,
        ...(scoreModelID ? { score_model_id: scoreModelID } : undefined),
      },
      undefined,
    )) as unknown as Record<string, unknown>;

    const data =
      response['data'] && typeof response['data'] === 'object' && !Array.isArray(response['data']) ?
        (response['data'] as Record<string, unknown>)
      : {};

    return {
      content: [
        {
          type: 'text',
          text: buildScoreSummary(data, readString(response['message'])),
        },
      ],
      structuredContent: response,
    };
  },
};
