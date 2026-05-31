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

const locationFromV2Record = (record: V2ObjectRecord): Warehouse =>
  legacyObjectRecordFromV2<Warehouse>(record, 'id_iw');

const locationUpdateProperties = (params: LocationUpdateParams): Record<string, unknown> => {
  const { external_id: _externalID, externalId: _bodyExternalID, usageStatus, ...rest } = params;
  void _externalID;
  void _bodyExternalID;
  return compactProperties({
    ...rest,
    ...(usageStatus !== undefined ? { usage_status: usageStatus } : undefined),
  });
};

const locationCreateProperties = (params: LocationCreateParams): Record<string, unknown> => {
  const { externalId, usageStatus, ...rest } = params;
  return compactProperties({
    ...(externalId !== undefined ? { external_id: externalId } : undefined),
    ...rest,
    ...(usageStatus !== undefined ? { usage_status: usageStatus } : undefined),
  });
};

export class Locations extends APIResource {
  /**
   * Create Location
   */
  create(body: LocationCreateParams, options?: RequestOptions): APIPromise<Location> {
    return this._client
      .v2Post<V2ObjectRecord>('/locations', {
        body: { properties: locationCreateProperties(body) },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<Location>(envelope, 'location_id', 'created', body.externalId),
      );
  }

  /**
   * Get Location
   */
  retrieve(
    locationID: string,
    query: LocationRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Warehouse> {
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/locations/${locationID}`, { query, ...options }),
      locationFromV2Record,
    );
  }

  /**
   * Update Location
   */
  update(locationID: string, params: LocationUpdateParams, options?: RequestOptions): APIPromise<Location> {
    const externalID = params.external_id ?? params.externalId;
    return this._client
      .v2Patch<V2ObjectRecord>(path`/locations/${locationID}`, {
        query: { external_id: externalID },
        body: { properties: locationUpdateProperties(params) },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<Location>(envelope, 'location_id', 'updated', externalID),
      );
  }

  /**
   * List Locations
   */
  list(
    params: LocationListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<LocationListResponse> {
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
      this._client.v2Get<V2ObjectRecordList>('/locations', {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      locationFromV2Record,
    );
  }

  /**
   * Delete Location
   */
  delete(
    locationID: string,
    params: LocationDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Location> {
    const { external_id } = params ?? {};
    return this._client
      .v2Delete<V2LifecycleData>(path`/locations/${locationID}`, { query: { external_id }, ...options })
      ._thenUnwrap((envelope) => legacyDeleteResponseFromV2<Location>(envelope, 'location_id', external_id));
  }
}

export interface Location {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  external_id?: string | null;

  location_id?: string | null;
}

export interface LocationRequest {
  aisle?: string | null;

  bin?: string | null;

  externalId?: string | null;

  floor?: string | null;

  rack?: string | null;

  shelf?: string | null;

  usageStatus?: string | null;

  warehouse?: string | null;

  zone?: string | null;
}

export interface Warehouse {
  created_at: string;

  updated_at: string;

  id?: string | null;

  aisle?: string | null;

  bin?: string | null;

  floor?: string | null;

  id_iw?: string | number | null;

  location?: string | null;

  map_location_id?: string | null;

  rack?: string | null;

  shelf?: string | null;

  usage_status?: string | null;

  warehouse?: string | null;

  zone?: string | null;
}

export type LocationListResponse = Array<Warehouse>;

export interface LocationCreateParams {
  aisle?: string | null;

  bin?: string | null;

  externalId?: string | null;

  floor?: string | null;

  rack?: string | null;

  shelf?: string | null;

  usageStatus?: string | null;

  warehouse?: string | null;

  zone?: string | null;
}

export interface LocationRetrieveParams {
  external_id?: string | null;
}

export interface LocationUpdateParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Body param
   */
  aisle?: string | null;

  /**
   * Body param
   */
  bin?: string | null;

  /**
   * Body param
   */
  externalId?: string | null;

  /**
   * Body param
   */
  floor?: string | null;

  /**
   * Body param
   */
  rack?: string | null;

  /**
   * Body param
   */
  shelf?: string | null;

  /**
   * Body param
   */
  usageStatus?: string | null;

  /**
   * Body param
   */
  warehouse?: string | null;

  /**
   * Body param
   */
  zone?: string | null;
}

export interface LocationListParams {
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
  q?: string | null;

  /**
   * Query param
   */
  search?: string | null;

  /**
   * Query param
   */
  workspace_id?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface LocationDeleteParams {
  external_id?: string | null;
}

export declare namespace Locations {
  export {
    type Location as Location,
    type LocationRequest as LocationRequest,
    type Warehouse as Warehouse,
    type LocationListResponse as LocationListResponse,
    type LocationCreateParams as LocationCreateParams,
    type LocationRetrieveParams as LocationRetrieveParams,
    type LocationUpdateParams as LocationUpdateParams,
    type LocationListParams as LocationListParams,
    type LocationDeleteParams as LocationDeleteParams,
  };
}
