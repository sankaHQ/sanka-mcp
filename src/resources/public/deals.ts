// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Deals extends APIResource {
  /**
   * Create Deal
   */
  create(body: DealCreateParams, options?: RequestOptions): APIPromise<PublicCaseResponse> {
    return this._client.post('/v1/public/deals', { body, ...options });
  }

  /**
   * Get Deal
   */
  retrieve(
    caseID: string,
    params: DealRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Case> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get(path`/v1/public/deals/${caseID}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Deal
   */
  update(caseID: string, params: DealUpdateParams, options?: RequestOptions): APIPromise<PublicCaseResponse> {
    const { external_id, ...body } = params;
    return this._client.put(path`/v1/public/deals/${caseID}`, { query: { external_id }, body, ...options });
  }

  /**
   * List Deals
   */
  list(
    params: DealListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<DealListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/deals', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Deal
   */
  delete(
    caseID: string,
    params: DealDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicCaseResponse> {
    const { external_id } = params ?? {};
    return this._client.delete(path`/v1/public/deals/${caseID}`, { query: { external_id }, ...options });
  }

  /**
   * List Deal Pipelines
   */
  listPipelines(
    query: DealListPipelinesParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<DealListPipelinesResponse> {
    return this._client.get('/v1/public/deals/pipelines', { query, ...options });
  }
}

export interface Case {
  created_at: string;

  updated_at: string;

  id?: string | null;

  case_status?: string | null;

  currency?: string | null;

  deal_id?: number | null;

  name?: string | null;

  pipeline_name?: string | null;

  pipeline_order?: number | null;

  stage_key?: string | null;

  stage_label?: string | null;

  stage_position?: number | null;

  stage_score?: number | null;

  status?: string | null;
}

export interface PublicCaseRequest {
  caseStatus?: string | null;

  companyExternalId?: string | null;

  companyId?: string | null;

  contactExternalId?: string | null;

  contactId?: string | null;

  currency?: string | null;

  externalId?: string | null;

  name?: string | null;

  status?: string | null;
}

export interface PublicCaseResponse {
  ok: boolean;

  status: string;

  case_id?: string | null;

  ctx_id?: string | null;

  external_id?: string | null;
}

export type DealListResponse = Array<Case>;

export type DealListPipelinesResponse = Array<DealListPipelinesResponse.DealListPipelinesResponseItem>;

export namespace DealListPipelinesResponse {
  export interface DealListPipelinesResponseItem {
    id?: string | null;

    internal_name?: string | null;

    is_default?: boolean;

    name?: string | null;

    order?: number | null;

    stages?: Array<DealListPipelinesResponseItem.Stage>;
  }

  export namespace DealListPipelinesResponseItem {
    export interface Stage {
      id?: string | null;

      internal_value?: string | null;

      name?: string | null;

      order?: number | null;

      score?: number | null;
    }
  }
}

export interface DealCreateParams {
  caseStatus?: string | null;

  companyExternalId?: string | null;

  companyId?: string | null;

  contactExternalId?: string | null;

  contactId?: string | null;

  currency?: string | null;

  externalId?: string | null;

  name?: string | null;

  status?: string | null;
}

export interface DealRetrieveParams {
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

export interface DealUpdateParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Body param
   */
  caseStatus?: string | null;

  /**
   * Body param
   */
  companyExternalId?: string | null;

  /**
   * Body param
   */
  companyId?: string | null;

  /**
   * Body param
   */
  contactExternalId?: string | null;

  /**
   * Body param
   */
  contactId?: string | null;

  /**
   * Body param
   */
  currency?: string | null;

  /**
   * Body param
   */
  externalId?: string | null;

  /**
   * Body param
   */
  name?: string | null;

  /**
   * Body param
   */
  status?: string | null;
}

export interface DealListParams {
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

export interface DealDeleteParams {
  external_id?: string | null;
}

export interface DealListPipelinesParams {
  workspace_id?: string | null;
}

export declare namespace Deals {
  export {
    type Case as Case,
    type PublicCaseRequest as PublicCaseRequest,
    type PublicCaseResponse as PublicCaseResponse,
    type DealListResponse as DealListResponse,
    type DealListPipelinesResponse as DealListPipelinesResponse,
    type DealCreateParams as DealCreateParams,
    type DealRetrieveParams as DealRetrieveParams,
    type DealUpdateParams as DealUpdateParams,
    type DealListParams as DealListParams,
    type DealDeleteParams as DealDeleteParams,
    type DealListPipelinesParams as DealListPipelinesParams,
  };
}
