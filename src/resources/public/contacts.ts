// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { V2Envelope, unwrapV2Data } from '../../internal/v2';
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

const numericRecordID = (recordID: string | null | undefined): number | undefined => {
  if (typeof recordID !== 'string' || !recordID.trim()) return undefined;
  const value = Number(recordID);
  return Number.isFinite(value) ? value : undefined;
};

const contactFromV2Record = (record: V2ObjectRecord): ContactRetrieveResponse => {
  const properties = record.properties ?? {};
  return {
    ...properties,
    id: record.id,
    contact_id: numericRecordID(record.record_id) ?? (record.record_id as never) ?? null,
  } as ContactRetrieveResponse;
};

const unwrapV2Contact = (
  promise: APIPromise<V2Envelope<V2ObjectRecord>>,
): APIPromise<ContactRetrieveResponse> =>
  promise._thenUnwrap((envelope) => contactFromV2Record(unwrapV2Data(envelope)));

const contactListFromV2Envelope = (envelope: V2Envelope<V2ObjectRecordList>): ContactListResponse => {
  const data = unwrapV2Data(envelope);
  const rows = (data.items ?? []).map(contactFromV2Record) as unknown as Array<{
    [key: string]: unknown;
  }>;
  const total = data.total ?? rows.length;
  const page = data.page ?? 1;
  return {
    count: rows.length,
    data: rows,
    message: `Returned ${rows.length} of ${total} contacts.`,
    page,
    total,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

const contactDeleteResponseFromV2Lifecycle = (
  envelope: V2Envelope<V2LifecycleData>,
  externalID?: string | null,
): PublicContactResponse => {
  const data = unwrapV2Data(envelope);
  return {
    ok: true,
    status: 'deleted',
    contact_id: data.id ?? null,
    external_id: externalID ?? null,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

const contactMutationResponseFromV2Record = (
  envelope: V2Envelope<V2ObjectRecord>,
  externalID?: string | null,
  status = 'updated',
): PublicContactResponse => {
  const data = unwrapV2Data(envelope);
  return {
    ok: true,
    status,
    contact_id: data.id,
    external_id: externalID ?? null,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

const usableExternalID = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const hasLegacyContactCreateArgs = (body: ContactCreateParams): boolean =>
  usableExternalID(body.external_id) == null ||
  body.channel_id != null ||
  body.confirm != null ||
  body.custom_fields != null ||
  body.dry_run != null ||
  body.external_object_type != null ||
  body.operation != null ||
  body.provider != null ||
  body.target != null;

const hasLegacyContactListArgs = (params: ContactListParams | null | undefined): boolean => {
  if (!params) return false;
  return (
    params.channel_id != null ||
    params.external_object_type != null ||
    params.provider != null ||
    params.reference_id != null ||
    params.scope != null ||
    params.sort != null ||
    params.view != null
  );
};

const hasLegacyContactDeleteArgs = (params: ContactDeleteParams | null | undefined): boolean => {
  if (!params) return false;
  return (
    params.channel_id != null ||
    params.confirm != null ||
    params.dry_run != null ||
    params.external_object_type != null ||
    params.operation != null ||
    params.provider != null ||
    params.target != null
  );
};

const hasLegacyContactUpdateArgs = (body: ContactUpdateParams): boolean =>
  body.channel_id != null ||
  body.confirm != null ||
  body.custom_fields != null ||
  body.dry_run != null ||
  body.external_id != null ||
  body.external_object_type != null ||
  body.operation != null ||
  body.provider != null ||
  body.target != null;

export class Contacts extends APIResource {
  /**
   * Create Contact
   */
  create(body: ContactCreateParams, options?: RequestOptions): APIPromise<PublicContactResponse> {
    if (!hasLegacyContactCreateArgs(body)) {
      const externalID = usableExternalID(body.external_id);
      return this._client
        .v2Post<V2ObjectRecord>('/contacts', {
          body: { properties: compactProperties(body as unknown as Record<string, unknown>) },
          ...options,
        })
        ._thenUnwrap((envelope) => contactMutationResponseFromV2Record(envelope, externalID, 'created'));
    }
    return this._client.post('/v1/public/contacts', { body, ...options });
  }

  /**
   * Get Contact
   */
  retrieve(
    contactID: string,
    query: ContactRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ContactRetrieveResponse> {
    return unwrapV2Contact(
      this._client.v2Get<V2ObjectRecord>(path`/contacts/${contactID}`, { query, ...options }),
    );
  }

  /**
   * Update Contact
   */
  update(
    contactID: string,
    body: ContactUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PublicContactResponse> {
    if (!hasLegacyContactUpdateArgs(body)) {
      return this._client
        .v2Patch<V2ObjectRecord>(path`/contacts/${contactID}`, {
          body: { properties: compactProperties(body as unknown as Record<string, unknown>) },
          ...options,
        })
        ._thenUnwrap((envelope) => contactMutationResponseFromV2Record(envelope));
    }
    return this._client.put(path`/v1/public/contacts/${contactID}`, { body, ...options });
  }

  /**
   * List Contacts
   */
  list(
    params: ContactListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ContactListResponse> {
    const { 'Accept-Language': acceptLanguage, limit, ...query } = params ?? {};
    if (hasLegacyContactListArgs(params)) {
      return this._client.get('/v1/public/contacts', {
        query: { limit, ...query },
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      });
    }
    return this._client
      .v2Get<V2ObjectRecordList>('/contacts', {
        query,
        ...(limit != null ? { query: { ...query, limit } } : undefined),
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      })
      ._thenUnwrap(contactListFromV2Envelope);
  }

  /**
   * Delete Contact
   */
  delete(
    contactID: string,
    params: ContactDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicContactResponse> {
    const { channel_id, confirm, dry_run, external_id, external_object_type, operation, provider, target } =
      params ?? {};
    if (hasLegacyContactDeleteArgs(params)) {
      return this._client.delete(path`/v1/public/contacts/${contactID}`, {
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
      });
    }
    return this._client
      .v2Delete<V2LifecycleData>(path`/contacts/${contactID}`, {
        query: { external_id },
        ...options,
      })
      ._thenUnwrap((envelope) => contactDeleteResponseFromV2Lifecycle(envelope, external_id));
  }
}

export interface PublicContactRequest {
  allowed_in_store?: boolean | null;

  channel_id?: string | null;

  company?: string | null;

  confirm?: boolean | null;

  custom_fields?: Record<string, unknown> | null;

  dry_run?: boolean | null;

  email?: string | null;

  external_id?: string | null;

  external_object_type?: string | null;

  last_name?: string | null;

  name?: string | null;

  operation?: string | null;

  phone_number?: string | null;

  provider?: string | null;

  status?: string | null;

  target?: string | null;
}

export interface PublicContactResponse {
  ok: boolean;

  status: string;

  contact_id?: string | null;

  ctx_id?: string | null;

  external_id?: string | null;

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

export interface ContactRetrieveResponse {
  created_at: string;

  updated_at: string;

  id?: string | null;

  allowed_in_store?: boolean | null;

  contact_id?: number | null;

  email?: string | null;

  name?: string | null;

  phone_number?: string | null;
}

export interface ContactListResponse {
  count: number;

  data: Array<{ [key: string]: unknown }>;

  message: string;

  page: number;

  total: number;

  channel_id?: string | null;

  channel_name?: string | null;

  ctx_id?: string | null;

  external_object_type?: string | null;

  next_cursor?: string | null;

  permission?: string | null;

  provider?: string | null;

  scope?: string | null;

  sync_state?: Record<string, unknown> | null;

  unavailable_reason?: string | null;
}

export interface ContactCreateParams {
  allowed_in_store?: boolean | null;

  channel_id?: string | null;

  company?: string | null;

  confirm?: boolean | null;

  custom_fields?: Record<string, unknown> | null;

  dry_run?: boolean | null;

  email?: string | null;

  external_id?: string | null;

  external_object_type?: string | null;

  last_name?: string | null;

  name?: string | null;

  operation?: string | null;

  phone_number?: string | null;

  provider?: string | null;

  status?: string | null;

  target?: string | null;
}

export interface ContactRetrieveParams {
  external_id?: string | null;
}

export interface ContactUpdateParams {
  allowed_in_store?: boolean | null;

  channel_id?: string | null;

  company?: string | null;

  confirm?: boolean | null;

  custom_fields?: Record<string, unknown> | null;

  dry_run?: boolean | null;

  email?: string | null;

  external_id?: string | null;

  external_object_type?: string | null;

  last_name?: string | null;

  name?: string | null;

  operation?: string | null;

  phone_number?: string | null;

  provider?: string | null;

  status?: string | null;

  target?: string | null;
}

export interface ContactListParams {
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
  limit?: number | null;

  /**
   * Query param
   */
  page?: number;

  /**
   * Query param
   */
  reference_id?: string | null;

  /**
   * Query param
   */
  search?: string | null;

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
  sort?: string | null;

  /**
   * Query param
   */
  view?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface ContactDeleteParams {
  channel_id?: string | null;

  confirm?: boolean | null;

  dry_run?: boolean | null;

  external_id?: string | null;

  external_object_type?: string | null;

  operation?: string | null;

  provider?: string | null;

  target?: string | null;
}

export declare namespace Contacts {
  export {
    type PublicContactRequest as PublicContactRequest,
    type PublicContactResponse as PublicContactResponse,
    type ContactRetrieveResponse as ContactRetrieveResponse,
    type ContactListResponse as ContactListResponse,
    type ContactCreateParams as ContactCreateParams,
    type ContactRetrieveParams as ContactRetrieveParams,
    type ContactUpdateParams as ContactUpdateParams,
    type ContactListParams as ContactListParams,
    type ContactDeleteParams as ContactDeleteParams,
  };
}
