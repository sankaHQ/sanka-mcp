// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class PurchaseOrders extends APIResource {
  /**
   * Create Purchase Order
   */
  create(body: PurchaseOrderCreateParams, options?: RequestOptions): APIPromise<PurchaseOrderResponse> {
    return this._client.post('/v1/public/purchase-orders', { body, ...options });
  }

  /**
   * Get Purchase Order
   */
  retrieve(
    purchaseOrderID: string,
    params: PurchaseOrderRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PurchaseOrder> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get(path`/v1/public/purchase-orders/${purchaseOrderID}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Purchase Order
   */
  update(
    purchaseOrderID: string,
    body: PurchaseOrderUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PurchaseOrderResponse> {
    return this._client.put(path`/v1/public/purchase-orders/${purchaseOrderID}`, { body, ...options });
  }

  /**
   * List Purchase Orders
   */
  list(
    params: PurchaseOrderListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PurchaseOrderListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/purchase-orders', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Purchase Order
   */
  delete(
    purchaseOrderID: string,
    params: PurchaseOrderDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PurchaseOrderResponse> {
    const { external_id } = params ?? {};
    return this._client.delete(path`/v1/public/purchase-orders/${purchaseOrderID}`, {
      query: { external_id },
      ...options,
    });
  }
}

export interface PurchaseOrder {
  created_at: string;

  updated_at: string;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  date?: string | null;

  id_po?: number | null;

  status?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface PurchaseOrderRequest {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  date?: string | null;

  external_id?: string | null;

  notes?: string | null;

  status?: string | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface PurchaseOrderResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  external_id?: string | null;

  purchase_order_id?: string | null;
}

export type PurchaseOrderListResponse = Array<PurchaseOrder>;

export interface PurchaseOrderCreateParams {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  date?: string | null;

  external_id?: string | null;

  notes?: string | null;

  status?: string | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface PurchaseOrderRetrieveParams {
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

export interface PurchaseOrderUpdateParams {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  date?: string | null;

  external_id?: string | null;

  notes?: string | null;

  status?: string | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface PurchaseOrderListParams {
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

export interface PurchaseOrderDeleteParams {
  external_id?: string | null;
}

export declare namespace PurchaseOrders {
  export {
    type PurchaseOrder as PurchaseOrder,
    type PurchaseOrderRequest as PurchaseOrderRequest,
    type PurchaseOrderResponse as PurchaseOrderResponse,
    type PurchaseOrderListResponse as PurchaseOrderListResponse,
    type PurchaseOrderCreateParams as PurchaseOrderCreateParams,
    type PurchaseOrderRetrieveParams as PurchaseOrderRetrieveParams,
    type PurchaseOrderUpdateParams as PurchaseOrderUpdateParams,
    type PurchaseOrderListParams as PurchaseOrderListParams,
    type PurchaseOrderDeleteParams as PurchaseOrderDeleteParams,
  };
}
