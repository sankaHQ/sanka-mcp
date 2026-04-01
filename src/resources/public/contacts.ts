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
    const { external_id } = params ?? {};
    return this._client.delete(path`/v1/public/contacts/${contactID}`, {
      query: { external_id },
      ...options,
    });
  }
}

export interface PublicContactRequest {
  allowed_in_store?: boolean | null;

  company?: string | null;

  email?: string | null;

  external_id?: string | null;

  last_name?: string | null;

  name?: string | null;

  phone_number?: string | null;

  status?: string | null;
}

export interface PublicContactResponse {
  ok: boolean;

  status: string;

  contact_id?: string | null;

  ctx_id?: string | null;

  external_id?: string | null;
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

  ctx_id?: string | null;

  permission?: string | null;
}

export interface ContactCreateParams {
  allowed_in_store?: boolean | null;

  company?: string | null;

  email?: string | null;

  external_id?: string | null;

  last_name?: string | null;

  name?: string | null;

  phone_number?: string | null;

  status?: string | null;
}

export interface ContactRetrieveParams {
  external_id?: string | null;
}

export interface ContactUpdateParams {
  allowed_in_store?: boolean | null;

  company?: string | null;

  email?: string | null;

  external_id?: string | null;

  last_name?: string | null;

  name?: string | null;

  phone_number?: string | null;

  status?: string | null;
}

export interface ContactListParams {
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

export interface ContactDeleteParams {
  external_id?: string | null;
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
