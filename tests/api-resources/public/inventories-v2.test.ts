import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public inventory resource on V2', () => {
  test('passes list search, pagination, and workspace query params to V2', async () => {
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
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${requestURL}`);
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

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/inventories?limit=5&page=2&search=Sensor&sort=name&view_id=view-1&workspace_id=ws-1',
    ]);
  });
});
