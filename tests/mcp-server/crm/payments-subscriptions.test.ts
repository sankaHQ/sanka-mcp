import {
  crmCreatePaymentTool,
  crmCreateSubscriptionTool,
  crmDeletePaymentTool,
  crmGetPaymentTool,
  crmListPaymentAllocationsTool,
  crmListPaymentsTool,
  crmUpdatePaymentAllocationsTool,
  crmUpdatePaymentTool,
  crmUpdateSubscriptionTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { describeV2Requests, oauthContext, type V2RequestCase } from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'gets one payment when authentication is present',
    tool: crmGetPaymentTool,
    args: { payment_id: 'payment-1', external_id: 'PAY-1', language: 'ja' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/payments/payment-1?external_id=PAY-1',
        headers: { 'accept-language': 'ja' },
      },
    ],
  },
  {
    name: 'creates a payment',
    tool: crmCreatePaymentTool,
    args: {
      company_id: 'company-1',
      external_id: 'PAY-1',
      currency: 'USD',
      entry_type: 'item',
      tax_rate: 10,
      tax_option: 'unified_tax',
      line_items: [{ item_name: 'Payment row', quantity: 2, unit_price: 50, tax_rate: 10 }],
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/payments',
        body: {
          properties: {
            company_id: 'company-1',
            currency: 'USD',
            entry_type: 'item',
            external_id: 'PAY-1',
            tax_option: 'unified_tax',
            tax_rate: 10,
          },
          line_items: [{ item_name: 'Payment row', quantity: 2, unit_price: 50, tax_rate: 10 }],
        },
      },
    ],
  },
  {
    name: 'updates a payment',
    tool: crmUpdatePaymentTool,
    args: {
      payment_id: 'payment-1',
      status: 'paid',
      notes: 'Updated payment notes',
      external_id: 'PAY-1',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/payments/payment-1',
        body: { properties: { external_id: 'PAY-1', notes: 'Updated payment notes', status: 'paid' } },
      },
    ],
  },
  {
    name: 'deletes a payment',
    tool: crmDeletePaymentTool,
    args: {
      payment_id: 'payment-1',
      external_id: 'PAY-1',
    },
    expectedRequests: [
      { method: 'DELETE', url: 'http://localhost:5000/api/v2/payments/payment-1?external_id=PAY-1' },
    ],
  },
  {
    name: 'creates a subscription for a company customer with copied invoice line items',
    tool: crmCreateSubscriptionTool,
    args: {
      company_id: 'company-1',
      subscription_status: 'active',
      start_date: '2026-06-01',
      frequency: 1,
      frequency_time: 'months',
      currency: 'JPY',
      tax_rate: 10,
      discount_value: 10,
      discount_number_format: '%',
      discount_tax_option: 'post_tax',
      line_items: [
        {
          item_name: 'Launch support package',
          quantity: 1,
          unit_price: 155000,
        },
      ],
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/subscriptions',
        body: {
          properties: {
            status: 'active',
            company_id: 'company-1',
            currency: 'JPY',
            frequency: 1,
            frequency_time: 'months',
            number_item: 1,
            start_date: '2026-06-01',
            tax_rate: 10,
            discount_value: 10,
            discount_number_format: '%',
            discount_tax_option: 'post_tax',
            line_items: [{ custom_item_name: 'Launch support package', quantity: 1, unit_price: 155000 }],
          },
        },
      },
    ],
  },
  {
    name: 'updates a subscription with lookup_external_id',
    tool: crmUpdateSubscriptionTool,
    args: {
      subscription_id: 'sub-1',
      lookup_external_id: 'ext-sub-1',
      status: 'active',
      currency: 'JPY',
      tax_rate: 10,
      total_price: 1100,
      total_price_without_tax: 1000,
      frequency: 1,
      frequency_time: 'months',
      billing_timing: 'first_day',
      billing_anchor: 'start_date',
      payment_term_type: 'net',
      payment_term_days: 30,
      auto_gen_invoice: true,
      auto_gen_invoice_statuses: 'active',
      custom_fields: { custom_note: 'June cleanup' },
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/subscriptions/sub-1?external_id=ext-sub-1',
        body: {
          properties: {
            status: 'active',
            currency: 'JPY',
            frequency: 1,
            frequency_time: 'months',
            billing_timing: 'first_day',
            billing_anchor: 'start_date',
            payment_term_type: 'net',
            payment_term_days: 30,
            auto_gen_invoice: true,
            auto_gen_invoice_statuses: 'active',
            tax_rate: 10,
            custom_fields: { custom_note: 'June cleanup' },
            total_price: 1100,
            total_price_without_tax: 1000,
          },
        },
      },
    ],
  },
  {
    name: 'updates a subscription record discount',
    tool: crmUpdateSubscriptionTool,
    args: {
      subscription_id: 'sub-1',
      discount_id: 'discount-1',
      discount_tax_option: 'pre_tax',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/subscriptions/sub-1',
        body: { properties: { discount_id: 'discount-1', discount_tax_option: 'pre_tax' } },
      },
    ],
  },
  {
    name: 'clears a subscription record discount',
    tool: crmUpdateSubscriptionTool,
    args: {
      subscription_id: 'sub-1',
      clear_discount: true,
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/subscriptions/sub-1',
        body: { properties: { clear_discount: true } },
      },
    ],
  },
  {
    name: 'updates a payment with lookup_external_id',
    tool: crmUpdatePaymentTool,
    args: {
      payment_id: 'pay-1',
      lookup_external_id: 'pay-ext-1',
      total_price: 1200,
      currency: 'USD',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/payments/pay-1?external_id=pay-ext-1',
        body: { properties: { currency: 'USD', total_price: 1200 } },
      },
    ],
  },
  {
    name: 'creates subscriptions with end dates and contract associations',
    tool: crmCreateSubscriptionTool,
    args: {
      company_id: 'company-1',
      items: [{ item_name: 'Monthly platform fee', quantity: 1, unit_price: 1000 }],
      subscription_status: 'active',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      contract_ids: ['contract-1'],
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/subscriptions',
        body: {
          properties: {
            status: 'active',
            contract_ids: ['contract-1'],
            company_id: 'company-1',
            number_item: 1,
            start_date: '2026-05-01',
            end_date: '2026-05-31',
            line_items: [{ custom_item_name: 'Monthly platform fee', quantity: 1, unit_price: 1000 }],
          },
        },
      },
    ],
  },
  {
    name: 'updates subscription dates and clears contract associations',
    tool: crmUpdateSubscriptionTool,
    args: {
      subscription_id: 'sub-1',
      status: 'completed',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      contract_ids: [],
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/subscriptions/sub-1',
        body: {
          properties: {
            status: 'completed',
            contract_ids: [],
            start_date: '2026-05-01',
            end_date: '2026-05-31',
          },
        },
      },
    ],
  },
];

describe('CRM payment and subscription tools', () => {
  it('lists payments with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id_rcp: 301,
        company_name: 'Acme',
        contact_name: 'Taylor',
        status: 'sent',
      },
      {
        id_rcp: 302,
        company_name: 'Globex',
        contact_name: 'Jordan',
        status: 'paid',
      },
      {
        id_rcp: 303,
        company_name: 'Initech',
        contact_name: 'Casey',
        status: 'draft',
      },
    ]);

    const result = await crmListPaymentsTool.handler({
      reqContext: {
        client: {
          public: {
            payments: { list },
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
      message: 'Returned 2 of 3 payments.',
      page: 1,
      permission: undefined,
      results: [
        {
          id_rcp: 301,
          company_name: 'Acme',
          contact_name: 'Taylor',
          status: 'sent',
        },
        {
          id_rcp: 302,
          company_name: 'Globex',
          contact_name: 'Jordan',
          status: 'paid',
        },
      ],
      total: 3,
    });
  });

  it('lists payment allocations', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: {
        payment: {
          id_rcp: 301,
          allocated_amount: 150,
          unallocated_amount: 0,
        },
        allocations: [{ invoice: { id_inv: 1147 }, amount: 150 }],
      },
      meta: { ctx_id: 'ctx-payment-allocation' },
    });

    const result = await crmListPaymentAllocationsTool.handler({
      reqContext: {
        client: {
          get,
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { payment_id: '301', external_id: 'PAY-301', language: 'ja' },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/public/payments/301/allocations', {
      query: {
        external_id: 'PAY-301',
        'Accept-Language': 'ja',
      },
    });
    expect(result.structuredContent).toEqual({
      payment: {
        id_rcp: 301,
        allocated_amount: 150,
        unallocated_amount: 0,
      },
      allocations: [{ invoice: { id_inv: 1147 }, amount: 150 }],
      ctx_id: 'ctx-payment-allocation',
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Loaded 1 invoice allocation for payment 301. Allocated: 150; unallocated: 0.',
      },
    ]);
  });

  it('updates payment allocations', async () => {
    const put = jest.fn().mockResolvedValue({
      success: true,
      data: {
        payment: {
          id_rcp: 301,
          allocated_amount: 150,
          unallocated_amount: 0,
        },
        allocations: [{ invoice: { id_inv: 1147 }, amount: 150 }],
      },
      meta: { ctx_id: 'ctx-payment-allocation' },
    });

    const result = await crmUpdatePaymentAllocationsTool.handler({
      reqContext: {
        client: {
          put,
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        payment_id: '301',
        external_id: 'PAY-301',
        language: 'ja',
        allocations: [
          {
            id_inv: 1147,
            amount: 150,
            source: 'mcp',
            notes: 'CSV reconciliation',
          },
        ],
      },
    });

    expect(put).toHaveBeenCalledWith('/api/v2/public/payments/301/allocations', {
      query: {
        external_id: 'PAY-301',
        'Accept-Language': 'ja',
      },
      body: {
        allocations: [
          {
            invoice_id: '1147',
            amount: 150,
            source: 'mcp',
            notes: 'CSV reconciliation',
          },
        ],
      },
    });
    expect(result.structuredContent).toEqual({
      payment: {
        id_rcp: 301,
        allocated_amount: 150,
        unallocated_amount: 0,
      },
      allocations: [{ invoice: { id_inv: 1147 }, amount: 150 }],
      ctx_id: 'ctx-payment-allocation',
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Payment reconciliation applied successfully (消し込み済み); allocation_applied=true. Updated 1 invoice allocation for payment 301. Allocated: 150; unallocated: 0. Linked invoices: 1147.',
      },
    ]);
  });

  it('rejects create_subscription without any customer identifier', async () => {
    const create = jest.fn();

    const result = await crmCreateSubscriptionTool.handler({
      reqContext: {
        client: {
          public: {
            subscriptions: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        subscription_status: 'active',
        items: [{ name: 'Plan', amount: 1, price: 100 }],
      },
    });

    expect(create).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: 'text',
        text: '`contact_id`, `company_id`, or `customer_id` is required.',
      },
    ]);
  });

  it('maps common legacy Japanese tax values to tax_rate when it is omitted', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'sub-1',
      status: 'active',
      items: [],
      contact_info: [],
      created_at: '2026-06-01T00:00:00Z',
      number_item: 1,
    });
    const handlerContext = {
      reqContext: {
        client: {
          public: {
            subscriptions: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full' as const,
      },
    };
    const baseArgs = {
      company_id: 'company-1',
      subscription_status: 'active',
      items: [{ item_name: 'Plan', quantity: 1, unit_price: 100 }],
    };

    await crmCreateSubscriptionTool.handler({
      ...handlerContext,
      args: { ...baseArgs, tax: 10 },
    });
    await crmCreateSubscriptionTool.handler({
      ...handlerContext,
      args: { ...baseArgs, tax: 100 },
    });

    expect(create).toHaveBeenNthCalledWith(1, expect.objectContaining({ tax: 10, tax_rate: 10 }), undefined);
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.not.objectContaining({ tax_rate: expect.anything() }),
      undefined,
    );
  });

  it('clears a subscription end date when end_date is explicitly null', async () => {
    const updateSchema = crmUpdateSubscriptionTool.tool.inputSchema as any;
    const outputSchema = crmUpdateSubscriptionTool.tool.outputSchema as any;
    expect(updateSchema.properties.end_date.type).toEqual(['string', 'null']);
    expect(outputSchema.properties.end_date.type).toEqual(['string', 'null']);

    const update = jest.fn().mockResolvedValue({
      id: 'sub-1',
      subscription_status: 'active',
      start_date: '2026-05-01',
      end_date: null,
      created_at: '2026-05-01T00:00:00Z',
      items: [],
    });

    const result = await crmUpdateSubscriptionTool.handler({
      reqContext: {
        client: {
          public: {
            subscriptions: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        subscription_id: 'sub-1',
        end_date: null,
      },
    });

    expect(update).toHaveBeenCalledWith(
      'sub-1',
      {
        end_date: null,
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      id: 'sub-1',
      end_date: null,
    });
  });

  describeV2Requests(v2Requests);
});
