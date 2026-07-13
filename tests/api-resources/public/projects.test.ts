import Sanka from 'sanka-sdk';

const project = {
  id: 'project-1',
  project_id: 'project-1',
  title: 'Customer Onboarding',
  description: 'Coordinate the customer rollout.',
  default: false,
  statuses: [
    {
      id: 'status-1',
      name: 'Todo',
      internal_value: 'todo',
      order: 1,
    },
  ],
  task_count: 2,
  active_task_count: 1,
};

const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });

const envelope = (data: unknown, ctxId: string) =>
  json({
    success: true,
    data,
    meta: { ctx_id: ctxId },
  });

describe('public projects resource', () => {
  test('uses public project paths and response shapes', async () => {
    const calls: Array<{ body?: unknown; headers: Record<string, string>; method: string; url: string }> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const method = String(init?.method ?? 'GET').toUpperCase();
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        const headers = Object.fromEntries(new Headers(init?.headers as any).entries());
        calls.push({ method, url: String(url), body, headers });
        if (method === 'GET' && String(url).includes('/api/v2/public/projects?')) {
          return envelope(
            {
              items: [project],
              page: 2,
              page_size: 20,
              total: 3,
              next_cursor: 'project-1',
              meta: { source: 'data_projects' },
            },
            'ctx-list',
          );
        }
        if (method === 'POST') {
          return envelope(
            {
              ok: true,
              status: 'created',
              id: 'project-1',
              project_id: 'project-1',
              project,
            },
            'ctx-create',
          );
        }
        if (method === 'PUT') {
          return envelope(
            {
              ok: true,
              status: 'updated',
              id: 'project-1',
              project_id: 'project-1',
              project: { ...project, title: 'Customer Success' },
            },
            'ctx-update',
          );
        }
        if (method === 'DELETE') {
          return envelope(
            {
              ok: true,
              status: 'deleted',
              id: 'project-1',
              project_id: 'project-1',
              cleared_task_count: 2,
              reassigned_task_count: 0,
            },
            'ctx-delete',
          );
        }
        return envelope(project, 'ctx-get');
      },
    });

    await expect(
      client.public.projects.list({
        search: 'Customer',
        default: false,
        page: 2,
        limit: 20,
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
        'X-Language': 'en',
      }),
    ).resolves.toMatchObject({
      data: [project],
      page: 2,
      count: 1,
      total: 3,
      has_next: true,
    });
    await expect(client.public.projects.retrieve('project-1')).resolves.toEqual(project);
    await expect(
      client.public.projects.create({
        title: 'Customer Onboarding',
        description: 'Coordinate the customer rollout.',
        default: false,
        statuses: [{ name: 'Todo', internal_value: 'todo', order: 1 }],
        'X-Language': 'en',
      }),
    ).resolves.toMatchObject({ ok: true, status: 'created', project_id: 'project-1' });
    await expect(
      client.public.projects.update('project-1', {
        title: 'Customer Success',
        description: 'Updated rollout overview.',
        statuses: [{ id: 'status-1', name: 'Done', internal_value: 'done', order: 2 }],
      }),
    ).resolves.toMatchObject({ ok: true, status: 'updated', project_id: 'project-1' });
    await expect(
      client.public.projects.delete('project-1', {
        clear_task_project: true,
        'Accept-Language': 'en',
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: 'deleted',
      project_id: 'project-1',
      cleared_task_count: 2,
    });

    expect(calls).toEqual([
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/projects?workspace_id=workspace-1&default=false&limit=20&page=2&search=Customer',
        body: undefined,
        headers: expect.objectContaining({
          'accept-language': 'en',
          'x-language': 'en',
        }),
      },
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/projects/project-1',
        body: undefined,
        headers: expect.any(Object),
      },
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/projects',
        body: {
          title: 'Customer Onboarding',
          description: 'Coordinate the customer rollout.',
          default: false,
          statuses: [{ name: 'Todo', internal_value: 'todo', order: 1 }],
        },
        headers: expect.objectContaining({
          'x-language': 'en',
        }),
      },
      {
        method: 'PUT',
        url: 'http://localhost:5000/api/v2/public/projects/project-1',
        body: {
          title: 'Customer Success',
          description: 'Updated rollout overview.',
          statuses: [{ id: 'status-1', name: 'Done', internal_value: 'done', order: 2 }],
        },
        headers: expect.any(Object),
      },
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/public/projects/project-1?clear_task_project=true',
        body: undefined,
        headers: expect.objectContaining({
          'accept-language': 'en',
        }),
      },
    ]);
  });
});
