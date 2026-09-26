// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { SankaError } from '../../core/error';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { unwrapV2Data, unwrapV2DataPromise } from '../../internal/v2';

const associationRefFromParams = (
  objectType: string | null | undefined,
  recordID: string | null | undefined,
  customObjectID: string | null | undefined,
) => ({
  object_type: objectType,
  record_id: recordID,
  ...(customObjectID != null ? { custom_object_id: customObjectID } : undefined),
});

const associationMutationBody = (params: AssociationCreateParams | AssociationDeleteParams) => ({
  source_ref: associationRefFromParams(
    params.source_object,
    params.source_id,
    params.source_custom_object_id,
  ),
  target_ref: associationRefFromParams(
    params.target_object,
    params.target_id,
    params.target_custom_object_id,
  ),
  ...(params.label_id != null ? { definition_id: params.label_id } : undefined),
  ...(params.label != null ? { label: params.label } : undefined),
});

// One record an association links: the source when given, otherwise the target. The API
// lists associations, and deletes one by id, under such a record.
const associationLinkedRecord = (params: AssociationBaseParams) => {
  if (params.source_object && params.source_id) {
    return associationRefFromParams(params.source_object, params.source_id, params.source_custom_object_id);
  }
  if (params.target_object && params.target_id) {
    return associationRefFromParams(params.target_object, params.target_id, params.target_custom_object_id);
  }
  return undefined;
};

type V2AssociationRecordRef = {
  object_type: string;
  record_id: string;
  custom_object_id?: string | null;
};

type V2AssociationEdge = {
  id: string;
  definition_id: string;
  source_ref: V2AssociationRecordRef;
  target_ref: V2AssociationRecordRef;
  label?: string | null;
  created_at?: string | null;
};

const associationObjectRefFromV2 = (ref: V2AssociationRecordRef): AssociationObjectRef => ({
  object: ref.object_type,
  object_type: ref.object_type,
  id: ref.record_id,
  ...(ref.custom_object_id != null ? { custom_object_id: ref.custom_object_id } : undefined),
});

// The API returns association edges (source_ref/target_ref/definition_id); this client
// returns them as Associations.
const associationFromV2Edge = (edge: V2AssociationEdge): Association => ({
  id: edge.id,
  source: associationObjectRefFromV2(edge.source_ref),
  target: associationObjectRefFromV2(edge.target_ref),
  label: { id: edge.definition_id, label: edge.label ?? null },
  created_at: edge.created_at ?? null,
});

export class Associations extends APIResource {
  /**
   * List Associations of one record: the source record when given, otherwise the target record.
   * `label` searches association labels. The API returns the record's first 100 associations;
   * `page` and `limit` page through them.
   */
  list(params: AssociationListParams, options?: RequestOptions): APIPromise<AssociationListResponse> {
    const record = associationLinkedRecord(params);
    if (!record) {
      throw new SankaError('Pass source_object/source_id or target_object/target_id to list associations.');
    }
    return this._client
      .v2Get<{ items?: Array<V2AssociationEdge>; total?: number }>('/public/associations', {
        query: {
          source_object_type: record.object_type,
          source_record_id: record.record_id,
          source_custom_object_id: record.custom_object_id,
          definition_id: params.label_id,
          q: params.label,
          workspace_id: params.workspace_id,
        },
        ...options,
      })
      ._thenUnwrap((envelope) => {
        const data = unwrapV2Data(envelope);
        const items = data.items ?? [];
        const page = Math.max(1, params.page ?? 1);
        const limit = params.limit ?? items.length;
        const start = (page - 1) * limit;
        const rows = items.slice(start, start + limit);
        const hasNext = start + rows.length < items.length;
        return {
          data: rows.map(associationFromV2Edge),
          page,
          count: rows.length,
          total: data.total ?? items.length,
          message: 'OK',
          ctx_id: envelope.meta.ctx_id ?? '',
          limit,
          has_next: hasNext,
          next_page: hasNext ? page + 1 : null,
        };
      });
  }

  /**
   * Create Association
   */
  create(body: AssociationCreateParams, options?: RequestOptions): APIPromise<AssociationMutationResponse> {
    return this._client
      .v2Post<{ edge?: V2AssociationEdge | null; created?: boolean; ctx_id?: string | null }>(
        '/public/associations',
        { body: associationMutationBody(body), ...options },
      )
      ._thenUnwrap((envelope) => {
        const data = unwrapV2Data(envelope);
        const created = data.created ?? false;
        return {
          ...(data.edge ? { association: associationFromV2Edge(data.edge) } : undefined),
          created,
          message: created ? 'Association created.' : 'Association already exists.',
          ctx_id: data.ctx_id ?? envelope.meta.ctx_id ?? '',
        } as AssociationMutationResponse;
      });
  }

  /**
   * Delete Association. With `association_id`, deletes it under one of the records it links;
   * otherwise deletes the association between the source and target records with the given
   * label, in `workspace_id` when set.
   */
  delete(params: AssociationDeleteParams, options?: RequestOptions): APIPromise<AssociationDeleteResponse> {
    if (params.association_id) {
      const record = associationLinkedRecord(params);
      if (!record) {
        throw new SankaError(
          'association_id must be sent with source_object/source_id or target_object/target_id of a record it links.',
        );
      }
      return unwrapV2DataPromise(
        this._client.v2Delete<AssociationDeleteResponse>(
          path`/records/${record.object_type}/${record.record_id}/associations/${params.association_id}`,
          {
            query:
              record.custom_object_id != null ? { custom_object_id: record.custom_object_id } : undefined,
            ...options,
          },
        ),
      );
    }
    return unwrapV2DataPromise(
      this._client.v2Delete<AssociationDeleteResponse>('/public/associations', {
        query: params.workspace_id != null ? { workspace_id: params.workspace_id } : undefined,
        body: associationMutationBody(params),
        ...options,
      }),
    );
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
