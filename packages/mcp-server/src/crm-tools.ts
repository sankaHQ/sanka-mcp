import { File } from 'node:buffer';
import { buildOAuthWwwAuthenticateHeader } from './auth';
import { asErrorResult, McpRequestContext, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
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
  },
};

const COMPANY_MUTATION_INPUT_PROPERTIES = {
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
    description: 'External reference used for idempotent create/update flows.',
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
  required: ['external_id'],
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
      description: 'Company identifier to delete.',
    },
    external_id: {
      type: 'string',
      description: 'Optional explicit external id lookup override.',
    },
  },
  required: ['company_id'],
};

const CONTACT_MUTATION_INPUT_PROPERTIES = {
  allowed_in_store: {
    type: 'boolean',
    description: 'Whether the contact is allowed in store.',
  },
  company: {
    type: 'string',
    description: 'Plain-text company name associated with the contact.',
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
  required: ['external_id'],
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
    workspace_id: {
      type: 'string',
      description: 'Optional workspace override. Defaults to the authenticated workspace.',
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
    description: 'Optional uploaded expense attachment file IDs to bind to the expense.',
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

const EXPENSE_UPLOAD_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    filename: {
      type: 'string',
      description: 'Attachment filename to preserve in Sanka.',
    },
    content_base64: {
      type: 'string',
      description: 'Base64-encoded file content. Data URLs are also accepted.',
    },
    mime_type: {
      type: 'string',
      description: 'Optional MIME type override.',
    },
  },
  required: ['filename', 'content_base64'],
};

const LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    count: { type: 'integer' },
    page: { type: 'integer' },
    total: { type: 'integer' },
    message: { type: 'string' },
    permission: { type: 'string' },
    results: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
  },
  required: ['count', 'page', 'total', 'message', 'results'],
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
  },
  required: ['id', 'created_at'],
};

const EXPENSE_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: 'string' },
    expense_id: { type: 'string' },
    external_id: { type: 'string' },
  },
  required: ['ok', 'status'],
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

const DEAL_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of deals to return from the deal list.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    workspace_id: {
      type: 'string',
      description: 'Optional workspace override. Defaults to the authenticated workspace.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
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

const DEAL_MUTATION_INPUT_PROPERTIES = {
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
  external_id: {
    type: 'string',
    description: 'External reference stored on the deal.',
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
  required: ['external_id'],
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
      description: 'Optional workspace override. Defaults to the authenticated workspace.',
    },
  },
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

const PROPERTY_MUTATION_INPUT_PROPERTIES = {
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
  type: {
    type: 'string',
    description: 'Property type.',
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
      description: 'Object family to inspect, for example `orders`.',
    },
    custom_only: {
      type: 'boolean',
      description: 'When true, only return custom properties.',
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
      description: 'Optional workspace override. Defaults to the authenticated workspace.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
  required: ['object_name'],
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
    workspace_id: {
      type: 'string',
      description: 'Optional workspace override. Defaults to the authenticated workspace.',
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
  },
  required: ['object_name', 'property_ref'],
};

const AUTH_STATUS_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    connected: { type: 'boolean' },
    auth_mode: { type: 'string' },
    tool_profile: { type: 'string' },
    scopes: {
      type: 'array',
      items: { type: 'string' },
    },
    message: { type: 'string' },
    resource_url: { type: 'string' },
  },
  required: ['connected', 'auth_mode', 'tool_profile', 'scopes', 'message'],
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
    ctx_id: { type: 'string' },
    company_id: { type: 'string' },
    external_id: { type: 'string' },
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
    ctx_id: { type: 'string' },
    contact_id: { type: 'string' },
    external_id: { type: 'string' },
  },
  required: ['ok', 'status'],
};

const DEAL_MUTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string' },
    ctx_id: { type: 'string' },
    case_id: { type: 'string' },
    external_id: { type: 'string' },
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
  },
  required: ['ok', 'status', 'ctx_id', 'object', 'property_id'],
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
      description: 'Optional workspace override. Defaults to the authenticated workspace.',
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
      description: 'Optional workspace override. Defaults to the authenticated workspace.',
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
      description: 'Optional workspace override. Defaults to the authenticated workspace.',
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
    external_id: { type: 'string' },
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

const readNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
};

const readRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
};

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => readString(entry)).filter((entry): entry is string => Boolean(entry));
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
      for (const key of previewKeys) {
        const value = row[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim();
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          return String(value);
        }
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));

  const previewText = preview.length > 0 ? ` Examples: ${preview.join(', ')}.` : '';
  return `Found ${total} ${label}.${previewText}`;
};

const buildListResult = ({
  label,
  payload,
  previewKeys,
}: {
  label: string;
  payload: {
    count: number;
    data: Array<Record<string, unknown>>;
    message: string;
    page: number;
    total: number;
    permission?: string | null;
  };
  previewKeys?: string[];
}): ToolCallResult => {
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
        text: buildListSummary(summaryInput),
      },
    ],
    structuredContent: {
      count: payload.count,
      page: payload.page,
      total: payload.total,
      message: payload.message,
      permission: payload.permission ?? undefined,
      results: payload.data,
    },
  };
};

const buildListParams = (args: Record<string, unknown> | undefined) => {
  const referenceID = readString(args?.['reference_id']);
  const search = readString(args?.['search']);
  const sort = readString(args?.['sort']);
  const view = readString(args?.['view']);
  const language = readString(args?.['language']);

  return {
    limit: readNumber(args?.['limit'], 10),
    page: readNumber(args?.['page'], 1),
    ...(referenceID ? { reference_id: referenceID } : undefined),
    ...(search ? { search } : undefined),
    ...(sort ? { sort } : undefined),
    ...(view ? { view } : undefined),
    ...(language ? { 'Accept-Language': language } : undefined),
  };
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
    'email',
    'external_id',
    'name',
    'phone_number',
    'status',
    'url',
  ]);
  assignBooleanFields(body, args, ['allowed_in_store']);
  return body;
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
    'company',
    'email',
    'external_id',
    'last_name',
    'name',
    'phone_number',
    'status',
  ]);
  assignBooleanFields(body, args, ['allowed_in_store']);
  return body;
};

const buildExpenseListParams = (args: Record<string, unknown> | undefined) => {
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
  return `Expense ${action}: ${reference}.`;
};

const buildExpenseDetailSummary = (expense: Record<string, unknown>): string => {
  const description = readString(expense['description']);
  const companyName = readString(expense['company_name']);
  const id = readString(expense['id']);
  const amount = typeof expense['amount'] === 'number' ? String(expense['amount']) : undefined;
  const currency = readString(expense['currency']);

  if (description) {
    return `Loaded expense: ${description}.`;
  }
  if (companyName && amount && currency) {
    return `Loaded expense for ${companyName}: ${amount} ${currency}.`;
  }
  return `Loaded expense ${id ?? ''}.`.trim();
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

const buildDealMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, ['currency', 'name', 'status']);

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
  const rawLimit = readNumber(args?.['limit'], 25);
  const limit = Math.max(1, Math.min(100, rawLimit));

  return {
    objectName,
    limit,
    params: {
      ...(customOnly !== undefined ? { custom_only: customOnly } : undefined),
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

  return {
    objectName,
    propertyRef,
    params: {
      ...(objectName ? { object_name: objectName } : undefined),
      ...(workspaceID ? { workspace_id: workspaceID } : undefined),
      ...(language ? { 'Accept-Language': language } : undefined),
    },
  };
};

const buildPropertyMutationBody = (args: Record<string, unknown> | undefined) => {
  const body: Record<string, unknown> = {};
  assignStringFields(body, args, [
    'badge_color',
    'description',
    'internal_name',
    'name',
    'number_format',
    'type',
  ]);
  assignBooleanFields(body, args, ['multiple_select', 'required_field', 'show_badge', 'unique']);
  assignIntegerFields(body, args, ['order']);

  const choiceValues = args?.['choice_values'];
  const conditionalChoiceMapping = readRecord(args?.['conditional_choice_mapping']);
  const tagValues = args?.['tag_values'];

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

  return body;
};

const buildEntityMutationSummary = ({
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
  const reference =
    idKeys.map((key) => readString(payload[key])).find((value): value is string => Boolean(value)) ||
    readString(payload['external_id']) ||
    readString(payload['status']) ||
    entity;

  return `${entity} ${action}: ${reference}.`;
};

const buildEntityDetailSummary = ({
  entity,
  payload,
  previewKeys,
}: {
  entity: string;
  payload: Record<string, unknown>;
  previewKeys: string[];
}): string => {
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

const buildAuthStatusChallenge = ({
  message,
  reqContext,
}: {
  message: string;
  reqContext: McpRequestContext;
}): ToolCallResult => {
  const oauth = reqContext.auth?.oauth;
  const wwwAuthenticate =
    oauth ?
      buildOAuthWwwAuthenticateHeader({
        authorizationServerUrl: oauth.authorizationServerUrl,
        description: message,
        error: 'invalid_token',
        resourceMetadataUrl: oauth.resourceMetadataUrl,
      })
    : undefined;

  return {
    content: [{ type: 'text', text: message }],
    isError: true,
    structuredContent: {
      connected: false,
      auth_mode: reqContext.auth?.authMode ?? 'none',
      tool_profile: reqContext.toolProfile ?? 'full',
      scopes: reqContext.auth?.oauth.scopes ?? [],
      message,
      resource_url: oauth?.resourceUrl,
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
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: AUTH_STATUS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'noauth' }],
    annotations: {
      title: 'Check CRM authentication status',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext }) => {
    const authMode = reqContext.auth?.authMode ?? 'none';
    const scopes = reqContext.auth?.oauth.scopes ?? [];

    if (authMode === 'none') {
      return buildAuthStatusChallenge({
        message: 'Sanka CRM is not connected yet. Approve the OAuth prompt in your MCP client, then retry.',
        reqContext,
      });
    }

    const message =
      authMode === 'api_key' ?
        'Sanka CRM is connected with an API key.'
      : 'Sanka CRM is connected with OAuth.';

    return {
      content: [{ type: 'text', text: message }],
      structuredContent: {
        connected: true,
        auth_mode: authMode,
        tool_profile: reqContext.toolProfile ?? 'full',
        scopes,
        message,
        resource_url: reqContext.auth?.oauth.resourceUrl,
      },
    };
  },
};

export const crmListCompaniesTool: McpTool = {
  metadata: {
    resource: 'companies',
    operation: 'read',
    tags: ['crm'],
    httpMethod: 'get',
    httpPath: '/v1/public/companies',
    operationId: 'public.companies.list',
  },
  tool: {
    name: 'list_companies',
    title: 'List companies',
    description:
      'Search and review companies in Sanka. Use this when the user wants to find or inspect companies, not to create or update them.',
    inputSchema: LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List companies',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List companies',
    });
    if (authError) {
      return authError;
    }

    const payload = await reqContext.client.public.companies.list(buildListParams(args), undefined);

    return buildListResult({
      label: 'companies',
      payload,
    });
  },
};

export const crmGetCompanyTool: McpTool = {
  metadata: {
    resource: 'companies',
    operation: 'read',
    tags: ['crm'],
    httpMethod: 'get',
    httpPath: '/v1/public/companies/{company_id}',
    operationId: 'public.companies.retrieve',
  },
  tool: {
    name: 'get_company',
    title: 'Get company',
    description: 'Load one company from Sanka by company id, numeric id, or external reference.',
    inputSchema: COMPANY_RETRIEVE_INPUT_SCHEMA,
    outputSchema: COMPANY_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get company',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get company',
    });
    if (authError) {
      return authError;
    }

    const { companyID, params } = buildCompanyRetrieveParams(args);
    if (!companyID) {
      return asErrorResult('`company_id` is required.');
    }

    const company = (await reqContext.client.public.companies.retrieve(
      companyID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'company',
            payload: company,
            previewKeys: ['name', 'email', 'company_id'],
          }),
        },
      ],
      structuredContent: company,
    };
  },
};

export const crmCreateCompanyTool: McpTool = {
  metadata: {
    resource: 'companies',
    operation: 'write',
    tags: ['crm'],
    httpMethod: 'post',
    httpPath: '/v1/public/companies',
    operationId: 'public.companies.create',
  },
  tool: {
    name: 'create_company',
    title: 'Create company',
    description:
      'Create a company in Sanka. `external_id` is required so repeated calls can upsert safely against the same external reference.',
    inputSchema: COMPANY_CREATE_INPUT_SCHEMA,
    outputSchema: COMPANY_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create company',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create company',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.companies.create(
      buildCompanyMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Company',
            action: 'created',
            payload: response,
            idKeys: ['company_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateCompanyTool: McpTool = {
  metadata: {
    resource: 'companies',
    operation: 'write',
    tags: ['crm'],
    httpMethod: 'put',
    httpPath: '/v1/public/companies/{company_id}',
    operationId: 'public.companies.update',
  },
  tool: {
    name: 'update_company',
    title: 'Update company',
    description: 'Update an existing company in Sanka.',
    inputSchema: COMPANY_UPDATE_INPUT_SCHEMA,
    outputSchema: COMPANY_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update company',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update company',
    });
    if (authError) {
      return authError;
    }

    const companyID = readString(args?.['company_id']);
    if (!companyID) {
      return asErrorResult('`company_id` is required.');
    }

    const response = (await reqContext.client.public.companies.update(
      companyID,
      buildCompanyMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Company',
            action: 'updated',
            payload: response,
            idKeys: ['company_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteCompanyTool: McpTool = {
  metadata: {
    resource: 'companies',
    operation: 'write',
    tags: ['crm'],
    httpMethod: 'delete',
    httpPath: '/v1/public/companies/{company_id}',
    operationId: 'public.companies.delete',
  },
  tool: {
    name: 'delete_company',
    title: 'Delete company',
    description: 'Archive or delete a company in Sanka by company id or external reference.',
    inputSchema: COMPANY_DELETE_INPUT_SCHEMA,
    outputSchema: COMPANY_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete company',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete company',
    });
    if (authError) {
      return authError;
    }

    const { companyID, params } = buildCompanyRetrieveParams(args);
    if (!companyID) {
      return asErrorResult('`company_id` is required.');
    }

    const response = (await reqContext.client.public.companies.delete(
      companyID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Company',
            action: 'deleted',
            payload: response,
            idKeys: ['company_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListContactsTool: McpTool = {
  metadata: {
    resource: 'contacts',
    operation: 'read',
    tags: ['crm'],
    httpMethod: 'get',
    httpPath: '/v1/public/contacts',
    operationId: 'public.contacts.list',
  },
  tool: {
    name: 'list_contacts',
    title: 'List contacts',
    description:
      'Search and review contacts in Sanka. Use this when the user wants to find or inspect contacts, not to create or update them.',
    inputSchema: LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List contacts',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'List contacts',
    });
    if (authError) {
      return authError;
    }

    const payload = await reqContext.client.public.contacts.list(buildListParams(args), undefined);

    return buildListResult({
      label: 'contacts',
      payload,
    });
  },
};

export const crmGetContactTool: McpTool = {
  metadata: {
    resource: 'contacts',
    operation: 'read',
    tags: ['crm'],
    httpMethod: 'get',
    httpPath: '/v1/public/contacts/{contact_id}',
    operationId: 'public.contacts.retrieve',
  },
  tool: {
    name: 'get_contact',
    title: 'Get contact',
    description: 'Load one contact from Sanka by contact id, numeric id, or external reference.',
    inputSchema: CONTACT_RETRIEVE_INPUT_SCHEMA,
    outputSchema: CONTACT_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get contact',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get contact',
    });
    if (authError) {
      return authError;
    }

    const { contactID, params } = buildContactRetrieveParams(args);
    if (!contactID) {
      return asErrorResult('`contact_id` is required.');
    }

    const contact = (await reqContext.client.public.contacts.retrieve(
      contactID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityDetailSummary({
            entity: 'contact',
            payload: contact,
            previewKeys: ['name', 'email', 'contact_id'],
          }),
        },
      ],
      structuredContent: contact,
    };
  },
};

export const crmCreateContactTool: McpTool = {
  metadata: {
    resource: 'contacts',
    operation: 'write',
    tags: ['crm'],
    httpMethod: 'post',
    httpPath: '/v1/public/contacts',
    operationId: 'public.contacts.create',
  },
  tool: {
    name: 'create_contact',
    title: 'Create contact',
    description:
      'Create a contact in Sanka. `external_id` is required so repeated calls can upsert safely against the same external reference.',
    inputSchema: CONTACT_CREATE_INPUT_SCHEMA,
    outputSchema: CONTACT_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create contact',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Create contact',
    });
    if (authError) {
      return authError;
    }

    const response = (await reqContext.client.public.contacts.create(
      buildContactMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Contact',
            action: 'created',
            payload: response,
            idKeys: ['contact_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateContactTool: McpTool = {
  metadata: {
    resource: 'contacts',
    operation: 'write',
    tags: ['crm'],
    httpMethod: 'put',
    httpPath: '/v1/public/contacts/{contact_id}',
    operationId: 'public.contacts.update',
  },
  tool: {
    name: 'update_contact',
    title: 'Update contact',
    description: 'Update an existing contact in Sanka.',
    inputSchema: CONTACT_UPDATE_INPUT_SCHEMA,
    outputSchema: CONTACT_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update contact',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Update contact',
    });
    if (authError) {
      return authError;
    }

    const contactID = readString(args?.['contact_id']);
    if (!contactID) {
      return asErrorResult('`contact_id` is required.');
    }

    const response = (await reqContext.client.public.contacts.update(
      contactID,
      buildContactMutationBody(args),
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Contact',
            action: 'updated',
            payload: response,
            idKeys: ['contact_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteContactTool: McpTool = {
  metadata: {
    resource: 'contacts',
    operation: 'write',
    tags: ['crm'],
    httpMethod: 'delete',
    httpPath: '/v1/public/contacts/{contact_id}',
    operationId: 'public.contacts.delete',
  },
  tool: {
    name: 'delete_contact',
    title: 'Delete contact',
    description: 'Archive or delete a contact in Sanka by contact id or external reference.',
    inputSchema: CONTACT_DELETE_INPUT_SCHEMA,
    outputSchema: CONTACT_MUTATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete contact',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Delete contact',
    });
    if (authError) {
      return authError;
    }

    const { contactID, params } = buildContactRetrieveParams(args);
    if (!contactID) {
      return asErrorResult('`contact_id` is required.');
    }

    const response = (await reqContext.client.public.contacts.delete(
      contactID,
      params,
      undefined,
    )) as unknown as Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: buildEntityMutationSummary({
            entity: 'Contact',
            action: 'deleted',
            payload: response,
            idKeys: ['contact_id'],
          }),
        },
      ],
      structuredContent: response,
    };
  },
};

export const crmListExpensesTool: McpTool = {
  metadata: {
    resource: 'expenses',
    operation: 'read',
    tags: ['crm', 'expenses'],
    httpMethod: 'get',
    httpPath: '/v1/public/expenses',
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

    const { limit, params } = buildExpenseListParams(args);
    const expenses = await reqContext.client.public.expenses.list(params, undefined);
    const results = expenses.slice(0, limit).map((expense) => expense as unknown as Record<string, unknown>);

    return buildListResult({
      label: 'expenses',
      payload: {
        count: results.length,
        data: results,
        message: `Returned ${results.length} of ${expenses.length} expenses.`,
        page: 1,
        total: expenses.length,
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
    httpPath: '/v1/public/expenses/{expense_id}',
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

    return {
      content: [{ type: 'text', text: buildExpenseDetailSummary(expense) }],
      structuredContent: expense,
    };
  },
};

export const crmUploadExpenseAttachmentTool: McpTool = {
  metadata: {
    resource: 'expenses',
    operation: 'write',
    tags: ['crm', 'expenses'],
    httpMethod: 'post',
    httpPath: '/v1/public/expenses/files',
    operationId: 'public.expenses.uploadAttachment',
  },
  tool: {
    name: 'upload_expense_attachment',
    title: 'Upload expense attachment',
    description:
      'Upload an expense attachment to Sanka. Provide a filename and base64-encoded file content, then use the returned file_id in create_expense or update_expense.',
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
    const response = await reqContext.client.public.expenses.uploadAttachment({ file }, undefined);

    return {
      content: [
        {
          type: 'text',
          text: `Uploaded expense attachment ${response.filename || filename}.`,
        },
      ],
      structuredContent: response as unknown as Record<string, unknown>,
    };
  },
};

export const crmCreateExpenseTool: McpTool = {
  metadata: {
    resource: 'expenses',
    operation: 'write',
    tags: ['crm', 'expenses'],
    httpMethod: 'post',
    httpPath: '/v1/public/expenses',
    operationId: 'public.expenses.create',
  },
  tool: {
    name: 'create_expense',
    title: 'Create expense',
    description:
      'Create an expense in Sanka. Attach uploaded file ids with `attachment_file_ids` when needed.',
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

    return {
      content: [
        { type: 'text', text: buildExpenseMutationSummary({ action: 'created', payload: response }) },
      ],
      structuredContent: response,
    };
  },
};

export const crmUpdateExpenseTool: McpTool = {
  metadata: {
    resource: 'expenses',
    operation: 'write',
    tags: ['crm', 'expenses'],
    httpMethod: 'put',
    httpPath: '/v1/public/expenses/{expense_id}',
    operationId: 'public.expenses.update',
  },
  tool: {
    name: 'update_expense',
    title: 'Update expense',
    description: 'Update an existing expense in Sanka.',
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

    return {
      content: [
        { type: 'text', text: buildExpenseMutationSummary({ action: 'updated', payload: response }) },
      ],
      structuredContent: response,
    };
  },
};

export const crmDeleteExpenseTool: McpTool = {
  metadata: {
    resource: 'expenses',
    operation: 'write',
    tags: ['crm', 'expenses'],
    httpMethod: 'delete',
    httpPath: '/v1/public/expenses/{expense_id}',
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

export const crmListDealsTool: McpTool = {
  metadata: {
    resource: 'deals',
    operation: 'read',
    tags: ['crm', 'deals'],
    httpMethod: 'get',
    httpPath: '/v1/public/deals',
    operationId: 'public.deals.list',
  },
  tool: {
    name: 'list_deals',
    title: 'List deals',
    description:
      'Review deals (sales pipeline records) in Sanka. Use this when the user wants to inspect their pipeline, find open deals, or review deal stages in the current workspace.',
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
    });
  },
};

export const crmGetDealTool: McpTool = {
  metadata: {
    resource: 'deals',
    operation: 'read',
    tags: ['crm', 'deals'],
    httpMethod: 'get',
    httpPath: '/v1/public/deals/{case_id}',
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
    httpPath: '/v1/public/deals/pipelines',
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

export const crmCreateDealTool: McpTool = {
  metadata: {
    resource: 'deals',
    operation: 'write',
    tags: ['crm', 'deals'],
    httpMethod: 'post',
    httpPath: '/v1/public/deals',
    operationId: 'public.deals.create',
  },
  tool: {
    name: 'create_deal',
    title: 'Create deal',
    description:
      'Create a deal in Sanka. `external_id` is required so repeated calls can upsert safely against the same external reference.',
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
    httpMethod: 'put',
    httpPath: '/v1/public/deals/{case_id}',
    operationId: 'public.deals.update',
  },
  tool: {
    name: 'update_deal',
    title: 'Update deal',
    description:
      'Update an existing deal in Sanka. Use `lookup_external_id` when the path identifier is not the external reference you want to resolve by.',
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
    httpPath: '/v1/public/deals/{case_id}',
    operationId: 'public.deals.delete',
  },
  tool: {
    name: 'delete_deal',
    title: 'Delete deal',
    description: 'Archive or delete a deal in Sanka by case id, numeric id, or external reference.',
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

    const caseID = readString(args?.['case_id']);
    const externalID = readString(args?.['external_id']);
    if (!caseID) {
      return asErrorResult('`case_id` is required.');
    }

    const response = (await reqContext.client.public.deals.delete(
      caseID,
      {
        ...(externalID ? { external_id: externalID } : undefined),
      },
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

export const crmListTicketsTool: McpTool = {
  metadata: {
    resource: 'tickets',
    operation: 'read',
    tags: ['crm', 'tickets'],
    httpMethod: 'get',
    httpPath: '/v1/public/tickets',
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
    httpPath: '/v1/public/tickets/{ticket_id}',
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
    httpPath: '/v1/public/tickets',
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
    httpMethod: 'put',
    httpPath: '/v1/public/tickets/{ticket_id}',
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
    httpPath: '/v1/public/tickets/{ticket_id}',
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
    httpPath: '/v1/public/tickets/pipelines',
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
    httpPath: '/v1/public/tickets/{ticket_id}/status',
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

export const crmListPropertiesTool: McpTool = {
  metadata: {
    resource: 'properties',
    operation: 'read',
    tags: ['crm', 'properties'],
    httpMethod: 'get',
    httpPath: '/v1/public/properties/{object_name}',
    operationId: 'public.properties.list',
  },
  tool: {
    name: 'list_properties',
    title: 'List properties',
    description:
      'List properties for a Sanka object family such as orders, companies, or deals. Use this before creating or updating object records when you need the current property schema.',
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
    httpPath: '/v1/public/properties/{object_name}/{property_ref}',
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
    httpPath: '/v1/public/properties/{object_name}',
    operationId: 'public.properties.create',
  },
  tool: {
    name: 'create_property',
    title: 'Create property',
    description: 'Create a custom property for a Sanka object family such as orders, companies, or deals.',
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

    const response = (await reqContext.client.public.properties.create(
      objectName,
      buildPropertyMutationBody(args),
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
    httpPath: '/v1/public/properties/{object_name}/{property_ref}',
    operationId: 'public.properties.update',
  },
  tool: {
    name: 'update_property',
    title: 'Update property',
    description: 'Update an existing custom property in Sanka.',
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

    const response = (await reqContext.client.public.properties.update(
      propertyRef,
      {
        object_name: objectName,
        ...buildPropertyMutationBody(args),
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
    httpPath: '/v1/public/properties/{object_name}/{property_ref}',
    operationId: 'public.properties.delete',
  },
  tool: {
    name: 'delete_property',
    title: 'Delete property',
    description: 'Delete a custom property in Sanka for the specified object family.',
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

    const objectName = readString(args?.['object_name']);
    const propertyRef = readString(args?.['property_ref']);
    if (!objectName) {
      return asErrorResult('`object_name` is required.');
    }
    if (!propertyRef) {
      return asErrorResult('`property_ref` is required.');
    }

    const response = (await reqContext.client.public.properties.delete(
      propertyRef,
      { object_name: objectName },
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

export const crmGetCalendarBootstrapTool: McpTool = {
  metadata: {
    resource: 'calendar',
    operation: 'read',
    tags: ['crm', 'calendar'],
    httpMethod: 'get',
    httpPath: '/v1/public/calendar/bootstrap',
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
    httpPath: '/v1/public/calendar/availability',
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
    httpPath: '/v1/public/calendar/attendance',
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
    httpPath: '/v1/public/calendar/attendance/{attendance_id}/cancel',
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
    httpPath: '/v1/public/calendar/attendance/{attendance_id}/reschedule',
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
    httpPath: '/v1/prospect/companies',
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
    httpPath: '/v1/score',
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
