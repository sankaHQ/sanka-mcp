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
  legacyListEnvelopeFromV2,
  legacyObjectRecordFromV2,
  unwrapV2ObjectRecord,
} from '../../internal/v2-object-records';
import { PublicLineItem } from './line-items';

const orderFromV2Record = (record: V2ObjectRecord): OrderRetrieveResponse =>
  legacyObjectRecordFromV2<OrderRetrieveResponse>(record, 'order_id');

const orderLineItemsForV2 = (order: PublicOrder): Array<Record<string, unknown>> | undefined => {
  const lineItems: Array<Record<string, unknown>> = [];
  for (const item of order.line_items ?? []) {
    lineItems.push(item as Record<string, unknown>);
  }
  for (const item of order.items ?? []) {
    lineItems.push(
      compactProperties({
        item_id: item.item_id,
        item_external_id: item.itemExternalId,
        quantity: item.quantity,
        unit_price: item.price,
        tax_rate: item.tax_rate ?? item.tax,
      }),
    );
  }
  return lineItems.length > 0 ? lineItems : undefined;
};

const orderMutationProperties = (
  params: OrderCreateParams | OrderUpdateParams,
): { externalID?: string; properties: Record<string, unknown> } => {
  const order = params.order;
  const lineItems = orderLineItemsForV2(order);
  const externalID = order.externalId ?? undefined;
  return {
    ...(externalID !== undefined ? { externalID } : {}),
    properties: compactProperties({
      external_id: externalID,
      company_external_id: order.companyExternalId,
      company_id: order.companyId,
      custom_fields: order.custom_fields,
      delivery_status: order.deliveryStatus,
      order_at: order.orderAt,
      send_from: order.send_from ?? order.sendFrom,
      line_items: lineItems,
      attachment_file: order.attachment_file,
      create_missing_items: params.createMissingItems,
      trigger_workflows: params.triggerWorkflows,
    }),
  };
};

const legacyOrderMutationResponseFromV2 = (
  envelope: V2Envelope<V2ObjectRecord>,
  status: string,
  externalID?: string | null,
): BulkOrders => {
  const data = unwrapV2Data(envelope);
  return {
    ok: true,
    ctx_id: envelope.meta.ctx_id ?? null,
    results: [
      {
        external_id: externalID ?? '',
        status,
        order_id: data.id,
      },
    ],
  };
};

const legacyOrderLifecycleResponseFromV2 = (
  envelope: V2Envelope<V2LifecycleData>,
  status: string,
  externalID?: string | null,
): OrderDeleteResponse => {
  const data = unwrapV2Data(envelope);
  return {
    ok: true,
    status,
    order_id: data.id ?? null,
    external_id: externalID ?? null,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

export class Orders extends APIResource {
  /**
   * Create Orders
   */
  create(body: OrderCreateParams, options?: RequestOptions): APIPromise<BulkOrders> {
    const { externalID, properties } = orderMutationProperties(body);
    return this._client
      .v2Post<V2ObjectRecord>('/orders', { body: { properties }, ...options })
      ._thenUnwrap((envelope) => legacyOrderMutationResponseFromV2(envelope, 'created', externalID));
  }

  /**
   * Get Order
   */
  retrieve(
    orderID: string,
    query: OrderRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<OrderRetrieveResponse> {
    return unwrapV2ObjectRecord(
      this._client.v2Get<V2ObjectRecord>(path`/orders/${orderID}`, { query, ...options }),
      orderFromV2Record,
    );
  }

  /**
   * Update Order
   */
  update(orderID: string, body: OrderUpdateParams, options?: RequestOptions): APIPromise<BulkOrders> {
    const { externalID, properties } = orderMutationProperties(body);
    return this._client
      .v2Patch<V2ObjectRecord>(path`/orders/${orderID}`, {
        query: { external_id: externalID },
        body: { properties },
        ...options,
      })
      ._thenUnwrap((envelope) => legacyOrderMutationResponseFromV2(envelope, 'updated', externalID));
  }

  /**
   * List Orders
   */
  list(
    params: OrderListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<OrderListResponse> {
    const {
      'Accept-Language': acceptLanguage,
      limit,
      reference_id,
      search,
      sort,
      view,
      ...query
    } = params ?? {};
    return this._client
      .v2Get<V2ObjectRecordList>('/orders', {
        query: {
          ...query,
          ...(search != null ? { q: search } : undefined),
          ...(reference_id != null ? { q: reference_id } : undefined),
          ...(sort != null ? { sort } : undefined),
          ...(view != null ? { view } : undefined),
          ...(limit != null ? { limit } : undefined),
        },
        ...options,
        headers: buildHeaders([
          { ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined) },
          options?.headers,
        ]),
      })
      ._thenUnwrap(
        (envelope) =>
          legacyListEnvelopeFromV2(envelope, orderFromV2Record, 'orders') as unknown as OrderListResponse,
      );
  }

  /**
   * Delete Order
   */
  delete(
    orderID: string,
    params: OrderDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<OrderDeleteResponse> {
    const { external_id } = params ?? {};
    return this._client
      .v2Delete<V2LifecycleData>(path`/orders/${orderID}`, { query: { external_id }, ...options })
      ._thenUnwrap((envelope) =>
        legacyDeleteResponseFromV2<OrderDeleteResponse>(envelope, 'order_id', external_id),
      );
  }

  /**
   * Activate Order
   */
  activate(
    orderID: string,
    params: OrderActivateParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<OrderDeleteResponse> {
    const { external_id } = params ?? {};
    return this._client
      .v2Post<V2LifecycleData>(path`/orders/${orderID}/activate`, {
        query: { external_id },
        ...options,
      })
      ._thenUnwrap((envelope) => legacyOrderLifecycleResponseFromV2(envelope, 'active', external_id));
  }

  /**
   * Download Order PDF
   */
  downloadPDF(
    orderID: string,
    params: OrderDownloadPDFParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Response> {
    const { acceptLanguage, query } = buildV2PdfRequest(params);
    return this._client.get<Response>(this._client.v2Path(path`/orders/${orderID}/pdf`), {
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
   * Bulk Create Orders
   */
  bulkCreate(body: OrderBulkCreateParams, options?: RequestOptions): APIPromise<BulkOrders> {
    return unwrapV2DataPromise(this._client.v2Post<BulkOrders>('/orders/bulk', { body, ...options }));
  }

  /**
   * Upload Order Attachment File
   */
  uploadAttachment(
    body: OrderUploadAttachmentParams,
    options?: RequestOptions,
  ): APIPromise<OrderUploadAttachmentResponse> {
    return unwrapV2DataPromise(
      this._client.v2Post<OrderUploadAttachmentResponse>(
        '/orders/files',
        multipartFormRequestOptions({ body, ...options }, this._client),
      ),
    );
  }
}

export interface BulkOrder {
  externalId?: string | null;

  items?: Array<BulkOrder.Item> | null;

  companyExternalId?: string | null;

  companyId?: string | null;

  deliveryStatus?: string | null;

  orderAt?: string | null;
}

export namespace BulkOrder {
  export interface Item {
    item_id?: string | null;

    itemExternalId?: string | null;

    price?: number | null;

    quantity?: number;

    tax?: number | null;

    tax_rate?: number | null;
  }
}

export interface PublicOrder extends BulkOrder {
  attachment_file?: PublicOrder.AttachmentFile | null;

  custom_fields?: Record<string, unknown> | null;

  line_items?: Array<PublicLineItem> | null;

  send_from?: string | null;

  sendFrom?: string | null;
}

export namespace PublicOrder {
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

export interface BulkOrders {
  ok: boolean;

  ctx_id?: string | null;

  job_id?: string | null;

  results?: Array<BulkOrders.Result> | null;
}

export namespace BulkOrders {
  export interface Result {
    external_id: string;

    status: string;

    errors?: Array<string>;

    order_id?: string | null;
  }
}

export interface Order {
  order: PublicOrder;

  createMissingItems?: boolean;

  triggerWorkflows?: boolean;
}

export interface OrderRetrieveResponse {
  id: string;

  created_at: string;

  order_at: string;

  updated_at: string;

  company_id?: string | null;

  contact_id?: string | null;

  currency?: string | null;

  delivery_status?: string | null;

  line_items?: Array<PublicLineItem>;

  number_item?: number | null;

  order_id?: number | null;

  status?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;
}

export interface OrderListResponse {
  count: number;

  data: Array<{ [key: string]: unknown }>;

  message: string;

  page: number;

  total: number;

  ctx_id?: string | null;
}

export interface OrderDeleteResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  external_id?: string | null;

  order_id?: string | null;
}

export interface OrderUploadAttachmentResponse {
  file_id: string;

  ok: boolean;

  ctx_id?: string | null;

  filename?: string | null;
}

export interface OrderCreateParams {
  order: PublicOrder & { externalId: string };

  createMissingItems?: boolean;

  triggerWorkflows?: boolean;
}

export interface OrderRetrieveParams {
  external_id?: string | null;
}

export interface OrderDownloadPDFParams {
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

export interface OrderUpdateParams {
  order: PublicOrder;

  createMissingItems?: boolean;

  triggerWorkflows?: boolean;
}

export interface OrderListParams {
  /**
   * Query param
   */
  limit?: number | null;

  /**
   * Query param
   */
  page?: number;

  /**
   * Query param
   */
  reference_id?: string | null;

  /**
   * Query param
   */
  search?: string | null;

  /**
   * Query param
   */
  sort?: string | null;

  /**
   * Query param
   */
  view?: string | null;

  /**
   * Header param
   */
  'Accept-Language'?: string;
}

export interface OrderDeleteParams {
  external_id?: string | null;
}

export interface OrderActivateParams {
  external_id?: string | null;
}

export interface OrderBulkCreateParams {
  orders: Array<BulkOrder>;

  createMissingItems?: boolean;

  triggerWorkflows?: boolean;
}

export interface OrderUploadAttachmentParams {
  file: Uploadable;
}

export declare namespace Orders {
  export {
    type BulkOrder as BulkOrder,
    type PublicOrder as PublicOrder,
    type BulkOrders as BulkOrders,
    type Order as Order,
    type OrderRetrieveResponse as OrderRetrieveResponse,
    type OrderListResponse as OrderListResponse,
    type OrderDeleteResponse as OrderDeleteResponse,
    type OrderUploadAttachmentResponse as OrderUploadAttachmentResponse,
    type OrderCreateParams as OrderCreateParams,
    type OrderRetrieveParams as OrderRetrieveParams,
    type OrderUpdateParams as OrderUpdateParams,
    type OrderListParams as OrderListParams,
    type OrderDeleteParams as OrderDeleteParams,
    type OrderActivateParams as OrderActivateParams,
    type OrderBulkCreateParams as OrderBulkCreateParams,
    type OrderUploadAttachmentParams as OrderUploadAttachmentParams,
  };
}
