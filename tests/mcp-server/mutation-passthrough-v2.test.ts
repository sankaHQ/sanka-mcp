import Sanka from 'sanka-sdk';

import {
  crmCreateBillTool,
  crmCreateDisbursementTool,
  crmCreatePaymentTool,
  crmCreatePurchaseOrderTool,
  crmCreateSlipTool,
  crmCreateSubscriptionTool,
  crmUpdateBillTool,
  crmUpdateDisbursementTool,
  crmUpdatePaymentTool,
  crmUpdatePurchaseOrderTool,
  crmUpdateSlipTool,
  crmUpdateSubscriptionTool,
} from '../../packages/mcp-server/src/crm-tools';

const oauthContext = {
  authMode: 'oauth_bearer' as const,
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: [],
  },
};

const envelope = (objectType: string) =>
  new Response(
    JSON.stringify({
      success: true,
      data: {
        id: `${objectType}-1`,
        record_id: '1001',
        object_type: objectType,
        properties: {},
      },
      meta: { ctx_id: 'ctx-mutation-passthrough' },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

type MutationCase = {
  name: string;
  objectType: string;
  tool: {
    handler: (input: {
      reqContext: {
        client: Sanka;
        auth: typeof oauthContext;
        toolProfile: 'full';
      };
      args: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  args: Record<string, unknown>;
  expectedMethod: string;
  expectedURL: string;
  expectedBody: Record<string, unknown>;
};

const lineItems = [{ item_name: 'Consulting', quantity: 2, unit_price: 500, tax_rate: 10 }];

const mutationCases: MutationCase[] = [
  {
    name: 'subscription create contract associations',
    objectType: 'subscription',
    tool: crmCreateSubscriptionTool,
    args: {
      company_id: 'company-1',
      contract_id: 'contract-1',
      contract_ids: ['contract-2'],
      items: lineItems,
      start_date: '2026-07-01',
      subscription_status: 'active',
      tax_rate: 10,
    },
    expectedMethod: 'POST',
    expectedURL: 'http://localhost:5000/api/v2/subscriptions',
    expectedBody: {
      properties: {
        status: 'active',
        contract_id: 'contract-1',
        contract_ids: ['contract-2'],
        company_id: 'company-1',
        number_item: 2,
        start_date: '2026-07-01',
        tax_rate: 10,
        line_items: [
          {
            custom_item_name: 'Consulting',
            quantity: 2,
            unit_price: 500,
            tax_rate: 10,
          },
        ],
      },
    },
  },
  {
    name: 'subscription update contract association clearing',
    objectType: 'subscription',
    tool: crmUpdateSubscriptionTool,
    args: {
      subscription_id: 'subscription-1',
      lookup_external_id: 'SUB-LOOKUP',
      contract_ids: [],
    },
    expectedMethod: 'PATCH',
    expectedURL: 'http://localhost:5000/api/v2/subscriptions/subscription-1?external_id=SUB-LOOKUP',
    expectedBody: { properties: { contract_ids: [] } },
  },
  {
    name: 'bill create document fields',
    objectType: 'bill',
    tool: crmCreateBillTool,
    args: {
      amount: 1100,
      amount_without_tax: 1000,
      attachment_file_ids: ['file-1'],
      company_external_id: 'COMPANY-EXT',
      external_id: 'BILL-EXT',
      line_items: lineItems,
      tax_inclusive: false,
      tax_option: 'unified_tax',
      tax_rate: 10,
    },
    expectedMethod: 'POST',
    expectedURL: 'http://localhost:5000/api/v2/bills',
    expectedBody: {
      properties: {
        amount: 1100,
        amount_without_tax: 1000,
        attachment_file: { files: [{ file_id: 'file-1' }] },
        company_external_id: 'COMPANY-EXT',
        external_id: 'BILL-EXT',
        tax_inclusive: false,
        tax_option: 'unified_tax',
        tax_rate: 10,
      },
      line_items: lineItems,
    },
  },
  {
    name: 'bill update document fields',
    objectType: 'bill',
    tool: crmUpdateBillTool,
    args: {
      bill_id: 'bill-1',
      external_id: 'BILL-LOOKUP',
      attachment_file_ids: ['file-2'],
      line_items: lineItems,
      tax_inclusive: true,
      tax_option: 'item_based_tax',
    },
    expectedMethod: 'PATCH',
    expectedURL: 'http://localhost:5000/api/v2/bills/bill-1?external_id=BILL-LOOKUP',
    expectedBody: {
      properties: {
        attachment_file: { files: [{ file_id: 'file-2' }] },
        tax_inclusive: true,
        tax_option: 'item_based_tax',
      },
      line_items: lineItems,
    },
  },
  {
    name: 'slip create tax and line items',
    objectType: 'revenue',
    tool: crmCreateSlipTool,
    args: {
      company_external_id: 'COMPANY-EXT',
      external_id: 'SLIP-EXT',
      line_items: lineItems,
      slip_type: 'receipt',
      tax_inclusive: false,
      tax_option: 'unified_tax',
      tax_rate: 10,
    },
    expectedMethod: 'POST',
    expectedURL: 'http://localhost:5000/api/v2/revenues',
    expectedBody: {
      properties: {
        company_external_id: 'COMPANY-EXT',
        external_id: 'SLIP-EXT',
        revenue_mode: 'receipt',
        tax_inclusive: false,
        tax_option: 'unified_tax',
        tax_rate: 10,
      },
      line_items: lineItems,
    },
  },
  {
    name: 'slip update tax and line items',
    objectType: 'revenue',
    tool: crmUpdateSlipTool,
    args: {
      slip_id: 'revenue-1',
      external_id: 'SLIP-LOOKUP',
      line_items: lineItems,
      tax_inclusive: true,
      tax_option: 'item_based_tax',
      tax_rate: 8,
    },
    expectedMethod: 'PATCH',
    expectedURL: 'http://localhost:5000/api/v2/revenues/revenue-1?external_id=SLIP-LOOKUP',
    expectedBody: {
      properties: {
        tax_inclusive: true,
        tax_option: 'item_based_tax',
        tax_rate: 8,
      },
      line_items: lineItems,
    },
  },
  {
    name: 'disbursement create tax and line items',
    objectType: 'disbursement',
    tool: crmCreateDisbursementTool,
    args: {
      company_external_id: 'COMPANY-EXT',
      external_id: 'DSB-EXT',
      line_items: lineItems,
      tax_inclusive: false,
      tax_option: 'unified_tax',
      tax_rate: 10,
    },
    expectedMethod: 'POST',
    expectedURL: 'http://localhost:5000/api/v2/disbursements',
    expectedBody: {
      properties: {
        company_external_id: 'COMPANY-EXT',
        external_id: 'DSB-EXT',
        tax_inclusive: false,
        tax_option: 'unified_tax',
        tax_rate: 10,
      },
      line_items: lineItems,
    },
  },
  {
    name: 'disbursement update tax and line items',
    objectType: 'disbursement',
    tool: crmUpdateDisbursementTool,
    args: {
      disbursement_id: 'disbursement-1',
      external_id: 'DSB-LOOKUP',
      line_items: lineItems,
      tax_inclusive: true,
      tax_option: 'item_based_tax',
    },
    expectedMethod: 'PATCH',
    expectedURL: 'http://localhost:5000/api/v2/disbursements/disbursement-1?external_id=DSB-LOOKUP',
    expectedBody: {
      properties: {
        tax_inclusive: true,
        tax_option: 'item_based_tax',
      },
      line_items: lineItems,
    },
  },
  {
    name: 'payment create extended fields',
    objectType: 'payment',
    tool: crmCreatePaymentTool,
    args: {
      company_external_id: 'COMPANY-EXT',
      external_id: 'PAY-EXT',
      line_items: lineItems,
      manual_price: 1000,
      tax_inclusive: false,
      tax_option: 'unified_tax',
      tax_rate: 10,
    },
    expectedMethod: 'POST',
    expectedURL: 'http://localhost:5000/api/v2/payments',
    expectedBody: {
      properties: {
        company_external_id: 'COMPANY-EXT',
        external_id: 'PAY-EXT',
        manual_price: 1000,
        tax_inclusive: false,
        tax_option: 'unified_tax',
        tax_rate: 10,
      },
      line_items: lineItems,
    },
  },
  {
    name: 'payment update extended fields',
    objectType: 'payment',
    tool: crmUpdatePaymentTool,
    args: {
      payment_id: 'payment-1',
      lookup_external_id: 'PAY-LOOKUP',
      external_id: 'PAY-NEW',
      line_items: lineItems,
      manual_price: 900,
      tax_inclusive: true,
      tax_option: 'item_based_tax',
      tax_rate: 8,
    },
    expectedMethod: 'PATCH',
    expectedURL: 'http://localhost:5000/api/v2/payments/payment-1?external_id=PAY-LOOKUP',
    expectedBody: {
      properties: {
        external_id: 'PAY-NEW',
        manual_price: 900,
        tax_inclusive: true,
        tax_option: 'item_based_tax',
        tax_rate: 8,
      },
      line_items: lineItems,
    },
  },
  {
    name: 'purchase order create attachment and line items',
    objectType: 'purchase_order',
    tool: crmCreatePurchaseOrderTool,
    args: {
      attachment_file_ids: ['file-1'],
      company_external_id: 'COMPANY-EXT',
      external_id: 'PO-EXT',
      line_items: lineItems,
      tax_option: 'unified_tax',
      tax_rate: 10,
    },
    expectedMethod: 'POST',
    expectedURL: 'http://localhost:5000/api/v2/purchase-orders',
    expectedBody: {
      properties: {
        attachment_file: { files: [{ file_id: 'file-1' }] },
        company_external_id: 'COMPANY-EXT',
        external_id: 'PO-EXT',
        tax_option: 'unified_tax',
        tax_rate: 10,
      },
      line_items: lineItems,
    },
  },
  {
    name: 'purchase order update attachment and line items',
    objectType: 'purchase_order',
    tool: crmUpdatePurchaseOrderTool,
    args: {
      purchase_order_id: 'purchase_order-1',
      attachment_file_ids: ['file-2'],
      external_id: 'PO-LOOKUP',
      line_items: lineItems,
    },
    expectedMethod: 'PATCH',
    expectedURL: 'http://localhost:5000/api/v2/purchase-orders/purchase_order-1?external_id=PO-LOOKUP',
    expectedBody: {
      properties: {
        attachment_file: { files: [{ file_id: 'file-2' }] },
      },
      line_items: lineItems,
    },
  },
];

describe('MCP mutation passthrough to the final V2 HTTP body', () => {
  it.each(mutationCases)('$name', async (scenario) => {
    const calls: Array<{ method: string; url: string; body: unknown }> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push({
          method: String(init?.method ?? 'GET').toUpperCase(),
          url: String(url),
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });
        return envelope(scenario.objectType);
      },
    });

    await scenario.tool.handler({
      reqContext: {
        client,
        auth: oauthContext,
        toolProfile: 'full',
      },
      args: scenario.args,
    });

    expect(calls).toEqual([
      {
        method: scenario.expectedMethod,
        url: scenario.expectedURL,
        body: scenario.expectedBody,
      },
    ]);
  });
});
