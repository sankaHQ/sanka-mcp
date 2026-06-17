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
  legacyObjectRecordFromV2,
  unwrapV2ObjectRecord,
  unwrapV2ObjectRecordArray,
} from '../../internal/v2-object-records';

const subscriptionFromV2Record = (record: V2ObjectRecord): SubscriptionDetail =>
  legacyObjectRecordFromV2<SubscriptionDetail>(record);

const firstSubscriptionItem = (
  params: SubscriptionCreateParams | SubscriptionUpdateParams,
): SubscriptionItemInput | undefined => {
  const lineItems = 'line_items' in params ? params.line_items : undefined;
  const items = 'items' in params ? params.items : undefined;
  return lineItems?.[0] ?? items?.[0] ?? undefined;
};

const subscriptionMutationProperties = (
  params: SubscriptionCreateParams | SubscriptionUpdateParams,
): Record<string, unknown> => {
  const item = firstSubscriptionItem(params);
  const mutationParams = params as Partial<SubscriptionCreateParams & SubscriptionUpdateParams>;
  const contactID =
    mutationParams.contact_id ?? mutationParams.cid ?? mutationParams.customer_id ?? mutationParams.contact;
  const companyID = mutationParams.company_id ?? mutationParams.customer_id;
  const status = 'subscription_status' in params ? params.subscription_status : params.status;
  return compactProperties({
    status,
    contact_id: companyID ? undefined : contactID,
    company_id: companyID,
    item_id: item?.item_id ?? item?.item ?? item?.id,
    currency: 'currency' in params ? params.currency : undefined,
    frequency: 'frequency' in params ? params.frequency : undefined,
    frequency_time: 'frequency_time' in params ? params.frequency_time : undefined,
    number_item: item?.quantity ?? item?.qty ?? item?.amount_item ?? item?.amount,
    shipping_cost_tax_status:
      'shipping_cost_tax_status' in params ? params.shipping_cost_tax_status : undefined,
    start_date: 'start_date' in params ? params.start_date : undefined,
    tax: 'tax' in params ? params.tax : undefined,
    discount_id: 'discount_id' in params ? params.discount_id : undefined,
    discount_value: 'discount_value' in params ? params.discount_value : undefined,
    discount_number_format: 'discount_number_format' in params ? params.discount_number_format : undefined,
    discount_tax_option: 'discount_tax_option' in params ? params.discount_tax_option : undefined,
    discount_mode: 'discount_mode' in params ? params.discount_mode : undefined,
    clear_discount: 'clear_discount' in params ? params.clear_discount : undefined,
    total_price: ('total_price' in params ? params.total_price : undefined) ?? item?.total_price,
    total_price_without_tax:
      ('total_price_without_tax' in params ? params.total_price_without_tax : undefined) ??
      item?.total_price_without_tax,
  });
};

export class Subscriptions extends APIResource {
  /**
   * Create Subscription
   */
  create(body: SubscriptionCreateParams, options?: RequestOptions): APIPromise<SubscriptionDetail> {
    return unwrapV2ObjectRecord(
      this._client.v2Post<V2ObjectRecord>('/subscriptions', {
        body: { properties: subscriptionMutationProperties(body) },
        ...options,
      }),
      subscriptionFromV2Record,
    );
  }

  /**
   * Get Subscription
   */
  retrieve(
    subscriptionID: string,
    query: SubscriptionRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<SubscriptionDetail> {
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/subscriptions/${subscriptionID}`, { query, ...options }),
      subscriptionFromV2Record,
    );
  }

  /**
   * Update Subscription
   */
  update(
    subscriptionID: string,
    params: SubscriptionUpdateParams,
    options?: RequestOptions,
  ): APIPromise<SubscriptionDetail> {
    const { external_id } = params;
    return unwrapV2ObjectRecord(
      this._client.v2Patch<V2ObjectRecord>(path`/subscriptions/${subscriptionID}`, {
        query: { external_id },
        body: { properties: subscriptionMutationProperties(params) },
        ...options,
      }),
      subscriptionFromV2Record,
    );
  }

  /**
   * List Subscriptions
   */
  list(
    params: SubscriptionListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<SubscriptionListResponse> {
    const { 'Accept-Language': acceptLanguage, workspace_id: _workspaceID, ...query } = params ?? {};
    void _workspaceID;
    return unwrapV2ObjectRecordArray(
      this._client.v2Get<V2ObjectRecordList>('/subscriptions', {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      subscriptionFromV2Record,
    );
  }

  /**
   * Delete Subscription
   */
  delete(
    subscriptionID: string,
    params: SubscriptionDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<SubscriptionDeleteResponse> {
    const { external_id } = params ?? {};
    return this._client
      .v2Delete<V2LifecycleData>(path`/subscriptions/${subscriptionID}`, {
        query: { external_id },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyDeleteResponseFromV2<SubscriptionDeleteResponse>(envelope, 'subscription_id', external_id),
      );
  }
}

export interface SubscriptionDetail {
  id: string;

  contact_info: Array<SubscriptionDetail.ContactInfo>;

  created_at: string;

  items: Array<SubscriptionDetail.Item>;

  line_items?: Array<SubscriptionDetail.LineItem> | null;

  number_item: number;

  currency?: string | null;

  discount?: number | null;

  discount_id?: string | null;

  discount_option?: string | null;

  discount_tax_option?: string | null;

  frequency?: number | null;

  frequency_time?: string | null;

  prior_to_time?: string | null;

  shipping_cost_tax_status?: string | null;

  start_date?: string | null;

  status?: string | null;

  subscription_status?: string | null;

  tax?: number | null;

  total_price?: number | null;
}

export namespace SubscriptionDetail {
  export interface ContactInfo {
    id: string;

    email?: string | null;

    name?: string | null;

    phone?: string | null;
  }

  export interface Item {
    id?: string | null;

    item_id?: string | null;

    line_item_id?: string | null;

    amount: number;

    name?: string | null;

    price?: number | null;

    status?: string | null;
  }

  export interface LineItem {
    id?: string | null;

    item_id?: string | null;

    item_name?: string | null;

    name?: string | null;

    quantity?: number | null;

    unit_price?: number | null;

    price?: number | null;

    amount_item?: number | null;

    amount_price?: number | null;

    total_price?: number | null;

    total_price_without_tax?: number | null;

    currency?: string | null;

    status?: string | null;
  }
}

export interface SubscriptionItemInput {
  id?: string | null;

  item?: string | null;

  item_id?: string | null;

  item_external_id?: string | null;

  amount?: number | null;

  amount_item?: number | null;

  quantity?: number | null;

  qty?: number | null;

  name?: string | null;

  item_name?: string | null;

  itemName?: string | null;

  amount_price?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;

  price?: number | null;

  unit_price?: number | null;

  unitPrice?: number | null;

  tax_rate?: number | null;

  line_item_properties?: Record<string, unknown> | null;
}

export type SubscriptionListResponse = Array<SubscriptionDetail>;

export interface SubscriptionDeleteResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  external_id?: string | null;

  subscription_id?: string | null;
}

export interface SubscriptionCreateParams {
  cid?: string | null;

  contact_id?: string | null;

  company_id?: string | null;

  customer_id?: string | null;

  items: Array<SubscriptionItemInput>;

  line_items?: Array<SubscriptionItemInput> | null;

  subscription_status: string;

  currency?: string | null;

  discount_id?: string | null;

  discount_value?: number | null;

  discount_number_format?: string | null;

  discount_tax_option?: 'pre_tax' | 'post_tax' | string | null;

  discount_mode?: 'free_writing_discounts' | 'registered_discounts' | string | null;

  clear_discount?: boolean | null;

  frequency?: number | null;

  frequency_time?: string | null;

  shipping_cost_tax_status?: string | null;

  start_date?: string | null;

  tax?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface SubscriptionRetrieveParams {
  external_id?: string | null;
}

export interface SubscriptionUpdateParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Body param
   */
  contact?: string | null;

  /**
   * Body param
   */
  items?: Array<SubscriptionItemInput> | null;

  /**
   * Body param
   */
  line_items?: Array<SubscriptionItemInput> | null;

  /**
   * Body param
   */
  discount_id?: string | null;

  /**
   * Body param
   */
  discount_value?: number | null;

  /**
   * Body param
   */
  discount_number_format?: string | null;

  /**
   * Body param
   */
  discount_tax_option?: 'pre_tax' | 'post_tax' | string | null;

  /**
   * Body param
   */
  discount_mode?: 'free_writing_discounts' | 'registered_discounts' | string | null;

  /**
   * Body param
   */
  clear_discount?: boolean | null;

  /**
   * Body param
   */
  status?: string | null;
}

export interface SubscriptionListParams {
  /**
   * Query param
   */
  workspace_id?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface SubscriptionDeleteParams {
  external_id?: string | null;
}

export declare namespace Subscriptions {
  export {
    type SubscriptionDetail as SubscriptionDetail,
    type SubscriptionItemInput as SubscriptionItemInput,
    type SubscriptionListResponse as SubscriptionListResponse,
    type SubscriptionDeleteResponse as SubscriptionDeleteResponse,
    type SubscriptionCreateParams as SubscriptionCreateParams,
    type SubscriptionRetrieveParams as SubscriptionRetrieveParams,
    type SubscriptionUpdateParams as SubscriptionUpdateParams,
    type SubscriptionListParams as SubscriptionListParams,
    type SubscriptionDeleteParams as SubscriptionDeleteParams,
  };
}
