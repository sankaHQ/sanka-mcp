// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Tickets extends APIResource {
  /**
   * Create Ticket
   */
  create(params: TicketCreateParams, options?: RequestOptions): APIPromise<TicketResponse> {
    const { body_external_id, ...body } = params;
    return this._client.post('/v1/public/tickets', {
      body: { external_id: body_external_id, ...body },
      ...options,
    });
  }

  /**
   * Get Ticket
   */
  retrieve(
    ticketID: string,
    query: TicketRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Ticket> {
    return this._client.get(path`/v1/public/tickets/${ticketID}`, { query, ...options });
  }

  /**
   * Update Ticket
   */
  update(ticketID: string, params: TicketUpdateParams, options?: RequestOptions): APIPromise<TicketResponse> {
    const { external_id, body_external_id, ...body } = params;
    return this._client.put(path`/v1/public/tickets/${ticketID}`, {
      query: { external_id },
      body: { external_id: body_external_id, ...body },
      ...options,
    });
  }

  /**
   * List Tickets
   */
  list(
    query: TicketListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<TicketListResponse> {
    return this._client.get('/v1/public/tickets', { query, ...options });
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
    return this._client.delete(path`/v1/public/tickets/${ticketID}`, { query: { external_id }, ...options });
  }

  /**
   * List Ticket Pipelines
   */
  listPipelines(
    query: TicketListPipelinesParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<TicketListPipelinesResponse> {
    return this._client.get('/v1/public/tickets/pipelines', { query, ...options });
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
    return this._client.patch(path`/v1/public/tickets/${ticketID}/status`, {
      query: { external_id, stage_key, status },
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
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
