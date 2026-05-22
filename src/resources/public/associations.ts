// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';

export class Associations extends APIResource {
  /**
   * List Associations
   */
  list(params: AssociationListParams, options?: RequestOptions): APIPromise<AssociationListResponse> {
    return this._client.get('/v1/public/associations', { query: params, ...options });
  }

  /**
   * Create Association
   */
  create(body: AssociationCreateParams, options?: RequestOptions): APIPromise<AssociationMutationResponse> {
    return this._client.post('/v1/public/associations', { body, ...options });
  }

  /**
   * Delete Association
   */
  delete(params: AssociationDeleteParams, options?: RequestOptions): APIPromise<AssociationDeleteResponse> {
    return this._client.delete('/v1/public/associations', { query: params, ...options });
  }
}

export interface AssociationObjectRef {
  object: string;

  object_type: string;

  id: string;

  custom_object_id?: string | null;

  custom_object_slug?: string | null;

  custom_object_name?: string | null;
}

export interface AssociationLabel {
  id: string;

  label?: string | null;

  label_ja?: string | null;

  object_source?: string | null;

  object_target?: string | null;

  association_type?: string | null;

  created_by_sanka?: boolean | null;
}

export interface Association {
  id: string;

  source: AssociationObjectRef;

  target: AssociationObjectRef;

  label?: AssociationLabel | null;

  created_at?: string | null;
}

export interface AssociationListResponse {
  data: Array<Association>;

  page: number;

  count: number;

  total: number;

  message: string;

  ctx_id: string;

  limit?: number | null;

  has_next?: boolean | null;

  next_page?: number | null;

  pagination?: Record<string, unknown> | null;
}

export interface AssociationMutationResponse {
  association: Association;

  created: boolean;

  message: string;

  ctx_id: string;
}

export interface AssociationDeleteResponse {
  deleted: boolean;

  message: string;

  ctx_id: string;
}

export interface AssociationBaseParams {
  source_object?: string | null;

  source_id?: string | null;

  source_custom_object_id?: string | null;

  target_object?: string | null;

  target_id?: string | null;

  target_custom_object_id?: string | null;

  label_id?: string | null;

  label?: string | null;
}

export interface AssociationListParams extends AssociationBaseParams {
  page?: number | null;

  limit?: number | null;

  workspace_id?: string | null;
}

export type AssociationCreateParams = AssociationBaseParams;

export interface AssociationDeleteParams extends AssociationBaseParams {
  association_id?: string | null;

  page?: number | null;

  limit?: number | null;

  workspace_id?: string | null;
}

export declare namespace Associations {
  export {
    type AssociationObjectRef as AssociationObjectRef,
    type AssociationLabel as AssociationLabel,
    type Association as Association,
    type AssociationListResponse as AssociationListResponse,
    type AssociationMutationResponse as AssociationMutationResponse,
    type AssociationDeleteResponse as AssociationDeleteResponse,
    type AssociationBaseParams as AssociationBaseParams,
    type AssociationListParams as AssociationListParams,
    type AssociationCreateParams as AssociationCreateParams,
    type AssociationDeleteParams as AssociationDeleteParams,
  };
}
