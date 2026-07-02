// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { type Uploadable } from '../../core/uploads';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';
import { V2Envelope, buildV2PdfRequest, unwrapV2Data, unwrapV2DataPromise } from '../../internal/v2';
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

type V2InvoiceOverdueListData = {
  items?: Array<InvoiceSchema>;
  page?: number;
  page_size?: number;
  total?: number;
};

const invoiceFromV2Record = (record: V2ObjectRecord): InvoiceSchema => {
  const properties = record.properties ?? {};
  return legacyObjectRecordFromV2<InvoiceSchema>(record, 'id_inv', {
    start_date: properties['start_date'] ?? properties['invoice_date'],
  });
};

const invoiceMutationProperties = (
  params: InvoiceCreateParams | InvoiceUpdateParams,
  options: { includeExternalID?: boolean } = {},
): Record<string, unknown> => {
  const {
    attachment_file,
    company_external_id,
    company_id,
    contact_external_id,
    contact_id,
    currency,
    custom_fields,
    due_date,
    external_id,
    line_items: _lineItems,
    notes,
    send_from,
    start_date,
    status,
    tax_inclusive,
    tax_option,
    tax_rate,
    total_price,
    total_price_without_tax,
  } = params;
  void _lineItems;
  return compactProperties({
    attachment_file,
    company_external_id,
    company_id,
    contact_external_id,
    contact_id,
    currency,
    custom_fields,
    due_date,
    external_id: options.includeExternalID ? external_id : undefined,
    invoice_date: start_date,
    notes,
    send_from,
    status,
    tax_inclusive,
    tax_option,
    tax_rate,
    total_price,
    total_price_without_tax,
  });
};

const invoiceMutationBody = (
  params: InvoiceCreateParams | InvoiceUpdateParams,
  options: { includeExternalID?: boolean } = {},
): Record<string, unknown> => {
  const body: Record<string, unknown> = { properties: invoiceMutationProperties(params, options) };
  if (params.line_items != null) {
    body['line_items'] = params.line_items;
  }
  return body;
};

export class Invoices extends APIResource {
  /**
   * Create Invoice
   */
  create(body: InvoiceCreateParams, options?: RequestOptions): APIPromise<Invoice> {
    return this._client
      .v2Post<V2ObjectRecord>('/invoices', {
        body: invoiceMutationBody(body, { includeExternalID: true }),
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<Invoice>(envelope, 'invoice_id', 'created', body.external_id),
      );
  }

  /**
   * Get Invoice
   */
  retrieve(
    invoiceID: string,
    params: InvoiceRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InvoiceSchema> {
    const { 'Accept-Language': acceptLanguage, lang, language, ...query } = params ?? {};
    void lang;
    void language;
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/invoices/${invoiceID}`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      invoiceFromV2Record,
    );
  }

  /**
   * Update Invoice
   */
  update(invoiceID: string, params: InvoiceUpdateParams, options?: RequestOptions): APIPromise<Invoice> {
    return this._client
      .v2Patch<V2ObjectRecord>(path`/invoices/${invoiceID}`, {
        query: { external_id: params.external_id },
        body: invoiceMutationBody(params),
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<Invoice>(envelope, 'invoice_id', 'updated', params.external_id),
      );
  }

  /**
   * List Invoices
   */
  list(
    params: InvoiceListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InvoiceListResponse> {
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
      this._client.v2Get<V2ObjectRecordList>('/invoices', {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      invoiceFromV2Record,
    );
  }

  /**
   * List Overdue Invoices
   */
  listOverdue(
    params: InvoiceListOverdueParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<InvoiceListOverdueResponse> {
    const {
      'Accept-Language': acceptLanguage,
      workspace_id: _workspaceID,
      lang: _lang,
      language: _language,
      ...query
    } = params ?? {};
    void _workspaceID;
    void _lang;
    void _language;
    return this._client
      .v2Get<V2InvoiceOverdueListData>('/invoices/overdue', {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      })
      ._thenUnwrap((envelope: V2Envelope<V2InvoiceOverdueListData>) => unwrapV2Data(envelope).items ?? []);
  }

  /**
   * Delete Invoice
   */
  delete(
    invoiceID: string,
    params: InvoiceDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Invoice> {
    const { external_id } = params ?? {};
    return this._client
      .v2Delete<V2LifecycleData>(path`/invoices/${invoiceID}`, {
        query: { external_id },
        ...options,
      })
      ._thenUnwrap((envelope) => legacyDeleteResponseFromV2<Invoice>(envelope, 'invoice_id', external_id));
  }

  /**
   * Download Invoice PDF
   */
  downloadPDF(
    invoiceID: string,
    params: InvoiceDownloadPDFParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Response> {
    const { acceptLanguage, query } = buildV2PdfRequest(params);
    return this._client.get<Response>(this._client.v2Path(path`/invoices/${invoiceID}/pdf`), {
      query,
      ...options,
      __binaryResponse: true,
      headers: buildHeaders([
        { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
        options?.headers,
      ]),
    });
  }

  /**
   * Upload Invoice Attachment File
   */
  uploadAttachment(
    body: InvoiceUploadAttachmentParams,
    options?: RequestOptions,
  ): APIPromise<InvoiceUploadAttachmentResponse> {
    return unwrapV2DataPromise(
      this._client.v2Post<InvoiceUploadAttachmentResponse>(
        '/invoices/files',
        multipartFormRequestOptions({ body, ...options }, this._client),
      ),
    );
  }
}

export interface Invoice {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  external_id?: string | null;

  invoice_id?: string | null;
}

export interface InvoiceRequest {
  attachment_file?: InvoiceRequest.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  custom_fields?: Record<string, unknown> | null;

  due_date?: string | null;

  external_id?: string | null;

  line_items?: Array<PublicLineItem> | null;

  notes?: string | null;

  send_from?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export namespace InvoiceRequest {
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

export interface InvoiceSchema {
  created_at: string;

  updated_at: string;

  days_overdue?: number | null;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  due_date?: string | null;

  id_inv?: number | null;

  line_items?: Array<PublicLineItem>;

  outstanding_balance?: number | null;

  paid_amount?: number | null;

  start_date?: string | null;

  status?: string | null;

  status_key?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export type InvoiceListResponse = Array<InvoiceSchema>;

export type InvoiceListOverdueResponse = Array<InvoiceSchema>;

export interface InvoiceUploadAttachmentResponse {
  file_id: string;

  ok: boolean;

  ctx_id?: string | null;

  filename?: string | null;
}

export interface InvoiceCreateParams {
  attachment_file?: InvoiceCreateParams.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  custom_fields?: Record<string, unknown> | null;

  due_date?: string | null;

  external_id?: string | null;

  line_items?: Array<PublicLineItem> | null;

  notes?: string | null;

  send_from?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export namespace InvoiceCreateParams {
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

export interface InvoiceRetrieveParams {
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

export interface InvoiceDownloadPDFParams {
  /**
   * Query param
   */
  external_id?: string | null;

  /**
   * Query param
   */
  template_select?: string | null;

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

export interface InvoiceUpdateParams {
  attachment_file?: InvoiceUpdateParams.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  custom_fields?: Record<string, unknown> | null;

  due_date?: string | null;

  external_id?: string | null;

  line_items?: Array<PublicLineItem> | null;

  notes?: string | null;

  send_from?: string | null;

  start_date?: string | null;

  status?: string | null;

  tax_inclusive?: boolean | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export namespace InvoiceUpdateParams {
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

export interface InvoiceListParams {
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

export interface InvoiceListOverdueParams {
  /**
   * Query param
   */
  as_of_date?: string | null;

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

export interface InvoiceDeleteParams {
  external_id?: string | null;
}

export interface InvoiceUploadAttachmentParams {
  file: Uploadable;
}

export declare namespace Invoices {
  export {
    type Invoice as Invoice,
    type InvoiceRequest as InvoiceRequest,
    type InvoiceSchema as InvoiceSchema,
    type InvoiceListResponse as InvoiceListResponse,
    type InvoiceListOverdueResponse as InvoiceListOverdueResponse,
    type InvoiceUploadAttachmentResponse as InvoiceUploadAttachmentResponse,
    type InvoiceCreateParams as InvoiceCreateParams,
    type InvoiceRetrieveParams as InvoiceRetrieveParams,
    type InvoiceUpdateParams as InvoiceUpdateParams,
    type InvoiceListParams as InvoiceListParams,
    type InvoiceListOverdueParams as InvoiceListOverdueParams,
    type InvoiceDeleteParams as InvoiceDeleteParams,
    type InvoiceUploadAttachmentParams as InvoiceUploadAttachmentParams,
  };
}
