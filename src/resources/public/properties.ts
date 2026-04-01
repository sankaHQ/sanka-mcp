// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Properties extends APIResource {
  /**
   * Create Property
   */
  create(
    objectName: string,
    body: PropertyCreateParams,
    options?: RequestOptions,
  ): APIPromise<PropertyMutation> {
    return this._client.post(path`/v1/public/properties/${objectName}`, { body, ...options });
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
    return this._client.get(path`/v1/public/properties/${object_name}/${propertyRef}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
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
    return this._client.put(path`/v1/public/properties/${object_name}/${propertyRef}`, { body, ...options });
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
    return this._client.get(path`/v1/public/properties/${objectName}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete Property
   */
  delete(
    propertyRef: string,
    params: PropertyDeleteParams,
    options?: RequestOptions,
  ): APIPromise<PropertyMutation> {
    const { object_name } = params;
    return this._client.delete(path`/v1/public/properties/${object_name}/${propertyRef}`, options);
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

  description?: string | null;

  internal_name?: string | null;

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
}

export interface PropertyUpsert {
  badge_color?: string | null;

  choice_values?: { [key: string]: string } | Array<string> | null;

  conditional_choice_mapping?: { [key: string]: unknown } | null;

  description?: string | null;

  internal_name?: string | null;

  multiple_select?: boolean | null;

  name?: string | null;

  number_format?: string | null;

  order?: number | null;

  required_field?: boolean | null;

  show_badge?: boolean | null;

  tag_values?: Array<string> | null;

  type?: string | null;

  unique?: boolean | null;
}

export type PropertyListResponse = Array<Property>;

export interface PropertyCreateParams {
  badge_color?: string | null;

  choice_values?: { [key: string]: string } | Array<string> | null;

  conditional_choice_mapping?: { [key: string]: unknown } | null;

  description?: string | null;

  internal_name?: string | null;

  multiple_select?: boolean | null;

  name?: string | null;

  number_format?: string | null;

  order?: number | null;

  required_field?: boolean | null;

  show_badge?: boolean | null;

  tag_values?: Array<string> | null;

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
  conditional_choice_mapping?: { [key: string]: unknown } | null;

  /**
   * Body param
   */
  description?: string | null;

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
  order?: number | null;

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

export interface PropertyDeleteParams {
  object_name: string;
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
