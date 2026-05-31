import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public deal resource on V2', () => {
  test('uses V2 deal read list and delete routes', async () => {
    const calls: string[] = [];
    const dealRecord = {
      id: 'deal-1',
      record_id: '901',
      object_type: 'deal',
      properties: {
        name: 'Expansion',
        stage: 'opportunities',
        stage_label: 'Opportunities',
        status: 'active',
        created_at: '2026-05-11T00:00:00Z',
        updated_at: '2026-05-12T00:00:00Z',
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
          return envelope({
            id: 'deal-1',
            record_id: '901',
            status: 'archived',
          });
        }
        if (requestURL.endsWith('/api/v2/deals?limit=10')) {
          return envelope({ items: [dealRecord], page: 1, page_size: 10, total: 1 });
        }
        return envelope(dealRecord);
      },
    });

    await expect(client.public.deals.retrieve('deal-1', { external_id: 'DEAL-901' })).resolves.toMatchObject({
      id: 'deal-1',
      deal_id: 901,
      case_status: 'Opportunities',
      stage_key: 'opportunities',
      name: 'Expansion',
    });
    await expect(client.public.deals.list({ workspace_id: 'legacy-workspace', limit: 10 })).resolves.toEqual([
      expect.objectContaining({
        id: 'deal-1',
        deal_id: 901,
        case_status: 'Opportunities',
        stage_key: 'opportunities',
        name: 'Expansion',
      }),
    ]);
    await expect(client.public.deals.delete('deal-1', { external_id: 'DEAL-901' })).resolves.toEqual({
      ok: true,
      status: 'deleted',
      case_id: 'deal-1',
      external_id: 'DEAL-901',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/deals/deal-1?external_id=DEAL-901',
      'GET http://localhost:5000/api/v2/deals?limit=10',
      'DELETE http://localhost:5000/api/v2/deals/deal-1?external_id=DEAL-901',
    ]);
  });

  test('keeps legacy delete path for integration mutation controls', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        return new Response(
          JSON.stringify({
            ok: true,
            status: 'dry_run',
            target: 'integration',
            dry_run: true,
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      },
    });

    await expect(
      client.public.deals.delete('21596739435', {
        target: 'integration',
        provider: 'hubspot',
        dry_run: true,
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: 'dry_run',
      target: 'integration',
      dry_run: true,
    });

    expect(calls).toEqual([
      'DELETE http://localhost:5000/v1/public/deals/21596739435?dry_run=true&provider=hubspot&target=integration',
    ]);
  });

  test('uses V2 create route for local deal external-id upserts', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            externalId: 'DEAL-901',
            name: 'Expansion',
            status: 'active',
          },
        });
        return envelope({
          id: 'deal-1',
          record_id: '901',
          object_type: 'deal',
          properties: { name: 'Expansion', status: 'active' },
        });
      },
    });

    await expect(
      client.public.deals.create({
        externalId: 'DEAL-901',
        name: 'Expansion',
        status: 'active',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'created',
      case_id: 'deal-1',
      external_id: 'DEAL-901',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['POST http://localhost:5000/api/v2/deals']);
  });

  test('uses V2 PATCH for scalar deal updates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            currency: 'JPY',
            name: 'Expansion',
            status: 'active',
          },
        });
        return envelope({
          id: 'deal-1',
          record_id: '901',
          object_type: 'deal',
          properties: { name: 'Expansion', status: 'active' },
        });
      },
    });

    await expect(
      client.public.deals.update('deal-1', {
        currency: 'JPY',
        name: 'Expansion',
        status: 'active',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      case_id: 'deal-1',
      external_id: null,
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['PATCH http://localhost:5000/api/v2/deals/deal-1']);
  });
});
