import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public ticket status resource on V2', () => {
  test('uses V2 ticket read list and delete routes', async () => {
    const calls: string[] = [];
    const ticketRecord = {
      id: 'ticket-1',
      record_id: '333',
      object_type: 'ticket',
      properties: {
        title: 'Payment issue',
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
            id: 'ticket-1',
            record_id: '333',
            status: 'archived',
          });
        }
        if (requestURL.endsWith('/api/v2/tickets')) {
          return envelope({ items: [ticketRecord], page: 1, page_size: 50, total: 1 });
        }
        return envelope(ticketRecord);
      },
    });

    await expect(
      client.public.tickets.retrieve('ticket-1', { external_id: 'TICK-333' }),
    ).resolves.toMatchObject({
      id: 'ticket-1',
      ticket_id: 333,
      title: 'Payment issue',
    });
    await expect(client.public.tickets.list({ workspace_id: 'legacy-workspace' })).resolves.toEqual([
      expect.objectContaining({ id: 'ticket-1', ticket_id: 333, title: 'Payment issue' }),
    ]);
    await expect(client.public.tickets.delete('ticket-1', { external_id: 'TICK-333' })).resolves.toEqual({
      ok: true,
      status: 'archived',
      ticket_id: 'ticket-1',
      external_id: 'TICK-333',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/tickets/ticket-1?external_id=TICK-333',
      'GET http://localhost:5000/api/v2/tickets',
      'DELETE http://localhost:5000/api/v2/tickets/ticket-1?external_id=TICK-333',
    ]);
  });

  test('uses the V2 ticket status route and preserves the legacy mutation shape', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(
          new Headers(init?.headers as ConstructorParameters<typeof Headers>[0]).get('Accept-Language'),
        ).toBe('ja');
        return envelope({
          id: 'ticket-1',
          record_id: '333',
          object_type: 'ticket',
          properties: {
            status: 'archived',
            stage_key: 'resolved',
          },
        });
      },
    });

    await expect(
      client.public.tickets.updateStatus('ticket-1', {
        external_id: 'TICK-333',
        stage_key: 'resolved',
        status: 'archived',
        'Accept-Language': 'ja',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'archived',
      ticket_id: 'ticket-1',
      external_id: 'TICK-333',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'PATCH http://localhost:5000/api/v2/tickets/ticket-1/status?external_id=TICK-333&stage_key=resolved&status=archived',
    ]);
  });

  test('uses V2 create route for local ticket external-id upserts', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            external_id: 'TICK-333',
            priority: 'p1',
            title: 'Payment issue',
          },
        });
        return envelope({
          id: 'ticket-1',
          record_id: '333',
          object_type: 'ticket',
          properties: { priority: 'p1', title: 'Payment issue' },
        });
      },
    });

    await expect(
      client.public.tickets.create({
        body_external_id: 'TICK-333',
        priority: 'p1',
        title: 'Payment issue',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'created',
      ticket_id: 'ticket-1',
      external_id: 'TICK-333',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['POST http://localhost:5000/api/v2/tickets']);
  });

  test('uses V2 PATCH for scalar ticket updates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            description: 'Updated detail',
            priority: 'high',
            stage_key: 'triage',
            title: 'Payment issue',
          },
        });
        return envelope({
          id: 'ticket-1',
          record_id: '333',
          object_type: 'ticket',
          properties: {
            priority: 'high',
            stage_key: 'triage',
            title: 'Payment issue',
          },
        });
      },
    });

    await expect(
      client.public.tickets.update('ticket-1', {
        description: 'Updated detail',
        priority: 'high',
        stage_key: 'triage',
        title: 'Payment issue',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      ticket_id: 'ticket-1',
      external_id: null,
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['PATCH http://localhost:5000/api/v2/tickets/ticket-1']);
  });
});
