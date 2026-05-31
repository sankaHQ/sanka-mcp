// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { V2Envelope, unwrapV2Data } from '../../internal/v2';

type V2PropertyListData = {
  data?: Array<Record<string, unknown>>;
};

type V2PropertyMutationData = {
  property_id?: string | null;
  page_group_type?: string | null;
  custom_object_id?: string | null;
  [key: string]: unknown;
};

const propertyFromV2 = (value: unknown, objectName?: string): Property => {
  const row =
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    ...row,
    id: String(row['id'] ?? row['property_id'] ?? row['internal_name'] ?? ''),
    immutable: Boolean(row['immutable'] ?? false),
    is_custom: Boolean(row['is_custom'] ?? true),
    object: String(row['object'] ?? objectName ?? ''),
  } as Property;
};

const normalizePropertyMutationBody = (
  params: PropertyCreateParams | Omit<PropertyUpdateParams, 'object_name'>,
): Record<string, unknown> => {
  const body: Record<string, unknown> = { ...params };
  const choiceValues = body['choice_values'];
  if (choiceValues && typeof choiceValues === 'object' && !Array.isArray(choiceValues)) {
    const entries = Object.entries(choiceValues as Record<string, string>);
    body['choice_values'] = entries.map(([value]) => value);
    body['choice_labels'] = entries.map(([, label]) => label);
  }
  return body;
};

const unwrapV2PropertyList = (
  promise: APIPromise<V2Envelope<V2PropertyListData>>,
  objectName: string,
): APIPromise<PropertyListResponse> => {
  return promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    return (data.data ?? []).map((row) => propertyFromV2(row, objectName));
  });
};

const unwrapV2PropertyMutation = (
  promise: APIPromise<V2Envelope<V2PropertyMutationData>>,
  objectName: string,
  fallbackStatus: string,
): APIPromise<PropertyMutation> => {
  return promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    return {
      ctx_id: envelope.meta.ctx_id ?? '',
      object: String(data.page_group_type ?? objectName),
      ok: true,
      property_id: String(data.property_id ?? ''),
      status: String(data['status'] ?? fallbackStatus),
      custom_object_id: data.custom_object_id ?? undefined,
      message: String(data['message'] ?? 'OK'),
      target: 'sanka',
    } as PropertyMutation;
  });
};

export class Properties extends APIResource {
  /**
   * Create Property
   */
  create(
    objectName: string,
    body: PropertyCreateParams,
    options?: RequestOptions,
  ): APIPromise<PropertyMutation> {
    return unwrapV2PropertyMutation(
      this._client.v2Post<V2PropertyMutationData>(path`/properties/${objectName}`, {
        body: normalizePropertyMutationBody(body),
        ...options,
      }),
      objectName,
      'created',
    );
  }

  /**
   * Retrieve Property
   */
  retrieve(
    propertyRef: string,
    params: PropertyRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<Property> {
    const { object_name, 'Accept-Language': acceptLanguage, ...query } = params;
    return this._client
      .v2Get<Record<string, unknown>>(path`/properties/${object_name}/${propertyRef}`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      })
      ._thenUnwrap((envelope) => propertyFromV2(unwrapV2Data(envelope), object_name));
  }

  /**
   * Update Property
   */
  update(
    propertyRef: string,
    params: PropertyUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PropertyMutation> {
    const { object_name, ...body } = params;
    return unwrapV2PropertyMutation(
      this._client.v2Put<V2PropertyMutationData>(path`/properties/${object_name}/${propertyRef}`, {
        body: normalizePropertyMutationBody(body),
        ...options,
      }),
      object_name,
      'updated',
    );
  }

  /**
   * List Properties
   */
  list(
    objectName: string,
    params: PropertyListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PropertyListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return unwrapV2PropertyList(
      this._client.v2Get<V2PropertyListData>(path`/properties/${objectName}`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      objectName,
    );
  }

  /**
   * Delete Property
   */
  delete(
    propertyRef: string,
    params: PropertyDeleteParams,
    options?: RequestOptions,
  ): APIPromise<PropertyMutation> {
    const { object_name, ...query } = params;
    return unwrapV2PropertyMutation(
      this._client.v2Delete<V2PropertyMutationData>(path`/properties/${object_name}/${propertyRef}`, {
        query,
        ...options,
      }),
      object_name,
      'deleted',
    );
  }
}

export interface Property {
  id: string;

  immutable: boolean;

  is_custom: boolean;

  object: string;

  badge_color?: string | null;

  choice_values?: { [key: string]: string } | Array<string> | null;

  conditional_choice_mapping?: { [key: string]: unknown } | null;

  created_at?: string | null;

  external_id?: string | null;

  external_object_type?: string | null;

  field_type?: string | null;

  group_name?: string | null;

  description?: string | null;

  options?: Array<{ [key: string]: unknown }> | null;

  provider?: string | null;

  raw?: { [key: string]: unknown } | null;

  scope?: string | null;

  internal_name?: string | null;

  channel_id?: string | null;

  channel_name?: string | null;

  multiple_select?: boolean | null;

  name?: string | null;

  number_format?: string | null;

  order?: number | null;

  required_field?: boolean | null;

  show_badge?: boolean | null;

  tag_values?: Array<string> | null;

  type?: string | null;

  unique?: boolean | null;

  updated_at?: string | null;
}

export interface PropertyMutation {
  ctx_id: string;

  object: string;

  ok: boolean;

  property_id: string;

  status: string;

  channel_id?: string | null;

  channel_name?: string | null;

  dry_run?: boolean | null;

  external_id?: string | null;

  external_object_type?: string | null;

  message?: string | null;

  provider?: string | null;

  remote?: { [key: string]: unknown } | null;

  target?: string | null;
}

export interface PropertyUpsert {
  badge_color?: string | null;

  choice_values?: { [key: string]: string } | Array<string> | null;

  conditional_choice_mapping?: { [key: string]: unknown } | null;

  confirm?: boolean | null;

  description?: string | null;

  dry_run?: boolean | null;

  external_id?: string | null;

  external_object_type?: string | null;

  field_type?: string | null;

  group_name?: string | null;

  internal_name?: string | null;

  channel_id?: string | null;

  multiple_select?: boolean | null;

  name?: string | null;

  number_format?: string | null;

  options?: Array<{ [key: string]: unknown }> | null;

  order?: number | null;

  provider?: string | null;

  required_field?: boolean | null;

  show_badge?: boolean | null;

  tag_values?: Array<string> | null;

  target?: string | null;

  type?: string | null;

  unique?: boolean | null;
}

export type PropertyListResponse = Array<Property>;

export interface PropertyCreateParams {
  badge_color?: string | null;

  choice_values?: { [key: string]: string } | Array<string> | null;

  conditional_choice_mapping?: { [key: string]: unknown } | null;

  confirm?: boolean | null;

  description?: string | null;

  dry_run?: boolean | null;

  external_id?: string | null;

  external_object_type?: string | null;

  field_type?: string | null;

  group_name?: string | null;

  internal_name?: string | null;

  channel_id?: string | null;

  multiple_select?: boolean | null;

  name?: string | null;

  number_format?: string | null;

  options?: Array<{ [key: string]: unknown }> | null;

  order?: number | null;

  provider?: string | null;

  required_field?: boolean | null;

  show_badge?: boolean | null;

  tag_values?: Array<string> | null;

  target?: string | null;

  type?: string | null;

  unique?: boolean | null;
}

export interface PropertyRetrieveParams {
  /**
   * Path param
   */
  object_name: string;

  /**
   * Query param
   */
  lang?: string | null;

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
  language?: string | null;

  /**
   * Query param
   */
  provider?: string | null;

  /**
   * Query param
   */
  scope?: string | null;

  /**
   * Query param
   */
  source?: string | null;

  /**
   * Query param
   */
  workspace_id?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface PropertyUpdateParams {
  /**
   * Path param
   */
  object_name: string;

  /**
   * Body param
   */
  badge_color?: string | null;

  /**
   * Body param
   */
  choice_values?: { [key: string]: string } | Array<string> | null;

  /**
   * Body param
   */
  channel_id?: string | null;

  /**
   * Body param
   */
  conditional_choice_mapping?: { [key: string]: unknown } | null;

  /**
   * Body param
   */
  confirm?: boolean | null;

  /**
   * Body param
   */
  description?: string | null;

  /**
   * Body param
   */
  dry_run?: boolean | null;

  /**
   * Body param
   */
  external_id?: string | null;

  /**
   * Body param
   */
  external_object_type?: string | null;

  /**
   * Body param
   */
  field_type?: string | null;

  /**
   * Body param
   */
  group_name?: string | null;

  /**
   * Body param
   */
  internal_name?: string | null;

  /**
   * Body param
   */
  multiple_select?: boolean | null;

  /**
   * Body param
   */
  name?: string | null;

  /**
   * Body param
   */
  number_format?: string | null;

  /**
   * Body param
   */
  options?: Array<{ [key: string]: unknown }> | null;

  /**
   * Body param
   */
  order?: number | null;

  /**
   * Body param
   */
  provider?: string | null;

  /**
   * Body param
   */
  required_field?: boolean | null;

  /**
   * Body param
   */
  show_badge?: boolean | null;

  /**
   * Body param
   */
  tag_values?: Array<string> | null;

  /**
   * Body param
   */
  target?: string | null;

  /**
   * Body param
   */
  type?: string | null;

  /**
   * Body param
   */
  unique?: boolean | null;
}

export interface PropertyListParams {
  /**
   * Query param
   */
  custom_only?: boolean;

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
  lang?: string | null;

  /**
   * Query param
   */
  language?: string | null;

  /**
   * Query param
   */
  limit?: number | null;

  /**
   * Query param
   */
  provider?: string | null;

  /**
   * Query param
   */
  scope?: string | null;

  /**
   * Query param
   */
  search?: string | null;

  /**
   * Query param
   */
  source?: string | null;

  /**
   * Query param
   */
  workspace_id?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface PropertyDeleteParams {
  object_name: string;

  channel_id?: string | null;

  confirm?: boolean | null;

  dry_run?: boolean | null;

  external_object_type?: string | null;

  provider?: string | null;

  target?: string | null;
}

export declare namespace Properties {
  export {
    type Property as Property,
    type PropertyMutation as PropertyMutation,
    type PropertyUpsert as PropertyUpsert,
    type PropertyListResponse as PropertyListResponse,
    type PropertyCreateParams as PropertyCreateParams,
    type PropertyRetrieveParams as PropertyRetrieveParams,
    type PropertyUpdateParams as PropertyUpdateParams,
    type PropertyListParams as PropertyListParams,
    type PropertyDeleteParams as PropertyDeleteParams,
  };
}
