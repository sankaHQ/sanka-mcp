import Sanka from 'sanka-sdk';

const workflowItem = {
  id: 'workflow-1',
  workflow_id: 1001,
  title: 'Renewal approval',
  status: 'active',
  is_trigger_active: true,
  valid_to_run: true,
  trigger_type: 'manual',
  updated_at: '2026-05-31T00:00:00Z',
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public workflow resources on V2', () => {
  test('uses V2 workflow paths for backend-ready read methods', async () => {
    const calls: string[] = [];
    const methods: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        calls.push(requestURL);
        methods.push(String(init?.method ?? 'GET'));
        if (requestURL.endsWith('/api/v2/public/workflows/workflow-1/run')) {
          return envelope({
            run_id: 'run-1',
            workflow_id: 'workflow-1',
            workflow_history_id: 'history-1',
            status: 'running',
            started_at: '2026-05-31T00:00:00Z',
          });
        }
        if (
          requestURL.endsWith('/api/v2/public/workflows') ||
          requestURL.endsWith('/api/v2/public/workflows/workflow-1')
        ) {
          if (init?.method === 'POST' || init?.method === 'PATCH') {
            return envelope({
              ok: true,
              provider: 'hubspot',
              dry_run: true,
              workflow_id: 'workflow-1',
              external_id: 'flow-1',
              status: init.method === 'PATCH' ? 'updated' : 'previewed',
              node_count: 0,
              valid_to_run: false,
              platform_payload: { objectTypeId: '0-3' },
            });
          }
        }
        if (requestURL.includes('/actions')) {
          return envelope({
            actions: [{ action_uid: 'send_email', is_trigger: false, title: 'Send email' }],
            count: 1,
          });
        }
        if (requestURL.includes('/workflow-runs/run-1')) {
          return envelope({
            run_id: 'run-1',
            workflow_id: 'workflow-1',
            workflow_history_id: 'history-1',
            status: 'completed',
            started_at: '2026-05-31T00:00:00Z',
          });
        }
        if (requestURL.endsWith('/api/v2/public/workflows/workflow-1')) {
          return envelope({ workflow: workflowItem });
        }
        return envelope({
          items: [workflowItem],
          total: 1,
          page: 2,
          page_size: 10,
        });
      },
    });

    await expect(client.public.workflows.list({ page: 2, limit: 10 })).resolves.toEqual({
      count: 1,
      data: [
        expect.objectContaining({
          external_id: 'workflow-1',
          workflow_id: '1001',
          title: 'Renewal approval',
        }),
      ],
      limit: 10,
      page: 2,
      ctx_id: 'ctx-test',
    });
    await expect(client.public.workflows.retrieve('workflow-1')).resolves.toMatchObject({
      external_id: 'workflow-1',
      workflow_id: '1001',
    });
    await expect(client.public.workflows.listActions()).resolves.toEqual({
      count: 1,
      data: [{ action_uid: 'send_email', is_trigger: false, title: 'Send email' }],
      ctx_id: 'ctx-test',
    });
    await expect(client.public.workflows.retrieveRun('run-1')).resolves.toMatchObject({
      data: {
        run_id: 'run-1',
        workflow_id: 'workflow-1',
        status: 'completed',
      },
      message: 'ok',
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.workflows.createOrUpdate({
        provider: 'hubspot',
        title: 'Set amount',
        dry_run: true,
      }),
    ).resolves.toMatchObject({
      provider: 'hubspot',
      dry_run: true,
      external_id: 'flow-1',
      status: 'previewed',
    });
    await expect(
      client.public.workflows.update('workflow-1', {
        provider: 'hubspot',
        external_id: 'flow-1',
        dry_run: true,
      }),
    ).resolves.toMatchObject({
      provider: 'hubspot',
      status: 'updated',
    });
    await expect(client.public.workflows.run('workflow-1')).resolves.toMatchObject({
      data: {
        run_id: 'run-1',
        workflow_id: 'workflow-1',
        status: 'running',
      },
      message: 'ok',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'http://localhost:5000/api/v2/public/workflows?page=2&limit=10',
      'http://localhost:5000/api/v2/public/workflows/workflow-1',
      'http://localhost:5000/api/v2/public/workflows/actions',
      'http://localhost:5000/api/v2/public/workflow-runs/run-1',
      'http://localhost:5000/api/v2/public/workflows',
      'http://localhost:5000/api/v2/public/workflows/workflow-1',
      'http://localhost:5000/api/v2/public/workflows/workflow-1/run',
    ]);
    expect(methods).toEqual(['GET', 'GET', 'GET', 'GET', 'POST', 'PATCH', 'POST']);
  });
});
