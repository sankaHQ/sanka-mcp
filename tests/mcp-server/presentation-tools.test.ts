import { getCapabilityGuidanceTool } from '../../packages/mcp-server/src/capability-guidance-tools';
import {
  createPresentationTool,
  exportPresentationTool,
  getPresentationCatalogTool,
  getPresentationExportTool,
  getPresentationTool,
  presentationTools,
  updatePresentationTool,
} from '../../packages/mcp-server/src/presentation-tools';
import { validateToolArguments } from '../../packages/mcp-server/src/tool-argument-validator';
import type { McpTool } from '../../packages/mcp-server/src/types';
import { envelope, firstTextContent, sendThroughSDK, type V2Request } from './crm/helpers';

const API = 'http://localhost:5000/api/v2';
const APP = 'https://app.sanka.com';
const WS = '6f1d3c2a-5b7e-4c1d-9a2b-3c4d5e6f7a8b';
const PROGRAM = 'program-1';
const SANKA = `${API}/ferry/programs/${PROGRAM}/presentations`;
const FLOW = `${API}/documents/presentations`;
// Every write first reads the workspace this request resolves to, then sends it as a precondition.
const SESSION_READ: V2Request = { method: 'GET', url: `${API}/auth/session` };
const PIN = { 'x-sanka-expected-workspace-id': WS };
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

const errorResponse = (status: number, code: string, message: string, details: Record<string, unknown>) =>
  new Response(
    JSON.stringify({ success: false, error: { code, message, details }, meta: { ctx_id: 'ctx-deck' } }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );

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
}> = [
  {
    name: 'get_presentation_catalog summarizes layouts, blocks, themes, limits and guidance',
    tool: getPresentationCatalogTool,
    args: {},
    responses: [
      envelope({
        schemaVersions: ['sanka.deck/v1'],
        layouts: [{ id: 'none' }, { id: 'accent-left', needsAccent: true }],
        blocks: [{ type: 'heading' }, { type: 'stats' }],
        themes: [{ id: 'sanka-paper', version: 1 }],
        limits: { slides: 200 },
        guidance: ['One message per slide.'],
      }),
    ],
    requests: [{ method: 'GET', url: `${API}/presentations/catalog` }],
    text: [
      'Layouts: none, accent-left (needs an accent).',
      'Blocks: heading, stats.',
      'Themes: sanka-paper v1.',
      'Limits: slides 200.',
      '- One message per slide.',
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
        headers: PIN,
        body: {
          title: 'Weekly review',
          deck: {
            schema: 'sanka.deck/v1',
            page: { size: '16:9' },
            theme: { id: 'sanka-paper' },
            footer: { text: 'Example Inc.' },
            slides: [slide],
          },
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
    name: 'create_presentation without slides sends no deck and creates a Sanka Flow deck',
    tool: createPresentationTool,
    args: { title: 'Kickoff', expected_workspace_id: WS },
    responses: [session(), envelope(flowPresentation())],
    requests: [SESSION_READ, { method: 'POST', url: FLOW, headers: PIN, body: { title: 'Kickoff' } }],
    structuredContent: {
      presentation_id: 'deck-2',
      product: 'flow',
      program_id: null,
      app_url: `${APP}/10101010/report/docs?doc=deck-2`,
    },
  },
  {
    name: 'create_presentation refuses a theme without slides and sends nothing',
    tool: createPresentationTool,
    args: { title: 'Kickoff', theme: { id: 'sanka-paper' }, expected_workspace_id: WS },
    requests: [],
    isError: true,
    text: ['Pass `slides` with `theme` or `footer`'],
  },
  {
    name: 'create_presentation stops before the write when the request resolves to another workspace',
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
        headers: PIN,
        body: {
          title: 'Kickoff',
          deck: {
            schema: 'sanka.deck/v1',
            page: { size: '16:9' },
            slides: [{ layout: 'accent-left', blocks: [] }],
          },
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
    requests: [{ method: 'GET', url: `${SANKA}/deck-1` }],
    structuredContent: { revision: 4, updated_via: 'mcp', outline: '## 1. CRM migration progress\n' },
    text: ['Presentation "Weekly review" (1 slide, revision 4)', '## 1. CRM migration progress'],
  },
  {
    name: 'get_presentation returns the deck with its ids by default',
    tool: getPresentationTool,
    args: { presentation_id: 'deck-2' },
    responses: [envelope(flowPresentation())],
    requests: [{ method: 'GET', url: `${FLOW}/deck-2` }],
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
        headers: PIN,
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
        headers: PIN,
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
        headers: PIN,
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
        headers: PIN,
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
        headers: { ...PIN, 'idempotency-key': 'weekly-1008-pptx' },
        body: { format: 'pptx', slideIds: ['s_title0000001'], includeNotes: false },
      },
    ],
    structuredContent: { export_id: 'export-1', status: 'queued', progress: 0, revision: 2 },
    text: [
      `Call get_presentation_export with presentation_id deck-1, program_id ${PROGRAM} and export_id export-1`,
    ],
  },
  {
    name: 'get_presentation_export links a completed export through the Sanka app',
    tool: getPresentationExportTool,
    args: { presentation_id: 'deck-2', export_id: 'export-2' },
    responses: [
      envelope({
        id: 'export-2',
        documentId: 'deck-2',
        revision: 3,
        status: 'completed',
        progress: 100,
        filename: 'Kickoff.pptx',
        sizeBytes: 48213,
        downloadPath: '/api/v2/documents/presentations/deck-2/exports/export-2/download',
      }),
    ],
    requests: [{ method: 'GET', url: `${FLOW}/deck-2/exports/export-2` }],
    structuredContent: {
      status: 'completed',
      app_download_url: `${APP}/api/v2/documents/presentations/deck-2/exports/export-2/download`,
    },
    text: ['Kickoff.pptx (48213 bytes, revision 3)', 'in a browser signed in to Sanka'],
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
    requests: [{ method: 'GET', url: `${SANKA}/deck-1/exports/export-1` }],
    structuredContent: { status: 'failed', error_code: 'RENDER_TIMEOUT' },
    text: ['Export export-1 failed (RENDER_TIMEOUT): Rendering took too long.', 'a new idempotency_key'],
  },
  {
    name: 'get_capability_guidance routes a deck about a migration to the presentation tools',
    tool: getCapabilityGuidanceTool,
    args: { intent: 'Turn the CRM migration status into a slide deck' },
    requests: [],
    structuredContent: {
      guidance: {
        intent_family: 'sanka_doc_presentations',
        recommended_tools: expect.arrayContaining(['get_presentation_catalog', 'create_presentation']),
      },
    },
  },
];

describe('presentation tools', () => {
  it('publishes the tool names and their required inputs', () => {
    expect(
      Object.fromEntries(presentationTools.map(({ tool }) => [tool.name, tool.inputSchema.required ?? []])),
    ).toEqual({
      get_presentation_catalog: [],
      create_presentation: ['title', 'expected_workspace_id'],
      get_presentation: ['presentation_id'],
      update_presentation: ['presentation_id', 'expected_revision', 'expected_workspace_id'],
      export_presentation: ['presentation_id', 'idempotency_key', 'expected_workspace_id'],
      get_presentation_export: ['presentation_id', 'export_id'],
    });
  });

  it.each(cases)(
    '$name',
    async ({ tool, args, responses = [], requests, isError = false, structuredContent, text = [] }) => {
      expect(validateToolArguments({ mcpTool: tool, args })).toBeUndefined();

      const { requests: sent, result } = await sendThroughSDK({ tool, args, responses });

      expect(sent).toEqual(requests);
      expect(result.isError === true).toBe(isError);
      if (structuredContent) {
        expect(result.structuredContent).toMatchObject(structuredContent);
      }
      for (const fact of text) {
        expect(firstTextContent(result)).toContain(fact);
      }
    },
  );
});
