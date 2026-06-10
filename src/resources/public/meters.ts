// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import {
  V2LifecycleData,
  V2ObjectRecord,
  V2ObjectRecordList,
  compactProperties,
  legacyDeleteResponseFromV2,
  legacyMutationResponseFromV2,
  legacyObjectRecordFromV2,
  unwrapV2ObjectRecord,
  unwrapV2ObjectRecordArray,
} from '../../internal/v2-object-records';

const meterFromV2Record = (record: V2ObjectRecord): CommerceMeter =>
  legacyObjectRecordFromV2<CommerceMeter>(record, 'meter_id');

const canUseV2MeterMutation = (params: MeterCreateParams | MeterUpdateParams): boolean =>
  params.companyExternalId == null &&
  params.contactExternalId == null &&
  params.itemExternalId == null &&
  params.subscriptionExternalId == null;

const meterMutationExternalID = (params: MeterCreateParams | MeterUpdateParams): string | null =>
  'external_id' in params ? params.external_id ?? params.externalId ?? null : params.externalId ?? null;

const meterMutationProperties = (params: MeterCreateParams | MeterUpdateParams): Record<string, unknown> => {
  const {
    externalId,
    companyExternalId: _companyExternalID,
    companyId,
    contactExternalId: _contactExternalID,
    contactId,
    itemExternalId: _itemExternalID,
    itemId,
    subscriptionExternalId: _subscriptionExternalID,
    subscriptionId,
    usage,
    usageAt,
    usageStatus,
  } = params;
  void _companyExternalID;
  void _contactExternalID;
  void _itemExternalID;
  void _subscriptionExternalID;
  return compactProperties({
    ...(externalId !== undefined ? { external_id: externalId } : undefined),
    company_id: companyId,
    contact_id: contactId,
    item_id: itemId,
    subscription_id: subscriptionId,
    usage,
    usage_at: usageAt,
    usage_status: usageStatus,
  });
};

export class Meters extends APIResource {
  /**
   * Create Meter
   */
  create(body: MeterCreateParams, options?: RequestOptions): APIPromise<Meter> {
    if (canUseV2MeterMutation(body)) {
      const externalID = meterMutationExternalID(body);
      return this._client
        .v2Post<V2ObjectRecord>('/meters', {
          body: { properties: meterMutationProperties(body) },
          ...options,
        })
        ._thenUnwrap((envelope) =>
          legacyMutationResponseFromV2<Meter>(envelope, 'meter_id', 'created', externalID),
        );
    }
    return this._client.post('/v1/public/meters', { body, ...options });
  }

  /**
   * Get Meter
   */
  retrieve(
    meterID: string,
    params: MeterRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<CommerceMeter> {
    const { 'Accept-Language': acceptLanguage, lang, language, ...query } = params ?? {};
    void lang;
    void language;
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/meters/${meterID}`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      meterFromV2Record,
    );
  }

  /**
   * Update Meter
   */
  update(meterID: string, params: MeterUpdateParams, options?: RequestOptions): APIPromise<Meter> {
    const { external_id, ...body } = params;
    if (canUseV2MeterMutation(params)) {
      const externalID = meterMutationExternalID(params);
      return this._client
        .v2Patch<V2ObjectRecord>(path`/meters/${meterID}`, {
          query: { external_id: externalID },
          body: { properties: meterMutationProperties(params) },
          ...options,
        })
        ._thenUnwrap((envelope) =>
          legacyMutationResponseFromV2<Meter>(envelope, 'meter_id', 'updated', externalID),
        );
    }
    return this._client.put(path`/v1/public/meters/${meterID}`, { query: { external_id }, body, ...options });
  }

  /**
   * List Meters
   */
  list(
    params: MeterListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<MeterListResponse> {
    const {
      'Accept-Language': acceptLanguage,
      lang,
      language,
      workspace_id: _workspaceID,
      ...query
    } = params ?? {};
    void lang;
    void language;
    void _workspaceID;
    return unwrapV2ObjectRecordArray(
      this._client.v2Get<V2ObjectRecordList>('/meters', {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      meterFromV2Record,
    );
  }

  /**
   * Delete Meter
   */
  delete(
    meterID: string,
    params: MeterDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Meter> {
    const { external_id } = params ?? {};
    return this._client
      .v2Delete<V2LifecycleData>(path`/meters/${meterID}`, { query: { external_id }, ...options })
      ._thenUnwrap((envelope) => legacyDeleteResponseFromV2<Meter>(envelope, 'meter_id', external_id));
  }
}

export interface CommerceMeter {
  created_at: string;

  updated_at: string;

  id?: string | null;

  company_id?: string | null;

  company_name?: string | null;

  contact_id?: string | null;

  contact_name?: string | null;

  item_id?: string | null;

  item_name?: string | null;

  meter_id?: string | number | null;

  subscription_id?: string | null;

  subscription_name?: string | null;

  usage?: number | null;

  usage_at?: string | null;

  usage_status?: string | null;
}

export interface Meter {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  external_id?: string | null;

  meter_id?: string | null;
}

export interface MeterRequest {
  companyExternalId?: string | null;

  companyId?: string | null;

  contactExternalId?: string | null;

  contactId?: string | null;

  externalId?: string | null;

  itemExternalId?: string | null;

  itemId?: string | null;

  subscriptionExternalId?: string | null;

  subscriptionId?: string | null;

  usage?: number | null;

  usageAt?: string | null;

  usageStatus?: string | null;
}

export type MeterListResponse = Array<CommerceMeter>;

export interface MeterCreateParams {
  companyExternalId?: string | null;

  companyId?: string | null;

  contactExternalId?: string | null;

  contactId?: string | null;

  externalId?: string | null;

  itemExternalId?: string | null;

  itemId?: string | null;

  subscriptionExternalId?: string | null;

  subscriptionId?: string | null;

  usage?: number | null;

  usageAt?: string | null;

  usageStatus?: string | null;
}

export interface MeterRetrieveParams {
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

export interface MeterUpdateParams {
  /**
   * Query param
   */
  external_id?: string | null;

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
  contactExternalId?: string | null;

  /**
   * Body param
   */
  contactId?: string | null;

  /**
   * Body param
   */
  externalId?: string | null;

  /**
   * Body param
   */
  itemExternalId?: string | null;

  /**
   * Body param
   */
  itemId?: string | null;

  /**
   * Body param
   */
  subscriptionExternalId?: string | null;

  /**
   * Body param
   */
  subscriptionId?: string | null;

  /**
   * Body param
   */
  usage?: number | null;

  /**
   * Body param
   */
  usageAt?: string | null;

  /**
   * Body param
   */
  usageStatus?: string | null;
}

export interface MeterListParams {
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
  workspace_id?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface MeterDeleteParams {
  external_id?: string | null;
}

export declare namespace Meters {
  export {
    type CommerceMeter as CommerceMeter,
    type Meter as Meter,
    type MeterRequest as MeterRequest,
    type MeterListResponse as MeterListResponse,
    type MeterCreateParams as MeterCreateParams,
    type MeterRetrieveParams as MeterRetrieveParams,
    type MeterUpdateParams as MeterUpdateParams,
    type MeterListParams as MeterListParams,
    type MeterDeleteParams as MeterDeleteParams,
  };
}
