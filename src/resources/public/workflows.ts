// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Workflows extends APIResource {
  /**
   * Get Workflow
   */
  retrieve(workflowRef: string, options?: RequestOptions): APIPromise<WorkflowRetrieveResponse> {
    return this._client.get(path`/v1/public/workflows/${workflowRef}`, options);
  }

  /**
   * List Workflows
   */
  list(
    query: WorkflowListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<WorkflowListResponse> {
    return this._client.get('/v1/public/workflows', { query, ...options });
  }

  /**
   * Create or Update Workflow
   */
  createOrUpdate(
    body: WorkflowCreateOrUpdateParams,
    options?: RequestOptions,
  ): APIPromise<WorkflowCreateOrUpdateResponse> {
    return this._client.post('/v1/public/workflows', { body, ...options });
  }

  /**
   * List Public Workflow Actions
   */
  listActions(options?: RequestOptions): APIPromise<WorkflowListActionsResponse> {
    return this._client.get('/v1/public/workflows/actions', options);
  }

  /**
   * Get Workflow Run
   */
  retrieveRun(runID: string, options?: RequestOptions): APIPromise<WorkflowRunResponse> {
    return this._client.get(path`/v1/public/workflows/runs/${runID}`, options);
  }

  /**
   * Run Workflow
   */
  run(workflowRef: string, options?: RequestOptions): APIPromise<WorkflowRunResponse> {
    return this._client.post(path`/v1/public/workflows/${workflowRef}/run`, options);
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
  config?: { [key: string]: unknown } | null;

  description?: string | null;

  external_id?: string | null;

  is_trigger_active?: boolean | null;

  nodes?: Array<WorkflowCreateOrUpdateParams.Node>;

  status?: string | null;

  title?: string | null;

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

export declare namespace Workflows {
  export {
    type WorkflowRunResponse as WorkflowRunResponse,
    type WorkflowRetrieveResponse as WorkflowRetrieveResponse,
    type WorkflowListResponse as WorkflowListResponse,
    type WorkflowCreateOrUpdateResponse as WorkflowCreateOrUpdateResponse,
    type WorkflowListActionsResponse as WorkflowListActionsResponse,
    type WorkflowListParams as WorkflowListParams,
    type WorkflowCreateOrUpdateParams as WorkflowCreateOrUpdateParams,
  };
}
