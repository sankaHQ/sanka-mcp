// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Disbursements extends APIResource {
  /**
   * Create Disbursement
   */
  create(body: DisbursementCreateParams, options?: RequestOptions): APIPromise<PublicDisbursementResponse> {
    return this._client.post('/v1/public/disbursements', { body, ...options });
  }

  /**
   * Get Disbursement
   */
  retrieve(
    disbursementID: string,
    params: DisbursementRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Disbursement> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get(path`/v1/public/disbursements/${disbursementID}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Disbursement
   */
  update(
    disbursementID: string,
    body: DisbursementUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PublicDisbursementResponse> {
    return this._client.put(path`/v1/public/disbursements/${disbursementID}`, { body, ...options });
  }

  /**
   * List Disbursements
   */
  list(
    params: DisbursementListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<DisbursementListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/disbursements', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
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
    return this._client.delete(path`/v1/public/disbursements/${disbursementID}`, {
      query: { external_id },
      ...options,
    });
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
