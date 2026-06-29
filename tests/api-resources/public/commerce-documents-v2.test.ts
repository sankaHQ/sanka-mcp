import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public commerce document resources on V2', () => {
  test('uses V2 read list and delete routes for document resources', async () => {
    const calls: string[] = [];
    const records = {
      order: {
        id: 'order-1',
        record_id: '7001',
        object_type: 'order',
        properties: { status: 'active', delivery_status: 'order_delivered', created_at: '2026-05-11' },
      },
      estimate: {
        id: 'estimate-1',
        record_id: '7002',
        object_type: 'estimate',
        properties: { status: 'sent', estimate_date: '2026-05-20', created_at: '2026-05-11' },
      },
      invoice: {
        id: 'invoice-1',
        record_id: '7003',
        object_type: 'invoice',
        properties: { status: 'sent', invoice_date: '2026-05-21', created_at: '2026-05-11' },
      },
      purchaseOrder: {
        id: 'purchase-order-1',
        record_id: '7004',
        object_type: 'purchase_order',
        properties: { status: 'draft', date: '2026-05-22', created_at: '2026-05-11' },
      },
      bill: {
        id: 'bill-1',
        record_id: '7005',
        object_type: 'bill',
        properties: { status: 'unpaid', amount: 1200, created_at: '2026-05-11' },
      },
      expense: {
        id: 'expense-1',
        record_id: '7006',
        object_type: 'expense',
        properties: { status: 'submitted', amount: 300, created_at: '2026-05-11' },
      },
    };
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        const method = String(init?.method ?? 'GET').toUpperCase();
        calls.push(`${method} ${requestURL}`);
        if (method === 'DELETE') {
          const id = requestURL.split('/').pop()?.split('?')[0] ?? 'record-1';
          return envelope({ id, record_id: '7000', status: 'archived' });
        }
        if (method === 'POST' && requestURL.endsWith('/api/v2/orders/bulk')) {
          return envelope({
            ok: true,
            results: [{ external_id: 'ORDER-BULK-1', status: 'created', order_id: 'order-bulk-1' }],
            warnings: [],
          });
        }
        if (method === 'POST' && requestURL.endsWith('/api/v2/orders')) {
          return envelope(records.order);
        }
        if (method === 'PATCH' && requestURL.includes('/api/v2/orders/order-1')) {
          return envelope(records.order);
        }
        if (method === 'POST' && requestURL.includes('/api/v2/orders/order-1/activate')) {
          return envelope({ id: 'order-1', record_id: '7001', status: 'active' });
        }
        if (requestURL.endsWith('/api/v2/orders?q=Acme&limit=5')) {
          return envelope({ items: [records.order], page: 1, page_size: 5, total: 1 });
        }
        if (requestURL.endsWith('/api/v2/estimates')) {
          return envelope({ items: [records.estimate], page: 1, page_size: 50, total: 1 });
        }
        if (requestURL.endsWith('/api/v2/invoices')) {
          return envelope({ items: [records.invoice], page: 1, page_size: 50, total: 1 });
        }
        if (requestURL.endsWith('/api/v2/purchase-orders')) {
          return envelope({ items: [records.purchaseOrder], page: 1, page_size: 50, total: 1 });
        }
        if (requestURL.endsWith('/api/v2/bills')) {
          return envelope({ items: [records.bill], page: 1, page_size: 50, total: 1 });
        }
        if (requestURL.endsWith('/api/v2/expenses')) {
          return envelope({ items: [records.expense], page: 1, page_size: 50, total: 1 });
        }
        if (requestURL.includes('/api/v2/orders/')) return envelope(records.order);
        if (requestURL.includes('/api/v2/estimates/')) return envelope(records.estimate);
        if (requestURL.includes('/api/v2/invoices/')) return envelope(records.invoice);
        if (requestURL.includes('/api/v2/purchase-orders/')) return envelope(records.purchaseOrder);
        if (requestURL.includes('/api/v2/bills/')) return envelope(records.bill);
        return envelope(records.expense);
      },
    });

    await expect(
      client.public.orders.retrieve('order-1', { external_id: 'ORDER-EXT' }),
    ).resolves.toMatchObject({
      id: 'order-1',
      order_id: 7001,
      status: 'active',
    });
    await expect(client.public.orders.list({ search: 'Acme', limit: 5 })).resolves.toMatchObject({
      count: 1,
      data: [expect.objectContaining({ id: 'order-1', order_id: 7001 })],
      total: 1,
    });
    await expect(client.public.orders.delete('order-1', { external_id: 'ORDER-EXT' })).resolves.toEqual({
      ok: true,
      status: 'deleted',
      order_id: 'order-1',
      external_id: 'ORDER-EXT',
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.orders.create({
        order: {
          externalId: 'ORDER-EXT-2',
          companyId: 'company-1',
          line_items: [{ item_name: 'Implementation', quantity: 2, unit_price: 300, tax_rate: 10 }],
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      results: [{ external_id: 'ORDER-EXT-2', status: 'created', order_id: 'order-1' }],
    });
    await expect(
      client.public.orders.update('order-1', {
        order: {
          externalId: 'ORDER-EXT-2',
          deliveryStatus: 'order_delivered',
          items: [{ item_id: 'item-1', quantity: 1, price: 125 }],
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      results: [{ external_id: 'ORDER-EXT-2', status: 'updated', order_id: 'order-1' }],
    });
    await expect(client.public.orders.activate('order-1', { external_id: 'ORDER-EXT-2' })).resolves.toEqual({
      ok: true,
      status: 'active',
      order_id: 'order-1',
      external_id: 'ORDER-EXT-2',
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.orders.bulkCreate({
        orders: [
          {
            externalId: 'ORDER-BULK-1',
            companyId: 'company-1',
            items: [{ item_id: 'item-1', quantity: 2, price: 125 }],
          },
        ],
        createMissingItems: true,
        triggerWorkflows: false,
      }),
    ).resolves.toMatchObject({
      ok: true,
      results: [{ external_id: 'ORDER-BULK-1', status: 'created', order_id: 'order-bulk-1' }],
    });

    await expect(client.public.estimates.retrieve('estimate-1')).resolves.toMatchObject({
      id: 'estimate-1',
      id_est: 7002,
      start_date: '2026-05-20',
    });
    await expect(client.public.estimates.list()).resolves.toEqual([
      expect.objectContaining({ id: 'estimate-1', id_est: 7002 }),
    ]);
    await expect(client.public.estimates.delete('estimate-1')).resolves.toMatchObject({
      ok: true,
      estimate_id: 'estimate-1',
    });

    await expect(client.public.invoices.retrieve('invoice-1')).resolves.toMatchObject({
      id: 'invoice-1',
      id_inv: 7003,
      start_date: '2026-05-21',
    });
    await expect(client.public.invoices.list()).resolves.toEqual([
      expect.objectContaining({ id: 'invoice-1', id_inv: 7003 }),
    ]);
    await expect(client.public.invoices.delete('invoice-1')).resolves.toMatchObject({
      ok: true,
      invoice_id: 'invoice-1',
    });

    await expect(client.public.purchaseOrders.retrieve('purchase-order-1')).resolves.toMatchObject({
      id: 'purchase-order-1',
      id_po: 7004,
    });
    await expect(client.public.purchaseOrders.list()).resolves.toEqual([
      expect.objectContaining({ id: 'purchase-order-1', id_po: 7004 }),
    ]);
    await expect(client.public.purchaseOrders.delete('purchase-order-1')).resolves.toMatchObject({
      ok: true,
      purchase_order_id: 'purchase-order-1',
    });

    await expect(client.public.bills.retrieve('bill-1')).resolves.toMatchObject({
      id: 'bill-1',
      id_bill: 7005,
    });
    await expect(client.public.bills.list()).resolves.toEqual([
      expect.objectContaining({ id: 'bill-1', id_bill: 7005 }),
    ]);
    await expect(client.public.bills.delete('bill-1')).resolves.toMatchObject({
      ok: true,
      bill_id: 'bill-1',
    });

    await expect(client.public.expenses.retrieve('expense-1')).resolves.toMatchObject({
      id: 'expense-1',
      id_pm: 7006,
    });
    await expect(client.public.expenses.list()).resolves.toEqual([
      expect.objectContaining({ id: 'expense-1', id_pm: 7006 }),
    ]);
    await expect(client.public.expenses.delete('expense-1')).resolves.toMatchObject({
      ok: true,
      expense_id: 'expense-1',
    });

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/orders/order-1?external_id=ORDER-EXT',
      'GET http://localhost:5000/api/v2/orders?q=Acme&limit=5',
      'DELETE http://localhost:5000/api/v2/orders/order-1?external_id=ORDER-EXT',
      'POST http://localhost:5000/api/v2/orders',
      'PATCH http://localhost:5000/api/v2/orders/order-1?external_id=ORDER-EXT-2',
      'POST http://localhost:5000/api/v2/orders/order-1/activate?external_id=ORDER-EXT-2',
      'POST http://localhost:5000/api/v2/orders/bulk',
      'GET http://localhost:5000/api/v2/estimates/estimate-1',
      'GET http://localhost:5000/api/v2/estimates',
      'DELETE http://localhost:5000/api/v2/estimates/estimate-1',
      'GET http://localhost:5000/api/v2/invoices/invoice-1',
      'GET http://localhost:5000/api/v2/invoices',
      'DELETE http://localhost:5000/api/v2/invoices/invoice-1',
      'GET http://localhost:5000/api/v2/purchase-orders/purchase-order-1',
      'GET http://localhost:5000/api/v2/purchase-orders',
      'DELETE http://localhost:5000/api/v2/purchase-orders/purchase-order-1',
      'GET http://localhost:5000/api/v2/bills/bill-1',
      'GET http://localhost:5000/api/v2/bills',
      'DELETE http://localhost:5000/api/v2/bills/bill-1',
      'GET http://localhost:5000/api/v2/expenses/expense-1',
      'GET http://localhost:5000/api/v2/expenses',
      'DELETE http://localhost:5000/api/v2/expenses/expense-1',
    ]);
  });

  test('uses V2 create and update routes for commerce document mutations', async () => {
    const calls: string[] = [];
    const records = {
      estimate: { id: 'estimate-1', record_id: '7002', object_type: 'estimate', properties: {} },
      invoice: { id: 'invoice-1', record_id: '7003', object_type: 'invoice', properties: {} },
      purchaseOrder: {
        id: 'purchase-order-1',
        record_id: '7004',
        object_type: 'purchase_order',
        properties: {},
      },
      slip: { id: 'slip-1', record_id: '7005', object_type: 'slip', properties: {} },
      bill: { id: 'bill-1', record_id: '7006', object_type: 'bill', properties: {} },
      disbursement: {
        id: 'disbursement-1',
        record_id: '7007',
        object_type: 'disbursement',
        properties: {},
      },
      payment: { id: 'payment-1', record_id: '7008', object_type: 'payment', properties: {} },
      expense: { id: 'expense-1', record_id: '7009', object_type: 'expense', properties: {} },
      subscription: {
        id: 'subscription-1',
        record_id: '7010',
        object_type: 'subscription',
        properties: {},
      },
    };
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        const method = String(init?.method ?? 'GET').toUpperCase();
        calls.push(`${method} ${requestURL}`);
        if (requestURL.includes('/api/v2/estimates')) return envelope(records.estimate);
        if (requestURL.includes('/api/v2/invoices')) return envelope(records.invoice);
        if (requestURL.includes('/api/v2/purchase-orders')) return envelope(records.purchaseOrder);
        if (requestURL.includes('/api/v2/revenues')) return envelope(records.slip);
        if (requestURL.includes('/api/v2/bills')) return envelope(records.bill);
        if (requestURL.includes('/api/v2/disbursements')) return envelope(records.disbursement);
        if (requestURL.includes('/api/v2/payments')) return envelope(records.payment);
        if (requestURL.includes('/api/v2/subscriptions')) return envelope(records.subscription);
        return envelope(records.expense);
      },
    });

    await client.public.estimates.create({ company_id: 'company-1', start_date: '2026-06-01' });
    await client.public.estimates.update('estimate-1', {
      external_id: 'EST-1',
      company_id: 'company-1',
      status: 'draft',
    });
    await client.public.invoices.create({ company_id: 'company-1', start_date: '2026-06-01' });
    await client.public.invoices.update('invoice-1', {
      external_id: 'INV-1',
      company_id: 'company-1',
      status: 'draft',
    });
    await client.public.purchaseOrders.create({ company_id: 'supplier-1', date: '2026-06-01' });
    await client.public.purchaseOrders.update('purchase-order-1', {
      external_id: 'PO-1',
      company_id: 'supplier-1',
      status: 'draft',
    });
    await client.public.slips.create({
      company_id: 'company-1',
      start_date: '2026-06-01',
      slip_type: 'sales',
    });
    await client.public.slips.update('slip-1', {
      external_id: 'SLIP-1',
      company_id: 'company-1',
      status: 'draft',
    });
    await client.public.bills.create({ company_id: 'supplier-1', issued_date: '2026-06-01' });
    await client.public.bills.update('bill-1', {
      external_id: 'BILL-1',
      company_id: 'supplier-1',
      status: 'unpaid',
    });
    await client.public.disbursements.create({ company_id: 'supplier-1', start_date: '2026-06-01' });
    await client.public.disbursements.update('disbursement-1', {
      external_id: 'DSB-1',
      company_id: 'supplier-1',
      status: 'draft',
    });
    await client.public.payments.create({ companyId: 'company-1', startDate: '2026-06-01' });
    await client.public.payments.update('payment-1', {
      external_id: 'PAY-1',
      companyId: 'company-1',
      status: 'draft',
    });
    await client.public.expenses.create({ company_id: 'supplier-1', amount: 1200 });
    await client.public.expenses.update('expense-1', {
      external_id: 'EXP-1',
      company_id: 'supplier-1',
      amount: 1250,
    });
    await client.public.subscriptions.create({
      company_id: 'company-1',
      items: [{ item_id: 'item-1', quantity: 1, price: 500 }],
      subscription_status: 'draft',
    });
    await client.public.subscriptions.update('subscription-1', {
      external_id: 'SUB-1',
      status: 'active',
      items: [{ item_id: 'item-1', quantity: 2, price: 500 }],
    });

    expect(calls).toEqual([
      'POST http://localhost:5000/api/v2/estimates',
      'PATCH http://localhost:5000/api/v2/estimates/estimate-1?external_id=EST-1',
      'POST http://localhost:5000/api/v2/invoices',
      'PATCH http://localhost:5000/api/v2/invoices/invoice-1?external_id=INV-1',
      'POST http://localhost:5000/api/v2/purchase-orders',
      'PATCH http://localhost:5000/api/v2/purchase-orders/purchase-order-1?external_id=PO-1',
      'POST http://localhost:5000/api/v2/revenues',
      'PATCH http://localhost:5000/api/v2/revenues/slip-1?external_id=SLIP-1',
      'POST http://localhost:5000/api/v2/bills',
      'PATCH http://localhost:5000/api/v2/bills/bill-1?external_id=BILL-1',
      'POST http://localhost:5000/api/v2/disbursements',
      'PATCH http://localhost:5000/api/v2/disbursements/disbursement-1?external_id=DSB-1',
      'POST http://localhost:5000/api/v2/payments',
      'PATCH http://localhost:5000/api/v2/payments/payment-1?external_id=PAY-1',
      'POST http://localhost:5000/api/v2/expenses',
      'PATCH http://localhost:5000/api/v2/expenses/expense-1?external_id=EXP-1',
      'POST http://localhost:5000/api/v2/subscriptions',
      'PATCH http://localhost:5000/api/v2/subscriptions/subscription-1?external_id=SUB-1',
    ]);
  });

  test('preserves expense external references and uploaded attachments in V2 create properties', async () => {
    const calls: string[] = [];
    const bodies: Array<unknown> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        bodies.push(init?.body ? JSON.parse(String(init.body)) : undefined);
        return envelope({
          id: 'expense-1',
          record_id: '7009',
          object_type: 'expense',
          properties: {
            amount: 1200,
            currency: 'JPY',
            description: 'Google Workspace',
          },
        });
      },
    });

    await expect(
      client.public.expenses.create({
        amount: 1200,
        attachment_file: { files: [{ file_id: 'file-1' }] },
        company_external_id: 'google-asia-pacific',
        currency: 'JPY',
        description: 'Google Workspace',
        due_date: '2026-05-31',
        external_id: 'GOOGLE-2026-05-31',
        status: 'submitted',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'created',
      expense_id: 'expense-1',
      external_id: 'GOOGLE-2026-05-31',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['POST http://localhost:5000/api/v2/expenses']);
    expect(bodies).toEqual([
      {
        properties: {
          amount: 1200,
          attachment_file: { files: [{ file_id: 'file-1' }] },
          company_external_id: 'google-asia-pacific',
          currency: 'JPY',
          description: 'Google Workspace',
          due_date: '2026-05-31',
          external_id: 'GOOGLE-2026-05-31',
          status: 'submitted',
        },
      },
    ]);
  });

  test('preserves estimate line items and sender on V2 mutations', async () => {
    const bodies: unknown[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (_url, init) => {
        bodies.push(init?.body ? JSON.parse(String(init.body)) : undefined);
        return envelope({
          id: 'estimate-1',
          record_id: '7002',
          object_type: 'estimate',
          properties: {},
        });
      },
    });

    await client.public.estimates.create({
      company_id: 'company-1',
      send_from: 'Sanka Sales\n100 Market St',
      line_items: [{ item_name: 'Discovery', quantity: 2, unit_price: 50, tax_rate: 10 }],
    });
    await client.public.estimates.update('estimate-1', {
      status: 'draft',
      notes: 'Updated terms',
      send_from: 'Updated Sanka Sales\n100 Market St',
      line_items: [{ item_name: 'Implementation', quantity: 1, unit_price: 300, tax_rate: 10 }],
    });

    expect(bodies).toEqual([
      {
        properties: {
          company_id: 'company-1',
          send_from: 'Sanka Sales\n100 Market St',
        },
        line_items: [{ item_name: 'Discovery', quantity: 2, unit_price: 50, tax_rate: 10 }],
      },
      {
        properties: {
          notes: 'Updated terms',
          send_from: 'Updated Sanka Sales\n100 Market St',
          status: 'draft',
        },
        line_items: [{ item_name: 'Implementation', quantity: 1, unit_price: 300, tax_rate: 10 }],
      },
    ]);
  });
});
