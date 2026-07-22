import Sanka from 'sanka-sdk';

const program = {
  id: 'program-1',
  workspaceId: 'workspace-1',
  templateSlug: 'crm-migration',
  status: 'active',
  plan: 'expert_led',
  name: 'Salesforce to HubSpot',
  description: '',
  updatesMarkdown: '',
  sources: [],
  destinations: [],
  todos: [],
  taskPhases: [],
  linkedRunIds: [],
};

const doc = {
  id: 'doc-1',
  programId: 'program-1',
  workspaceId: 'workspace-1',
  title: 'Kickoff',
  contentMarkdown: '# Kickoff',
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-ferry' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public Ferry Programs resource', () => {
  test('covers Programs, Docs, and Todos through public V2 paths', async () => {
    const calls: Array<{ body?: unknown; method: string; url: string }> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const method = String(init?.method ?? 'GET').toUpperCase();
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ method, url: String(url), body });
        const requestURL = String(url);
        if (requestURL.endsWith('/programs?workspace_id=workspace-1')) {
          return envelope({ programs: [program], count: 1 });
        }
        if (method === 'GET' && requestURL.endsWith('/meetings?workspace_id=workspace-1')) {
          return envelope({ meetings: [doc], count: 1 });
        }
        if (requestURL.includes('/meetings')) return envelope(doc);
        if (requestURL.includes('/batch-upsert')) {
          return envelope({ program, createdCount: 1, updatedCount: 0 });
        }
        return envelope(program);
      },
    });

    await expect(client.public.ferryPrograms.list({ workspace_id: 'workspace-1' })).resolves.toEqual({
      programs: [program],
      count: 1,
    });
    await expect(client.public.ferryPrograms.retrieve('program-1')).resolves.toEqual(program);
    await expect(
      client.public.ferryPrograms.docs.list('program-1', { workspace_id: 'workspace-1' }),
    ).resolves.toEqual({ meetings: [doc], count: 1 });
    await expect(
      client.public.ferryPrograms.docs.create('program-1', {
        workspace_id: 'workspace-1',
        title: 'Kickoff',
        contentMarkdown: '# Kickoff',
        sourceRef: 'sheet:1',
      }),
    ).resolves.toEqual(doc);
    await expect(
      client.public.ferryPrograms.docs.update('program-1', 'doc-1', {
        workspace_id: 'workspace-1',
        pinned: true,
      }),
    ).resolves.toEqual(doc);
    await expect(
      client.public.ferryPrograms.todos.create('program-1', {
        workspace_id: 'workspace-1',
        title: 'Create manual',
        dueDate: '2026-07-31',
      }),
    ).resolves.toEqual(program);
    await expect(
      client.public.ferryPrograms.todos.batchUpsert('program-1', {
        workspace_id: 'workspace-1',
        todos: [{ title: 'Create manual', sourceRef: 'manual' }],
      }),
    ).resolves.toMatchObject({ createdCount: 1, updatedCount: 0 });
    await expect(
      client.public.ferryPrograms.todos.update('program-1', 'todo-1', {
        workspace_id: 'workspace-1',
        status: 'in_progress',
      }),
    ).resolves.toEqual(program);
    await expect(
      client.public.ferryPrograms.todos.delete('program-1', 'todo-1', {
        workspace_id: 'workspace-1',
      }),
    ).resolves.toEqual(program);

    expect(calls).toEqual([
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/ferry/programs?workspace_id=workspace-1',
        body: undefined,
      },
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/ferry/programs/program-1',
        body: undefined,
      },
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/ferry/programs/program-1/meetings?workspace_id=workspace-1',
        body: undefined,
      },
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/ferry/programs/program-1/meetings?workspace_id=workspace-1',
        body: { title: 'Kickoff', contentMarkdown: '# Kickoff', sourceRef: 'sheet:1' },
      },
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/public/ferry/programs/program-1/meetings/doc-1?workspace_id=workspace-1',
        body: { pinned: true },
      },
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/ferry/programs/program-1/todos?workspace_id=workspace-1',
        body: { title: 'Create manual', dueDate: '2026-07-31' },
      },
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/ferry/programs/program-1/todos/batch-upsert?workspace_id=workspace-1',
        body: { todos: [{ title: 'Create manual', sourceRef: 'manual' }] },
      },
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/public/ferry/programs/program-1/todos/todo-1?workspace_id=workspace-1',
        body: { status: 'in_progress' },
      },
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/public/ferry/programs/program-1/todos/todo-1?workspace_id=workspace-1',
        body: undefined,
      },
    ]);
  });
});
