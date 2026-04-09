// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Tasks extends APIResource {
  /**
   * Create Task
   */
  create(body: TaskCreateParams, options?: RequestOptions): APIPromise<PublicTaskResponse> {
    return this._client.post('/v1/public/tasks', { body, ...options });
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
    return this._client.get(path`/v1/public/tasks/${taskID}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Task
   */
  update(taskID: string, params: TaskUpdateParams, options?: RequestOptions): APIPromise<PublicTaskResponse> {
    const { external_id, body_external_id, ...body } = params;
    return this._client.put(path`/v1/public/tasks/${taskID}`, {
      query: { external_id },
      body: {
        ...(body_external_id !== undefined ? { external_id: body_external_id } : undefined),
        ...body,
      },
      ...options,
    });
  }

  /**
   * List Tasks
   */
  list(
    params: TaskListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicTasksListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/tasks', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
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
    return this._client.delete(path`/v1/public/tasks/${taskID}`, { query: { external_id }, ...options });
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
