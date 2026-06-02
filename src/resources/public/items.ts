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
  legacyMutationResponseFromV2,
  legacyObjectRecordFromV2,
  unwrapV2ObjectRecord,
  unwrapV2ObjectRecordArray,
} from '../../internal/v2-object-records';

const itemFromV2Record = (record: V2ObjectRecord): ShopTurboItem =>
  legacyObjectRecordFromV2<ShopTurboItem>(record, 'item_id');

const itemMutationProperties = (
  body: ItemCreateParams | ItemUpdateParams,
): { externalID: string | null; properties: Record<string, unknown> } => {
  const { externalId, purchasePrice, ...rest } = body;
  return {
    externalID: externalId ?? null,
    properties: compactProperties({
      ...rest,
      ...(purchasePrice !== undefined ? { purchase_price: purchasePrice } : undefined),
    }),
  };
};

export class Items extends APIResource {
  /**
   * Create Item
   */
  create(body: ItemCreateParams, options?: RequestOptions): APIPromise<ItemResponse> {
    const { externalID, properties } = itemMutationProperties(body);
    return this._client
      .v2Post<V2ObjectRecord>('/items', {
        body: {
          properties: {
            ...(externalID != null ? { external_id: externalID } : undefined),
            ...properties,
          },
        },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<ItemResponse>(envelope, 'item_id', 'created', externalID),
      );
  }

  /**
   * Get Item
   */
  retrieve(
    itemID: string,
    query: ItemRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ShopTurboItem> {
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/items/${itemID}`, { query, ...options }),
      itemFromV2Record,
    );
  }

  /**
   * Update Item
   */
  update(itemID: string, body: ItemUpdateParams, options?: RequestOptions): APIPromise<ItemResponse> {
    const { externalID, properties } = itemMutationProperties(body);
    return this._client
      .v2Patch<V2ObjectRecord>(path`/items/${itemID}`, {
        query: { external_id: externalID },
        body: { properties },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<ItemResponse>(envelope, 'item_id', 'updated', externalID),
      );
  }

  /**
   * List Items
   */
  list(
    params: ItemListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ItemListResponse> {
    const { 'Accept-Language': acceptLanguage, lang, language, workspace_id, ...query } = params ?? {};
    void lang;
    void language;
    return unwrapV2ObjectRecordArray(
      this._client.v2Get<V2ObjectRecordList>('/items', {
        query: {
          ...query,
          ...(workspace_id != null ? { workspace_id } : undefined),
        },
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      itemFromV2Record,
    );
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
    return this._client
      .v2Delete<V2LifecycleData>(path`/items/${itemID}`, { query: { external_id }, ...options })
      ._thenUnwrap((envelope) => legacyDeleteResponseFromV2<ItemResponse>(envelope, 'item_id', external_id));
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
  limit?: number | null;

  /**
   * Query param
   */
  page?: number | null;

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
  view_id?: string | null;

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
