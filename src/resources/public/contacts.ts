// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Contacts extends APIResource {
  /**
   * Create Contact
   */
  create(body: ContactCreateParams, options?: RequestOptions): APIPromise<PublicContactResponse> {
    return this._client.post('/v1/public/contacts', { body, ...options });
  }

  /**
   * Get Contact
   */
  retrieve(
    contactID: string,
    query: ContactRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ContactRetrieveResponse> {
    return this._client.get(path`/v1/public/contacts/${contactID}`, { query, ...options });
  }

  /**
   * Update Contact
   */
  update(
    contactID: string,
    body: ContactUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PublicContactResponse> {
    return this._client.put(path`/v1/public/contacts/${contactID}`, { body, ...options });
  }

  /**
   * List Contacts
   */
  list(
    params: ContactListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ContactListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/contacts', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Contact
   */
  delete(
    contactID: string,
    params: ContactDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicContactResponse> {
    const { channel_id, confirm, dry_run, external_id, external_object_type, operation, provider, target } =
      params ?? {};
    return this._client.delete(path`/v1/public/contacts/${contactID}`, {
      query: { channel_id, confirm, dry_run, external_id, external_object_type, operation, provider, target },
      ...options,
    });
  }
}

export interface PublicContactRequest {
  allowed_in_store?: boolean | null;

  channel_id?: string | null;

  company?: string | null;

  confirm?: boolean | null;

  custom_fields?: Record<string, unknown> | null;

  dry_run?: boolean | null;

  email?: string | null;

  external_id?: string | null;

  external_object_type?: string | null;

  last_name?: string | null;

  name?: string | null;

  operation?: string | null;

  phone_number?: string | null;

  provider?: string | null;

  status?: string | null;

  target?: string | null;
}

export interface PublicContactResponse {
  ok: boolean;

  status: string;

  contact_id?: string | null;

  ctx_id?: string | null;

  external_id?: string | null;

  target?: string | null;

  provider?: string | null;

  channel_id?: string | null;

  channel_name?: string | null;

  external_object_type?: string | null;

  operation?: string | null;

  dry_run?: boolean | null;

  remote?: Record<string, unknown> | null;

  sync_state?: Record<string, unknown> | null;

  warnings?: Array<string> | null;

  message?: string | null;
}

export interface ContactRetrieveResponse {
  created_at: string;

  updated_at: string;

  id?: string | null;

  allowed_in_store?: boolean | null;

  contact_id?: number | null;

  email?: string | null;

  name?: string | null;

  phone_number?: string | null;
}

export interface ContactListResponse {
  count: number;

  data: Array<{ [key: string]: unknown }>;

  message: string;

  page: number;

  total: number;

  channel_id?: string | null;

  channel_name?: string | null;

  ctx_id?: string | null;

  external_object_type?: string | null;

  next_cursor?: string | null;

  permission?: string | null;

  provider?: string | null;

  scope?: string | null;

  sync_state?: Record<string, unknown> | null;

  unavailable_reason?: string | null;
}

export interface ContactCreateParams {
  allowed_in_store?: boolean | null;

  channel_id?: string | null;

  company?: string | null;

  confirm?: boolean | null;

  custom_fields?: Record<string, unknown> | null;

  dry_run?: boolean | null;

  email?: string | null;

  external_id?: string | null;

  external_object_type?: string | null;

  last_name?: string | null;

  name?: string | null;

  operation?: string | null;

  phone_number?: string | null;

  provider?: string | null;

  status?: string | null;

  target?: string | null;
}

export interface ContactRetrieveParams {
  external_id?: string | null;
}

export interface ContactUpdateParams {
  allowed_in_store?: boolean | null;

  channel_id?: string | null;

  company?: string | null;

  confirm?: boolean | null;

  custom_fields?: Record<string, unknown> | null;

  dry_run?: boolean | null;

  email?: string | null;

  external_id?: string | null;

  external_object_type?: string | null;

  last_name?: string | null;

  name?: string | null;

  operation?: string | null;

  phone_number?: string | null;

  provider?: string | null;

  status?: string | null;

  target?: string | null;
}

export interface ContactListParams {
  /**
   * Query param
   */
  channel_id?: string | null;

  /**
   * Query param
   */
  external_object_type?: string | null;

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
  provider?: 'hubspot' | 'salesforce' | null;

  /**
   * Query param
   */
  scope?: 'sanka' | 'integration' | null;

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

export interface ContactDeleteParams {
  channel_id?: string | null;

  confirm?: boolean | null;

  dry_run?: boolean | null;

  external_id?: string | null;

  external_object_type?: string | null;

  operation?: string | null;

  provider?: string | null;

  target?: string | null;
}

export declare namespace Contacts {
  export {
    type PublicContactRequest as PublicContactRequest,
    type PublicContactResponse as PublicContactResponse,
    type ContactRetrieveResponse as ContactRetrieveResponse,
    type ContactListResponse as ContactListResponse,
    type ContactCreateParams as ContactCreateParams,
    type ContactRetrieveParams as ContactRetrieveParams,
    type ContactUpdateParams as ContactUpdateParams,
    type ContactListParams as ContactListParams,
    type ContactDeleteParams as ContactDeleteParams,
  };
}
