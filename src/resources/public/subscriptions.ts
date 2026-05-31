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

const subscriptionUpdateProperties = (params: SubscriptionUpdateParams): Record<string, unknown> => {
  const { contact: _contact, external_id: _externalID, items: _items, status } = params;
  void _contact;
  void _externalID;
  void _items;
  return compactProperties({ status });
};

const canUseV2SubscriptionUpdate = (
  params: SubscriptionUpdateParams,
  properties: Record<string, unknown>,
): boolean => params.contact == null && params.items == null && Object.keys(properties).length > 0;

export class Subscriptions extends APIResource {
  /**
   * Create Subscription
   */
  create(body: SubscriptionCreateParams, options?: RequestOptions): APIPromise<SubscriptionDetail> {
    return this._client.post('/v1/public/subscriptions', { body, ...options });
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
    const { external_id, ...body } = params;
    const properties = subscriptionUpdateProperties(params);
    if (canUseV2SubscriptionUpdate(params, properties)) {
      return unwrapV2ObjectRecord(
        this._client.v2Patch<V2ObjectRecord>(path`/subscriptions/${subscriptionID}`, {
          query: { external_id },
          body: { properties },
          ...options,
        }),
        subscriptionFromV2Record,
      );
    }
    return this._client.put(path`/v1/public/subscriptions/${subscriptionID}`, {
      query: { external_id },
      body,
      ...options,
    });
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
