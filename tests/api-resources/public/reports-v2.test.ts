import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public reports resource on V2', () => {
  test('uses V2 report paths and preserves legacy SDK response shapes', async () => {
    const calls: Array<{ body?: unknown; method: string; url: string }> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const method = String(init?.method ?? 'GET').toUpperCase();
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        const requestURL = String(url);
        calls.push({ method, url: requestURL, body });
        if (method === 'GET' && requestURL.endsWith('/api/v2/public/reports?page=2&limit=5')) {
          return envelope({
            items: [{ id: 'report-1', name: 'Invoice Aging', report_type: 'chart' }],
            total: 1,
            page: 2,
            page_size: 5,
            has_next_page: false,
          });
        }
        if (method === 'GET' && requestURL.endsWith('/api/v2/public/reports/report-1')) {
          return envelope({
            report: {
              id: 'report-1',
              name: 'Invoice Aging',
              panel_type: 'chart',
              object_sources: ['invoices'],
            },
          });
        }
        if (method === 'DELETE') {
          return envelope({ ids: ['report-1'], count: 1, message: 'archived' });
        }
        return envelope({ report_id: 'report-1', report_number: '0007', message: 'OK' });
      },
    });

    await expect(
      client.public.reports.create({
        reportMetadata: {
          name: 'Invoice Aging',
          reportType: { type: 'invoices' },
          description: 'Open invoices by customer',
          reportFormat: 'chart',
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: 'OK',
      ctx_id: 'ctx-test',
      report_id: 'report-1',
    });
    await expect(
      client.public.reports.list({ page: 2, limit: 5, workspace_id: 'legacy-workspace' }),
    ).resolves.toEqual([{ id: 'report-1', name: 'Invoice Aging', report_type: 'chart' }]);
    await expect(
      client.public.reports.retrieve('report-1', { workspace_id: 'legacy-workspace' }),
    ).resolves.toEqual({
      id: 'report-1',
      name: 'Invoice Aging',
      panel_type: 'chart',
      object_sources: ['invoices'],
    });
    await expect(
      client.public.reports.update('report-1', {
        workspace_id: 'legacy-workspace',
        reportMetadata: { name: 'Invoice Aging Updated' },
      }),
    ).resolves.toMatchObject({
      ok: true,
      report_id: 'report-1',
    });
    await expect(
      client.public.reports.delete('report-1', { workspace_id: 'legacy-workspace' }),
    ).resolves.toEqual({
      ok: true,
      status: 'archived',
      ctx_id: 'ctx-test',
      report_id: 'report-1',
    });

    expect(calls).toEqual([
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/reports',
        body: {
          name: 'Invoice Aging',
          description: 'Open invoices by customer',
          panel_type: 'chart',
          data_source_type: 'app',
          object_sources: ['invoices'],
        },
      },
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/reports?page=2&limit=5',
        body: undefined,
      },
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/reports/report-1',
        body: undefined,
      },
      {
        method: 'PUT',
        url: 'http://localhost:5000/api/v2/public/reports/report-1',
        body: {
          name: 'Invoice Aging Updated',
        },
      },
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/public/reports/report-1',
        body: undefined,
      },
    ]);
  });
});
