// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { V2Envelope, unwrapV2Data } from '../../internal/v2';

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

const compactProperties = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

const taskFromV2Record = (record: V2ObjectRecord): PublicTaskSchema => {
  const properties = record.properties ?? {};
  const numericRecordID =
    (
      typeof record.record_id === 'string' &&
      record.record_id.trim() &&
      Number.isFinite(Number(record.record_id))
    ) ?
      Number(record.record_id)
    : undefined;
  return {
    ...properties,
    id: record.id,
    task_id: numericRecordID ?? (record.record_id as never) ?? null,
  } as PublicTaskSchema;
};

const unwrapV2Task = (promise: APIPromise<V2Envelope<V2ObjectRecord>>): APIPromise<PublicTaskSchema> =>
  promise._thenUnwrap((envelope) => taskFromV2Record(unwrapV2Data(envelope)));

const unwrapV2TaskList = (
  promise: APIPromise<V2Envelope<V2ObjectRecordList>>,
): APIPromise<PublicTasksListResponse> =>
  promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    const items = Array.isArray(data.items) ? data.items : [];
    const page = data.page ?? 1;
    const pageSize = data.page_size ?? items.length;
    const total = data.total ?? items.length;
    return {
      data: items.map(taskFromV2Record),
      page,
      count: items.length,
      total,
      has_next: total > page * pageSize,
      message: 'OK',
      ctx_id: envelope.meta.ctx_id ?? null,
    };
  });

const taskMutationFromV2Record = (
  envelope: V2Envelope<V2ObjectRecord>,
  fallbackStatus: string,
): PublicTaskResponse => {
  const data = unwrapV2Data(envelope);
  const properties = data.properties ?? {};
  return {
    ok: true,
    status: String(properties['status'] ?? properties['usage_status'] ?? fallbackStatus),
    external_id: (properties['external_id'] as string | null | undefined) ?? null,
    task_id: data.id,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

const taskMutationFromV2Lifecycle = (
  envelope: V2Envelope<V2LifecycleData>,
  fallbackStatus: string,
): PublicTaskResponse => {
  const data = unwrapV2Data(envelope);
  return {
    ok: true,
    status: data.status ?? data.usage_status ?? fallbackStatus,
    task_id: data.id ?? null,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

export class Tasks extends APIResource {
  /**
   * Create Task
   */
  create(body: TaskCreateParams, options?: RequestOptions): APIPromise<PublicTaskResponse> {
    return this._client
      .v2Post<V2ObjectRecord>('/tasks', {
        body: { properties: compactProperties(body as never) },
        ...options,
      })
      ._thenUnwrap((envelope) => taskMutationFromV2Record(envelope, 'created'));
  }

  /**
   * Get Task
   */
  retrieve(
    taskID: string,
    params: TaskRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicTaskSchema> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    void query;
    return unwrapV2Task(
      this._client.v2Get<V2ObjectRecord>(path`/tasks/${taskID}`, {
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
    );
  }

  /**
   * Update Task
   */
  update(taskID: string, params: TaskUpdateParams, options?: RequestOptions): APIPromise<PublicTaskResponse> {
    const { external_id, body_external_id, ...body } = params;
    void external_id;
    return this._client
      .v2Patch<V2ObjectRecord>(path`/tasks/${taskID}`, {
        body: {
          properties: compactProperties({
            ...body,
            ...(body_external_id !== undefined ? { external_id: body_external_id } : undefined),
          } as never),
        },
        ...options,
      })
      ._thenUnwrap((envelope) => taskMutationFromV2Record(envelope, 'updated'));
  }
  /**
   * List Tasks
   */
  list(
    params: TaskListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicTasksListResponse> {
    const {
      'Accept-Language': acceptLanguage,
      workspace_id: _workspaceID,
      lang: _lang,
      language: _language,
      limit,
      ...query
    } = params ?? {};
    void _workspaceID;
    void _lang;
    void _language;
    return unwrapV2TaskList(
      this._client.v2Get<V2ObjectRecordList>('/tasks', {
        query: {
          ...query,
          ...(limit !== undefined && limit !== null ? { page_size: limit } : undefined),
        },
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
    );
  }

  /**
   * Delete Task
   */
  delete(
    taskID: string,
    params: TaskDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicTaskResponse> {
    const { external_id } = params ?? {};
    void external_id;
    return this._client
      .v2Delete<V2LifecycleData>(path`/tasks/${taskID}`, options)
      ._thenUnwrap((envelope) => taskMutationFromV2Lifecycle(envelope, 'archived'));
  }
}

export interface PublicTaskRequest {
  external_id?: string | null;

  title?: string | null;

  description?: string | null;

  status?: string | null;

  usage_status?: string | null;

  project_id?: string | null;

  start_date?: string | null;

  due_date?: string | null;

  main_task_id?: string | null;

  owner_id?: string | null;

  assignees?: Array<string> | null;

  projects?: Array<string> | null;
}

export interface PublicTaskResponse {
  ok: boolean;

  status: string;

  external_id?: string | null;

  task_id?: string | null;

  ctx_id?: string | null;
}

export interface PublicTaskSchema {
  id?: string | null;

  task_id?: number | null;

  external_id?: string | null;

  title?: string | null;

  description?: string | null;

  status?: string | null;

  status_label?: string | null;

  usage_status?: string | null;

  project_id?: string | null;

  project_title?: string | null;

  main_task_id?: string | null;

  owner_id?: string | null;

  start_date?: string | null;

  due_date?: string | null;

  created_at?: string | null;

  updated_at?: string | null;
}

export interface PublicTasksListResponse {
  data: Array<PublicTaskSchema>;

  page: number;

  count: number;

  total: number;

  has_next: boolean;

  message: string;

  ctx_id?: string | null;
}

export interface TaskCreateParams {
  external_id?: string | null;

  title?: string | null;

  description?: string | null;

  status?: string | null;

  usage_status?: string | null;

  project_id?: string | null;

  start_date?: string | null;

  due_date?: string | null;

  main_task_id?: string | null;

  owner_id?: string | null;

  assignees?: Array<string> | null;

  projects?: Array<string> | null;
}

export interface TaskRetrieveParams {
  /**
   * Query param
   */
  workspace_id?: string | null;

  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface TaskUpdateParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Body param
   */
  body_external_id?: string | null;

  /**
   * Body param
   */
  title?: string | null;

  /**
   * Body param
   */
  description?: string | null;

  /**
   * Body param
   */
  status?: string | null;

  /**
   * Body param
   */
  usage_status?: string | null;

  /**
   * Body param
   */
  project_id?: string | null;

  /**
   * Body param
   */
  start_date?: string | null;

  /**
   * Body param
   */
  due_date?: string | null;

  /**
   * Body param
   */
  main_task_id?: string | null;

  /**
   * Body param
   */
  owner_id?: string | null;

  /**
   * Body param
   */
  assignees?: Array<string> | null;

  /**
   * Body param
   */
  projects?: Array<string> | null;
}

export interface TaskListParams {
  /**
   * Query param
   */
  search?: string | null;

  /**
   * Query param
   */
  usage_status?: string | null;

  /**
   * Query param
   */
  project_id?: string | null;

  /**
   * Query param
   */
  page?: number;

  /**
   * Query param
   */
  limit?: number | null;

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

export interface TaskDeleteParams {
  external_id?: string | null;
}

export declare namespace Tasks {
  export {
    type PublicTaskRequest as PublicTaskRequest,
    type PublicTaskResponse as PublicTaskResponse,
    type PublicTaskSchema as PublicTaskSchema,
    type PublicTasksListResponse as PublicTasksListResponse,
    type TaskCreateParams as TaskCreateParams,
    type TaskRetrieveParams as TaskRetrieveParams,
    type TaskUpdateParams as TaskUpdateParams,
    type TaskListParams as TaskListParams,
    type TaskDeleteParams as TaskDeleteParams,
  };
}
