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

const paymentFromV2Record = (record: V2ObjectRecord): Receipt =>
  legacyObjectRecordFromV2<Receipt>(record, 'id_rcp');

const paymentMutationProperties = (params: PaymentCreateParams | PaymentUpdateParams): Record<string, unknown> => {
  const {
    companyExternalId: _companyExternalID,
    companyId,
    contactExternalId: _contactExternalID,
    contactId,
    currency,
    entryType,
    externalId: _bodyExternalID,
    notes,
    startDate,
    status,
    totalPrice,
    totalPriceWithoutTax,
  } = params;
  const _externalID = 'external_id' in params ? params.external_id : undefined;
  void _externalID;
  void _companyExternalID;
  void _contactExternalID;
  void _bodyExternalID;
  return compactProperties({
    company_id: companyId,
    contact_id: contactId,
    currency,
    entry_type: entryType,
    notes,
    start_date: startDate,
    status,
    total_price: totalPrice,
    total_price_without_tax: totalPriceWithoutTax,
  });
};

export class Payments extends APIResource {
  /**
   * Create Payment
   */
  create(body: PaymentCreateParams, options?: RequestOptions): APIPromise<PaymentResponse> {
    return this._client
      .v2Post<V2ObjectRecord>('/payments', { body: { properties: paymentMutationProperties(body) }, ...options })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<PaymentResponse>(envelope, 'payment_id', 'created', body.externalId),
      );
  }

  /**
   * Get Payment
   */
  retrieve(
    paymentID: string,
    params: PaymentRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Receipt> {
    const { 'Accept-Language': acceptLanguage, lang, language, ...query } = params ?? {};
    void lang;
    void language;
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/payments/${paymentID}`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      paymentFromV2Record,
    );
  }

  /**
   * List Payment Allocations
   */
  listAllocations(
    paymentID: string,
    params: PaymentListAllocationsParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PaymentAllocationsResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get(path`/v1/public/payments/${paymentID}/allocations`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Payment Allocations
   */
  updateAllocations(
    paymentID: string,
    params: PaymentUpdateAllocationsParams,
    options?: RequestOptions,
  ): APIPromise<PaymentAllocationsResponse> {
    const { external_id, lang, language, 'Accept-Language': acceptLanguage, allocations } = params;
    return this._client.put(path`/v1/public/payments/${paymentID}/allocations`, {
      query: { external_id, lang, language },
      body: { allocations },
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
    const { external_id } = params;
    return this._client
      .v2Patch<V2ObjectRecord>(path`/payments/${paymentID}`, {
        query: { external_id },
        body: { properties: paymentMutationProperties(params) },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<PaymentResponse>(envelope, 'payment_id', 'updated', external_id),
      );
  }

  /**
   * List Payments
   */
  list(
    params: PaymentListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PaymentListResponse> {
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
      this._client.v2Get<V2ObjectRecordList>('/payments', {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      paymentFromV2Record,
    );
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
    return this._client
      .v2Delete<V2LifecycleData>(path`/payments/${paymentID}`, { query: { external_id }, ...options })
      ._thenUnwrap((envelope) =>
        legacyDeleteResponseFromV2<PaymentResponse>(envelope, 'payment_id', external_id),
      );
  }

  /**
   * Download Payment PDF
   */
  downloadPDF(
    paymentID: string,
    params: PaymentDownloadPDFParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Response> {
    const { acceptLanguage, query } = buildV2PdfRequest(params);
    return unwrapV2PdfResponse(
      this._client.v2Get<V2PdfData>(path`/payments/${paymentID}/pdf`, {
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

  line_items?: Array<PublicLineItem>;

  start_date?: string | null;

  status?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export type PaymentListResponse = Array<Receipt>;

export interface PaymentAllocationInput {
  invoice_id: string;

  amount: number;

  adjustment_amount?: number | null;

  adjustment_type?: string | null;

  currency?: string | null;

  source?: string | null;

  notes?: string | null;
}

export interface PaymentAllocationsResponse {
  message: string;

  payment?: Record<string, unknown> | null;

  invoice?: Record<string, unknown> | null;

  allocations?: Array<Record<string, unknown>>;

  adjustments?: Array<Record<string, unknown>>;

  adjustment_total?: number;

  available_invoices?: Array<Record<string, unknown>>;

  ctx_id?: string | null;
}

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

export interface PaymentListAllocationsParams {
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

export interface PaymentUpdateAllocationsParams {
  /**
   * Body param
   */
  allocations: Array<PaymentAllocationInput>;

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

export interface PaymentDownloadPDFParams {
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
    type PaymentAllocationInput as PaymentAllocationInput,
    type PaymentAllocationsResponse as PaymentAllocationsResponse,
    type PaymentCreateParams as PaymentCreateParams,
    type PaymentRetrieveParams as PaymentRetrieveParams,
    type PaymentListAllocationsParams as PaymentListAllocationsParams,
    type PaymentUpdateAllocationsParams as PaymentUpdateAllocationsParams,
    type PaymentUpdateParams as PaymentUpdateParams,
    type PaymentListParams as PaymentListParams,
    type PaymentDeleteParams as PaymentDeleteParams,
  };
}
