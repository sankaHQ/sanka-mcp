// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { type Uploadable } from '../../core/uploads';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';
import { unwrapV2DataPromise } from '../../internal/v2';
import {
  V2LifecycleData,
  V2ObjectRecord,
  V2ObjectRecordList,
  compactProperties,
  legacyDeleteResponseFromV2,
  legacyMutationResponseFromV2,
  legacyObjectRecordFromV2,
  unwrapV2ObjectRecord,
  unwrapV2ObjectRecordArray,
} from '../../internal/v2-object-records';

const expenseFromV2Record = (record: V2ObjectRecord): Expense =>
  legacyObjectRecordFromV2<Expense>(record, 'id_pm');

const expenseMutationProperties = (
  params: ExpenseCreateParams | ExpenseUpdateParams,
  options: { includeExternalID?: boolean } = {},
): Record<string, unknown> => {
  const {
    amount,
    attachment_file,
    base_currency,
    company_external_id,
    company_id,
    contact_external_id,
    contact_id,
    currency,
    description,
    due_date,
    external_id: rawExternalID,
    reimburse_date,
    status,
  } = params;
  const external_id = options.includeExternalID ? rawExternalID : undefined;
  return compactProperties({
    amount,
    attachment_file,
    base_currency,
    company_external_id,
    company_id,
    contact_external_id,
    contact_id,
    currency,
    description,
    due_date,
    external_id,
    reimburse_date,
    status,
  });
};

export class Expenses extends APIResource {
  /**
   * Create Expense
   */
  create(body: ExpenseCreateParams, options?: RequestOptions): APIPromise<PublicExpenseResponse> {
    return this._client
      .v2Post<V2ObjectRecord>('/expenses', {
        body: { properties: expenseMutationProperties(body, { includeExternalID: true }) },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<PublicExpenseResponse>(
          envelope,
          'expense_id',
          'created',
          body.external_id,
        ),
      );
  }

  /**
   * Get Expense
   */
  retrieve(
    expenseID: string,
    params: ExpenseRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Expense> {
    const { 'Accept-Language': acceptLanguage, lang, language, ...query } = params ?? {};
    void lang;
    void language;
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/expenses/${expenseID}`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      expenseFromV2Record,
    );
  }

  /**
   * Update Expense
   */
  update(
    expenseID: string,
    params: ExpenseUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PublicExpenseResponse> {
    return this._client
      .v2Patch<V2ObjectRecord>(path`/expenses/${expenseID}`, {
        query: { external_id: params.external_id },
        body: { properties: expenseMutationProperties(params) },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<PublicExpenseResponse>(
          envelope,
          'expense_id',
          'updated',
          params.external_id,
        ),
      );
  }

  /**
   * List Expenses
   */
  list(
    params: ExpenseListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ExpenseListResponse> {
    const {
      'Accept-Language': acceptLanguage,
      lang,
      language,
      workspace_id: _workspaceID,
      ...query
    } = params ?? {};
    void lang;
    void language;
    void _workspaceID;
    return unwrapV2ObjectRecordArray(
      this._client.v2Get<V2ObjectRecordList>('/expenses', {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      expenseFromV2Record,
    );
  }

  /**
   * List Expense Files
   */
  listFiles(
    expenseID: string,
    params: ExpenseListFilesParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ExpenseFileListResponse> {
    const { workspace_id: _workspaceID, ...query } = params ?? {};
    void _workspaceID;
    return unwrapV2DataPromise(
      this._client.v2Get<ExpenseFileListResponse>(path`/expenses/${expenseID}/files`, {
        query,
        ...options,
      }),
    );
  }

  /**
   * Delete Expense
   */
  delete(
    expenseID: string,
    params: ExpenseDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicExpenseResponse> {
    const { external_id } = params ?? {};
    return this._client
      .v2Delete<V2LifecycleData>(path`/expenses/${expenseID}`, {
        query: { external_id },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyDeleteResponseFromV2<PublicExpenseResponse>(envelope, 'expense_id', external_id),
      );
  }

  /**
   * Upload Expense Attachment File
   */
  uploadAttachment(
    body: ExpenseUploadAttachmentParams,
    options?: RequestOptions,
  ): APIPromise<ExpenseUploadAttachmentResponse> {
    return unwrapV2DataPromise(
      this._client.v2Post<ExpenseUploadAttachmentResponse>(
        '/expenses/files',
        multipartFormRequestOptions({ body, ...options }, this._client),
      ),
    );
  }
}

export interface Expense {
  id: string;

  created_at: string;

  amount?: number | null;

  base_currency?: number | null;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  description?: string | null;

  due_date?: string | null;

  id_pm?: number | null;

  reimburse_date?: string | null;

  status?: string | null;

  updated_at?: string | null;

  attached_files?: Array<ExpenseFile> | null;

  attachment_file?: Expense.AttachmentFile | null;
}

export namespace Expense {
  export interface AttachmentFile {
    files?: Array<ExpenseFile>;
  }
}

export interface ExpenseFile {
  file_id?: string | null;

  id?: string | null;

  name?: string | null;

  filename?: string | null;

  file?: string | null;

  relative_path?: string | null;

  url?: string | null;

  download_url?: string | null;

  display?: string | null;

  size?: number | null;

  created_at?: string | null;
}

export interface PublicExpenseRequest {
  amount?: number | null;

  base_currency?: number | null;

  attachment_file?: PublicExpenseRequest.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  description?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  reimburse_date?: string | null;

  status?: string | null;
}

export namespace PublicExpenseRequest {
  export interface AttachmentFile {
    files?: Array<AttachmentFile.File>;
  }

  export namespace AttachmentFile {
    export interface File {
      id?: string | null;

      file_id?: string | null;

      name?: string | null;
    }
  }
}

export interface PublicExpenseResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  expense_id?: string | null;

  external_id?: string | null;
}

export type ExpenseListResponse = Array<Expense>;

export interface ExpenseUploadAttachmentResponse {
  file_id: string;

  ok: boolean;

  ctx_id?: string | null;

  filename?: string | null;
}

export interface ExpenseCreateParams {
  amount?: number | null;

  base_currency?: number | null;

  attachment_file?: ExpenseCreateParams.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  description?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  reimburse_date?: string | null;

  status?: string | null;
}

export namespace ExpenseCreateParams {
  export interface AttachmentFile {
    files?: Array<AttachmentFile.File>;
  }

  export namespace AttachmentFile {
    export interface File {
      id?: string | null;

      file_id?: string | null;

      name?: string | null;
    }
  }
}

export interface ExpenseRetrieveParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Query param
   */
  lang?: string | null;

  /**
   * Query param
   */
  language?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface ExpenseUpdateParams {
  amount?: number | null;

  base_currency?: number | null;

  attachment_file?: ExpenseUpdateParams.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  description?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  reimburse_date?: string | null;

  status?: string | null;
}

export namespace ExpenseUpdateParams {
  export interface AttachmentFile {
    files?: Array<AttachmentFile.File>;
  }

  export namespace AttachmentFile {
    export interface File {
      id?: string | null;

      file_id?: string | null;

      name?: string | null;
    }
  }
}

export interface ExpenseListParams {
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

export interface ExpenseListFilesParams {
  page?: number | null;

  page_size?: number | null;

  workspace_id?: string | null;
}

export interface ExpenseFileListResponse {
  object_type?: string | null;

  record_id?: string | null;

  items?: Array<ExpenseFile>;

  page?: number | null;

  page_size?: number | null;

  total?: number | null;
}

export interface ExpenseDeleteParams {
  external_id?: string | null;
}

export interface ExpenseUploadAttachmentParams {
  file: Uploadable;
}

export declare namespace Expenses {
  export {
    type Expense as Expense,
    type PublicExpenseRequest as PublicExpenseRequest,
    type PublicExpenseResponse as PublicExpenseResponse,
    type ExpenseListResponse as ExpenseListResponse,
    type ExpenseUploadAttachmentResponse as ExpenseUploadAttachmentResponse,
    type ExpenseCreateParams as ExpenseCreateParams,
    type ExpenseRetrieveParams as ExpenseRetrieveParams,
    type ExpenseUpdateParams as ExpenseUpdateParams,
    type ExpenseListParams as ExpenseListParams,
    type ExpenseDeleteParams as ExpenseDeleteParams,
    type ExpenseUploadAttachmentParams as ExpenseUploadAttachmentParams,
  };
}
