// Hand-written public integrations helper resource.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';

export class Integrations extends APIResource {
  /**
   * List Integration Channels
   */
  listChannels(
    params: IntegrationChannelsListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<IntegrationChannelsListResponse> {
    return this._client.get('/v1/public/integrations/channels', {
      query: params ?? {},
      ...options,
    });
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
