// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Items extends APIResource {
  /**
   * Create Item
   */
  create(body: ItemCreateParams, options?: RequestOptions): APIPromise<ItemResponse> {
    return this._client.post('/v1/public/items', { body, ...options });
  }

  /**
   * Get Item
   */
  retrieve(
    itemID: string,
    query: ItemRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ShopTurboItem> {
    return this._client.get(path`/v1/public/items/${itemID}`, { query, ...options });
  }

  /**
   * Update Item
   */
  update(itemID: string, body: ItemUpdateParams, options?: RequestOptions): APIPromise<ItemResponse> {
    return this._client.put(path`/v1/public/items/${itemID}`, { body, ...options });
  }

  /**
   * List Items
   */
  list(
    params: ItemListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ItemListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/items', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Item
   */
  delete(
    itemID: string,
    params: ItemDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ItemResponse> {
    const { external_id } = params ?? {};
    return this._client.delete(path`/v1/public/items/${itemID}`, { query: { external_id }, ...options });
  }
}

export interface ItemRequest {
  externalId: string;

  currency?: string | null;

  description?: string | null;

  name?: string | null;

  price?: number | null;

  purchasePrice?: number | null;

  status?: string | null;

  tax?: number | null;
}

export interface ItemResponse {
  external_id: string;

  ok: boolean;

  status: string;

  ctx_id?: string | null;

  item_id?: string | null;
}

export interface ShopTurboItem {
  created_at: string;

  updated_at: string;

  id?: string | null;

  company_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  item_id?: number | null;

  name?: string | null;

  price?: number | null;

  status?: string | null;
}

export type ItemListResponse = Array<ShopTurboItem>;

export interface ItemCreateParams {
  externalId: string;

  currency?: string | null;

  description?: string | null;

  name?: string | null;

  price?: number | null;

  purchasePrice?: number | null;

  status?: string | null;

  tax?: number | null;
}

export interface ItemRetrieveParams {
  external_id?: string | null;
}

export interface ItemUpdateParams {
  externalId: string;

  currency?: string | null;

  description?: string | null;

  name?: string | null;

  price?: number | null;

  purchasePrice?: number | null;

  status?: string | null;

  tax?: number | null;
}

export interface ItemListParams {
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

export interface ItemDeleteParams {
  external_id?: string | null;
}

export declare namespace Items {
  export {
    type ItemRequest as ItemRequest,
    type ItemResponse as ItemResponse,
    type ShopTurboItem as ShopTurboItem,
    type ItemListResponse as ItemListResponse,
    type ItemCreateParams as ItemCreateParams,
    type ItemRetrieveParams as ItemRetrieveParams,
    type ItemUpdateParams as ItemUpdateParams,
    type ItemListParams as ItemListParams,
    type ItemDeleteParams as ItemDeleteParams,
  };
}
