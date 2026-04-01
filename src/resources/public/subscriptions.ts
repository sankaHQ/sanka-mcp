// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

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
    return this._client.get(path`/v1/public/subscriptions/${subscriptionID}`, { query, ...options });
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
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/subscriptions', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
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
    return this._client.delete(path`/v1/public/subscriptions/${subscriptionID}`, {
      query: { external_id },
      ...options,
    });
  }
}

export interface SubscriptionDetail {
  id: string;

  contact_info: Array<SubscriptionDetail.ContactInfo>;

  created_at: string;

  items: Array<SubscriptionDetail.Item>;

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
    id: string;

    amount: number;

    name?: string | null;

    price?: number | null;

    status?: string | null;
  }
}

export interface SubscriptionItemInput {
  id: string;

  amount: number;

  name?: string | null;

  price?: number | null;
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
  cid: string;

  items: Array<SubscriptionItemInput>;

  subscription_status: string;

  currency?: string | null;

  frequency?: number | null;

  frequency_time?: string | null;

  shipping_cost_tax_status?: string | null;

  start_date?: string | null;

  tax?: number | null;

  total_price?: number | null;
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
