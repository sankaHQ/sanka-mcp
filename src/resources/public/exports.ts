// Hand-written public transfer job resource.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import type * as ImportsAPI from './imports';

export class Exports extends APIResource {
  /**
   * Create Export Job
   */
  create(body: ExportCreateParams, options?: RequestOptions): APIPromise<ImportsAPI.TransferJob> {
    return this._client.post('/v1/public/exports', { body, ...options });
  }

  /**
   * Get Export Job
   */
  retrieve(jobID: string, options?: RequestOptions): APIPromise<ImportsAPI.TransferJob> {
    return this._client.get(path`/v1/public/exports/${jobID}`, options);
  }

  /**
   * List Export Jobs
   */
  list(
    params: ExportListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ExportListResponse> {
    return this._client.get('/v1/public/exports', { query: params ?? {}, ...options });
  }

  /**
   * Cancel Export Job
   */
  cancel(jobID: string, options?: RequestOptions): APIPromise<ImportsAPI.TransferJob> {
    return this._client.post(path`/v1/public/exports/${jobID}/cancel`, { ...options });
  }
}

export interface ExportListResponse {
  jobs: Array<ImportsAPI.TransferJob>;
  message: string;
  ctx_id?: string | null;
}

export interface ExportCreateParams {
  object_type: string;
  destination_kind?: string;
  provider?: string | null;
  channel_id?: string | null;
  operation?: string;
  record_ids?: Array<string> | null;
  workspace_scope?: string | null;
  custom_object_id?: string | null;
  limit?: number;
  file_format?: string | null;
  dry_run?: boolean;
}

export interface ExportListParams {
  object_type?: string | null;
  limit?: number;
}
