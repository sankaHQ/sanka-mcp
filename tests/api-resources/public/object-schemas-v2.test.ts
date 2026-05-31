import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public object schema resource on V2', () => {
  test('uses V2 object schema paths', async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const method = init?.method ?? 'GET';
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        const requestURL = String(url);
        calls.push({ url: requestURL, method, body });

        if (method === 'GET') {
          return envelope([{ id: 'schema-1', name: 'Asset', slug: 'asset' }]);
        }
        return envelope({
          ok: true,
          status: 'created',
          operation: 'create',
          target: 'sanka',
          object_schema_id: 'schema-1',
          name: 'Asset',
          slug: 'asset',
        });
      },
    });

    await expect(client.public.objectSchemas.list({ search: 'asset', limit: 5 })).resolves.toEqual([
      expect.objectContaining({ id: 'schema-1', name: 'Asset', slug: 'asset', scope: 'sanka' }),
    ]);
    await expect(
      client.public.objectSchemas.mutate({ operation: 'create', name: 'Asset', slug: 'asset' }),
    ).resolves.toMatchObject({
      ok: true,
      object_schema_id: 'schema-1',
      status: 'created',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      {
        url: 'http://localhost:5000/api/v2/object-schemas?search=asset&limit=5',
        method: 'GET',
      },
      {
        url: 'http://localhost:5000/api/v2/object-schemas',
        method: 'POST',
        body: { operation: 'create', name: 'Asset', slug: 'asset' },
      },
    ]);
  });
});
