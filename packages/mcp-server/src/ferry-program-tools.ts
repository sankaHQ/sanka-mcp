import type {
  FerryProgramMeetingCreateParams,
  FerryProgramMeetingUpdateParams,
  FerryProgramTodoBatchUpsertItem,
  FerryProgramTodoCreateParams,
  FerryProgramTodoUpdateParams,
} from 'sanka-sdk';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpTool, ToolCallResult } from './types';

const PROGRAM_ID_PROPERTY = {
  program_id: { type: 'string', minLength: 1, description: 'Ferry program UUID.' },
};

const TODO_STATUS = ['not_started', 'in_progress', 'completed', 'blocked'];
const TODO_PRIORITY = ['P0', 'P1', 'P2', 'P3', 'P4'];

const TODO_PROPERTIES = {
  title: { type: 'string', minLength: 1, maxLength: 500 },
  title_ja: { type: ['string', 'null'] as any, maxLength: 500 },
  description: { type: 'string', maxLength: 20_000 },
  description_ja: { type: ['string', 'null'] as any, maxLength: 20_000 },
  category: { type: 'string', maxLength: 100 },
  required: { type: 'boolean' },
  status: { type: 'string', enum: TODO_STATUS },
  notes: { type: ['string', 'null'] as any, maxLength: 20_000 },
  start_date: { type: ['string', 'null'] as any, format: 'date' },
  due_date: { type: ['string', 'null'] as any, format: 'date' },
  priority: { type: 'string', enum: TODO_PRIORITY },
  source_ref: {
    type: ['string', 'null'] as any,
    maxLength: 500,
    description: 'Stable source row identifier used for idempotent imports.',
  },
};

const PROGRAM_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {},
  additionalProperties: true,
};

const toolResult = (payload: unknown, text: string): ToolCallResult => ({
  content: [{ type: 'text', text }],
  structuredContent: payload as Record<string, unknown>,
});

const readString = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const hasOwn = (args: Record<string, unknown> | undefined, key: string): boolean =>
  Boolean(args && Object.prototype.hasOwnProperty.call(args, key));

const optionalString = (
  args: Record<string, unknown> | undefined,
  key: string,
): string | null | undefined => {
  if (!hasOwn(args, key)) return undefined;
  if (args?.[key] === null) return null;
  return typeof args?.[key] === 'string' ? args[key].trim() : undefined;
};

const buildTodoBody = (args: Record<string, unknown> | undefined): Record<string, unknown> => ({
  ...(hasOwn(args, 'title') ? { title: readString(args?.['title']) ?? '' } : undefined),
  ...(hasOwn(args, 'title_ja') ? { titleJa: optionalString(args, 'title_ja') } : undefined),
  ...(hasOwn(args, 'description') ? { description: optionalString(args, 'description') ?? '' } : undefined),
  ...(hasOwn(args, 'description_ja') ? { descriptionJa: optionalString(args, 'description_ja') } : undefined),
  ...(hasOwn(args, 'category') ? { category: readString(args?.['category']) ?? '' } : undefined),
  ...(typeof args?.['required'] === 'boolean' ? { required: args['required'] } : undefined),
  ...(hasOwn(args, 'status') ? { status: args?.['status'] as any } : undefined),
  ...(hasOwn(args, 'notes') ? { notes: optionalString(args, 'notes') } : undefined),
  ...(hasOwn(args, 'start_date') ? { startDate: optionalString(args, 'start_date') } : undefined),
  ...(hasOwn(args, 'due_date') ? { dueDate: optionalString(args, 'due_date') } : undefined),
  ...(hasOwn(args, 'priority') ? { priority: args?.['priority'] as any } : undefined),
  ...(hasOwn(args, 'source_ref') ? { sourceRef: optionalString(args, 'source_ref') } : undefined),
});

const mapBatchTodo = (value: unknown): FerryProgramTodoBatchUpsertItem | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const body = buildTodoBody(item);
  const id = readString(item['id']);
  const sourceRef = readString(item['source_ref']);
  const title = readString(item['title']);
  if ((!id && !sourceRef) || !title) return undefined;
  return {
    ...(body as unknown as FerryProgramTodoCreateParams),
    title,
    ...(id ? { id } : undefined),
    ...(sourceRef ? { sourceRef } : undefined),
  };
};

const authenticate = (reqContext: Parameters<McpTool['handler']>[0]['reqContext'], title: string) =>
  requireAuthentication({ reqContext, toolTitle: title });

export const listFerryProgramsTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'read',
    tags: ['ferry', 'programs'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/ferry/programs',
    operationId: 'public.ferryPrograms.list',
  },
  tool: {
    name: 'list_ferry_programs',
    title: 'List Ferry programs',
    description: 'List project programs available in the current Ferry workspace.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  handler: async ({ reqContext }) => {
    const authError = authenticate(reqContext, 'List Ferry programs');
    if (authError) return authError;
    const payload = await reqContext.client.public.ferryPrograms.list();
    return toolResult(payload, `Found ${payload.count} Ferry program(s).`);
  },
};

export const getFerryProgramTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'read',
    tags: ['ferry', 'programs'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/ferry/programs/{program_id}',
    operationId: 'public.ferryPrograms.retrieve',
  },
  tool: {
    name: 'get_ferry_program',
    title: 'Get Ferry program',
    description: 'Get one Ferry program with its tasks and project metadata.',
    inputSchema: { type: 'object', properties: PROGRAM_ID_PROPERTY, required: ['program_id'] },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  handler: async ({ reqContext, args }) => {
    const authError = authenticate(reqContext, 'Get Ferry program');
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    if (!programID) return asErrorResult('`program_id` is required.');
    const payload = await reqContext.client.public.ferryPrograms.retrieve(programID);
    return toolResult(payload, `Loaded Ferry program ${payload.name || payload.id}.`);
  },
};

export const listFerryProgramMeetingsTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'read',
    tags: ['ferry', 'programs', 'meetings'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/meetings',
    operationId: 'public.ferryPrograms.listMeetings',
  },
  tool: {
    name: 'list_ferry_program_meetings',
    title: 'List Ferry meeting updates',
    description: 'List Meeting Updates stored for a Ferry project program.',
    inputSchema: { type: 'object', properties: PROGRAM_ID_PROPERTY, required: ['program_id'] },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  handler: async ({ reqContext, args }) => {
    const authError = authenticate(reqContext, 'List Ferry meeting updates');
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    if (!programID) return asErrorResult('`program_id` is required.');
    const payload = await reqContext.client.public.ferryPrograms.listMeetings(programID);
    return toolResult(payload, `Found ${payload.count} Meeting Update(s).`);
  },
};

export const upsertFerryProgramMeetingTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'write',
    tags: ['ferry', 'programs', 'meetings'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/meetings',
    operationId: 'public.ferryPrograms.createMeeting',
  },
  tool: {
    name: 'upsert_ferry_program_meeting',
    title: 'Upsert Ferry meeting update',
    description:
      'Create a Meeting Update. Reusing source_ref updates the same imported meeting instead of duplicating it.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROGRAM_ID_PROPERTY,
        title: { type: 'string', minLength: 1, maxLength: 255 },
        meeting_at: { type: ['string', 'null'] as any, format: 'date-time' },
        content_markdown: { type: 'string', maxLength: 200_000 },
        source_ref: { type: 'string', minLength: 1, maxLength: 500 },
      },
      required: ['program_id', 'title'],
    },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  handler: async ({ reqContext, args }) => {
    const authError = authenticate(reqContext, 'Upsert Ferry meeting update');
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    const title = readString(args?.['title']);
    if (!programID || !title) return asErrorResult('`program_id` and `title` are required.');
    const body = {
      title,
      ...(hasOwn(args, 'meeting_at') ? { meetingAt: optionalString(args, 'meeting_at') } : undefined),
      ...(hasOwn(args, 'content_markdown') ?
        { contentMarkdown: optionalString(args, 'content_markdown') ?? '' }
      : undefined),
      ...(hasOwn(args, 'source_ref') ? { sourceRef: optionalString(args, 'source_ref') } : undefined),
    } as FerryProgramMeetingCreateParams;
    const payload = await reqContext.client.public.ferryPrograms.createMeeting(programID, body);
    return toolResult(payload, `Upserted Meeting Update ${payload.title}.`);
  },
};

export const updateFerryProgramMeetingTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'write',
    tags: ['ferry', 'programs', 'meetings'],
    httpMethod: 'patch',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/meetings/{meeting_id}',
    operationId: 'public.ferryPrograms.updateMeeting',
  },
  tool: {
    name: 'update_ferry_program_meeting',
    title: 'Update Ferry meeting update',
    description: 'Update selected fields of an existing Meeting Update.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROGRAM_ID_PROPERTY,
        meeting_id: { type: 'string', minLength: 1 },
        title: { type: 'string', minLength: 1, maxLength: 255 },
        meeting_at: { type: ['string', 'null'] as any, format: 'date-time' },
        content_markdown: { type: 'string', maxLength: 200_000 },
      },
      required: ['program_id', 'meeting_id'],
    },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  handler: async ({ reqContext, args }) => {
    const authError = authenticate(reqContext, 'Update Ferry meeting update');
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    const meetingID = readString(args?.['meeting_id']);
    if (!programID || !meetingID) return asErrorResult('`program_id` and `meeting_id` are required.');
    const body = {
      ...(hasOwn(args, 'title') ? { title: readString(args?.['title']) ?? '' } : undefined),
      ...(hasOwn(args, 'meeting_at') ? { meetingAt: optionalString(args, 'meeting_at') } : undefined),
      ...(hasOwn(args, 'content_markdown') ?
        { contentMarkdown: optionalString(args, 'content_markdown') ?? '' }
      : undefined),
    } as FerryProgramMeetingUpdateParams;
    if (Object.keys(body).length === 0) return asErrorResult('At least one meeting field is required.');
    const payload = await reqContext.client.public.ferryPrograms.updateMeeting(programID, meetingID, body);
    return toolResult(payload, `Updated Meeting Update ${payload.title}.`);
  },
};

export const createFerryProgramTodoTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'write',
    tags: ['ferry', 'programs', 'tasks'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/todos',
    operationId: 'public.ferryPrograms.createTodo',
  },
  tool: {
    name: 'create_ferry_program_task',
    title: 'Create Ferry task',
    description: 'Create one task in a Ferry project program.',
    inputSchema: {
      type: 'object',
      properties: { ...PROGRAM_ID_PROPERTY, ...TODO_PROPERTIES },
      required: ['program_id', 'title'],
    },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  handler: async ({ reqContext, args }) => {
    const authError = authenticate(reqContext, 'Create Ferry task');
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    const title = readString(args?.['title']);
    if (!programID || !title) return asErrorResult('`program_id` and `title` are required.');
    const payload = await reqContext.client.public.ferryPrograms.createTodo(programID, {
      ...(buildTodoBody(args) as unknown as FerryProgramTodoCreateParams),
      title,
    });
    return toolResult(payload, `Created Ferry task ${title}.`);
  },
};

export const batchUpsertFerryProgramTodosTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'write',
    tags: ['ferry', 'programs', 'tasks', 'import'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/todos/batch-upsert',
    operationId: 'public.ferryPrograms.batchUpsertTodos',
  },
  tool: {
    name: 'upsert_ferry_program_tasks',
    title: 'Upsert Ferry tasks',
    description:
      'Idempotently import up to 100 schedule rows. Each task requires id or source_ref plus title.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROGRAM_ID_PROPERTY,
        tasks: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: {
            type: 'object',
            properties: { id: { type: 'string' }, ...TODO_PROPERTIES },
            required: ['title'],
          },
        },
      },
      required: ['program_id', 'tasks'],
    },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  handler: async ({ reqContext, args }) => {
    const authError = authenticate(reqContext, 'Upsert Ferry tasks');
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    const rawTasks = args?.['tasks'];
    const tasks = Array.isArray(rawTasks) ? rawTasks.map(mapBatchTodo) : [];
    if (!programID || tasks.length === 0 || tasks.some((task) => task === undefined)) {
      return asErrorResult('`program_id` and valid `tasks` are required; every task needs id or source_ref.');
    }
    const payload = await reqContext.client.public.ferryPrograms.batchUpsertTodos(programID, {
      todos: tasks as FerryProgramTodoBatchUpsertItem[],
    });
    return toolResult(
      payload,
      `Upserted Ferry tasks: ${payload.createdCount} created, ${payload.updatedCount} updated.`,
    );
  },
};

export const updateFerryProgramTodoTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'write',
    tags: ['ferry', 'programs', 'tasks'],
    httpMethod: 'patch',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/todos/{todo_id}',
    operationId: 'public.ferryPrograms.updateTodo',
  },
  tool: {
    name: 'update_ferry_program_task',
    title: 'Update Ferry task',
    description: 'Update selected fields of one Ferry task without replacing the program task list.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROGRAM_ID_PROPERTY,
        todo_id: { type: 'string', minLength: 1 },
        ...TODO_PROPERTIES,
      },
      required: ['program_id', 'todo_id'],
    },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  handler: async ({ reqContext, args }) => {
    const authError = authenticate(reqContext, 'Update Ferry task');
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    const todoID = readString(args?.['todo_id']);
    if (!programID || !todoID) return asErrorResult('`program_id` and `todo_id` are required.');
    const body = buildTodoBody(args) as FerryProgramTodoUpdateParams;
    if (Object.keys(body).length === 0) return asErrorResult('At least one task field is required.');
    const payload = await reqContext.client.public.ferryPrograms.updateTodo(programID, todoID, body);
    return toolResult(payload, `Updated Ferry task ${todoID}.`);
  },
};

export const deleteFerryProgramTodoTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'write',
    tags: ['ferry', 'programs', 'tasks'],
    httpMethod: 'delete',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/todos/{todo_id}',
    operationId: 'public.ferryPrograms.deleteTodo',
  },
  tool: {
    name: 'delete_ferry_program_task',
    title: 'Delete Ferry task',
    description: 'Permanently delete one task from a Ferry project program.',
    inputSchema: {
      type: 'object',
      properties: { ...PROGRAM_ID_PROPERTY, todo_id: { type: 'string', minLength: 1 } },
      required: ['program_id', 'todo_id'],
    },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  handler: async ({ reqContext, args }) => {
    const authError = authenticate(reqContext, 'Delete Ferry task');
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    const todoID = readString(args?.['todo_id']);
    if (!programID || !todoID) return asErrorResult('`program_id` and `todo_id` are required.');
    const payload = await reqContext.client.public.ferryPrograms.deleteTodo(programID, todoID);
    return toolResult(payload, `Deleted Ferry task ${todoID}.`);
  },
};
