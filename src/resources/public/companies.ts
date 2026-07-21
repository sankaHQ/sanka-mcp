// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { V2Envelope, unwrapV2Data, unwrapV2DataPromise } from '../../internal/v2';
import { compactProperties } from '../../internal/v2-object-records';
import { SankaError } from '../../core/error';

type V2ObjectRecord = {
  id: string;
  record_id?: string | null;
  object_type?: string | null;
  properties?: Record<string, unknown>;
};

type V2ObjectRecordList = {
  items?: Array<V2ObjectRecord>;
  page?: number;
  page_size?: number;
  total?: number;
};

type V2LifecycleData = {
  id?: string | null;
  record_id?: string | null;
  status?: string | null;
  usage_status?: string | null;
};

const numericRecordID = (recordID: string | null | undefined): number | undefined => {
  if (typeof recordID !== 'string' || !recordID.trim()) return undefined;
  const value = Number(recordID);
  return Number.isFinite(value) ? value : undefined;
};

const companyFromV2Record = (record: V2ObjectRecord): CompanyRetrieveResponse => {
  const properties = record.properties ?? {};
  return {
    ...properties,
    id: record.id,
    company_id: numericRecordID(record.record_id) ?? (record.record_id as never) ?? null,
  } as CompanyRetrieveResponse;
};

const unwrapV2Company = (
  promise: APIPromise<V2Envelope<V2ObjectRecord>>,
): APIPromise<CompanyRetrieveResponse> =>
  promise._thenUnwrap((envelope) => companyFromV2Record(unwrapV2Data(envelope)));

const companyListFromV2Envelope = (envelope: V2Envelope<V2ObjectRecordList>): CompanyListResponse => {
  const data = unwrapV2Data(envelope);
  const rows = (data.items ?? []).map(companyFromV2Record) as unknown as Array<{
    [key: string]: unknown;
  }>;
  const total = data.total ?? rows.length;
  const page = data.page ?? 1;
  return {
    count: rows.length,
    data: rows,
    message: `Returned ${rows.length} of ${total} companies.`,
    page,
    total,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

const companyDeleteResponseFromV2Lifecycle = (
  envelope: V2Envelope<V2LifecycleData>,
  externalID?: string | null,
): PublicCompanyResponse => {
  const data = unwrapV2Data(envelope);
  return {
    ok: true,
    status: 'deleted',
    company_id: data.id ?? null,
    external_id: externalID ?? null,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

const companyMutationResponseFromV2Record = (
  envelope: V2Envelope<V2ObjectRecord>,
  externalID?: string | null,
  status = 'updated',
): PublicCompanyResponse => {
  const data = unwrapV2Data(envelope);
  return {
    ok: true,
    status,
    company_id: data.id,
    external_id: externalID ?? null,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

const usableExternalID = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const hasRemoteMutationTarget = (target: string | null | undefined): boolean =>
  target != null && target !== 'sanka';

const compactLocalMutationProperties = (body: Record<string, unknown>): Record<string, unknown> => {
  const properties = { ...body };
  if (properties['target'] === 'sanka') {
    delete properties['target'];
  }
  return compactProperties(properties);
};

const hasRetiredIntegrationCompanyListArgs = (params: CompanyListParams | null | undefined): boolean => {
  if (!params) return false;
  return (
    params.channel_id != null ||
    params.external_object_type != null ||
    params.provider != null ||
    params.reference_id != null ||
    params.scope === 'integration'
  );
};

export class Companies extends APIResource {
  /**
   * Create Company
   */
  create(body: CompanyCreateParams, options?: RequestOptions): APIPromise<PublicCompanyResponse> {
    if (hasRemoteMutationTarget(body.target)) {
      return unwrapV2DataPromise(
        this._client.v2Post<PublicCompanyResponse>('/companies', { body, ...options }),
      );
    }
    const externalID = usableExternalID(body.external_id);
    return this._client
      .v2Post<V2ObjectRecord>('/companies', {
        body: { properties: compactLocalMutationProperties(body as unknown as Record<string, unknown>) },
        ...options,
      })
      ._thenUnwrap((envelope) => companyMutationResponseFromV2Record(envelope, externalID, 'created'));
  }

  /**
   * Get Company
   */
  retrieve(
    companyID: string,
    query: CompanyRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<CompanyRetrieveResponse> {
    return unwrapV2Company(
      this._client.v2Get<V2ObjectRecord>(path`/companies/${companyID}`, { query, ...options }),
    );
  }

  /**
   * Update Company
   */
  update(
    companyID: string,
    body: CompanyUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PublicCompanyResponse> {
    if (hasRemoteMutationTarget(body.target)) {
      return unwrapV2DataPromise(
        this._client.v2Patch<PublicCompanyResponse>(path`/companies/${companyID}`, {
          body,
          ...options,
        }),
      );
    }
    return this._client
      .v2Patch<V2ObjectRecord>(path`/companies/${companyID}`, {
        body: { properties: compactLocalMutationProperties(body as unknown as Record<string, unknown>) },
        ...options,
      })
      ._thenUnwrap((envelope) => companyMutationResponseFromV2Record(envelope));
  }

  /**
   * List Companies
   */
  list(
    params: CompanyListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<CompanyListResponse> {
    const { 'Accept-Language': acceptLanguage, limit, scope, view, ...query } = params ?? {};
    void scope;
    if (hasRetiredIntegrationCompanyListArgs(params)) {
      throw new SankaError(
        'Integration-scoped company listing was retired with Public API V1 and has no V2 equivalent.',
      );
    }
    return this._client
      .v2Get<V2ObjectRecordList>('/companies', {
        query: {
          ...query,
          ...(limit != null ? { limit } : undefined),
          ...(view != null ? { view_id: view } : undefined),
        },
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      })
      ._thenUnwrap(companyListFromV2Envelope);
  }

  /**
   * Delete Company
   */
  delete(
    companyID: string,
    params: CompanyDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicCompanyResponse> {
    const { channel_id, confirm, dry_run, external_id, external_object_type, operation, provider, target } =
      params ?? {};
    if (operation != null) {
      throw new SankaError(
        'Custom company delete operations were retired with Public API V1; use the V2 delete operation.',
      );
    }
    if (hasRemoteMutationTarget(target)) {
      return unwrapV2DataPromise(
        this._client.v2Delete<PublicCompanyResponse>(path`/companies/${companyID}`, {
          query: {
            channel_id,
            confirm,
            dry_run,
            external_id,
            external_object_type,
            operation,
            provider,
            target,
          },
          ...options,
        }),
      );
    }
    return this._client
      .v2Delete<V2LifecycleData>(path`/companies/${companyID}`, {
        query: { external_id },
        ...options,
      })
      ._thenUnwrap((envelope) => companyDeleteResponseFromV2Lifecycle(envelope, external_id));
  }

  /**
   * Get Company Price Table
   */
  getPriceTable(
    companyID: string,
    query: CompanyPriceTableQueryParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<CompanyPriceTableResponse> {
    return this._client
      .v2Get<CompanyPriceTableResponse>(path`/companies/${companyID}/price-table`, {
        query,
        ...options,
      })
      ._thenUnwrap((envelope) => unwrapV2Data(envelope));
  }

  /**
   * Update Company Price Table Company Settings
   */
  updatePriceTableCompany(
    companyID: string,
    body: CompanyPriceTableCompanyUpdateParams,
    options?: RequestOptions,
  ): APIPromise<CompanyPriceTableMutationResponse> {
    return this._client
      .v2Patch<CompanyPriceTableMutationResponse>(path`/companies/${companyID}/price-table/company`, {
        body,
        ...options,
      })
      ._thenUnwrap((envelope) => unwrapV2Data(envelope));
  }

  /**
   * Apply Company Price Table To All Items
   */
  applyPriceTableItems(
    companyID: string,
    body: CompanyPriceTableApplyAllParams,
    options?: RequestOptions,
  ): APIPromise<CompanyPriceTableMutationResponse> {
    return this._client
      .v2Post<CompanyPriceTableMutationResponse>(path`/companies/${companyID}/price-table/items/apply-all`, {
        body,
        ...options,
      })
      ._thenUnwrap((envelope) => unwrapV2Data(envelope));
  }

  /**
   * Update Company Price Table Item Override
   */
  updatePriceTableItem(
    companyID: string,
    itemID: string,
    body: CompanyPriceTableItemUpdateParams,
    options?: RequestOptions,
  ): APIPromise<CompanyPriceTableMutationResponse> {
    return this._client
      .v2Patch<CompanyPriceTableMutationResponse>(path`/companies/${companyID}/price-table/items/${itemID}`, {
        body,
        ...options,
      })
      ._thenUnwrap((envelope) => unwrapV2Data(envelope));
  }
}

export interface PublicCompanyRequest {
  address?: string | null;

  allowed_in_store?: boolean | null;

  billing_cycle?: string | null;

  channel_id?: string | null;

  confirm?: boolean | null;

  custom_fields?: Record<string, unknown> | null;

  dry_run?: boolean | null;

  email?: string | null;

  external_id?: string | null;

  external_object_type?: string | null;

  name?: string | null;

  operation?: string | null;

  payment_cycle?: string | null;

  phone_number?: string | null;

  primary_external_id?: string | null;

  provider?: string | null;

  secondary_external_ids?: Array<string> | null;

  status?: string | null;

  target?: string | null;

  url?: string | null;
}

export interface PublicCompanyResponse {
  ok: boolean;

  status: string;

  channel_id?: string | null;

  channel_name?: string | null;

  company_id?: string | null;

  ctx_id?: string | null;

  dry_run?: boolean | null;

  external_id?: string | null;

  external_object_type?: string | null;

  message?: string | null;

  operation?: string | null;

  provider?: string | null;

  remote?: Record<string, unknown> | null;

  sync_state?: Record<string, unknown> | null;

  target?: string | null;
}

export interface CompanyRetrieveResponse {
  created_at: string;

  updated_at: string;

  id?: string | null;

  address?: string | null;

  allowed_in_store?: boolean | null;

  billing_cycle?: string | null;

  billing_cycle_display?: string | null;

  company_id?: number | null;

  custom_fields?: Record<string, unknown> | null;

  email?: string | null;

  name?: string | null;

  payment_cycle?: string | null;

  payment_cycle_display?: string | null;

  phone_number?: string | null;

  url?: string | null;
}

export interface CompanyListResponse {
  count: number;

  data: Array<{ [key: string]: unknown }>;

  message: string;

  page: number;

  total: number;

  channel_id?: string | null;

  channel_name?: string | null;

  ctx_id?: string | null;

  external_object_type?: string | null;

  next_cursor?: string | null;

  permission?: string | null;

  provider?: string | null;

  scope?: string | null;

  sync_state?: { [key: string]: unknown } | null;

  unavailable_reason?: string | null;
}

export interface CompanyPriceTableItem {
  item_id: string;

  item_name: string;

  company_price_precentage?: number | null;

  company_price_percentage?: number | null;

  currency?: string | null;

  default_price?: number | null;

  discount_price?: number | null;

  discount_rate?: number | null;

  has_override?: boolean | null;

  item_record_id?: number | null;
}

export interface CompanyPriceTablePagination {
  has_next: boolean;

  has_previous: boolean;

  page: number;

  page_size: number;

  total_count: number;

  total_pages: number;
}

export interface CompanyPriceTableResponse {
  field_id: string;

  items: Array<CompanyPriceTableItem>;

  message: string;

  mode: string;

  pagination: CompanyPriceTablePagination;

  company_price_precentage?: number | null;

  company_price_percentage?: number | null;

  ctx_id?: string | null;
}

export interface CompanyPriceTableMutationResponse {
  data: { [key: string]: unknown };

  message: string;

  ctx_id?: string | null;
}

export interface CompanyCreateParams {
  address?: string | null;

  allowed_in_store?: boolean | null;

  billing_cycle?: string | null;

  channel_id?: string | null;

  confirm?: boolean | null;

  custom_fields?: Record<string, unknown> | null;

  dry_run?: boolean | null;

  email?: string | null;

  external_id?: string | null;

  external_object_type?: string | null;

  name?: string | null;

  operation?: string | null;

  payment_cycle?: string | null;

  phone_number?: string | null;

  primary_external_id?: string | null;

  provider?: string | null;

  secondary_external_ids?: Array<string> | null;

  status?: string | null;

  target?: string | null;

  url?: string | null;
}

export interface CompanyRetrieveParams {
  external_id?: string | null;
}

export interface CompanyUpdateParams {
  address?: string | null;

  allowed_in_store?: boolean | null;

  billing_cycle?: string | null;

  channel_id?: string | null;

  confirm?: boolean | null;

  custom_fields?: Record<string, unknown> | null;

  dry_run?: boolean | null;

  email?: string | null;

  external_id?: string | null;

  external_object_type?: string | null;

  name?: string | null;

  operation?: string | null;

  payment_cycle?: string | null;

  phone_number?: string | null;

  primary_external_id?: string | null;

  provider?: string | null;

  secondary_external_ids?: Array<string> | null;

  status?: string | null;

  target?: string | null;

  url?: string | null;
}

export interface CompanyListParams {
  /**
   * Query param
   */
  channel_id?: string | null;

  /**
   * Query param
   */
  external_object_type?: string | null;

  /**
   * Query param
   */
  limit?: number | null;

  /**
   * Query param
   */
  page?: number;

  /**
   * Query param
   */
  reference_id?: string | null;

  /**
   * Query param
   */
  search?: string | null;

  /**
   * Query param
   */
  provider?: 'hubspot' | 'salesforce' | null;

  /**
   * Query param
   */
  scope?: 'sanka' | 'integration' | null;

  /**
   * Query param
   */
  sort?: string | null;

  /**
   * Query param
   */
  view?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface CompanyDeleteParams {
  channel_id?: string | null;

  confirm?: boolean | null;

  dry_run?: boolean | null;

  external_id?: string | null;

  external_object_type?: string | null;

  operation?: string | null;

  provider?: string | null;

  target?: string | null;
}

export interface CompanyPriceTableQueryParams {
  field_ref?: string | null;

  page?: number;

  page_size?: number;

  q?: string | null;
}

export interface CompanyPriceTableCompanyUpdateParams {
  field_ref?: string | null;

  mode?: string | null;

  price_percentage?: number | null;

  price_precentage?: number | null;
}

export interface CompanyPriceTableItemUpdateParams {
  discount_price?: number | null;

  field_ref?: string | null;

  price_percentage?: number | null;

  price_precentage?: number | null;
}

export interface CompanyPriceTableApplyAllParams {
  exclude_item_ids?: Array<string>;

  field_ref?: string | null;

  mode?: string | null;

  price_percentage?: number | null;

  price_precentage?: number | null;
}

export declare namespace Companies {
  export {
    type PublicCompanyRequest as PublicCompanyRequest,
    type PublicCompanyResponse as PublicCompanyResponse,
    type CompanyRetrieveResponse as CompanyRetrieveResponse,
    type CompanyListResponse as CompanyListResponse,
    type CompanyPriceTableItem as CompanyPriceTableItem,
    type CompanyPriceTablePagination as CompanyPriceTablePagination,
    type CompanyPriceTableResponse as CompanyPriceTableResponse,
    type CompanyPriceTableMutationResponse as CompanyPriceTableMutationResponse,
    type CompanyCreateParams as CompanyCreateParams,
    type CompanyRetrieveParams as CompanyRetrieveParams,
    type CompanyUpdateParams as CompanyUpdateParams,
    type CompanyListParams as CompanyListParams,
    type CompanyDeleteParams as CompanyDeleteParams,
    type CompanyPriceTableQueryParams as CompanyPriceTableQueryParams,
    type CompanyPriceTableCompanyUpdateParams as CompanyPriceTableCompanyUpdateParams,
    type CompanyPriceTableItemUpdateParams as CompanyPriceTableItemUpdateParams,
    type CompanyPriceTableApplyAllParams as CompanyPriceTableApplyAllParams,
  };
}
