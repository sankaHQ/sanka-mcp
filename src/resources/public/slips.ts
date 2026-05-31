// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { V2PdfData, buildV2PdfRequest, unwrapV2PdfResponse } from '../../internal/v2';
import {
  V2LifecycleData,
  V2ObjectRecord,
  V2ObjectRecordList,
  compactProperties,
  legacyDeleteResponseFromV2,
  legacyMutationResponseFromV2,
  legacyObjectRecordFromV2,
  unwrapV2ObjectRecord,
  unwrapV2ObjectRecordArray,
} from '../../internal/v2-object-records';
import { PublicLineItem } from './line-items';

const slipFromV2Record = (record: V2ObjectRecord): Slip => legacyObjectRecordFromV2<Slip>(record, 'id_slip');

const canUseV2SlipUpdate = (body: SlipUpdateParams): boolean =>
  body.company_external_id == null &&
  body.contact_external_id == null &&
  body.tax_inclusive == null &&
  body.tax_option == null &&
  body.tax_rate == null;

const slipUpdateProperties = (body: SlipUpdateParams): Record<string, unknown> => {
  const {
    company_external_id: _companyExternalID,
    company_id,
    contact_external_id: _contactExternalID,
    contact_id,
    currency,
    external_id: _externalID,
    notes,
    slip_type,
    start_date,
    status,
    tax_inclusive: _taxInclusive,
    tax_option: _taxOption,
    tax_rate: _taxRate,
    total_price,
    total_price_without_tax,
  } = body;
  void _companyExternalID;
  void _contactExternalID;
  void _externalID;
  void _taxInclusive;
  void _taxOption;
  void _taxRate;
  return compactProperties({
    company_id,
    contact_id,
    currency,
    notes,
    revenue_mode: slip_type,
    start_date,
    status,
    total_price,
    total_price_without_tax,
  });
};

export class Slips extends APIResource {
  /**
   * Create Slip
   */
  create(body: SlipCreateParams, options?: RequestOptions): APIPromise<SlipResponse> {
    return this._client.post('/v1/public/slips', { body, ...options });
  }

  /**
   * Get Slip
   */
  retrieve(
    slipID: string,
    params: SlipRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Slip> {
    const { 'Accept-Language': acceptLanguage, lang, language, ...query } = params ?? {};
    void lang;
    void language;
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/revenues/${slipID}`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      slipFromV2Record,
    );
  }

  /**
   * Update Slip
   */
  update(slipID: string, body: SlipUpdateParams, options?: RequestOptions): APIPromise<SlipResponse> {
    const { external_id } = body;
    if (canUseV2SlipUpdate(body)) {
      return this._client
        .v2Patch<V2ObjectRecord>(path`/revenues/${slipID}`, {
          query: { external_id },
          body: { properties: slipUpdateProperties(body) },
          ...options,
        })
        ._thenUnwrap((envelope) =>
          legacyMutationResponseFromV2<SlipResponse>(envelope, 'slip_id', 'updated', external_id),
        );
    }
    return this._client.put(path`/v1/public/slips/${slipID}`, { body, ...options });
  }

  /**
   * List Slips
   */
  list(
    params: SlipListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<SlipListResponse> {
    const {
      'Accept-Language': acceptLanguage,
      lang,
      language,
      workspace_id: _workspaceID,
      ...query
    } = params ?? {};
    void lang;
    void language;
    void _workspaceID;
    return unwrapV2ObjectRecordArray(
      this._client.v2Get<V2ObjectRecordList>('/revenues', {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      slipFromV2Record,
    );
  }

  /**
   * Delete Slip
   */
  delete(
    slipID: string,
    params: SlipDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<SlipResponse> {
    const { external_id } = params ?? {};
    return this._client
      .v2Delete<V2LifecycleData>(path`/revenues/${slipID}`, { query: { external_id }, ...options })
      ._thenUnwrap((envelope) => legacyDeleteResponseFromV2<SlipResponse>(envelope, 'slip_id', external_id));
  }

  /**
   * Download Slip PDF
   */
  downloadPDF(
    slipID: string,
    params: SlipDownloadPDFParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Response> {
    const { acceptLanguage, externalID, query } = buildV2PdfRequest(params);
    if (externalID != null) {
      const { 'Accept-Language': v1AcceptLanguage, ...v1Query } = params ?? {};
      return this._client.get(path`/v1/public/slips/${slipID}/pdf`, {
        query: v1Query,
        ...options,
        __binaryResponse: true,
        headers: buildHeaders([
          { ...(v1AcceptLanguage != null ? { 'Accept-Language': v1AcceptLanguage } : undefined) },
          options?.headers,
        ]),
      }) as APIPromise<Response>;
    }
    return unwrapV2PdfResponse(
      this._client.v2Get<V2PdfData>(path`/revenues/${slipID}/pdf`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
    );
  }
}

export interface Slip {
  created_at: string;

  updated_at: string;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  due_date?: string | null;

  id_slip?: number | null;

  line_items?: Array<PublicLineItem>;

  slip_type?: string | null;

  start_date?: string | null;

  status?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface SlipRequest {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  external_id?: string | null;

  notes?: string | null;

  slip_type?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface SlipResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  external_id?: string | null;

  slip_id?: string | null;
}

export type SlipListResponse = Array<Slip>;

export interface SlipCreateParams {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  external_id?: string | null;

  notes?: string | null;

  slip_type?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface SlipRetrieveParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Query param
   */
  lang?: string | null;

  /**
   * Query param
   */
  language?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface SlipDownloadPDFParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Query param
   */
  template_select?: string | null;

  /**
   * Query param
   */
  lang?: string | null;

  /**
   * Query param
   */
  language?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface SlipUpdateParams {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  external_id?: string | null;

  notes?: string | null;

  slip_type?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface SlipListParams {
  /**
   * Query param
   */
  lang?: string | null;

  /**
   * Query param
   */
  language?: string | null;

  /**
   * Query param
   */
  workspace_id?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface SlipDeleteParams {
  external_id?: string | null;
}

export declare namespace Slips {
  export {
    type Slip as Slip,
    type SlipRequest as SlipRequest,
    type SlipResponse as SlipResponse,
    type SlipListResponse as SlipListResponse,
    type SlipCreateParams as SlipCreateParams,
    type SlipRetrieveParams as SlipRetrieveParams,
    type SlipUpdateParams as SlipUpdateParams,
    type SlipListParams as SlipListParams,
    type SlipDeleteParams as SlipDeleteParams,
  };
}
