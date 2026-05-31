// Hand-written public integrations helper resource.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { unwrapV2DataPromise } from '../../internal/v2';

export class Integrations extends APIResource {
  /**
   * List Integration Channels
   */
  listChannels(
    params: IntegrationChannelsListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<IntegrationChannelsListResponse> {
    return unwrapV2DataPromise(
      this._client.v2Get<IntegrationChannelsListResponse>('/integrations/channels', {
        query: params ?? {},
        ...options,
      }),
    );
  }
}

export interface IntegrationChannelsListParams {
  object_type?: string;
  provider?: string | null;
}

export interface IntegrationChannelsListResponse {
  channels: Array<Record<string, unknown>>;
  message: string;
  ctx_id?: string | null;
}
