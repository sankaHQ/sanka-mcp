// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class InventoryTransactions extends APIResource {
  /**
   * Create Inventory Transaction
   */
  create(body: InventoryTransactionCreateParams, options?: RequestOptions): APIPromise<TransactionResponse> {
    return this._client.post('/v1/public/inventory-transactions', { body, ...options });
  }

  /**
   * Get Inventory Transaction
   */
  retrieve(
    transactionID: string,
    params: InventoryTransactionRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<TransactionSchema> {
    const { 'Accept-Language': acceptLanguage } = params ?? {};
    return this._client.get(path`/v1/public/inventory-transactions/${transactionID}`, {
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Inventory Transaction
   */
  update(
    transactionID: string,
    body: InventoryTransactionUpdateParams,
    options?: RequestOptions,
  ): APIPromise<TransactionResponse> {
    return this._client.put(path`/v1/public/inventory-transactions/${transactionID}`, { body, ...options });
  }

  /**
   * List Inventory Transactions
   */
  list(
    params: InventoryTransactionListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InventoryTransactionListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/inventory-transactions', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Inventory Transaction
   */
  delete(transactionID: string, options?: RequestOptions): APIPromise<TransactionResponse> {
    return this._client.delete(path`/v1/public/inventory-transactions/${transactionID}`, options);
  }
}

export interface TransactionRequest {
  transactionType: string;

  amount?: number | null;

  inventoryExternalId?: string | null;

  inventoryId?: string | null;

  inventoryType?: string | null;

  price?: number | null;

  status?: string | null;

  transactionAmount?: number | null;

  transactionDate?: string | null;

  useUnitValue?: boolean | null;
}

export interface TransactionResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  inventory_id?: string | null;

  transaction_id?: string | null;
}

export interface TransactionSchema {
  created_at: string;

  updated_at: string;

  id?: string | null;

  amount?: number | null;

  average_price?: number | null;

  inventory_id?: string | number | null;

  inventory_type?: string | null;

  inventory_uuid?: string | null;

  price?: number | null;

  status?: string | null;

  total_price?: number | null;

  transaction_amount?: number | null;

  transaction_date?: string | null;

  transaction_id?: string | number | null;

  transaction_type?: string | null;

  usage_status?: string | null;

  use_unit_value?: boolean | null;
}

export type InventoryTransactionListResponse = Array<TransactionSchema>;

export interface InventoryTransactionCreateParams {
  transactionType: string;

  amount?: number | null;

  inventoryExternalId?: string | null;

  inventoryId?: string | null;

  inventoryType?: string | null;

  price?: number | null;

  status?: string | null;

  transactionAmount?: number | null;

  transactionDate?: string | null;

  useUnitValue?: boolean | null;
}

export interface InventoryTransactionRetrieveParams {
  'Accept-Language'?: string;
}

export interface InventoryTransactionUpdateParams {
  transactionType: string;

  amount?: number | null;

  inventoryExternalId?: string | null;

  inventoryId?: string | null;

  inventoryType?: string | null;

  price?: number | null;

  status?: string | null;

  transactionAmount?: number | null;

  transactionDate?: string | null;

  useUnitValue?: boolean | null;
}

export interface InventoryTransactionListParams {
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

export declare namespace InventoryTransactions {
  export {
    type TransactionRequest as TransactionRequest,
    type TransactionResponse as TransactionResponse,
    type TransactionSchema as TransactionSchema,
    type InventoryTransactionListResponse as InventoryTransactionListResponse,
    type InventoryTransactionCreateParams as InventoryTransactionCreateParams,
    type InventoryTransactionRetrieveParams as InventoryTransactionRetrieveParams,
    type InventoryTransactionUpdateParams as InventoryTransactionUpdateParams,
    type InventoryTransactionListParams as InventoryTransactionListParams,
  };
}
