// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { V2Envelope, unwrapV2Data, unwrapV2DataPromise } from '../../internal/v2';
import { compactProperties } from '../../internal/v2-object-records';
import { PublicLineItem } from './line-items';
import { SankaError } from '../../core/error';

type V2ObjectRecord = {
  id: string;
  record_id?: string | null;
  object_type?: string | null;
  properties?: Record<string, unknown>;
};

type V2ObjectRecordList = {
  items?: Array<V2ObjectRecord>;
  page?: number;
  page_size?: number;
  total?: number;
};

type V2LifecycleData = {
  id?: string | null;
  record_id?: string | null;
  status?: string | null;
  usage_status?: string | null;
};

const numericRecordID = (recordID: string | null | undefined): number | undefined => {
  if (typeof recordID !== 'string' || !recordID.trim()) return undefined;
  const value = Number(recordID);
  return Number.isFinite(value) ? value : undefined;
};

const dealFromV2Record = (record: V2ObjectRecord): Case => {
  const properties = record.properties ?? {};
  const stageKey = properties['stage_key'] ?? properties['stage'];
  const caseStatus = properties['case_status'] ?? properties['stage_label'] ?? properties['stage'];
  return {
    ...properties,
    id: record.id,
    deal_id: numericRecordID(record.record_id) ?? (record.record_id as never) ?? null,
    case_status: (caseStatus as never) ?? null,
    stage_key: (stageKey as never) ?? null,
  } as unknown as Case;
};

const unwrapV2Deal = (promise: APIPromise<V2Envelope<V2ObjectRecord>>): APIPromise<Case> =>
  promise._thenUnwrap((envelope) => dealFromV2Record(unwrapV2Data(envelope)));

const unwrapV2DealList = (
  promise: APIPromise<V2Envelope<V2ObjectRecordList>>,
): APIPromise<DealListResponse> =>
  promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    return (data.items ?? []).map(dealFromV2Record);
  });

const dealDeleteResponseFromV2Lifecycle = (
  envelope: V2Envelope<V2LifecycleData>,
  externalID?: string | null,
): PublicCaseResponse => {
  const data = unwrapV2Data(envelope);
  return {
    ok: true,
    status: 'deleted',
    case_id: data.id ?? null,
    external_id: externalID ?? null,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

const dealMutationResponseFromV2Record = (
  envelope: V2Envelope<V2ObjectRecord>,
  externalID?: string | null,
  status = 'updated',
): PublicCaseResponse => {
  const data = unwrapV2Data(envelope);
  return {
    ok: true,
    status,
    case_id: data.id,
    external_id: externalID ?? null,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

const usableExternalID = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const hasRemoteMutationTarget = (target: string | null | undefined): boolean =>
  target != null && target !== 'sanka';

const compactLocalMutationProperties = (body: Record<string, unknown>): Record<string, unknown> => {
  const properties = { ...body };
  if (properties['target'] === 'sanka') {
    delete properties['target'];
  }
  return compactProperties(properties);
};

export class Deals extends APIResource {
  /**
   * Create Deal
   */
  create(body: DealCreateParams, options?: RequestOptions): APIPromise<PublicCaseResponse> {
    if (hasRemoteMutationTarget(body.target)) {
      return unwrapV2DataPromise(this._client.v2Post<PublicCaseResponse>('/deals', { body, ...options }));
    }
    const externalID = usableExternalID(body.externalId);
    return this._client
      .v2Post<V2ObjectRecord>('/deals', {
        body: { properties: compactLocalMutationProperties(body as unknown as Record<string, unknown>) },
        ...options,
      })
      ._thenUnwrap((envelope) => dealMutationResponseFromV2Record(envelope, externalID, 'created'));
  }

  /**
   * Get Deal
   */
  retrieve(
    caseID: string,
    params: DealRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Case> {
    const { 'Accept-Language': acceptLanguage, lang, language, ...query } = params ?? {};
    void lang;
    void language;
    return unwrapV2Deal(
      this._client.v2Get<V2ObjectRecord>(path`/deals/${caseID}`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
    );
  }

  /**
   * Update Deal
   */
  update(caseID: string, params: DealUpdateParams, options?: RequestOptions): APIPromise<PublicCaseResponse> {
    const { external_id, ...body } = params;
    if (hasRemoteMutationTarget(params.target)) {
      return unwrapV2DataPromise(
        this._client.v2Patch<PublicCaseResponse>(path`/deals/${caseID}`, {
          query: { external_id },
          body,
          ...options,
        }),
      );
    }
    return this._client
      .v2Patch<V2ObjectRecord>(path`/deals/${caseID}`, {
        query: { external_id },
        body: { properties: compactLocalMutationProperties(body as unknown as Record<string, unknown>) },
        ...options,
      })
      ._thenUnwrap((envelope) => dealMutationResponseFromV2Record(envelope));
  }

  /**
   * List Deals
   */
  list(
    params: DealListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<DealListResponse> {
    const {
      'Accept-Language': acceptLanguage,
      lang,
      language,
      limit,
      scope,
      workspace_id,
      ...query
    } = params ?? {};
    void lang;
    void language;
    void scope;
    void workspace_id;
    return unwrapV2DealList(
      this._client.v2Get<V2ObjectRecordList>('/deals', {
        query: {
          ...query,
          ...(limit != null ? { limit } : undefined),
        },
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
    );
  }

  /**
   * Delete Deal
   */
  delete(
    caseID: string,
    params: DealDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicCaseResponse> {
    const { channel_id, confirm, dry_run, external_id, external_object_type, operation, provider, target } =
      params ?? {};
    if (operation != null) {
      throw new SankaError(
        'Custom deal delete operations were retired with Public API V1; use the V2 delete operation.',
      );
    }
    if (hasRemoteMutationTarget(target)) {
      return unwrapV2DataPromise(
        this._client.v2Delete<PublicCaseResponse>(path`/deals/${caseID}`, {
          query: {
            channel_id,
            confirm,
            dry_run,
            external_id,
            external_object_type,
            operation,
            provider,
            target,
          },
          ...options,
        }),
      );
    }
    return this._client
      .v2Delete<V2LifecycleData>(path`/deals/${caseID}`, {
        query: { external_id },
        ...options,
      })
      ._thenUnwrap((envelope) => dealDeleteResponseFromV2Lifecycle(envelope, external_id));
  }

  /**
   * List Deal Pipelines
   */
  listPipelines(
    query: DealListPipelinesParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<DealListPipelinesResponse> {
    void query;
    return unwrapV2DataPromise(this._client.v2Get<DealListPipelinesResponse>('/deals/pipelines', options));
  }
}

export interface Case {
  created_at: string;

  updated_at: string;

  id?: string | null;

  case_status?: string | null;

  currency?: string | null;

  deal_id?: number | null;

  line_items?: Array<PublicLineItem>;

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

  channel_id?: string | null;

  companyExternalId?: string | null;

  companyId?: string | null;

  confirm?: boolean | null;

  contactExternalId?: string | null;

  contactId?: string | null;

  currency?: string | null;

  custom_fields?: Record<string, unknown> | null;

  dry_run?: boolean | null;

  externalId?: string | null;

  external_object_type?: string | null;

  name?: string | null;

  operation?: string | null;

  provider?: string | null;

  status?: string | null;

  target?: string | null;
}

export interface PublicCaseResponse {
  ok: boolean;

  status: string;

  case_id?: string | null;

  ctx_id?: string | null;

  external_id?: string | null;

  record_preview?: PublicCaseResponse.RecordPreview | null;

  updated_fields?: Record<string, unknown> | null;

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

export namespace PublicCaseResponse {
  export interface RecordPreview {
    id?: string | null;

    deal_id?: number | null;

    name?: string | null;

    status?: string | null;

    case_status?: string | null;

    currency?: string | null;

    updated_at?: string | null;
  }
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

  channel_id?: string | null;

  companyExternalId?: string | null;

  companyId?: string | null;

  confirm?: boolean | null;

  contactExternalId?: string | null;

  contactId?: string | null;

  currency?: string | null;

  custom_fields?: Record<string, unknown> | null;

  dry_run?: boolean | null;

  externalId?: string | null;

  external_object_type?: string | null;

  name?: string | null;

  operation?: string | null;

  provider?: string | null;

  status?: string | null;

  target?: string | null;
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
  channel_id?: string | null;

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
  confirm?: boolean | null;

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
  custom_fields?: Record<string, unknown> | null;

  /**
   * Body param
   */
  dry_run?: boolean | null;

  /**
   * Body param
   */
  externalId?: string | null;

  /**
   * Body param
   */
  external_object_type?: string | null;

  /**
   * Body param
   */
  name?: string | null;

  /**
   * Body param
   */
  operation?: string | null;

  /**
   * Body param
   */
  provider?: string | null;

  /**
   * Body param
   */
  status?: string | null;

  /**
   * Body param
   */
  target?: string | null;
}

export interface DealListParams {
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
  lang?: string | null;

  /**
   * Query param
   */
  language?: string | null;

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
  provider?: 'hubspot' | 'salesforce' | null;

  /**
   * Query param
   */
  scope?: 'sanka' | 'integration' | null;

  /**
   * Query param
   */
  search?: string | null;

  /**
   * Query param
   */
  select?: Array<string> | null;

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
  channel_id?: string | null;

  confirm?: boolean | null;

  dry_run?: boolean | null;

  external_id?: string | null;

  external_object_type?: string | null;

  operation?: string | null;

  provider?: string | null;

  target?: string | null;
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
