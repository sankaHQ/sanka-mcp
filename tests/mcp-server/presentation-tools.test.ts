import { readBinaryDownloadFile } from '../../packages/mcp-server/src/binary-download-store';
import { resetBinaryUploadStoreForTests } from '../../packages/mcp-server/src/binary-upload-store';
import { getCapabilityGuidanceTool } from '../../packages/mcp-server/src/capability-guidance-tools';
import {
  appendPresentationImageUploadChunkTool,
  createPresentationTool,
  downloadPresentationExportTool,
  exportPresentationTool,
  finishPresentationImageUploadTool,
  getPresentationCatalogTool,
  getPresentationExportTool,
  getPresentationTool,
  importPresentationImageTool,
  listPresentationsTool,
  presentationTools,
  previewPresentationTool,
  startPresentationImageUploadTool,
  updatePresentationTool,
} from '../../packages/mcp-server/src/presentation-tools';
import { validateToolArguments } from '../../packages/mcp-server/src/tool-argument-validator';
import type { McpTool } from '../../packages/mcp-server/src/types';
import { envelope, firstTextContent, sendThroughSDK, type V2Request } from './crm/helpers';

const API = 'http://localhost:5000/api/v2/public';
const APP = 'https://app.sanka.com';
const WS = '6f1d3c2a-5b7e-4c1d-9a2b-3c4d5e6f7a8b';
const PROGRAM = 'program-1';
const MCP_SESSION = 'mcp-session-1';
const CONTEXT = { mcpSessionId: MCP_SESSION, downloadBaseUrl: 'https://mcp.sanka.com/mcp' };
const SANKA = `${API}/ferry/programs/${PROGRAM}/presentations`;
const FLOW = `${API}/documents/presentations`;
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const ASSET = '0123456789abcdef0123456789abcdef.png';
// Every request names the MCP session: the public routes use the workspace it is bound to.
const SESSION = { 'x-sanka-mcp-session-id': MCP_SESSION };
// A write first reads that workspace, then sends it as a precondition and says it comes from MCP.
const SESSION_READ: V2Request = { method: 'GET', url: `${API}/auth/session`, headers: SESSION };
const WRITE = { ...SESSION, 'x-sanka-mcp': 'true', 'x-sanka-expected-workspace-id': WS };
const session = (id = WS) => envelope({ current_workspace: { id, code: '10101010' } });

const slide = { layout: 'none', blocks: [{ type: 'heading', level: 1, text: 'CRM migration progress' }] };
const presentation = (overrides: Record<string, unknown> = {}) => ({
  id: 'deck-1',
  programId: PROGRAM,
  workspaceId: WS,
  product: 'sanka',
  kind: 'presentation',
  title: 'Weekly review',
  revision: 1,
  deck: { schema: 'sanka.deck/v1', slides: [{ id: 's_title0000001', ...slide }] },
  slideCount: 1,
  outline: '## 1. CRM migration progress\n',
  updatedVia: 'mcp',
  updatedAt: '2026-10-08T03:00:00Z',
  appPath: `/10101010/ferry/docs?program=${PROGRAM}&doc=deck-1`,
  warnings: [],
  ...overrides,
});
const flowPresentation = (overrides: Record<string, unknown> = {}) =>
  presentation({
    id: 'deck-2',
    programId: null,
    product: 'flow',
    title: 'Kickoff',
    appPath: '/10101010/report/docs?doc=deck-2',
    ...overrides,
  });
const image = { assetId: ASSET, contentType: 'image/png', sizeBytes: 48213, width: 1600, height: 900 };

// Fifteen slides, the third hidden: the default preview batch is the first six visible ones, and
// the other eight visible slides come back as the next batches.
const slideID = (n: number) => `s_slide${String(n).padStart(7, '0')}`;
const fifteenSlides = Array.from({ length: 15 }, (_, index) => ({
  id: slideID(index + 1),
  ...slide,
  ...(index === 2 ? { hidden: true } : undefined),
}));
const firstBatch = [1, 2, 4, 5, 6, 7].map(slideID);
const jpeg = (id: string) => Buffer.from(`jpeg ${id}`).toString('base64');
const previewSlide = (id: string, fit: Record<string, unknown> = { scale: 1, overflow: null }) => ({
  slideId: id,
  index: Number(id.slice(-7)) - 1,
  image: { contentType: 'image/jpeg', base64: jpeg(id) },
  fit,
});
// A preview is sent once, with a timeout above the API's 45 s worst case.
const PREVIEW = { ...SESSION, 'x-stainless-timeout': '90' };

const errorResponse = (
  status: number,
  code: string,
  message: string,
  details: unknown,
  headers: Record<string, string> = {},
) =>
  new Response(
    JSON.stringify({ success: false, error: { code, message, details }, meta: { ctx_id: 'ctx-deck' } }),
    { status, headers: { 'Content-Type': 'application/json', ...headers } },
  );
const completedExport = (overrides: Record<string, unknown> = {}) =>
  envelope({
    id: 'export-2',
    documentId: 'deck-2',
    revision: 3,
    format: 'pptx',
    status: 'completed',
    progress: 100,
    filename: 'Kickoff.pptx',
    sizeBytes: 48213,
    downloadPath: '/v2/public/documents/presentations/deck-2/exports/export-2/download',
    ...overrides,
  });
const APP_DOWNLOAD = `${APP}/api/v2/documents/presentations/deck-2/exports/export-2/download`;
const EXPORT_STATUS: V2Request = { method: 'GET', url: `${FLOW}/deck-2/exports/export-2`, headers: SESSION };
const EXPORT_DOWNLOAD: V2Request = { ...EXPORT_STATUS, url: `${EXPORT_STATUS.url}/download` };
// A file without a declared length, sent 1 MiB at a time.
const streamedFile = (mebibytes: number) => {
  const chunk = new Uint8Array(1024 * 1024);
  let sent = 0;
  return new Response(
    new ReadableStream({ pull: (stream) => (sent++ < mebibytes ? stream.enqueue(chunk) : stream.close()) }),
    { headers: { 'Content-Type': PPTX } },
  );
};

// Each row: the tool call, the requests it must send, the API answers and what the tool returns.
const cases: Array<{
  name: string;
  tool: McpTool;
  args: Record<string, unknown>;
  responses?: Response[];
  requests: V2Request[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  text?: string[];
  images?: string[];
  maxRetries?: number;
}> = [
  {
    name: 'get_presentation_catalog summarizes page sizes, layouts, blocks, themes, limits and guidance',
    tool: getPresentationCatalogTool,
    args: {},
    responses: [
      envelope({
        schemaVersions: ['sanka.deck/v1'],
        pageSizes: [{ id: '16:9' }, { id: 'a4-landscape' }],
        layouts: [{ id: 'none' }, { id: 'accent-left', needsAccent: true }],
        blocks: [{ type: 'heading' }, { type: 'stats' }],
        themes: [{ id: 'sanka-paper', version: 1 }],
        icons: ['chart-bar', 'users'],
        limits: { slides: 200 },
        guidance: ['One message per slide.'],
      }),
    ],
    requests: [{ method: 'GET', url: `${API}/presentations/catalog`, headers: SESSION }],
    text: [
      'Page sizes: 16:9, a4-landscape.',
      'Layouts: none, accent-left (needs an accent).',
      'Blocks: heading, stats.',
      'Themes: sanka-paper v1.',
      'Icons: 2 lucide names',
      'Limits: slides 200.',
      '- One message per slide.',
    ],
  },
  {
    name: "list_presentations pages through a Sanka program's presentations without decks",
    tool: listPresentationsTool,
    args: { program_id: PROGRAM, folder_id: 'folder-1', cursor: 'cursor-1', limit: 20 },
    responses: [
      envelope({
        presentations: [
          {
            id: 'deck-1',
            programId: PROGRAM,
            product: 'sanka',
            title: 'Weekly review',
            revision: 3,
            slideCount: 12,
            pageSize: 'a4-landscape',
            themeId: 'sanka-paper',
            folderId: 'folder-1',
            pinned: false,
            updatedVia: 'app',
            updatedAt: '2026-10-08T03:00:00Z',
            appPath: `/10101010/ferry/docs?program=${PROGRAM}&doc=deck-1`,
          },
        ],
        nextCursor: 'cursor-2',
      }),
    ],
    requests: [
      {
        method: 'GET',
        url: `${SANKA}?folder_id=folder-1&cursor=cursor-1&limit=20`,
        headers: SESSION,
      },
    ],
    structuredContent: {
      presentations: [
        {
          presentation_id: 'deck-1',
          title: 'Weekly review',
          revision: 3,
          product: 'sanka',
          program_id: PROGRAM,
          slide_count: 12,
          page_size: 'a4-landscape',
          theme_id: 'sanka-paper',
          folder_id: 'folder-1',
          pinned: false,
          updated_via: 'app',
          updated_at: '2026-10-08T03:00:00Z',
          app_url: `${APP}/10101010/ferry/docs?program=${PROGRAM}&doc=deck-1`,
        },
      ],
      next_cursor: 'cursor-2',
    },
    text: [
      '- "Weekly review" (12 slides, a4-landscape, revision 3, updated 2026-10-08T03:00:00Z via app): presentation_id deck-1',
      'More: call list_presentations again with cursor cursor-2.',
    ],
  },
  {
    name: 'create_presentation wraps slides in a deck in a Sanka program and links the app',
    tool: createPresentationTool,
    args: {
      program_id: PROGRAM,
      title: 'Weekly review',
      slides: [slide],
      theme: { id: 'sanka-paper' },
      footer: { text: 'Example Inc.' },
      source_ref: 'weekly-2026-10-08',
      expected_workspace_id: WS,
    },
    responses: [
      session(),
      envelope(
        presentation({
          warnings: [{ code: 'TEXT_LONG', path: '/slides/0/blocks/0/text', message: 'Over 30 characters' }],
        }),
      ),
    ],
    requests: [
      SESSION_READ,
      {
        method: 'POST',
        url: SANKA,
        headers: WRITE,
        body: {
          title: 'Weekly review',
          pageSize: '16:9',
          deck: { schema: 'sanka.deck/v1', footer: { text: 'Example Inc.' }, slides: [slide] },
          theme: { id: 'sanka-paper' },
          sourceRef: 'weekly-2026-10-08',
        },
      },
    ],
    structuredContent: {
      presentation_id: 'deck-1',
      revision: 1,
      product: 'sanka',
      program_id: PROGRAM,
      slide_count: 1,
      app_url: `${APP}/10101010/ferry/docs?program=${PROGRAM}&doc=deck-1`,
    },
    text: [
      'Created presentation "Weekly review" (1 slide, revision 1)',
      '- /slides/0/blocks/0/text: Over 30 characters (TEXT_LONG)',
    ],
  },
  {
    name: 'create_presentation lays Markdown out as an A4 Sanka Flow deck in a folder, with a theme',
    tool: createPresentationTool,
    args: {
      title: 'Proposal',
      page_size: 'a4-landscape',
      markdown: '# Proposal\n\n---\n\n## Scope\n\n- CRM',
      theme: { id: 'ink' },
      folder_id: 'folder-2',
      expected_workspace_id: WS,
    },
    responses: [session(), envelope(flowPresentation({ title: 'Proposal' }))],
    requests: [
      SESSION_READ,
      {
        method: 'POST',
        url: FLOW,
        headers: WRITE,
        body: {
          title: 'Proposal',
          pageSize: 'a4-landscape',
          markdown: '# Proposal\n\n---\n\n## Scope\n\n- CRM',
          theme: { id: 'ink' },
          folderId: 'folder-2',
        },
      },
    ],
    structuredContent: {
      presentation_id: 'deck-2',
      product: 'flow',
      program_id: null,
      app_url: `${APP}/10101010/report/docs?doc=deck-2`,
    },
  },
  {
    name: 'create_presentation converts a Markdown Doc',
    tool: createPresentationTool,
    args: { title: 'Kickoff', source_doc_id: 'doc-9', expected_workspace_id: WS },
    responses: [session(), envelope(flowPresentation())],
    requests: [
      SESSION_READ,
      {
        method: 'POST',
        url: FLOW,
        headers: WRITE,
        body: { title: 'Kickoff', pageSize: '16:9', sourceDocumentId: 'doc-9' },
      },
    ],
    structuredContent: { presentation_id: 'deck-2' },
  },
  {
    name: 'create_presentation refuses two sources and sends nothing',
    tool: createPresentationTool,
    args: { title: 'Kickoff', slides: [slide], markdown: '# Kickoff', expected_workspace_id: WS },
    requests: [],
    isError: true,
    text: ['Pass only one of `slides`, `markdown` and `source_doc_id`'],
  },
  {
    name: 'create_presentation refuses a footer without slides and sends nothing',
    tool: createPresentationTool,
    args: { title: 'Kickoff', footer: { text: 'Example Inc.' }, expected_workspace_id: WS },
    requests: [],
    isError: true,
    text: ['Pass `slides` with `footer`'],
  },
  {
    name: "create_presentation stops before the write when the MCP session's workspace is another",
    tool: createPresentationTool,
    args: { title: 'Kickoff', expected_workspace_id: WS },
    responses: [session('workspace-b')],
    requests: [SESSION_READ],
    isError: true,
    structuredContent: {
      code: 'WORKSPACE_CONTEXT_MISMATCH',
      error: 'WORKSPACE_CONTEXT_MISMATCH',
      details: { expected_workspace_id: WS, current_workspace_id: 'workspace-b' },
    },
    text: ['Nothing was changed (WORKSPACE_CONTEXT_MISMATCH)', 'Never retry in another workspace.'],
  },
  {
    name: 'create_presentation lists the JSON Pointer paths of an invalid deck',
    tool: createPresentationTool,
    args: { title: 'Kickoff', slides: [{ layout: 'accent-left', blocks: [] }], expected_workspace_id: WS },
    responses: [
      session(),
      errorResponse(422, 'PRESENTATION_INVALID', 'Presentation is invalid at /deck/slides/0.', {
        errors: [{ path: '/deck/slides/0', message: "layout 'accent-left' needs an accent" }],
      }),
    ],
    requests: [
      SESSION_READ,
      {
        method: 'POST',
        url: FLOW,
        headers: WRITE,
        body: {
          title: 'Kickoff',
          pageSize: '16:9',
          deck: { schema: 'sanka.deck/v1', slides: [{ layout: 'accent-left', blocks: [] }] },
        },
      },
    ],
    isError: true,
    structuredContent: { status_code: 422, code: 'PRESENTATION_INVALID' },
    text: [
      'Nothing was changed (PRESENTATION_INVALID)',
      "Fix: /deck/slides/0: layout 'accent-left' needs an accent.",
    ],
  },
  {
    name: 'get_presentation reads a Sanka program deck as an outline',
    tool: getPresentationTool,
    args: { presentation_id: 'deck-1', program_id: PROGRAM, include: 'outline' },
    responses: [envelope(presentation({ revision: 4 }))],
    requests: [{ method: 'GET', url: `${SANKA}/deck-1`, headers: SESSION }],
    structuredContent: { revision: 4, updated_via: 'mcp', outline: '## 1. CRM migration progress\n' },
    text: ['Presentation "Weekly review" (1 slide, revision 4)', '## 1. CRM migration progress'],
  },
  {
    name: 'get_presentation returns the deck with its ids by default',
    tool: getPresentationTool,
    args: { presentation_id: 'deck-2' },
    responses: [envelope(flowPresentation())],
    requests: [{ method: 'GET', url: `${FLOW}/deck-2`, headers: SESSION }],
    structuredContent: { presentation_id: 'deck-2', deck: presentation().deck },
    text: ['pass revision 1 as expected_revision'],
  },
  {
    name: 'update_presentation sends ops, then a new title as set_title, at the expected revision',
    tool: updatePresentationTool,
    args: {
      presentation_id: 'deck-1',
      program_id: PROGRAM,
      expected_revision: 1,
      ops: [
        {
          op: 'update_block',
          slideId: 's_title0000001',
          blockId: 'b_title0000001',
          set: { text: 'On track' },
        },
      ],
      title: 'Weekly review 10/08',
      expected_workspace_id: WS,
    },
    responses: [session(), envelope(presentation({ title: 'Weekly review 10/08', revision: 2 }))],
    requests: [
      SESSION_READ,
      {
        method: 'PATCH',
        url: `${SANKA}/deck-1`,
        headers: WRITE,
        body: {
          expectedRevision: 1,
          ops: [
            {
              op: 'update_block',
              slideId: 's_title0000001',
              blockId: 'b_title0000001',
              set: { text: 'On track' },
            },
            { op: 'set_title', title: 'Weekly review 10/08' },
          ],
        },
      },
    ],
    structuredContent: { presentation_id: 'deck-1', revision: 2, title: 'Weekly review 10/08' },
    text: ['Updated presentation "Weekly review 10/08" (1 slide, revision 2)'],
  },
  {
    name: 'update_presentation replaces the whole deck with PUT',
    tool: updatePresentationTool,
    args: {
      presentation_id: 'deck-2',
      expected_revision: 2,
      deck: { schema: 'sanka.deck/v1', slides: [slide] },
      title: 'Kickoff',
      expected_workspace_id: WS,
    },
    responses: [session(), envelope(flowPresentation({ revision: 3 }))],
    requests: [
      SESSION_READ,
      {
        method: 'PUT',
        url: `${FLOW}/deck-2`,
        headers: WRITE,
        body: { expectedRevision: 2, title: 'Kickoff', deck: { schema: 'sanka.deck/v1', slides: [slide] } },
      },
    ],
    structuredContent: { presentation_id: 'deck-2', revision: 3 },
  },
  {
    name: "update_presentation sends a title alone as set_title and reports the API's workspace mismatch",
    tool: updatePresentationTool,
    args: { presentation_id: 'deck-2', expected_revision: 3, title: 'Kickoff v2', expected_workspace_id: WS },
    responses: [
      session(),
      errorResponse(409, 'WORKSPACE_CONTEXT_MISMATCH', 'The intended workspace does not match.', {
        expected_workspace_id: WS,
        current_workspace_id: 'workspace-b',
        current_workspace_code: '20202020',
      }),
    ],
    requests: [
      SESSION_READ,
      {
        method: 'PATCH',
        url: `${FLOW}/deck-2`,
        headers: WRITE,
        body: { expectedRevision: 3, ops: [{ op: 'set_title', title: 'Kickoff v2' }] },
      },
    ],
    isError: true,
    structuredContent: { status_code: 409, error: 'WORKSPACE_CONTEXT_MISMATCH' },
    text: ['Nothing was changed (WORKSPACE_CONTEXT_MISMATCH): this request resolves to workspace 20202020'],
  },
  {
    name: 'update_presentation surfaces a revision conflict and says nothing changed',
    tool: updatePresentationTool,
    args: {
      presentation_id: 'deck-1',
      program_id: PROGRAM,
      expected_revision: 1,
      ops: [{ op: 'set_footer', footer: { pageNumbers: false } }],
      expected_workspace_id: WS,
    },
    responses: [
      session(),
      errorResponse(409, 'PRESENTATION_REVISION_CONFLICT', 'The presentation changed since it was read.', {
        currentRevision: 4,
      }),
    ],
    requests: [
      SESSION_READ,
      {
        method: 'PATCH',
        url: `${SANKA}/deck-1`,
        headers: WRITE,
        body: { expectedRevision: 1, ops: [{ op: 'set_footer', footer: { pageNumbers: false } }] },
      },
    ],
    isError: true,
    structuredContent: {
      status_code: 409,
      code: 'PRESENTATION_REVISION_CONFLICT',
      current_revision: 4,
      ctx_id: 'ctx-deck',
    },
    text: [
      'Nothing was changed (PRESENTATION_REVISION_CONFLICT)',
      'Call get_presentation, then re-apply only your intended change with expected_revision 4.',
    ],
  },
  {
    name: 'update_presentation without ops, deck or title sends nothing',
    tool: updatePresentationTool,
    args: { presentation_id: 'deck-1', expected_revision: 1, expected_workspace_id: WS },
    requests: [],
    isError: true,
    text: ['Pass `ops`, `deck` or `title`.'],
  },
  {
    name: "update_presentation lists a VALIDATION_ERROR's request problems as JSON Pointers",
    tool: updatePresentationTool,
    args: {
      presentation_id: 'deck-2',
      expected_revision: 3,
      ops: [{ op: 'update_block', slideId: 's_title0000001', color: 'red', set: {} }],
      expected_workspace_id: WS,
    },
    responses: [
      session(),
      errorResponse(422, 'VALIDATION_ERROR', 'Validation failed', [
        { loc: ['body', 'ops', 0, 'update_block', 'blockId'], msg: 'Field required', type: 'missing' },
        {
          loc: ['body', 'ops', 0, 'update_block', 'color'],
          msg: 'Extra inputs are not permitted',
          type: 'extra_forbidden',
        },
      ]),
    ],
    requests: [
      SESSION_READ,
      {
        method: 'PATCH',
        url: `${FLOW}/deck-2`,
        headers: WRITE,
        body: {
          expectedRevision: 3,
          ops: [{ op: 'update_block', slideId: 's_title0000001', color: 'red', set: {} }],
        },
      },
    ],
    isError: true,
    structuredContent: {
      status_code: 422,
      code: 'VALIDATION_ERROR',
      details: [
        { loc: ['body', 'ops', 0, 'update_block', 'blockId'], msg: 'Field required', type: 'missing' },
        {
          loc: ['body', 'ops', 0, 'update_block', 'color'],
          msg: 'Extra inputs are not permitted',
          type: 'extra_forbidden',
        },
      ],
    },
    text: ['Fix: /ops/0/blockId: Field required; /ops/0/color: Extra inputs are not permitted.'],
  },
  {
    name: 'preview_presentation previews the first six visible slides, reports overflow and pages the rest',
    tool: previewPresentationTool,
    args: { presentation_id: 'deck-2' },
    responses: [
      envelope(flowPresentation({ revision: 5, deck: { schema: 'sanka.deck/v1', slides: fifteenSlides } })),
      envelope({
        revision: 5,
        slides: firstBatch.map((id) =>
          id === slideID(2) ?
            previewSlide(id, { scale: 0.8, overflow: { blockIds: ['b_table0000001'], overflowPx: 37 } })
          : previewSlide(id),
        ),
        warnings: [
          { code: 'SLIDE_OVERFLOW', slideId: slideID(2), message: 'Content does not fit.' },
          {
            code: 'IMAGE_ALT_MISSING',
            slideId: slideID(4),
            blockId: 'b_image0000001',
            message: 'The image has no alt text.',
          },
        ],
      }),
    ],
    requests: [
      { method: 'GET', url: `${FLOW}/deck-2`, headers: SESSION },
      {
        method: 'POST',
        url: `${FLOW}/deck-2/previews`,
        headers: PREVIEW,
        body: { slideIds: firstBatch, width: 960, format: 'jpeg' },
      },
    ],
    structuredContent: {
      presentation_id: 'deck-2',
      revision: 5,
      width: 960,
      overflowing_slide_ids: [slideID(2)],
      next_slide_ids: [8, 9, 10, 11, 12, 13].map(slideID),
      next_slide_id_batches: [[8, 9, 10, 11, 12, 13].map(slideID), [14, 15].map(slideID)],
      slides: expect.arrayContaining([
        {
          slide_id: slideID(2),
          index: 1,
          fit: { scale: 0.8, overflow: { block_ids: ['b_table0000001'], overflow_px: 37 } },
        },
        { slide_id: slideID(4), index: 3, fit: { scale: 1, overflow: null } },
      ]),
    },
    text: [
      `- Slide 2 (${slideID(2)}): SLIDE_OVERFLOW by 37 px in b_table0000001`,
      'Fix every SLIDE_OVERFLOW before exporting',
      `- ${slideID(4)}/b_image0000001: The image has no alt text. (IMAGE_ALT_MISSING)`,
      `Next: preview_presentation with slide_ids ${JSON.stringify(
        [8, 9, 10, 11, 12, 13].map(slideID),
      )}, then the 1 batch after it`,
    ],
    images: firstBatch.map(jpeg),
  },
  {
    name: 'preview_presentation previews the given slides of a Sanka program deck at the given width',
    tool: previewPresentationTool,
    args: { presentation_id: 'deck-1', program_id: PROGRAM, slide_ids: [slideID(1)], width: 1280 },
    responses: [envelope({ revision: 2, slides: [previewSlide(slideID(1))], warnings: [] })],
    requests: [
      {
        method: 'POST',
        url: `${SANKA}/deck-1/previews`,
        headers: PREVIEW,
        body: { slideIds: [slideID(1)], width: 1280, format: 'jpeg' },
      },
    ],
    structuredContent: { program_id: PROGRAM, revision: 2, width: 1280, overflowing_slide_ids: [] },
    text: ['Every previewed slide fits.'],
    images: [jpeg(slideID(1))],
  },
  {
    name: 'preview_presentation sends a preview once even when the client would retry, as each counts against the hourly limit',
    tool: previewPresentationTool,
    args: { presentation_id: 'deck-2', slide_ids: [slideID(1)] },
    maxRetries: 2,
    responses: [1, 2, 3].map(() =>
      errorResponse(
        429,
        'RATE_LIMITED',
        'Too many previews.',
        { retryAfterSeconds: 600 },
        { 'retry-after-ms': '0' },
      ),
    ),
    requests: [
      {
        method: 'POST',
        url: `${FLOW}/deck-2/previews`,
        headers: PREVIEW,
        body: { slideIds: [slideID(1)], width: 960, format: 'jpeg' },
      },
    ],
    isError: true,
    structuredContent: { status_code: 429, code: 'RATE_LIMITED' },
    text: ['Wait 600 seconds before trying again.'],
  },
  {
    name: 'import_presentation_image fetches a URL into a Sanka program deck and returns its asset_id',
    tool: importPresentationImageTool,
    args: {
      presentation_id: 'deck-1',
      program_id: PROGRAM,
      url: 'https://example.com/chart.png',
      alt: 'Monthly records chart',
      expected_workspace_id: WS,
    },
    responses: [session(), envelope({ ...image, alt: 'Monthly records chart' })],
    requests: [
      SESSION_READ,
      {
        method: 'POST',
        url: `${SANKA}/deck-1/images/import`,
        headers: WRITE,
        body: { url: 'https://example.com/chart.png', alt: 'Monthly records chart' },
      },
    ],
    structuredContent: {
      asset_id: ASSET,
      presentation_id: 'deck-1',
      program_id: PROGRAM,
      width: 1600,
      height: 900,
      alt: 'Monthly records chart',
    },
    text: [`{"type":"image","assetId":"${ASSET}","alt":"Monthly records chart"}`],
  },
  {
    name: 'import_presentation_image explains a blocked URL',
    tool: importPresentationImageTool,
    args: { presentation_id: 'deck-2', url: 'https://10.0.0.1/chart.png', expected_workspace_id: WS },
    responses: [
      session(),
      errorResponse(
        422,
        'IMAGE_IMPORT_BLOCKED',
        'That URL cannot be imported: use a public https:// address.',
        {
          reason: 'private address',
        },
      ),
    ],
    requests: [
      SESSION_READ,
      {
        method: 'POST',
        url: `${FLOW}/deck-2/images/import`,
        headers: WRITE,
        body: { url: 'https://10.0.0.1/chart.png' },
      },
    ],
    isError: true,
    structuredContent: { status_code: 422, code: 'IMAGE_IMPORT_BLOCKED' },
    text: ['Reason: private address. Use a PNG, JPEG or WebP image up to 10 MiB'],
  },
  {
    name: 'export_presentation starts a pptx export with its idempotency key and the workspace precondition',
    tool: exportPresentationTool,
    args: {
      presentation_id: 'deck-1',
      program_id: PROGRAM,
      slide_ids: ['s_title0000001'],
      include_notes: false,
      idempotency_key: 'weekly-1008-pptx',
      expected_workspace_id: WS,
    },
    responses: [
      session(),
      envelope({ id: 'export-1', documentId: 'deck-1', revision: 2, status: 'queued', progress: 0 }),
    ],
    requests: [
      SESSION_READ,
      {
        method: 'POST',
        url: `${SANKA}/deck-1/exports`,
        headers: { ...WRITE, 'idempotency-key': 'weekly-1008-pptx' },
        body: { format: 'pptx', slideIds: ['s_title0000001'], includeNotes: false },
      },
    ],
    structuredContent: { export_id: 'export-1', status: 'queued', progress: 0, revision: 2 },
    text: [
      `Call get_presentation_export with presentation_id deck-1, program_id ${PROGRAM} and export_id export-1`,
    ],
  },
  {
    name: 'export_presentation starts a PDF export',
    tool: exportPresentationTool,
    args: {
      presentation_id: 'deck-2',
      format: 'pdf',
      include_hidden: true,
      idempotency_key: 'kickoff-pdf',
      expected_workspace_id: WS,
    },
    responses: [
      session(),
      envelope({ id: 'export-3', documentId: 'deck-2', revision: 3, format: 'pdf', status: 'queued' }),
    ],
    requests: [
      SESSION_READ,
      {
        method: 'POST',
        url: `${FLOW}/deck-2/exports`,
        headers: { ...WRITE, 'idempotency-key': 'kickoff-pdf' },
        body: { format: 'pdf', includeHidden: true },
      },
    ],
    structuredContent: { export_id: 'export-3', format: 'pdf', status: 'queued' },
  },
  {
    name: 'Google Slides export returns the editable link without a binary download',
    tool: exportPresentationTool,
    args: {
      presentation_id: 'deck-2',
      format: 'google_slides',
      idempotency_key: 'drive-new',
      expected_workspace_id: WS,
    },
    responses: [
      session(),
      envelope({
        id: 'export-drive',
        documentId: 'deck-2',
        revision: 3,
        format: 'google_slides',
        status: 'completed',
        googleSlidesUrl: 'https://docs.google.com/presentation/d/new-file/edit',
      }),
    ],
    requests: [
      SESSION_READ,
      {
        method: 'POST',
        url: `${FLOW}/deck-2/exports`,
        headers: { ...WRITE, 'idempotency-key': 'drive-new' },
        body: { format: 'google_slides' },
      },
    ],
    structuredContent: {
      export_id: 'export-drive',
      google_slides_url: 'https://docs.google.com/presentation/d/new-file/edit',
      status: 'completed',
    },
    text: ['Open the editable presentation', 'https://docs.google.com/presentation/d/new-file/edit'],
  },
  {
    name: "get_presentation_export links a completed export through the Sanka app's API proxy and MCP",
    tool: getPresentationExportTool,
    args: { presentation_id: 'deck-2', export_id: 'export-2' },
    responses: [completedExport()],
    requests: [EXPORT_STATUS],
    structuredContent: { status: 'completed', app_download_url: APP_DOWNLOAD },
    text: [
      'Kickoff.pptx (48213 bytes, revision 3)',
      'in a browser signed in to Sanka',
      'call download_presentation_export with presentation_id deck-2 and export_id export-2',
    ],
  },
  {
    name: 'get_presentation_export reports a failed export and asks for a new idempotency key',
    tool: getPresentationExportTool,
    args: { presentation_id: 'deck-1', program_id: PROGRAM, export_id: 'export-1' },
    responses: [
      envelope({
        id: 'export-1',
        status: 'failed',
        errorCode: 'RENDER_TIMEOUT',
        errorMessage: 'Rendering took too long.',
      }),
    ],
    requests: [{ method: 'GET', url: `${SANKA}/deck-1/exports/export-1`, headers: SESSION }],
    structuredContent: { status: 'failed', error_code: 'RENDER_TIMEOUT' },
    text: ['Export export-1 failed (RENDER_TIMEOUT): Rendering took too long.', 'a new idempotency_key'],
  },
  {
    name: 'download_presentation_export downloads nothing before the export is completed',
    tool: downloadPresentationExportTool,
    args: { presentation_id: 'deck-2', export_id: 'export-2' },
    responses: [completedExport({ status: 'rendering', progress: 40, downloadPath: null })],
    requests: [EXPORT_STATUS],
    isError: true,
    text: ['Nothing to download yet. Export export-2 is rendering (40%).'],
  },
  {
    name: 'download_presentation_export says only an unexpired export downloads',
    tool: downloadPresentationExportTool,
    args: { presentation_id: 'deck-2', export_id: 'export-2' },
    responses: [
      completedExport(),
      errorResponse(404, 'PRESENTATION_EXPORT_NOT_FOUND', 'Presentation export not found.', {}),
    ],
    requests: [EXPORT_STATUS, EXPORT_DOWNLOAD],
    isError: true,
    structuredContent: { status_code: 404, code: 'PRESENTATION_EXPORT_NOT_FOUND' },
    text: ['Only a completed export can be downloaded, for 7 days'],
  },
  {
    name: 'download_presentation_export refuses an export over 25 MiB by its size, before downloading it',
    tool: downloadPresentationExportTool,
    args: { presentation_id: 'deck-2', export_id: 'export-2' },
    responses: [completedExport({ sizeBytes: 30 * 1024 * 1024 })],
    requests: [EXPORT_STATUS],
    isError: true,
    structuredContent: { app_download_url: APP_DOWNLOAD, max_download_bytes: 25 * 1024 * 1024 },
    text: [`Kickoff.pptx (31457280 bytes) is larger than the 25 MiB that can pass through MCP`, APP_DOWNLOAD],
  },
  {
    name: 'download_presentation_export stops reading a file of unknown size past 25 MiB',
    tool: downloadPresentationExportTool,
    args: { presentation_id: 'deck-2', export_id: 'export-2' },
    responses: [completedExport({ sizeBytes: null }), streamedFile(26)],
    requests: [EXPORT_STATUS, EXPORT_DOWNLOAD],
    isError: true,
    text: ['larger than the 25 MiB that can pass through MCP'],
  },
  {
    name: 'get_capability_guidance routes a deck about a migration to the presentation tools',
    tool: getCapabilityGuidanceTool,
    args: { intent: 'Turn the CRM migration status into a slide deck' },
    requests: [],
    structuredContent: {
      guidance: {
        intent_family: 'sanka_doc_presentations',
        recommended_tools: expect.arrayContaining([
          'get_presentation_catalog',
          'create_presentation',
          'preview_presentation',
        ]),
      },
    },
  },
];

// The published contract of an input schema: each property's type or enum, and the required inputs.
const inputContract = ({ tool }: McpTool) => ({
  properties: Object.fromEntries(
    Object.entries((tool.inputSchema.properties ?? {}) as Record<string, Record<string, unknown>>).map(
      ([name, schema]) => [name, schema['enum'] ?? schema['type']],
    ),
  ),
  required: tool.inputSchema.required ?? [],
});

const ID = { presentation_id: 'string', program_id: 'string' };
const WRITE_INPUT = { expected_workspace_id: 'string' };

describe('presentation tools', () => {
  it('publishes the tool names and their input schemas', () => {
    expect(
      Object.fromEntries(presentationTools.map((tool) => [tool.tool.name, inputContract(tool)])),
    ).toEqual({
      get_presentation_catalog: { properties: {}, required: [] },
      list_presentations: {
        properties: { program_id: 'string', folder_id: 'string', cursor: 'string', limit: 'integer' },
        required: [],
      },
      create_presentation: {
        properties: {
          program_id: 'string',
          title: 'string',
          page_size: ['16:9', 'a4-landscape'],
          slides: 'array',
          markdown: 'string',
          source_doc_id: 'string',
          theme: 'object',
          footer: 'object',
          folder_id: 'string',
          source_ref: 'string',
          ...WRITE_INPUT,
        },
        required: ['title', 'expected_workspace_id'],
      },
      get_presentation: {
        properties: { ...ID, include: ['deck', 'outline'] },
        required: ['presentation_id'],
      },
      update_presentation: {
        properties: {
          ...ID,
          expected_revision: 'integer',
          ops: 'array',
          deck: 'object',
          title: 'string',
          ...WRITE_INPUT,
        },
        required: ['presentation_id', 'expected_revision', 'expected_workspace_id'],
      },
      preview_presentation: {
        properties: { ...ID, slide_ids: 'array', width: [640, 960, 1280] },
        required: ['presentation_id'],
      },
      start_presentation_image_upload: {
        properties: {
          filename: 'string',
          mime_type: 'string',
          content_base64_length: 'number',
          byte_length: 'number',
        },
        required: ['filename', 'content_base64_length'],
      },
      append_presentation_image_upload_chunk: {
        properties: { upload_token: 'string', token: 'string', offset: 'number', content_base64: 'string' },
        required: ['content_base64'],
      },
      finish_presentation_image_upload: {
        properties: { upload_token: 'string', token: 'string', ...ID, alt: 'string', ...WRITE_INPUT },
        required: ['presentation_id', 'expected_workspace_id'],
      },
      import_presentation_image: {
        properties: { ...ID, url: 'string', alt: 'string', ...WRITE_INPUT },
        required: ['presentation_id', 'url', 'expected_workspace_id'],
      },
      export_presentation: {
        properties: {
          ...ID,
          format: ['pptx', 'pdf', 'google_slides'],
          slide_ids: 'array',
          include_hidden: 'boolean',
          include_notes: 'boolean',
          idempotency_key: 'string',
          ...WRITE_INPUT,
        },
        required: ['presentation_id', 'idempotency_key', 'expected_workspace_id'],
      },
      get_presentation_export: {
        properties: { ...ID, export_id: 'string' },
        required: ['presentation_id', 'export_id'],
      },
      download_presentation_export: {
        properties: { ...ID, export_id: 'string' },
        required: ['presentation_id', 'export_id'],
      },
    });
  });

  it.each(cases)(
    '$name',
    async ({
      tool,
      args,
      responses = [],
      requests,
      isError = false,
      structuredContent,
      text = [],
      images,
      maxRetries,
    }) => {
      expect(validateToolArguments({ mcpTool: tool, args })).toBeUndefined();

      const { requests: sent, result } = await sendThroughSDK({
        tool,
        args,
        responses,
        context: CONTEXT,
        ...(maxRetries ? { maxRetries } : undefined),
      });

      expect(sent).toEqual(requests);
      expect(result.isError === true).toBe(isError);
      if (structuredContent) {
        expect(result.structuredContent).toMatchObject(structuredContent);
      }
      for (const fact of text) {
        expect(firstTextContent(result)).toContain(fact);
      }
      if (images) {
        expect(result.content.filter((block) => block.type === 'image')).toEqual(
          images.map((data) => ({ type: 'image', data, mimeType: 'image/jpeg' })),
        );
      }
    },
  );

  it('stages an image in chunks, keeps it through refusals of the request, and posts it as multipart', async () => {
    resetBinaryUploadStoreForTests();
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64');
    const call = (tool: McpTool, args: Record<string, unknown>, responses: Response[] = []) =>
      sendThroughSDK({ tool, args, responses, context: CONTEXT });
    const stage = async () => {
      const started = await call(startPresentationImageUploadTool, {
        filename: 'chart.png',
        mime_type: 'image/png',
        content_base64_length: png.length,
      });
      const uploadToken = started.result.structuredContent?.['upload_token'];
      await call(appendPresentationImageUploadChunkTool, {
        upload_token: uploadToken,
        content_base64: png.slice(0, 12),
      });
      await call(appendPresentationImageUploadChunkTool, {
        upload_token: uploadToken,
        offset: 12,
        content_base64: png.slice(12),
      });
      return uploadToken;
    };
    const finish = {
      upload_token: await stage(),
      presentation_id: 'deck-1',
      program_id: PROGRAM,
      alt: 'Monthly records chart',
      expected_workspace_id: WS,
    };
    const upload: V2Request = {
      method: 'POST',
      url: `${SANKA}/deck-1/images`,
      headers: WRITE,
      multipart: {
        file: { filename: 'chart.png', type: 'image/png', base64: png },
        alt: 'Monthly records chart',
      },
    };
    expect(
      validateToolArguments({ mcpTool: finishPresentationImageUploadTool, args: finish }),
    ).toBeUndefined();

    // Refused before the image is sent, then by the API about the request: the image stays staged.
    const refused = await call(finishPresentationImageUploadTool, finish, [session('workspace-b')]);
    expect(refused.requests).toEqual([SESSION_READ]);
    expect(refused.result.structuredContent).toMatchObject({
      code: 'WORKSPACE_CONTEXT_MISMATCH',
      upload_kept: true,
    });
    const notFound = await call(finishPresentationImageUploadTool, finish, [
      session(),
      errorResponse(404, 'NOT_FOUND', 'Presentation not found.', {}),
    ]);
    expect(notFound.requests).toEqual([SESSION_READ, upload]);
    expect(notFound.result.structuredContent).toMatchObject({ status_code: 404, upload_kept: true });

    const finished = await call(finishPresentationImageUploadTool, finish, [
      session(),
      envelope({ ...image, alt: 'Monthly records chart' }),
    ]);
    expect(finished.requests).toEqual([SESSION_READ, upload]);
    expect(finished.result.isError).toBeUndefined();
    expect(finished.result.structuredContent).toMatchObject({
      asset_id: ASSET,
      presentation_id: 'deck-1',
      program_id: PROGRAM,
      byte_length: 16,
      completion_status: 'uploaded',
    });

    // An answer about the image itself closes the upload.
    const unsupported = { ...finish, upload_token: await stage() };
    const rejected = await call(finishPresentationImageUploadTool, unsupported, [
      session(),
      errorResponse(415, 'IMAGE_UNSUPPORTED', 'Only PNG, JPEG and WebP images are supported.', {}),
    ]);
    expect(rejected.result.structuredContent).toMatchObject({
      code: 'IMAGE_UNSUPPORTED',
      upload_kept: false,
    });
    const closed = await call(finishPresentationImageUploadTool, unsupported, [session()]);
    expect(firstTextContent(closed.result)).toContain('Upload token was not found');
  });

  it('download_presentation_export passes the file through the session-bound download store', async () => {
    const file = Buffer.alloc(40_000, 7);
    const { requests, result } = await sendThroughSDK({
      tool: downloadPresentationExportTool,
      args: { presentation_id: 'deck-2', export_id: 'export-2' },
      responses: [
        completedExport({ sizeBytes: file.byteLength }),
        new Response(file, {
          headers: { 'Content-Type': PPTX, 'Content-Disposition': 'attachment; filename="Kickoff.pptx"' },
        }),
      ],
      context: CONTEXT,
    });

    expect(requests).toEqual([EXPORT_STATUS, EXPORT_DOWNLOAD]);
    const downloadToken = String(result.structuredContent?.['download_token']);
    expect(result.structuredContent).toMatchObject({
      export_id: 'export-2',
      presentation_id: 'deck-2',
      filename: 'Kickoff.pptx',
      mime_type: PPTX,
      byte_length: file.byteLength,
      completion_status: 'download_url_ready',
      download_url: `https://mcp.sanka.com/downloads/${downloadToken}`,
    });
    expect(firstTextContent(result)).toContain('Download it from download_url with the current MCP session');
    expect(readBinaryDownloadFile({ downloadToken, sessionId: MCP_SESSION })).toMatchObject({
      ok: true,
      contentBase64: file.toString('base64'),
    });
    expect(readBinaryDownloadFile({ downloadToken, sessionId: 'another-session' })).toMatchObject({
      ok: false,
      reason: 'session_mismatch',
    });
  });
});
