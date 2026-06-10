import { APIResource } from '../../../core/resource';
import * as ThreadsAPI from './threads';
import {
  Threads,
  WorkspaceMessageThreadDetail,
  WorkspaceMessageThreadDetailResponse,
  WorkspaceMessageThreadMessage,
  WorkspaceMessageThreadRetrieveParams,
} from './threads';
import { APIPromise } from '../../../core/api-promise';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { V2Envelope, unwrapV2Data } from '../../../internal/v2';

const wrapV2WorkspaceMessageEnvelope = <T>(
  promise: APIPromise<V2Envelope<T>>,
): APIPromise<{ data: T; message: string; ctx_id?: string | null }> => {
  return promise._thenUnwrap((envelope) => ({
    data: unwrapV2Data(envelope),
    message: 'ok',
    ctx_id: envelope.meta.ctx_id ?? null,
  }));
};

export class WorkspaceMessages extends APIResource {
  threads: ThreadsAPI.Threads = new ThreadsAPI.Threads(this._client);

  /**
   * List Workspace Messages
   */
  list(
    params: WorkspaceMessageListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<WorkspaceMessagesResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return wrapV2WorkspaceMessageEnvelope(
      this._client.get('/api/v2/workspace/messages', {
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
   * Sync Workspace Messages
   */
  sync(
    params: WorkspaceMessageSyncParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<WorkspaceMessagesResponse> {
    const { 'Accept-Language': acceptLanguage, ...body } = params ?? {};
    return wrapV2WorkspaceMessageEnvelope(
      this._client.post('/api/v2/workspace/messages/sync', {
        body,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
    );
  }
}

export interface WorkspaceMessageChannel {
  id: string;

  integration_slug: string;

  display_name: string;

  thread_count: number;

  unread_count: number;

  account_username?: string | null;

  status?: string | null;

  updated_at?: string | null;
}

export interface WorkspaceMessageThread {
  id: string;

  title: string;

  channel_id: string;

  channel_label: string;

  counterparty: string;

  preview: string;

  has_unread: boolean;

  message_count: number;

  message_type: string;

  assignee_display_name?: string | null;

  assignee_id?: number | null;

  assignee_username?: string | null;

  last_message_at?: string | null;

  status?: string | null;
}

export interface WorkspaceMessagesData {
  channels: Array<WorkspaceMessageChannel>;

  threads: Array<WorkspaceMessageThread>;
}

export interface WorkspaceMessagesResponse {
  data: WorkspaceMessagesData;

  message: string;

  ctx_id?: string | null;
}

export interface WorkspaceMessageListParams {
  /**
   * Query param
   */
  status?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string | null;
}

export interface WorkspaceMessageSyncParams {
  channel_id?: string | null;

  status?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string | null;
}

export { Threads };
export type {
  WorkspaceMessageThreadDetail,
  WorkspaceMessageThreadDetailResponse,
  WorkspaceMessageThreadMessage,
  WorkspaceMessageThreadRetrieveParams,
};

WorkspaceMessages.Threads = Threads;

export declare namespace WorkspaceMessages {
  export {
    type WorkspaceMessageChannel as WorkspaceMessageChannel,
    type WorkspaceMessageThread as WorkspaceMessageThread,
    type WorkspaceMessagesData as WorkspaceMessagesData,
    type WorkspaceMessagesResponse as WorkspaceMessagesResponse,
    type WorkspaceMessageListParams as WorkspaceMessageListParams,
    type WorkspaceMessageSyncParams as WorkspaceMessageSyncParams,
  };

  export {
    Threads as Threads,
    type WorkspaceMessageThreadMessage as WorkspaceMessageThreadMessage,
    type WorkspaceMessageThreadDetail as WorkspaceMessageThreadDetail,
    type WorkspaceMessageThreadDetailResponse as WorkspaceMessageThreadDetailResponse,
    type WorkspaceMessageThreadRetrieveParams as WorkspaceMessageThreadRetrieveParams,
  };
}
