import { selectTools } from '../../packages/mcp-server/src/server';
import {
  cancelBuyRequestTool,
  confirmBuyOrderTool,
  createBuyBillTool,
  createBuyPurchaseOrderTool,
  createBuyRequestTool,
  getBuyMerchantPurchaseTool,
  listBuyRequestsTool,
  prepareBuyCheckoutTool,
  previewBuyRequestTool,
  selectBuyOfferTool,
  sourceBuyRequestTool,
  submitBuyRequestTool,
  updateBuyRequestTool,
} from '../../packages/mcp-server/src/sanka-buy-tools';

const oauthContext = (overrides?: { authMode?: 'none' | 'oauth_bearer'; scopes?: string[] }) => ({
  authMode: overrides?.authMode ?? 'oauth_bearer',
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: overrides?.scopes ?? ['mcp:access'],
  },
});

const requestEnvelope = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    id: 'buy-1',
    title: 'Laptop refresh',
    status: 'draft',
    lines: [{ id: 'line-1', description: 'Laptop', quantity: 1 }],
    active_selections: [],
    merchant_purchases: [],
    ...overrides,
  },
  meta: { ctx_id: 'ctx-buy-1' },
});

describe('Sanka Buy MCP tools', () => {
  it('registers Sanka Buy tools in the hosted profile', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    expect(toolNames).toEqual(
      expect.arrayContaining([
        'preview_buy_request',
        'create_buy_request',
        'list_buy_requests',
        'get_buy_request',
        'update_buy_request',
        'cancel_buy_request',
        'source_buy_request',
        'list_buy_sourcing_runs',
        'get_buy_sourcing_run',
        'select_buy_offer',
        'preview_buy_approval',
        'submit_buy_request',
        'create_buy_purchase_order',
        'get_buy_merchant_purchase',
        'prepare_buy_checkout',
        'confirm_buy_order',
        'create_buy_bill',
      ]),
    );
  });

  it('advertises the V2 Buy endpoints in tool metadata', () => {
    expect(previewBuyRequestTool.metadata.httpPath).toBe('/api/v2/buy/intents');
    expect(createBuyRequestTool.metadata.httpPath).toBe('/api/v2/buy/requests');
    expect(listBuyRequestsTool.metadata.httpPath).toBe('/api/v2/buy/requests');
    expect(sourceBuyRequestTool.metadata.httpPath).toBe('/api/v2/buy/requests/{request_id}/source');
    expect(selectBuyOfferTool.metadata.httpPath).toBe('/api/v2/buy/requests/{request_id}/select-offer');
    expect(submitBuyRequestTool.metadata.httpPath).toBe('/api/v2/buy/requests/{request_id}/submit');
    expect(createBuyPurchaseOrderTool.metadata.httpPath).toBe(
      '/api/v2/buy/requests/{request_id}/create-purchase-order',
    );
    expect(getBuyMerchantPurchaseTool.metadata.httpPath).toBe(
      '/api/v2/buy/merchant-purchases/{merchant_purchase_id}',
    );
    expect(prepareBuyCheckoutTool.metadata.httpPath).toBe(
      '/api/v2/buy/merchant-purchases/{merchant_purchase_id}/prepare-checkout',
    );
    expect(confirmBuyOrderTool.metadata.httpPath).toBe(
      '/api/v2/buy/merchant-purchases/{merchant_purchase_id}/confirm-order',
    );
    expect(createBuyBillTool.metadata.httpPath).toBe(
      '/api/v2/buy/merchant-purchases/{merchant_purchase_id}/create-bill',
    );
  });

  it('creates Buy requests through V2 and forwards the idempotency key', async () => {
    const post = jest.fn().mockResolvedValue(requestEnvelope());

    const result = await createBuyRequestTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        title: 'Laptop refresh',
        business_purpose: 'Engineering onboarding',
        currency: 'USD',
        budget_amount: 1500,
        idempotency_key: 'buy-create-1',
        lines: [{ description: 'Laptop', quantity: 1, target_unit_price: 1200 }],
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/buy/requests', {
      body: expect.objectContaining({
        title: 'Laptop refresh',
        source: 'mcp',
        business_purpose: 'Engineering onboarding',
        currency: 'USD',
        budget_amount: 1500,
        lines: [{ description: 'Laptop', quantity: 1, target_unit_price: 1200 }],
      }),
      headers: { 'Idempotency-Key': 'buy-create-1' },
    });
    expect(result.structuredContent).toMatchObject({
      id: 'buy-1',
      title: 'Laptop refresh',
      ctx_id: 'ctx-buy-1',
    });
  });

  it('lists Buy requests with query params and preserves V2 pagination metadata', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: {
        items: [{ id: 'buy-1', title: 'Laptop refresh', status: 'draft' }],
        page: 2,
        page_size: 10,
        total: 21,
      },
      meta: { ctx_id: 'ctx-list', pagination: { page: 2, page_size: 10, total: 21 } },
    });

    const result = await listBuyRequestsTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
      },
      args: {
        status: 'draft',
        page: 2,
        page_size: 10,
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/buy/requests', {
      query: { status: 'draft', page: 2, page_size: 10 },
    });
    expect(result.structuredContent).toMatchObject({
      page: 2,
      page_size: 10,
      total: 21,
      pagination: { page: 2, page_size: 10, total: 21 },
      ctx_id: 'ctx-list',
    });
  });

  it('keeps preview_buy_request read-only and strips idempotency headers', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        draft: {
          title: 'Laptop refresh',
          lines: [{ description: 'Laptop', quantity: 1 }],
        },
        source: { parser: 'deterministic' },
      },
      meta: { ctx_id: 'ctx-preview' },
    });

    const result = await previewBuyRequestTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        prompt: 'Buy a laptop',
        idempotency_key: 'preview-should-not-forward',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/buy/intents', {
      body: {
        prompt: 'Buy a laptop',
        create_request: false,
      },
    });
    expect(result.structuredContent).toMatchObject({
      ctx_id: 'ctx-preview',
      source: { parser: 'deterministic' },
    });
  });

  it('rejects conflicting preview prompt aliases before calling V2', async () => {
    const post = jest.fn();

    const result = await previewBuyRequestTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        prompt: 'Buy a laptop',
        text: 'Buy a monitor',
      },
    });

    expect(result.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it('selects one offer per request line and forwards the idempotency key', async () => {
    const post = jest.fn().mockResolvedValue(
      requestEnvelope({
        status: 'offer_selected',
        active_selections: [
          {
            buy_request_line_id: 'line-1',
            offer_snapshot_id: 'offer-1',
            selected_quantity: 1,
          },
        ],
      }),
    );

    const result = await selectBuyOfferTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        request_id: 'buy-1',
        sourcing_run_id: 'source-1',
        idempotency_key: 'select-1',
        line_selections: [
          {
            buy_request_line_id: 'line-1',
            selected_quantity: 1,
            offer: {
              merchant_key: 'example.myshopify.com',
              merchant_name: 'Example Store',
              title: 'Laptop',
              quantity: 1,
              unit_price: 1200,
              total_amount: 1200,
              currency: 'USD',
            },
          },
        ],
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/buy/requests/buy-1/select-offer', {
      body: {
        sourcing_run_id: 'source-1',
        line_selections: [
          {
            buy_request_line_id: 'line-1',
            selected_quantity: 1,
            offer: {
              merchant_key: 'example.myshopify.com',
              merchant_name: 'Example Store',
              title: 'Laptop',
              quantity: 1,
              unit_price: 1200,
              total_amount: 1200,
              currency: 'USD',
            },
          },
        ],
      },
      headers: { 'Idempotency-Key': 'select-1' },
    });
    expect(result.structuredContent?.['status']).toBe('offer_selected');
    expect(result.structuredContent?.['active_selections']).toEqual([
      {
        buy_request_line_id: 'line-1',
        offer_snapshot_id: 'offer-1',
        selected_quantity: 1,
      },
    ]);
  });

  it('requires explicit confirmation before cancelling a Buy request', async () => {
    const post = jest.fn();

    const result = await cancelBuyRequestTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        request_id: 'buy-1',
      },
    });

    expect(result.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it('updates Buy requests and forwards the idempotency key', async () => {
    const patch = jest.fn().mockResolvedValue(
      requestEnvelope({
        budget_amount: 1800,
      }),
    );

    const result = await updateBuyRequestTool.handler({
      reqContext: {
        client: { patch } as any,
        auth: oauthContext(),
      },
      args: {
        request_id: 'buy-1',
        budget_amount: 1800,
        idempotency_key: 'update-1',
      },
    });

    expect(patch).toHaveBeenCalledWith('/api/v2/buy/requests/buy-1', {
      body: {
        budget_amount: 1800,
      },
      headers: { 'Idempotency-Key': 'update-1' },
    });
    expect(result.structuredContent?.['budget_amount']).toBe(1800);
  });

  it('cancels confirmed Buy requests and forwards the idempotency key', async () => {
    const post = jest.fn().mockResolvedValue(
      requestEnvelope({
        status: 'cancelled',
      }),
    );

    const result = await cancelBuyRequestTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        request_id: 'buy-1',
        confirm: true,
        idempotency_key: 'cancel-1',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/buy/requests/buy-1/cancel', {
      body: {},
      headers: { 'Idempotency-Key': 'cancel-1' },
    });
    expect(result.structuredContent?.['status']).toBe('cancelled');
  });

  it('requires explicit confirmation before submitting a Buy request', async () => {
    const post = jest.fn();

    const result = await submitBuyRequestTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        request_id: 'buy-1',
      },
    });

    expect(result.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it('submits confirmed Buy requests and forwards the idempotency key', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        buy_request: {
          id: 'buy-1',
          title: 'Laptop refresh',
          status: 'approved',
        },
        approval_required: false,
        message: 'Sanka Buy request approved.',
      },
      meta: { ctx_id: 'ctx-submit' },
    });

    const result = await submitBuyRequestTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        request_id: 'buy-1',
        confirm: true,
        idempotency_key: 'submit-1',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/buy/requests/buy-1/submit', {
      body: {},
      headers: { 'Idempotency-Key': 'submit-1' },
    });
    expect(result.structuredContent).toMatchObject({
      buy_request: {
        id: 'buy-1',
        status: 'approved',
      },
      approval_required: false,
      ctx_id: 'ctx-submit',
    });
  });

  it('creates Buy purchase orders only after explicit confirmation', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        buy_request: { id: 'buy-1', status: 'purchase_order_created' },
        merchant_purchases: [{ id: 'merchant-1', purchase_order_id: 'po-1' }],
        purchase_order_ids: ['po-1'],
        company_ids: ['company-1'],
      },
      meta: { ctx_id: 'ctx-po' },
    });

    const rejected = await createBuyPurchaseOrderTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: { request_id: 'buy-1' },
    });
    const result = await createBuyPurchaseOrderTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        request_id: 'buy-1',
        confirm: true,
        idempotency_key: 'po-1',
      },
    });

    expect(rejected.isError).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/api/v2/buy/requests/buy-1/create-purchase-order', {
      body: {},
      headers: { 'Idempotency-Key': 'po-1' },
    });
    expect(result.structuredContent).toMatchObject({
      purchase_order_ids: ['po-1'],
      company_ids: ['company-1'],
      ctx_id: 'ctx-po',
    });
  });

  it('loads Buy merchant purchases by id', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'merchant-1',
        buy_request_id: 'buy-1',
        status: 'purchase_order_created',
        purchase_order_id: 'po-1',
      },
      meta: { ctx_id: 'ctx-merchant' },
    });

    const result = await getBuyMerchantPurchaseTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
      },
      args: { merchant_purchase_id: 'merchant-1' },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/buy/merchant-purchases/merchant-1');
    expect(result.structuredContent).toMatchObject({
      id: 'merchant-1',
      purchase_order_id: 'po-1',
      ctx_id: 'ctx-merchant',
    });
  });

  it('prepares Buy checkout with confirmation and idempotency key', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        buy_request: { id: 'buy-1', status: 'checkout_pending' },
        merchant_purchase: { id: 'merchant-1', status: 'checkout_pending' },
        checkout_url: 'https://example.myshopify.com/products/laptop',
      },
      meta: { ctx_id: 'ctx-checkout' },
    });

    const result = await prepareBuyCheckoutTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        merchant_purchase_id: 'merchant-1',
        confirm: true,
        idempotency_key: 'checkout-1',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/buy/merchant-purchases/merchant-1/prepare-checkout', {
      body: {},
      headers: { 'Idempotency-Key': 'checkout-1' },
    });
    expect(result.structuredContent?.['checkout_url']).toBe('https://example.myshopify.com/products/laptop');
  });

  it('confirms Buy external orders and forwards order details', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        buy_request: { id: 'buy-1', status: 'ordered' },
        merchant_purchase: { id: 'merchant-1', status: 'ordered' },
        external_order_id: 'shopify-order-1',
      },
      meta: { ctx_id: 'ctx-order' },
    });

    const result = await confirmBuyOrderTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        merchant_purchase_id: 'merchant-1',
        external_order_id: 'shopify-order-1',
        external_order_name: '#1001',
        order_url: 'https://example.myshopify.com/orders/1001',
        confirm: true,
        idempotency_key: 'order-1',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/buy/merchant-purchases/merchant-1/confirm-order', {
      body: {
        external_order_id: 'shopify-order-1',
        external_order_name: '#1001',
        order_url: 'https://example.myshopify.com/orders/1001',
      },
      headers: { 'Idempotency-Key': 'order-1' },
    });
    expect(result.structuredContent?.['external_order_id']).toBe('shopify-order-1');
  });

  it('rejects malformed Buy external order details before calling V2', async () => {
    const post = jest.fn();

    const badOrderID = await confirmBuyOrderTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        merchant_purchase_id: 'merchant-1',
        external_order_id: '<script>',
        confirm: true,
      },
    });
    const badOrderUrl = await confirmBuyOrderTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        merchant_purchase_id: 'merchant-1',
        external_order_id: 'shopify-order-1',
        order_url: 'javascript:alert(1)',
        confirm: true,
      },
    });

    expect(badOrderID.isError).toBe(true);
    expect(badOrderUrl.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it('creates Buy bills with confirmation and idempotency key', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        buy_request: { id: 'buy-1', status: 'bill_created' },
        merchant_purchase: { id: 'merchant-1', status: 'bill_created' },
        bill_id: 'bill-1',
        purchase_order_id: 'po-1',
      },
      meta: { ctx_id: 'ctx-bill' },
    });

    const result = await createBuyBillTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        merchant_purchase_id: 'merchant-1',
        confirm: true,
        idempotency_key: 'bill-1',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/buy/merchant-purchases/merchant-1/create-bill', {
      body: {},
      headers: { 'Idempotency-Key': 'bill-1' },
    });
    expect(result.structuredContent).toMatchObject({
      bill_id: 'bill-1',
      purchase_order_id: 'po-1',
      ctx_id: 'ctx-bill',
    });
  });

  it('keeps preview_buy_request read-only even if create_request is passed', async () => {
    const post = jest.fn();

    const result = await previewBuyRequestTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        prompt: 'Buy a laptop',
        create_request: true,
      },
    });

    expect(result.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it('returns an OAuth challenge before calling protected Buy tools without auth', async () => {
    const post = jest.fn();

    const result = await createBuyRequestTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'hosted',
      },
      args: {
        title: 'Laptop refresh',
        lines: [{ description: 'Laptop', quantity: 1 }],
      },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(post).not.toHaveBeenCalled();
  });
});
