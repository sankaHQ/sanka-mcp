import {
  crmActivateOrderTool,
  crmCreateEstimateTool,
  crmCreateInvoiceTool,
  crmCreateOrderTool,
  crmCreatePurchaseOrderTool,
  crmCreateSlipTool,
  crmCreateSubscriptionTool,
  crmDeleteEstimateTool,
  crmDeleteOrderTool,
  crmDeleteSlipTool,
  crmDownloadEstimatePDFTool,
  crmDownloadInvoicePDFTool,
  crmDownloadOrderPDFTool,
  crmDownloadPaymentPDFTool,
  crmDownloadPurchaseOrderPDFTool,
  crmDownloadSlipPDFTool,
  crmGetEstimateTool,
  crmGetOrderTool,
  crmGetSlipTool,
  crmListEstimatesTool,
  crmListOrdersTool,
  crmListSlipsTool,
  crmPermanentDeleteOrderTool,
  crmUpdateEstimateTool,
  crmUpdateOrderTool,
  crmUpdateSlipTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { resetBinaryDownloadStoreForTests } from '../../../packages/mcp-server/src/binary-download-store';
import { resetBinaryUploadStoreForTests } from '../../../packages/mcp-server/src/binary-upload-store';
import { describeV2Requests, oauthContext, type V2RequestCase } from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'lists orders when authentication is present',
    tool: crmListOrdersTool,
    args: { limit: 20, page: 2, search: 'Acme', language: 'en' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/orders?page=2&q=Acme&limit=20',
        headers: { 'accept-language': 'en' },
      },
    ],
  },
  {
    name: 'gets one order when authentication is present',
    tool: crmGetOrderTool,
    args: { order_id: 'order-1', external_id: 'ORD-1' },
    expectedRequests: [
      { method: 'GET', url: 'http://localhost:5000/api/v2/orders/order-1?external_id=ORD-1' },
    ],
  },
  {
    name: 'creates an order',
    tool: crmCreateOrderTool,
    args: {
      create_missing_items: true,
      attachment_file_ids: ['file-1'],
      order: {
        external_id: 'ORD-1',
        company_external_id: 'COMP-1',
        custom_fields: { owner_email: 'owner@example.com' },
        order_at: '2026-04-09T09:00:00Z',
        send_from: 'Sanka Sales\n100 Market St',
        line_items: [{ item_external_id: 'ITEM-1', quantity: 2, unit_price: 50, tax_rate: 10 }],
      },
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/orders',
        body: {
          properties: {
            external_id: 'ORD-1',
            company_external_id: 'COMP-1',
            custom_fields: { owner_email: 'owner@example.com' },
            order_at: '2026-04-09T09:00:00Z',
            send_from: 'Sanka Sales\n100 Market St',
            line_items: [{ item_external_id: 'ITEM-1', quantity: 2, unit_price: 50, tax_rate: 10 }],
            attachment_file: { files: [{ file_id: 'file-1' }] },
            create_missing_items: true,
          },
        },
      },
    ],
  },
  {
    name: 'updates an order',
    tool: crmUpdateOrderTool,
    args: {
      order_id: 'order-1',
      trigger_workflows: false,
      order: {
        custom_fields: { owner_email: 'updated@example.com' },
        delivery_status: 'shipped',
        send_from: 'Updated Sanka Sales\n100 Market St',
      },
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/orders/order-1',
        body: {
          properties: {
            custom_fields: { owner_email: 'updated@example.com' },
            delivery_status: 'shipped',
            send_from: 'Updated Sanka Sales\n100 Market St',
            trigger_workflows: false,
          },
        },
      },
    ],
  },
  {
    name: 'gets one estimate when authentication is present',
    tool: crmGetEstimateTool,
    args: { estimate_id: 'estimate-1', external_id: 'EST-1', language: 'ja' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/estimates/estimate-1?external_id=EST-1',
        headers: { 'accept-language': 'ja' },
      },
    ],
  },
  {
    name: 'creates an estimate',
    tool: crmCreateEstimateTool,
    args: {
      company_id: 'company-1',
      total_price: 100,
      currency: 'USD',
      attachment_file_ids: ['file-1'],
      custom_fields: { owner_email: 'estimate-owner@example.com' },
      line_items: [{ item_name: 'Discovery', quantity: 2, unit_price: 50, tax_rate: 10 }],
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/estimates',
        body: {
          properties: {
            attachment_file: { files: [{ file_id: 'file-1' }] },
            company_id: 'company-1',
            currency: 'USD',
            custom_fields: { owner_email: 'estimate-owner@example.com' },
            total_price: 100,
          },
          line_items: [{ item_name: 'Discovery', quantity: 2, unit_price: 50, tax_rate: 10 }],
        },
      },
    ],
  },
  {
    name: 'updates an estimate',
    tool: crmUpdateEstimateTool,
    args: {
      estimate_id: 'estimate-1',
      custom_fields: { owner_email: 'updated-estimate-owner@example.com' },
      status: 'sent',
      notes: 'Updated notes',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/estimates/estimate-1',
        body: {
          properties: {
            custom_fields: { owner_email: 'updated-estimate-owner@example.com' },
            notes: 'Updated notes',
            status: 'sent',
          },
        },
      },
    ],
  },
  {
    name: 'deletes an estimate',
    tool: crmDeleteEstimateTool,
    args: {
      estimate_id: 'estimate-1',
      external_id: 'EST-1',
    },
    expectedRequests: [
      { method: 'DELETE', url: 'http://localhost:5000/api/v2/estimates/estimate-1?external_id=EST-1' },
    ],
  },
  {
    name: 'gets one slip',
    tool: crmGetSlipTool,
    args: { slip_id: 'slip-1', external_id: 'SLIP-1', language: 'ja' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/revenues/slip-1?external_id=SLIP-1',
        headers: { 'accept-language': 'ja' },
      },
    ],
  },
  {
    name: 'creates a slip',
    tool: crmCreateSlipTool,
    args: {
      company_id: 'company-1',
      currency: 'USD',
      slip_type: 'delivery_slip',
      total_price: 500,
      tax_inclusive: true,
      line_items: [{ item_name: 'Delivered item', quantity: 5, unit_price: 100, tax_rate: 0 }],
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/revenues',
        body: {
          properties: {
            company_id: 'company-1',
            currency: 'USD',
            revenue_mode: 'delivery_slip',
            tax_inclusive: true,
            total_price: 500,
          },
          line_items: [{ item_name: 'Delivered item', quantity: 5, unit_price: 100, tax_rate: 0 }],
        },
      },
    ],
  },
  {
    name: 'updates a slip',
    tool: crmUpdateSlipTool,
    args: {
      slip_id: 'slip-1',
      status: 'sent',
      notes: 'Updated slip notes',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/revenues/slip-1',
        body: { properties: { notes: 'Updated slip notes', status: 'sent' } },
      },
    ],
  },
  {
    name: 'deletes a slip',
    tool: crmDeleteSlipTool,
    args: {
      slip_id: 'slip-1',
      external_id: 'SLIP-1',
    },
    expectedRequests: [
      { method: 'DELETE', url: 'http://localhost:5000/api/v2/revenues/slip-1?external_id=SLIP-1' },
    ],
  },
];

describe('CRM order, estimate, and slip tools', () => {
  beforeEach(() => {
    resetBinaryDownloadStoreForTests();
    resetBinaryUploadStoreForTests();
  });

  it('activates an order with read-after-write verification', async () => {
    const activate = jest.fn().mockResolvedValue({
      ok: true,
      operation: 'activate',
      status: 'active',
      order_id: 'order-1',
    });
    const retrieve = jest.fn().mockResolvedValue({
      id: 'order-1',
      status: 'active',
    });

    const result = await crmActivateOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { activate, retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
        external_id: 'ORD-1',
      },
    });

    expect(activate).toHaveBeenCalledWith('order-1', { external_id: 'ORD-1' }, undefined);
    expect(retrieve).toHaveBeenCalledWith(
      'order-1',
      {
        external_id: 'ORD-1',
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      ok: true,
      operation: 'activate',
      status: 'active',
      order_id: 'order-1',
      verification: {
        entity: 'order',
        expected_status: 'active',
        actual_status: 'active',
        matched: true,
      },
    });
  });

  it('archives an order with read-after-write verification', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      operation: 'archive',
      status: 'archived',
      usage_status: 'archived',
      permanently_deleted: false,
      order_id: 'order-1',
    });
    const retrieve = jest.fn().mockResolvedValue({
      id: 'order-1',
      status: 'archived',
    });

    const result = await crmDeleteOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { delete: del, retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
        external_id: 'ORD-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'order-1',
      {
        external_id: 'ORD-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      operation: 'archive',
      status: 'archived',
      usage_status: 'archived',
      permanently_deleted: false,
      order_id: 'order-1',
      verification: {
        entity: 'order',
        expected_status: 'archived',
        actual_status: 'archived',
        matched: true,
        record_id: 'order-1',
      },
    });
  });

  it('treats archived order 404 readback as successful verification', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'archived',
      order_id: 'order-1',
    });
    const retrieve = jest.fn().mockRejectedValue(new Error('404 {"error":{"code":"NOT_FOUND"}}'));

    const result = await crmDeleteOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { delete: del, retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
      },
    });

    expect(result.structuredContent).toMatchObject({
      ok: true,
      status: 'archived',
      verification: {
        entity: 'order',
        expected_status: 'archived',
        actual_status: 'not_found',
        matched: true,
        record_id: 'order-1',
        verification_mode: 'not_found_after_archive',
      },
    });
  });

  it('permanently deletes an archived order only with explicit confirmation', async () => {
    const v2Delete = jest.fn().mockResolvedValue({
      success: true,
      data: {
        status: 'permanently_deleted',
        order_id: 'order-1',
        updated_count: 1,
        meta: { operation: 'permanent_delete' },
      },
      meta: { ctx_id: 'ctx-test' },
    });
    const retrieve = jest.fn().mockRejectedValue(new Error('Not found'));

    const result = await crmPermanentDeleteOrderTool.handler({
      reqContext: {
        client: {
          v2Delete,
          public: {
            orders: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
        external_id: 'ORD-1',
        confirm: true,
      },
    });

    expect(v2Delete).toHaveBeenCalledWith('/orders/order-1/permanent-delete', {
      query: { external_id: 'ORD-1', confirm: true },
    });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      operation: 'permanent_delete',
      status: 'permanently_deleted',
      permanently_deleted: true,
      order_id: 'order-1',
      updated_count: 1,
      ctx_id: 'ctx-test',
      verification: {
        entity: 'order',
        expected_status: 'deleted',
        actual_status: 'not_found',
        matched: true,
      },
    });

    const blocked = await crmPermanentDeleteOrderTool.handler({
      reqContext: {
        client: {
          v2Delete: jest.fn(),
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
      },
    });
    expect(blocked.isError).toBe(true);
  });

  it('lists estimates with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      { id_est: 1, company_name: 'Acme', total_price: 100 },
      { id_est: 2, company_name: 'Globex', total_price: 200 },
      { id_est: 3, company_name: 'Initech', total_price: 300 },
    ]);

    const result = await crmListEstimatesTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, workspace_id: 'workspace-1', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 estimates.',
      permission: undefined,
      results: [
        { id_est: 1, company_name: 'Acme', total_price: 100 },
        { id_est: 2, company_name: 'Globex', total_price: 200 },
      ],
    });
  });

  it('accepts v2 estimate detail payloads without legacy timestamp fields', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'estimate-1',
      id_est: '1',
      company_name: null,
      contact_name: null,
      customer_label: null,
      status: 'draft',
      total_price: '2200000',
      currency: 'JPY',
      start_date: '2026-06-01',
    });

    const result = await crmGetEstimateTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { estimate_id: 'estimate-1', language: 'ja' },
    });

    const outputSchema = crmGetEstimateTool.tool.outputSchema as {
      additionalProperties?: boolean;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    expect(outputSchema.required ?? []).not.toContain('created_at');
    expect(outputSchema.required ?? []).not.toContain('updated_at');
    expect(outputSchema.additionalProperties).toBe(true);
    expect(outputSchema.properties ?? {}).toEqual({});
    expect(result.structuredContent).toMatchObject({
      id: 'estimate-1',
      id_est: '1',
      status: 'draft',
      company_name: null,
      contact_name: null,
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Loaded estimate successfully: Estimate No. 1.',
      },
    ]);
  });

  it('returns saveable artifact metadata when downloading an estimate PDF', async () => {
    const pdfBytes = Buffer.from('%PDF-estimate');
    const downloadPDF = jest.fn().mockResolvedValue(
      new Response(pdfBytes, {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition':
            'attachment; filename="estimate.pdf"; filename*=UTF-8\'\'%E8%A6%8B%E7%A9%8D%E6%9B%B8.pdf',
        },
      }),
    );

    const result = await crmDownloadEstimatePDFTool.handler({
      reqContext: {
        client: { public: { estimates: { downloadPDF } } } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        estimate_id: 'estimate-1',
        template_select: 'template-1',
        language: 'ja',
      },
    });

    expect(downloadPDF).toHaveBeenCalledWith(
      'estimate-1',
      {
        template_select: 'template-1',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      content_disposition:
        'attachment; filename="estimate.pdf"; filename*=UTF-8\'\'%E8%A6%8B%E7%A9%8D%E6%9B%B8.pdf',
      mime_type: 'application/pdf',
      filename: '見積書.pdf',
      byte_length: pdfBytes.byteLength,
      completion_status: 'inline_content',
      download_complete: true,
      file_assembly_required: false,
      content_base64_available: true,
      content_base64: pdfBytes.toString('base64'),
      resource_uri: 'resource://tool-response',
    });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: `Downloaded 見積書.pdf (${pdfBytes.byteLength} bytes). Decode structuredContent.content_base64 to save the PDF locally.`,
    });
  });

  it('blocks direct CRM-sourced invoice subscription and procurement creation', async () => {
    const createInvoice = jest.fn();
    const createSubscription = jest.fn();
    const createPurchaseOrder = jest.fn();
    const reqContext = {
      client: {
        public: {
          invoices: { create: createInvoice },
          subscriptions: { create: createSubscription },
          purchaseOrders: { create: createPurchaseOrder },
        },
      } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const invoiceResult = await crmCreateInvoiceTool.handler({
      reqContext,
      args: {
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          external_id: '46558049080',
        },
        company_id: 'company-1',
        total_price: 120,
      },
    });
    const subscriptionResult = await crmCreateSubscriptionTool.handler({
      reqContext,
      args: {
        source_system: 'salesforce',
        object_type: 'opportunity',
        salesforce_opportunity_id: '0065g00000Opportunity',
      },
    });
    const purchaseOrderResult = await crmCreatePurchaseOrderTool.handler({
      reqContext,
      args: {
        hubspot_deal_url: 'https://app.hubspot.com/contacts/49714315/record/0-3/46558049080',
        company_id: 'supplier-1',
      },
    });

    expect(createInvoice).not.toHaveBeenCalled();
    expect(createSubscription).not.toHaveBeenCalled();
    expect(createPurchaseOrder).not.toHaveBeenCalled();
    for (const result of [invoiceResult, subscriptionResult, purchaseOrderResult]) {
      expect(result.isError).toBe(true);
      expect((result.content[0] as any).text).toContain('deal_to_order');
      expect((result.content[0] as any).text).toContain('Sanka Order');
    }
  });

  it('lists slips with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      { id_slip: 401, company_name: 'Acme', contact_name: 'Taylor', slip_type: 'delivery_slip' },
      { id_slip: 402, company_name: 'Globex', contact_name: 'Jordan', slip_type: 'delivery_slip' },
    ]);
    const reqContext = {
      client: {
        public: {
          slips: { list },
        },
      } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const listResult = await crmListSlipsTool.handler({
      reqContext,
      args: { limit: 1, workspace_id: 'workspace-1', language: 'en' },
    });
    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(listResult.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 2,
      message: 'Returned 1 of 2 slips.',
      permission: undefined,
      results: [{ id_slip: 401, company_name: 'Acme', contact_name: 'Taylor', slip_type: 'delivery_slip' }],
    });
  });

  it.each([
    {
      name: 'order',
      tool: crmDownloadOrderPDFTool,
      args: { order_id: 'order 1', external_id: 'order-ext', template_select: 'tpl-1' },
      expectedID: 'order 1',
      expectedParams: { external_id: 'order-ext', template_select: 'tpl-1' },
      clientResource: 'orders',
      fallbackFilename: 'order.pdf',
    },
    {
      name: 'purchase order',
      tool: crmDownloadPurchaseOrderPDFTool,
      args: {
        purchase_order_id: 'po 1',
        external_id: 'po-ext',
        template_select: 'tpl-1',
        language: 'ja',
      },
      expectedID: 'po 1',
      expectedParams: { external_id: 'po-ext', template_select: 'tpl-1', language: 'ja' },
      clientResource: 'purchaseOrders',
      fallbackFilename: 'purchase-order.pdf',
    },
    {
      name: 'estimate',
      tool: crmDownloadEstimatePDFTool,
      args: { estimate_id: 'estimate 1', external_id: 'est-ext', template_select: 'tpl-1' },
      expectedID: 'estimate 1',
      expectedParams: { external_id: 'est-ext', template_select: 'tpl-1' },
      clientResource: 'estimates',
      fallbackFilename: 'estimate.pdf',
    },
    {
      name: 'invoice',
      tool: crmDownloadInvoicePDFTool,
      args: { invoice_id: 'invoice 1', external_id: 'inv-ext', template_select: 'tpl-1', language: 'ja' },
      expectedID: 'invoice 1',
      expectedParams: { external_id: 'inv-ext', template_select: 'tpl-1', 'Accept-Language': 'ja' },
      clientResource: 'invoices',
      fallbackFilename: 'invoice.pdf',
    },
    {
      name: 'payment',
      tool: crmDownloadPaymentPDFTool,
      args: { payment_id: 'payment 1', external_id: 'pay-ext', template_select: 'tpl-1', language: 'ja' },
      expectedID: 'payment 1',
      expectedParams: { external_id: 'pay-ext', template_select: 'tpl-1', 'Accept-Language': 'ja' },
      clientResource: 'payments',
      fallbackFilename: 'payment.pdf',
    },
    {
      name: 'slip',
      tool: crmDownloadSlipPDFTool,
      args: { slip_id: 'slip 1', external_id: 'slip-ext', template_select: 'tpl-1', language: 'ja' },
      expectedID: 'slip 1',
      expectedParams: { external_id: 'slip-ext', template_select: 'tpl-1', 'Accept-Language': 'ja' },
      clientResource: 'slips',
      fallbackFilename: 'slip.pdf',
    },
  ])(
    'downloads $name PDFs through the V2 SDK endpoint',
    async ({ tool, args, expectedID, expectedParams, clientResource, fallbackFilename }) => {
      const pdfBytes = Buffer.from('%PDF-template');
      const downloadPDF = jest.fn().mockResolvedValue(
        new Response(pdfBytes, {
          headers: {
            'content-type': 'application/pdf',
            'content-disposition': `attachment; filename="${fallbackFilename}"`,
          },
        }),
      );
      const reqContext = {
        client: { public: { [clientResource]: { downloadPDF } } } as any,
        auth: oauthContext(),
        toolProfile: 'full' as const,
      };

      const result = await tool.handler({ reqContext, args });

      expect(downloadPDF).toHaveBeenCalledWith(expectedID, expectedParams, undefined);
      expect(result.structuredContent).toMatchObject({
        mime_type: 'application/pdf',
        filename: fallbackFilename,
        byte_length: pdfBytes.byteLength,
        download_complete: true,
        content_base64_available: true,
        content_base64: pdfBytes.toString('base64'),
      });
    },
  );

  describeV2Requests(v2Requests);
});
