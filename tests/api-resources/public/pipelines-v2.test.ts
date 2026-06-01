import Sanka from 'sanka-sdk';

const dealPipelines = [
  {
    id: 'pipeline-1',
    name: 'Sales',
    internal_name: 'sales',
    is_default: true,
    order: 0,
    stages: [{ id: 'stage-1', name: 'Qualified', internal_value: 'qualified', score: 20, order: 1 }],
  },
];

const ticketPipelines = [
  {
    id: 'ticket-pipeline-1',
    name: 'Support',
    internal_name: 'support',
    is_default: true,
    order: 0,
    stages: [
      {
        id: 'ticket-stage-1',
        name: 'Open',
        internal_value: 'open',
        score: 0,
        is_terminal: false,
        order: 1,
      },
    ],
  },
];

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public pipeline resources on V2', () => {
  test('uses V2 deal and ticket pipeline paths', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${requestURL}`);
        return envelope(requestURL.includes('/tickets/') ? ticketPipelines : dealPipelines);
      },
    });

    await expect(client.public.deals.listPipelines({ workspace_id: 'legacy-workspace' })).resolves.toEqual(
      dealPipelines,
    );
    await expect(client.public.tickets.listPipelines({ workspace_id: 'legacy-workspace' })).resolves.toEqual(
      ticketPipelines,
    );

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/deals/pipelines',
      'GET http://localhost:5000/api/v2/tickets/pipelines',
    ]);
  });
});
