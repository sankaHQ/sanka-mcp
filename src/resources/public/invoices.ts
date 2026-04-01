// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Invoices extends APIResource {
  /**
   * Create Invoice
   */
  create(body: InvoiceCreateParams, options?: RequestOptions): APIPromise<Invoice> {
    return this._client.post('/v1/public/invoices', { body, ...options });
  }

  /**
   * Get Invoice
   */
  retrieve(
    invoiceID: string,
    params: InvoiceRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InvoiceSchema> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get(path`/v1/public/invoices/${invoiceID}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Invoice
   */
  update(invoiceID: string, body: InvoiceUpdateParams, options?: RequestOptions): APIPromise<Invoice> {
    return this._client.put(path`/v1/public/invoices/${invoiceID}`, { body, ...options });
  }

  /**
   * List Invoices
   */
  list(
    params: InvoiceListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InvoiceListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/invoices', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Invoice
   */
  delete(
    invoiceID: string,
    params: InvoiceDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Invoice> {
    const { external_id } = params ?? {};
    return this._client.delete(path`/v1/public/invoices/${invoiceID}`, {
      query: { external_id },
      ...options,
    });
  }
}

export interface Invoice {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  external_id?: string | null;

  invoice_id?: string | null;
}

export interface InvoiceRequest {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  notes?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface InvoiceSchema {
  created_at: string;

  updated_at: string;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  due_date?: string | null;

  id_inv?: number | null;

  start_date?: string | null;

  status?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export type InvoiceListResponse = Array<InvoiceSchema>;

export interface InvoiceCreateParams {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  notes?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface InvoiceRetrieveParams {
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

export interface InvoiceUpdateParams {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  notes?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface InvoiceListParams {
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

export interface InvoiceDeleteParams {
  external_id?: string | null;
}

export declare namespace Invoices {
  export {
    type Invoice as Invoice,
    type InvoiceRequest as InvoiceRequest,
    type InvoiceSchema as InvoiceSchema,
    type InvoiceListResponse as InvoiceListResponse,
    type InvoiceCreateParams as InvoiceCreateParams,
    type InvoiceRetrieveParams as InvoiceRetrieveParams,
    type InvoiceUpdateParams as InvoiceUpdateParams,
    type InvoiceListParams as InvoiceListParams,
    type InvoiceDeleteParams as InvoiceDeleteParams,
  };
}
