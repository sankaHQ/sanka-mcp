import { File } from 'node:buffer';
import { buildOAuthWwwAuthenticateHeader } from './auth';
import { asErrorResult, McpRequestContext, McpTool, ToolCallResult } from './types';
import { requireAuthentication, requireScopes } from './tool-auth';

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

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry));
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
  const summaryInput = previewKeys
    ? {
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
    readString(payload['expense_id']) || readString(payload['external_id']) || readString(payload['status']) || 'expense';
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
      authMode === 'api_key' ? 'Sanka CRM is connected with an API key.' : 'Sanka CRM is connected with OAuth.';

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
    const results = expenses
      .slice(0, limit)
      .map((expense) => expense as unknown as Record<string, unknown>);

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
      undefined
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
    description: 'Create an expense in Sanka. Attach uploaded file ids with `attachment_file_ids` when needed.',
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
      content: [{ type: 'text', text: buildExpenseMutationSummary({ action: 'created', payload: response }) }],
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
      content: [{ type: 'text', text: buildExpenseMutationSummary({ action: 'updated', payload: response }) }],
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
      content: [{ type: 'text', text: buildExpenseMutationSummary({ action: 'deleted', payload: response }) }],
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
    securitySchemes: [{ type: 'oauth2', scopes: ['prospect:read'] }],
    annotations: {
      title: 'Prospect companies',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const scopeError = requireScopes({
      reqContext,
      requiredScopes: ['prospect:read'],
      toolTitle: 'Prospect companies',
    });
    if (scopeError) {
      return scopeError;
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
