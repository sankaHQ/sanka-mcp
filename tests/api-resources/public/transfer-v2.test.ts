import Sanka from 'sanka-sdk';

const transferJob = {
  job_id: 'job-1',
  job_type: 'import',
  object_type: 'company',
  status: 'queued',
  summary: {},
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public transfer resources on V2', () => {
  test('uses V2 paths and unwraps import/export envelopes', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        const pathname = new URL(requestURL).pathname;
        const method = String(init?.method ?? 'GET').toUpperCase();
        calls.push(requestURL);
        if (pathname.endsWith('/cancel')) return envelope({ job: transferJob, canceled: true });
        if (pathname.endsWith('/retry')) {
          return envelope({ job: transferJob, retry_of_job_id: 'job-1', message: 'Retried.' });
        }
        if (pathname.endsWith('/exports') && method === 'GET') {
          return envelope({ jobs: [transferJob], message: 'OK' });
        }
        if (pathname.includes('/exports')) {
          return envelope({ ...transferJob, job_type: 'export' });
        }
        if (pathname.endsWith('/imports') && method === 'GET') {
          return envelope({ jobs: [transferJob], message: 'OK' });
        }
        return envelope(transferJob);
      },
    });

    await expect(
      client.public.imports.create({ object_type: 'company', file_id: 'file-1' }),
    ).resolves.toEqual(transferJob);
    await expect(client.public.imports.retrieve('job-1')).resolves.toEqual(transferJob);
    await expect(client.public.imports.list({ object_type: 'company', limit: 10 })).resolves.toEqual({
      jobs: [transferJob],
      message: 'OK',
    });
    await expect(client.public.imports.cancel('job-1')).resolves.toEqual(transferJob);
    await expect(client.public.imports.retry('job-1')).resolves.toEqual({
      job: transferJob,
      retry_of_job_id: 'job-1',
      message: 'Retried.',
    });
    await expect(client.public.exports.create({ object_type: 'company' })).resolves.toEqual({
      ...transferJob,
      job_type: 'export',
    });
    await expect(client.public.exports.retrieve('job-1')).resolves.toEqual({
      ...transferJob,
      job_type: 'export',
    });
    await expect(client.public.exports.list({ object_type: 'company', limit: 10 })).resolves.toEqual({
      jobs: [transferJob],
      message: 'OK',
    });
    await expect(client.public.exports.cancel('job-1')).resolves.toEqual(transferJob);
    await expect(client.public.exports.retry('job-1')).resolves.toEqual({
      job: transferJob,
      retry_of_job_id: 'job-1',
      message: 'Retried.',
    });

    expect(calls).toEqual([
      'http://localhost:5000/api/v2/imports',
      'http://localhost:5000/api/v2/imports/job-1',
      'http://localhost:5000/api/v2/imports?object_type=company&limit=10',
      'http://localhost:5000/api/v2/imports/job-1/cancel',
      'http://localhost:5000/api/v2/imports/job-1/retry',
      'http://localhost:5000/api/v2/exports',
      'http://localhost:5000/api/v2/exports/job-1',
      'http://localhost:5000/api/v2/exports?object_type=company&limit=10',
      'http://localhost:5000/api/v2/exports/job-1/cancel',
      'http://localhost:5000/api/v2/exports/job-1/retry',
    ]);
  });

  test('uses V2 integration channel and sync push paths', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url) => {
        const requestURL = String(url);
        calls.push(requestURL);
        if (requestURL.includes('/integration-sync/push')) {
          return envelope({
            channel_id: 'channel-1',
            object_type: 'company',
            operation: 'update',
            requested_count: 1,
            emitted_event_ids: ['event-1'],
            skipped_count: 0,
            message: 'OK',
          });
        }
        return envelope({ channels: [{ id: 'channel-1' }], message: 'OK' });
      },
    });

    await expect(client.public.integrations.listChannels({ object_type: 'company' })).resolves.toEqual({
      channels: [{ id: 'channel-1' }],
      message: 'OK',
    });
    await expect(
      client.integrationSync.push({
        channel_id: 'channel-1',
        object_type: 'company',
        record_ids: ['company-1'],
      }),
    ).resolves.toMatchObject({ emitted_event_ids: ['event-1'] });

    expect(calls).toEqual([
      'http://localhost:5000/api/v2/integrations/channels?object_type=company',
      'http://localhost:5000/api/v2/integration-sync/push',
    ]);
  });
});
