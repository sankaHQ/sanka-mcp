import { APIResource } from '../../../core/resource';
import * as ThreadsAPI from './threads';
import {
  AccountMessageThreadArchiveParams,
  AccountMessageThreadDetail,
  AccountMessageThreadDetailResponse,
  AccountMessageThreadMessage,
  AccountMessageThreadReplyData,
  AccountMessageThreadReplyParams,
  AccountMessageThreadReplyResponse,
  AccountMessageThreadRetrieveParams,
  Threads,
} from './threads';
import { APIPromise } from '../../../core/api-promise';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';

export class AccountMessages extends APIResource {
  threads: ThreadsAPI.Threads = new ThreadsAPI.Threads(this._client);

  /**
   * List Account Messages
   */
  list(
    params: AccountMessageListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<AccountMessagesResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/account-messages', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Sync Account Messages
   */
  sync(
    params: AccountMessageSyncParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<AccountMessagesResponse> {
    const { 'Accept-Language': acceptLanguage, ...body } = params ?? {};
    return this._client.post('/v1/public/account-messages/sync', {
      body,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Bulk Update Account Message Threads
   */
  bulkActions(
    params: AccountMessageBulkActionsParams,
    options?: RequestOptions,
  ): APIPromise<AccountMessagesResponse> {
    const { 'Accept-Language': acceptLanguage, ...body } = params;
    return this._client.post('/v1/public/account-messages/bulk-actions', {
      body,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }
}

export interface AccountMessageChannel {
  id: string;

  integration_slug: string;

  display_name: string;

  thread_count: number;

  unread_count: number;

  account_username?: string | null;

  status?: string | null;

  updated_at?: string | null;
}

export interface AccountMessageThread {
  id: string;

  title: string;

  channel_id: string;

  channel_label: string;

  counterparty: string;

  preview: string;

  has_unread: boolean;

  message_count: number;

  message_type: string;

  last_message_at?: string | null;
}

export interface AccountMessagesData {
  channels: Array<AccountMessageChannel>;

  threads: Array<AccountMessageThread>;
}

export interface AccountMessagesResponse {
  data: AccountMessagesData;

  message: string;

  ctx_id?: string | null;
}

export interface AccountMessageListParams {
  /**
   * Query param
   */
  status?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string | null;
}

export interface AccountMessageSyncParams {
  channel_id?: string | null;

  status?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string | null;
}

export interface AccountMessageBulkActionsParams {
  action: string;

  thread_ids: Array<string>;

  status?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string | null;
}

export { Threads };
export type {
  AccountMessageThreadArchiveParams,
  AccountMessageThreadDetail,
  AccountMessageThreadDetailResponse,
  AccountMessageThreadMessage,
  AccountMessageThreadReplyData,
  AccountMessageThreadReplyParams,
  AccountMessageThreadReplyResponse,
  AccountMessageThreadRetrieveParams,
};

AccountMessages.Threads = Threads;

export declare namespace AccountMessages {
  export {
    type AccountMessageChannel as AccountMessageChannel,
    type AccountMessageThread as AccountMessageThread,
    type AccountMessagesData as AccountMessagesData,
    type AccountMessagesResponse as AccountMessagesResponse,
    type AccountMessageListParams as AccountMessageListParams,
    type AccountMessageSyncParams as AccountMessageSyncParams,
    type AccountMessageBulkActionsParams as AccountMessageBulkActionsParams,
  };

  export {
    Threads as Threads,
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
