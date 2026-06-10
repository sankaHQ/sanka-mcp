import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public inventory transaction resource on V2', () => {
  test('uses V2 read, list, update, and delete routes', async () => {
    const calls: string[] = [];
    const record = {
      id: 'transaction-1',
      record_id: '9001',
      object_type: 'inventory_transaction',
      properties: {
        inventory_id: 'inventory-1',
        formatted_inventory_id: 8001,
        transaction_type: 'in',
        amount: 2,
        usage_status: 'active',
        created_at: '2026-05-11',
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
        if (method === 'PATCH') {
          expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
            properties: {
              inventory_external_id: 'INV-EXT',
              inventory_id: 'inventory-1',
              transaction_amount: 5,
              transaction_type: 'in',
              use_unit_value: true,
            },
          });
          return envelope(record);
        }
        if (method === 'DELETE') {
          return envelope({ id: 'transaction-1', record_id: '9001', usage_status: 'archived' });
        }
        if (requestURL.includes('/api/v2/inventory-transactions?')) {
          return envelope({ items: [record], page: 1, page_size: 50, total: 1 });
        }
        return envelope(record);
      },
    });

    await expect(client.public.inventoryTransactions.retrieve('transaction-1')).resolves.toMatchObject({
      id: 'transaction-1',
      transaction_id: 9001,
      inventory_id: 8001,
      inventory_uuid: 'inventory-1',
    });
    await expect(
      client.public.inventoryTransactions.list({
        limit: 5,
        page: 2,
        search: 'Sensor',
        sort: '-created_at',
        view_id: 'view-1',
        workspace_id: 'ws-1',
        'Accept-Language': 'ja',
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'transaction-1', transaction_id: 9001, inventory_id: 8001 }),
    ]);
    await expect(
      client.public.inventoryTransactions.update('transaction-1', {
        inventoryExternalId: 'INV-EXT',
        inventoryId: 'inventory-1',
        transactionAmount: 5,
        transactionType: 'in',
        useUnitValue: true,
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      transaction_id: 'transaction-1',
      external_id: null,
      ctx_id: 'ctx-test',
    });
    await expect(client.public.inventoryTransactions.delete('transaction-1')).resolves.toEqual({
      ok: true,
      status: 'deleted',
      transaction_id: 'transaction-1',
      external_id: null,
      ctx_id: 'ctx-test',
    });
    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/inventory-transactions/transaction-1',
      'GET http://localhost:5000/api/v2/inventory-transactions?limit=5&page=2&search=Sensor&sort=-created_at&view_id=view-1&workspace_id=ws-1',
      'PATCH http://localhost:5000/api/v2/inventory-transactions/transaction-1',
      'DELETE http://localhost:5000/api/v2/inventory-transactions/transaction-1',
    ]);
  });
});
