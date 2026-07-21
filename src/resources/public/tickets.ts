// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { V2Envelope, unwrapV2Data, unwrapV2DataPromise } from '../../internal/v2';
import { compactProperties } from '../../internal/v2-object-records';

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

const ticketFromV2Record = (record: V2ObjectRecord): Ticket => {
  const properties = record.properties ?? {};
  const numericRecordID =
    (
      typeof record.record_id === 'string' &&
      record.record_id.trim() &&
      Number.isFinite(Number(record.record_id))
    ) ?
      Number(record.record_id)
    : undefined;
  return {
    ...properties,
    id: record.id,
    ticket_id: numericRecordID ?? (record.record_id as never) ?? null,
  } as Ticket;
};

const unwrapV2Ticket = (promise: APIPromise<V2Envelope<V2ObjectRecord>>): APIPromise<Ticket> =>
  promise._thenUnwrap((envelope) => ticketFromV2Record(unwrapV2Data(envelope)));

const unwrapV2TicketList = (
  promise: APIPromise<V2Envelope<V2ObjectRecordList>>,
): APIPromise<TicketListResponse> =>
  promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    return (data.items ?? []).map(ticketFromV2Record);
  });

const ticketMutationFromV2Record = (
  envelope: V2Envelope<V2ObjectRecord>,
  fallbackStatus: string,
  externalID?: string | null,
): TicketResponse => {
  const data = unwrapV2Data(envelope);
  const properties = data.properties ?? {};
  return {
    ok: true,
    status: String(properties['status'] ?? fallbackStatus),
    ticket_id: data.id,
    external_id: externalID ?? null,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

const ticketMutationFromV2Lifecycle = (
  envelope: V2Envelope<V2LifecycleData>,
  fallbackStatus: string,
  externalID?: string | null,
): TicketResponse => {
  const data = unwrapV2Data(envelope);
  return {
    ok: true,
    status: data.status ?? data.usage_status ?? fallbackStatus,
    ticket_id: data.id ?? null,
    external_id: externalID ?? null,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

const usableExternalID = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

export class Tickets extends APIResource {
  /**
   * Create Ticket
   */
  create(params: TicketCreateParams, options?: RequestOptions): APIPromise<TicketResponse> {
    const { body_external_id, ...body } = params;
    const externalID = usableExternalID(body_external_id);
    return this._client
      .v2Post<V2ObjectRecord>('/tickets', {
        body: { properties: compactProperties({ external_id: externalID, ...body }) },
        ...options,
      })
      ._thenUnwrap((envelope) => ticketMutationFromV2Record(envelope, 'created', externalID));
  }

  /**
   * Get Ticket
   */
  retrieve(
    ticketID: string,
    query: TicketRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Ticket> {
    const { workspace_id: _workspaceID, ...v2Query } = query ?? {};
    void _workspaceID;
    return unwrapV2Ticket(
      this._client.v2Get<V2ObjectRecord>(path`/tickets/${ticketID}`, {
        query: v2Query,
        ...options,
      }),
    );
  }

  /**
   * Update Ticket
   */
  update(ticketID: string, params: TicketUpdateParams, options?: RequestOptions): APIPromise<TicketResponse> {
    const { external_id, body_external_id, ...body } = params;
    return this._client
      .v2Patch<V2ObjectRecord>(path`/tickets/${ticketID}`, {
        query: { external_id },
        body: {
          properties: compactProperties({ external_id: body_external_id, ...body }),
        },
        ...options,
      })
      ._thenUnwrap((envelope) => ticketMutationFromV2Record(envelope, 'updated', body_external_id));
  }

  /**
   * List Tickets
   */
  list(
    query: TicketListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<TicketListResponse> {
    const { workspace_id: _workspaceID, ...v2Query } = query ?? {};
    void _workspaceID;
    return unwrapV2TicketList(
      this._client.v2Get<V2ObjectRecordList>('/tickets', {
        query: v2Query,
        ...options,
      }),
    );
  }

  /**
   * Delete Ticket
   */
  delete(
    ticketID: string,
    params: TicketDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<TicketResponse> {
    const { external_id } = params ?? {};
    return this._client
      .v2Delete<V2LifecycleData>(path`/tickets/${ticketID}`, {
        query: { external_id },
        ...options,
      })
      ._thenUnwrap((envelope) => ticketMutationFromV2Lifecycle(envelope, 'archived', external_id));
  }

  /**
   * List Ticket Pipelines
   */
  listPipelines(
    query: TicketListPipelinesParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<TicketListPipelinesResponse> {
    void query;
    return unwrapV2DataPromise(
      this._client.v2Get<TicketListPipelinesResponse>('/tickets/pipelines', options),
    );
  }

  /**
   * Update Ticket Status
   */
  updateStatus(
    ticketID: string,
    params: TicketUpdateStatusParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<TicketResponse> {
    const { external_id, stage_key, status, 'Accept-Language': acceptLanguage } = params ?? {};
    return this._client
      .v2Patch<V2ObjectRecord>(path`/tickets/${ticketID}/status`, {
        query: { external_id, stage_key, status },
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      })
      ._thenUnwrap((envelope) => ticketMutationFromV2Record(envelope, 'updated', external_id));
  }
}

export interface Ticket {
  created_at: string;

  updated_at: string;

  id?: string | null;

  deal_ids?: Array<string>;

  description?: string | null;

  first_response_due_at?: string | null;

  owner?: { [key: string]: unknown } | null;

  owner_id?: string | null;

  pipeline_id?: string | null;

  pipeline_name?: string | null;

  pipeline_order?: number | null;

  priority?: string | null;

  record_source?: string | null;

  record_source_detail?: string | null;

  resolution_due_at?: string | null;

  resolved_at?: string | null;

  responded_at?: string | null;

  sla_status?: string | null;

  source_channel?: string | null;

  stage_key?: string | null;

  status?: string | null;

  ticket_id?: number | null;

  title?: string | null;

  visibility?: string | null;
}

export interface TicketRequest {
  deal_ids?: Array<string> | null;

  description?: string | null;

  external_id?: string | null;

  first_response_due_at?: string | null;

  owner_id?: string | null;

  priority?: string | null;

  resolution_due_at?: string | null;

  stage_key?: string | null;

  status?: string | null;

  title?: string | null;

  visibility?: string | null;
}

export interface TicketResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  external_id?: string | null;

  ticket_id?: string | null;
}

export type TicketListResponse = Array<Ticket>;

export type TicketListPipelinesResponse = Array<TicketListPipelinesResponse.TicketListPipelinesResponseItem>;

export namespace TicketListPipelinesResponse {
  export interface TicketListPipelinesResponseItem {
    internal_name: string;

    name: string;

    id?: string | null;

    is_default?: boolean;

    order?: number;

    stages?: Array<TicketListPipelinesResponseItem.Stage>;
  }

  export namespace TicketListPipelinesResponseItem {
    export interface Stage {
      internal_value: string;

      name: string;

      id?: string | null;

      is_terminal?: boolean;

      order?: number;

      score?: number;
    }
  }
}

export interface TicketCreateParams {
  deal_ids?: Array<string> | null;

  description?: string | null;

  body_external_id?: string | null;

  first_response_due_at?: string | null;

  owner_id?: string | null;

  priority?: string | null;

  resolution_due_at?: string | null;

  stage_key?: string | null;

  status?: string | null;

  title?: string | null;

  visibility?: string | null;
}

export interface TicketRetrieveParams {
  external_id?: string | null;

  workspace_id?: string | null;
}

export interface TicketUpdateParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Body param
   */
  deal_ids?: Array<string> | null;

  /**
   * Body param
   */
  description?: string | null;

  /**
   * Body param
   */
  body_external_id?: string | null;

  /**
   * Body param
   */
  first_response_due_at?: string | null;

  /**
   * Body param
   */
  owner_id?: string | null;

  /**
   * Body param
   */
  priority?: string | null;

  /**
   * Body param
   */
  resolution_due_at?: string | null;

  /**
   * Body param
   */
  stage_key?: string | null;

  /**
   * Body param
   */
  status?: string | null;

  /**
   * Body param
   */
  title?: string | null;

  /**
   * Body param
   */
  visibility?: string | null;
}

export interface TicketListParams {
  workspace_id?: string | null;
}

export interface TicketDeleteParams {
  external_id?: string | null;
}

export interface TicketListPipelinesParams {
  workspace_id?: string | null;
}

export interface TicketUpdateStatusParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Query param
   */
  stage_key?: string | null;

  /**
   * Query param
   */
  status?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export declare namespace Tickets {
  export {
    type Ticket as Ticket,
    type TicketRequest as TicketRequest,
    type TicketResponse as TicketResponse,
    type TicketListResponse as TicketListResponse,
    type TicketListPipelinesResponse as TicketListPipelinesResponse,
    type TicketCreateParams as TicketCreateParams,
    type TicketRetrieveParams as TicketRetrieveParams,
    type TicketUpdateParams as TicketUpdateParams,
    type TicketListParams as TicketListParams,
    type TicketDeleteParams as TicketDeleteParams,
    type TicketListPipelinesParams as TicketListPipelinesParams,
    type TicketUpdateStatusParams as TicketUpdateStatusParams,
  };
}
