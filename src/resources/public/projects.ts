// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { compactProperties } from '../../internal/v2-object-records';
import { V2Envelope, unwrapV2Data } from '../../internal/v2';

const buildProjectHeaders = (
  acceptLanguage: string | undefined,
  xLanguage: string | undefined,
  options?: RequestOptions,
) =>
  buildHeaders([
    {
      ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined),
      ...(xLanguage != null ? { 'X-Language': xLanguage } : undefined),
    },
    options?.headers,
  ]);

type V2PublicProjectListData = {
  items?: Array<PublicProject>;
  page?: number;
  page_size?: number;
  total?: number;
  next_cursor?: string | null;
  meta?: Record<string, unknown> | null;
};

const unwrapProjectList = (
  promise: APIPromise<V2Envelope<V2PublicProjectListData>>,
): APIPromise<PublicProjectsListResponse> =>
  promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    const items = Array.isArray(data.items) ? data.items : [];
    const page = data.page ?? 1;
    const pageSize = data.page_size ?? items.length;
    const total = data.total ?? items.length;
    const hasNext = data.next_cursor != null || (pageSize > 0 && total > page * pageSize);
    return {
      data: items,
      page,
      count: items.length,
      total,
      limit: pageSize,
      has_next: hasNext,
      next_page: hasNext ? page + 1 : null,
      pagination: data.meta ?? null,
      message: 'OK',
      ctx_id: envelope.meta.ctx_id ?? null,
    };
  });

const unwrapProjectData = <T extends { ctx_id?: string | null }>(
  promise: APIPromise<V2Envelope<T>>,
): APIPromise<T> =>
  promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    return {
      ...data,
      ctx_id: data.ctx_id ?? envelope.meta.ctx_id ?? null,
    };
  });

export class Projects extends APIResource {
  /**
   * List Projects
   */
  list(
    params: ProjectListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicProjectsListResponse> {
    const {
      'Accept-Language': acceptLanguage,
      'X-Language': xLanguage,
      workspace_id,
      default: isDefault,
      limit,
      page,
      search,
      lang,
      language,
    } = params ?? {};
    return unwrapProjectList(
      this._client.v2Get<V2PublicProjectListData>('/public/projects', {
        query: {
          ...(workspace_id != null ? { workspace_id } : undefined),
          ...(isDefault != null ? { default: isDefault } : undefined),
          ...(limit != null ? { limit } : undefined),
          ...(page != null ? { page } : undefined),
          ...(search != null ? { search } : undefined),
          ...(lang != null ? { lang } : undefined),
          ...(language != null ? { language } : undefined),
        },
        ...options,
        headers: buildProjectHeaders(acceptLanguage, xLanguage, options),
      }),
    );
  }

  /**
   * Get Project
   */
  retrieve(
    projectID: string,
    params: ProjectRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicProject> {
    const { 'Accept-Language': acceptLanguage, 'X-Language': xLanguage, workspace_id } = params ?? {};
    return this._client
      .v2Get<PublicProject>(path`/public/projects/${projectID}`, {
        query: {
          ...(workspace_id != null ? { workspace_id } : undefined),
        },
        ...options,
        headers: buildProjectHeaders(acceptLanguage, xLanguage, options),
      })
      ._thenUnwrap((envelope) => unwrapV2Data(envelope));
  }

  /**
   * Create Project
   */
  create(params: ProjectCreateParams, options?: RequestOptions): APIPromise<PublicProjectMutationResponse> {
    const { 'Accept-Language': acceptLanguage, 'X-Language': xLanguage, ...body } = params;
    return unwrapProjectData(
      this._client.v2Post<PublicProjectMutationResponse>('/public/projects', {
        body: compactProperties(body as Record<string, unknown>),
        ...options,
        headers: buildProjectHeaders(acceptLanguage, xLanguage, options),
      }),
    );
  }

  /**
   * Update Project
   */
  update(
    projectID: string,
    params: ProjectUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PublicProjectMutationResponse> {
    const { 'Accept-Language': acceptLanguage, 'X-Language': xLanguage, ...body } = params;
    return unwrapProjectData(
      this._client.v2Put<PublicProjectMutationResponse>(path`/public/projects/${projectID}`, {
        body: compactProperties(body as Record<string, unknown>),
        ...options,
        headers: buildProjectHeaders(acceptLanguage, xLanguage, options),
      }),
    );
  }

  /**
   * Delete Project
   */
  delete(
    projectID: string,
    params: ProjectDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicProjectDeleteResponse> {
    const {
      'Accept-Language': acceptLanguage,
      'X-Language': xLanguage,
      replacement_project_id,
      clear_task_project,
    } = params ?? {};
    return unwrapProjectData(
      this._client.v2Delete<PublicProjectDeleteResponse>(path`/public/projects/${projectID}`, {
        query: {
          ...(replacement_project_id != null ? { replacement_project_id } : undefined),
          ...(clear_task_project != null ? { clear_task_project } : undefined),
        },
        ...options,
        headers: buildProjectHeaders(acceptLanguage, xLanguage, options),
      }),
    );
  }
}

export interface PublicProjectStatus {
  id?: string | null;

  name?: string | null;

  internal_value?: string | null;

  order?: number | null;
}

export interface PublicProject {
  id: string;

  project_id: string;

  title?: string | null;

  description?: string | null;

  default?: boolean | null;

  statuses?: Array<PublicProjectStatus> | null;

  task_count?: number | null;

  active_task_count?: number | null;

  created_at?: string | null;

  updated_at?: string | null;
}

export interface PublicProjectsListResponse {
  data: Array<PublicProject>;

  page: number;

  count: number;

  total: number;

  limit?: number | null;

  has_next: boolean;

  next_page?: number | null;

  pagination?: Record<string, unknown> | null;

  message: string;

  ctx_id?: string | null;
}

export interface PublicProjectMutationResponse {
  ok: boolean;

  status: string;

  id?: string | null;

  project_id?: string | null;

  project?: PublicProject | null;

  ctx_id?: string | null;

  advisories?: Array<Record<string, unknown>> | null;
}

export interface PublicProjectDeleteResponse {
  ok: boolean;

  status: string;

  id?: string | null;

  project_id?: string | null;

  replacement_project_id?: string | null;

  cleared_task_count?: number | null;

  reassigned_task_count?: number | null;

  ctx_id?: string | null;

  advisories?: Array<Record<string, unknown>> | null;
}

export interface ProjectListParams {
  /**
   * Query param
   */
  search?: string | null;

  /**
   * Query param
   */
  default?: boolean | null;

  /**
   * Query param
   */
  page?: number | null;

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

  /**
   * Header param
   */
  'X-Language'?: string;
}

export interface ProjectRetrieveParams {
  /**
   * Query param
   */
  workspace_id?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;

  /**
   * Header param
   */
  'X-Language'?: string;
}

export interface ProjectCreateParams {
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
  default?: boolean | null;

  /**
   * Body param
   */
  statuses?: Array<PublicProjectStatus> | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;

  /**
   * Header param
   */
  'X-Language'?: string;
}

export interface ProjectUpdateParams extends ProjectCreateParams {}

export interface ProjectDeleteParams {
  /**
   * Query param
   */
  replacement_project_id?: string | null;

  /**
   * Query param
   */
  clear_task_project?: boolean | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;

  /**
   * Header param
   */
  'X-Language'?: string;
}

export declare namespace Projects {
  export {
    type PublicProjectStatus as PublicProjectStatus,
    type PublicProject as PublicProject,
    type PublicProjectsListResponse as PublicProjectsListResponse,
    type PublicProjectMutationResponse as PublicProjectMutationResponse,
    type PublicProjectDeleteResponse as PublicProjectDeleteResponse,
    type ProjectListParams as ProjectListParams,
    type ProjectRetrieveParams as ProjectRetrieveParams,
    type ProjectCreateParams as ProjectCreateParams,
    type ProjectUpdateParams as ProjectUpdateParams,
    type ProjectDeleteParams as ProjectDeleteParams,
  };
}
