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

const subscriptionLineItemsForV2 = (
  params: SubscriptionCreateParams | SubscriptionUpdateParams,
): Array<Record<string, unknown>> | undefined => {
  const source =
    'line_items' in params && params.line_items != null ? params.line_items
    : 'items' in params ? params.items
    : undefined;
  const lineItems = (source ?? []).map((item) =>
    compactProperties({
      line_item_id: item.line_item_id ?? item.id,
      item_id: item.item_id ?? item.item,
      item_external_id: item.item_external_id,
      custom_item_name: item.custom_item_name ?? item.item_name ?? item.itemName ?? item.name,
      quantity: item.quantity ?? item.qty ?? item.amount_item ?? item.amount,
      unit_price: item.unit_price ?? item.unitPrice ?? item.amount_price ?? item.price,
      tax_rate: item.tax_rate,
      currency: item.currency,
      total_price: item.total_price,
      total_price_without_tax: item.total_price_without_tax,
      custom_fields: item.line_item_properties,
    }),
  );
  return lineItems.length > 0 ? lineItems : undefined;
};

const subscriptionMutationProperties = (
  params: SubscriptionCreateParams | SubscriptionUpdateParams,
): Record<string, unknown> => {
  const lineItems = subscriptionLineItemsForV2(params);
  const item = lineItems?.[0] as Record<string, unknown> | undefined;
  const mutationParams = params as Partial<SubscriptionCreateParams & SubscriptionUpdateParams>;
  const contactID =
    mutationParams.contact_id ?? mutationParams.cid ?? mutationParams.customer_id ?? mutationParams.contact;
  const companyID = mutationParams.company_id ?? mutationParams.customer_id;
  const status = 'subscription_status' in params ? params.subscription_status : params.status;
  return compactProperties({
    status,
    contact_id: companyID ? undefined : contactID,
    company_id: companyID,
    owner_id: 'owner_id' in params ? params.owner_id : undefined,
    item_id: ('item_id' in params ? params.item_id : undefined) ?? item?.['item_id'],
    item_variant_id: 'item_variant_id' in params ? params.item_variant_id : undefined,
    channel_id: 'channel_id' in params ? params.channel_id : undefined,
    platform_display_name: 'platform_display_name' in params ? params.platform_display_name : undefined,
    currency: 'currency' in params ? params.currency : undefined,
    frequency: 'frequency' in params ? params.frequency : undefined,
    frequency_time: 'frequency_time' in params ? params.frequency_time : undefined,
    prior_to_next: 'prior_to_next' in params ? params.prior_to_next : undefined,
    prior_to_time: 'prior_to_time' in params ? params.prior_to_time : undefined,
    billing_timing: 'billing_timing' in params ? params.billing_timing : undefined,
    billing_anchor: 'billing_anchor' in params ? params.billing_anchor : undefined,
    charge_method: 'charge_method' in params ? params.charge_method : undefined,
    payment_term_type: 'payment_term_type' in params ? params.payment_term_type : undefined,
    payment_term_days: 'payment_term_days' in params ? params.payment_term_days : undefined,
    payment_term_closing_day:
      'payment_term_closing_day' in params ? params.payment_term_closing_day : undefined,
    payment_term_offset_months:
      'payment_term_offset_months' in params ? params.payment_term_offset_months : undefined,
    payment_term_payment_day:
      'payment_term_payment_day' in params ? params.payment_term_payment_day : undefined,
    auto_gen_invoice: 'auto_gen_invoice' in params ? params.auto_gen_invoice : undefined,
    auto_gen_invoice_statuses:
      'auto_gen_invoice_statuses' in params ? params.auto_gen_invoice_statuses : undefined,
    upcoming_invoice_date: 'upcoming_invoice_date' in params ? params.upcoming_invoice_date : undefined,
    auto_invoice_start_policy:
      'auto_invoice_start_policy' in params ? params.auto_invoice_start_policy : undefined,
    auto_invoice_start_date: 'auto_invoice_start_date' in params ? params.auto_invoice_start_date : undefined,
    number_item: ('number_item' in params ? params.number_item : undefined) ?? item?.['quantity'],
    shipping_cost_tax_status:
      'shipping_cost_tax_status' in params ? params.shipping_cost_tax_status : undefined,
    shipping_cost_id: 'shipping_cost_id' in params ? params.shipping_cost_id : undefined,
    start_date: 'start_date' in params ? params.start_date : undefined,
    end_date: 'end_date' in params ? params.end_date : undefined,
    tax: 'tax' in params ? params.tax : undefined,
    tax_rate: 'tax_rate' in params ? params.tax_rate : undefined,
    tax_applied_to: 'tax_applied_to' in params ? params.tax_applied_to : undefined,
    discount_id: 'discount_id' in params ? params.discount_id : undefined,
    discount_value: 'discount_value' in params ? params.discount_value : undefined,
    discount_number_format: 'discount_number_format' in params ? params.discount_number_format : undefined,
    discount_tax_option: 'discount_tax_option' in params ? params.discount_tax_option : undefined,
    discount_mode: 'discount_mode' in params ? params.discount_mode : undefined,
    clear_discount: 'clear_discount' in params ? params.clear_discount : undefined,
    quick_entry_mode: 'quick_entry_mode' in params ? params.quick_entry_mode : undefined,
    custom_fields: 'custom_fields' in params ? params.custom_fields : undefined,
    line_items: lineItems,
    total_price: ('total_price' in params ? params.total_price : undefined) ?? item?.['total_price'],
    total_price_without_tax:
      ('total_price_without_tax' in params ? params.total_price_without_tax : undefined) ??
      item?.['total_price_without_tax'],
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

  discount_value?: number | null;

  discount_number_format?: string | null;

  discount_mode?: string | null;

  clear_discount?: boolean | null;

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

  line_item_id?: string | null;

  custom_item_name?: string | null;

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

  currency?: string | null;

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

  end_date?: string | null;

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
  contact_id?: string | null;

  /**
   * Body param
   */
  company_id?: string | null;

  /**
   * Body param
   */
  customer_id?: string | null;

  /**
   * Body param
   */
  owner_id?: string | null;

  /**
   * Body param
   */
  item_id?: string | null;

  /**
   * Body param
   */
  item_variant_id?: string | null;

  /**
   * Body param
   */
  channel_id?: string | null;

  /**
   * Body param
   */
  platform_display_name?: string | null;

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
  start_date?: string | null;

  /**
   * Body param
   */
  end_date?: string | null;

  /**
   * Body param
   */
  subscription_status?: string | null;

  /**
   * Body param
   */
  currency?: string | null;

  /**
   * Body param
   */
  frequency?: number | null;

  /**
   * Body param
   */
  frequency_time?: string | null;

  /**
   * Body param
   */
  prior_to_next?: number | null;

  /**
   * Body param
   */
  prior_to_time?: string | null;

  /**
   * Body param
   */
  billing_timing?: string | null;

  /**
   * Body param
   */
  billing_anchor?: string | null;

  /**
   * Body param
   */
  charge_method?: string | null;

  /**
   * Body param
   */
  payment_term_type?: string | null;

  /**
   * Body param
   */
  payment_term_days?: number | null;

  /**
   * Body param
   */
  payment_term_closing_day?: number | null;

  /**
   * Body param
   */
  payment_term_offset_months?: number | null;

  /**
   * Body param
   */
  payment_term_payment_day?: number | null;

  /**
   * Body param
   */
  auto_gen_invoice?: boolean | null;

  /**
   * Body param
   */
  auto_gen_invoice_statuses?: string | null;

  /**
   * Body param
   */
  upcoming_invoice_date?: string | null;

  /**
   * Body param
   */
  auto_invoice_start_policy?: string | null;

  /**
   * Body param
   */
  auto_invoice_start_date?: string | null;

  /**
   * Body param
   */
  number_item?: number | null;

  /**
   * Body param
   */
  shipping_cost_tax_status?: string | null;

  /**
   * Body param
   */
  shipping_cost_id?: string | null;

  /**
   * Body param
   */
  tax?: number | null;

  /**
   * Body param
   */
  tax_rate?: number | null;

  /**
   * Body param
   */
  tax_applied_to?: string | null;

  /**
   * Body param
   */
  total_price?: number | null;

  /**
   * Body param
   */
  total_price_without_tax?: number | null;

  /**
   * Body param
   */
  status?: string | null;

  /**
   * Body param
   */
  quick_entry_mode?: boolean | null;

  /**
   * Body param
   */
  custom_fields?: Record<string, unknown> | null;
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
