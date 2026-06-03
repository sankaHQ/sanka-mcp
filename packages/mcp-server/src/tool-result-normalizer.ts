import { ContentBlock, McpTool, ToolCallResult } from './types';

const CONTROL_ARGUMENT_KEYS = new Set([
  'case_id',
  'company_id',
  'contact_id',
  'deal_id',
  'expense_id',
  'invoice_id',
  'item_id',
  'location_id',
  'order_id',
  'payment_id',
  'purchase_order_id',
  'slip_id',
  'bill_id',
  'disbursement_id',
  'subscription_id',
  'task_id',
  'ticket_id',
  'inventory_id',
  'transaction_id',
  'record_id',
  'property_id',
  'external_id',
  'lookup_external_id',
  'language',
  'target',
  'provider',
  'channel_id',
  'channel_name',
  'external_object_type',
  'operation',
  'dry_run',
  'confirm',
]);

const LARGE_STRING_PLACEHOLDER_THRESHOLD = 2000;

type NormalizeToolCallResultInput = {
  mcpTool: McpTool;
  result: ToolCallResult;
  args: Record<string, unknown> | undefined;
  now?: Date;
};

type NormalizeMutationStructuredContentInput = {
  payload: Record<string, unknown>;
  mcpTool?: McpTool | undefined;
  args?: Record<string, unknown> | undefined;
  action?: string | undefined;
  idKeys?: string[] | undefined;
  extra?: Record<string, unknown> | undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const readNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
};

const readBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

const ACTION_STATUS_BY_TOOL_PREFIX: Record<string, string> = {
  activate: 'activated',
  append: 'appended',
  approve: 'approved',
  archive: 'archived',
  cancel: 'canceled',
  create: 'created',
  delete: 'deleted',
  finish: 'finished',
  reject: 'rejected',
  reply: 'replied',
  reschedule: 'rescheduled',
  retry: 'retried',
  schedule: 'scheduled',
  send: 'sent',
  start: 'started',
  switch: 'switched',
  update: 'updated',
  upload: 'uploaded',
  upsert: 'upserted',
};

export const buildToolErrorResult = (error: unknown): ToolCallResult => {
  const errorRecord = isRecord(error) ? error : {};
  const apiErrorPayload = isRecord(errorRecord['error']) ? errorRecord['error'] : {};
  const statusCode =
    readNumber(errorRecord['status']) ??
    readNumber(errorRecord['status_code']) ??
    readNumber(errorRecord['statusCode']);
  const message = error instanceof Error ? error.message : String(error);
  const errorType =
    error instanceof Error && error.constructor.name !== 'Error' ? error.constructor.name : undefined;
  const structuredContent = {
    ...apiErrorPayload,
    ok: false,
    status: readString(apiErrorPayload['status']) ?? 'error',
    status_code: statusCode,
    message: readString(apiErrorPayload['message']) ?? message,
    error_type: errorType,
    ctx_id: readString(apiErrorPayload['ctx_id']),
  };

  return {
    content: [
      {
        type: 'text',
        text: `Tool execution failed: ${structuredContent.message}`,
      },
    ],
    isError: true,
    structuredContent,
  };
};

const inferAction = (toolName: string, payload: Record<string, unknown>, httpMethod?: string): string => {
  const payloadStatus = readString(payload['status']);
  if (payloadStatus) {
    return payloadStatus;
  }
  const prefix = toolName.split('_')[0];
  if (prefix) {
    return ACTION_STATUS_BY_TOOL_PREFIX[prefix] ?? prefix;
  }
  switch ((httpMethod ?? '').toUpperCase()) {
    case 'POST':
      return 'created';
    case 'PUT':
    case 'PATCH':
      return 'updated';
    case 'DELETE':
      return 'deleted';
    default:
      return 'completed';
  }
};

const summarizeValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    if (value.length > LARGE_STRING_PLACEHOLDER_THRESHOLD) {
      return `[large string omitted: ${value.length} chars]`;
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map(summarizeValue);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'content_base64')
        .slice(0, 20)
        .map(([key, item]) => [key, summarizeValue(item)]),
    );
  }
  return undefined;
};

const buildSafeResult = (payload: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, summarizeValue(value)]));

const buildRequestedFields = (args: Record<string, unknown> | undefined): Record<string, unknown> => {
  if (!args) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(args)
      .filter(([key, value]) => value !== undefined && !CONTROL_ARGUMENT_KEYS.has(key))
      .filter(([key]) => key !== 'content_base64')
      .map(([key, value]) => [key, summarizeValue(value)]),
  );
};

const findReturnedValue = (payload: Record<string, unknown>, key: string): unknown => {
  if (payload[key] !== undefined) {
    return payload[key];
  }
  for (const containerKey of ['record_preview', 'record', 'data']) {
    const container = payload[containerKey];
    if (isRecord(container) && container[key] !== undefined) {
      return container[key];
    }
    const properties = isRecord(container) ? container['properties'] : undefined;
    if (isRecord(properties) && properties[key] !== undefined) {
      return properties[key];
    }
  }
  return undefined;
};

const buildReturnedFields = (
  payload: Record<string, unknown>,
  requestedFields: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.keys(requestedFields)
      .map((key) => [key, summarizeValue(findReturnedValue(payload, key))] as const)
      .filter(([, value]) => value !== undefined),
  );

const buildRecordIds = (payload: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => key !== 'ctx_id')
      .filter(([key]) => key === 'id' || key.endsWith('_id'))
      .map(([key, value]) => [key, readString(value)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

const advisoryRequiresConfirmation = (payload: Record<string, unknown>): boolean => {
  const advisories = payload['advisories'];
  if (!Array.isArray(advisories)) {
    return false;
  }
  return advisories.some((advisory) => isRecord(advisory) && advisory['requires_confirmation'] === true);
};

const buildSuccessText = ({
  mcpTool,
  payload,
  requestedFields,
  returnedFields,
  verificationNeeded,
}: {
  mcpTool: McpTool;
  payload: Record<string, unknown>;
  requestedFields: Record<string, unknown>;
  returnedFields: Record<string, unknown>;
  verificationNeeded: boolean;
}): string => {
  const status = readString(payload['status']) ?? 'ok';
  const ok = readBoolean(payload['ok']);
  const ids = buildRecordIds(payload);
  const idText = Object.entries(ids)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  const returnedText = Object.entries(returnedFields)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');
  const requestedText =
    returnedText ||
    Object.entries(requestedFields)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(' ');
  const verificationText = verificationNeeded ? ' verification=read_after_write_recommended' : '';
  return [
    `SUCCESS ${mcpTool.tool.name}`,
    status,
    idText,
    ok === undefined ? undefined : `ok=${ok}`,
    requestedText ? `fields ${requestedText}` : undefined,
    verificationText.trim() || undefined,
  ]
    .filter(Boolean)
    .join(' ');
};

const shouldAddSuccessSummary = (mcpTool: McpTool, isError: boolean): boolean => {
  if (isError) {
    return false;
  }
  if (mcpTool.tool.annotations?.readOnlyHint === true) {
    return false;
  }
  return mcpTool.metadata.operation !== 'read';
};

const prependSuccessSummary = (result: ToolCallResult, summary: string): ContentBlock[] => {
  const first = result.content[0];
  if (first?.type === 'text' && first.text.startsWith('SUCCESS ')) {
    return result.content;
  }
  return [{ type: 'text', text: summary }, ...result.content];
};

const unwrapEnvelopeData = (
  payload: Record<string, unknown>,
): { data: Record<string, unknown> | undefined; meta: Record<string, unknown> | undefined } => {
  const data = isRecord(payload['data']) ? payload['data'] : undefined;
  const meta = isRecord(payload['meta']) ? payload['meta'] : undefined;
  return { data, meta };
};

const readNestedString = (
  key: string,
  payload: Record<string, unknown>,
  data: Record<string, unknown> | undefined,
  properties: Record<string, unknown> | undefined,
  args: Record<string, unknown> | undefined,
): string | undefined =>
  readString(payload[key]) ??
  readString(data?.[key]) ??
  readString(properties?.[key]) ??
  readString(args?.[key]);

const readIDCandidate = (
  key: string,
  payload: Record<string, unknown>,
  data: Record<string, unknown> | undefined,
  properties: Record<string, unknown> | undefined,
  args: Record<string, unknown> | undefined,
): string | undefined => {
  const exact = readNestedString(key, payload, data, properties, args);
  if (exact) {
    return exact;
  }
  if (key === 'property_id') {
    return readString(args?.['property_ref']);
  }
  if (key === 'case_id') {
    return readString(args?.['deal_id']);
  }
  if (key === 'transaction_id') {
    return readString(args?.['inventory_transaction_id']);
  }
  if (key === 'external_id') {
    return undefined;
  }
  return (
    readString(payload['id']) ??
    readString(data?.['id']) ??
    readString(properties?.['id']) ??
    readString(payload['record_id']) ??
    readString(data?.['record_id']) ??
    readString(properties?.['record_id'])
  );
};

const readOutputSchemaProperties = (mcpTool: McpTool | undefined): Record<string, unknown> => {
  const outputSchema = isRecord(mcpTool?.tool.outputSchema) ? mcpTool?.tool.outputSchema : undefined;
  return isRecord(outputSchema?.['properties']) ? outputSchema['properties'] : {};
};

const readOutputSchemaRequired = (mcpTool: McpTool | undefined): Set<string> => {
  const outputSchema = isRecord(mcpTool?.tool.outputSchema) ? mcpTool?.tool.outputSchema : undefined;
  const required = outputSchema?.['required'];
  if (!Array.isArray(required)) {
    return new Set();
  }
  return new Set(required.filter((entry): entry is string => typeof entry === 'string'));
};

const inferMutationIDKeys = (
  mcpTool: McpTool | undefined,
  explicitIDKeys: string[] | undefined,
): string[] => {
  const schemaProperties = readOutputSchemaProperties(mcpTool);
  const schemaIDKeys = Object.keys(schemaProperties).filter(
    (key) =>
      key !== 'ctx_id' && (key === 'id' || key === 'case_id' || key === 'external_id' || key.endsWith('_id')),
  );
  const resourceName = mcpTool?.metadata.resource?.replace(/-/g, '_');
  const resourceIDKey =
    schemaIDKeys.length === 0 && resourceName ?
      `${resourceName.endsWith('ies') ? `${resourceName.slice(0, -3)}y` : resourceName.replace(/s$/, '')}_id`
    : undefined;
  return Array.from(
    new Set(
      [...(explicitIDKeys ?? []), ...schemaIDKeys, resourceIDKey, 'id', 'external_id'].filter(
        (key): key is string => Boolean(key),
      ),
    ),
  );
};

const inferMutationMessage = (mcpTool: McpTool | undefined, status: string): string =>
  `${mcpTool?.tool.title ?? mcpTool?.tool.name ?? 'Mutation'} ${status}.`;

const buildRequiredMutationDefaults = ({
  required,
  payload,
  normalizedIDs,
  objectName,
  status,
}: {
  required: Set<string>;
  payload: Record<string, unknown>;
  normalizedIDs: Record<string, string>;
  objectName: string | undefined;
  status: string;
}): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {};
  for (const key of required) {
    if (payload[key] !== undefined || normalizedIDs[key] !== undefined) {
      continue;
    }
    if (key === 'data') {
      defaults[key] = {};
    } else if (key === 'object') {
      defaults[key] = objectName ?? '';
    } else if (key === 'created') {
      defaults[key] = ['created', 'create'].includes(status);
    } else if (key === 'deleted') {
      defaults[key] = ['deleted', 'delete', 'archived', 'archive'].includes(status);
    } else if (key === 'ctx_id' || key === 'external_id' || key === 'id' || key.endsWith('_id')) {
      defaults[key] = '';
    }
  }
  return defaults;
};

export const normalizeMutationStructuredContent = ({
  payload,
  mcpTool,
  args,
  action,
  idKeys,
  extra,
}: NormalizeMutationStructuredContentInput): Record<string, unknown> => {
  const { data, meta } = unwrapEnvelopeData(payload);
  const properties = isRecord(data?.['properties']) ? data['properties'] : undefined;
  const schemaProperties = readOutputSchemaProperties(mcpTool);
  const required = readOutputSchemaRequired(mcpTool);
  const fallbackAction =
    action ?? (mcpTool ? inferAction(mcpTool.tool.name, payload, mcpTool.metadata.httpMethod) : 'completed');
  const status =
    readString(payload['status']) ??
    readString(data?.['status']) ??
    readString(properties?.['status']) ??
    readString(payload['operation']) ??
    readString(data?.['operation']) ??
    fallbackAction;
  const ctxID =
    readString(payload['ctx_id']) ??
    readString(data?.['ctx_id']) ??
    readString(properties?.['ctx_id']) ??
    readString(meta?.['ctx_id']);
  const ok =
    readBoolean(payload['ok']) ??
    readBoolean(payload['success']) ??
    readBoolean(data?.['ok']) ??
    readBoolean(data?.['success']) ??
    true;
  const normalizedIDs = Object.fromEntries(
    inferMutationIDKeys(mcpTool, idKeys)
      .map((key) => [key, readIDCandidate(key, payload, data, properties, args)] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const objectName =
    readString(payload['object']) ??
    readString(data?.['object']) ??
    readString(properties?.['object']) ??
    readString(args?.['object_name']) ??
    readString(args?.['object']);
  const requiredDefaults = buildRequiredMutationDefaults({
    required,
    payload,
    normalizedIDs,
    objectName,
    status,
  });

  return {
    ...payload,
    ok,
    status,
    ...requiredDefaults,
    ...(ctxID !== undefined ? { ctx_id: ctxID }
    : required.has('ctx_id') ? { ctx_id: '' }
    : undefined),
    ...(required.has('message') && payload['message'] === undefined ?
      { message: inferMutationMessage(mcpTool, status) }
    : undefined),
    ...normalizedIDs,
    ...(Object.prototype.hasOwnProperty.call(schemaProperties, 'object') && objectName ?
      { object: objectName }
    : undefined),
    ...extra,
  };
};

const shouldNormalizeMutationStructuredContent = (mcpTool: McpTool, isError: boolean): boolean => {
  if (isError) {
    return false;
  }
  if (mcpTool.tool.annotations?.readOnlyHint === true) {
    return false;
  }
  return mcpTool.metadata.operation !== 'read';
};

export const normalizeToolCallResult = ({
  mcpTool,
  result,
  args,
  now = new Date(),
}: NormalizeToolCallResultInput): ToolCallResult => {
  const rawPayload = isRecord(result.structuredContent) ? result.structuredContent : {};
  const httpStatus =
    readNumber(rawPayload['http_status']) ??
    readNumber(rawPayload['status_code']) ??
    readNumber(rawPayload['statusCode']);
  const isError = result.isError === true || (httpStatus !== undefined && httpStatus >= 400);
  const payload =
    shouldNormalizeMutationStructuredContent(mcpTool, isError) ?
      normalizeMutationStructuredContent({ payload: rawPayload, mcpTool, args })
    : rawPayload;
  const requestedFields = buildRequestedFields(args);
  const returnedFields = buildReturnedFields(payload, requestedFields);
  const hasRequestedFields = Object.keys(requestedFields).length > 0;
  const verificationNeeded =
    !isError &&
    mcpTool.metadata.operation !== 'read' &&
    hasRequestedFields &&
    Object.keys(returnedFields).length === 0;
  const needsConfirmation = advisoryRequiresConfirmation(payload);
  const meta = {
    ok: readBoolean(payload['ok']),
    success: !isError,
    tool_name: mcpTool.tool.name,
    tool_title: mcpTool.tool.title ?? mcpTool.tool.name,
    resource: mcpTool.metadata.resource,
    operation: mcpTool.metadata.operation,
    action: inferAction(mcpTool.tool.name, payload, mcpTool.metadata.httpMethod),
    http_method: mcpTool.metadata.httpMethod,
    http_path: mcpTool.metadata.httpPath,
    operation_id: mcpTool.metadata.operationId,
    ctx_id: readString(payload['ctx_id']),
    timestamp: now.toISOString(),
  };
  const confirmation = {
    ok: readBoolean(payload['ok']),
    status: readString(payload['status']),
    record_ids: buildRecordIds(payload),
    requested_fields: requestedFields,
    returned_fields: returnedFields,
    verification_needed: verificationNeeded,
    advisory_count: Array.isArray(payload['advisories']) ? payload['advisories'].length : 0,
    needs_confirmation: needsConfirmation,
  };
  const remediation = {
    safe_to_continue: !isError && !needsConfirmation,
    can_retry: isError && (httpStatus === undefined || httpStatus >= 500),
    retry_reason:
      isError && (httpStatus === undefined || httpStatus >= 500) ?
        'The tool failed without a client-correctable validation status.'
      : undefined,
    required_next_action:
      isError ? 'Inspect the error message and ctx_id before retrying.'
      : needsConfirmation ?
        'Review advisories and ask for explicit user confirmation before follow-up mutations.'
      : verificationNeeded ? 'Read the record again before claiming exact field-level state to the user.'
      : undefined,
  };
  const structuredContent = {
    ...payload,
    meta,
    result: buildSafeResult(payload),
    confirmation,
    remediation,
  };
  const summary = buildSuccessText({
    mcpTool,
    payload,
    requestedFields,
    returnedFields,
    verificationNeeded,
  });

  return {
    ...result,
    ...(isError ? { isError: true } : undefined),
    content:
      shouldAddSuccessSummary(mcpTool, isError) ? prependSuccessSummary(result, summary) : result.content,
    structuredContent,
  };
};
