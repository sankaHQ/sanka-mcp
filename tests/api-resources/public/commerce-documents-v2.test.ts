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
        if (requestURL.endsWith('/api/v2/orders?q=Acme&page_size=5')) {
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
      'GET http://localhost:5000/api/v2/orders?q=Acme&page_size=5',
      'DELETE http://localhost:5000/api/v2/orders/order-1?external_id=ORDER-EXT',
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
});
