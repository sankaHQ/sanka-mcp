import {
  batchUpsertFerryProgramTodosTool,
  deleteFerryProgramTodoTool,
  listFerryProgramsTool,
  upsertFerryProgramMeetingTool,
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

describe('Ferry program MCP tools', () => {
  it('registers the full project management toolset', () => {
    const names = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'list_ferry_programs',
        'get_ferry_program',
        'list_ferry_program_meetings',
        'upsert_ferry_program_meeting',
        'update_ferry_program_meeting',
        'create_ferry_program_task',
        'upsert_ferry_program_tasks',
        'update_ferry_program_task',
        'delete_ferry_program_task',
      ]),
    );
    expect(deleteFerryProgramTodoTool.tool.annotations?.destructiveHint).toBe(true);
  });

  it('lists programs and idempotently imports meetings and schedule rows', async () => {
    const list = jest.fn().mockResolvedValue({ programs: [], count: 0 });
    const createMeeting = jest.fn().mockResolvedValue({ id: 'meeting-1', title: '2026-07-10' });
    const batchUpsertTodos = jest
      .fn()
      .mockResolvedValue({ program: { id: 'program-1' }, createdCount: 1, updatedCount: 0 });
    const client = {
      public: { ferryPrograms: { list, createMeeting, batchUpsertTodos } },
    } as any;

    const listResult = await listFerryProgramsTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: {},
    });
    await upsertFerryProgramMeetingTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: {
        program_id: 'program-1',
        title: '2026-07-10',
        source_ref: 'sheet:minutes:2026-07-10',
      },
    });
    const taskResult = await batchUpsertFerryProgramTodosTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: {
        program_id: 'program-1',
        tasks: [
          {
            title: 'Create HubSpot form',
            source_ref: 'sheet:schedule:42',
            due_date: '2026-07-24',
          },
        ],
      },
    });

    expect(listResult.structuredContent).toEqual({ programs: [], count: 0 });
    expect(createMeeting).toHaveBeenCalledWith('program-1', {
      title: '2026-07-10',
      sourceRef: 'sheet:minutes:2026-07-10',
    });
    expect(batchUpsertTodos).toHaveBeenCalledWith('program-1', {
      todos: [
        {
          title: 'Create HubSpot form',
          sourceRef: 'sheet:schedule:42',
          dueDate: '2026-07-24',
        },
      ],
    });
    expect(taskResult.content[0]).toMatchObject({
      type: 'text',
      text: 'Upserted Ferry tasks: 1 created, 0 updated.',
    });
  });
});
