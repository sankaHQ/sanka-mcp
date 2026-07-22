import type {
  FerryProgramDocCreateParams,
  FerryProgramDocUpdateParams,
  FerryProgramTodoBatchUpsertItem,
  FerryProgramTodoBatchUpsertParams,
  FerryProgramTodoCreateParams,
  FerryProgramTodoUpdateParams,
} from 'sanka-sdk';
import { asErrorResult, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const WORKSPACE_PROPERTY = {
  workspace_id: {
    type: 'string',
    description: 'Optional workspace UUID. Omit to use the current authenticated workspace.',
  },
};

const PROGRAM_ID_PROPERTY = {
  program_id: { type: 'string', minLength: 1, description: 'Ferry program UUID.' },
};

const DOC_ID_PROPERTY = {
  doc_id: { type: 'string', minLength: 1, description: 'Ferry Doc UUID (meeting update id).' },
};

const TODO_ID_PROPERTY = {
  todo_id: { type: 'string', minLength: 1, description: 'Ferry Todo id.' },
};

const TODO_WRITE_PROPERTIES = {
  title: { type: 'string', minLength: 1, maxLength: 500 },
  title_ja: { type: ['string', 'null'] as any, maxLength: 500 },
  description: { type: 'string', maxLength: 20000 },
  description_ja: { type: ['string', 'null'] as any, maxLength: 20000 },
  category: { type: 'string', maxLength: 100 },
  required: { type: 'boolean' },
  status: {
    type: 'string',
    enum: ['not_started', 'in_progress', 'blocked', 'completed'],
  },
  notes: { type: ['string', 'null'] as any, maxLength: 20000 },
  start_date: { type: ['string', 'null'] as any, description: 'ISO date (YYYY-MM-DD).' },
  due_date: { type: ['string', 'null'] as any, description: 'ISO date (YYYY-MM-DD).' },
  priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3', 'P4'] },
  source_ref: {
    type: ['string', 'null'] as any,
    maxLength: 500,
    description: 'Stable source identifier used for idempotent batch upserts.',
  },
  phase_id: { type: ['string', 'null'] as any, maxLength: 100 },
  parent_todo_id: { type: ['string', 'null'] as any, maxLength: 500 },
  sort_order: { type: ['integer', 'null'] as any, minimum: 0 },
  archived_at: { type: ['string', 'null'] as any, maxLength: 40 },
};

const PROGRAM_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {},
  additionalProperties: true,
};

const PROGRAM_LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    programs: { type: 'array', items: PROGRAM_OUTPUT_SCHEMA },
    count: { type: 'integer' },
  },
  required: ['programs', 'count'],
};

const DOC_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {},
  additionalProperties: true,
};

const DOC_LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    meetings: { type: 'array', items: DOC_OUTPUT_SCHEMA },
    count: { type: 'integer' },
  },
  required: ['meetings', 'count'],
};

const BATCH_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    program: PROGRAM_OUTPUT_SCHEMA,
    createdCount: { type: 'integer' },
    updatedCount: { type: 'integer' },
  },
  required: ['program', 'createdCount', 'updatedCount'],
};

const readString = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const hasOwn = (value: Record<string, unknown> | undefined, key: string): boolean =>
  Boolean(value && Object.prototype.hasOwnProperty.call(value, key));

const readWorkspaceParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  return workspaceID ? { workspace_id: workspaceID } : {};
};

const readNullableString = (
  args: Record<string, unknown> | undefined,
  key: string,
): string | null | undefined => {
  if (!hasOwn(args, key)) return undefined;
  const value = args?.[key];
  if (value === null) return null;
  return typeof value === 'string' ? value.trim() : undefined;
};

const copyIfPresent = (
  body: Record<string, unknown>,
  args: Record<string, unknown> | undefined,
  inputKey: string,
  outputKey: string,
): void => {
  if (hasOwn(args, inputKey)) body[outputKey] = args?.[inputKey];
};

const buildDocBody = (
  args: Record<string, unknown> | undefined,
  requireTitle: boolean,
): FerryProgramDocCreateParams | FerryProgramDocUpdateParams | undefined => {
  const body: Record<string, unknown> = { ...readWorkspaceParams(args) };
  const title = readString(args?.['title']);
  if (requireTitle && !title) return undefined;
  if (hasOwn(args, 'title')) body['title'] = title;
  const textMappings = [
    ['meeting_at', 'meetingAt'],
    ['content_markdown', 'contentMarkdown'],
    ['source_ref', 'sourceRef'],
    ['archived_at', 'archivedAt'],
  ] as const;
  for (const [inputKey, outputKey] of textMappings) {
    const value = readNullableString(args, inputKey);
    if (value !== undefined) body[outputKey] = value;
  }
  copyIfPresent(body, args, 'pinned', 'pinned');
  return body as FerryProgramDocCreateParams | FerryProgramDocUpdateParams;
};

const TODO_FIELD_MAPPINGS = [
  ['title_ja', 'titleJa'],
  ['description_ja', 'descriptionJa'],
  ['start_date', 'startDate'],
  ['due_date', 'dueDate'],
  ['source_ref', 'sourceRef'],
  ['phase_id', 'phaseId'],
  ['parent_todo_id', 'parentTodoId'],
  ['sort_order', 'sortOrder'],
  ['archived_at', 'archivedAt'],
] as const;

const TODO_DIRECT_FIELDS = [
  'title',
  'description',
  'category',
  'required',
  'status',
  'notes',
  'priority',
] as const;

const buildTodoBody = (
  args: Record<string, unknown> | undefined,
  {
    includeWorkspace = true,
    requireTitle = false,
  }: { includeWorkspace?: boolean; requireTitle?: boolean } = {},
): FerryProgramTodoCreateParams | FerryProgramTodoUpdateParams | undefined => {
  const body: Record<string, unknown> = includeWorkspace ? { ...readWorkspaceParams(args) } : {};
  const title = readString(args?.['title']);
  if (requireTitle && !title) return undefined;
  for (const key of TODO_DIRECT_FIELDS) {
    if (!hasOwn(args, key)) continue;
    body[key] = key === 'title' ? title : args?.[key];
  }
  for (const [inputKey, outputKey] of TODO_FIELD_MAPPINGS) {
    if (hasOwn(args, inputKey)) body[outputKey] = args?.[inputKey];
  }
  return body as FerryProgramTodoCreateParams | FerryProgramTodoUpdateParams;
};

const asRecord = (payload: unknown): Record<string, unknown> => payload as unknown as Record<string, unknown>;

const asMutationResult = (payload: unknown, message: string): ToolCallResult => ({
  content: [{ type: 'text', text: message }],
  structuredContent: asRecord(payload),
});

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
    description: 'List Ferry migration programs in the current Sanka workspace.',
    inputSchema: { type: 'object', properties: WORKSPACE_PROPERTY },
    outputSchema: PROGRAM_LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List Ferry programs',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List Ferry programs' });
    if (authError) return authError;
    const payload = await reqContext.client.public.ferryPrograms.list(readWorkspaceParams(args));
    return {
      content: [{ type: 'text', text: `Found ${payload.count} Ferry program(s).` }],
      structuredContent: asRecord(payload),
    };
  },
};

export const getFerryProgramTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'read',
    tags: ['ferry', 'programs', 'todos'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/ferry/programs/{program_id}',
    operationId: 'public.ferryPrograms.retrieve',
  },
  tool: {
    name: 'get_ferry_program',
    title: 'Get Ferry program',
    description: 'Get one Ferry migration program, including its current phases and Todos.',
    inputSchema: {
      type: 'object',
      properties: { ...PROGRAM_ID_PROPERTY, ...WORKSPACE_PROPERTY },
      required: ['program_id'],
    },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get Ferry program',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Get Ferry program' });
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    if (!programID) return asErrorResult('`program_id` is required.');
    const payload = await reqContext.client.public.ferryPrograms.retrieve(
      programID,
      readWorkspaceParams(args),
    );
    return asMutationResult(payload, `Loaded Ferry program ${payload.name || programID}.`);
  },
};

export const listFerryDocsTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'read',
    tags: ['ferry', 'programs', 'docs'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/meetings',
    operationId: 'public.ferryPrograms.docs.list',
  },
  tool: {
    name: 'list_ferry_docs',
    title: 'List Ferry Docs',
    description: 'List Docs (meeting updates) attached to a Ferry migration program.',
    inputSchema: {
      type: 'object',
      properties: { ...PROGRAM_ID_PROPERTY, ...WORKSPACE_PROPERTY },
      required: ['program_id'],
    },
    outputSchema: DOC_LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List Ferry Docs',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List Ferry Docs' });
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    if (!programID) return asErrorResult('`program_id` is required.');
    const payload = await reqContext.client.public.ferryPrograms.docs.list(
      programID,
      readWorkspaceParams(args),
    );
    return {
      content: [{ type: 'text', text: `Found ${payload.count} Ferry Doc(s).` }],
      structuredContent: asRecord(payload),
    };
  },
};

export const createFerryDocTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'write',
    tags: ['ferry', 'programs', 'docs'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/meetings',
    operationId: 'public.ferryPrograms.docs.create',
  },
  tool: {
    name: 'create_ferry_doc',
    title: 'Create Ferry Doc',
    description: 'Create a Markdown Doc (meeting update) in an existing Ferry migration program.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROGRAM_ID_PROPERTY,
        title: { type: 'string', minLength: 1, maxLength: 255 },
        meeting_at: { type: ['string', 'null'], description: 'Optional ISO date-time.' },
        content_markdown: { type: 'string', maxLength: 200000 },
        source_ref: { type: ['string', 'null'], maxLength: 500 },
        ...WORKSPACE_PROPERTY,
      },
      required: ['program_id', 'title'],
    },
    outputSchema: DOC_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create Ferry Doc',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Create Ferry Doc' });
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    if (!programID) return asErrorResult('`program_id` is required.');
    const body = buildDocBody(args, true) as FerryProgramDocCreateParams | undefined;
    if (!body) return asErrorResult('`title` is required.');
    const payload = await reqContext.client.public.ferryPrograms.docs.create(programID, body);
    return asMutationResult(payload, `Created Ferry Doc ${payload.title}.`);
  },
};

export const updateFerryDocTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'write',
    tags: ['ferry', 'programs', 'docs'],
    httpMethod: 'patch',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/meetings/{meeting_id}',
    operationId: 'public.ferryPrograms.docs.update',
  },
  tool: {
    name: 'update_ferry_doc',
    title: 'Update Ferry Doc',
    description: 'Update the title, date, Markdown content, pinned state, or archive state of a Ferry Doc.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROGRAM_ID_PROPERTY,
        ...DOC_ID_PROPERTY,
        title: { type: 'string', minLength: 1, maxLength: 255 },
        meeting_at: { type: ['string', 'null'], description: 'Optional ISO date-time.' },
        content_markdown: { type: 'string', maxLength: 200000 },
        pinned: { type: 'boolean' },
        archived_at: { type: ['string', 'null'], description: 'ISO date-time, or null to unarchive.' },
        ...WORKSPACE_PROPERTY,
      },
      required: ['program_id', 'doc_id'],
    },
    outputSchema: DOC_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update Ferry Doc',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Update Ferry Doc' });
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    const docID = readString(args?.['doc_id']);
    if (!programID) return asErrorResult('`program_id` is required.');
    if (!docID) return asErrorResult('`doc_id` is required.');
    if (hasOwn(args, 'title') && !readString(args?.['title'])) {
      return asErrorResult('`title` cannot be blank.');
    }
    const mutableKeys = ['title', 'meeting_at', 'content_markdown', 'pinned', 'archived_at'];
    if (!mutableKeys.some((key) => hasOwn(args, key))) {
      return asErrorResult('Pass at least one Ferry Doc field to update.');
    }
    const body = buildDocBody(args, false) as FerryProgramDocUpdateParams;
    const payload = await reqContext.client.public.ferryPrograms.docs.update(programID, docID, body);
    return asMutationResult(payload, `Updated Ferry Doc ${payload.title}.`);
  },
};

export const createFerryTodoTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'write',
    tags: ['ferry', 'programs', 'todos'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/todos',
    operationId: 'public.ferryPrograms.todos.create',
  },
  tool: {
    name: 'create_ferry_todo',
    title: 'Create Ferry Todo',
    description: 'Create a Todo in an existing Ferry migration program.',
    inputSchema: {
      type: 'object',
      properties: { ...PROGRAM_ID_PROPERTY, ...TODO_WRITE_PROPERTIES, ...WORKSPACE_PROPERTY },
      required: ['program_id', 'title'],
    },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create Ferry Todo',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Create Ferry Todo' });
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    if (!programID) return asErrorResult('`program_id` is required.');
    const body = buildTodoBody(args, { requireTitle: true }) as FerryProgramTodoCreateParams | undefined;
    if (!body) return asErrorResult('`title` is required.');
    const payload = await reqContext.client.public.ferryPrograms.todos.create(programID, body);
    return asMutationResult(payload, `Created a Todo in Ferry program ${payload.name || programID}.`);
  },
};

export const batchUpsertFerryTodosTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'write',
    tags: ['ferry', 'programs', 'todos'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/todos/batch-upsert',
    operationId: 'public.ferryPrograms.todos.batchUpsert',
  },
  tool: {
    name: 'batch_upsert_ferry_todos',
    title: 'Batch upsert Ferry Todos',
    description: 'Create or update up to 100 Ferry Todos. Every item must include id or source_ref.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROGRAM_ID_PROPERTY,
        todos: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: {
            type: 'object',
            properties: {
              id: { type: ['string', 'null'] },
              ...TODO_WRITE_PROPERTIES,
            },
            required: ['title'],
          },
        },
        ...WORKSPACE_PROPERTY,
      },
      required: ['program_id', 'todos'],
    },
    outputSchema: BATCH_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Batch upsert Ferry Todos',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Batch upsert Ferry Todos' });
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    if (!programID) return asErrorResult('`program_id` is required.');
    const rawTodos = args?.['todos'];
    if (!Array.isArray(rawTodos) || rawTodos.length === 0 || rawTodos.length > 100) {
      return asErrorResult('`todos` must contain between 1 and 100 items.');
    }
    const todos: FerryProgramTodoBatchUpsertItem[] = [];
    for (const rawTodo of rawTodos) {
      if (!rawTodo || typeof rawTodo !== 'object' || Array.isArray(rawTodo)) {
        return asErrorResult('Every Todo must be an object.');
      }
      const todoArgs = rawTodo as Record<string, unknown>;
      const id = readString(todoArgs['id']);
      const sourceRef = readString(todoArgs['source_ref']);
      const todo = buildTodoBody(todoArgs, { includeWorkspace: false, requireTitle: true });
      if (!todo) return asErrorResult('Every Todo requires `title`.');
      if (!id && !sourceRef) return asErrorResult('Every Todo requires `id` or `source_ref`.');
      todos.push({ ...(todo as FerryProgramTodoBatchUpsertItem), ...(id ? { id } : undefined) });
    }
    const body: FerryProgramTodoBatchUpsertParams = { todos, ...readWorkspaceParams(args) };
    const payload = await reqContext.client.public.ferryPrograms.todos.batchUpsert(programID, body);
    return asMutationResult(
      payload,
      `Upserted Ferry Todos: ${payload.createdCount} created, ${payload.updatedCount} updated.`,
    );
  },
};

export const updateFerryTodoTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'write',
    tags: ['ferry', 'programs', 'todos'],
    httpMethod: 'patch',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/todos/{todo_id}',
    operationId: 'public.ferryPrograms.todos.update',
  },
  tool: {
    name: 'update_ferry_todo',
    title: 'Update Ferry Todo',
    description: 'Update one Ferry Todo while preserving omitted fields.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROGRAM_ID_PROPERTY,
        ...TODO_ID_PROPERTY,
        ...TODO_WRITE_PROPERTIES,
        ...WORKSPACE_PROPERTY,
      },
      required: ['program_id', 'todo_id'],
    },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update Ferry Todo',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Update Ferry Todo' });
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    const todoID = readString(args?.['todo_id']);
    if (!programID) return asErrorResult('`program_id` is required.');
    if (!todoID) return asErrorResult('`todo_id` is required.');
    if (hasOwn(args, 'title') && !readString(args?.['title'])) {
      return asErrorResult('`title` cannot be blank.');
    }
    const mutableKeys = Object.keys(TODO_WRITE_PROPERTIES);
    if (!mutableKeys.some((key) => hasOwn(args, key))) {
      return asErrorResult('Pass at least one Ferry Todo field to update.');
    }
    const body = buildTodoBody(args) as FerryProgramTodoUpdateParams;
    const payload = await reqContext.client.public.ferryPrograms.todos.update(programID, todoID, body);
    return asMutationResult(payload, `Updated Ferry Todo ${todoID}.`);
  },
};

export const deleteFerryTodoTool: McpTool = {
  metadata: {
    resource: 'ferryPrograms',
    operation: 'write',
    tags: ['ferry', 'programs', 'todos'],
    httpMethod: 'delete',
    httpPath: '/api/v2/public/ferry/programs/{program_id}/todos/{todo_id}',
    operationId: 'public.ferryPrograms.todos.delete',
  },
  tool: {
    name: 'delete_ferry_todo',
    title: 'Delete Ferry Todo',
    description: 'Permanently delete one Todo from a Ferry migration program.',
    inputSchema: {
      type: 'object',
      properties: { ...PROGRAM_ID_PROPERTY, ...TODO_ID_PROPERTY, ...WORKSPACE_PROPERTY },
      required: ['program_id', 'todo_id'],
    },
    outputSchema: PROGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete Ferry Todo',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Delete Ferry Todo' });
    if (authError) return authError;
    const programID = readString(args?.['program_id']);
    const todoID = readString(args?.['todo_id']);
    if (!programID) return asErrorResult('`program_id` is required.');
    if (!todoID) return asErrorResult('`todo_id` is required.');
    const payload = await reqContext.client.public.ferryPrograms.todos.delete(
      programID,
      todoID,
      readWorkspaceParams(args),
    );
    return asMutationResult(payload, `Deleted Ferry Todo ${todoID}.`);
  },
};
