// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Payments extends APIResource {
  /**
   * Create Payment
   */
  create(body: PaymentCreateParams, options?: RequestOptions): APIPromise<PaymentResponse> {
    return this._client.post('/v1/public/payments', { body, ...options });
  }

  /**
   * Get Payment
   */
  retrieve(
    paymentID: string,
    params: PaymentRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Receipt> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get(path`/v1/public/payments/${paymentID}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Payment
   */
  update(
    paymentID: string,
    params: PaymentUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PaymentResponse> {
    const { external_id, ...body } = params;
    return this._client.put(path`/v1/public/payments/${paymentID}`, {
      query: { external_id },
      body,
      ...options,
    });
  }

  /**
   * List Payments
   */
  list(
    params: PaymentListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PaymentListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/payments', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Payment
   */
  delete(
    paymentID: string,
    params: PaymentDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PaymentResponse> {
    const { external_id } = params ?? {};
    return this._client.delete(path`/v1/public/payments/${paymentID}`, {
      query: { external_id },
      ...options,
    });
  }
}

export interface PaymentRequest {
  companyExternalId?: string | null;

  companyId?: string | null;

  contactExternalId?: string | null;

  contactId?: string | null;

  currency?: string | null;

  entryType?: string | null;

  externalId?: string | null;

  notes?: string | null;

  startDate?: string | null;

  status?: string | null;

  totalPrice?: number | null;

  totalPriceWithoutTax?: number | null;
}

export interface PaymentResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  external_id?: string | null;

  payment_id?: string | null;
}

export interface Receipt {
  created_at: string;

  updated_at: string;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  entry_type?: string | null;

  id_rcp?: number | null;

  start_date?: string | null;

  status?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export type PaymentListResponse = Array<Receipt>;

export interface PaymentCreateParams {
  companyExternalId?: string | null;

  companyId?: string | null;

  contactExternalId?: string | null;

  contactId?: string | null;

  currency?: string | null;

  entryType?: string | null;

  externalId?: string | null;

  notes?: string | null;

  startDate?: string | null;

  status?: string | null;

  totalPrice?: number | null;

  totalPriceWithoutTax?: number | null;
}

export interface PaymentRetrieveParams {
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

export interface PaymentUpdateParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Body param
   */
  companyExternalId?: string | null;

  /**
   * Body param
   */
  companyId?: string | null;

  /**
   * Body param
   */
  contactExternalId?: string | null;

  /**
   * Body param
   */
  contactId?: string | null;

  /**
   * Body param
   */
  currency?: string | null;

  /**
   * Body param
   */
  entryType?: string | null;

  /**
   * Body param
   */
  externalId?: string | null;

  /**
   * Body param
   */
  notes?: string | null;

  /**
   * Body param
   */
  startDate?: string | null;

  /**
   * Body param
   */
  status?: string | null;

  /**
   * Body param
   */
  totalPrice?: number | null;

  /**
   * Body param
   */
  totalPriceWithoutTax?: number | null;
}

export interface PaymentListParams {
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

export interface PaymentDeleteParams {
  external_id?: string | null;
}

export declare namespace Payments {
  export {
    type PaymentRequest as PaymentRequest,
    type PaymentResponse as PaymentResponse,
    type Receipt as Receipt,
    type PaymentListResponse as PaymentListResponse,
    type PaymentCreateParams as PaymentCreateParams,
    type PaymentRetrieveParams as PaymentRetrieveParams,
    type PaymentUpdateParams as PaymentUpdateParams,
    type PaymentListParams as PaymentListParams,
    type PaymentDeleteParams as PaymentDeleteParams,
  };
}
