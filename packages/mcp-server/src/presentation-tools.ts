// Sanka Doc presentations: slide decks in a Sanka migration program's Docs (with program_id) or in
// Sanka Flow Docs (without). The routes are internal V2 routes, so the tools call them through the
// raw client and unwrap the V2 envelope here. Deck, op and export validation belongs to the API.
import { configuredAppBaseUrl } from './record-url-enrichment';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpRequestContext, McpTool, ToolCallResult } from './types';

type ToolArgs = Record<string, unknown> | undefined;
type JsonRecord = Record<string, unknown>;

const CATALOG_PATH = '/api/v2/presentations/catalog';
const FLOW_PATH = '/api/v2/documents/presentations';
const PROGRAM_PATH = '/api/v2/ferry/programs/{program_id}/presentations';
const SESSION_PATH = '/api/v2/auth/session';
const DEFAULT_APP_ORIGIN = 'https://app.sanka.com';
const DECK_SCHEMA = 'sanka.deck/v1';
const WORKSPACE_MISMATCH = 'WORKSPACE_CONTEXT_MISMATCH';
const REVISION_CONFLICT = 'PRESENTATION_REVISION_CONFLICT';
const MAX_LISTED = 10;
const EXPORTS_IN_PROGRESS = ['queued', 'rendering', 'writing', 'uploading'];

const OPS = [
  'insert_slides',
  'replace_slide',
  'update_slide',
  'delete_slides',
  'move_slides',
  'insert_blocks',
  'update_block',
  'replace_block',
  'delete_blocks',
  'move_block',
  'set_theme',
  'set_title',
  'set_footer',
];

const PROGRAM_ID_PROPERTY = {
  program_id: {
    type: 'string',
    minLength: 1,
    description:
      "Sanka program UUID when the deck belongs to a migration program's Docs. Omit it for Sanka Flow Docs, and pass the same value on every call for one deck.",
  },
};

const PRESENTATION_ID_PROPERTY = {
  presentation_id: {
    type: 'string',
    minLength: 1,
    description: 'presentation_id from create_presentation or get_presentation.',
  },
};

const EXPECTED_WORKSPACE_PROPERTY = {
  expected_workspace_id: {
    type: 'string',
    minLength: 1,
    pattern: '\\S',
    description:
      'Internal workspace UUID from current_workspace, not the short workspace code. The write stops and changes nothing when the request resolves to another workspace (WORKSPACE_CONTEXT_MISMATCH).',
  },
};

const TITLE_SCHEMA = { type: 'string', minLength: 1, maxLength: 255 };

const CATALOG_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {},
  additionalProperties: false,
};

const CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...PROGRAM_ID_PROPERTY,
    title: { ...TITLE_SCHEMA, description: 'Deck title, shown in Docs.' },
    slides: {
      type: 'array',
      minItems: 1,
      maxItems: 200,
      items: { type: 'object' },
      description:
        'Slides in order, written to the slide schema from get_presentation_catalog (layout, blocks, notes, hidden). Start each slide with a heading block that states its point. Omit ids; the API assigns them. Omit slides to start with one title slide.',
    },
    theme: {
      type: 'object',
      properties: { id: { type: 'string', minLength: 1 }, version: { type: 'integer', minimum: 1 } },
      required: ['id'],
      description: 'Theme from the catalog, such as {"id": "sanka-paper"} (the default). Needs slides.',
    },
    footer: {
      type: 'object',
      properties: { pageNumbers: { type: 'boolean' }, text: { type: 'string', maxLength: 120 } },
      description:
        'Footer on every slide: page numbers and a short text such as a client name. Needs slides.',
    },
    source_ref: {
      type: 'string',
      minLength: 1,
      maxLength: 500,
      description:
        'Stable key for this deck, such as weekly-2026-10-08. Creating again with the same source_ref returns the existing presentation instead of a copy.',
    },
    ...EXPECTED_WORKSPACE_PROPERTY,
  },
  required: ['title', 'expected_workspace_id'],
  additionalProperties: false,
};

const GET_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...PRESENTATION_ID_PROPERTY,
    ...PROGRAM_ID_PROPERTY,
    include: {
      type: 'string',
      enum: ['deck', 'outline'],
      default: 'deck',
      description:
        'deck (the default): the full deck JSON with the slide and block ids that ops use. outline: a short Markdown outline.',
    },
  },
  required: ['presentation_id'],
  additionalProperties: false,
};

const UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...PRESENTATION_ID_PROPERTY,
    ...PROGRAM_ID_PROPERTY,
    expected_revision: {
      type: 'integer',
      minimum: 1,
      description: 'Revision from your last get_presentation or write of this deck.',
    },
    ops: {
      type: 'array',
      minItems: 1,
      maxItems: 200,
      items: { type: 'object', properties: { op: { type: 'string', enum: OPS } }, required: ['op'] },
      description:
        'Edits applied in order, all or nothing, with camelCase fields and ids from get_presentation: insert_slides {after?, slides}, replace_slide {slideId, slide}, update_slide {slideId, set}, delete_slides {slideIds}, move_slides {slideIds, after?}, insert_blocks {slideId, after?, blocks}, update_block {slideId, blockId, set}, replace_block {slideId, blockId, block}, delete_blocks {slideId, blockIds}, move_block {blockId, toSlideId, after?}, set_theme {theme}, set_title {title}, set_footer {footer}. after is the slide or block to follow: null puts it first, omitted appends.',
    },
    deck: {
      type: 'object',
      description:
        'A whole replacement deck (sanka.deck/v1, as get_presentation returns it). It replaces every slide, so prefer ops.',
    },
    title: { ...TITLE_SCHEMA, description: 'New deck title.' },
    ...EXPECTED_WORKSPACE_PROPERTY,
  },
  required: ['presentation_id', 'expected_revision', 'expected_workspace_id'],
  additionalProperties: false,
};

const EXPORT_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...PRESENTATION_ID_PROPERTY,
    ...PROGRAM_ID_PROPERTY,
    format: { type: 'string', enum: ['pptx'], default: 'pptx', description: 'pptx: a PowerPoint file.' },
    slide_ids: {
      type: 'array',
      minItems: 1,
      maxItems: 200,
      items: { type: 'string', minLength: 1 },
      description: 'Export only these slides, by id from get_presentation.',
    },
    include_hidden: { type: 'boolean', description: 'Also export hidden slides.' },
    include_notes: { type: 'boolean', description: 'false leaves speaker notes out of the file.' },
    idempotency_key: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      description:
        'Stable key for this export, sent as Idempotency-Key. Retrying with the same key returns the same export; a new key starts another one.',
    },
    ...EXPECTED_WORKSPACE_PROPERTY,
  },
  required: ['presentation_id', 'idempotency_key', 'expected_workspace_id'],
  additionalProperties: false,
};

const EXPORT_STATUS_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...PRESENTATION_ID_PROPERTY,
    ...PROGRAM_ID_PROPERTY,
    export_id: { type: 'string', minLength: 1, description: 'export_id from export_presentation.' },
  },
  required: ['presentation_id', 'export_id'],
  additionalProperties: false,
};

// Clients validate structuredContent, error results included, against these: keep them permissive.
const OBJECT_SCHEMA = { type: 'object', additionalProperties: true };
const ARRAY_OF_OBJECTS_SCHEMA = { type: 'array', items: OBJECT_SCHEMA };
const NULLABLE_STRING_SCHEMA = { type: ['string', 'null'] };

const PRESENTATION_PROPERTIES = {
  presentation_id: { type: 'string' },
  title: { type: 'string' },
  revision: { type: 'integer' },
  product: { type: 'string', description: 'sanka (a migration program Doc) or flow (a Sanka Flow Doc).' },
  program_id: NULLABLE_STRING_SCHEMA,
  slide_count: { type: 'integer' },
  app_url: { type: 'string', description: 'The Docs page with the deck open.' },
  warnings: ARRAY_OF_OBJECTS_SCHEMA,
};

const PRESENTATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: PRESENTATION_PROPERTIES,
  additionalProperties: true,
};

const PRESENTATION_READ_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...PRESENTATION_PROPERTIES,
    updated_via: { type: 'string' },
    updated_at: NULLABLE_STRING_SCHEMA,
    deck: OBJECT_SCHEMA,
    outline: { type: 'string' },
  },
  additionalProperties: true,
};

const EXPORT_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    export_id: { type: 'string' },
    presentation_id: { type: 'string' },
    status: { type: 'string' },
    progress: { type: 'number' },
    revision: { type: 'integer' },
    filename: NULLABLE_STRING_SCHEMA,
    error_code: NULLABLE_STRING_SCHEMA,
    error_message: NULLABLE_STRING_SCHEMA,
    app_download_url: {
      type: 'string',
      description: 'Download link for a browser signed in to Sanka; set once the export is completed.',
    },
  },
  additionalProperties: true,
};

const CATALOG_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    layouts: ARRAY_OF_OBJECTS_SCHEMA,
    blocks: ARRAY_OF_OBJECTS_SCHEMA,
    themes: ARRAY_OF_OBJECTS_SCHEMA,
    limits: OBJECT_SCHEMA,
    guidance: { type: 'array', items: { type: 'string' } },
    deckJsonSchema: OBJECT_SCHEMA,
    example: OBJECT_SCHEMA,
  },
  additionalProperties: true,
};

const readString = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const readBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

const readObject = (value: unknown): JsonRecord | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : undefined;

const readArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const readObjects = (value: unknown): JsonRecord[] =>
  readArray(value)
    .map(readObject)
    .filter((entry): entry is JsonRecord => Boolean(entry));

// Results and bodies carry only the keys that have a value.
const defined = (entries: JsonRecord): JsonRecord =>
  Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined));

const plural = (count: unknown, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

// A deck in a Sanka program's Docs when program_id is given, else in Sanka Flow Docs.
const presentationsPath = (args: ToolArgs): string => {
  const programID = readString(args?.['program_id']);
  return programID ? PROGRAM_PATH.replace('{program_id}', encodeURIComponent(programID)) : FLOW_PATH;
};

const presentationPath = (args: ToolArgs): string =>
  `${presentationsPath(args)}/${encodeURIComponent(readString(args?.['presentation_id']) ?? '')}`;

// Internal V2 routes answer with the envelope { success, data, meta }.
const unwrap = (payload: unknown): JsonRecord => {
  const envelope = readObject(payload) ?? {};
  return readObject(envelope['data']) ?? envelope;
};

// App links use the origin configured for record links, else the Sanka app.
const appUrl = (path: unknown): string | undefined => {
  const value = readString(path);
  if (!value || /^https?:\/\//i.test(value)) return value;
  return `${configuredAppBaseUrl() ?? DEFAULT_APP_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`;
};

// A workspace mismatch found before sending is reported exactly like the API's 409.
const workspaceMismatch = (details: JsonRecord): Error => {
  const message = 'The intended workspace does not match the workspace resolved for this request.';
  return Object.assign(new Error(message), { error: { code: WORKSPACE_MISMATCH, message, details } });
};

// Writes name their workspace. Like the workflow tools, the tool checks it before sending anything,
// and the API checks the X-Sanka-Expected-Workspace-ID header again on the write itself.
// /auth/session resolves the workspace the same way as these internal routes.
const write = async (
  reqContext: McpRequestContext,
  args: ToolArgs,
  method: 'post' | 'put' | 'patch',
  path: string,
  body: JsonRecord,
  headers: Record<string, string> = {},
): Promise<JsonRecord> => {
  const expected = readString(args?.['expected_workspace_id']) ?? '';
  const current = readObject(unwrap(await reqContext.client.get(SESSION_PATH))['current_workspace']);
  if (readString(current?.['id']) !== expected) {
    throw workspaceMismatch({
      expected_workspace_id: expected,
      current_workspace_id: readString(current?.['id']) ?? null,
      current_workspace_code: readString(current?.['code']) ?? null,
    });
  }
  return unwrap(
    await reqContext.client[method](path, {
      body,
      headers: { ...headers, 'X-Sanka-Expected-Workspace-ID': expected },
      maxRetries: 0,
    }),
  );
};

type Failure = { code: string; message: string; details: JsonRecord; status?: number; ctxID?: string };

// An SDK APIError carries the V2 envelope as `error`, and the envelope its `error` body.
const readFailure = (error: unknown): Failure | undefined => {
  const layers: JsonRecord[] = [];
  for (let layer = readObject(error); layer && layers.length < 3; layer = readObject(layer['error'])) {
    layers.push(layer);
  }
  const body = layers.find((layer) => readString(layer['code']) && readString(layer['message']));
  if (!body) return undefined;
  const status = layers.map((layer) => layer['status']).find((value) => typeof value === 'number');
  const ctxID = layers.map((layer) => readString(readObject(layer['meta'])?.['ctx_id'])).find(Boolean);
  return {
    code: readString(body['code']) ?? '',
    message: readString(body['message']) ?? '',
    details: readObject(body['details']) ?? {},
    ...(typeof status === 'number' ? { status } : undefined),
    ...(ctxID ? { ctxID } : undefined),
  };
};

const sentence = (text: string): string => (/[.!?。]$/.test(text) ? text : `${text}.`);

const POINTER_HINT =
  'Paths are JSON Pointers: /deck/... and /ops/... point into your request, /slides/... into the deck after your ops.';

const listProblems = (details: JsonRecord): string => {
  const problems = readObjects(details['errors']).map(
    (problem) => `${readString(problem['path']) ?? '/'}: ${readString(problem['message']) ?? 'invalid'}`,
  );
  if (problems.length === 0) return '';
  const listed = problems.slice(0, MAX_LISTED).join('; ');
  const more = problems.length > MAX_LISTED ? `; ${problems.length - MAX_LISTED} more` : '';
  return ` Fix: ${listed}${more}. ${POINTER_HINT}`;
};

const failureHint = ({ code, status, details }: Failure): string => {
  switch (code) {
    case REVISION_CONFLICT:
      return ` The deck is at revision ${details['currentRevision']} now. Call get_presentation, then re-apply only your intended change with expected_revision ${details['currentRevision']}.`;
    case 'PRESENTATION_INVALID':
    case 'PRESENTATION_LIMIT_EXCEEDED':
      return listProblems(details);
    case 'PRESENTATION_OP_TARGET_NOT_FOUND': {
      const missing =
        details['opIndex'] !== undefined ?
          `ops[${details['opIndex']}] names ${details['id']}`
        : `slide_ids ${readArray(details['slideIds']).join(', ')}`;
      return ` ${missing}: not in the deck. Read the current ids with get_presentation.`;
    }
    case 'DOCUMENT_KIND_MISMATCH':
      return ' That id or source_ref belongs to a Markdown Doc, not a presentation; use the Docs tools for it.';
    case 'IDEMPOTENCY_KEY_REUSED':
      return ' Use a new idempotency_key for this presentation.';
    case 'RATE_LIMITED':
      return ` Wait ${details['retryAfterSeconds'] ?? 60} seconds before trying again.`;
  }
  if (status === 404) {
    return " Check the ids, and pass program_id for a deck in a Sanka program's Docs or omit it for Sanka Flow Docs.";
  }
  if (status === 403) {
    return ' Presentations may be off for this workspace, or the user cannot use these Docs.';
  }
  return '';
};

const workspaceMismatchText = (details: JsonRecord): string => {
  const expected = readString(details['expected_workspace_id']);
  const id = readString(details['current_workspace_id']);
  const code = readString(details['current_workspace_code']);
  const current =
    id && code ? `workspace ${code} (${id})`
    : id ? `workspace ${id}`
    : 'no workspace';
  return [
    `this request resolves to ${current}, not ${expected}.`,
    'Call current_workspace, confirm the workspace with the user, then retry with its workspace_id as expected_workspace_id.',
    'Never retry in another workspace.',
  ].join(' ');
};

const failureResult = (error: unknown, prefix: string): ToolCallResult | undefined => {
  const failure = readFailure(error);
  // Server and transport errors fall through to the server's generic error result.
  if (!failure || (failure.status ?? 0) >= 500) return undefined;
  const { code, message, details, status, ctxID } = failure;
  const mismatch = code === WORKSPACE_MISMATCH;
  return {
    content: [
      {
        type: 'text',
        text:
          mismatch ?
            `Nothing was changed (${code}): ${workspaceMismatchText(details)}`
          : `${prefix} (${code}): ${sentence(message)}${failureHint(failure)}`,
      },
    ],
    isError: true,
    structuredContent: defined({
      ok: false,
      status: 'error',
      status_code: status,
      code,
      error: mismatch ? code : undefined,
      message,
      details,
      current_revision: code === REVISION_CONFLICT ? details['currentRevision'] : undefined,
      ctx_id: ctxID,
    }),
  };
};

type PresentationToolDefinition = {
  name: string;
  title: string;
  description: string;
  operation: 'read' | 'write';
  httpMethod: 'get' | 'post' | 'put' | 'patch';
  httpPath: string;
  inputSchema: McpTool['tool']['inputSchema'];
  outputSchema: McpTool['tool']['outputSchema'];
  run: (reqContext: McpRequestContext, args: ToolArgs) => Promise<ToolCallResult>;
};

const definePresentationTool = (definition: PresentationToolDefinition): McpTool => {
  const properties = readObject(definition.inputSchema.properties) ?? {};
  const requiredText = (definition.inputSchema.required ?? []).filter(
    (key) => readObject(properties[key])?.['type'] === 'string',
  );
  return {
    metadata: {
      resource: 'presentations',
      operation: definition.operation,
      tags: ['docs', 'presentations'],
      httpMethod: definition.httpMethod,
      httpPath: definition.httpPath,
      operationId: `presentations.${definition.name}`,
    },
    tool: {
      name: definition.name,
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
      securitySchemes: [{ type: 'oauth2' }],
      annotations: {
        title: definition.title,
        readOnlyHint: definition.operation === 'read',
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    handler: async ({ reqContext, args }) => {
      const authError = requireAuthentication({ reqContext, toolTitle: definition.title });
      if (authError) return authError;
      const missing = requiredText.filter((key) => !readString(args?.[key]));
      if (missing.length > 0) {
        return asErrorResult(`Pass ${missing.map((key) => `\`${key}\``).join(' and ')}. Nothing was sent.`);
      }
      try {
        return await definition.run(reqContext, args);
      } catch (error) {
        const prefix =
          definition.operation === 'write' ?
            'Nothing was changed'
          : `Could not ${definition.title.toLowerCase()}`;
        const result = failureResult(error, prefix);
        if (result) return result;
        throw error;
      }
    },
  };
};

const presentationSummary = (presentation: JsonRecord): JsonRecord =>
  defined({
    presentation_id: presentation['id'],
    title: presentation['title'],
    revision: presentation['revision'],
    product: presentation['product'],
    program_id: presentation['programId'] ?? null,
    slide_count: presentation['slideCount'],
    app_url: appUrl(presentation['appPath']),
    warnings: readArray(presentation['warnings']),
  });

const describePresentation = (summary: JsonRecord): string[] => {
  const size = `${plural(summary['slide_count'], 'slide')}, revision ${summary['revision']}`;
  return [
    `"${summary['title']}" (${size}): presentation_id ${summary['presentation_id']}.`,
    ...(summary['app_url'] ? [`Open it at ${summary['app_url']}`] : []),
  ];
};

const describeWarnings = (warnings: unknown): string[] => {
  const entries = readObjects(warnings);
  return entries.length === 0 ?
      []
    : [
        'Warnings to fix (paths are JSON Pointers into the deck):',
        ...entries
          .slice(0, MAX_LISTED)
          .map((warning) => `- ${warning['path'] ?? '/'}: ${warning['message'] ?? ''} (${warning['code']})`),
      ];
};

const writeResult = (verb: string, presentation: JsonRecord): ToolCallResult => {
  const summary = presentationSummary(presentation);
  const [first = '', ...rest] = describePresentation(summary);
  return {
    content: [
      {
        type: 'text',
        text: [`${verb} presentation ${first}`, ...rest, ...describeWarnings(summary['warnings'])].join('\n'),
      },
    ],
    structuredContent: summary,
  };
};

const exportSummary = (exportData: JsonRecord, args: ToolArgs): JsonRecord =>
  defined({
    export_id: exportData['id'],
    presentation_id: exportData['documentId'] ?? readString(args?.['presentation_id']),
    program_id: readString(args?.['program_id']),
    status: exportData['status'],
    progress: exportData['progress'],
    revision: exportData['revision'],
    format: exportData['format'],
    filename: exportData['filename'],
    size_bytes: exportData['sizeBytes'],
    warnings: readArray(exportData['warnings']),
    error_code: exportData['errorCode'],
    error_message: exportData['errorMessage'],
    expires_at: exportData['expiresAt'],
    app_download_url: exportData['status'] === 'completed' ? appUrl(exportData['downloadPath']) : undefined,
  });

const describeExport = (summary: JsonRecord): string => {
  const exportID = summary['export_id'];
  const status = String(summary['status']);
  if (status === 'completed') {
    const size = `${summary['size_bytes'] ?? '?'} bytes, revision ${summary['revision']}`;
    const file = `${summary['filename'] ?? 'the file'} (${size})`;
    const link = summary['app_download_url'] ?? 'the presentation in Sanka';
    const until = summary['expires_at'] ? ` until ${summary['expires_at']}` : '';
    return [
      `Export ${exportID} is completed: ${file}.`,
      `It downloads from ${link} in a browser signed in to Sanka${until}.`,
      "Give the user this link and the presentation's app_url.",
    ].join(' ');
  }
  if (EXPORTS_IN_PROGRESS.includes(status)) {
    const program = summary['program_id'] ? `, program_id ${summary['program_id']}` : '';
    const ids = `presentation_id ${summary['presentation_id']}${program} and export_id ${exportID}`;
    return [
      `Export ${exportID} is ${status} (${summary['progress'] ?? 0}%).`,
      `Call get_presentation_export with ${ids} again in a few seconds, until it is completed.`,
    ].join(' ');
  }
  const code = summary['error_code'] ? ` (${summary['error_code']})` : '';
  const reason = summary['error_message'] ?? 'no file was produced';
  return `Export ${exportID} ${status}${code}: ${reason}. Fix the cause, then start a new export with a new idempotency_key.`;
};

const exportResult = (exportData: JsonRecord, args: ToolArgs): ToolCallResult => {
  const summary = exportSummary(exportData, args);
  return { content: [{ type: 'text', text: describeExport(summary) }], structuredContent: summary };
};

const describeCatalog = (catalog: JsonRecord): string => {
  const list = (key: string, describe: (entry: JsonRecord) => string): string =>
    readObjects(catalog[key]).map(describe).join(', ');
  const layout = (entry: JsonRecord) => `${entry['id']}${entry['needsAccent'] ? ' (needs an accent)' : ''}`;
  const theme = (entry: JsonRecord) => `${entry['id']}${entry['version'] ? ` v${entry['version']}` : ''}`;
  const limits = Object.entries(readObject(catalog['limits']) ?? {}).map(([key, value]) => `${key} ${value}`);
  const versions = readArray(catalog['schemaVersions']).join(', ') || DECK_SCHEMA;
  return [
    `Presentation catalog for ${versions} decks.`,
    `Layouts: ${list('layouts', layout)}.`,
    `Blocks: ${list('blocks', (block) => String(block['type']))}.`,
    `Themes: ${list('themes', theme)}.`,
    ...(limits.length > 0 ? [`Limits: ${limits.join(', ')}.`] : []),
    'Guidance:',
    ...readArray(catalog['guidance']).map((line) => `- ${line}`),
    "structuredContent has each block's JSON Schema and recommended lengths, the deck JSON Schema and an example deck.",
  ].join('\n');
};

export const getPresentationCatalogTool = definePresentationTool({
  name: 'get_presentation_catalog',
  title: 'Get presentation catalog',
  description:
    'Read what a Sanka Doc presentation can contain: the 16:9 layouts, the slide blocks with their JSON Schemas and recommended lengths, themes, limits, authoring guidance, the deck JSON Schema and an example deck. Call it once per session before creating or editing presentations, and use only what it lists.',
  operation: 'read',
  httpMethod: 'get',
  httpPath: CATALOG_PATH,
  inputSchema: CATALOG_INPUT_SCHEMA,
  outputSchema: CATALOG_OUTPUT_SCHEMA,
  run: async (reqContext) => {
    const catalog = unwrap(await reqContext.client.get(CATALOG_PATH));
    return { content: [{ type: 'text', text: describeCatalog(catalog) }], structuredContent: catalog };
  },
});

export const createPresentationTool = definePresentationTool({
  name: 'create_presentation',
  title: 'Create presentation',
  description:
    "Create a presentation (slide deck) in Sanka Docs: pass program_id for a migration program's Docs, or omit it for Sanka Flow Docs. Call get_presentation_catalog first and plan the outline: one message per slide, a title that states the point, at most 6 bullets. Keep supplied facts and numbers exact and never invent figures; write Japanese decks in です・ます. Then read the deck back with get_presentation. Needs expected_workspace_id from current_workspace.",
  operation: 'write',
  httpMethod: 'post',
  httpPath: FLOW_PATH,
  inputSchema: CREATE_INPUT_SCHEMA,
  outputSchema: PRESENTATION_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const slides = args?.['slides'];
    const theme = readObject(args?.['theme']);
    const footer = readObject(args?.['footer']);
    if (!Array.isArray(slides) && (theme || footer)) {
      return asErrorResult(
        'Pass `slides` with `theme` or `footer`, or set them after creating with update_presentation ops set_theme and set_footer. Nothing was sent.',
      );
    }
    const deck =
      Array.isArray(slides) ?
        defined({ schema: DECK_SCHEMA, page: { size: '16:9' }, theme, footer, slides })
      : undefined;
    const presentation = await write(
      reqContext,
      args,
      'post',
      presentationsPath(args),
      defined({ title: readString(args?.['title']), deck, sourceRef: readString(args?.['source_ref']) }),
    );
    return writeResult('Created', presentation);
  },
});

export const getPresentationTool = definePresentationTool({
  name: 'get_presentation',
  title: 'Get presentation',
  description:
    "Read a presentation: its revision, slide count, app_url and, by default, the full deck JSON with the slide and block ids that update_presentation ops use (include=outline returns a short Markdown outline instead). Pass the deck's program_id for a migration program's Docs; omit it for Sanka Flow Docs. Read the deck again before editing one that people may have changed.",
  operation: 'read',
  httpMethod: 'get',
  httpPath: `${FLOW_PATH}/{presentation_id}`,
  inputSchema: GET_INPUT_SCHEMA,
  outputSchema: PRESENTATION_READ_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const presentation = unwrap(await reqContext.client.get(presentationPath(args)));
    const outline = args?.['include'] === 'outline';
    const summary = {
      ...presentationSummary(presentation),
      ...defined({
        updated_via: presentation['updatedVia'],
        updated_at: presentation['updatedAt'],
        ...(outline ? { outline: presentation['outline'] } : { deck: presentation['deck'] }),
      }),
    };
    const updatedAt = summary['updated_at'] ? ` at ${summary['updated_at']}` : '';
    const updated = summary['updated_via'] ? [`Last updated via ${summary['updated_via']}${updatedAt}.`] : [];
    const body =
      outline ?
        String(summary['outline'] ?? '')
      : `structuredContent.deck holds the slides with their slide and block ids; pass revision ${summary['revision']} as expected_revision to update_presentation.`;
    const text = [`Presentation ${describePresentation(summary).join('\n')}`, ...updated, body].join('\n');
    return { content: [{ type: 'text', text }], structuredContent: summary };
  },
});

export const updatePresentationTool = definePresentationTool({
  name: 'update_presentation',
  title: 'Update presentation',
  description:
    'Edit a presentation at the revision you last read: pass ops for targeted edits (preferred) or deck to replace the whole deck, and optionally a new title. On PRESENTATION_REVISION_CONFLICT nothing changed: call get_presentation and re-apply only your intended change with the new revision. Do not delete slides you did not create unless the user asks. Needs expected_workspace_id from current_workspace.',
  operation: 'write',
  httpMethod: 'patch',
  httpPath: `${FLOW_PATH}/{presentation_id}`,
  inputSchema: UPDATE_INPUT_SCHEMA,
  outputSchema: PRESENTATION_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const expectedRevision = args?.['expected_revision'];
    const rawOps = args?.['ops'];
    const ops = Array.isArray(rawOps) && rawOps.length > 0 ? rawOps : undefined;
    const deck = readObject(args?.['deck']);
    const title = readString(args?.['title']);
    if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
      return asErrorResult('`expected_revision` must be the revision you last read. Nothing was sent.');
    }
    if (ops && deck) return asErrorResult('Pass `ops` or `deck`, not both. Nothing was sent.');
    if (!ops && !deck && !title) return asErrorResult('Pass `ops`, `deck` or `title`. Nothing was sent.');
    const path = presentationPath(args);
    const presentation =
      deck ?
        await write(reqContext, args, 'put', path, defined({ expectedRevision, title, deck }))
      : await write(reqContext, args, 'patch', path, {
          expectedRevision,
          ops: [...(ops ?? []), ...(title ? [{ op: 'set_title', title }] : [])],
        });
    return writeResult('Updated', presentation);
  },
});

export const exportPresentationTool = definePresentationTool({
  name: 'export_presentation',
  title: 'Export presentation',
  description:
    "Start a PowerPoint (pptx) export of a presentation. It renders in the background: poll get_presentation_export with the returned export_id until it is completed, then give the user the download link and the presentation's app_url. Reuse the idempotency_key only to retry the same export. Needs expected_workspace_id from current_workspace.",
  operation: 'write',
  httpMethod: 'post',
  httpPath: `${FLOW_PATH}/{presentation_id}/exports`,
  inputSchema: EXPORT_INPUT_SCHEMA,
  outputSchema: EXPORT_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const slideIDs = args?.['slide_ids'];
    const exportData = await write(
      reqContext,
      args,
      'post',
      `${presentationPath(args)}/exports`,
      defined({
        format: readString(args?.['format']) ?? 'pptx',
        slideIds: Array.isArray(slideIDs) ? slideIDs : undefined,
        includeHidden: readBoolean(args?.['include_hidden']),
        includeNotes: readBoolean(args?.['include_notes']),
      }),
      { 'Idempotency-Key': readString(args?.['idempotency_key']) ?? '' },
    );
    return exportResult(exportData, args);
  },
});

export const getPresentationExportTool = definePresentationTool({
  name: 'get_presentation_export',
  title: 'Get presentation export',
  description:
    "Check a presentation export started by export_presentation: its status and progress, warnings, the error when it failed and, once completed, app_download_url, which downloads the file in a browser signed in to Sanka. Pass the deck's program_id for a migration program's Docs; omit it for Sanka Flow Docs.",
  operation: 'read',
  httpMethod: 'get',
  httpPath: `${FLOW_PATH}/{presentation_id}/exports/{export_id}`,
  inputSchema: EXPORT_STATUS_INPUT_SCHEMA,
  outputSchema: EXPORT_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const exportID = encodeURIComponent(readString(args?.['export_id']) ?? '');
    const exportData = unwrap(await reqContext.client.get(`${presentationPath(args)}/exports/${exportID}`));
    return exportResult(exportData, args);
  },
});

export const presentationTools: McpTool[] = [
  getPresentationCatalogTool,
  createPresentationTool,
  getPresentationTool,
  updatePresentationTool,
  exportPresentationTool,
  getPresentationExportTool,
];
