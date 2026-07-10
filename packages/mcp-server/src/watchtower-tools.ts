// Hand-written WatchTower tools for the V2 waste-findings and spend-summary endpoints.

import { asErrorResult, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const WATCHTOWER_BASE_PATH = '/api/v2/watchtower';

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
};

const WATCHTOWER_FINDING_TYPES = ['renewal_calendar', 'price_creep', 'duplicate_vendors'] as const;

const WATCHTOWER_FINDING_STATUSES = ['new', 'confirmed', 'dismissed', 'resolved'] as const;

/** Statuses accepted by the findings PATCH endpoint; `resolved` is system-managed. */
const WATCHTOWER_FINDING_WRITABLE_STATUSES = ['new', 'confirmed', 'dismissed'] as const;

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
  return {
    ...(dataRecord ?? { data: envelope.data }),
    ...(envelope.meta?.['ctx_id'] ? { ctx_id: envelope.meta['ctx_id'] } : undefined),
    ...(envelope.message ? { message: envelope.message } : undefined),
  };
};

const findingLabel = (finding: Record<string, unknown> | undefined): string | undefined => {
  if (!finding) return undefined;
  const title = readString(finding['title']);
  const findingID = readString(finding['id']);
  const status = readString(finding['status']);
  return [title, findingID ? `(${findingID})` : undefined, status ? `status=${status}` : undefined]
    .filter(Boolean)
    .join(' ');
};

const buildSummary = (structuredContent: Record<string, unknown>, fallbackSummary: string): string => {
  const explicitMessage = readString(structuredContent['message']);
  if (explicitMessage) return explicitMessage;

  const findings = readObjectArray(structuredContent['findings']);
  if (findings) {
    return `Returned ${findings.length} WatchTower finding${findings.length === 1 ? '' : 's'}.`;
  }

  const buyRequestID = readString(structuredContent['buy_request_id']);
  if (buyRequestID) {
    const created = structuredContent['created'] === true;
    return `${created ? 'Created' : 'Reused'} Sanka Buy request ${buyRequestID} from WatchTower finding.`;
  }

  const month = readString(structuredContent['month']);
  if (month && Object.prototype.hasOwnProperty.call(structuredContent, 'current_month_total')) {
    const currency = readString(structuredContent['currency']);
    const total = structuredContent['current_month_total'];
    return `WatchTower spend summary for ${month}: current month total ${String(total)}${
      currency ? ` ${currency}` : ''
    }.`;
  }

  const label = findingLabel(structuredContent);
  return label ? `${fallbackSummary}: ${label}.` : fallbackSummary;
};

const watchtowerResult = (payload: Record<string, unknown>, fallbackSummary: string): ToolCallResult => {
  const structuredContent = normalizedStructuredContent(payload);
  const summary = buildSummary(structuredContent, fallbackSummary);
  return {
    content: [
      { type: 'text', text: summary },
      {
        type: 'text',
        text: `Structured WatchTower data:\n${JSON.stringify(structuredContent, null, 2)}`,
      },
    ],
    structuredContent,
  };
};

const watchtowerToolAuthError = (
  reqContext: Parameters<McpTool['handler']>[0]['reqContext'],
  title: string,
) => requireAuthentication({ reqContext, toolTitle: title });

export const listWatchtowerFindingsTool: McpTool = {
  metadata: {
    resource: 'watchtower',
    operation: 'read',
    tags: ['watchtower', 'waste', 'findings'],
    httpMethod: 'get',
    httpPath: '/api/v2/watchtower/findings',
    operationId: 'watchtower.findings.list',
  },
  tool: {
    name: 'list_watchtower_findings',
    title: 'List WatchTower findings',
    description:
      'List WatchTower waste findings (upcoming renewals, vendor price creep, possibly duplicate vendors) in the authenticated workspace, with optional status and finding_type filters. Findings with buy_request_id already link to a Sanka Buy request.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: {
          type: 'string',
          enum: [...WATCHTOWER_FINDING_STATUSES],
          description: 'Optional finding status filter.',
        },
        finding_type: {
          type: 'string',
          enum: [...WATCHTOWER_FINDING_TYPES],
          description: 'Optional finding type filter.',
        },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List WatchTower findings',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = watchtowerToolAuthError(reqContext, 'List WatchTower findings');
    if (authError) return authError;
    const response = (await reqContext.client.get(`${WATCHTOWER_BASE_PATH}/findings`, {
      query: compactRecord({
        status: readString(readArg(args, 'status')),
        finding_type: readString(readArg(args, 'finding_type', ['findingType'])),
      }),
    })) as Record<string, unknown>;
    return watchtowerResult(response, 'Listed WatchTower findings');
  },
};

export const updateWatchtowerFindingTool: McpTool = {
  metadata: {
    resource: 'watchtower',
    operation: 'write',
    tags: ['watchtower', 'waste', 'findings'],
    httpMethod: 'patch',
    httpPath: '/api/v2/watchtower/findings/{finding_id}',
    operationId: 'watchtower.findings.update',
  },
  tool: {
    name: 'update_watchtower_finding',
    title: 'Update WatchTower finding',
    description:
      'Update the triage status of one WatchTower waste finding: confirmed to accept the signal, dismissed to reject it, or new to reopen it. The resolved status is system-managed and cannot be written.',
    inputSchema: {
      type: 'object',
      required: ['finding_id', 'status'],
      additionalProperties: false,
      properties: {
        finding_id: { type: 'string' },
        status: {
          type: 'string',
          enum: [...WATCHTOWER_FINDING_WRITABLE_STATUSES],
          description: 'New triage status for the finding.',
        },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update WatchTower finding',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = watchtowerToolAuthError(reqContext, 'Update WatchTower finding');
    if (authError) return authError;
    const findingID = readString(readArg(args, 'finding_id', ['findingId']));
    if (!findingID) return asErrorResult('`finding_id` is required.');
    const status = readString(readArg(args, 'status'));
    if (
      !status ||
      !WATCHTOWER_FINDING_WRITABLE_STATUSES.includes(
        status as (typeof WATCHTOWER_FINDING_WRITABLE_STATUSES)[number],
      )
    ) {
      return asErrorResult('`status` must be one of: new, confirmed, dismissed.');
    }
    const response = (await reqContext.client.patch(
      `${WATCHTOWER_BASE_PATH}/findings/${encodeURIComponent(findingID)}`,
      { body: { status } },
    )) as Record<string, unknown>;
    return watchtowerResult(response, 'Updated WatchTower finding');
  },
};

export const createBuyRequestFromFindingTool: McpTool = {
  metadata: {
    resource: 'watchtower',
    operation: 'write',
    tags: ['watchtower', 'waste', 'findings', 'buy', 'procurement'],
    httpMethod: 'post',
    httpPath: '/api/v2/watchtower/findings/{finding_id}/buy-request',
    operationId: 'watchtower.findings.createBuyRequest',
  },
  tool: {
    name: 'create_buy_request_from_finding',
    title: 'Create Buy request from finding',
    description:
      'Turn one WatchTower waste finding into a draft Sanka Buy request so the replacement purchase can be sourced and compared. Repeat calls reuse the already linked Buy request (the response reports created=false). Continue with the Sanka Buy tools (source_buy_request, select_buy_offer, submit_buy_request) afterwards.',
    inputSchema: {
      type: 'object',
      required: ['finding_id'],
      additionalProperties: false,
      properties: {
        finding_id: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create Buy request from finding',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = watchtowerToolAuthError(reqContext, 'Create Buy request from finding');
    if (authError) return authError;
    const findingID = readString(readArg(args, 'finding_id', ['findingId']));
    if (!findingID) return asErrorResult('`finding_id` is required.');
    const response = (await reqContext.client.post(
      `${WATCHTOWER_BASE_PATH}/findings/${encodeURIComponent(findingID)}/buy-request`,
      { body: {} },
    )) as Record<string, unknown>;
    return watchtowerResult(response, 'Created Sanka Buy request from WatchTower finding');
  },
};

export const getWatchtowerSummaryTool: McpTool = {
  metadata: {
    resource: 'watchtower',
    operation: 'read',
    tags: ['watchtower', 'waste', 'spend'],
    httpMethod: 'get',
    httpPath: '/api/v2/watchtower/summary',
    operationId: 'watchtower.summary.retrieve',
  },
  tool: {
    name: 'get_watchtower_summary',
    title: 'Get WatchTower summary',
    description:
      'Load the WatchTower spend summary for the authenticated workspace: current and previous month totals, month-over-month delta, per-source totals, a monthly trend, and category plus top-vendor breakdowns.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        month: {
          type: 'string',
          description: 'Optional target month in YYYY-MM format. Defaults to the current month.',
        },
        months: {
          type: 'integer',
          minimum: 1,
          maximum: 12,
          default: 6,
          description: 'Number of trailing months to include in the trend.',
        },
        currency: {
          type: 'string',
          minLength: 3,
          maxLength: 3,
          description: 'Optional 3-letter currency code filter.',
        },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get WatchTower summary',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = watchtowerToolAuthError(reqContext, 'Get WatchTower summary');
    if (authError) return authError;
    const response = (await reqContext.client.get(`${WATCHTOWER_BASE_PATH}/summary`, {
      query: compactRecord({
        month: readString(readArg(args, 'month')),
        months: readNumber(readArg(args, 'months')),
        currency: readString(readArg(args, 'currency')),
      }),
    })) as Record<string, unknown>;
    return watchtowerResult(response, 'Loaded WatchTower spend summary');
  },
};
