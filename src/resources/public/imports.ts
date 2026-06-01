// Hand-written public transfer job resource.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { type Uploadable } from '../../core/uploads';
import { RequestOptions } from '../../internal/request-options';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';
import { unwrapV2Data, unwrapV2DataPromise } from '../../internal/v2';

export class Imports extends APIResource {
  /**
   * Create Import Job
   */
  create(body: ImportCreateParams, options?: RequestOptions): APIPromise<TransferJob> {
    return unwrapV2DataPromise(this._client.v2Post<TransferJob>('/imports', { body, ...options }));
  }

  /**
   * Get Import Job
   */
  retrieve(jobID: string, options?: RequestOptions): APIPromise<TransferJob> {
    return unwrapV2DataPromise(this._client.v2Get<TransferJob>(path`/imports/${jobID}`, options));
  }

  /**
   * List Import Jobs
   */
  list(
    params: ImportListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ImportListResponse> {
    return unwrapV2DataPromise(
      this._client.v2Get<ImportListResponse>('/imports', { query: params ?? {}, ...options }),
    );
  }

  /**
   * Cancel Import Job
   */
  cancel(jobID: string, options?: RequestOptions): APIPromise<TransferJob> {
    return this._client
      .v2Post<TransferJobCancelResponse>(path`/imports/${jobID}/cancel`, { ...options })
      ._thenUnwrap((envelope) => unwrapV2Data(envelope).job);
  }

  /**
   * Retry Import Job
   */
  retry(jobID: string, options?: RequestOptions): APIPromise<TransferJobRetryResponse> {
    return unwrapV2DataPromise(
      this._client.v2Post<TransferJobRetryResponse>(path`/imports/${jobID}/retry`, {
        ...options,
      }),
    );
  }

  /**
   * Upload Import File
   */
  uploadFile(body: ImportUploadFileParams, options?: RequestOptions): APIPromise<TransferUploadFileResponse> {
    const { object_type, file } = body;
    return this._client
      .v2Post<V2FileUploadResponse>(
        '/files',
        multipartFormRequestOptions(
          {
            body: { file },
            query: { object_type },
            ...options,
          },
          this._client,
        ),
      )
      ._thenUnwrap((envelope) => {
        const data = unwrapV2Data(envelope);
        return {
          ...data,
          file_id: data.id,
          ok: true,
          object_type,
        };
      });
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
  created_record_ids?: Array<string>;
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

export interface TransferJobCancelResponse {
  job: TransferJob;
  canceled?: boolean | null;
  message?: string | null;
}

export interface TransferJobRetryResponse {
  job: TransferJob;
  retry_of_job_id: string;
  message?: string | null;
}

export interface V2FileUploadResponse {
  id: string;
  filename: string;
  url: string;
  relative_path: string;
}

export interface TransferUploadFileResponse {
  file_id: string;
  ok: boolean;
  object_type: string;
  filename?: string | null;
  ctx_id?: string | null;
  id?: string | null;
  url?: string | null;
  relative_path?: string | null;
}

export interface ImportListResponse {
  jobs: Array<TransferJob>;
  message: string;
  ctx_id?: string | null;
}

export interface ImportCreateParams {
  object_type: string;
  file_id?: string | null;
  provider?: string | null;
  channel_id?: string | null;
  record_ids?: Array<string> | null;
  source_record?: Record<string, unknown> | null;
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
