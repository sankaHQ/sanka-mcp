import { McpRequestContext, ToolCallResult } from './types';

type AppRoute = {
  moduleSlug: string;
  objectSlug: string;
};

const RESOURCE_TO_APP_ROUTE: Record<string, AppRoute> = {
  absences: { moduleSlug: 'hr', objectSlug: 'absences' },
  attendance_records: { moduleSlug: 'hr', objectSlug: 'attendance' },
  bills: { moduleSlug: 'finance-legal', objectSlug: 'bills' },
  companies: { moduleSlug: 'crm', objectSlug: 'companies' },
  contacts: { moduleSlug: 'crm', objectSlug: 'contacts' },
  deals: { moduleSlug: 'crm', objectSlug: 'deals' },
  disbursements: { moduleSlug: 'finance-legal', objectSlug: 'disbursements' },
  employees: { moduleSlug: 'hr', objectSlug: 'worker' },
  estimates: { moduleSlug: 'commerce', objectSlug: 'estimates' },
  expenses: { moduleSlug: 'finance-legal', objectSlug: 'expenses' },
  incentives: { moduleSlug: 'finance-legal', objectSlug: 'incentives' },
  inventory_transactions: { moduleSlug: 'inventory', objectSlug: 'inventory_transactions' },
  inventories: { moduleSlug: 'inventory', objectSlug: 'inventory' },
  invoices: { moduleSlug: 'finance-legal', objectSlug: 'invoices' },
  items: { moduleSlug: 'commerce', objectSlug: 'items' },
  journals: { moduleSlug: 'finance-legal', objectSlug: 'journals' },
  locations: { moduleSlug: 'inventory', objectSlug: 'locations' },
  orders: { moduleSlug: 'commerce', objectSlug: 'orders' },
  payments: { moduleSlug: 'finance-legal', objectSlug: 'payments' },
  purchaseOrders: { moduleSlug: 'finance-legal', objectSlug: 'purchase_orders' },
  slips: { moduleSlug: 'finance-legal', objectSlug: 'revenues' },
  subscriptions: { moduleSlug: 'commerce', objectSlug: 'subscriptions' },
  tasks: { moduleSlug: 'operations', objectSlug: 'tasks' },
  tickets: { moduleSlug: 'operations', objectSlug: 'tickets' },
};

const RESOURCE_ID_KEYS: Record<string, string[]> = {
  absences: ['id', 'absence_id'],
  attendance_records: ['id', 'attendance_record_id', 'track_id'],
  bills: ['id', 'bill_id'],
  companies: ['id', 'company_id'],
  contacts: ['id', 'contact_id'],
  deals: ['id', 'deal_id', 'case_id'],
  disbursements: ['id', 'disbursement_id'],
  employees: ['id', 'worker_id', 'employee_id'],
  estimates: ['id', 'estimate_id'],
  expenses: ['id', 'expense_id'],
  incentives: ['id', 'incentive_id'],
  inventory_transactions: ['id', 'transaction_id'],
  inventories: ['id', 'inventory_record_id', 'inventory_id'],
  invoices: ['id', 'invoice_id'],
  items: ['id', 'item_id'],
  journals: ['id', 'uuid', 'journal_id'],
  locations: ['id', 'location_id'],
  orders: ['id', 'order_id'],
  payments: ['id', 'payment_id', 'receipt_id'],
  purchaseOrders: ['id', 'purchase_order_id'],
  slips: ['id', 'slip_id', 'revenue_id'],
  subscriptions: ['id', 'subscription_id'],
  tasks: ['id', 'task_id'],
  tickets: ['id', 'ticket_id'],
};

type JsonRecord = Record<string, unknown>;

type RecordEnrichmentMetadata = {
  dataOrigin?: string;
  externalObjectType?: string;
  provider?: string;
  scope?: string;
  source?: string;
  sourceOfTruth?: string;
  target?: string;
};

export function enrichRecordUrlsForToolResult({
  result,
  resource,
  reqContext,
}: {
  result: ToolCallResult;
  resource: string;
  reqContext: McpRequestContext;
  args?: Record<string, unknown> | undefined;
}): ToolCallResult {
  if (result.isError || !result.structuredContent) {
    return result;
  }

  const route = RESOURCE_TO_APP_ROUTE[resource];
  const workspaceCode = readWorkspaceCode(reqContext);
  if (!route || !workspaceCode) {
    return result;
  }

  const context = {
    baseUrl: readAppBaseUrl(),
    resource,
    route,
    workspaceCode,
  };
  const structuredContent = enrichPayload(result.structuredContent, context);
  return {
    ...result,
    content: appendPrimaryAppUrlToTextContent(result.content, structuredContent),
    structuredContent,
  };
}

function enrichPayload(
  payload: JsonRecord,
  context: EnrichmentContext,
  inheritedMetadata: RecordEnrichmentMetadata = {},
): JsonRecord {
  const enriched = enrichRecord(payload, context, inheritedMetadata);
  const childMetadata = mergeRecordMetadata(inheritedMetadata, enriched);
  for (const key of ['data', 'results', 'created']) {
    const value = enriched[key];
    if (Array.isArray(value)) {
      enriched[key] = value.map((item) =>
        isJsonRecord(item) ? enrichRecord(item, context, childMetadata) : item,
      );
    } else if (isJsonRecord(value)) {
      enriched[key] = enrichRecord(value, context, childMetadata);
    }
  }
  const resultValue = enriched['result'];
  if (isJsonRecord(resultValue)) {
    enriched['result'] = enrichPayload(resultValue, context, childMetadata);
  }
  return enriched;
}

type EnrichmentContext = {
  baseUrl: string;
  resource: string;
  route: AppRoute;
  workspaceCode: string;
};

function enrichRecord(
  record: JsonRecord,
  context: EnrichmentContext,
  inheritedMetadata: RecordEnrichmentMetadata = {},
): JsonRecord {
  if (!shouldEnrichRecord(record, inheritedMetadata)) {
    return record;
  }
  const recordId = readRecordId(record, context.resource);
  if (!recordId) {
    return record;
  }
  const existingAppUrl = readString(record['app_url']);
  return {
    ...record,
    workspace_code: readString(record['workspace_code']) || context.workspaceCode,
    app_url: canonicalRecordAppUrl(context, recordId, existingAppUrl),
  };
}

function shouldEnrichRecord(record: JsonRecord, inheritedMetadata: RecordEnrichmentMetadata): boolean {
  const metadata = mergeRecordMetadata(inheritedMetadata, record);
  if (isIntegrationMetadata(metadata)) {
    return false;
  }
  const provider = readString(record['provider']);
  const externalObjectType = readString(record['external_object_type']);
  return !(provider && externalObjectType && !readString(record['id']));
}

function mergeRecordMetadata(
  inherited: RecordEnrichmentMetadata,
  record: JsonRecord,
): RecordEnrichmentMetadata {
  return {
    ...inherited,
    ...compactMetadata({
      dataOrigin: readLowerString(record['data_origin']),
      externalObjectType: readString(record['external_object_type']),
      provider: readLowerString(record['provider']),
      scope: readLowerString(record['scope']),
      source: readLowerString(record['source']),
      sourceOfTruth: readLowerString(record['source_of_truth']),
      target: readLowerString(record['target']),
    }),
  };
}

function compactMetadata(metadata: Record<string, string | undefined>): RecordEnrichmentMetadata {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  ) as RecordEnrichmentMetadata;
}

function isIntegrationMetadata(metadata: RecordEnrichmentMetadata): boolean {
  return (
    metadata.scope === 'integration' ||
    metadata.source === 'integration' ||
    metadata.dataOrigin === 'integration' ||
    metadata.target === 'integration'
  );
}

function buildRecordAppUrl(context: EnrichmentContext, recordId: string): string {
  return [
    context.baseUrl,
    encodePathSegment(context.workspaceCode),
    encodePathSegment(context.route.moduleSlug),
    encodePathSegment(context.route.objectSlug),
    encodePathSegment(recordId),
    'manage',
  ].join('/');
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function canonicalRecordAppUrl(
  context: EnrichmentContext,
  recordId: string,
  existingAppUrl?: string | undefined,
): string {
  if (!existingAppUrl || isSankaWorkspaceAppUrl(context, existingAppUrl)) {
    return buildRecordAppUrl(context, recordId);
  }
  return existingAppUrl;
}

function isSankaWorkspaceAppUrl(context: EnrichmentContext, appUrl: string): boolean {
  try {
    const url = new URL(appUrl);
    if (!isKnownSankaAppHost(url, context.baseUrl)) {
      return false;
    }
    const segments = url.pathname.split('/').filter(Boolean);
    const routeSegments = segments[0] === 'ja' ? segments.slice(1) : segments;
    return routeSegments[0] === context.workspaceCode;
  } catch {
    return false;
  }
}

function isKnownSankaAppHost(url: URL, configuredBaseUrl: string): boolean {
  const hostname = url.hostname.toLowerCase();
  const knownHosts = new Set(['app.sanka.com', 'app-v2.sanka.com']);
  try {
    knownHosts.add(new URL(configuredBaseUrl).hostname.toLowerCase());
  } catch {
    // Ignore malformed local configuration and keep the fixed production hosts.
  }
  return knownHosts.has(hostname);
}

function readRecordId(record: JsonRecord, resource: string): string | undefined {
  const keys = [...(RESOURCE_ID_KEYS[resource] ?? []), 'id', 'uuid'];
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const value = readString(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function appendPrimaryAppUrlToTextContent(
  content: ToolCallResult['content'],
  structuredContent: JsonRecord,
): ToolCallResult['content'] {
  const appURL = readPrimaryAppUrl(structuredContent);
  if (!appURL) {
    return content;
  }
  const firstTextIndex = content.findIndex((entry) => entry.type === 'text');
  if (firstTextIndex < 0) {
    return content;
  }

  const existing = content[firstTextIndex];
  if (
    !existing ||
    existing.type !== 'text' ||
    existing.text.includes(appURL) ||
    existing.text.includes('app_url')
  ) {
    return content;
  }

  const nextContent = [...content];
  nextContent[firstTextIndex] = {
    ...existing,
    text: `${existing.text}\napp_url: ${appURL}`,
  };
  return nextContent;
}

function readPrimaryAppUrl(payload: JsonRecord): string | undefined {
  const direct = readString(payload['app_url']);
  if (direct) {
    return direct;
  }
  for (const key of ['data', 'result', 'created']) {
    const value = payload[key];
    if (isJsonRecord(value)) {
      const nested = readString(value['app_url']);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

function readWorkspaceCode(reqContext: McpRequestContext): string | undefined {
  return readString(reqContext.auth?.oauth?.workspace_code);
}

function readAppBaseUrl(): string {
  const configuredV2Base = readString(process.env['SANKA_V2_APP_BASE_URL']);
  return (configuredV2Base || 'https://app-v2.sanka.com').replace(/\/+$/, '');
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function readLowerString(value: unknown): string | undefined {
  return readString(value)?.toLowerCase();
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
