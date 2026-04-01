// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Companies extends APIResource {
  /**
   * Create Company
   */
  create(body: CompanyCreateParams, options?: RequestOptions): APIPromise<PublicCompanyResponse> {
    return this._client.post('/v1/public/companies', { body, ...options });
  }

  /**
   * Get Company
   */
  retrieve(
    companyID: string,
    query: CompanyRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<CompanyRetrieveResponse> {
    return this._client.get(path`/v1/public/companies/${companyID}`, { query, ...options });
  }

  /**
   * Update Company
   */
  update(
    companyID: string,
    body: CompanyUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PublicCompanyResponse> {
    return this._client.put(path`/v1/public/companies/${companyID}`, { body, ...options });
  }

  /**
   * List Companies
   */
  list(
    params: CompanyListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<CompanyListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/companies', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Company
   */
  delete(
    companyID: string,
    params: CompanyDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicCompanyResponse> {
    const { external_id } = params ?? {};
    return this._client.delete(path`/v1/public/companies/${companyID}`, {
      query: { external_id },
      ...options,
    });
  }
}

export interface PublicCompanyRequest {
  address?: string | null;

  allowed_in_store?: boolean | null;

  email?: string | null;

  external_id?: string | null;

  name?: string | null;

  phone_number?: string | null;

  status?: string | null;

  url?: string | null;
}

export interface PublicCompanyResponse {
  ok: boolean;

  status: string;

  company_id?: string | null;

  ctx_id?: string | null;

  external_id?: string | null;
}

export interface CompanyRetrieveResponse {
  created_at: string;

  updated_at: string;

  id?: string | null;

  address?: string | null;

  allowed_in_store?: boolean | null;

  company_id?: number | null;

  email?: string | null;

  name?: string | null;

  phone_number?: string | null;

  url?: string | null;
}

export interface CompanyListResponse {
  count: number;

  data: Array<{ [key: string]: unknown }>;

  message: string;

  page: number;

  total: number;

  ctx_id?: string | null;

  permission?: string | null;
}

export interface CompanyCreateParams {
  address?: string | null;

  allowed_in_store?: boolean | null;

  email?: string | null;

  external_id?: string | null;

  name?: string | null;

  phone_number?: string | null;

  status?: string | null;

  url?: string | null;
}

export interface CompanyRetrieveParams {
  external_id?: string | null;
}

export interface CompanyUpdateParams {
  address?: string | null;

  allowed_in_store?: boolean | null;

  email?: string | null;

  external_id?: string | null;

  name?: string | null;

  phone_number?: string | null;

  status?: string | null;

  url?: string | null;
}

export interface CompanyListParams {
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

export interface CompanyDeleteParams {
  external_id?: string | null;
}

export declare namespace Companies {
  export {
    type PublicCompanyRequest as PublicCompanyRequest,
    type PublicCompanyResponse as PublicCompanyResponse,
    type CompanyRetrieveResponse as CompanyRetrieveResponse,
    type CompanyListResponse as CompanyListResponse,
    type CompanyCreateParams as CompanyCreateParams,
    type CompanyRetrieveParams as CompanyRetrieveParams,
    type CompanyUpdateParams as CompanyUpdateParams,
    type CompanyListParams as CompanyListParams,
    type CompanyDeleteParams as CompanyDeleteParams,
  };
}
