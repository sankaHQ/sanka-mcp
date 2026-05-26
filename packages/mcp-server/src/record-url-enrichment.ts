import { McpRequestContext, ToolCallResult } from './types';

const RESOURCE_TO_APP_SLUG: Record<string, string> = {
  absences: 'absence',
  attendance_records: 'attendance',
  bills: 'bills',
  companies: 'companies',
  contacts: 'contacts',
  deals: 'deals',
  disbursements: 'disbursements',
  employees: 'worker',
  estimates: 'estimates',
  expenses: 'expenses',
  incentives: 'incentives',
  inventory_transactions: 'inventory_transactions',
  inventories: 'inventory',
  invoices: 'invoices',
  items: 'items',
  journals: 'journal',
  locations: 'locations',
  orders: 'orders',
  payments: 'payments',
  purchaseOrders: 'purchase_orders',
  slips: 'revenue',
  subscriptions: 'subscriptions',
  tasks: 'projects',
  tickets: 'tickets',
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

export function enrichRecordUrlsForToolResult({
  result,
  resource,
  reqContext,
  args,
}: {
  result: ToolCallResult;
  resource: string;
  reqContext: McpRequestContext;
  args?: Record<string, unknown> | undefined;
}): ToolCallResult {
  if (result.isError || !result.structuredContent) {
    return result;
  }

  const slug = RESOURCE_TO_APP_SLUG[resource];
  const workspaceCode = readWorkspaceCode(reqContext);
  if (!slug || !workspaceCode) {
    return result;
  }

  const context = {
    baseUrl: readAppBaseUrl(reqContext),
    language: readLanguage(args),
    resource,
    slug,
    workspaceCode,
  };
  const structuredContent = enrichPayload(result.structuredContent, context);
  return {
    ...result,
    content: appendPrimaryAppUrlToTextContent(result.content, structuredContent),
    structuredContent,
  };
}

function enrichPayload(payload: JsonRecord, context: EnrichmentContext): JsonRecord {
  const enriched = enrichRecord(payload, context);
  for (const key of ['data', 'results', 'created']) {
    const value = enriched[key];
    if (Array.isArray(value)) {
      enriched[key] = value.map((item) => (isJsonRecord(item) ? enrichRecord(item, context) : item));
    } else if (isJsonRecord(value)) {
      enriched[key] = enrichRecord(value, context);
    }
  }
  const resultValue = enriched['result'];
  if (isJsonRecord(resultValue)) {
    enriched['result'] = enrichPayload(resultValue, context);
  }
  return enriched;
}

type EnrichmentContext = {
  baseUrl: string;
  language: string;
  resource: string;
  slug: string;
  workspaceCode: string;
};

function enrichRecord(record: JsonRecord, context: EnrichmentContext): JsonRecord {
  if (!shouldEnrichRecord(record)) {
    return record;
  }
  const recordId = readRecordId(record, context.resource);
  if (!recordId) {
    return record;
  }
  return {
    ...record,
    workspace_code: readString(record['workspace_code']) || context.workspaceCode,
    app_url: readString(record['app_url']) || buildRecordAppUrl(context, recordId),
  };
}

function shouldEnrichRecord(record: JsonRecord): boolean {
  const scope = readString(record['scope']) || readString(record['source']);
  if (scope === 'integration') {
    return false;
  }
  const provider = readString(record['provider']);
  const externalObjectType = readString(record['external_object_type']);
  return !(provider && externalObjectType && !readString(record['id']));
}

function buildRecordAppUrl(context: EnrichmentContext, recordId: string): string {
  const languagePrefix = context.language === 'ja' ? '/ja' : '';
  const encodedId = encodeURIComponent(recordId);
  return `${context.baseUrl}${languagePrefix}/${context.workspaceCode}/${context.slug}/?id=${encodedId}`;
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

function readAppBaseUrl(reqContext: McpRequestContext): string {
  const configured = readString(reqContext.auth?.oauth?.authorizationServerUrl);
  return (configured || 'https://app.sanka.com').replace(/\/+$/, '');
}

function readLanguage(args?: Record<string, unknown> | undefined): string {
  const raw = readString(args?.['language']) || readString(args?.['lang']);
  return raw === 'en' ? 'en' : 'ja';
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

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
