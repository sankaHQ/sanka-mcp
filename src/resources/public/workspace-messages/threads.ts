import { APIResource } from '../../../core/resource';
import * as WorkspaceMessagesAPI from './workspace-messages';
import { APIPromise } from '../../../core/api-promise';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';
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

export class Threads extends APIResource {
  /**
   * Get Workspace Message Thread
   */
  retrieve(
    threadID: string,
    params: WorkspaceMessageThreadRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<WorkspaceMessageThreadDetailResponse> {
    const { 'Accept-Language': acceptLanguage } = params ?? {};
    return wrapV2WorkspaceMessageEnvelope(
      this._client.get(path`/api/v2/workspace/messages/threads/${threadID}`, {
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
    );
  }

  /**
   * Reply To Workspace Message Thread
   */
  reply(
    threadID: string,
    params: WorkspaceMessageThreadReplyParams,
    options?: RequestOptions,
  ): APIPromise<WorkspaceMessageThreadReplyResponse> {
    const { 'Accept-Language': acceptLanguage, ...body } = params;
    return wrapV2WorkspaceMessageEnvelope(
      this._client.post(path`/api/v2/workspace/messages/threads/${threadID}/reply`, {
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

export interface WorkspaceMessageThreadMessage {
  id: string;

  body: string;

  direction: string;

  sender_label: string;

  sent_at?: string | null;

  status?: string | null;
}

export interface WorkspaceMessageThreadDetail extends WorkspaceMessagesAPI.WorkspaceMessageThread {
  can_reply: boolean;

  messages: Array<WorkspaceMessageThreadMessage>;

  open_in_web_url: string;

  reply_target?: string | null;
}

export interface WorkspaceMessageThreadDetailResponse {
  data: WorkspaceMessageThreadDetail;

  message: string;

  ctx_id?: string | null;
}

export interface WorkspaceMessageThreadReplyData {
  thread_id: string;

  has_unread: boolean;

  sender_email: string;

  integration_slug: string;

  message_id?: string | null;
}

export interface WorkspaceMessageThreadReplyResponse {
  data: WorkspaceMessageThreadReplyData;

  message: string;

  ctx_id?: string | null;
}

export interface WorkspaceMessageThreadRetrieveParams {
  /**
   * Header param
   */
  'Accept-Language'?: string | null;
}

export interface WorkspaceMessageThreadReplyParams {
  body: string;

  expected_sender_email?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string | null;
}

export declare namespace Threads {
  export {
    type WorkspaceMessageThreadMessage as WorkspaceMessageThreadMessage,
    type WorkspaceMessageThreadDetail as WorkspaceMessageThreadDetail,
    type WorkspaceMessageThreadDetailResponse as WorkspaceMessageThreadDetailResponse,
    type WorkspaceMessageThreadRetrieveParams as WorkspaceMessageThreadRetrieveParams,
    type WorkspaceMessageThreadReplyData as WorkspaceMessageThreadReplyData,
    type WorkspaceMessageThreadReplyResponse as WorkspaceMessageThreadReplyResponse,
    type WorkspaceMessageThreadReplyParams as WorkspaceMessageThreadReplyParams,
  };
}
