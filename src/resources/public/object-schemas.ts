// Hand-written public object schema resource for the V2 migration.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { unwrapV2Data } from '../../internal/v2';

export class ObjectSchemas extends APIResource {
  /**
   * List Object Schemas
   */
  list(
    params: ObjectSchemaListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ObjectSchemaListResponse> {
    return this._client
      .v2Get<Array<Record<string, unknown>>>('/object-schemas', {
        query: params ?? {},
        ...options,
      })
      ._thenUnwrap((envelope) => unwrapV2Data(envelope).map(objectSchemaFromV2));
  }

  /**
   * Mutate Object Schema
   */
  mutate(
    body: ObjectSchemaMutationParams,
    options?: RequestOptions,
  ): APIPromise<ObjectSchemaMutationResponse> {
    return this._client
      .v2Post<ObjectSchemaMutationResponse>('/object-schemas', {
        body,
        ...options,
      })
      ._thenUnwrap((envelope) => ({
        ...unwrapV2Data(envelope),
        ctx_id: envelope.meta.ctx_id ?? null,
      }));
  }
}

const objectSchemaFromV2 = (value: unknown): ObjectSchema => {
  const row =
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    ...row,
    id: String(row['id'] ?? row['object_schema_id'] ?? row['slug'] ?? ''),
    name: (row['name'] as string | null | undefined) ?? null,
    slug: (row['slug'] as string | null | undefined) ?? null,
    scope: (row['scope'] as string | null | undefined) ?? 'sanka',
  };
};

export interface ObjectSchema {
  id: string;
  name?: string | null;
  slug?: string | null;
  scope?: string | null;
  external_id?: string | null;
  external_object_type?: string | null;
  provider?: string | null;
  raw?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export type ObjectSchemaListResponse = Array<ObjectSchema>;

export interface ObjectSchemaListParams {
  scope?: string | null;
  source?: string | null;
  provider?: string | null;
  channel_id?: string | null;
  custom_only?: boolean | null;
  search?: string | null;
  limit?: number | null;
  workspace_id?: string | null;
}

export interface ObjectSchemaMutationParams {
  operation: string;
  target?: string | null;
  provider?: string | null;
  channel_id?: string | null;
  schema_ref?: string | null;
  external_object_type?: string | null;
  name?: string | null;
  slug?: string | null;
  singular_label?: string | null;
  plural_label?: string | null;
  labels?: Record<string, unknown> | null;
  description?: string | null;
  primary_display_property?: string | null;
  required_properties?: Array<string> | null;
  searchable_properties?: Array<string> | null;
  secondary_display_properties?: Array<string> | null;
  properties?: Array<Record<string, unknown>> | null;
  associations?: Array<Record<string, unknown>> | null;
  dry_run?: boolean | null;
  confirm?: boolean | null;
}

export interface ObjectSchemaMutationResponse {
  ok?: boolean;
  status?: string;
  operation?: string;
  target?: string;
  object_schema_id?: string | null;
  name?: string | null;
  slug?: string | null;
  provider?: string | null;
  channel_id?: string | null;
  channel_name?: string | null;
  external_object_type?: string | null;
  external_id?: string | null;
  dry_run?: boolean | null;
  message?: string | null;
  ctx_id?: string | null;
  [key: string]: unknown;
}

export declare namespace ObjectSchemas {
  export {
    type ObjectSchema as ObjectSchema,
    type ObjectSchemaListResponse as ObjectSchemaListResponse,
    type ObjectSchemaListParams as ObjectSchemaListParams,
    type ObjectSchemaMutationParams as ObjectSchemaMutationParams,
    type ObjectSchemaMutationResponse as ObjectSchemaMutationResponse,
  };
}
