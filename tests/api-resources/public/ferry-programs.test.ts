import Sanka from 'sanka-sdk';

const program = {
  id: 'program-1',
  workspaceId: 'workspace-1',
  templateSlug: 'generic',
  status: 'active',
  name: 'Beyond Global Japan',
  todos: [],
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-program' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public Ferry programs resource', () => {
  test('uses dedicated public program, meeting, and task paths', async () => {
    const calls: Array<{ body?: unknown; method: string; url: string }> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const method = String(init?.method ?? 'GET').toUpperCase();
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ method, url: String(url), body });
        if (String(url).endsWith('/meetings')) {
          return envelope(
            method === 'GET' ?
              { meetings: [], count: 0 }
            : { id: 'meeting-1', title: '2026-07-10', contentMarkdown: '', programId: 'program-1' },
          );
        }
        if (String(url).endsWith('/batch-upsert')) {
          return envelope({ program, createdCount: 1, updatedCount: 0 });
        }
        if (method === 'GET' && String(url).endsWith('/programs')) {
          return envelope({ programs: [program], count: 1 });
        }
        return envelope(program);
      },
    });

    await client.public.ferryPrograms.list();
    await client.public.ferryPrograms.retrieve('program-1');
    await client.public.ferryPrograms.listMeetings('program-1');
    await client.public.ferryPrograms.createMeeting('program-1', {
      title: '2026-07-10',
      sourceRef: 'sheet:minutes:2026-07-10',
    });
    await client.public.ferryPrograms.createTodo('program-1', { title: 'Create HubSpot form' });
    await client.public.ferryPrograms.batchUpsertTodos('program-1', {
      todos: [{ title: 'Create HubSpot form', sourceRef: 'sheet:schedule:42' }],
    });
    await client.public.ferryPrograms.updateTodo('program-1', 'todo-1', { status: 'completed' });
    await client.public.ferryPrograms.deleteTodo('program-1', 'todo-1');

    expect(calls.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'GET http://localhost:5000/api/v2/public/ferry/programs',
      'GET http://localhost:5000/api/v2/public/ferry/programs/program-1',
      'GET http://localhost:5000/api/v2/public/ferry/programs/program-1/meetings',
      'POST http://localhost:5000/api/v2/public/ferry/programs/program-1/meetings',
      'POST http://localhost:5000/api/v2/public/ferry/programs/program-1/todos',
      'POST http://localhost:5000/api/v2/public/ferry/programs/program-1/todos/batch-upsert',
      'PATCH http://localhost:5000/api/v2/public/ferry/programs/program-1/todos/todo-1',
      'DELETE http://localhost:5000/api/v2/public/ferry/programs/program-1/todos/todo-1',
    ]);
    expect(calls[3]?.body).toMatchObject({ sourceRef: 'sheet:minutes:2026-07-10' });
    expect(calls[5]?.body).toMatchObject({
      todos: [{ title: 'Create HubSpot form', sourceRef: 'sheet:schedule:42' }],
    });
  });
});
