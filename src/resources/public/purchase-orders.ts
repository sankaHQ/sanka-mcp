// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { type Uploadable } from '../../core/uploads';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';
import { V2PdfData, buildV2PdfRequest, unwrapV2DataPromise, unwrapV2PdfResponse } from '../../internal/v2';
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

const purchaseOrderFromV2Record = (record: V2ObjectRecord): PurchaseOrder =>
  legacyObjectRecordFromV2<PurchaseOrder>(record, 'id_po');

const purchaseOrderMutationProperties = (
  params: PurchaseOrderCreateParams | PurchaseOrderUpdateParams,
): Record<string, unknown> => {
  const {
    attachment_file: _attachmentFile,
    company_external_id: _companyExternalID,
    company_id,
    contact_external_id: _contactExternalID,
    contact_id,
    currency,
    date,
    external_id: _externalID,
    notes,
    status,
    tax_option,
    tax_rate,
    total_price,
    total_price_without_tax,
  } = params;
  void _attachmentFile;
  void _companyExternalID;
  void _contactExternalID;
  void _externalID;
  return compactProperties({
    company_id,
    contact_id,
    currency,
    date,
    notes,
    status,
    tax_option,
    tax_rate,
    total_price,
    total_price_without_tax,
  });
};

export class PurchaseOrders extends APIResource {
  /**
   * Create Purchase Order
   */
  create(body: PurchaseOrderCreateParams, options?: RequestOptions): APIPromise<PurchaseOrderResponse> {
    return this._client
      .v2Post<V2ObjectRecord>('/purchase-orders', {
        body: { properties: purchaseOrderMutationProperties(body) },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<PurchaseOrderResponse>(
          envelope,
          'purchase_order_id',
          'created',
          body.external_id,
        ),
      );
  }

  /**
   * Get Purchase Order
   */
  retrieve(
    purchaseOrderID: string,
    params: PurchaseOrderRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PurchaseOrder> {
    const { 'Accept-Language': acceptLanguage, lang, language, ...query } = params ?? {};
    void lang;
    void language;
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/purchase-orders/${purchaseOrderID}`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      purchaseOrderFromV2Record,
    );
  }

  /**
   * Update Purchase Order
   */
  update(
    purchaseOrderID: string,
    params: PurchaseOrderUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PurchaseOrderResponse> {
    return this._client
      .v2Patch<V2ObjectRecord>(path`/purchase-orders/${purchaseOrderID}`, {
        query: { external_id: params.external_id },
        body: { properties: purchaseOrderMutationProperties(params) },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyMutationResponseFromV2<PurchaseOrderResponse>(
          envelope,
          'purchase_order_id',
          'updated',
          params.external_id,
        ),
      );
  }

  /**
   * List Purchase Orders
   */
  list(
    params: PurchaseOrderListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PurchaseOrderListResponse> {
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
      this._client.v2Get<V2ObjectRecordList>('/purchase-orders', {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
      purchaseOrderFromV2Record,
    );
  }

  /**
   * Delete Purchase Order
   */
  delete(
    purchaseOrderID: string,
    params: PurchaseOrderDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PurchaseOrderResponse> {
    const { external_id } = params ?? {};
    return this._client
      .v2Delete<V2LifecycleData>(path`/purchase-orders/${purchaseOrderID}`, {
        query: { external_id },
        ...options,
      })
      ._thenUnwrap((envelope) =>
        legacyDeleteResponseFromV2<PurchaseOrderResponse>(envelope, 'purchase_order_id', external_id),
      );
  }

  /**
   * Download Purchase Order PDF
   */
  downloadPDF(
    purchaseOrderID: string,
    params: PurchaseOrderDownloadPDFParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Response> {
    const { acceptLanguage, query } = buildV2PdfRequest(params);
    return unwrapV2PdfResponse(
      this._client.v2Get<V2PdfData>(path`/purchase-orders/${purchaseOrderID}/pdf`, {
        query,
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      }),
    );
  }

  /**
   * Upload Purchase Order Attachment File
   */
  uploadAttachment(
    body: PurchaseOrderUploadAttachmentParams,
    options?: RequestOptions,
  ): APIPromise<PurchaseOrderUploadAttachmentResponse> {
    return unwrapV2DataPromise(
      this._client.v2Post<PurchaseOrderUploadAttachmentResponse>(
        '/purchase-orders/files',
        multipartFormRequestOptions({ body, ...options }, this._client),
      ),
    );
  }
}

export interface PurchaseOrder {
  created_at: string;

  updated_at: string;

  company_name?: string | null;

  contact_name?: string | null;

  currency?: string | null;

  date?: string | null;

  id_po?: number | null;

  line_items?: Array<PublicLineItem>;

  status?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface PurchaseOrderRequest {
  attachment_file?: PurchaseOrderRequest.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  date?: string | null;

  external_id?: string | null;

  notes?: string | null;

  status?: string | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export namespace PurchaseOrderRequest {
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

export interface PurchaseOrderResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  external_id?: string | null;

  purchase_order_id?: string | null;
}

export type PurchaseOrderListResponse = Array<PurchaseOrder>;

export interface PurchaseOrderUploadAttachmentResponse {
  file_id: string;

  ok: boolean;

  ctx_id?: string | null;

  filename?: string | null;
}

export interface PurchaseOrderCreateParams {
  attachment_file?: PurchaseOrderCreateParams.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  date?: string | null;

  external_id?: string | null;

  notes?: string | null;

  status?: string | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export namespace PurchaseOrderCreateParams {
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

export interface PurchaseOrderRetrieveParams {
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

export interface PurchaseOrderUpdateParams {
  attachment_file?: PurchaseOrderUpdateParams.AttachmentFile | null;

  company_external_id?: string | null;

  company_id?: string | null;

  contact_external_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  date?: string | null;

  external_id?: string | null;

  notes?: string | null;

  status?: string | null;

  tax_option?: string | null;

  tax_rate?: number | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export namespace PurchaseOrderUpdateParams {
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

export interface PurchaseOrderListParams {
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

export interface PurchaseOrderDeleteParams {
  external_id?: string | null;
}

export interface PurchaseOrderDownloadPDFParams {
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

export interface PurchaseOrderUploadAttachmentParams {
  file: Uploadable;
}

export declare namespace PurchaseOrders {
  export {
    type PurchaseOrder as PurchaseOrder,
    type PurchaseOrderRequest as PurchaseOrderRequest,
    type PurchaseOrderResponse as PurchaseOrderResponse,
    type PurchaseOrderListResponse as PurchaseOrderListResponse,
    type PurchaseOrderUploadAttachmentResponse as PurchaseOrderUploadAttachmentResponse,
    type PurchaseOrderCreateParams as PurchaseOrderCreateParams,
    type PurchaseOrderRetrieveParams as PurchaseOrderRetrieveParams,
    type PurchaseOrderUpdateParams as PurchaseOrderUpdateParams,
    type PurchaseOrderListParams as PurchaseOrderListParams,
    type PurchaseOrderDeleteParams as PurchaseOrderDeleteParams,
    type PurchaseOrderDownloadPDFParams as PurchaseOrderDownloadPDFParams,
    type PurchaseOrderUploadAttachmentParams as PurchaseOrderUploadAttachmentParams,
  };
}
