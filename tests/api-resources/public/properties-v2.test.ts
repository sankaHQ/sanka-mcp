import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public properties resource on V2', () => {
  test('uses V2 property schema paths and preserves the SDK response shape', async () => {
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

        if (method === 'GET' && requestURL.endsWith('/api/v2/properties/orders/priority')) {
          return envelope({ id: 'prop-1', internal_name: 'priority', name: 'Priority' });
        }
        if (method === 'GET') {
          return envelope({
            data: [{ id: 'prop-1', internal_name: 'priority', name: 'Priority' }],
            count: 1,
            total: 1,
            page: 1,
          });
        }
        return envelope({ property_id: 'prop-1', page_group_type: 'commerce_orders' });
      },
    });

    await expect(client.public.properties.list('orders', { search: 'priority', limit: 2 })).resolves.toEqual([
      expect.objectContaining({
        id: 'prop-1',
        internal_name: 'priority',
        name: 'Priority',
        object: 'orders',
      }),
    ]);
    await expect(
      client.public.properties.retrieve('priority', { object_name: 'orders' }),
    ).resolves.toMatchObject({
      id: 'prop-1',
      internal_name: 'priority',
      object: 'orders',
    });
    await expect(
      client.public.properties.create('orders', {
        name: 'Priority',
        type: 'choice',
        choice_values: { high: 'High' },
      }),
    ).resolves.toMatchObject({
      ok: true,
      property_id: 'prop-1',
      status: 'created',
      object: 'commerce_orders',
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.properties.update('priority', { object_name: 'orders', name: 'Priority 2' }),
    ).resolves.toMatchObject({ status: 'updated', property_id: 'prop-1' });
    await expect(
      client.public.properties.delete('priority', { object_name: 'orders' }),
    ).resolves.toMatchObject({ status: 'deleted', property_id: 'prop-1' });

    expect(calls).toEqual([
      {
        url: 'http://localhost:5000/api/v2/properties/orders?search=priority&limit=2',
        method: 'GET',
      },
      { url: 'http://localhost:5000/api/v2/properties/orders/priority', method: 'GET' },
      {
        url: 'http://localhost:5000/api/v2/properties/orders',
        method: 'POST',
        body: {
          name: 'Priority',
          type: 'choice',
          choice_values: ['high'],
          choice_labels: ['High'],
        },
      },
      {
        url: 'http://localhost:5000/api/v2/properties/orders/priority',
        method: 'PUT',
        body: { name: 'Priority 2' },
      },
      { url: 'http://localhost:5000/api/v2/properties/orders/priority', method: 'DELETE' },
    ]);
  });

  test('preserves integration routing metadata when V2 mutation response omits it', async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const method = init?.method ?? 'GET';
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url: String(url), method, body });
        return envelope({
          ok: true,
          status: 'created',
          object: 'contacts',
          property_id: 'test',
        });
      },
    });

    await expect(
      client.public.properties.create('contacts', {
        target: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_object_type: 'contacts',
        external_id: 'test',
        name: 'Test',
        type: 'text',
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: 'created',
      object: 'contacts',
      property_id: 'test',
      target: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      external_object_type: 'contacts',
      external_id: 'test',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      {
        url: 'http://localhost:5000/api/v2/properties/contacts',
        method: 'POST',
        body: {
          target: 'integration',
          provider: 'hubspot',
          channel_id: 'channel-1',
          external_object_type: 'contacts',
          external_id: 'test',
          name: 'Test',
          type: 'text',
        },
      },
    ]);
  });
});
