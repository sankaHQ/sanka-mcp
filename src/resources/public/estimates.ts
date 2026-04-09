// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Estimates extends APIResource {
  /**
   * Create Estimate
   */
  create(body: EstimateCreateParams, options?: RequestOptions): APIPromise<PublicEstimateResponse> {
    return this._client.post('/v1/public/estimates', { body, ...options });
  }

  /**
   * Get Estimate
   */
  retrieve(
    estimateID: string,
    params: EstimateRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Estimate> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get(path`/v1/public/estimates/${estimateID}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Estimate
   */
  update(
    estimateID: string,
    body: EstimateUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PublicEstimateResponse> {
    return this._client.put(path`/v1/public/estimates/${estimateID}`, { body, ...options });
  }

  /**
   * List Estimates
   */
  list(
    params: EstimateListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<EstimateListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/estimates', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Estimate
   */
  delete(
    estimateID: string,
    params: EstimateDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicEstimateResponse> {
    const { external_id } = params ?? {};
    return this._client.delete(path`/v1/public/estimates/${estimateID}`, {
      query: { external_id },
      ...options,
    });
  }

  /**
   * Download Estimate PDF
   */
  downloadPDF(
    estimateID: string,
    params: EstimateDownloadPDFParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Response> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get(path`/v1/public/estimates/${estimateID}/pdf`, {
      query,
      ...options,
      __binaryResponse: true,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    }) as APIPromise<Response>;
  }
}

export interface Estimate {
  created_at: string;

  updated_at: string;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  due_date?: string | null;

  id_est?: number | null;

  start_date?: string | null;

  status?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface PublicEstimateRequest {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  notes?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface PublicEstimateResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  estimate_id?: string | null;

  external_id?: string | null;
}

export type EstimateListResponse = Array<Estimate>;

export interface EstimateCreateParams {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  notes?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface EstimateRetrieveParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Query param
   */
  lang?: string | null;

  /**
   * Query param
   */
  language?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface EstimateUpdateParams {
  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  notes?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface EstimateListParams {
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

export interface EstimateDeleteParams {
  external_id?: string | null;
}

export interface EstimateDownloadPDFParams {
  /**
   * Query param
   */
  external_id?: string | null;

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
  template_select?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export declare namespace Estimates {
  export {
    type Estimate as Estimate,
    type PublicEstimateRequest as PublicEstimateRequest,
    type PublicEstimateResponse as PublicEstimateResponse,
    type EstimateListResponse as EstimateListResponse,
    type EstimateCreateParams as EstimateCreateParams,
    type EstimateRetrieveParams as EstimateRetrieveParams,
    type EstimateUpdateParams as EstimateUpdateParams,
    type EstimateListParams as EstimateListParams,
    type EstimateDeleteParams as EstimateDeleteParams,
  };
}
