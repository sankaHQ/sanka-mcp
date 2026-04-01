// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Bills extends APIResource {
  /**
   * Create Bill
   */
  create(body: BillCreateParams, options?: RequestOptions): APIPromise<PublicBillResponse> {
    return this._client.post('/v1/public/bills', { body, ...options });
  }

  /**
   * Get Bill
   */
  retrieve(
    billID: string,
    params: BillRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Bill> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get(path`/v1/public/bills/${billID}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Bill
   */
  update(billID: string, body: BillUpdateParams, options?: RequestOptions): APIPromise<PublicBillResponse> {
    return this._client.put(path`/v1/public/bills/${billID}`, { body, ...options });
  }

  /**
   * List Bills
   */
  list(
    params: BillListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BillListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/bills', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Bill
   */
  delete(
    billID: string,
    params: BillDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicBillResponse> {
    const { external_id } = params ?? {};
    return this._client.delete(path`/v1/public/bills/${billID}`, { query: { external_id }, ...options });
  }
}

export interface Bill {
  created_at: string;

  amount?: number | null;

  amount_without_tax?: number | null;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  due_date?: string | null;

  id_bill?: number | null;

  issued_date?: string | null;

  payment_date?: string | null;

  status?: string | null;

  updated_at?: string | null;
}

export interface PublicBillRequest {
  amount?: number | null;

  amount_without_tax?: number | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  description?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  issued_date?: string | null;

  notes?: string | null;

  payment_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;
}

export interface PublicBillResponse {
  ok: boolean;

  status: string;

  bill_id?: string | null;

  ctx_id?: string | null;

  external_id?: string | null;
}

export type BillListResponse = Array<Bill>;

export interface BillCreateParams {
  amount?: number | null;

  amount_without_tax?: number | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  description?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  issued_date?: string | null;

  notes?: string | null;

  payment_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;
}

export interface BillRetrieveParams {
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

export interface BillUpdateParams {
  amount?: number | null;

  amount_without_tax?: number | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  description?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  issued_date?: string | null;

  notes?: string | null;

  payment_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;
}

export interface BillListParams {
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

export interface BillDeleteParams {
  external_id?: string | null;
}

export declare namespace Bills {
  export {
    type Bill as Bill,
    type PublicBillRequest as PublicBillRequest,
    type PublicBillResponse as PublicBillResponse,
    type BillListResponse as BillListResponse,
    type BillCreateParams as BillCreateParams,
    type BillRetrieveParams as BillRetrieveParams,
    type BillUpdateParams as BillUpdateParams,
    type BillListParams as BillListParams,
    type BillDeleteParams as BillDeleteParams,
  };
}
