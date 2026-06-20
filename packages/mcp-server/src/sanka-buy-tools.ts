import { asErrorResult, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const BUY_BASE_PATH = '/api/v2/buy';
const SHOPIFY_GLOBAL_CATALOG_PROVIDER = 'shopify_global_catalog';

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
};

const BUY_REQUEST_LINE_SCHEMA = {
  type: 'object' as const,
  required: ['description'],
  additionalProperties: true,
  properties: {
    item_id: { type: 'string', description: 'Optional matched Sanka Item id.' },
    description: { type: 'string', description: 'Requested product or requirement.' },
    quantity: { type: 'number', default: 1 },
    unit: { type: 'string' },
    target_unit_price: { type: 'number' },
    currency: { type: 'string' },
    needed_by: { type: 'string', description: 'ISO date.' },
    metadata: { type: 'object' },
  },
};

const BUY_REQUEST_FIELDS_SCHEMA = {
  title: { type: 'string' },
  business_purpose: { type: 'string' },
  delivery_location_id: { type: 'string' },
  needed_by: { type: 'string', description: 'ISO date.' },
  currency: { type: 'string' },
  budget_amount: { type: 'number' },
  metadata: { type: 'object' },
};

const BUY_REQUEST_CREATE_SCHEMA = {
  type: 'object' as const,
  required: ['title', 'lines'],
  additionalProperties: false,
  properties: {
    ...BUY_REQUEST_FIELDS_SCHEMA,
    source: {
      type: 'string',
      enum: ['manual', 'ai_intake', 'mcp', 'replenishment'],
      default: 'mcp',
    },
    record_source_detail: { type: 'string' },
    lines: {
      type: 'array',
      minItems: 1,
      items: BUY_REQUEST_LINE_SCHEMA,
    },
    idempotency_key: {
      type: 'string',
      description: 'Optional stable idempotency key for retry-safe request creation.',
    },
  },
};

const OFFER_SNAPSHOT_SCHEMA = {
  type: 'object' as const,
  required: ['merchant_key', 'merchant_name', 'title'],
  additionalProperties: true,
  properties: {
    provider: {
      type: 'string',
      default: SHOPIFY_GLOBAL_CATALOG_PROVIDER,
      description: 'Commerce provider. MVP uses shopify_global_catalog.',
    },
    merchant_key: { type: 'string' },
    merchant_name: { type: 'string' },
    merchant_domain: { type: 'string' },
    provider_product_id: { type: 'string' },
    upid: { type: 'string' },
    title: { type: 'string' },
    variant_title: { type: 'string' },
    product_url: { type: 'string' },
    image_url: { type: 'string' },
    quantity: { type: 'number', default: 1 },
    unit_price: { type: 'number' },
    shipping_amount: { type: 'number' },
    tax_amount: { type: 'number' },
    total_amount: { type: 'number' },
    currency: { type: 'string' },
    availability: { type: 'string' },
    delivery_estimate: { type: 'string' },
    raw_snapshot: { type: 'object' },
    expires_at: { type: 'string', description: 'ISO datetime.' },
  },
};

const LINE_SELECTION_SCHEMA = {
  type: 'object' as const,
  required: ['buy_request_line_id', 'offer'],
  additionalProperties: true,
  properties: {
    buy_request_line_id: { type: 'string' },
    selected_quantity: { type: 'number' },
    offer: OFFER_SNAPSHOT_SCHEMA,
  },
};

const BILL_EVIDENCE_TYPES = ['invoice', 'receipt', 'order_confirmation', 'other'] as const;

const BILL_EVIDENCE_FILE_SCHEMA = {
  type: 'object' as const,
  required: ['file_id'],
  additionalProperties: false,
  properties: {
    file_id: {
      type: 'string',
      description: 'Uploaded Sanka file id to attach to the created or linked Bill.',
    },
    name: { type: 'string', description: 'Optional display filename for the Bill attachment.' },
    evidence_type: {
      type: 'string',
      enum: BILL_EVIDENCE_TYPES,
      default: 'receipt',
    },
  },
};

const SANKA_BUY_STATUS_VALUES = [
  'draft',
  'sourcing',
  'offer_selected',
  'approval_required',
  'approved',
  'purchase_order_created',
  'checkout_pending',
  'ordered',
  'partially_received',
  'received',
  'bill_created',
  'cancelled',
  'failed',
];

const readString = (value: unknown): string | undefined => {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const readBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return undefined;
};

const isSafeExternalOrderID = (value: string): boolean =>
  /^[A-Za-z0-9][A-Za-z0-9._:#/@-]{0,127}$/.test(value);

const isSafeHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const readRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ?
    (value as Record<string, unknown>)
  : undefined;

const readObjectArray = (value: unknown): Array<Record<string, unknown>> | undefined =>
  Array.isArray(value) ?
    value.filter((entry): entry is Record<string, unknown> => Boolean(readRecord(entry)))
  : undefined;

const readArg = (args: Record<string, unknown> | undefined, key: string, aliases: string[] = []): unknown => {
  if (!args) return undefined;
  for (const candidate of [key, ...aliases]) {
    if (Object.prototype.hasOwnProperty.call(args, candidate)) {
      return args[candidate];
    }
  }
  return undefined;
};

const compactRecord = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));

const idempotencyHeaders = (
  args: Record<string, unknown> | undefined,
): { headers: Record<string, string> } | undefined => {
  const idempotencyKey = readString(readArg(args, 'idempotency_key', ['idempotencyKey']));
  return idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined;
};

const unwrapV2Envelope = (
  payload: Record<string, unknown>,
): { data: unknown; meta: Record<string, unknown> | undefined; message: string | undefined } => {
  if (typeof payload['success'] === 'boolean' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return {
      data: payload['data'],
      meta: readRecord(payload['meta']),
      message: readString(payload['message']),
    };
  }
  return {
    data: payload['data'] ?? payload,
    meta: readRecord(payload['meta']),
    message: readString(payload['message']),
  };
};

const normalizedStructuredContent = (payload: Record<string, unknown>): Record<string, unknown> => {
  const envelope = unwrapV2Envelope(payload);
  const dataRecord = readRecord(envelope.data);
  const pagination = readRecord(envelope.meta?.['pagination']);
  return {
    ...(dataRecord ?? { data: envelope.data }),
    ...(pagination ? { pagination } : undefined),
    ...(envelope.meta?.['ctx_id'] ? { ctx_id: envelope.meta['ctx_id'] } : undefined),
    ...(envelope.message ? { message: envelope.message } : undefined),
  };
};

const requestLabel = (request: Record<string, unknown> | undefined): string | undefined => {
  if (!request) return undefined;
  const title = readString(request['title']);
  const requestID = readString(request['id']);
  const status = readString(request['status']);
  return [title, requestID ? `(${requestID})` : undefined, status ? `status=${status}` : undefined]
    .filter(Boolean)
    .join(' ');
};

const buildSummary = (structuredContent: Record<string, unknown>, fallbackSummary: string): string => {
  const explicitMessage = readString(structuredContent['message']);
  if (explicitMessage) return explicitMessage;

  const items = readObjectArray(structuredContent['items']);
  if (items) {
    const total = readNumber(readRecord(structuredContent['pagination'])?.['total']) ?? items.length;
    return `Returned ${items.length} Sanka Buy request${items.length === 1 ? '' : 's'} (${total} total).`;
  }

  const data = readObjectArray(structuredContent['data']);
  if (data) {
    return `Returned ${data.length} Sanka Buy record${data.length === 1 ? '' : 's'}.`;
  }

  const label = requestLabel(structuredContent);
  return label ? `${fallbackSummary}: ${label}.` : fallbackSummary;
};

const buyResult = (payload: Record<string, unknown>, fallbackSummary: string): ToolCallResult => {
  const structuredContent = normalizedStructuredContent(payload);
  const summary = buildSummary(structuredContent, fallbackSummary);
  return {
    content: [
      { type: 'text', text: summary },
      {
        type: 'text',
        text: `Structured Sanka Buy data:\n${JSON.stringify(structuredContent, null, 2)}`,
      },
    ],
    structuredContent,
  };
};

const buyToolAuthError = (reqContext: Parameters<McpTool['handler']>[0]['reqContext'], title: string) =>
  requireAuthentication({ reqContext, toolTitle: title });

const buyRequestBody = (args: Record<string, unknown> | undefined): Record<string, unknown> =>
  compactRecord({
    title: readString(readArg(args, 'title')),
    source: readString(readArg(args, 'source')) ?? 'mcp',
    business_purpose: readString(readArg(args, 'business_purpose', ['businessPurpose'])),
    delivery_location_id: readString(readArg(args, 'delivery_location_id', ['deliveryLocationId'])),
    needed_by: readString(readArg(args, 'needed_by', ['neededBy'])),
    currency: readString(readArg(args, 'currency')),
    budget_amount: readNumber(readArg(args, 'budget_amount', ['budgetAmount'])),
    record_source_detail: readString(readArg(args, 'record_source_detail', ['recordSourceDetail'])),
    metadata: readRecord(readArg(args, 'metadata')) ?? {},
    lines: readObjectArray(readArg(args, 'lines')),
  });

const buyRequestPatchBody = (args: Record<string, unknown> | undefined): Record<string, unknown> =>
  compactRecord({
    title: readString(readArg(args, 'title')),
    business_purpose: readString(readArg(args, 'business_purpose', ['businessPurpose'])),
    delivery_location_id: readString(readArg(args, 'delivery_location_id', ['deliveryLocationId'])),
    needed_by: readString(readArg(args, 'needed_by', ['neededBy'])),
    currency: readString(readArg(args, 'currency')),
    budget_amount: readNumber(readArg(args, 'budget_amount', ['budgetAmount'])),
    metadata:
      Object.prototype.hasOwnProperty.call(args ?? {}, 'metadata') ?
        readRecord(readArg(args, 'metadata')) ?? {}
      : undefined,
  });

const buyBillEvidenceFiles = (
  args: Record<string, unknown> | undefined,
): { error?: string; files: Record<string, unknown>[] } => {
  const rawEvidenceFiles = readArg(args, 'evidence_files', ['evidenceFiles']);
  if (rawEvidenceFiles === undefined) return { files: [] };
  if (!Array.isArray(rawEvidenceFiles)) {
    return { error: '`evidence_files` must be an array.', files: [] };
  }

  const files: Record<string, unknown>[] = [];
  for (const [index, value] of rawEvidenceFiles.entries()) {
    const record = readRecord(value);
    if (!record) {
      return { error: `evidence_files[${index}] must be an object.`, files: [] };
    }
    const fileID = readString(readArg(record, 'file_id', ['fileId']));
    if (!fileID) {
      return { error: `evidence_files[${index}].file_id is required.`, files: [] };
    }
    const evidenceType = readString(readArg(record, 'evidence_type', ['evidenceType'])) ?? 'receipt';
    if (!BILL_EVIDENCE_TYPES.includes(evidenceType as (typeof BILL_EVIDENCE_TYPES)[number])) {
      return { error: `evidence_files[${index}].evidence_type is not supported.`, files: [] };
    }
    files.push(
      compactRecord({
        file_id: fileID,
        name: readString(readArg(record, 'name')),
        evidence_type: evidenceType,
      }),
    );
  }
  return { files };
};

export const previewBuyRequestTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'read',
    tags: ['buy', 'procurement', 'ai'],
    httpMethod: 'post',
    httpPath: '/api/v2/buy/intents',
    operationId: 'buy.intents.preview',
  },
  tool: {
    name: 'preview_buy_request',
    title: 'Preview Buy request',
    description:
      'Parse a natural-language purchasing intent or draft request into a Sanka Buy request preview. This tool does not create the request; use create_buy_request for writes.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        prompt: { type: 'string', description: 'Natural-language purchase intent.' },
        text: { type: 'string', description: 'Alias for prompt.' },
        request: {
          ...BUY_REQUEST_CREATE_SCHEMA,
          description: 'Optional structured Buy request draft to validate/normalize.',
        },
        create_request: {
          type: 'boolean',
          default: false,
          description: 'Must remain false for this preview tool.',
        },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Preview Buy request',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Preview Buy request');
    if (authError) return authError;
    if (readBoolean(readArg(args, 'create_request', ['createRequest'])) === true) {
      return asErrorResult('preview_buy_request is read-only. Use create_buy_request to create a request.');
    }

    const prompt = readString(readArg(args, 'prompt'));
    const text = readString(readArg(args, 'text'));
    if (prompt && text && prompt !== text) {
      return asErrorResult('Provide only one of `prompt` or `text`, or make both values identical.');
    }
    const request = readRecord(readArg(args, 'request'));
    if (!prompt && !text && !request) {
      return asErrorResult('Provide `prompt`, `text`, or `request`.');
    }

    const body = compactRecord({
      prompt,
      text: prompt ? undefined : text,
      create_request: false,
      request,
    });
    const response = (await reqContext.client.post(`${BUY_BASE_PATH}/intents`, {
      body,
    })) as Record<string, unknown>;
    return buyResult(response, 'Previewed Sanka Buy request');
  },
};

export const listBuyRequestsTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'read',
    tags: ['buy', 'procurement'],
    httpMethod: 'get',
    httpPath: '/api/v2/buy/requests',
    operationId: 'buy.requests.list',
  },
  tool: {
    name: 'list_buy_requests',
    title: 'List Buy requests',
    description: 'List Sanka Buy requests in the authenticated workspace with optional status filtering.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: {
          type: 'string',
          enum: SANKA_BUY_STATUS_VALUES,
          description: 'Optional Buy request status filter.',
        },
        page: { type: 'integer', minimum: 1, default: 1 },
        page_size: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List Buy requests',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'List Buy requests');
    if (authError) return authError;
    const response = (await reqContext.client.get(`${BUY_BASE_PATH}/requests`, {
      query: compactRecord({
        status: readString(readArg(args, 'status')),
        page: readNumber(readArg(args, 'page')),
        page_size: readNumber(readArg(args, 'page_size', ['pageSize'])),
      }),
    })) as Record<string, unknown>;
    return buyResult(response, 'Listed Sanka Buy requests');
  },
};

export const createBuyRequestTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'write',
    tags: ['buy', 'procurement'],
    httpMethod: 'post',
    httpPath: '/api/v2/buy/requests',
    operationId: 'buy.requests.create',
  },
  tool: {
    name: 'create_buy_request',
    title: 'Create Buy request',
    description:
      'Create a draft Sanka Buy request with one or more request lines. Use this before sourcing products or selecting offers.',
    inputSchema: BUY_REQUEST_CREATE_SCHEMA,
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create Buy request',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Create Buy request');
    if (authError) return authError;
    const body = buyRequestBody(args);
    if (!readString(body['title'])) {
      return asErrorResult('`title` is required.');
    }
    if (!readObjectArray(body['lines'])?.length) {
      return asErrorResult('`lines` must contain at least one request line.');
    }
    const response = (await reqContext.client.post(`${BUY_BASE_PATH}/requests`, {
      body,
      ...idempotencyHeaders(args),
    })) as Record<string, unknown>;
    return buyResult(response, 'Created Sanka Buy request');
  },
};

export const getBuyRequestTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'read',
    tags: ['buy', 'procurement'],
    httpMethod: 'get',
    httpPath: '/api/v2/buy/requests/{request_id}',
    operationId: 'buy.requests.retrieve',
  },
  tool: {
    name: 'get_buy_request',
    title: 'Get Buy request',
    description:
      'Load one Sanka Buy request including lines, active offer selections, and merchant purchases.',
    inputSchema: {
      type: 'object',
      required: ['request_id'],
      additionalProperties: false,
      properties: {
        request_id: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get Buy request',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Get Buy request');
    if (authError) return authError;
    const requestID = readString(readArg(args, 'request_id', ['requestId']));
    if (!requestID) return asErrorResult('`request_id` is required.');
    const response = (await reqContext.client.get(
      `${BUY_BASE_PATH}/requests/${encodeURIComponent(requestID)}`,
    )) as Record<string, unknown>;
    return buyResult(response, 'Loaded Sanka Buy request');
  },
};

export const updateBuyRequestTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'write',
    tags: ['buy', 'procurement'],
    httpMethod: 'patch',
    httpPath: '/api/v2/buy/requests/{request_id}',
    operationId: 'buy.requests.update',
  },
  tool: {
    name: 'update_buy_request',
    title: 'Update Buy request',
    description: 'Update editable draft fields on a Sanka Buy request.',
    inputSchema: {
      type: 'object',
      required: ['request_id'],
      additionalProperties: false,
      properties: {
        request_id: { type: 'string' },
        ...BUY_REQUEST_FIELDS_SCHEMA,
        idempotency_key: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update Buy request',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Update Buy request');
    if (authError) return authError;
    const requestID = readString(readArg(args, 'request_id', ['requestId']));
    if (!requestID) return asErrorResult('`request_id` is required.');
    const body = buyRequestPatchBody(args);
    if (Object.keys(body).length === 0) {
      return asErrorResult('Provide at least one Buy request field to update.');
    }
    const response = (await reqContext.client.patch(
      `${BUY_BASE_PATH}/requests/${encodeURIComponent(requestID)}`,
      { body, ...idempotencyHeaders(args) },
    )) as Record<string, unknown>;
    return buyResult(response, 'Updated Sanka Buy request');
  },
};

export const cancelBuyRequestTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'write',
    tags: ['buy', 'procurement'],
    httpMethod: 'post',
    httpPath: '/api/v2/buy/requests/{request_id}/cancel',
    operationId: 'buy.requests.cancel',
  },
  tool: {
    name: 'cancel_buy_request',
    title: 'Cancel Buy request',
    description: 'Cancel a Sanka Buy request before downstream purchasing is complete.',
    inputSchema: {
      type: 'object',
      required: ['request_id', 'confirm'],
      additionalProperties: false,
      properties: {
        request_id: { type: 'string' },
        confirm: {
          type: 'boolean',
          description: 'Must be true after the user has confirmed cancellation.',
        },
        idempotency_key: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Cancel Buy request',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Cancel Buy request');
    if (authError) return authError;
    const requestID = readString(readArg(args, 'request_id', ['requestId']));
    if (!requestID) return asErrorResult('`request_id` is required.');
    if (readBoolean(readArg(args, 'confirm')) !== true) {
      return asErrorResult('`confirm: true` is required before cancelling a Sanka Buy request.');
    }
    const response = (await reqContext.client.post(
      `${BUY_BASE_PATH}/requests/${encodeURIComponent(requestID)}/cancel`,
      { body: {}, ...idempotencyHeaders(args) },
    )) as Record<string, unknown>;
    return buyResult(response, 'Cancelled Sanka Buy request');
  },
};

export const sourceBuyRequestTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'write',
    tags: ['buy', 'procurement', 'shopify'],
    httpMethod: 'post',
    httpPath: '/api/v2/buy/requests/{request_id}/source',
    operationId: 'buy.requests.source',
  },
  tool: {
    name: 'source_buy_request',
    title: 'Source Buy request',
    description:
      'Start or record a sourcing run for a Sanka Buy request. MVP provider is Shopify Global Catalog; provider results may be queued or unavailable until the adapter is configured.',
    inputSchema: {
      type: 'object',
      required: ['request_id'],
      additionalProperties: false,
      properties: {
        request_id: { type: 'string' },
        query: { type: 'string' },
        provider: {
          type: 'string',
          default: SHOPIFY_GLOBAL_CATALOG_PROVIDER,
          enum: [SHOPIFY_GLOBAL_CATALOG_PROVIDER],
        },
        constraints: { type: 'object' },
        idempotency_key: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Source Buy request',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Source Buy request');
    if (authError) return authError;
    const requestID = readString(readArg(args, 'request_id', ['requestId']));
    if (!requestID) return asErrorResult('`request_id` is required.');
    const body = compactRecord({
      query: readString(readArg(args, 'query')),
      provider: readString(readArg(args, 'provider')) ?? SHOPIFY_GLOBAL_CATALOG_PROVIDER,
      constraints: readRecord(readArg(args, 'constraints')) ?? {},
    });
    const response = (await reqContext.client.post(
      `${BUY_BASE_PATH}/requests/${encodeURIComponent(requestID)}/source`,
      { body, ...idempotencyHeaders(args) },
    )) as Record<string, unknown>;
    return buyResult(response, 'Started Sanka Buy sourcing run');
  },
};

export const listBuySourcingRunsTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'read',
    tags: ['buy', 'procurement', 'shopify'],
    httpMethod: 'get',
    httpPath: '/api/v2/buy/requests/{request_id}/sourcing-runs',
    operationId: 'buy.requests.sourcingRuns.list',
  },
  tool: {
    name: 'list_buy_sourcing_runs',
    title: 'List Buy sourcing runs',
    description: 'List sourcing runs for a Sanka Buy request.',
    inputSchema: {
      type: 'object',
      required: ['request_id'],
      additionalProperties: false,
      properties: {
        request_id: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List Buy sourcing runs',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'List Buy sourcing runs');
    if (authError) return authError;
    const requestID = readString(readArg(args, 'request_id', ['requestId']));
    if (!requestID) return asErrorResult('`request_id` is required.');
    const response = (await reqContext.client.get(
      `${BUY_BASE_PATH}/requests/${encodeURIComponent(requestID)}/sourcing-runs`,
    )) as Record<string, unknown>;
    return buyResult(response, 'Listed Sanka Buy sourcing runs');
  },
};

export const getBuySourcingRunTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'read',
    tags: ['buy', 'procurement', 'shopify'],
    httpMethod: 'get',
    httpPath: '/api/v2/buy/sourcing-runs/{sourcing_run_id}',
    operationId: 'buy.sourcingRuns.retrieve',
  },
  tool: {
    name: 'get_buy_sourcing_run',
    title: 'Get Buy sourcing run',
    description: 'Load one Sanka Buy sourcing run by id.',
    inputSchema: {
      type: 'object',
      required: ['sourcing_run_id'],
      additionalProperties: false,
      properties: {
        sourcing_run_id: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get Buy sourcing run',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Get Buy sourcing run');
    if (authError) return authError;
    const sourcingRunID = readString(readArg(args, 'sourcing_run_id', ['sourcingRunId']));
    if (!sourcingRunID) return asErrorResult('`sourcing_run_id` is required.');
    const response = (await reqContext.client.get(
      `${BUY_BASE_PATH}/sourcing-runs/${encodeURIComponent(sourcingRunID)}`,
    )) as Record<string, unknown>;
    return buyResult(response, 'Loaded Sanka Buy sourcing run');
  },
};

export const selectBuyOfferTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'write',
    tags: ['buy', 'procurement', 'shopify'],
    httpMethod: 'post',
    httpPath: '/api/v2/buy/requests/{request_id}/select-offer',
    operationId: 'buy.requests.selectOffer',
  },
  tool: {
    name: 'select_buy_offer',
    title: 'Select Buy offer',
    description:
      'Select one immutable offer snapshot per Buy request line. Multi-line and multi-merchant requests must pass line_selections so downstream merchant purchases can be split correctly.',
    inputSchema: {
      type: 'object',
      required: ['request_id', 'line_selections'],
      additionalProperties: false,
      properties: {
        request_id: { type: 'string' },
        sourcing_run_id: { type: 'string' },
        line_selections: {
          type: 'array',
          minItems: 1,
          items: LINE_SELECTION_SCHEMA,
        },
        idempotency_key: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Select Buy offer',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Select Buy offer');
    if (authError) return authError;
    const requestID = readString(readArg(args, 'request_id', ['requestId']));
    if (!requestID) return asErrorResult('`request_id` is required.');
    const lineSelections = readObjectArray(readArg(args, 'line_selections', ['lineSelections']));
    if (!lineSelections?.length) {
      return asErrorResult('`line_selections` must contain at least one line offer selection.');
    }
    const body = compactRecord({
      sourcing_run_id: readString(readArg(args, 'sourcing_run_id', ['sourcingRunId'])),
      line_selections: lineSelections,
    });
    const response = (await reqContext.client.post(
      `${BUY_BASE_PATH}/requests/${encodeURIComponent(requestID)}/select-offer`,
      { body, ...idempotencyHeaders(args) },
    )) as Record<string, unknown>;
    return buyResult(response, 'Selected Sanka Buy offer');
  },
};

export const previewBuyApprovalTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'read',
    tags: ['buy', 'procurement', 'approval'],
    httpMethod: 'post',
    httpPath: '/api/v2/buy/requests/{request_id}/approval-preview',
    operationId: 'buy.requests.approvalPreview',
  },
  tool: {
    name: 'preview_buy_approval',
    title: 'Preview Buy approval',
    description:
      'Preview whether the selected Sanka Buy offers require approval before downstream Purchase Order or checkout steps.',
    inputSchema: {
      type: 'object',
      required: ['request_id'],
      additionalProperties: false,
      properties: {
        request_id: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Preview Buy approval',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Preview Buy approval');
    if (authError) return authError;
    const requestID = readString(readArg(args, 'request_id', ['requestId']));
    if (!requestID) return asErrorResult('`request_id` is required.');
    const response = (await reqContext.client.post(
      `${BUY_BASE_PATH}/requests/${encodeURIComponent(requestID)}/approval-preview`,
      { body: {} },
    )) as Record<string, unknown>;
    return buyResult(response, 'Previewed Sanka Buy approval');
  },
};

export const submitBuyRequestTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'write',
    tags: ['buy', 'procurement', 'approval'],
    httpMethod: 'post',
    httpPath: '/api/v2/buy/requests/{request_id}/submit',
    operationId: 'buy.requests.submit',
  },
  tool: {
    name: 'submit_buy_request',
    title: 'Submit Buy request',
    description:
      'Submit a Sanka Buy request after line offers are selected. This may approve immediately or create approval requirements; it does not create PO/Bill/checkout records by itself.',
    inputSchema: {
      type: 'object',
      required: ['request_id', 'confirm'],
      additionalProperties: false,
      properties: {
        request_id: { type: 'string' },
        confirm: {
          type: 'boolean',
          description: 'Must be true after the user has reviewed selected offers and approval preview.',
        },
        idempotency_key: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Submit Buy request',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Submit Buy request');
    if (authError) return authError;
    const requestID = readString(readArg(args, 'request_id', ['requestId']));
    if (!requestID) return asErrorResult('`request_id` is required.');
    if (readBoolean(readArg(args, 'confirm')) !== true) {
      return asErrorResult(
        '`confirm: true` is required after reviewing selected offers and approval preview.',
      );
    }
    const response = (await reqContext.client.post(
      `${BUY_BASE_PATH}/requests/${encodeURIComponent(requestID)}/submit`,
      { body: {}, ...idempotencyHeaders(args) },
    )) as Record<string, unknown>;
    return buyResult(response, 'Submitted Sanka Buy request');
  },
};

export const createBuyPurchaseOrderTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'write',
    tags: ['buy', 'procurement', 'purchase-order'],
    httpMethod: 'post',
    httpPath: '/api/v2/buy/requests/{request_id}/create-purchase-order',
    operationId: 'buy.requests.createPurchaseOrder',
  },
  tool: {
    name: 'create_buy_purchase_order',
    title: 'Create Buy purchase order',
    description:
      'Create or reuse Sanka Company and Purchase Order records from an approved Sanka Buy request.',
    inputSchema: {
      type: 'object',
      required: ['request_id', 'confirm'],
      additionalProperties: false,
      properties: {
        request_id: { type: 'string' },
        confirm: {
          type: 'boolean',
          description: 'Must be true after the user has approved downstream Company and PO creation.',
        },
        idempotency_key: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create Buy purchase order',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Create Buy purchase order');
    if (authError) return authError;
    const requestID = readString(readArg(args, 'request_id', ['requestId']));
    if (!requestID) return asErrorResult('`request_id` is required.');
    if (readBoolean(readArg(args, 'confirm')) !== true) {
      return asErrorResult(
        '`confirm: true` is required after reviewing selected offers and downstream PO creation.',
      );
    }
    const response = (await reqContext.client.post(
      `${BUY_BASE_PATH}/requests/${encodeURIComponent(requestID)}/create-purchase-order`,
      { body: {}, ...idempotencyHeaders(args) },
    )) as Record<string, unknown>;
    return buyResult(response, 'Created Sanka Buy purchase order handoff');
  },
};

export const getBuyMerchantPurchaseTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'read',
    tags: ['buy', 'procurement', 'purchase-order'],
    httpMethod: 'get',
    httpPath: '/api/v2/buy/merchant-purchases/{merchant_purchase_id}',
    operationId: 'buy.merchantPurchases.retrieve',
  },
  tool: {
    name: 'get_buy_merchant_purchase',
    title: 'Get Buy merchant purchase',
    description:
      'Load one Sanka Buy merchant purchase, including linked Company, Purchase Order, checkout, external order, and Bill ids when present.',
    inputSchema: {
      type: 'object',
      required: ['merchant_purchase_id'],
      additionalProperties: false,
      properties: {
        merchant_purchase_id: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get Buy merchant purchase',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Get Buy merchant purchase');
    if (authError) return authError;
    const merchantPurchaseID = readString(readArg(args, 'merchant_purchase_id', ['merchantPurchaseId']));
    if (!merchantPurchaseID) return asErrorResult('`merchant_purchase_id` is required.');
    const response = (await reqContext.client.get(
      `${BUY_BASE_PATH}/merchant-purchases/${encodeURIComponent(merchantPurchaseID)}`,
    )) as Record<string, unknown>;
    return buyResult(response, 'Loaded Sanka Buy merchant purchase');
  },
};

export const prepareBuyCheckoutTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'write',
    tags: ['buy', 'procurement', 'checkout'],
    httpMethod: 'post',
    httpPath: '/api/v2/buy/merchant-purchases/{merchant_purchase_id}/prepare-checkout',
    operationId: 'buy.merchantPurchases.prepareCheckout',
  },
  tool: {
    name: 'prepare_buy_checkout',
    title: 'Prepare Buy checkout',
    description:
      'Prepare a manual checkout URL for a Sanka Buy merchant purchase after Purchase Order creation. This does not complete payment.',
    inputSchema: {
      type: 'object',
      required: ['merchant_purchase_id', 'confirm'],
      additionalProperties: false,
      properties: {
        merchant_purchase_id: { type: 'string' },
        confirm: {
          type: 'boolean',
          description: 'Must be true after the user confirms they want a manual checkout URL.',
        },
        idempotency_key: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Prepare Buy checkout',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Prepare Buy checkout');
    if (authError) return authError;
    const merchantPurchaseID = readString(readArg(args, 'merchant_purchase_id', ['merchantPurchaseId']));
    if (!merchantPurchaseID) return asErrorResult('`merchant_purchase_id` is required.');
    if (readBoolean(readArg(args, 'confirm')) !== true) {
      return asErrorResult('`confirm: true` is required before preparing a checkout URL.');
    }
    const response = (await reqContext.client.post(
      `${BUY_BASE_PATH}/merchant-purchases/${encodeURIComponent(merchantPurchaseID)}/prepare-checkout`,
      { body: {}, ...idempotencyHeaders(args) },
    )) as Record<string, unknown>;
    return buyResult(response, 'Prepared Sanka Buy checkout');
  },
};

export const confirmBuyOrderTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'write',
    tags: ['buy', 'procurement', 'checkout'],
    httpMethod: 'post',
    httpPath: '/api/v2/buy/merchant-purchases/{merchant_purchase_id}/confirm-order',
    operationId: 'buy.merchantPurchases.confirmOrder',
  },
  tool: {
    name: 'confirm_buy_order',
    title: 'Confirm Buy order',
    description: 'Record the user-confirmed external merchant order id after manual Sanka Buy checkout.',
    inputSchema: {
      type: 'object',
      required: ['merchant_purchase_id', 'external_order_id', 'confirm'],
      additionalProperties: false,
      properties: {
        merchant_purchase_id: { type: 'string' },
        external_order_id: {
          type: 'string',
          maxLength: 128,
          pattern: '^[A-Za-z0-9][A-Za-z0-9._:#/@-]{0,127}$',
        },
        external_order_name: { type: 'string', maxLength: 128 },
        order_url: { type: 'string', format: 'uri' },
        confirm: {
          type: 'boolean',
          description: 'Must be true after the user confirms the external order id.',
        },
        idempotency_key: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Confirm Buy order',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Confirm Buy order');
    if (authError) return authError;
    const merchantPurchaseID = readString(readArg(args, 'merchant_purchase_id', ['merchantPurchaseId']));
    if (!merchantPurchaseID) return asErrorResult('`merchant_purchase_id` is required.');
    const externalOrderID = readString(readArg(args, 'external_order_id', ['externalOrderId']));
    if (!externalOrderID) return asErrorResult('`external_order_id` is required.');
    if (!isSafeExternalOrderID(externalOrderID)) {
      return asErrorResult(
        '`external_order_id` must be 1-128 characters and use letters, numbers, dot, underscore, colon, hash, slash, at sign, or dash.',
      );
    }
    if (readBoolean(readArg(args, 'confirm')) !== true) {
      return asErrorResult('`confirm: true` is required after confirming the external order id.');
    }
    const orderUrl = readString(readArg(args, 'order_url', ['orderUrl']));
    if (orderUrl && !isSafeHttpUrl(orderUrl)) {
      return asErrorResult('`order_url` must be an http or https URL.');
    }
    const body = compactRecord({
      external_order_id: externalOrderID,
      external_order_name: readString(readArg(args, 'external_order_name', ['externalOrderName'])),
      order_url: orderUrl,
    });
    const response = (await reqContext.client.post(
      `${BUY_BASE_PATH}/merchant-purchases/${encodeURIComponent(merchantPurchaseID)}/confirm-order`,
      { body, ...idempotencyHeaders(args) },
    )) as Record<string, unknown>;
    return buyResult(response, 'Confirmed Sanka Buy external order');
  },
};

export const createBuyBillTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'write',
    tags: ['buy', 'procurement', 'bill'],
    httpMethod: 'post',
    httpPath: '/api/v2/buy/merchant-purchases/{merchant_purchase_id}/create-bill',
    operationId: 'buy.merchantPurchases.createBill',
  },
  tool: {
    name: 'create_buy_bill',
    title: 'Create Buy bill',
    description:
      'Create or reuse a draft Sanka Bill from a Sanka Buy merchant purchase with linked Company and Purchase Order.',
    inputSchema: {
      type: 'object',
      required: ['merchant_purchase_id', 'confirm'],
      additionalProperties: false,
      properties: {
        merchant_purchase_id: { type: 'string' },
        confirm: {
          type: 'boolean',
          description: 'Must be true after the user approves Bill creation from this merchant purchase.',
        },
        evidence_files: {
          type: 'array',
          items: BILL_EVIDENCE_FILE_SCHEMA,
          description:
            'Optional uploaded file ids for receipt, invoice, or order-confirmation evidence to attach to the Bill.',
        },
        idempotency_key: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create Buy bill',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Create Buy bill');
    if (authError) return authError;
    const merchantPurchaseID = readString(readArg(args, 'merchant_purchase_id', ['merchantPurchaseId']));
    if (!merchantPurchaseID) return asErrorResult('`merchant_purchase_id` is required.');
    if (readBoolean(readArg(args, 'confirm')) !== true) {
      return asErrorResult('`confirm: true` is required before creating a Bill.');
    }
    const evidence = buyBillEvidenceFiles(args);
    if (evidence.error) return asErrorResult(evidence.error);
    const body = evidence.files.length ? { evidence_files: evidence.files } : {};
    const response = (await reqContext.client.post(
      `${BUY_BASE_PATH}/merchant-purchases/${encodeURIComponent(merchantPurchaseID)}/create-bill`,
      { body, ...idempotencyHeaders(args) },
    )) as Record<string, unknown>;
    return buyResult(response, 'Created Sanka Buy bill handoff');
  },
};

export const previewBuyAccountingTool: McpTool = {
  metadata: {
    resource: 'buy',
    operation: 'read',
    tags: ['buy', 'procurement', 'bill', 'accounting'],
    httpMethod: 'post',
    httpPath: '/api/v2/buy/merchant-purchases/{merchant_purchase_id}/accounting-preview',
    operationId: 'buy.merchantPurchases.accountingPreview',
  },
  tool: {
    name: 'preview_buy_accounting',
    title: 'Preview Buy accounting',
    description:
      'Preview accounting export readiness for a Sanka Buy merchant purchase after Bill creation. This does not create Journal entries or accounting exports.',
    inputSchema: {
      type: 'object',
      required: ['merchant_purchase_id'],
      additionalProperties: false,
      properties: {
        merchant_purchase_id: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Preview Buy accounting',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = buyToolAuthError(reqContext, 'Preview Buy accounting');
    if (authError) return authError;
    const merchantPurchaseID = readString(readArg(args, 'merchant_purchase_id', ['merchantPurchaseId']));
    if (!merchantPurchaseID) return asErrorResult('`merchant_purchase_id` is required.');
    const response = (await reqContext.client.post(
      `${BUY_BASE_PATH}/merchant-purchases/${encodeURIComponent(merchantPurchaseID)}/accounting-preview`,
      { body: {} },
    )) as Record<string, unknown>;
    return buyResult(response, 'Previewed Sanka Buy accounting readiness');
  },
};
