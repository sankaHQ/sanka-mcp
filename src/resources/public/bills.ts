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
import { PublicLineItem } from './line-items';

const billFromV2Record = (record: V2ObjectRecord): Bill => legacyObjectRecordFromV2<Bill>(record, 'id_bill');

const billMutationProperties = (params: BillCreateParams | BillUpdateParams): Record<string, unknown> => {
  const {
    amount,
    amount_without_tax,
    attachment_file: _attachmentFile,
    company_external_id: _companyExternalID,
    company_id,
    contact_external_id: _contactExternalID,
    contact_id,
    currency,
    description,
    due_date,
    external_id: _externalID,
    issued_date,
    notes,
    payment_date,
    status,
    tax_inclusive: _taxInclusive,
    tax_option: _taxOption,
    tax_rate,
  } = params;
  void _attachmentFile;
  void _companyExternalID;
  void _contactExternalID;
  void _externalID;
  void _taxInclusive;
  void _taxOption;
  return compactProperties({
    amount,
    amount_without_tax,
    company_id,
    contact_id,
    currency,
    description,
    due_date,
    issued_date,
    notes,
    payment_date,
    status,
    tax_rate,
  });
};

export class Bills extends APIResource {
  /**
   * Create Bill
   */
  create(body: BillCreateParams, options?: RequestOptions): APIPromise<PublicBillResponse> {
    return this._client
      .v2Post<V2ObjectRecord>('/bills', { body: { properties: billMutationProperties(body) }, ...options })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<PublicBillResponse>(envelope, 'bill_id', 'created', body.external_id),
      );
  }

  /**
   * Get Bill
   */
  retrieve(
    billID: string,
    params: BillRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Bill> {
    const { 'Accept-Language': acceptLanguage, lang, language, ...query } = params ?? {};
    void lang;
    void language;
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/bills/${billID}`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      billFromV2Record,
    );
  }

  /**
   * Update Bill
   */
  update(billID: string, params: BillUpdateParams, options?: RequestOptions): APIPromise<PublicBillResponse> {
    return this._client
      .v2Patch<V2ObjectRecord>(path`/bills/${billID}`, {
        query: { external_id: params.external_id },
        body: { properties: billMutationProperties(params) },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<PublicBillResponse>(envelope, 'bill_id', 'updated', params.external_id),
      );
  }

  /**
   * List Bills
   */
  list(
    params: BillListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BillListResponse> {
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
      this._client.v2Get<V2ObjectRecordList>('/bills', {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      billFromV2Record,
    );
  }

  /**
   * Delete Bill
   */
  delete(
    billID: string,
    params: BillDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicBillResponse> {
    const { external_id } = params ?? {};
    return this._client
      .v2Delete<V2LifecycleData>(path`/bills/${billID}`, { query: { external_id }, ...options })
      ._thenUnwrap((envelope) =>
        legacyDeleteResponseFromV2<PublicBillResponse>(envelope, 'bill_id', external_id),
      );
  }

  /**
   * Upload Bill Attachment File
   */
  uploadAttachment(
    body: BillUploadAttachmentParams,
    options?: RequestOptions,
  ): APIPromise<BillUploadAttachmentResponse> {
    return unwrapV2DataPromise(
      this._client.v2Post<BillUploadAttachmentResponse>(
        '/bills/files',
        multipartFormRequestOptions({ body, ...options }, this._client),
      ),
    );
  }
}

export interface Bill {
  created_at: string;

  amount?: number | null;

  amount_without_tax?: number | null;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  due_date?: string | null;

  id_bill?: number | null;

  issued_date?: string | null;

  line_items?: Array<PublicLineItem>;

  payment_date?: string | null;

  status?: string | null;

  updated_at?: string | null;
}

export interface PublicBillRequest {
  amount?: number | null;

  amount_without_tax?: number | null;

  attachment_file?: PublicBillRequest.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  description?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  issued_date?: string | null;

  notes?: string | null;

  payment_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;
}

export namespace PublicBillRequest {
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

export interface PublicBillResponse {
  ok: boolean;

  status: string;

  bill_id?: string | null;

  ctx_id?: string | null;

  external_id?: string | null;
}

export type BillListResponse = Array<Bill>;

export interface BillUploadAttachmentResponse {
  file_id: string;

  ok: boolean;

  ctx_id?: string | null;

  filename?: string | null;
}

export interface BillCreateParams {
  amount?: number | null;

  amount_without_tax?: number | null;

  attachment_file?: BillCreateParams.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  description?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  issued_date?: string | null;

  notes?: string | null;

  payment_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;
}

export namespace BillCreateParams {
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

export interface BillRetrieveParams {
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

export interface BillUpdateParams {
  amount?: number | null;

  amount_without_tax?: number | null;

  attachment_file?: BillUpdateParams.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  description?: string | null;

  due_date?: string | null;

  external_id?: string | null;

  issued_date?: string | null;

  notes?: string | null;

  payment_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;
}

export namespace BillUpdateParams {
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

export interface BillListParams {
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

export interface BillDeleteParams {
  external_id?: string | null;
}

export interface BillUploadAttachmentParams {
  file: Uploadable;
}

export declare namespace Bills {
  export {
    type Bill as Bill,
    type BillUploadAttachmentResponse as BillUploadAttachmentResponse,
    type PublicBillRequest as PublicBillRequest,
    type PublicBillResponse as PublicBillResponse,
    type BillListResponse as BillListResponse,
    type BillCreateParams as BillCreateParams,
    type BillRetrieveParams as BillRetrieveParams,
    type BillUpdateParams as BillUpdateParams,
    type BillListParams as BillListParams,
    type BillDeleteParams as BillDeleteParams,
    type BillUploadAttachmentParams as BillUploadAttachmentParams,
  };
}
