import { INVALID_TOOL_ARGUMENTS_ERROR_TYPE } from './tool-argument-validator';
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
  'workspace_id',
  'view_id',
  'form_view_id',
  'form_set_id',
  'property_set_id',
  'object',
  'object_type',
  'object_name',
  'custom_object',
  'custom_object_id',
  'custom_object_slug',
  'doc_id',
  'idempotency_key',
  'content_base64',
]);

// Preconditions on a call, such as expected_version or confirm_send. The
// suffixes matter: expected_amount on an invoice request is a saved field.
const PRECONDITION_ARGUMENT_PATTERN = /^confirm_|^expected_\w*(id|hash|version|revision|email)$/;

// Top-level keys that describe the call rather than the record: `status` reads
// "updated" whatever status was requested, and `data` is the response envelope.
const ENVELOPE_KEYS = new Set(['status', 'data']);

// Tool name verbs whose arguments are saved on a record, so each should come
// back. The other write tools take instructions, such as a chunk offset or an
// email body, that no response repeats.
const FIELD_SAVING_VERBS = new Set(['create', 'update', 'upsert', 'save', 'set']);

const LARGE_STRING_PLACEHOLDER_THRESHOLD = 2000;

type NormalizeToolCallResultInput = {
  mcpTool: McpTool;
  result: ToolCallResult;
  args: Record<string, unknown> | undefined;
  now?: Date;
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
    return prefix;
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

// Compact variant of summarizeValue for the `result` summary: arrays are
// replaced with a placeholder instead of re-embedding row copies, because the
// full rows already live at the top level of structuredContent.
const summarizeCompactValue = (value: unknown): unknown => {
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
    return `[array omitted: ${value.length} items]`;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'content_base64')
        .slice(0, 20)
        .map(([key, item]) => [key, summarizeCompactValue(item)]),
    );
  }
  return undefined;
};

const buildSafeResult = (payload: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, summarizeCompactValue(value)]));

const toSnakeCase = (key: string): string => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

// Arguments that say which record to act on, or guard the call, are not fields:
// nothing is saved under them, so whether they come back says nothing.
const isFieldArgument = (key: string, httpPath: string | undefined): boolean => {
  const name = toSnakeCase(key);
  return (
    !CONTROL_ARGUMENT_KEYS.has(name) &&
    !PRECONDITION_ARGUMENT_PATTERN.test(name) &&
    !httpPath?.includes(`{${name}}`)
  );
};

const buildRequestedFields = (
  args: Record<string, unknown> | undefined,
  httpPath: string | undefined,
): Record<string, unknown> => {
  if (!args) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(args)
      .filter(([key, value]) => value !== undefined && isFieldArgument(key, httpPath))
      .map(([key, value]) => [key, summarizeValue(value)]),
  );
};

const isBlank = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && !value.trim()) ||
  (Array.isArray(value) && value.length === 0) ||
  (isRecord(value) && Object.keys(value).length === 0);

// A returned value is not compared with the requested one, because routes hand
// back a normalised form: a trimmed string, `name` as `standard:name`, a list
// with ids added. No route normalises a value into nothing, so a blank value
// only confirms a blank request.
const findReturnedValue = (payload: Record<string, unknown>, key: string, requested: unknown): unknown => {
  const confirmsRequest = (value: unknown) => value !== undefined && (!isBlank(value) || isBlank(requested));
  const topLevel = payload[key];
  if (confirmsRequest(topLevel) && (!ENVELOPE_KEYS.has(key) || topLevel === requested)) {
    return topLevel;
  }
  for (const containerKey of ['record_preview', 'record', 'data']) {
    const container = payload[containerKey];
    if (isRecord(container) && confirmsRequest(container[key])) {
      return container[key];
    }
  }
  return undefined;
};

const buildReturnedFields = (
  payload: Record<string, unknown>,
  requestedFields: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(requestedFields)
      .map(([key, requested]) => [key, summarizeValue(findReturnedValue(payload, key, requested))] as const)
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

const NETWORK_ERROR_TYPE_PATTERN = /connection|network|timeout/i;

// Retry only failures that are plausibly transient: rate limits, server-side
// errors, and network/timeout failures that never produced an HTTP status.
// Validation-style failures (4xx statuses or status-less string errors) are
// client-correctable and must not be marked retryable.
const isRetryableFailure = (httpStatus: number | undefined, payload: Record<string, unknown>): boolean => {
  if (httpStatus !== undefined) {
    return httpStatus === 429 || httpStatus >= 500;
  }
  const errorType = readString(payload['error_type']);
  return errorType !== undefined && NETWORK_ERROR_TYPE_PATTERN.test(errorType);
};

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

export const normalizeToolCallResult = ({
  mcpTool,
  result,
  args,
  now = new Date(),
}: NormalizeToolCallResultInput): ToolCallResult => {
  const payload = isRecord(result.structuredContent) ? result.structuredContent : {};
  const httpStatus =
    readNumber(payload['http_status']) ??
    readNumber(payload['status_code']) ??
    readNumber(payload['statusCode']);
  const isError = result.isError === true || (httpStatus !== undefined && httpStatus >= 400);
  const requestedFields = buildRequestedFields(args, mcpTool.metadata.httpPath);
  const returnedFields = buildReturnedFields(payload, requestedFields);
  const requestedCount = Object.keys(requestedFields).length;
  const returnedCount = Object.keys(returnedFields).length;
  const verificationNeeded =
    !isError &&
    mcpTool.metadata.operation !== 'read' &&
    (FIELD_SAVING_VERBS.has(mcpTool.tool.name.split('_')[0] ?? '') ?
      returnedCount < requestedCount
    : requestedCount > 0 && returnedCount === 0);
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
  const isInvalidArguments = readString(payload['error_type']) === INVALID_TOOL_ARGUMENTS_ERROR_TYPE;
  const canRetry = isError && payload['retryable'] !== false && isRetryableFailure(httpStatus, payload);
  const remediation = {
    safe_to_continue: !isError && !needsConfirmation,
    can_retry: canRetry,
    retry_reason: canRetry ? 'The tool failed without a client-correctable validation status.' : undefined,
    required_next_action:
      isError && isInvalidArguments ?
        'Fix the arguments listed in validation_errors to match the tool input schema, then call the tool again with corrected arguments.'
      : isError ? 'Inspect the error message and ctx_id before retrying.'
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
