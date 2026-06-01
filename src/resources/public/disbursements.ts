// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
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

const disbursementFromV2Record = (record: V2ObjectRecord): Disbursement =>
  legacyObjectRecordFromV2<Disbursement>(record, 'id_dsb');

const disbursementMutationProperties = (
  body: DisbursementCreateParams | DisbursementUpdateParams,
): Record<string, unknown> => {
  const {
    company_external_id: _companyExternalID,
    company_id,
    contact_external_id: _contactExternalID,
    contact_id,
    currency,
    external_id: _externalID,
    fee,
    notes,
    start_date,
    status,
    tax_inclusive: _taxInclusive,
    tax_option: _taxOption,
    tax_rate,
    total_price,
    total_price_without_tax,
  } = body;
  void _companyExternalID;
  void _contactExternalID;
  void _externalID;
  void _taxInclusive;
  void _taxOption;
  return compactProperties({
    company_id,
    contact_id,
    currency,
    fee,
    notes,
    start_date,
    status,
    tax_rate,
    total_price,
    total_price_without_tax,
  });
};

export class Disbursements extends APIResource {
  /**
   * Create Disbursement
   */
  create(body: DisbursementCreateParams, options?: RequestOptions): APIPromise<PublicDisbursementResponse> {
    return this._client
      .v2Post<V2ObjectRecord>('/disbursements', {
        body: { properties: disbursementMutationProperties(body) },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<PublicDisbursementResponse>(
          envelope,
          'disbursement_id',
          'created',
          body.external_id,
        ),
      );
  }

  /**
   * Get Disbursement
   */
  retrieve(
    disbursementID: string,
    params: DisbursementRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Disbursement> {
    const { 'Accept-Language': acceptLanguage, lang, language, ...query } = params ?? {};
    void lang;
    void language;
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/disbursements/${disbursementID}`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      disbursementFromV2Record,
    );
  }

  /**
   * Update Disbursement
   */
  update(
    disbursementID: string,
    body: DisbursementUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PublicDisbursementResponse> {
    const { external_id } = body;
    return this._client
      .v2Patch<V2ObjectRecord>(path`/disbursements/${disbursementID}`, {
        query: { external_id },
        body: { properties: disbursementMutationProperties(body) },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<PublicDisbursementResponse>(
          envelope,
          'disbursement_id',
          'updated',
          external_id,
        ),
      );
  }

  /**
   * List Disbursements
   */
  list(
    params: DisbursementListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<DisbursementListResponse> {
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
      this._client.v2Get<V2ObjectRecordList>('/disbursements', {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      disbursementFromV2Record,
    );
  }

  /**
   * Delete Disbursement
   */
  delete(
    disbursementID: string,
    params: DisbursementDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicDisbursementResponse> {
    const { external_id } = params ?? {};
    return this._client
      .v2Delete<V2LifecycleData>(path`/disbursements/${disbursementID}`, {
        query: { external_id },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyDeleteResponseFromV2<PublicDisbursementResponse>(envelope, 'disbursement_id', external_id),
      );
  }
}

export interface Disbursement {
  created_at: string;

  updated_at: string;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  id_dsb?: number | null;

  start_date?: string | null;

  status?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface PublicDisbursementRequest {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  external_id?: string | null;

  fee?: number | null;

  notes?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface PublicDisbursementResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  disbursement_id?: string | null;

  external_id?: string | null;
}

export type DisbursementListResponse = Array<Disbursement>;

export interface DisbursementCreateParams {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  external_id?: string | null;

  fee?: number | null;

  notes?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface DisbursementRetrieveParams {
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

export interface DisbursementUpdateParams {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  external_id?: string | null;

  fee?: number | null;

  notes?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface DisbursementListParams {
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

export interface DisbursementDeleteParams {
  external_id?: string | null;
}

export declare namespace Disbursements {
  export {
    type Disbursement as Disbursement,
    type PublicDisbursementRequest as PublicDisbursementRequest,
    type PublicDisbursementResponse as PublicDisbursementResponse,
    type DisbursementListResponse as DisbursementListResponse,
    type DisbursementCreateParams as DisbursementCreateParams,
    type DisbursementRetrieveParams as DisbursementRetrieveParams,
    type DisbursementUpdateParams as DisbursementUpdateParams,
    type DisbursementListParams as DisbursementListParams,
    type DisbursementDeleteParams as DisbursementDeleteParams,
  };
}
