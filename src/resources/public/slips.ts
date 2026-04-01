// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

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
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get(path`/v1/public/slips/${slipID}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Slip
   */
  update(slipID: string, body: SlipUpdateParams, options?: RequestOptions): APIPromise<SlipResponse> {
    return this._client.put(path`/v1/public/slips/${slipID}`, { body, ...options });
  }

  /**
   * List Slips
   */
  list(
    params: SlipListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<SlipListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/slips', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
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
    return this._client.delete(path`/v1/public/slips/${slipID}`, { query: { external_id }, ...options });
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
