import Sanka from 'sanka-sdk';

const taskRecord = {
  id: 'task-1',
  record_id: '701',
  object_type: 'task',
  properties: {
    external_id: 'TASK-1',
    title: 'Follow up with Acme',
    status: 'open',
    usage_status: 'active',
  },
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public tasks resource on V2', () => {
  test('uses V2 task paths and preserves legacy SDK response shapes', async () => {
    const calls: Array<{ body?: unknown; method: string; url: string }> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const method = String(init?.method ?? 'GET').toUpperCase();
        const requestURL = String(url);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ method, url: requestURL, body });
        if (method === 'GET' && requestURL.includes('/api/v2/tasks?')) {
          return envelope({
            items: [taskRecord],
            page: 2,
            page_size: 20,
            total: 4,
          });
        }
        if (method === 'DELETE') {
          return envelope({ id: 'task-1', record_id: '701', usage_status: 'archived' });
        }
        if (method === 'PATCH') {
          return envelope({
            ...taskRecord,
            properties: {
              ...taskRecord.properties,
              external_id: 'TASK-2',
            },
          });
        }
        return envelope(taskRecord);
      },
    });

    await expect(
      client.public.tasks.create({
        external_id: 'TASK-1',
        title: 'Follow up with Acme',
        description: 'Send the latest customer update',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'open',
      external_id: 'TASK-1',
      task_id: 'task-1',
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.tasks.list({
        search: 'Acme',
        usage_status: 'active',
        project_id: 'project-1',
        page: 2,
        limit: 20,
        workspace_id: 'legacy-workspace',
      }),
    ).resolves.toEqual({
      data: [
        {
          id: 'task-1',
          task_id: 701,
          external_id: 'TASK-1',
          title: 'Follow up with Acme',
          status: 'open',
          usage_status: 'active',
        },
      ],
      page: 2,
      count: 1,
      total: 4,
      has_next: false,
      message: 'OK',
      ctx_id: 'ctx-test',
    });
    await expect(client.public.tasks.retrieve('task-1', { external_id: 'TASK-1' })).resolves.toMatchObject({
      id: 'task-1',
      task_id: 701,
      title: 'Follow up with Acme',
    });
    await expect(
      client.public.tasks.update('task-1', {
        external_id: 'TASK-1',
        body_external_id: 'TASK-2',
        description: 'Append the latest customer note',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'open',
      external_id: 'TASK-2',
      task_id: 'task-1',
      ctx_id: 'ctx-test',
    });
    await expect(client.public.tasks.delete('task-1', { external_id: 'TASK-1' })).resolves.toEqual({
      ok: true,
      status: 'archived',
      task_id: 'task-1',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/tasks',
        body: {
          properties: {
            external_id: 'TASK-1',
            title: 'Follow up with Acme',
            description: 'Send the latest customer update',
          },
        },
      },
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/tasks?search=Acme&usage_status=active&project_id=project-1&page=2&page_size=20',
        body: undefined,
      },
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/tasks/task-1',
        body: undefined,
      },
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/tasks/task-1',
        body: {
          properties: {
            description: 'Append the latest customer note',
            external_id: 'TASK-2',
          },
        },
      },
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/tasks/task-1',
        body: undefined,
      },
    ]);
  });
});
