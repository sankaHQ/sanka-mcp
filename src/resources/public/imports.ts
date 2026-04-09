// Hand-written public transfer job resource.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { type Uploadable } from '../../core/uploads';
import { RequestOptions } from '../../internal/request-options';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';

export class Imports extends APIResource {
  /**
   * Create Import Job
   */
  create(body: ImportCreateParams, options?: RequestOptions): APIPromise<TransferJob> {
    return this._client.post('/v1/public/imports', { body, ...options });
  }

  /**
   * Get Import Job
   */
  retrieve(jobID: string, options?: RequestOptions): APIPromise<TransferJob> {
    return this._client.get(path`/v1/public/imports/${jobID}`, options);
  }

  /**
   * List Import Jobs
   */
  list(
    params: ImportListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ImportListResponse> {
    return this._client.get('/v1/public/imports', { query: params ?? {}, ...options });
  }

  /**
   * Cancel Import Job
   */
  cancel(jobID: string, options?: RequestOptions): APIPromise<TransferJob> {
    return this._client.post(path`/v1/public/imports/${jobID}/cancel`, { ...options });
  }

  /**
   * Upload Import File
   */
  uploadFile(body: ImportUploadFileParams, options?: RequestOptions): APIPromise<TransferUploadFileResponse> {
    const { object_type, file } = body;
    return this._client.post(
      '/v1/public/files',
      multipartFormRequestOptions(
        {
          body: { file },
          query: { object_type },
          ...options,
        },
        this._client,
      ),
    );
  }
}

export interface TransferColumnMapping {
  source_header: string;
  target_field: string;
}

export interface TransferJobSummary {
  processed?: number | null;
  succeeded?: number | null;
  failed?: number | null;
  total?: number | null;
  requested_count?: number | null;
  skipped_count?: number | null;
  emitted_event_ids?: Array<string>;
}

export interface TransferJob {
  job_id: string;
  job_type: string;
  object_type: string;
  status: string;
  summary: TransferJobSummary;
  mode?: string | null;
  started_async?: boolean;
  source_kind?: string | null;
  destination_kind?: string | null;
  file_format?: string | null;
  file_id?: string | null;
  filename?: string | null;
  provider?: string | null;
  channel_id?: string | null;
  workspace_scope?: string | null;
  message?: string | null;
  error_message?: string | null;
  error_file_url?: string | null;
  ctx_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
}

export interface TransferUploadFileResponse {
  file_id: string;
  ok: boolean;
  object_type: string;
  filename?: string | null;
  ctx_id?: string | null;
}

export interface ImportListResponse {
  jobs: Array<TransferJob>;
  message: string;
  ctx_id?: string | null;
}

export interface ImportCreateParams {
  object_type: string;
  file_id: string;
  source_kind?: string;
  file_format?: string;
  operation?: string;
  mapping_mode?: string;
  key_field?: string | null;
  column_mappings?: Array<TransferColumnMapping>;
  dry_run?: boolean;
}

export interface ImportListParams {
  object_type?: string | null;
  limit?: number;
}

export interface ImportUploadFileParams {
  object_type: string;
  file: Uploadable;
}
