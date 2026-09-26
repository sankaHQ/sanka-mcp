import {
  crmCreateBillTool,
  crmCreateDisbursementAllocationTool,
  crmCreateDisbursementTool,
  crmCreateExpenseTool,
  crmCreatePurchaseOrderTool,
  crmDeleteBillTool,
  crmDeleteDisbursementAllocationTool,
  crmDeleteDisbursementTool,
  crmDeleteExpenseTool,
  crmDeletePurchaseOrderTool,
  crmDownloadPurchaseOrderPDFTool,
  crmGetBillTool,
  crmGetDisbursementTool,
  crmGetExpenseTool,
  crmGetPurchaseOrderTool,
  crmListBillsTool,
  crmListDisbursementAllocationsTool,
  crmListDisbursementsTool,
  crmListExpensesTool,
  crmListPurchaseOrdersTool,
  crmUpdateBillTool,
  crmUpdateDisbursementAllocationTool,
  crmUpdateDisbursementTool,
  crmUpdateExpenseTool,
  crmUpdatePurchaseOrderTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { resetBinaryDownloadStoreForTests } from '../../../packages/mcp-server/src/binary-download-store';
import { resetBinaryUploadStoreForTests } from '../../../packages/mcp-server/src/binary-upload-store';
import { describeV2Requests, oauthContext, type V2RequestCase } from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'gets one purchase order',
    tool: crmGetPurchaseOrderTool,
    args: { purchase_order_id: 'purchase-order-1', external_id: 'PO-1', language: 'ja' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/purchase-orders/purchase-order-1?external_id=PO-1',
        headers: { 'accept-language': 'ja' },
      },
    ],
  },
  {
    name: 'creates a purchase order',
    tool: crmCreatePurchaseOrderTool,
    args: {
      company_id: 'company-1',
      contact_id: 'contact-1',
      currency: 'USD',
      date: '2026-04-09',
      tax_rate: 10,
      attachment_file_ids: ['file-1'],
      external_id: 'PO-1',
      line_items: [{ item_name: 'Purchased item', quantity: 2, unit_price: 500, tax_rate: 10 }],
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/purchase-orders',
        body: {
          properties: {
            attachment_file: { files: [{ file_id: 'file-1' }] },
            company_id: 'company-1',
            contact_id: 'contact-1',
            currency: 'USD',
            date: '2026-04-09',
            external_id: 'PO-1',
            tax_rate: 10,
          },
          line_items: [{ item_name: 'Purchased item', quantity: 2, unit_price: 500, tax_rate: 10 }],
        },
      },
    ],
  },
  {
    name: 'updates a purchase order status',
    tool: crmUpdatePurchaseOrderTool,
    args: {
      purchase_order_id: 'purchase-order-1',
      status: 'sent',
      notes: 'Approved by finance',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/purchase-orders/purchase-order-1',
        body: { properties: { notes: 'Approved by finance', status: 'sent' } },
      },
    ],
  },
  {
    name: 'deletes a purchase order',
    tool: crmDeletePurchaseOrderTool,
    args: {
      purchase_order_id: 'purchase-order-1',
      external_id: 'PO-1',
    },
    expectedRequests: [
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/purchase-orders/purchase-order-1?external_id=PO-1',
      },
    ],
  },
  {
    name: 'gets one bill',
    tool: crmGetBillTool,
    args: { bill_id: 'bill-1', external_id: 'BILL-1', language: 'ja' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/bills/bill-1?external_id=BILL-1',
        headers: { 'accept-language': 'ja' },
      },
    ],
  },
  {
    name: 'creates a bill',
    tool: crmCreateBillTool,
    args: {
      company_id: 'company-1',
      currency: 'USD',
      due_date: '2026-04-20',
      tax_inclusive: false,
      attachment_file_ids: ['file-1'],
      line_items: [{ item_name: 'Bill row', quantity: 2, unit_price: 500, tax_rate: 10 }],
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/bills',
        body: {
          properties: {
            attachment_file: { files: [{ file_id: 'file-1' }] },
            company_id: 'company-1',
            currency: 'USD',
            due_date: '2026-04-20',
            tax_inclusive: false,
          },
          line_items: [{ item_name: 'Bill row', quantity: 2, unit_price: 500, tax_rate: 10 }],
        },
      },
    ],
  },
  {
    name: 'updates a bill',
    tool: crmUpdateBillTool,
    args: {
      bill_id: 'bill-1',
      status: 'paid',
      payment_date: '2026-04-15',
      attachment_file_ids: ['file-2'],
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/bills/bill-1',
        body: {
          properties: {
            attachment_file: { files: [{ file_id: 'file-2' }] },
            payment_date: '2026-04-15',
            status: 'paid',
          },
        },
      },
    ],
  },
  {
    name: 'deletes a bill',
    tool: crmDeleteBillTool,
    args: {
      bill_id: 'bill-1',
      external_id: 'BILL-1',
    },
    expectedRequests: [
      { method: 'DELETE', url: 'http://localhost:5000/api/v2/bills/bill-1?external_id=BILL-1' },
    ],
  },
  {
    name: 'gets one disbursement',
    tool: crmGetDisbursementTool,
    args: { disbursement_id: 'disbursement-1', external_id: 'DSB-1', language: 'ja' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/disbursements/disbursement-1?external_id=DSB-1',
        headers: { 'accept-language': 'ja' },
      },
    ],
  },
  {
    name: 'creates a disbursement',
    tool: crmCreateDisbursementTool,
    args: {
      company_id: 'company-1',
      currency: 'USD',
      fee: 25,
      tax_inclusive: true,
      line_items: [{ item_name: 'Disbursement row', quantity: 2, unit_price: 400, tax_rate: 0 }],
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/disbursements',
        body: {
          properties: { company_id: 'company-1', currency: 'USD', fee: 25, tax_inclusive: true },
          line_items: [{ item_name: 'Disbursement row', quantity: 2, unit_price: 400, tax_rate: 0 }],
        },
      },
    ],
  },
  {
    name: 'updates a disbursement',
    tool: crmUpdateDisbursementTool,
    args: {
      disbursement_id: 'disbursement-1',
      status: 'approved',
      notes: 'Approved for payout',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/disbursements/disbursement-1',
        body: { properties: { notes: 'Approved for payout', status: 'approved' } },
      },
    ],
  },
  {
    name: 'deletes a disbursement',
    tool: crmDeleteDisbursementTool,
    args: {
      disbursement_id: 'disbursement-1',
      external_id: 'DSB-1',
    },
    expectedRequests: [
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/disbursements/disbursement-1?external_id=DSB-1',
      },
    ],
  },
  {
    name: 'creates a disbursement allocation',
    tool: crmCreateDisbursementAllocationTool,
    args: {
      disbursement_id: 'disbursement-1',
      payable_type: 'expense',
      expense_id: 'expense-1',
      amount: 125,
      notes: 'Receipt allocation',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/disbursements/disbursement-1/allocations',
        body: { payable_type: 'expense', expense_id: 'expense-1', notes: 'Receipt allocation', amount: 125 },
      },
    ],
  },
  {
    name: 'updates a disbursement allocation',
    tool: crmUpdateDisbursementAllocationTool,
    args: {
      disbursement_id: 'disbursement-1',
      allocation_id: 'allocation-1',
      amount: 150,
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/public/disbursements/disbursement-1/allocations/allocation-1',
        body: { amount: 150 },
      },
    ],
  },
  {
    name: 'deletes a disbursement allocation',
    tool: crmDeleteDisbursementAllocationTool,
    args: {
      disbursement_id: 'disbursement-1',
      allocation_id: 'allocation-1',
    },
    expectedRequests: [
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/public/disbursements/disbursement-1/allocations/allocation-1',
      },
    ],
  },
  {
    name: 'updates an expense',
    tool: crmUpdateExpenseTool,
    args: {
      expense_id: 'expense-1',
      base_currency: 235_098,
      description: 'Updated hotel',
      company_id: 'company-1',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/expenses/expense-1',
        body: {
          properties: { base_currency: 235098, company_id: 'company-1', description: 'Updated hotel' },
        },
      },
    ],
  },
  {
    name: 'deletes an expense',
    tool: crmDeleteExpenseTool,
    args: {
      expense_id: 'expense-1',
      external_id: 'EXP-1',
    },
    expectedRequests: [
      { method: 'DELETE', url: 'http://localhost:5000/api/v2/expenses/expense-1?external_id=EXP-1' },
    ],
  },
];

describe('CRM purchasing and expense tools', () => {
  beforeEach(() => {
    resetBinaryDownloadStoreForTests();
    resetBinaryUploadStoreForTests();
  });

  it('lists purchase orders with a local result limit and downloads their PDFs', async () => {
    const list = jest.fn().mockResolvedValue([
      { id_po: 901, company_name: 'Acme', contact_name: 'Taylor', total_price: 1200 },
      { id_po: 902, company_name: 'Globex', contact_name: 'Jordan', total_price: 900 },
    ]);
    const reqContext = {
      client: {
        public: {
          purchaseOrders: { list },
        },
      } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const listResult = await crmListPurchaseOrdersTool.handler({
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
      message: 'Returned 1 of 2 purchase orders.',
      permission: undefined,
      results: [{ id_po: 901, company_name: 'Acme', contact_name: 'Taylor', total_price: 1200 }],
    });

    const pdfBytes = Buffer.from('%PDF-purchase-order');
    const downloadPDF = jest.fn().mockResolvedValue(
      new Response(pdfBytes, {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition':
            'attachment; filename="purchase-order.pdf"; filename*=UTF-8\'\'purchase-order-901.pdf',
        },
      }),
    );
    const downloadResult = await crmDownloadPurchaseOrderPDFTool.handler({
      reqContext: {
        client: { public: { purchaseOrders: { downloadPDF } } } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        purchase_order_id: 'purchase-order-1',
        template_select: 'template-1',
        language: 'ja',
      },
    });
    expect(downloadPDF).toHaveBeenCalledWith(
      'purchase-order-1',
      {
        template_select: 'template-1',
        language: 'ja',
      },
      undefined,
    );
    expect(downloadResult.structuredContent).toEqual({
      content_disposition:
        'attachment; filename="purchase-order.pdf"; filename*=UTF-8\'\'purchase-order-901.pdf',
      mime_type: 'application/pdf',
      filename: 'purchase-order-901.pdf',
      byte_length: pdfBytes.byteLength,
      completion_status: 'inline_content',
      download_complete: true,
      file_assembly_required: false,
      content_base64_available: true,
      content_base64: pdfBytes.toString('base64'),
      resource_uri: 'resource://tool-response',
    });
  });

  it('lists bills with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      { id_bill: 501, company_name: 'Acme', contact_name: 'Taylor', amount: 1200 },
      { id_bill: 502, company_name: 'Globex', contact_name: 'Jordan', amount: 900 },
    ]);
    const reqContext = {
      client: {
        public: {
          bills: { list },
        },
      } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const listResult = await crmListBillsTool.handler({
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
      message: 'Returned 1 of 2 bills.',
      permission: undefined,
      results: [{ id_bill: 501, company_name: 'Acme', contact_name: 'Taylor', amount: 1200 }],
    });
  });

  it('lists disbursements with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      { id_dsb: 601, company_name: 'Acme', contact_name: 'Taylor', total_price: 800 },
      { id_dsb: 602, company_name: 'Globex', contact_name: 'Jordan', total_price: 650 },
    ]);
    const reqContext = {
      client: {
        public: {
          disbursements: { list },
        },
      } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const listResult = await crmListDisbursementsTool.handler({
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
      message: 'Returned 1 of 2 disbursements.',
      permission: undefined,
      results: [{ id_dsb: 601, company_name: 'Acme', contact_name: 'Taylor', total_price: 800 }],
    });
  });

  it('lists disbursement allocations with the allocation summary', async () => {
    const allocationPayload = {
      disbursement: {
        id: 'disbursement-1',
        id_dsb: 701,
        allocated_amount: 125,
        unallocated_amount: 375,
      },
      allocations: [
        {
          id: 'allocation-1',
          payable_type: 'expense',
          payable_id: 'expense-1',
          amount: 125,
        },
      ],
      available_payables: [],
    };
    const allocationEnvelope = (data: unknown) => ({
      success: true,
      data,
      meta: { ctx_id: 'ctx-disbursement-allocation' },
    });
    const get = jest.fn().mockResolvedValue(allocationEnvelope(allocationPayload));

    const reqContext = {
      client: { get } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const listResult = await crmListDisbursementAllocationsTool.handler({
      reqContext,
      args: {
        disbursement_id: 'disbursement-1',
        external_id: 'DSB-1',
        language: 'en',
      },
    });
    expect(get).toHaveBeenCalledWith('/api/v2/public/disbursements/disbursement-1/allocations', {
      query: {
        external_id: 'DSB-1',
        'Accept-Language': 'en',
      },
    });
    expect(listResult.structuredContent).toEqual({
      ...allocationPayload,
      ctx_id: 'ctx-disbursement-allocation',
    });
    expect(listResult.content).toEqual([
      {
        type: 'text',
        text: 'Loaded 1 disbursement payable allocation for disbursement disbursement-1. Allocated: 125; unallocated: 375.',
      },
    ]);
  });

  it('lists expenses with a server-reported total', async () => {
    const withResponse = jest.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: 'expense-1',
              record_id: '101',
              properties: {
                description: 'Google Workspace',
                company_name: 'Google',
                amount: 20,
                currency: 'USD',
              },
            },
            {
              id: 'expense-2',
              record_id: '102',
              properties: { description: 'Zoom', company_name: 'Zoom', amount: 10, currency: 'USD' },
            },
          ],
          page: 1,
          page_size: 2,
          total: 2288,
        },
        meta: { pagination: { page: 1, page_size: 2, total: 2288 } },
      },
      response: new Response('{}'),
    });
    const v2Get = jest.fn().mockReturnValue({ withResponse });

    const result = await crmListExpensesTool.handler({
      reqContext: {
        client: {
          v2Get,
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, language: 'en', workspace_id: 'workspace-1' },
    });

    expect(v2Get).toHaveBeenCalledWith('/expenses', {
      query: {
        limit: 2,
        page: 1,
        workspace_id: 'workspace-1',
      },
      headers: { 'Accept-Language': 'en' },
    });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 2288,
      message: 'Returned 2 of 2288 expenses.',
      permission: undefined,
      results: [
        {
          id: 'expense-1',
          id_pm: 101,
          description: 'Google Workspace',
          company_name: 'Google',
          amount: 20,
          currency: 'USD',
        },
        {
          id: 'expense-2',
          id_pm: 102,
          description: 'Zoom',
          company_name: 'Zoom',
          amount: 10,
          currency: 'USD',
        },
      ],
    });
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    expect(text).toContain('Found 2288 expenses. Examples: Google Workspace, Zoom.');
    expect(text).toContain('expenses model context:');
    expect(text).toContain('"description": "Google Workspace"');
  });

  it('gets one expense when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'expense-1',
      description: 'Google Workspace',
      company_name: 'Google',
      amount: 20,
      currency: 'USD',
      created_at: '2026-04-08T00:00:00Z',
    });
    const listFiles = jest.fn().mockResolvedValue({
      items: [
        {
          file_id: 'expense-file-row-1',
          name: 'receipt.pdf',
          file: 'expense-files/receipt.pdf',
        },
      ],
      total: 1,
    });

    const result = await crmGetExpenseTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { retrieve, listFiles },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { expense_id: 'expense-1', external_id: 'EXP-1', language: 'en' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'expense-1',
      {
        external_id: 'EXP-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(listFiles).toHaveBeenCalledWith('expense-1', { page: 1, page_size: 100 }, undefined);
    expect(result.structuredContent).toEqual({
      id: 'expense-1',
      description: 'Google Workspace',
      company_name: 'Google',
      amount: 20,
      currency: 'USD',
      created_at: '2026-04-08T00:00:00Z',
      attached_files: [
        {
          file_id: 'expense-file-row-1',
          name: 'receipt.pdf',
          file: 'expense-files/receipt.pdf',
        },
      ],
      attachment_file_count: 1,
    });
  });

  it('creates an expense with uploaded attachment ids', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      expense_id: 'expense-1',
      external_id: 'EXP-1',
      advisories: [
        {
          code: 'missing_recommended_partner',
          message: 'Created without a linked company or contact.',
          requires_confirmation: true,
        },
      ],
    });
    const listFiles = jest.fn().mockResolvedValue({
      items: [
        {
          file_id: 'expense-file-row-1',
          name: 'hotel.pdf',
          file: 'expense-files/hotel.pdf',
        },
        {
          file_id: 'expense-file-row-2',
          name: 'meal.pdf',
          file: 'expense-files/meal.pdf',
        },
      ],
      total: 2,
    });

    const result = await crmCreateExpenseTool.handler({
      reqContext: {
        client: { public: { expenses: { create, listFiles } } } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        amount: 100,
        base_currency: 235_098,
        company_external_id: 'vendor-ext-1',
        currency: 'USD',
        description: 'Hotel',
        external_id: 'EXP-1',
        status: 'submitted',
        attachment_file_ids: ['file-1', 'file-2'],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        amount: 100,
        base_currency: 235_098,
        company_external_id: 'vendor-ext-1',
        currency: 'USD',
        description: 'Hotel',
        external_id: 'EXP-1',
        status: 'submitted',
        attachment_file: {
          files: [{ file_id: 'file-1' }, { file_id: 'file-2' }],
        },
      },
      undefined,
    );
    expect(listFiles).toHaveBeenCalledWith('expense-1', { page: 1, page_size: 100 }, undefined);
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      expense_id: 'expense-1',
      external_id: 'EXP-1',
      attached_files: [
        {
          file_id: 'expense-file-row-1',
          name: 'hotel.pdf',
          file: 'expense-files/hotel.pdf',
        },
        {
          file_id: 'expense-file-row-2',
          name: 'meal.pdf',
          file: 'expense-files/meal.pdf',
        },
      ],
      attachment_file_count: 2,
      attachment_verification: {
        status: 'verified',
        ok: true,
        mutation_succeeded: true,
        expected_uploaded_file_ids: ['file-1', 'file-2'],
        attached_file_count: 2,
      },
      advisories: [
        {
          code: 'missing_recommended_partner',
          message: 'Created without a linked company or contact.',
          requires_confirmation: true,
        },
      ],
    });
    const summaryBlock = result.content?.[0];
    expect(summaryBlock?.type).toBe('text');
    const summaryText = summaryBlock?.type === 'text' ? summaryBlock.text : '';
    expect(summaryText).toContain('Partner fields are missing');
    expect(summaryText).toContain('explicit permission');
  });

  it('separates successful expense creation from unavailable attachment verification', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      expense_id: 'expense-1',
    });

    const result = await crmCreateExpenseTool.handler({
      reqContext: {
        client: { public: { expenses: { create } } } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        amount: 100,
        currency: 'USD',
        attachment_file_ids: ['file-1'],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        amount: 100,
        currency: 'USD',
        attachment_file: {
          files: [{ file_id: 'file-1' }],
        },
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      expense_id: 'expense-1',
      attachment_verification: {
        status: 'unavailable',
        verified: false,
        mutation_succeeded: true,
        expected_uploaded_file_ids: ['file-1'],
        message:
          'Expense was saved, but this Sanka SDK cannot verify attachments because listFiles is unavailable.',
      },
    });
    expect((result.structuredContent as any).attachment_verification).not.toHaveProperty('ok');
  });

  describeV2Requests(v2Requests);
});
