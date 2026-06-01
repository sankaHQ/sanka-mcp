// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { V2Envelope, unwrapV2Data } from '../../internal/v2';

type V2WorkflowListData = {
  items?: Array<Record<string, unknown>>;
  total?: number;
  page?: number;
  page_size?: number;
};

type V2WorkflowDetailData = {
  workflow?: Record<string, unknown>;
};

type V2WorkflowActionsData = {
  actions?: Array<Record<string, unknown>>;
  count?: number;
};

type V2WorkflowMutationData = Record<string, unknown>;

const workflowFromV2 = (workflow: Record<string, unknown>): WorkflowRetrieveResponse => {
  const workflowID = String(workflow['workflow_id'] ?? workflow['id'] ?? '');
  return {
    ...workflow,
    external_id: String(workflow['external_id'] ?? workflow['id'] ?? workflowID),
    workflow_id: workflowID,
    is_trigger_active: workflow['is_trigger_active'] === true,
    valid_to_run: workflow['valid_to_run'] === true,
  } as WorkflowRetrieveResponse;
};

const unwrapV2WorkflowList = (
  promise: APIPromise<V2Envelope<V2WorkflowListData>>,
): APIPromise<WorkflowListResponse> => {
  return promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    const items = Array.isArray(data.items) ? data.items : [];
    return {
      count: data.total ?? items.length,
      data: items.map(workflowFromV2) as WorkflowListResponse.Data[],
      limit: data.page_size ?? items.length,
      page: data.page ?? 1,
      ctx_id: envelope.meta.ctx_id ?? null,
    };
  });
};

const unwrapV2WorkflowDetail = (
  promise: APIPromise<V2Envelope<V2WorkflowDetailData>>,
): APIPromise<WorkflowRetrieveResponse> => {
  return promise._thenUnwrap((envelope) => workflowFromV2(unwrapV2Data(envelope).workflow ?? {}));
};

const unwrapV2WorkflowActions = (
  promise: APIPromise<V2Envelope<V2WorkflowActionsData>>,
): APIPromise<WorkflowListActionsResponse> => {
  return promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    const actions = Array.isArray(data.actions) ? data.actions : [];
    return {
      count: data.count ?? actions.length,
      data: actions as unknown as WorkflowListActionsResponse.Data[],
      ctx_id: envelope.meta.ctx_id ?? null,
    };
  });
};

const unwrapV2WorkflowRun = (
  promise: APIPromise<V2Envelope<WorkflowRunResponse.Data>>,
): APIPromise<WorkflowRunResponse> => {
  return promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    const message = (data as unknown as Record<string, unknown>)['message'];
    return {
      data,
      message: typeof message === 'string' ? message : 'ok',
      ctx_id: envelope.meta.ctx_id ?? null,
    };
  });
};

const unwrapV2WorkflowMutation = (
  promise: APIPromise<V2Envelope<V2WorkflowMutationData>>,
): APIPromise<WorkflowCreateOrUpdateResponse> => {
  return promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    return {
      ...data,
      ok: data['ok'] !== false,
      external_id: String(data['external_id'] ?? data['workflow_id'] ?? ''),
      workflow_id: String(data['workflow_id'] ?? ''),
      node_count: Number(data['node_count'] ?? 0),
      status: String(data['status'] ?? ''),
      valid_to_run: data['valid_to_run'] === true,
      ctx_id: envelope.meta.ctx_id ?? null,
    } as WorkflowCreateOrUpdateResponse;
  });
};

const REQUEST_OPTION_KEYS = new Set([
  'method',
  'path',
  'query',
  'body',
  'headers',
  'maxRetries',
  'stream',
  'timeout',
  'fetchOptions',
  'signal',
  'idempotencyKey',
  'defaultBaseURL',
  '__binaryResponse',
]);

const isRequestOptions = (value: unknown): value is RequestOptions => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length > 0 && keys.every((key) => REQUEST_OPTION_KEYS.has(key));
};

export class Workflows extends APIResource {
  /**
   * Get Workflow
   */
  retrieve(workflowRef: string, options?: RequestOptions): APIPromise<WorkflowRetrieveResponse> {
    return unwrapV2WorkflowDetail(this._client.get(path`/api/v2/public/workflows/${workflowRef}`, options));
  }

  /**
   * List Workflows
   */
  list(
    query: WorkflowListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<WorkflowListResponse> {
    return unwrapV2WorkflowList(this._client.get('/api/v2/public/workflows', { query, ...options }));
  }

  /**
   * Create or Update Workflow
   */
  createOrUpdate(
    body: WorkflowCreateOrUpdateParams,
    options?: RequestOptions,
  ): APIPromise<WorkflowCreateOrUpdateResponse> {
    return unwrapV2WorkflowMutation(this._client.post('/api/v2/public/workflows', { body, ...options }));
  }

  /**
   * Update Workflow
   */
  update(
    workflowRef: string,
    body: WorkflowCreateOrUpdateParams,
    options?: RequestOptions,
  ): APIPromise<WorkflowCreateOrUpdateResponse> {
    return unwrapV2WorkflowMutation(
      this._client.patch(path`/api/v2/public/workflows/${workflowRef}`, { body, ...options }),
    );
  }

  /**
   * List Public Workflow Actions
   */
  listActions(options?: RequestOptions): APIPromise<WorkflowListActionsResponse> {
    return unwrapV2WorkflowActions(this._client.get('/api/v2/public/workflows/actions', options));
  }

  /**
   * Get Workflow Run
   */
  retrieveRun(runID: string, options?: RequestOptions): APIPromise<WorkflowRunResponse> {
    return unwrapV2WorkflowRun(this._client.get(path`/api/v2/public/workflow-runs/${runID}`, options));
  }

  /**
   * Run Workflow
   */
  run(workflowRef: string, options?: RequestOptions): APIPromise<WorkflowRunResponse>;
  run(
    workflowRef: string,
    body: WorkflowRunParams | null | undefined,
    options?: RequestOptions,
  ): APIPromise<WorkflowRunResponse>;
  run(
    workflowRef: string,
    bodyOrOptions: WorkflowRunParams | RequestOptions | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<WorkflowRunResponse> {
    const requestOptions = options ?? (isRequestOptions(bodyOrOptions) ? bodyOrOptions : undefined);
    const body =
      !options && isRequestOptions(bodyOrOptions) ?
        {}
      : (bodyOrOptions as WorkflowRunParams | null | undefined) ?? {};
    return unwrapV2WorkflowRun(
      this._client.post(path`/api/v2/public/workflows/${workflowRef}/run`, {
        body,
        ...requestOptions,
      }),
    );
  }
}

export interface WorkflowRunResponse {
  data: WorkflowRunResponse.Data;

  message: string;

  ctx_id?: string | null;
}

export namespace WorkflowRunResponse {
  export interface Data {
    run_id: string;

    started_at: string;

    status: string;

    workflow_id: string;

    background_job_id?: string | null;

    completed_at?: string | null;

    workflow_history_id?: string | null;
  }
}

export interface WorkflowRetrieveResponse {
  external_id: string;

  is_trigger_active: boolean;

  valid_to_run: boolean;

  workflow_id: string;

  ctx_id?: string | null;

  description?: string | null;

  nodes?: Array<WorkflowRetrieveResponse.Node>;

  status?: string | null;

  title?: string | null;

  trigger_every?: number | null;

  trigger_type?: string | null;
}

export namespace WorkflowRetrieveResponse {
  export interface Node {
    id: string;

    is_base: boolean;

    valid_to_run: boolean;

    action_id?: string | null;

    action_slug?: string | null;

    action_uid?: string | null;

    condition_groups?: Array<Node.ConditionGroup>;

    cost_minutes?: number | null;

    input_data?: { [key: string]: unknown } | null;

    integration_id?: string | null;

    integration_slug?: string | null;

    predefined_input?: { [key: string]: unknown } | null;

    previous_output_data?: { [key: string]: unknown } | null;

    user_display_name?: string | null;
  }

  export namespace Node {
    export interface ConditionGroup {
      id: string;

      operator: string;

      conditions?: Array<ConditionGroup.Condition>;

      parent_group_id?: string | null;
    }

    export namespace ConditionGroup {
      export interface Condition {
        id: string;

        extra_condition?: { [key: string]: unknown } | null;

        field_name?: string | null;

        object_type?: string | null;

        operator?: string | null;

        record_ids?: string | null;

        record_source?: string | null;

        value_date?: string | null;

        value_datetime?: string | null;

        value_number?: number | null;

        value_text?: string | null;

        value_type?: string | null;
      }
    }
  }
}

export interface WorkflowListResponse {
  count: number;

  data: Array<WorkflowListResponse.Data>;

  limit: number;

  page: number;

  ctx_id?: string | null;
}

export namespace WorkflowListResponse {
  export interface Data {
    external_id: string;

    is_trigger_active: boolean;

    valid_to_run: boolean;

    workflow_id: string;

    description?: string | null;

    status?: string | null;

    title?: string | null;

    trigger_every?: number | null;

    trigger_type?: string | null;

    updated_at?: string | null;
  }
}

export interface WorkflowCreateOrUpdateResponse {
  external_id: string;

  node_count: number;

  ok: boolean;

  status: string;

  valid_to_run: boolean;

  workflow_id: string;

  ctx_id?: string | null;

  channel_id?: string | null;

  dry_run?: boolean;

  operation?: string;

  platform_payload?: { [key: string]: unknown } | null;

  platform_response?: { [key: string]: unknown } | null;

  provider?: string;

  warnings?: Array<string>;
}

export interface WorkflowListActionsResponse {
  count: number;

  data: Array<WorkflowListActionsResponse.Data>;

  ctx_id?: string | null;
}

export namespace WorkflowListActionsResponse {
  export interface Data {
    action_uid: string;

    is_trigger: boolean;

    action_slug?: string | null;

    input_format?: { [key: string]: unknown } | null;

    output_format?: { [key: string]: unknown } | null;

    required_conditions?: { [key: string]: unknown } | null;

    title?: string | null;

    title_ja?: string | null;

    trigger_type?: string | null;
  }
}

export interface WorkflowListParams {
  limit?: number;

  page?: number;
}

export interface WorkflowCreateOrUpdateParams {
  actions?: Array<{ [key: string]: unknown }>;

  channel_id?: string | null;

  config?: { [key: string]: unknown } | null;

  confirm?: boolean;

  description?: string | null;

  dry_run?: boolean;

  external_id?: string | null;

  is_trigger_active?: boolean | null;

  nodes?: Array<WorkflowCreateOrUpdateParams.Node>;

  object_type?: string | null;

  platform_payload?: { [key: string]: unknown } | null;

  provider?: 'sanka' | 'hubspot' | string | null;

  revision_id?: string | null;

  status?: string | null;

  title?: string | null;

  trigger?: { [key: string]: unknown } | null;

  trigger_every?: number | null;

  trigger_type?: string | null;

  type?: string | null;

  [k: string]: unknown;
}

export namespace WorkflowCreateOrUpdateParams {
  export interface Node {
    id?: string | null;

    action_id?: string | null;

    action_slug?: string | null;

    action_uid?: string | null;

    condition_groups?: Array<Node.ConditionGroup>;

    cost_minutes?: number | null;

    input_data?: { [key: string]: unknown } | null;

    integration_id?: string | null;

    integration_slug?: string | null;

    is_base?: boolean | null;

    predefined_input?: { [key: string]: unknown } | null;

    previous_output_data?: { [key: string]: unknown } | null;

    user_display_name?: string | null;

    valid_to_run?: boolean | null;
  }

  export namespace Node {
    export interface ConditionGroup {
      id?: string | null;

      conditions?: Array<ConditionGroup.Condition>;

      operator?: string;

      parent_group_id?: string | null;
    }

    export namespace ConditionGroup {
      export interface Condition {
        id?: string | null;

        extra_condition?: { [key: string]: unknown } | null;

        field_name?: string | null;

        object_type?: string | null;

        operator?: string | null;

        record_ids?: string | null;

        record_source?: string | null;

        value_date?: string | null;

        value_datetime?: string | null;

        value_number?: number | null;

        value_text?: string | null;

        value_type?: string | null;
      }
    }
  }
}

export interface WorkflowRunParams {
  channel_id?: string | null;

  confirm?: boolean;

  dry_run?: boolean;

  external_id?: string | null;

  options?: { [key: string]: unknown };

  payload?: { [key: string]: unknown };

  provider?: 'sanka' | 'hubspot' | string | null;

  [k: string]: unknown;
}

export declare namespace Workflows {
  export {
    type WorkflowRunResponse as WorkflowRunResponse,
    type WorkflowRetrieveResponse as WorkflowRetrieveResponse,
    type WorkflowListResponse as WorkflowListResponse,
    type WorkflowCreateOrUpdateResponse as WorkflowCreateOrUpdateResponse,
    type WorkflowListActionsResponse as WorkflowListActionsResponse,
    type WorkflowListParams as WorkflowListParams,
    type WorkflowCreateOrUpdateParams as WorkflowCreateOrUpdateParams,
    type WorkflowRunParams as WorkflowRunParams,
  };
}
