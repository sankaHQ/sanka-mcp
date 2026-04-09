import { APIResource } from '../../../core/resource';
import * as AccountMessagesAPI from './account-messages';
import { APIPromise } from '../../../core/api-promise';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';

export class Threads extends APIResource {
  /**
   * Get Account Message Thread
   */
  retrieve(
    threadID: string,
    params: AccountMessageThreadRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<AccountMessageThreadDetailResponse> {
    const { 'Accept-Language': acceptLanguage } = params ?? {};
    return this._client.get(path`/v1/public/account-messages/threads/${threadID}`, {
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Archive Account Message Thread
   */
  archive(
    threadID: string,
    params: AccountMessageThreadArchiveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<AccountMessagesAPI.AccountMessagesResponse> {
    const { 'Accept-Language': acceptLanguage } = params ?? {};
    return this._client.post(path`/v1/public/account-messages/threads/${threadID}/archive`, {
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Reply To Account Message Thread
   */
  reply(
    threadID: string,
    params: AccountMessageThreadReplyParams,
    options?: RequestOptions,
  ): APIPromise<AccountMessageThreadReplyResponse> {
    const { 'Accept-Language': acceptLanguage, ...body } = params;
    return this._client.post(path`/v1/public/account-messages/threads/${threadID}/reply`, {
      body,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }
}

export interface AccountMessageThreadMessage {
  id: string;

  body: string;

  direction: string;

  sender_label: string;

  sent_at?: string | null;

  status?: string | null;
}

export interface AccountMessageThreadDetail extends AccountMessagesAPI.AccountMessageThread {
  can_reply: boolean;

  messages: Array<AccountMessageThreadMessage>;

  open_in_web_url: string;

  reply_target?: string | null;
}

export interface AccountMessageThreadDetailResponse {
  data: AccountMessageThreadDetail;

  message: string;

  ctx_id?: string | null;
}

export interface AccountMessageThreadReplyData {
  thread_id: string;

  has_unread: boolean;

  message_id?: string | null;
}

export interface AccountMessageThreadReplyResponse {
  data: AccountMessageThreadReplyData;

  message: string;

  ctx_id?: string | null;
}

export interface AccountMessageThreadRetrieveParams {
  /**
   * Header param
   */
  'Accept-Language'?: string | null;
}

export interface AccountMessageThreadArchiveParams {
  /**
   * Header param
   */
  'Accept-Language'?: string | null;
}

export interface AccountMessageThreadReplyParams {
  body: string;

  /**
   * Header param
   */
  'Accept-Language'?: string | null;
}

export declare namespace Threads {
  export {
    type AccountMessageThreadMessage as AccountMessageThreadMessage,
    type AccountMessageThreadDetail as AccountMessageThreadDetail,
    type AccountMessageThreadDetailResponse as AccountMessageThreadDetailResponse,
    type AccountMessageThreadReplyData as AccountMessageThreadReplyData,
    type AccountMessageThreadReplyResponse as AccountMessageThreadReplyResponse,
    type AccountMessageThreadRetrieveParams as AccountMessageThreadRetrieveParams,
    type AccountMessageThreadArchiveParams as AccountMessageThreadArchiveParams,
    type AccountMessageThreadReplyParams as AccountMessageThreadReplyParams,
  };
}
