// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { type Uploadable } from '../../core/uploads';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';

export class Expenses extends APIResource {
  /**
   * Create Expense
   */
  create(body: ExpenseCreateParams, options?: RequestOptions): APIPromise<PublicExpenseResponse> {
    return this._client.post('/v1/public/expenses', { body, ...options });
  }

  /**
   * Get Expense
   */
  retrieve(
    expenseID: string,
    params: ExpenseRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Expense> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get(path`/v1/public/expenses/${expenseID}`, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update Expense
   */
  update(
    expenseID: string,
    body: ExpenseUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PublicExpenseResponse> {
    return this._client.put(path`/v1/public/expenses/${expenseID}`, { body, ...options });
  }

  /**
   * List Expenses
   */
  list(
    params: ExpenseListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ExpenseListResponse> {
    const { 'Accept-Language': acceptLanguage, ...query } = params ?? {};
    return this._client.get('/v1/public/expenses', {
      query,
      ...options,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
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
    return this._client.delete(path`/v1/public/expenses/${expenseID}`, {
      query: { external_id },
      ...options,
    });
  }

  /**
   * Upload Expense Attachment File
   */
  uploadAttachment(
    body: ExpenseUploadAttachmentParams,
    options?: RequestOptions,
  ): APIPromise<ExpenseUploadAttachmentResponse> {
    return this._client.post(
      '/v1/public/expenses/files',
      multipartFormRequestOptions({ body, ...options }, this._client),
    );
  }
}

export interface Expense {
  id: string;

  created_at: string;

  amount?: number | null;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  description?: string | null;

  due_date?: string | null;

  id_pm?: number | null;

  reimburse_date?: string | null;

  status?: string | null;

  updated_at?: string | null;
}

export interface PublicExpenseRequest {
  amount?: number | null;

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
