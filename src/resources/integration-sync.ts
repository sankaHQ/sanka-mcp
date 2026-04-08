// Hand-written addition for the integration-sync push endpoint. Tracked for
// inclusion in the next Stainless regeneration; safe to edit until then.

import { APIResource } from '../core/resource';
import { APIPromise } from '../core/api-promise';
import { RequestOptions } from '../internal/request-options';

export class IntegrationSync extends APIResource {
  /**
   * Emit outbound integration sync events for a set of records. Accepts
   * either an explicit ``record_ids`` list or ``workspace_scope: "all"`` to
   * push every eligible record for the given ``object_type``.
   */
  push(body: IntegrationSyncPushParams, options?: RequestOptions): APIPromise<IntegrationSyncPushResponse> {
    return this._client.post('/v1/integration-sync/push', { body, ...options });
  }
}

export interface IntegrationSyncPushResponse {
  channel_id: string;

  object_type: string;

  operation: string;

  requested_count: number;

  emitted_event_ids: string[];

  skipped_count: number;

  message: string;

  ctx_id?: string | null;
}

export interface IntegrationSyncPushParams {
  /**
   * Destination integration channel setting UUID.
   */
  channel_id: string;

  /**
   * Object type to push, e.g. ``company``, ``contact``, ``deal``.
   */
  object_type: string;

  /**
   * Explicit list of record UUIDs to push. Mutually exclusive with
   * ``workspace_scope``.
   */
  record_ids?: string[] | null;

  /**
   * Use ``"all"`` to push every eligible record in the workspace. Mutually
   * exclusive with ``record_ids``.
   */
  workspace_scope?: string | null;

  /**
   * Operation to perform on the destination system. Defaults to ``update``.
   */
  operation?: string;

  /**
   * Optional custom object id when ``object_type`` is ``custom``.
   */
  custom_object_id?: string | null;

  /**
   * Maximum number of records to push in one call. Defaults to ``200``.
   */
  limit?: number;
}

export declare namespace IntegrationSync {
  export {
    type IntegrationSyncPushResponse as IntegrationSyncPushResponse,
    type IntegrationSyncPushParams as IntegrationSyncPushParams,
  };
}
