// Hand-written tools for record lists (sanka-api docs/specs/lists/lists.md) and notes on records
// (/api/v2/activities). Both route families sit outside the public developer OpenAPI contract, so
// the handlers call raw client paths, as list_company_lists does. The API applies the connected
// person's permissions: a member with own-records access can only add, remove or note records
// they can read, and list ids and record ids are workspace-scoped, so a workspace switch between
// calls finds nothing rather than writing elsewhere.
import { envelopeData, readApiFailure } from './desk-tools';
import { readRecord, readString, readStringArray } from './tool-factories';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpTool, ToolCallResult } from './types';

type ToolArgs = Record<string, unknown> | undefined;
type JsonRecord = Record<string, unknown>;

const LISTS_PATH = '/api/v2/lists';
const ACTIVITIES_PATH = '/api/v2/activities';

const LIST_PAGE_SIZE = 100;
// One reviewable change per call. Bigger changes go through the records table in Sanka
// ("select all in view", then Add to list), which shows what is selected.
export const LIST_MEMBERS_PER_CALL = 500;
// The API's own limit on the records one activity is linked to.
export const NOTE_RECORDS_PER_CALL = 50;
const NOTES_PAGE_SIZE = 50;
// Notes can be long; the text result keeps each body readable and says when it is cut.
const NOTE_BODY_PREVIEW_CHARS = 2000;

const LIST_OBJECT_TYPES: Record<string, string> = {
  contact: 'contact',
  contacts: 'contact',
  company: 'company',
  companies: 'company',
};
const NOTE_OBJECT_TYPES: Record<string, string> = {
  ...LIST_OBJECT_TYPES,
  deal: 'deal',
  deals: 'deal',
};

const readRows = (value: unknown): JsonRecord[] =>
  Array.isArray(value) ? value.map(readRecord).filter((row): row is JsonRecord => Boolean(row)) : [];

const readCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

// Ids from each key, which may hold one id or a list of ids, without repeats.
const uniqueIds = (args: ToolArgs, ...keys: string[]): string[] => [
  ...new Set(
    keys.flatMap((key) => {
      const one = readString(args?.[key]);
      return one ? [one] : readStringArray(args?.[key]);
    }),
  ),
];

const apiErrorResult = (error: unknown, lead: string): ToolCallResult | undefined => {
  const failure = readApiFailure(error);
  if (!failure || (failure.status !== undefined && failure.status >= 500)) return undefined;
  return {
    content: [{ type: 'text', text: `${lead} (${failure.code}): ${failure.message}` }],
    isError: true,
    structuredContent: {
      ok: false,
      status: 'error',
      status_code: failure.status,
      code: failure.code,
      message: failure.message,
      details: failure.details,
      ctx_id: failure.ctxID,
    },
  };
};

const withApiErrors = async (lead: string, run: () => Promise<ToolCallResult>): Promise<ToolCallResult> => {
  try {
    return await run();
  } catch (error) {
    const result = apiErrorResult(error, lead);
    if (result) return result;
    throw error;
  }
};

const listSummary = (list: JsonRecord): JsonRecord => ({
  id: readString(list['id']),
  name: readString(list['name']),
  object_type: readString(list['object_type']),
  list_type: readString(list['list_type']),
  visibility: readString(list['visibility']),
  owner: readString(readRecord(list['owner'])?.['name']),
  member_count: readCount(list['member_count']),
  can_edit_members: readRecord(list['permissions'])?.['edit_members'] === true,
});

const LIST_ID_PROPERTY = {
  type: 'string',
  description: 'A list id from list_record_lists. A list name is not accepted.',
};

const RECORD_IDS_PROPERTY = {
  type: 'array',
  items: { type: 'string' },
  minItems: 1,
  maxItems: LIST_MEMBERS_PER_CALL,
  description: `Sanka record ids of the list's object (contact ids for a contact list, company ids for a company list), at most ${LIST_MEMBERS_PER_CALL} per call.`,
};

const MEMBERSHIP_OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    list_id: { type: 'string' },
    added: { type: 'integer' },
    already_members: { type: 'integer' },
    removed: { type: 'integer' },
    not_members: { type: 'integer' },
    not_found: { type: 'integer' },
    member_count: { type: 'integer' },
  },
};

export const listRecordListsTool: McpTool = {
  metadata: {
    resource: 'records',
    operation: 'read',
    tags: ['contacts', 'companies', 'lists'],
    httpMethod: 'get',
    httpPath: LISTS_PATH,
    operationId: 'list_lists_api_v2_lists_get',
  },
  tool: {
    name: 'list_record_lists',
    title: 'List contact or company lists',
    description:
      'Find contact lists or company lists the person can see, with each list\'s id, name, owner, type and member count. A rep\'s own lists ("Own leads – <name>", "<name> – <market> – <month>") are here. Pass mine=true for only the lists they own, or search to match a name. Use the id with add_list_members, remove_list_members, or the query_records / aggregate_records filter {field: "lists", operator: "equals", value: <list id>}. member_count is the list\'s member count; no extra call is needed to count a list.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['object_type'],
      properties: {
        object_type: { type: 'string', enum: Object.keys(LIST_OBJECT_TYPES) },
        mine: { type: 'boolean', description: 'Only lists the connected person owns.' },
        search: { type: 'string', description: 'Text to match in the list name.' },
        page: { type: 'integer', minimum: 1, default: 1 },
      },
    },
    outputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        items: { type: 'array', items: { type: 'object', additionalProperties: true } },
        total: { type: 'integer' },
        page: { type: 'integer' },
        has_next: { type: 'boolean' },
      },
    },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List contact or company lists',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List contact or company lists' });
    if (authError) return authError;
    const objectType = LIST_OBJECT_TYPES[readString(args?.['object_type'])?.toLowerCase() ?? ''];
    if (!objectType) return asErrorResult('`object_type` must be contact or company.');
    const search = readString(args?.['search']);
    const page = typeof args?.['page'] === 'number' && args['page'] >= 1 ? Math.trunc(args['page']) : 1;
    return withApiErrors('Could not read lists', async () => {
      const data = envelopeData(
        await reqContext.client.get(LISTS_PATH, {
          query: {
            object_type: objectType,
            page,
            page_size: LIST_PAGE_SIZE,
            ...(args?.['mine'] === true ? { owner: 'me' } : undefined),
            ...(search ? { q: search } : undefined),
          },
        }),
      );
      const items = readRows(data['items']).map(listSummary);
      const total = readCount(data['total']);
      const noun = objectType === 'contact' ? 'contacts' : 'companies';
      const lines = items.map(
        (item) =>
          `- ${item['name']} (${item['member_count']} ${noun}, ${item['list_type']}, owner ${
            item['owner'] ?? 'none'
          }, id ${item['id']})`,
      );
      return {
        content: [
          { type: 'text', text: lines.length > 0 ? lines.join('\n') : `No ${objectType} lists were found.` },
        ],
        structuredContent: { items, total, page, has_next: page * LIST_PAGE_SIZE < total },
      };
    });
  },
};

const membershipTool = ({
  name,
  title,
  description,
  path,
  destructive,
}: {
  name: 'add_list_members' | 'remove_list_members';
  title: string;
  description: string;
  path: (listId: string) => string;
  destructive: boolean;
}): McpTool => ({
  metadata: {
    resource: 'records',
    operation: 'write',
    tags: ['contacts', 'companies', 'lists'],
    httpMethod: 'post',
    httpPath: path('{list_id}'),
    operationId: `${name}_api_v2_lists`,
  },
  tool: {
    name,
    title,
    description,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['list_id', 'record_ids'],
      properties: { list_id: LIST_ID_PROPERTY, record_ids: RECORD_IDS_PROPERTY },
    },
    outputSchema: MEMBERSHIP_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { title, readOnlyHint: false, destructiveHint: destructive, openWorldHint: false },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: title });
    if (authError) return authError;
    const listId = readString(args?.['list_id']);
    if (!listId) return asErrorResult('`list_id` is required: find it with list_record_lists.');
    const recordIds = uniqueIds(args, 'record_ids');
    if (recordIds.length === 0) return asErrorResult('`record_ids` needs at least one record id.');
    if (recordIds.length > LIST_MEMBERS_PER_CALL) {
      return asErrorResult(
        `Pass at most ${LIST_MEMBERS_PER_CALL} record ids per call; nothing was changed. For a bigger change, select the records in the Sanka records table and use Add to list or Remove from list there.`,
      );
    }
    return withApiErrors(`${title} failed`, async () => {
      const data = envelopeData(
        await reqContext.client.post(path(listId), { body: { selection: { ids: recordIds } } }),
      );
      const result = {
        list_id: readString(data['list_id']) ?? listId,
        added: readCount(data['added']),
        already_members: readCount(data['already_members']),
        removed: readCount(data['removed']),
        not_members: readCount(data['not_members']),
        not_found: readCount(data['not_found']),
        member_count: readCount(data['member_count']),
      };
      const notFound =
        result.not_found > 0 ?
          ` ${result.not_found} were not found or are not records the person can see, and were skipped.`
        : '';
      const text =
        name === 'add_list_members' ?
          `Added ${result.added} to the list; ${result.already_members} were already members.${notFound} The list now has ${result.member_count} members.`
        : `Removed ${result.removed} from the list; ${result.not_members} were not members.${notFound} The list now has ${result.member_count} members. The list history keeps who removed them, and they can be added again.`;
      return { content: [{ type: 'text', text }], structuredContent: result };
    });
  },
});

export const addListMembersTool = membershipTool({
  name: 'add_list_members',
  title: 'Add records to a list',
  description: `Add contacts to a contact list, or companies to a company list, by record id (find the list with list_record_lists). Works on static lists only; a dynamic list follows its filters. Records the person cannot see are skipped and counted as not_found, and records already on the list are counted as already_members, so a repeated call adds nothing twice. At most ${LIST_MEMBERS_PER_CALL} ids per call: for more, tell the person to select the records in the Sanka records table and use Add to list.`,
  path: (listId) => `${LISTS_PATH}/${encodeURIComponent(listId)}/members`,
  destructive: false,
});

export const removeListMembersTool = membershipTool({
  name: 'remove_list_members',
  title: 'Remove records from a list',
  description: `Take contacts or companies off a static list by record id. The records themselves are not changed or deleted, and the list history keeps who removed them, so they can be added back. Remove only the records the person named or agreed to; read the members with query_records and the filter {field: "lists", operator: "equals", value: <list id>} and confirm before removing many. At most ${LIST_MEMBERS_PER_CALL} ids per call.`,
  path: (listId) => `${LISTS_PATH}/${encodeURIComponent(listId)}/members/remove`,
  destructive: true,
});

const noteObjectType = (args: ToolArgs): string | undefined =>
  NOTE_OBJECT_TYPES[readString(args?.['object_type'])?.toLowerCase() ?? ''];

const noteSummary = (note: JsonRecord): JsonRecord => {
  const body = readString(note['body']) ?? '';
  return {
    id: readString(note['id']),
    title: readString(note['title']),
    body: body.slice(0, NOTE_BODY_PREVIEW_CHARS),
    ...(body.length > NOTE_BODY_PREVIEW_CHARS ? { body_truncated: true } : undefined),
    occurred_at: readString(note['occurred_at']),
    owner: readString(readRecord(note['owner'])?.['name']),
    created_by: readString(readRecord(note['created_by'])?.['name']),
    linked_records: readRows(note['links']).length,
  };
};

export const createNoteTool: McpTool = {
  metadata: {
    resource: 'records',
    operation: 'write',
    tags: ['contacts', 'companies', 'deals', 'activities'],
    httpMethod: 'post',
    httpPath: ACTIVITIES_PATH,
    operationId: 'create_activity_api_v2_activities_post',
  },
  tool: {
    name: 'create_note',
    title: 'Add a note to records',
    description: `Add a note to the activity timeline of one or more contacts, companies or deals, as the connected person (they become the note's owner and author). One call writes one note that appears on every record in record_ids (at most ${NOTE_RECORDS_PER_CALL}), so the same note for many records is one call. The person must be able to edit at least one of the records and see all of them. A note is free text: for a value people will filter or count by (a source, a date, a yes/no check), a property set with update_contact or update_company is the better place; say so if the person asks for that. Write only what the person asked to record.`,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['object_type', 'body'],
      properties: {
        object_type: { type: 'string', enum: Object.keys(NOTE_OBJECT_TYPES) },
        record_id: { type: 'string', description: 'One record id. Pass record_id or record_ids.' },
        record_ids: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: NOTE_RECORDS_PER_CALL,
          description: `Record ids that all get this note, at most ${NOTE_RECORDS_PER_CALL}.`,
        },
        title: { type: 'string', maxLength: 500, description: 'Optional short title.' },
        body: { type: 'string', minLength: 1, description: 'The note text.' },
      },
    },
    outputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: { note: { type: 'object', additionalProperties: true } },
    },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Add a note to records',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Add a note to records' });
    if (authError) return authError;
    const objectType = noteObjectType(args);
    if (!objectType) return asErrorResult('`object_type` must be contact, company or deal.');
    const body = readString(args?.['body']);
    if (!body) return asErrorResult('`body` is required.');
    const recordIds = uniqueIds(args, 'record_id', 'record_ids');
    if (recordIds.length === 0) return asErrorResult('Pass `record_id` or `record_ids`.');
    if (recordIds.length > NOTE_RECORDS_PER_CALL) {
      return asErrorResult(
        `One note can be on at most ${NOTE_RECORDS_PER_CALL} records; nothing was written. Split the records into groups the person agrees to.`,
      );
    }
    const title = readString(args?.['title']);
    return withApiErrors('Could not add the note', async () => {
      const note = envelopeData(
        await reqContext.client.post(ACTIVITIES_PATH, {
          body: {
            activity_type: 'note',
            ...(title ? { title } : undefined),
            body,
            links: recordIds.map((recordId) => ({ object_type: objectType, record_id: recordId })),
          },
        }),
      );
      const summary = noteSummary(note);
      return {
        content: [
          {
            type: 'text',
            text: `Added note ${summary['id']} to ${recordIds.length} ${objectType} record${
              recordIds.length === 1 ? '' : 's'
            }.`,
          },
        ],
        structuredContent: { note: summary },
      };
    });
  },
};

export const listNotesTool: McpTool = {
  metadata: {
    resource: 'records',
    operation: 'read',
    tags: ['contacts', 'companies', 'deals', 'activities'],
    httpMethod: 'get',
    httpPath: ACTIVITIES_PATH,
    operationId: 'list_activities_api_v2_activities_get',
  },
  tool: {
    name: 'list_notes',
    title: 'List notes on a record',
    description:
      'Read the notes on one contact, company or deal, newest first, with who wrote each one. Calls, e-mails and meetings are not included.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['object_type', 'record_id'],
      properties: {
        object_type: { type: 'string', enum: Object.keys(NOTE_OBJECT_TYPES) },
        record_id: { type: 'string' },
        page: { type: 'integer', minimum: 1, default: 1 },
      },
    },
    outputSchema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        items: { type: 'array', items: { type: 'object', additionalProperties: true } },
        total: { type: 'integer' },
        page: { type: 'integer' },
        has_next: { type: 'boolean' },
      },
    },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List notes on a record',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List notes on a record' });
    if (authError) return authError;
    const objectType = noteObjectType(args);
    if (!objectType) return asErrorResult('`object_type` must be contact, company or deal.');
    const recordId = readString(args?.['record_id']);
    if (!recordId) return asErrorResult('`record_id` is required.');
    const page = typeof args?.['page'] === 'number' && args['page'] >= 1 ? Math.trunc(args['page']) : 1;
    return withApiErrors('Could not read notes', async () => {
      const data = envelopeData(
        await reqContext.client.get(ACTIVITIES_PATH, {
          query: {
            object_type: objectType,
            record_id: recordId,
            type: 'note',
            page,
            page_size: NOTES_PAGE_SIZE,
          },
        }),
      );
      const items = readRows(data['items']).map(noteSummary);
      const total = readCount(data['total']);
      const lines = items.map(
        (item) =>
          `- ${item['occurred_at'] ?? '?'} by ${item['created_by'] ?? item['owner'] ?? '?'}${
            item['title'] ? ` "${item['title']}"` : ''
          }: ${item['body']}${item['body_truncated'] ? ' …' : ''}`,
      );
      return {
        content: [{ type: 'text', text: lines.length > 0 ? lines.join('\n') : 'This record has no notes.' }],
        structuredContent: { items, total, page, has_next: page * NOTES_PAGE_SIZE < total },
      };
    });
  },
};

export const recordListTools: McpTool[] = [
  listRecordListsTool,
  addListMembersTool,
  removeListMembersTool,
  createNoteTool,
  listNotesTool,
];
