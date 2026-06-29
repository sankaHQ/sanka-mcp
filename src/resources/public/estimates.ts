// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { type Uploadable } from '../../core/uploads';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';
import { buildV2PdfRequest, unwrapV2DataPromise } from '../../internal/v2';
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

const estimateFromV2Record = (record: V2ObjectRecord): Estimate => {
  const properties = record.properties ?? {};
  return legacyObjectRecordFromV2<Estimate>(record, 'id_est', {
    start_date: properties['start_date'] ?? properties['estimate_date'],
  });
};

const estimateMutationProperties = (
  params: EstimateCreateParams | EstimateUpdateParams,
): Record<string, unknown> => {
  const {
    attachment_file: _attachmentFile,
    company_external_id: _companyExternalID,
    company_id,
    contact_external_id: _contactExternalID,
    contact_id,
    currency,
    due_date,
    external_id: _externalID,
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
  void _attachmentFile;
  void _companyExternalID;
  void _contactExternalID;
  void _externalID;
  void _lineItems;
  return compactProperties({
    company_id,
    contact_id,
    currency,
    due_date,
    estimate_date: start_date,
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

const estimateMutationBody = (
  params: EstimateCreateParams | EstimateUpdateParams,
): Record<string, unknown> => {
  const body: Record<string, unknown> = { properties: estimateMutationProperties(params) };
  if (params.line_items != null) {
    body['line_items'] = params.line_items;
  }
  return body;
};

export class Estimates extends APIResource {
  /**
   * Create Estimate
   */
  create(body: EstimateCreateParams, options?: RequestOptions): APIPromise<PublicEstimateResponse> {
    return this._client
      .v2Post<V2ObjectRecord>('/estimates', {
        body: estimateMutationBody(body),
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<PublicEstimateResponse>(
          envelope,
          'estimate_id',
          'created',
          body.external_id,
        ),
      );
  }

  /**
   * Get Estimate
   */
  retrieve(
    estimateID: string,
    params: EstimateRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Estimate> {
    const { 'Accept-Language': acceptLanguage, lang, language, ...query } = params ?? {};
    void lang;
    void language;
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/estimates/${estimateID}`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      estimateFromV2Record,
    );
  }

  /**
   * Update Estimate
   */
  update(
    estimateID: string,
    params: EstimateUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PublicEstimateResponse> {
    return this._client
      .v2Patch<V2ObjectRecord>(path`/estimates/${estimateID}`, {
        query: { external_id: params.external_id },
        body: estimateMutationBody(params),
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<PublicEstimateResponse>(
          envelope,
          'estimate_id',
          'updated',
          params.external_id,
        ),
      );
  }

  /**
   * List Estimates
   */
  list(
    params: EstimateListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<EstimateListResponse> {
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
      this._client.v2Get<V2ObjectRecordList>('/estimates', {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      estimateFromV2Record,
    );
  }

  /**
   * Delete Estimate
   */
  delete(
    estimateID: string,
    params: EstimateDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicEstimateResponse> {
    const { external_id } = params ?? {};
    return this._client
      .v2Delete<V2LifecycleData>(path`/estimates/${estimateID}`, {
        query: { external_id },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyDeleteResponseFromV2<PublicEstimateResponse>(envelope, 'estimate_id', external_id),
      );
  }

  /**
   * Download Estimate PDF
   */
  downloadPDF(
    estimateID: string,
    params: EstimateDownloadPDFParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Response> {
    const { acceptLanguage, query } = buildV2PdfRequest(params);
    return this._client.get<Response>(this._client.v2Path(path`/estimates/${estimateID}/pdf`), {
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
   * Upload Estimate Attachment File
   */
  uploadAttachment(
    body: EstimateUploadAttachmentParams,
    options?: RequestOptions,
  ): APIPromise<EstimateUploadAttachmentResponse> {
    return unwrapV2DataPromise(
      this._client.v2Post<EstimateUploadAttachmentResponse>(
        '/estimates/files',
        multipartFormRequestOptions({ body, ...options }, this._client),
      ),
    );
  }
}

export interface Estimate {
  created_at: string;

  updated_at: string;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  due_date?: string | null;

  id_est?: number | null;

  line_items?: Array<PublicLineItem>;

  start_date?: string | null;

  status?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface PublicEstimateRequest {
  attachment_file?: PublicEstimateRequest.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

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

export namespace PublicEstimateRequest {
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

export interface PublicEstimateResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  estimate_id?: string | null;

  external_id?: string | null;
}

export type EstimateListResponse = Array<Estimate>;

export interface EstimateUploadAttachmentResponse {
  file_id: string;

  ok: boolean;

  ctx_id?: string | null;

  filename?: string | null;
}

export interface EstimateCreateParams {
  attachment_file?: EstimateCreateParams.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

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

export namespace EstimateCreateParams {
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

export interface EstimateRetrieveParams {
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

export interface EstimateUpdateParams {
  attachment_file?: EstimateUpdateParams.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

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

export namespace EstimateUpdateParams {
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

export interface EstimateListParams {
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

export interface EstimateDeleteParams {
  external_id?: string | null;
}

export interface EstimateDownloadPDFParams {
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
   * Query param
   */
  template_select?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface EstimateUploadAttachmentParams {
  file: Uploadable;
}

export declare namespace Estimates {
  export {
    type Estimate as Estimate,
    type PublicEstimateRequest as PublicEstimateRequest,
    type PublicEstimateResponse as PublicEstimateResponse,
    type EstimateListResponse as EstimateListResponse,
    type EstimateUploadAttachmentResponse as EstimateUploadAttachmentResponse,
    type EstimateCreateParams as EstimateCreateParams,
    type EstimateRetrieveParams as EstimateRetrieveParams,
    type EstimateUpdateParams as EstimateUpdateParams,
    type EstimateListParams as EstimateListParams,
    type EstimateDeleteParams as EstimateDeleteParams,
    type EstimateUploadAttachmentParams as EstimateUploadAttachmentParams,
  };
}
