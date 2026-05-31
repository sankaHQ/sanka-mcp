import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public item resource on V2', () => {
  test('uses V2 read list and delete routes', async () => {
    const calls: string[] = [];
    const record = {
      id: 'item-1',
      record_id: '1001',
      object_type: 'item',
      properties: {
        name: 'Starter kit',
        price: 1200,
        status: 'active',
        created_at: '2026-05-11',
        updated_at: '2026-05-12',
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
          await expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
            properties: {
              currency: 'JPY',
              external_id: 'ITEM-EXT',
              name: 'Starter kit',
              price: 1200,
              purchase_price: 700,
              status: 'active',
            },
          });
          return envelope(record);
        }
        if (method === 'PATCH') {
          await expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
            properties: {
              name: 'Updated starter kit',
              price: 1400,
              purchase_price: 900,
              status: 'active',
            },
          });
          return envelope(record);
        }
        if (method === 'DELETE') {
          return envelope({ id: 'item-1', record_id: '1001', usage_status: 'archived' });
        }
        if (requestURL.endsWith('/api/v2/items')) {
          return envelope({ items: [record], page: 1, page_size: 50, total: 1 });
        }
        return envelope(record);
      },
    });

    await expect(client.public.items.retrieve('item-1', { external_id: 'ITEM-EXT' })).resolves.toMatchObject({
      id: 'item-1',
      item_id: 1001,
      name: 'Starter kit',
    });
    await expect(client.public.items.list()).resolves.toEqual([
      expect.objectContaining({ id: 'item-1', item_id: 1001 }),
    ]);
    await expect(
      client.public.items.create({
        externalId: 'ITEM-EXT',
        currency: 'JPY',
        name: 'Starter kit',
        price: 1200,
        purchasePrice: 700,
        status: 'active',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'created',
      item_id: 'item-1',
      external_id: 'ITEM-EXT',
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.items.update('item-1', {
        externalId: 'ITEM-EXT',
        name: 'Updated starter kit',
        price: 1400,
        purchasePrice: 900,
        status: 'active',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      item_id: 'item-1',
      external_id: 'ITEM-EXT',
      ctx_id: 'ctx-test',
    });
    await expect(client.public.items.delete('item-1', { external_id: 'ITEM-EXT' })).resolves.toEqual({
      ok: true,
      status: 'deleted',
      item_id: 'item-1',
      external_id: 'ITEM-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/items/item-1?external_id=ITEM-EXT',
      'GET http://localhost:5000/api/v2/items',
      'POST http://localhost:5000/api/v2/items',
      'PATCH http://localhost:5000/api/v2/items/item-1?external_id=ITEM-EXT',
      'DELETE http://localhost:5000/api/v2/items/item-1?external_id=ITEM-EXT',
    ]);
  });
});
