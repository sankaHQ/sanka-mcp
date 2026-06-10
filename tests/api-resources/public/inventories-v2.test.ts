import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public inventory resource on V2', () => {
  test('uses V2 read list and mutation routes', async () => {
    const calls: string[] = [];
    const record = {
      id: 'inventory-1',
      record_id: '4001',
      object_type: 'inventory',
      properties: {
        name: 'Sensor kit stock',
        total_inventory: 5,
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
        if (method === 'POST') {
          expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
            properties: {
              external_id: 'INV-EXT',
              initial_value: 5,
              inventory_status: 'available',
              item_external_id: 'ITEM-EXT',
              item_id: 'item-1',
              name: 'Sensor kit stock',
              unit_price: 1200,
              warehouse_id: 'warehouse-1',
            },
          });
          return envelope(record);
        }
        if (method === 'PATCH') {
          expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
            properties: {
              external_id: 'INV-EXT',
              inventory_status: 'available',
              item_external_id: 'ITEM-EXT',
              item_id: 'item-1',
              name: 'Updated sensor kit stock',
            },
          });
          return envelope(record);
        }
        return envelope({ items: [record], page: 2, page_size: 5, total: 1 });
      },
    });

    await expect(
      client.public.inventories.list({
        limit: 5,
        page: 2,
        search: 'Sensor',
        sort: 'name',
        view_id: 'view-1',
        workspace_id: 'ws-1',
        'Accept-Language': 'ja',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'inventory-1',
        inventory_id: 4001,
        total_inventory: 5,
      }),
    ]);
    await expect(
      client.public.inventories.create({
        externalId: 'INV-EXT',
        initialValue: 5,
        inventoryStatus: 'available',
        itemExternalId: 'ITEM-EXT',
        itemId: 'item-1',
        name: 'Sensor kit stock',
        unitPrice: 1200,
        warehouseId: 'warehouse-1',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'created',
      inventory_id: 'inventory-1',
      external_id: 'INV-EXT',
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.inventories.update('inventory-1', {
        externalId: 'INV-EXT',
        inventoryStatus: 'available',
        itemExternalId: 'ITEM-EXT',
        itemId: 'item-1',
        name: 'Updated sensor kit stock',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      inventory_id: 'inventory-1',
      external_id: 'INV-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/inventories?limit=5&page=2&search=Sensor&sort=name&view_id=view-1&workspace_id=ws-1',
      'POST http://localhost:5000/api/v2/inventories',
      'PATCH http://localhost:5000/api/v2/inventories/inventory-1?external_id=INV-EXT',
    ]);
  });
});
