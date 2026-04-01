// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Orders extends APIResource {
  /**
   * Create Orders
   */
  create(body: OrderCreateParams, options?: RequestOptions): APIPromise<BulkOrders> {
    return this._client.post('/v1/public/orders', { body, ...options });
  }

  /**
   * Get Order
   */
  retrieve(
    orderID: string,
    query: OrderRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<OrderRetrieveResponse> {
    return this._client.get(path`/v1/public/orders/${orderID}`, { query, ...options });
  }

  /**
   * Update Order
   */
  update(orderID: string, body: OrderUpdateParams, options?: RequestOptions): APIPromise<BulkOrders> {
    return this._client.put(path`/v1/public/orders/${orderID}`, { body, ...options });
  }

  /**
   * List Orders
   */
  list(
    params: OrderListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<OrderListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/orders', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Order
   */
  delete(
    orderID: string,
    params: OrderDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<OrderDeleteResponse> {
    const { external_id } = params ?? {};
    return this._client.delete(path`/v1/public/orders/${orderID}`, { query: { external_id }, ...options });
  }

  /**
   * Bulk Create Orders
   */
  bulkCreate(body: OrderBulkCreateParams, options?: RequestOptions): APIPromise<BulkOrders> {
    return this._client.post('/v1/public/orders/bulk', { body, ...options });
  }
}

export interface BulkOrder {
  externalId: string;

  items: Array<BulkOrder.Item>;

  companyExternalId?: string | null;

  companyId?: string | null;

  deliveryStatus?: string | null;

  orderAt?: string | null;
}

export namespace BulkOrder {
  export interface Item {
    item_id?: string | null;

    itemExternalId?: string | null;

    price?: number | null;

    quantity?: number;

    tax?: number | null;

    tax_rate?: number | null;
  }
}

export interface BulkOrders {
  ok: boolean;

  ctx_id?: string | null;

  job_id?: string | null;

  results?: Array<BulkOrders.Result> | null;
}

export namespace BulkOrders {
  export interface Result {
    external_id: string;

    status: string;

    errors?: Array<string>;

    order_id?: string | null;
  }
}

export interface Order {
  order: BulkOrder;

  createMissingItems?: boolean;

  triggerWorkflows?: boolean;
}

export interface OrderRetrieveResponse {
  id: string;

  created_at: string;

  order_at: string;

  updated_at: string;

  company_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  delivery_status?: string | null;

  number_item?: number | null;

  order_id?: number | null;

  status?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface OrderListResponse {
  count: number;

  data: Array<{ [key: string]: unknown }>;

  message: string;

  page: number;

  total: number;

  ctx_id?: string | null;
}

export interface OrderDeleteResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  external_id?: string | null;

  order_id?: string | null;
}

export interface OrderCreateParams {
  order: BulkOrder;

  createMissingItems?: boolean;

  triggerWorkflows?: boolean;
}

export interface OrderRetrieveParams {
  external_id?: string | null;
}

export interface OrderUpdateParams {
  order: BulkOrder;

  createMissingItems?: boolean;

  triggerWorkflows?: boolean;
}

export interface OrderListParams {
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

export interface OrderDeleteParams {
  external_id?: string | null;
}

export interface OrderBulkCreateParams {
  orders: Array<BulkOrder>;

  createMissingItems?: boolean;

  triggerWorkflows?: boolean;
}

export declare namespace Orders {
  export {
    type BulkOrder as BulkOrder,
    type BulkOrders as BulkOrders,
    type Order as Order,
    type OrderRetrieveResponse as OrderRetrieveResponse,
    type OrderListResponse as OrderListResponse,
    type OrderDeleteResponse as OrderDeleteResponse,
    type OrderCreateParams as OrderCreateParams,
    type OrderRetrieveParams as OrderRetrieveParams,
    type OrderUpdateParams as OrderUpdateParams,
    type OrderListParams as OrderListParams,
    type OrderDeleteParams as OrderDeleteParams,
    type OrderBulkCreateParams as OrderBulkCreateParams,
  };
}
