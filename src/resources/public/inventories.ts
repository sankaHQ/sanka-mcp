// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Inventories extends APIResource {
  /**
   * Create Inventory
   */
  create(body: InventoryCreateParams, options?: RequestOptions): APIPromise<InventoryResponse> {
    return this._client.post('/v1/public/inventories', { body, ...options });
  }

  /**
   * Get Inventory
   */
  retrieve(
    inventoryID: string,
    params: InventoryRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ShopTurboInventory> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get(path`/v1/public/inventories/${inventoryID}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Inventory
   */
  update(
    inventoryID: string,
    body: InventoryUpdateParams,
    options?: RequestOptions,
  ): APIPromise<InventoryResponse> {
    return this._client.put(path`/v1/public/inventories/${inventoryID}`, { body, ...options });
  }

  /**
   * List Inventories
   */
  list(
    params: InventoryListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InventoryListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/inventories', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Inventory
   */
  delete(
    inventoryID: string,
    params: InventoryDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InventoryResponse> {
    const { external_id } = params ?? {};
    return this._client.delete(path`/v1/public/inventories/${inventoryID}`, {
      query: { external_id },
      ...options,
    });
  }
}

export interface InventoryRequest {
  externalId: string;

  currency?: string | null;

  date?: string | null;

  initialValue?: number | null;

  inventoryStatus?: string | null;

  itemExternalId?: string | null;

  itemId?: string | null;

  name?: string | null;

  status?: string | null;

  unitPrice?: number | null;

  warehouseId?: string | null;
}

export interface InventoryResponse {
  external_id: string;

  ok: boolean;

  status: string;

  ctx_id?: string | null;

  inventory_id?: string | null;

  inventory_record_id?: string | null;
}

export interface ShopTurboInventory {
  created_at: string;

  updated_at: string;

  id?: string | null;

  available?: number | null;

  committed?: number | null;

  currency?: string | null;

  date?: string | null;

  initial_value?: number | null;

  inventory_id?: number | null;

  inventory_status?: string | null;

  inventory_value?: number | null;

  item_ids?: Array<string> | null;

  name?: string | null;

  record_source?: string | null;

  record_source_detail?: string | null;

  status?: string | null;

  total_inventory?: number | null;

  unavailable?: number | null;

  unit_price?: number | null;

  warehouse_id?: string | null;
}

export type InventoryListResponse = Array<ShopTurboInventory>;

export interface InventoryCreateParams {
  externalId: string;

  currency?: string | null;

  date?: string | null;

  initialValue?: number | null;

  inventoryStatus?: string | null;

  itemExternalId?: string | null;

  itemId?: string | null;

  name?: string | null;

  status?: string | null;

  unitPrice?: number | null;

  warehouseId?: string | null;
}

export interface InventoryRetrieveParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface InventoryUpdateParams {
  externalId: string;

  currency?: string | null;

  date?: string | null;

  initialValue?: number | null;

  inventoryStatus?: string | null;

  itemExternalId?: string | null;

  itemId?: string | null;

  name?: string | null;

  status?: string | null;

  unitPrice?: number | null;

  warehouseId?: string | null;
}

export interface InventoryListParams {
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

export interface InventoryDeleteParams {
  external_id?: string | null;
}

export declare namespace Inventories {
  export {
    type InventoryRequest as InventoryRequest,
    type InventoryResponse as InventoryResponse,
    type ShopTurboInventory as ShopTurboInventory,
    type InventoryListResponse as InventoryListResponse,
    type InventoryCreateParams as InventoryCreateParams,
    type InventoryRetrieveParams as InventoryRetrieveParams,
    type InventoryUpdateParams as InventoryUpdateParams,
    type InventoryListParams as InventoryListParams,
    type InventoryDeleteParams as InventoryDeleteParams,
  };
}
