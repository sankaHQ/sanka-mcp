// Sanka Doc presentations: slide decks in a Sanka migration program's Docs (with program_id) or in
// Sanka Flow Docs (without), through the public developer API (client.public.programPresentations
// and client.public.presentations). Deck, op, image and export validation belongs to the API.
import type {
  Presentation,
  PresentationCreateExportParams,
  PresentationCreateParams,
  PresentationExport,
  PresentationExportFormat,
  PresentationImage,
  PresentationImportImageParams,
  PresentationListParams,
  PresentationOp,
  PresentationPageSize,
  PresentationPreviewParams,
  PresentationPreviewSlide,
  PresentationPreviewWidth,
  PresentationReplaceParams,
  PresentationSummary,
  PresentationThemeChoice,
  PresentationUpdateParams,
  PresentationUploadImageParams,
} from 'sanka-sdk';
import { BINARY_DOWNLOAD_INLINE_BASE64_LIMIT, storeBinaryDownload } from './binary-download-store';
import { BINARY_UPLOAD_CHUNK_BASE64_LENGTH } from './binary-upload-store';
import { configuredAppBaseUrl } from './record-url-enrichment';
import { requireAuthentication } from './tool-auth';
import { createChunkedUploadTools } from './tool-factories';
import { asErrorResult, binaryDownloadResult, McpRequestContext, McpTool, ToolCallResult } from './types';

type ToolArgs = Record<string, unknown> | undefined;
type JsonRecord = Record<string, unknown>;

const CATALOG_PATH = '/api/v2/public/presentations/catalog';
const FLOW_PATH = '/api/v2/public/documents/presentations';
const PRESENTATION_PATH = `${FLOW_PATH}/{presentation_id}`;
const EXPORT_PATH = `${PRESENTATION_PATH}/exports/{export_id}`;
const SESSION_PATH = '/api/v2/public/auth/session';
const MCP_SESSION_HEADER = 'X-Sanka-MCP-Session-ID';
const DEFAULT_APP_ORIGIN = 'https://app.sanka.com';
const DECK_SCHEMA = 'sanka.deck/v1';
const WORKSPACE_MISMATCH = 'WORKSPACE_CONTEXT_MISMATCH';
const REVISION_CONFLICT = 'PRESENTATION_REVISION_CONFLICT';
const OVERFLOW = 'SLIDE_OVERFLOW';
const MAX_LISTED = 10;
const PREVIEW_BATCH = 6;
// The API renders previews once, within 30 s plus 15 s of HTTP grace.
const PREVIEW_TIMEOUT_MS = 90_000;
// Downloads pass through the MCP server's memory and its download store as base64.
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
const EXPORTS_IN_PROGRESS = ['queued', 'rendering', 'writing', 'uploading'];
const PAGE_SIZES = ['16:9', 'a4-landscape'];
const PREVIEW_WIDTHS = [640, 960, 1280];

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
    pattern: '\\S',
    description:
      "Sanka program UUID when the deck belongs to a migration program's Docs. Omit it for Sanka Flow Docs, and pass the same value on every call for one deck.",
  },
};

const PRESENTATION_ID_PROPERTY = {
  presentation_id: {
    type: 'string',
    minLength: 1,
    description: 'presentation_id from create_presentation, list_presentations or get_presentation.',
  },
};

const EXPORT_ID_PROPERTY = {
  export_id: { type: 'string', minLength: 1, description: 'export_id from export_presentation.' },
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

const ALT_PROPERTY = {
  alt: {
    type: 'string',
    maxLength: 300,
    description: 'Alt text: what the image shows, for screen readers and exports.',
  },
};

const TITLE_SCHEMA = { type: 'string', minLength: 1, maxLength: 255 };

const CATALOG_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {},
  additionalProperties: false,
};

const LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...PROGRAM_ID_PROPERTY,
    folder_id: { type: 'string', minLength: 1, description: 'Only presentations in this Docs folder.' },
    cursor: { type: 'string', minLength: 1, description: 'next_cursor from the previous page.' },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      description: 'Presentations per page, up to 100 (default 50).',
    },
  },
  additionalProperties: false,
};

const CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...PROGRAM_ID_PROPERTY,
    title: { ...TITLE_SCHEMA, description: 'Deck title, shown in Docs.' },
    page_size: {
      type: 'string',
      enum: PAGE_SIZES,
      default: '16:9',
      description: 'Slide size: 16:9 (the default) for screens, a4-landscape for printed proposals.',
    },
    slides: {
      type: 'array',
      minItems: 1,
      maxItems: 200,
      items: { type: 'object' },
      description:
        'Slides in order, written to the slide schema from get_presentation_catalog (layout, blocks, notes, hidden). Start each slide with a heading block that states its point. Omit ids; the API assigns them. Give slides, markdown or source_doc_id, or none of them for one title slide.',
    },
    markdown: {
      type: 'string',
      minLength: 1,
      maxLength: 200000,
      description:
        'Markdown to lay out as slides, instead of slides: `---` and the most frequent of the top two heading levels start slides; lists, tables, quotes and Mermaid fences become blocks. Add images afterwards.',
    },
    source_doc_id: {
      type: 'string',
      minLength: 1,
      description:
        'A Markdown Doc in the same Docs (same program_id, or Sanka Flow Docs) to convert, instead of slides; the Doc itself is unchanged.',
    },
    theme: {
      type: 'object',
      properties: { id: { type: 'string', minLength: 1 }, version: { type: 'integer', minimum: 1 } },
      required: ['id'],
      description: 'Theme from the catalog, such as {"id": "sanka-paper"} (the default).',
    },
    footer: {
      type: 'object',
      properties: { pageNumbers: { type: 'boolean' }, text: { type: 'string', maxLength: 120 } },
      description:
        'Footer on every slide: page numbers and a short text such as a client name. Needs slides.',
    },
    folder_id: {
      type: 'string',
      minLength: 1,
      description: 'Docs folder to create the presentation in, in the same Docs.',
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

const PREVIEW_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...PRESENTATION_ID_PROPERTY,
    ...PROGRAM_ID_PROPERTY,
    slide_ids: {
      type: 'array',
      minItems: 1,
      maxItems: PREVIEW_BATCH,
      items: { type: 'string', minLength: 1 },
      description: `Slides to preview, at most ${PREVIEW_BATCH} per call, by id from get_presentation or next_slide_ids. Omit them to preview the first ${PREVIEW_BATCH} visible slides.`,
    },
    width: {
      type: 'integer',
      enum: PREVIEW_WIDTHS,
      default: 960,
      description: 'Image width in px: 960 (the default), 1280 to read small text, 640 to save context.',
    },
  },
  required: ['presentation_id'],
  additionalProperties: false,
};

const IMPORT_IMAGE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...PRESENTATION_ID_PROPERTY,
    ...PROGRAM_ID_PROPERTY,
    url: {
      type: 'string',
      minLength: 8,
      maxLength: 2048,
      pattern: '^https://',
      description: 'A public https:// image URL: JPEG, PNG or WebP, up to 10 MiB.',
    },
    ...ALT_PROPERTY,
    ...EXPECTED_WORKSPACE_PROPERTY,
  },
  required: ['presentation_id', 'url', 'expected_workspace_id'],
  additionalProperties: false,
};

const EXPORT_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...PRESENTATION_ID_PROPERTY,
    ...PROGRAM_ID_PROPERTY,
    format: {
      type: 'string',
      enum: ['pptx', 'pdf'],
      default: 'pptx',
      description: 'pptx (the default): a PowerPoint file. pdf: a PDF, for print or to share as is.',
    },
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
    ...EXPORT_ID_PROPERTY,
  },
  required: ['presentation_id', 'export_id'],
  additionalProperties: false,
};

// Clients validate structuredContent, error results included, against these: keep them permissive.
const OBJECT_SCHEMA = { type: 'object', additionalProperties: true };
const ARRAY_OF_OBJECTS_SCHEMA = { type: 'array', items: OBJECT_SCHEMA };
const STRING_ARRAY_SCHEMA = { type: 'array', items: { type: 'string' } };
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

const LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    presentations: ARRAY_OF_OBJECTS_SCHEMA,
    next_cursor: NULLABLE_STRING_SCHEMA,
    program_id: NULLABLE_STRING_SCHEMA,
  },
  additionalProperties: true,
};

const PREVIEW_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    presentation_id: { type: 'string' },
    revision: { type: 'integer' },
    width: { type: 'integer' },
    slides: {
      type: 'array',
      items: {
        type: 'object',
        properties: { slide_id: { type: 'string' }, index: { type: 'integer' }, fit: OBJECT_SCHEMA },
        additionalProperties: true,
      },
      description: 'One entry per image, in the same order; fit.overflow is set when the slide overflows.',
    },
    overflowing_slide_ids: STRING_ARRAY_SCHEMA,
    warnings: ARRAY_OF_OBJECTS_SCHEMA,
    next_slide_ids: STRING_ARRAY_SCHEMA,
    next_slide_id_batches: { type: 'array', items: STRING_ARRAY_SCHEMA },
  },
  additionalProperties: true,
};

const IMAGE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    asset_id: { type: 'string', description: 'assetId for image blocks and image accents.' },
    presentation_id: { type: 'string' },
    program_id: NULLABLE_STRING_SCHEMA,
    content_type: { type: 'string' },
    size_bytes: { type: 'integer' },
    width: { type: 'integer' },
    height: { type: 'integer' },
    alt: NULLABLE_STRING_SCHEMA,
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
    format: { type: 'string' },
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

const DOWNLOAD_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    export_id: { type: 'string' },
    presentation_id: { type: 'string' },
    filename: { type: 'string' },
    mime_type: { type: 'string' },
    byte_length: { type: 'integer' },
    completion_status: { type: 'string' },
    download_url: { type: 'string' },
    download_token: { type: 'string' },
    content_base64: { type: 'string' },
    next_action: { type: 'string' },
  },
  additionalProperties: true,
};

const CATALOG_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    pageSizes: ARRAY_OF_OBJECTS_SCHEMA,
    layouts: ARRAY_OF_OBJECTS_SCHEMA,
    blocks: ARRAY_OF_OBJECTS_SCHEMA,
    accents: ARRAY_OF_OBJECTS_SCHEMA,
    themes: ARRAY_OF_OBJECTS_SCHEMA,
    icons: STRING_ARRAY_SCHEMA,
    limits: OBJECT_SCHEMA,
    guidance: STRING_ARRAY_SCHEMA,
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

const readStrings = (value: unknown): string[] =>
  readArray(value)
    .map(readString)
    .filter((entry): entry is string => Boolean(entry));

// Results carry only the keys that have a value.
const defined = (entries: JsonRecord): JsonRecord =>
  Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined));

const plural = (count: unknown, noun: string, nouns = `${noun}s`): string =>
  `${count} ${count === 1 ? noun : nouns}`;

// A deck's Docs: a Sanka program's when program_id is given, else Sanka Flow Docs.
const presentationDocs = (reqContext: McpRequestContext, args: ToolArgs) => {
  const programID = readString(args?.['program_id']);
  const flow = reqContext.client.public.presentations;
  const program = reqContext.client.public.programPresentations;
  type Options = Parameters<typeof flow.list>[1];
  return {
    list: (params: PresentationListParams, options: Options) =>
      programID ? program.list(programID, params, options) : flow.list(params, options),
    create: (params: PresentationCreateParams, options: Options) =>
      programID ? program.create(programID, params, options) : flow.create(params, options),
    retrieve: (id: string, options: Options) =>
      programID ? program.retrieve(programID, id, {}, options) : flow.retrieve(id, {}, options),
    replace: (id: string, params: PresentationReplaceParams, options: Options) =>
      programID ? program.replace(programID, id, params, options) : flow.replace(id, params, options),
    update: (id: string, params: PresentationUpdateParams, options: Options) =>
      programID ? program.update(programID, id, params, options) : flow.update(id, params, options),
    uploadImage: (id: string, params: PresentationUploadImageParams, options: Options) =>
      programID ? program.uploadImage(programID, id, params, options) : flow.uploadImage(id, params, options),
    importImage: (id: string, params: PresentationImportImageParams, options: Options) =>
      programID ? program.importImage(programID, id, params, options) : flow.importImage(id, params, options),
    preview: (id: string, params: PresentationPreviewParams, options: Options) =>
      programID ? program.preview(programID, id, params, options) : flow.preview(id, params, options),
    createExport: (id: string, params: PresentationCreateExportParams, options: Options) =>
      programID ?
        program.createExport(programID, id, params, options)
      : flow.createExport(id, params, options),
    retrieveExport: (id: string, exportID: string, options: Options) =>
      programID ?
        program.retrieveExport(programID, id, exportID, {}, options)
      : flow.retrieveExport(id, exportID, {}, options),
    downloadExport: (id: string, exportID: string, options: Options) =>
      programID ?
        program.downloadExport(programID, id, exportID, {}, options)
      : flow.downloadExport(id, exportID, {}, options),
  };
};

// Public routes resolve the workspace this MCP session is bound to.
const sessionHeaders = (reqContext: McpRequestContext): Record<string, string> => {
  const sessionID = reqContext.mcpSessionId?.trim();
  return sessionID ? { [MCP_SESSION_HEADER]: sessionID } : {};
};

const readOptions = (reqContext: McpRequestContext) => ({ headers: sessionHeaders(reqContext) });

// Writes name their workspace and say they come from MCP: the API refuses a mismatch with 409
// WORKSPACE_CONTEXT_MISMATCH and records the edit as made through MCP. They are never retried.
const writeOptions = (reqContext: McpRequestContext, args: ToolArgs) => ({
  headers: {
    ...sessionHeaders(reqContext),
    'X-Sanka-MCP': 'true',
    'X-Sanka-Expected-Workspace-ID': readString(args?.['expected_workspace_id']) ?? '',
  },
  maxRetries: 0,
});

// Internal V2 routes, such as the session, answer with the envelope { success, data, meta }.
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

// Like the workflow tools, a write first reads the workspace its MCP session is bound to, the one the
// public routes use, and sends nothing when it is not the expected one. Without an MCP session
// (stdio) the API's check of X-Sanka-Expected-Workspace-ID stands alone.
const checkWorkspace = async (reqContext: McpRequestContext, args: ToolArgs): Promise<void> => {
  const headers = sessionHeaders(reqContext);
  if (!headers[MCP_SESSION_HEADER]) return;
  const expected = readString(args?.['expected_workspace_id']) ?? '';
  const current = readObject(
    unwrap(await reqContext.client.get(SESSION_PATH, { headers }))['current_workspace'],
  );
  if (readString(current?.['id']) !== expected) {
    throw workspaceMismatch({
      expected_workspace_id: expected,
      current_workspace_id: readString(current?.['id']) ?? null,
      current_workspace_code: readString(current?.['code']) ?? null,
    });
  }
};

// details is an object, or for VALIDATION_ERROR the request's problems as [{loc, msg, type}].
type Failure = { code: string; message: string; details: unknown; status?: number; ctxID?: string };

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
    details: body['details'] ?? {},
    ...(typeof status === 'number' ? { status } : undefined),
    ...(ctxID ? { ctxID } : undefined),
  };
};

const sentence = (text: string): string => (/[.!?。]$/.test(text) ? text : `${text}.`);

const POINTER_HINT =
  'Paths are JSON Pointers: /deck/... and /ops/... point into your request, /slides/... into the deck after your ops.';

const IMAGE_HINT =
  ' Use a PNG, JPEG or WebP image up to 10 MiB: upload the file with start_presentation_image_upload, or import a public https:// URL with import_presentation_image.';

const listFixes = (problems: string[], hint: string): string => {
  if (problems.length === 0) return '';
  const listed = problems.slice(0, MAX_LISTED).join('; ');
  const more = problems.length > MAX_LISTED ? `; ${problems.length - MAX_LISTED} more` : '';
  return ` Fix: ${listed}${more}. ${hint}`;
};

const listProblems = (details: JsonRecord): string =>
  listFixes(
    readObjects(details['errors']).map(
      (problem) => `${readString(problem['path']) ?? '/'}: ${readString(problem['message']) ?? 'invalid'}`,
    ),
    POINTER_HINT,
  );

// A request validation loc such as ["body", "ops", 0, "update_block", "blockId"] as a JSON Pointer
// into the request body (/ops/0/blockId): without "body", and without the op name that tags a
// discriminated op.
const requestPointer = (loc: unknown): string => {
  const parts = readArray(loc);
  const path = parts[0] === 'body' ? parts.slice(1) : parts;
  const segments = path.filter(
    (part, index) =>
      !(
        index >= 2 &&
        path[index - 2] === 'ops' &&
        typeof path[index - 1] === 'number' &&
        OPS.includes(String(part))
      ),
  );
  return `/${segments.map((part) => String(part).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;
};

const listRequestProblems = (problems: unknown[]): string =>
  listFixes(
    readObjects(problems).map(
      (problem) => `${requestPointer(problem['loc'])}: ${readString(problem['msg']) ?? 'invalid'}`,
    ),
    'Paths are JSON Pointers into your request, with its camelCase field names.',
  );

const failureHint = ({ code, status, details: rawDetails }: Failure): string => {
  // VALIDATION_ERROR lists what the request itself got wrong.
  if (Array.isArray(rawDetails)) return listRequestProblems(rawDetails);
  const details = readObject(rawDetails) ?? {};
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
    case 'PRESENTATION_ASSET_NOT_FOUND':
      return ' Images must belong to this presentation: upload the file with start_presentation_image_upload or import it with import_presentation_image, then use the asset_id it returns.';
    case 'PRESENTATION_EXPORT_NOT_FOUND':
      return ' Only a completed export can be downloaded, for 7 days: check it with get_presentation_export, or start a new export with a new idempotency_key.';
    case 'IMAGE_IMPORT_BLOCKED':
    case 'IMAGE_IMPORT_FAILED':
    case 'IMAGE_TOO_LARGE':
    case 'IMAGE_UNSUPPORTED': {
      const reason = readString(details['reason']);
      return `${reason ? ` Reason: ${sentence(reason)}` : ''}${IMAGE_HINT}`;
    }
    case 'DOCUMENT_KIND_MISMATCH':
      return ' That id or source_ref belongs to a Markdown Doc, not a presentation; use the Docs tools for it.';
    case 'DOCUMENT_FOLDER_CONFLICT':
      return " folder_id must be a folder of the same Docs: pass program_id for a migration program's Docs, or omit it for Sanka Flow Docs.";
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
  const { code, message, status, ctxID } = failure;
  const details = readObject(failure.details) ?? {};
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
      details: failure.details,
      current_revision: code === REVISION_CONFLICT ? details['currentRevision'] : undefined,
      ctx_id: ctxID,
    }),
  };
};

const failurePrefix = (operation: 'read' | 'write', title: string): string =>
  operation === 'write' ? 'Nothing was changed' : `Could not ${title.toLowerCase()}`;

// Text inputs the schema requires must not be blank either.
const missingInputs = (args: ToolArgs, keys: string[]): ToolCallResult | undefined => {
  const missing = keys.filter((key) => !readString(args?.[key]));
  return missing.length > 0 ?
      asErrorResult(`Pass ${missing.map((key) => `\`${key}\``).join(' and ')}. Nothing was sent.`)
    : undefined;
};

type PresentationToolDefinition = {
  name: string;
  title: string;
  description: string;
  operation: 'read' | 'write';
  httpMethod: 'get' | 'post' | 'put' | 'patch';
  httpPath: string;
  openWorld?: boolean;
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
      resource: 'documents',
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
        openWorldHint: definition.openWorld === true,
      },
    },
    handler: async ({ reqContext, args }) => {
      const authError = requireAuthentication({ reqContext, toolTitle: definition.title });
      if (authError) return authError;
      const missing = missingInputs(args, requiredText);
      if (missing) return missing;
      try {
        return await definition.run(reqContext, args);
      } catch (error) {
        const result = failureResult(error, failurePrefix(definition.operation, definition.title));
        if (result) return result;
        throw error;
      }
    },
  };
};

const presentationSummary = (presentation: Presentation): JsonRecord =>
  defined({
    presentation_id: presentation.id,
    title: presentation.title,
    revision: presentation.revision,
    product: presentation.product,
    program_id: presentation.programId ?? null,
    slide_count: presentation.slideCount,
    app_url: appUrl(presentation.appPath),
    warnings: readArray(presentation.warnings),
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

const writeResult = (verb: string, presentation: Presentation): ToolCallResult => {
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

// Public export responses name the developer API's download route (/v2/public/…). A browser signed
// in to Sanka downloads the same file through the app's API proxy, under /api/v2/.
const appDownloadPath = (path: string | null | undefined): string | undefined =>
  path?.replace(/^(?:\/api)?\/v2\/public\//, '/api/v2/');

const exportSummary = (exportData: PresentationExport, args: ToolArgs): JsonRecord =>
  defined({
    export_id: exportData.id,
    presentation_id: exportData.documentId ?? readString(args?.['presentation_id']),
    program_id: readString(args?.['program_id']),
    status: exportData.status,
    progress: exportData.progress,
    revision: exportData.revision,
    format: exportData.format,
    filename: exportData.filename,
    size_bytes: exportData.sizeBytes,
    warnings: readArray(exportData.warnings),
    error_code: exportData.errorCode,
    error_message: exportData.errorMessage,
    expires_at: exportData.expiresAt,
    app_download_url:
      exportData.status === 'completed' ? appUrl(appDownloadPath(exportData.downloadPath)) : undefined,
  });

const exportIDs = (summary: JsonRecord): string => {
  const program = summary['program_id'] ? `, program_id ${summary['program_id']}` : '';
  return `presentation_id ${summary['presentation_id']}${program} and export_id ${summary['export_id']}`;
};

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
      `To pass the file itself through MCP, call download_presentation_export with ${exportIDs(summary)}.`,
    ].join(' ');
  }
  if (EXPORTS_IN_PROGRESS.includes(status)) {
    return [
      `Export ${exportID} is ${status} (${summary['progress'] ?? 0}%).`,
      `Call get_presentation_export with ${exportIDs(
        summary,
      )} again in a few seconds, until it is completed.`,
    ].join(' ');
  }
  const code = summary['error_code'] ? ` (${summary['error_code']})` : '';
  const reason = summary['error_message'] ?? 'no file was produced';
  return `Export ${exportID} ${status}${code}: ${reason}. Fix the cause, then start a new export with a new idempotency_key.`;
};

const exportResult = (exportData: PresentationExport, args: ToolArgs): ToolCallResult => {
  const summary = exportSummary(exportData, args);
  return { content: [{ type: 'text', text: describeExport(summary) }], structuredContent: summary };
};

const imageSummary = (image: PresentationImage, args: ToolArgs): JsonRecord =>
  defined({
    asset_id: image.assetId,
    presentation_id: readString(args?.['presentation_id']),
    program_id: readString(args?.['program_id']) ?? null,
    content_type: image.contentType,
    size_bytes: image.sizeBytes,
    width: image.width,
    height: image.height,
    alt: image.alt ?? null,
  });

const describeImage = (verb: string, summary: JsonRecord): string => {
  const assetID = String(summary['asset_id']);
  const block = JSON.stringify(
    defined({ type: 'image', assetId: assetID, alt: summary['alt'] ?? undefined }),
  );
  return [
    `${verb} image ${assetID} (${summary['width']}×${summary['height']} px, ${summary['content_type']}) in presentation ${summary['presentation_id']}.`,
    `Add it with update_presentation as an image block such as ${block}, or as an image accent {"type": "image", "assetId": "${assetID}"} on a slide with an accent layout.`,
    ...(summary['alt'] ? [] : ['Give the block alt text that says what the image shows.']),
  ].join(' ');
};

const imageResult = (verb: string, image: PresentationImage, args: ToolArgs): ToolCallResult => {
  const summary = imageSummary(image, args);
  return { content: [{ type: 'text', text: describeImage(verb, summary) }], structuredContent: summary };
};

const listedPresentation = (item: PresentationSummary): JsonRecord =>
  defined({
    presentation_id: item.id,
    title: item.title,
    revision: item.revision,
    product: item.product,
    program_id: item.programId ?? null,
    slide_count: item.slideCount,
    page_size: item.pageSize,
    theme_id: item.themeId,
    folder_id: item.folderId ?? null,
    pinned: item.pinned,
    archived_at: item.archivedAt ?? undefined,
    updated_via: item.updatedVia,
    updated_at: item.updatedAt,
    app_url: appUrl(item.appPath),
  });

const describeListed = (item: JsonRecord): string => {
  const updated = item['updated_at'] ? `, updated ${item['updated_at']} via ${item['updated_via']}` : '';
  const size = `${plural(item['slide_count'], 'slide')}, ${item['page_size']}, revision ${item['revision']}`;
  return `- "${item['title']}" (${size}${updated}): presentation_id ${item['presentation_id']}`;
};

const describeCatalog = (catalog: JsonRecord): string => {
  const list = (key: string, describe: (entry: JsonRecord) => string): string =>
    readObjects(catalog[key]).map(describe).join(', ');
  const layout = (entry: JsonRecord) => `${entry['id']}${entry['needsAccent'] ? ' (needs an accent)' : ''}`;
  const theme = (entry: JsonRecord) => `${entry['id']}${entry['version'] ? ` v${entry['version']}` : ''}`;
  const limits = Object.entries(readObject(catalog['limits']) ?? {}).map(([key, value]) => `${key} ${value}`);
  const versions = readArray(catalog['schemaVersions']).join(', ') || DECK_SCHEMA;
  const pageSizes = list('pageSizes', (entry) => String(entry['id']));
  const icons = readArray(catalog['icons']).length;
  return [
    `Presentation catalog for ${versions} decks.`,
    ...(pageSizes ? [`Page sizes: ${pageSizes}.`] : []),
    `Layouts: ${list('layouts', layout)}.`,
    `Blocks: ${list('blocks', (block) => String(block['type']))}.`,
    `Themes: ${list('themes', theme)}.`,
    ...(icons > 0 ? [`Icons: ${icons} lucide names for card items, in structuredContent.icons.`] : []),
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
    'Read what a Sanka Doc presentation can contain: page sizes (16:9 for screens, A4 landscape for print), layouts, slide blocks with their JSON Schemas and recommended lengths, accents, themes, icons, limits, authoring guidance, the deck JSON Schema and an example deck. Call it once per session before creating or editing presentations, and use only what it lists.',
  operation: 'read',
  httpMethod: 'get',
  httpPath: CATALOG_PATH,
  inputSchema: CATALOG_INPUT_SCHEMA,
  outputSchema: CATALOG_OUTPUT_SCHEMA,
  run: async (reqContext) => {
    const catalog = { ...(await reqContext.client.public.presentations.catalog(readOptions(reqContext))) };
    return { content: [{ type: 'text', text: describeCatalog(catalog) }], structuredContent: catalog };
  },
});

export const listPresentationsTool = definePresentationTool({
  name: 'list_presentations',
  title: 'List presentations',
  description:
    "List presentations (slide decks) in Sanka Docs, most recently updated first: titles, presentation_ids, revisions, slide counts, page sizes and app links, without the decks. Pass program_id for a migration program's Docs, or omit it for Sanka Flow Docs; folder_id narrows the list to one Docs folder. Page with cursor.",
  operation: 'read',
  httpMethod: 'get',
  httpPath: FLOW_PATH,
  inputSchema: LIST_INPUT_SCHEMA,
  outputSchema: LIST_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const limit = args?.['limit'];
    const folderID = readString(args?.['folder_id']);
    const cursor = readString(args?.['cursor']);
    const page = await presentationDocs(reqContext, args).list(
      {
        ...(folderID ? { folder_id: folderID } : undefined),
        ...(cursor ? { cursor } : undefined),
        ...(typeof limit === 'number' ? { limit } : undefined),
      },
      readOptions(reqContext),
    );
    const presentations = page.presentations.map(listedPresentation);
    const nextCursor = page.nextCursor ?? null;
    const docs = readString(args?.['program_id']) ? 'this program' : 'Sanka Flow Docs';
    const text = [
      presentations.length > 0 ?
        `${plural(presentations.length, 'presentation')} in ${docs}, most recently updated first:`
      : `No presentations in ${docs}${cursor ? ' on this page' : ''}.`,
      ...presentations.map(describeListed),
      ...(nextCursor ? [`More: call list_presentations again with cursor ${nextCursor}.`] : []),
    ].join('\n');
    return {
      content: [{ type: 'text', text }],
      structuredContent: {
        presentations,
        next_cursor: nextCursor,
        program_id: readString(args?.['program_id']) ?? null,
      },
    };
  },
});

export const createPresentationTool = definePresentationTool({
  name: 'create_presentation',
  title: 'Create presentation',
  description:
    "Create a presentation (slide deck) in Sanka Docs: pass program_id for a migration program's Docs, or omit it for Sanka Flow Docs. Call get_presentation_catalog first and plan the outline: one message per slide, a title that states the point, at most 6 bullets. Give the content as slides (deck JSON, for control), markdown (for speed) or source_doc_id (a Markdown Doc to convert); use page_size a4-landscape for printed proposals. Keep supplied facts and numbers exact and never invent figures; write Japanese decks in です・ます. Add images after creating, then check the slides with preview_presentation. Needs expected_workspace_id from current_workspace.",
  operation: 'write',
  httpMethod: 'post',
  httpPath: FLOW_PATH,
  inputSchema: CREATE_INPUT_SCHEMA,
  outputSchema: PRESENTATION_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const slides = args?.['slides'];
    const markdown = readString(args?.['markdown']);
    const sourceDocID = readString(args?.['source_doc_id']);
    const theme = readObject(args?.['theme']);
    const footer = readObject(args?.['footer']);
    if ([Array.isArray(slides), Boolean(markdown), Boolean(sourceDocID)].filter(Boolean).length > 1) {
      return asErrorResult('Pass only one of `slides`, `markdown` and `source_doc_id`. Nothing was sent.');
    }
    if (!Array.isArray(slides) && footer) {
      return asErrorResult(
        'Pass `slides` with `footer`, or set it after creating with the update_presentation op set_footer. Nothing was sent.',
      );
    }
    const folderID = readString(args?.['folder_id']);
    const sourceRef = readString(args?.['source_ref']);
    const params: PresentationCreateParams = {
      title: readString(args?.['title']) ?? '',
      pageSize: (readString(args?.['page_size']) ?? '16:9') as PresentationPageSize,
      ...(Array.isArray(slides) ?
        {
          deck: { schema: DECK_SCHEMA, ...(footer ? { footer } : undefined), slides: slides as JsonRecord[] },
        }
      : undefined),
      ...(markdown ? { markdown } : undefined),
      ...(sourceDocID ? { sourceDocumentId: sourceDocID } : undefined),
      ...(theme ? { theme: theme as Pick<PresentationThemeChoice, 'id'> } : undefined),
      ...(folderID ? { folderId: folderID } : undefined),
      ...(sourceRef ? { sourceRef } : undefined),
    };
    await checkWorkspace(reqContext, args);
    const presentation = await presentationDocs(reqContext, args).create(
      params,
      writeOptions(reqContext, args),
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
  httpPath: PRESENTATION_PATH,
  inputSchema: GET_INPUT_SCHEMA,
  outputSchema: PRESENTATION_READ_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const presentation = await presentationDocs(reqContext, args).retrieve(
      readString(args?.['presentation_id']) ?? '',
      readOptions(reqContext),
    );
    const outline = args?.['include'] === 'outline';
    const summary = {
      ...presentationSummary(presentation),
      ...defined({
        updated_via: presentation.updatedVia,
        updated_at: presentation.updatedAt,
        ...(outline ? { outline: presentation.outline } : { deck: presentation.deck }),
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
    'Edit a presentation at the revision you last read: pass ops for targeted edits (preferred) or deck to replace the whole deck, and optionally a new title. On PRESENTATION_REVISION_CONFLICT nothing changed: call get_presentation and re-apply only your intended change with the new revision. Do not delete slides you did not create unless the user asks, and preview the changed slides again. Needs expected_workspace_id from current_workspace.',
  operation: 'write',
  httpMethod: 'patch',
  httpPath: PRESENTATION_PATH,
  inputSchema: UPDATE_INPUT_SCHEMA,
  outputSchema: PRESENTATION_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const expectedRevision = args?.['expected_revision'];
    const rawOps = args?.['ops'];
    const ops = Array.isArray(rawOps) && rawOps.length > 0 ? (rawOps as PresentationOp[]) : undefined;
    const deck = readObject(args?.['deck']);
    const title = readString(args?.['title']);
    if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
      return asErrorResult('`expected_revision` must be the revision you last read. Nothing was sent.');
    }
    if (ops && deck) return asErrorResult('Pass `ops` or `deck`, not both. Nothing was sent.');
    if (!ops && !deck && !title) return asErrorResult('Pass `ops`, `deck` or `title`. Nothing was sent.');
    const presentationID = readString(args?.['presentation_id']) ?? '';
    const docs = presentationDocs(reqContext, args);
    await checkWorkspace(reqContext, args);
    const presentation =
      deck ?
        await docs.replace(
          presentationID,
          {
            expectedRevision,
            ...(title ? { title } : undefined),
            deck: deck as PresentationReplaceParams['deck'],
          },
          writeOptions(reqContext, args),
        )
      : await docs.update(
          presentationID,
          {
            expectedRevision,
            ops: [...(ops ?? []), ...(title ? [{ op: 'set_title' as const, title }] : [])],
          },
          writeOptions(reqContext, args),
        );
    return writeResult('Updated', presentation);
  },
});

type PreviewedSlide = { slide_id: string; index: number; fit: JsonRecord };

const previewedSlide = (slide: PresentationPreviewSlide): PreviewedSlide => ({
  slide_id: slide.slideId,
  index: slide.index,
  fit: {
    scale: slide.fit.scale,
    overflow:
      slide.fit.overflow ?
        { block_ids: slide.fit.overflow.blockIds, overflow_px: slide.fit.overflow.overflowPx }
      : null,
  },
});

const describePreviewedSlide = (slide: PreviewedSlide): string => {
  const overflow = readObject(slide.fit['overflow']);
  const where =
    overflow ?
      `: ${OVERFLOW} by ${overflow['overflow_px']} px in ${
        readStrings(overflow['block_ids']).join(', ') || 'the slide'
      }`
    : '';
  return `- Slide ${slide.index + 1} (${slide.slide_id})${where}`;
};

const describePreview = (summary: JsonRecord, slides: PreviewedSlide[]): string => {
  const overflowing = readStrings(summary['overflowing_slide_ids']);
  const others = readObjects(summary['warnings']).filter((warning) => warning['code'] !== OVERFLOW);
  const next = readStrings(summary['next_slide_ids']);
  const later = readArray(summary['next_slide_id_batches']).length - 1;
  return [
    `Previews of presentation ${summary['presentation_id']} at revision ${summary['revision']} (${summary['width']} px), one image per slide in this order:`,
    ...slides.map(describePreviewedSlide),
    overflowing.length > 0 ?
      `Fix every ${OVERFLOW} before exporting: shorten, split or change the layout of those blocks with update_presentation, then preview the slides again.`
    : 'Every previewed slide fits.',
    ...(others.length > 0 ?
      [
        'Other warnings:',
        ...others
          .slice(0, MAX_LISTED)
          .map(
            (warning) =>
              `- ${warning['slideId'] ?? ''}${warning['blockId'] ? `/${warning['blockId']}` : ''}: ${
                warning['message'] ?? ''
              } (${warning['code']})`,
          ),
      ]
    : []),
    ...(next.length > 0 ?
      [
        `Next: preview_presentation with slide_ids ${JSON.stringify(next)}${
          later > 0 ? `, then the ${plural(later, 'batch', 'batches')} after it in next_slide_id_batches` : ''
        }.`,
      ]
    : []),
  ].join('\n');
};

export const previewPresentationTool = definePresentationTool({
  name: 'preview_presentation',
  title: 'Preview presentation',
  description: `Render slides of a presentation as images, at most ${PREVIEW_BATCH} per call, with each slide's fit, to check the deck before exporting. Without slide_ids it previews the first ${PREVIEW_BATCH} visible slides and returns the other visible slides as next_slide_id_batches, one batch per later call. Previews count against a limit of 60 an hour and are not retried. Fix every slide that reports ${OVERFLOW} (fit.overflow names the blocks and the overflow in px) by shortening, splitting or changing its layout with update_presentation, then preview it again. Pass the deck's program_id for a migration program's Docs.`,
  operation: 'read',
  httpMethod: 'post',
  httpPath: `${PRESENTATION_PATH}/previews`,
  inputSchema: PREVIEW_INPUT_SCHEMA,
  outputSchema: PREVIEW_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const presentationID = readString(args?.['presentation_id']) ?? '';
    const width = (typeof args?.['width'] === 'number' ? args['width'] : 960) as PresentationPreviewWidth;
    const docs = presentationDocs(reqContext, args);
    let slideIDs = readStrings(args?.['slide_ids']).slice(0, PREVIEW_BATCH);
    let visible: string[] | undefined;
    if (slideIDs.length === 0) {
      // Batches follow the deck's visible slides, like the API's own default.
      const presentation = await docs.retrieve(presentationID, readOptions(reqContext));
      visible = readObjects(presentation.deck?.slides)
        .filter((slide) => slide['hidden'] !== true)
        .map((slide) => readString(slide['id']))
        .filter((id): id is string => Boolean(id));
      slideIDs = visible.slice(0, PREVIEW_BATCH);
      if (slideIDs.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Presentation ${presentationID} has no visible slides to preview. Pass slide_ids to preview hidden slides.`,
            },
          ],
          structuredContent: { presentation_id: presentationID, revision: presentation.revision, slides: [] },
        };
      }
    }
    // Not retried: every attempt renders again and counts against the API's hourly preview limit.
    const preview = await docs.preview(
      presentationID,
      { slideIds: slideIDs, width, format: 'jpeg' },
      { ...readOptions(reqContext), maxRetries: 0, timeout: PREVIEW_TIMEOUT_MS },
    );
    const slides = preview.slides.map(previewedSlide);
    const batches: string[][] = [];
    for (let start = PREVIEW_BATCH; visible && start < visible.length; start += PREVIEW_BATCH) {
      batches.push(visible.slice(start, start + PREVIEW_BATCH));
    }
    const summary = defined({
      presentation_id: presentationID,
      program_id: readString(args?.['program_id']),
      revision: preview.revision,
      width,
      slides,
      overflowing_slide_ids: slides.filter((slide) => slide.fit['overflow']).map((slide) => slide.slide_id),
      warnings: readArray(preview.warnings),
      next_slide_ids: visible ? batches[0] ?? [] : undefined,
      next_slide_id_batches: visible ? batches : undefined,
    });
    return {
      content: [
        { type: 'text', text: describePreview(summary, slides) },
        ...preview.slides.map((slide) => ({
          type: 'image' as const,
          data: slide.image.base64,
          mimeType: slide.image.contentType || 'image/jpeg',
        })),
      ],
      structuredContent: summary,
    };
  },
});

export const importPresentationImageTool = definePresentationTool({
  name: 'import_presentation_image',
  title: 'Import presentation image',
  description:
    'Import an image into a presentation from a public https:// URL (JPEG, PNG or WebP, up to 10 MiB; Sanka fetches it and strips its metadata) and return its asset_id for image blocks and image accents. Give alt text that says what the image shows. For image bytes, use start_presentation_image_upload instead. Needs expected_workspace_id from current_workspace.',
  operation: 'write',
  httpMethod: 'post',
  httpPath: `${PRESENTATION_PATH}/images/import`,
  openWorld: true,
  inputSchema: IMPORT_IMAGE_INPUT_SCHEMA,
  outputSchema: IMAGE_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const alt = readString(args?.['alt']);
    await checkWorkspace(reqContext, args);
    const image = await presentationDocs(reqContext, args).importImage(
      readString(args?.['presentation_id']) ?? '',
      { url: readString(args?.['url']) ?? '', ...(alt ? { alt } : undefined) },
      writeOptions(reqContext, args),
    );
    return imageResult('Imported', image, args);
  },
});

// A chunk of base64 holds this many KiB of image.
const IMAGE_CHUNK_KIB = Math.floor((BINARY_UPLOAD_CHUNK_BASE64_LENGTH * 3) / 4 / 1024);

// After a 4xx answer about the request (ids, workspace, rate limit) the staged image can be finished
// again; an IMAGE_* answer about the image itself or a server error ends the upload.
const keepsStagedImage = (error: unknown): boolean => {
  const failure = readFailure(error);
  return (
    failure !== undefined &&
    (failure.status ?? 0) >= 400 &&
    (failure.status ?? 0) < 500 &&
    !failure.code.startsWith('IMAGE_')
  );
};

const withUploadNote = (result: ToolCallResult, kept: boolean): ToolCallResult => {
  const [first, ...rest] = result.content;
  const note =
    kept ?
      ' The image stays staged: once the cause is fixed, call finish_presentation_image_upload again with the same upload_token.'
    : ' This upload is closed; start a new one for another image.';
  return {
    ...result,
    content: first?.type === 'text' ? [{ ...first, text: `${first.text}${note}` }, ...rest] : result.content,
    structuredContent: { ...result.structuredContent, upload_kept: kept },
  };
};

const imageUploadTools = createChunkedUploadTools({
  resource: 'documents',
  tags: ['docs', 'presentations'],
  httpPath: `${PRESENTATION_PATH}/images`,
  operationIds: {
    start: 'presentations.start_presentation_image_upload',
    append: 'presentations.append_presentation_image_upload_chunk',
    finish: 'presentations.finish_presentation_image_upload',
  },
  names: {
    start: 'start_presentation_image_upload',
    append: 'append_presentation_image_upload_chunk',
    finish: 'finish_presentation_image_upload',
  },
  titles: {
    start: 'Start presentation image upload',
    append: 'Append presentation image upload chunk',
    finish: 'Finish presentation image upload',
  },
  fileLabel: 'presentation image',
  fileKindLabel: 'images',
  // Without the total length, append could never report done.
  startRequired: ['content_base64_length'],
  descriptions: {
    start:
      'Start uploading an image for a presentation: a PNG, JPEG or WebP file of up to 9 MiB that you have as bytes (for a public https:// URL, use import_presentation_image). Pass content_base64_length, the length of the whole base64 string, then append the base64 in order and call finish_presentation_image_upload with the presentation to get the asset_id for image blocks and image accents.',
    append: `Append the next base64 chunk of a presentation image upload started with start_presentation_image_upload, at next_offset. A chunk holds up to chunk_size characters (about ${IMAGE_CHUNK_KIB} KiB of image), so most images take several appends. Continue until the result returns done=true, then call finish_presentation_image_upload.`,
    chunk: `The next base64 chunk of the image, up to chunk_size characters (about ${IMAGE_CHUNK_KIB} KiB of image).`,
    finish:
      "Finish a chunked presentation image upload after all chunks have been appended: upload the image to the presentation (pass program_id for a migration program's Docs) and return its asset_id, for an image block or an image accent through update_presentation. Give alt text. When the request is refused for a reason other than the image itself, the image stays staged and can be finished again with the same upload_token. Needs expected_workspace_id from current_workspace.",
  },
  nextActions: {
    start: (recommendedChunkCount) =>
      `Call append_presentation_image_upload_chunk with content_base64 chunks of up to ${BINARY_UPLOAD_CHUNK_BASE64_LENGTH} characters, using next_offset each time until append returns done=true${
        recommendedChunkCount !== undefined ?
          ` (${plural(recommendedChunkCount, 'call')} with full chunks)`
        : ''
      }. Then call finish_presentation_image_upload with presentation_id, alt and expected_workspace_id to get the asset_id.`,
    chunk:
      'Call append_presentation_image_upload_chunk again with next_offset and the next content_base64 chunk.',
    finish:
      'Call finish_presentation_image_upload with this upload_token, presentation_id, alt and expected_workspace_id to upload the image and get its asset_id.',
  },
  finish: {
    inputProperties: {
      ...PRESENTATION_ID_PROPERTY,
      ...PROGRAM_ID_PROPERTY,
      ...ALT_PROPERTY,
      ...EXPECTED_WORKSPACE_PROPERTY,
    },
    required: ['presentation_id', 'expected_workspace_id'],
    additionalProperties: false,
    outputSchema: IMAGE_OUTPUT_SCHEMA,
    // Checked before the chunks are assembled, so a refused finish keeps the upload.
    check: async (reqContext, args) => {
      const missing = missingInputs(args, ['presentation_id', 'expected_workspace_id']);
      if (missing) return missing;
      try {
        await checkWorkspace(reqContext, args);
      } catch (error) {
        const result = failureResult(error, failurePrefix('write', 'finish'));
        if (result) return withUploadNote(result, true);
        throw error;
      }
      return undefined;
    },
    upload: (reqContext, file, args) => {
      const alt = readString(args?.['alt']);
      return presentationDocs(reqContext, args).uploadImage(
        readString(args?.['presentation_id']) ?? '',
        { file, ...(alt ? { alt } : undefined) },
        writeOptions(reqContext, args),
      );
    },
    keepUploadOnError: keepsStagedImage,
    result: (uploaded, upload, args) => {
      const summary = {
        ...imageSummary(uploaded as PresentationImage, args),
        filename: upload.filename,
        byte_length: upload.byteLength,
        content_base64_length: upload.contentBase64Length,
        completion_status: 'uploaded',
        next_action:
          'Use asset_id in an image block or an image accent with update_presentation, with alt text.',
      };
      return {
        content: [{ type: 'text', text: describeImage('Uploaded', summary) }],
        structuredContent: summary,
      };
    },
  },
});

export const startPresentationImageUploadTool = imageUploadTools.startTool;
export const appendPresentationImageUploadChunkTool = imageUploadTools.appendTool;
export const finishPresentationImageUploadTool: McpTool = {
  ...imageUploadTools.finishTool,
  handler: async (input) => {
    try {
      return await imageUploadTools.finishTool.handler(input);
    } catch (error) {
      const result = failureResult(error, failurePrefix('write', 'finish'));
      if (result) return withUploadNote(result, keepsStagedImage(error));
      throw error;
    }
  },
};

export const exportPresentationTool = definePresentationTool({
  name: 'export_presentation',
  title: 'Export presentation',
  description:
    "Start a PowerPoint (pptx) or PDF export of a presentation. It renders in the background: poll get_presentation_export with the returned export_id until it is completed, then give the user the download link and the presentation's app_url. Preview the slides first and fix every SLIDE_OVERFLOW. Reuse the idempotency_key only to retry the same export. Needs expected_workspace_id from current_workspace.",
  operation: 'write',
  httpMethod: 'post',
  httpPath: `${PRESENTATION_PATH}/exports`,
  inputSchema: EXPORT_INPUT_SCHEMA,
  outputSchema: EXPORT_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const slideIDs = readStrings(args?.['slide_ids']);
    const includeHidden = readBoolean(args?.['include_hidden']);
    const includeNotes = readBoolean(args?.['include_notes']);
    await checkWorkspace(reqContext, args);
    const exportData = await presentationDocs(reqContext, args).createExport(
      readString(args?.['presentation_id']) ?? '',
      {
        format: (readString(args?.['format']) ?? 'pptx') as PresentationExportFormat,
        ...(slideIDs.length > 0 ? { slideIds: slideIDs } : undefined),
        ...(includeHidden !== undefined ? { includeHidden } : undefined),
        ...(includeNotes !== undefined ? { includeNotes } : undefined),
        'Idempotency-Key': readString(args?.['idempotency_key']) ?? '',
      },
      writeOptions(reqContext, args),
    );
    return exportResult(exportData, args);
  },
});

export const getPresentationExportTool = definePresentationTool({
  name: 'get_presentation_export',
  title: 'Get presentation export',
  description:
    "Check a presentation export started by export_presentation: its status and progress, warnings, the error when it failed and, once completed, app_download_url, which downloads the file in a browser signed in to Sanka (download_presentation_export passes the file through MCP instead). Pass the deck's program_id for a migration program's Docs; omit it for Sanka Flow Docs.",
  operation: 'read',
  httpMethod: 'get',
  httpPath: EXPORT_PATH,
  inputSchema: EXPORT_STATUS_INPUT_SCHEMA,
  outputSchema: EXPORT_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const exportData = await presentationDocs(reqContext, args).retrieveExport(
      readString(args?.['presentation_id']) ?? '',
      readString(args?.['export_id']) ?? '',
      readOptions(reqContext),
    );
    return exportResult(exportData, args);
  },
});

const MAX_DOWNLOAD_MIB = MAX_DOWNLOAD_BYTES / 1024 / 1024;

// Reads the file into one buffer, sized from the export when known, and gives up past the limit.
const readExportFile = async (
  response: Response,
  sizeBytes: number | undefined,
): Promise<Buffer | undefined> => {
  const declared = Number(response.headers.get('content-length'));
  const expected = sizeBytes ?? (declared > 0 ? declared : undefined);
  if ((expected ?? 0) > MAX_DOWNLOAD_BYTES) {
    await response.body?.cancel();
    return undefined;
  }
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  let bytes = Buffer.allocUnsafe(expected ?? 1024 * 1024);
  let size = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    const next = size + chunk.value.byteLength;
    if (next > MAX_DOWNLOAD_BYTES) {
      await reader.cancel();
      return undefined;
    }
    if (next > bytes.length) {
      const grown = Buffer.allocUnsafe(Math.min(MAX_DOWNLOAD_BYTES, Math.max(next, bytes.length * 2)));
      bytes.copy(grown, 0, 0, size);
      bytes = grown;
    }
    bytes.set(chunk.value, size);
    size = next;
  }
  return bytes.subarray(0, size);
};

const tooLargeToDownload = (summary: JsonRecord, size?: number): ToolCallResult => {
  const file = `${summary['filename'] ?? `Export ${summary['export_id']}`}${size ? ` (${size} bytes)` : ''}`;
  const link =
    summary['app_download_url'] ? `: ${summary['app_download_url']}` : ' from get_presentation_export';
  return {
    content: [
      {
        type: 'text',
        text: `${file} is larger than the ${MAX_DOWNLOAD_MIB} MiB that can pass through MCP. Give the user app_download_url instead, which downloads it in a browser signed in to Sanka${link}.`,
      },
    ],
    isError: true,
    structuredContent: { ...summary, max_download_bytes: MAX_DOWNLOAD_BYTES },
  };
};

const describeDownload = (summary: JsonRecord): string => {
  const file = `${summary['filename']} (${summary['byte_length']} bytes)`;
  const token = summary['download_token'];
  switch (summary['completion_status']) {
    case 'download_url_ready':
      return `Prepared ${file}. Download it from download_url with the current MCP session and save or attach it before telling the user it is downloaded. If the URL fails, read it with read_binary_download_chunk and download_token ${token}.`;
    case 'requires_chunks':
      return `Prepared ${file}, not attached yet: call read_binary_download_chunk with download_token ${token} from offset 0 until done=true, join the chunks in order, decode the base64 and save the file.`;
    default:
      return `Downloaded ${file}. Decode structuredContent.content_base64 to save it.`;
  }
};

const EXPORT_MIME_TYPES: Record<string, string> = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
};

export const downloadPresentationExportTool = definePresentationTool({
  name: 'download_presentation_export',
  title: 'Download presentation export',
  description: `Download the file of a completed presentation export (.pptx or .pdf, up to ${MAX_DOWNLOAD_MIB} MiB) through MCP: the result gives a download_url for this MCP session, or chunks to read with read_binary_download_chunk. Use it when the file itself is needed here; otherwise, and for larger files, give the user app_download_url from get_presentation_export. Exports expire after 7 days.`,
  operation: 'read',
  httpMethod: 'get',
  httpPath: `${EXPORT_PATH}/download`,
  inputSchema: EXPORT_STATUS_INPUT_SCHEMA,
  outputSchema: DOWNLOAD_OUTPUT_SCHEMA,
  run: async (reqContext, args) => {
    const presentationID = readString(args?.['presentation_id']) ?? '';
    const exportID = readString(args?.['export_id']) ?? '';
    const docs = presentationDocs(reqContext, args);
    // The status says whether the file exists and how large it is before anything is buffered.
    const exportData = await docs.retrieveExport(presentationID, exportID, readOptions(reqContext));
    const exported = exportSummary(exportData, args);
    if (exportData.status !== 'completed') {
      return {
        content: [{ type: 'text', text: `Nothing to download yet. ${describeExport(exported)}` }],
        isError: true,
        structuredContent: exported,
      };
    }
    const sizeBytes = typeof exportData.sizeBytes === 'number' ? exportData.sizeBytes : undefined;
    if ((sizeBytes ?? 0) > MAX_DOWNLOAD_BYTES) return tooLargeToDownload(exported, sizeBytes);
    const response = await docs.downloadExport(presentationID, exportID, readOptions(reqContext));
    const bytes = await readExportFile(response, sizeBytes);
    if (!bytes) return tooLargeToDownload(exported);
    const downloaded = binaryDownloadResult(
      {
        contentBase64: bytes.toString('base64'),
        contentDisposition: response.headers.get('content-disposition'),
        filename: exportData.filename ?? `presentation.${exportData.format}`,
        mimeType:
          response.headers.get('content-type') ??
          EXPORT_MIME_TYPES[exportData.format] ??
          'application/octet-stream',
        byteLength: bytes.byteLength,
      },
      {
        inlineBase64Limit: BINARY_DOWNLOAD_INLINE_BASE64_LIMIT,
        sessionId: reqContext.mcpSessionId,
        storeLargeDownload: storeBinaryDownload,
        createDownloadUrl:
          reqContext.downloadBaseUrl ?
            (token) =>
              new URL(`/downloads/${encodeURIComponent(token)}`, reqContext.downloadBaseUrl).toString()
          : undefined,
      },
    );
    const summary: JsonRecord = {
      ...downloaded.structuredContent,
      export_id: exportID,
      presentation_id: presentationID,
      ...defined({ program_id: readString(args?.['program_id']) }),
    };
    const text = describeDownload(summary);
    return { content: [{ type: 'text', text }], structuredContent: { ...summary, next_action: text } };
  },
});

export const presentationTools: McpTool[] = [
  getPresentationCatalogTool,
  listPresentationsTool,
  createPresentationTool,
  getPresentationTool,
  updatePresentationTool,
  previewPresentationTool,
  startPresentationImageUploadTool,
  appendPresentationImageUploadChunkTool,
  finishPresentationImageUploadTool,
  importPresentationImageTool,
  exportPresentationTool,
  getPresentationExportTool,
  downloadPresentationExportTool,
];
