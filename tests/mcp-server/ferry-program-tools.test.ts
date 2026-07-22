import {
  batchUpsertFerryTodosTool,
  createFerryDocTool,
  createFerryTodoTool,
  deleteFerryTodoTool,
  getFerryProgramTool,
  listFerryDocsTool,
  listFerryProgramsTool,
  updateFerryDocTool,
  updateFerryTodoTool,
} from '../../packages/mcp-server/src/ferry-program-tools';
import { selectTools } from '../../packages/mcp-server/src/server';

const oauthContext = () => ({
  authMode: 'oauth_bearer' as const,
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: ['mcp:access'],
  },
});

const program = {
  id: 'program-1',
  name: 'Salesforce to HubSpot',
  todos: [],
  taskPhases: [],
};

const doc = { id: 'doc-1', title: 'Kickoff', contentMarkdown: '# Kickoff' };

describe('Ferry Programs MCP tools', () => {
  it('registers all Programs, Docs, and Todos tools in the hosted toolset', () => {
    const names = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'list_ferry_programs',
        'get_ferry_program',
        'list_ferry_docs',
        'create_ferry_doc',
        'update_ferry_doc',
        'create_ferry_todo',
        'batch_upsert_ferry_todos',
        'update_ferry_todo',
        'delete_ferry_todo',
      ]),
    );
    expect(listFerryProgramsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(deleteFerryTodoTool.tool.annotations?.destructiveHint).toBe(true);
  });

  it('lists and gets Ferry programs through the SDK resource', async () => {
    const list = jest.fn().mockResolvedValue({ programs: [program], count: 1 });
    const retrieve = jest.fn().mockResolvedValue(program);
    const client = { public: { ferryPrograms: { list, retrieve } } } as any;

    const listResult = await listFerryProgramsTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { workspace_id: 'workspace-1' },
    });
    const getResult = await getFerryProgramTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { program_id: 'program-1' },
    });

    expect(list).toHaveBeenCalledWith({ workspace_id: 'workspace-1' });
    expect(retrieve).toHaveBeenCalledWith('program-1', {});
    expect(listResult.structuredContent).toEqual({ programs: [program], count: 1 });
    expect(getResult.structuredContent).toEqual(program);
  });

  it('lists, creates, and updates Ferry Docs with API field aliases', async () => {
    const list = jest.fn().mockResolvedValue({ meetings: [doc], count: 1 });
    const create = jest.fn().mockResolvedValue(doc);
    const update = jest.fn().mockResolvedValue({ ...doc, pinned: true });
    const client = { public: { ferryPrograms: { docs: { list, create, update } } } } as any;

    await listFerryDocsTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { program_id: 'program-1' },
    });
    await createFerryDocTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: {
        program_id: 'program-1',
        title: 'Kickoff',
        meeting_at: '2026-07-23T09:00:00+09:00',
        content_markdown: '# Kickoff',
        source_ref: 'sheet:1',
      },
    });
    await updateFerryDocTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { program_id: 'program-1', doc_id: 'doc-1', pinned: true },
    });

    expect(list).toHaveBeenCalledWith('program-1', {});
    expect(create).toHaveBeenCalledWith('program-1', {
      title: 'Kickoff',
      meetingAt: '2026-07-23T09:00:00+09:00',
      contentMarkdown: '# Kickoff',
      sourceRef: 'sheet:1',
    });
    expect(update).toHaveBeenCalledWith('program-1', 'doc-1', { pinned: true });
  });

  it('creates, batch-upserts, updates, and deletes Ferry Todos', async () => {
    const create = jest.fn().mockResolvedValue(program);
    const batchUpsert = jest.fn().mockResolvedValue({ program, createdCount: 1, updatedCount: 0 });
    const update = jest.fn().mockResolvedValue(program);
    const del = jest.fn().mockResolvedValue(program);
    const client = {
      public: { ferryPrograms: { todos: { create, batchUpsert, update, delete: del } } },
    } as any;

    await createFerryTodoTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: {
        program_id: 'program-1',
        title: 'Create manual',
        due_date: '2026-07-31',
        priority: 'P1',
      },
    });
    await batchUpsertFerryTodosTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: {
        program_id: 'program-1',
        todos: [{ title: 'Create manual', source_ref: 'manual', phase_id: 'handoff' }],
      },
    });
    await updateFerryTodoTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { program_id: 'program-1', todo_id: 'todo-1', status: 'in_progress' },
    });
    await deleteFerryTodoTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { program_id: 'program-1', todo_id: 'todo-1' },
    });

    expect(create).toHaveBeenCalledWith('program-1', {
      title: 'Create manual',
      dueDate: '2026-07-31',
      priority: 'P1',
    });
    expect(batchUpsert).toHaveBeenCalledWith('program-1', {
      todos: [{ title: 'Create manual', sourceRef: 'manual', phaseId: 'handoff' }],
    });
    expect(update).toHaveBeenCalledWith('program-1', 'todo-1', { status: 'in_progress' });
    expect(del).toHaveBeenCalledWith('program-1', 'todo-1', {});
  });

  it('rejects empty updates and non-idempotent batch items before writing', async () => {
    const docsUpdate = jest.fn();
    const todoUpdate = jest.fn();
    const batchUpsert = jest.fn();
    const client = {
      public: {
        ferryPrograms: {
          docs: { update: docsUpdate },
          todos: { update: todoUpdate, batchUpsert },
        },
      },
    } as any;

    const docResult = await updateFerryDocTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { program_id: 'program-1', doc_id: 'doc-1' },
    });
    const todoResult = await updateFerryTodoTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { program_id: 'program-1', todo_id: 'todo-1' },
    });
    const batchResult = await batchUpsertFerryTodosTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { program_id: 'program-1', todos: [{ title: 'Missing identity' }] },
    });

    expect(docResult.isError).toBe(true);
    expect(todoResult.isError).toBe(true);
    expect(batchResult.isError).toBe(true);
    expect(docsUpdate).not.toHaveBeenCalled();
    expect(todoUpdate).not.toHaveBeenCalled();
    expect(batchUpsert).not.toHaveBeenCalled();
  });
});
