import Sanka from 'sanka-sdk';

const overdueItems = [
  {
    invoice_id: 'invoice-1',
    id_inv: 1,
    company_name: 'Acme',
    outstanding_balance: 100,
    days_overdue: 7,
  },
];

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public overdue invoices resource on V2', () => {
  test('uses V2 overdue invoice path and returns legacy array shape', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        return envelope({
          items: overdueItems,
          page: 2,
          page_size: 10,
          total: 12,
        });
      },
    });

    await expect(
      client.public.invoices.listOverdue({
        as_of_date: '2026-05-31',
        workspace_id: 'legacy-workspace',
        language: 'en',
      }),
    ).resolves.toEqual(overdueItems);

    expect(calls).toEqual(['GET http://localhost:5000/api/v2/invoices/overdue?as_of_date=2026-05-31']);
  });
});
