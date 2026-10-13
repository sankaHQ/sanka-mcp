import type {
  FerryDiagramCreateParams,
  FerryDiagramEdge,
  FerryDiagramNode,
  FerryDiagramUpdateParams,
  FerryDiagramViewport,
  MigrationDiagramShape,
} from 'sanka-sdk';
import { asErrorResult, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const POSITION_SCHEMA = {
  type: 'object' as const,
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
  },
  required: ['x', 'y'],
  additionalProperties: false,
};

const VIEWPORT_SCHEMA = {
  ...POSITION_SCHEMA,
  properties: {
    ...POSITION_SCHEMA.properties,
    zoom: { type: 'number', minimum: 0.1, maximum: 4 },
  },
  required: ['x', 'y', 'zoom'],
};

const NODE_SHAPES: MigrationDiagramShape[] = [
  'rectangle',
  'roundedRectangle',
  'square',
  'circle',
  'diamond',
  'triangle',
  'invertedTriangle',
  'oval',
  'cylinder',
  'pill',
];

// The editor draws a shape without width and height at these sizes (sanka-react
// src/lib/migration/diagram-shapes.ts); the API enforces the combinations.
const SHAPE_GUIDE =
  'To draw a flowchart shape, set data.shape on a process node, such as diamond for a decision, pill for a start or end terminal, or cylinder for a database; other node types take no shape. Node width and height go together, on a shaped process node, a note or a section; omit both on a shape for the default width x height in px: rectangle and roundedRectangle 224x112, square and circle 160x160, diamond, triangle and invertedTriangle 176x160, oval 224x128, cylinder 192x144, pill 224x80.';

// Mirrors the sanka-api diagram contract (app/model/domain/migration/diagrams.py).
const STYLE_GUIDE =
  'For swimlanes or columns, add section nodes (type section, data.label is the lane title, width and height required, up to 8000 px); they draw behind every node, connectors cannot attach to them, and a node belongs to the section its center lies in. Optional styles: data.fontSize (8-96 px label size), data.fillColor, data.strokeColor and data.textColor as #RRGGBB on any node (the color preset stays the default), and on edges strokeStyle (solid, dashed or dotted), strokeColor and label fontSize. Labels keep \\n line breaks.';

// The API accepts null for each optional style field, meaning "not set".
const HEX_COLOR = { type: ['string', 'null'] as any, pattern: '^#[0-9A-Fa-f]{6}$' };
const FONT_SIZE = { type: ['number', 'null'] as any, minimum: 8, maximum: 96 };
const HANDLE_SIDES = 'left, right, top or bottom';

const NODE_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    type: { type: 'string', enum: ['objectTable', 'process', 'note', 'section'] },
    position: { ...POSITION_SCHEMA, description: 'Top-left corner of the node in canvas pixels.' },
    data: {
      type: 'object' as const,
      properties: {
        label: { type: 'string' },
        description: { type: 'string' },
        fields: { type: 'array', items: { type: 'string' } },
        moduleName: { type: ['string', 'null'] as any },
        objectKey: { type: ['string', 'null'] as any },
        objectSlug: { type: ['string', 'null'] as any },
        color: {
          type: 'string',
          enum: ['default', 'brand', 'success', 'warning', 'danger'],
        },
        shape: {
          type: ['string', 'null'] as any,
          enum: [...NODE_SHAPES, null],
          description:
            'Draws a process node as this shape, with the label centered inside. Only process nodes take a shape; null or omitted draws the standard process card.',
        },
        fontSize: { ...FONT_SIZE, description: 'Label font size in CSS pixels.' },
        fillColor: { ...HEX_COLOR, description: 'Custom fill color; overrides the color preset fill.' },
        strokeColor: {
          ...HEX_COLOR,
          description: 'Custom outline color; overrides the color preset outline.',
        },
        textColor: { ...HEX_COLOR, description: 'Custom label color.' },
      },
      required: ['label'],
      additionalProperties: false,
    },
    width: {
      type: 'number',
      minimum: 96,
      maximum: 8000,
      description:
        'Width in canvas pixels, sent with height: up to 1600 on a shaped process node or a note, up to 8000 on a section (required there).',
    },
    height: {
      type: 'number',
      minimum: 64,
      maximum: 8000,
      description:
        'Height in canvas pixels, sent with width: up to 1200 on a shaped process node or a note, up to 8000 on a section (required there).',
    },
  },
  required: ['id', 'type', 'position', 'data'],
  additionalProperties: false,
};

const EDGE_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    source: { type: 'string' },
    target: { type: 'string' },
    label: { type: 'string' },
    type: { type: 'string', enum: ['default', 'smoothstep', 'straight'] },
    sourceHandle: {
      type: ['string', 'null'] as any,
      description: `Side of the source node the connector leaves from: ${HANDLE_SIDES}. Omit both handles to use the sides facing each other.`,
    },
    targetHandle: {
      type: ['string', 'null'] as any,
      description: `Side of the target node the connector enters: ${HANDLE_SIDES}.`,
    },
    sourceArrow: {
      type: 'boolean',
      description: 'Render an arrowhead at the source when no source cardinality is set.',
    },
    targetArrow: {
      type: 'boolean',
      description: 'Render an arrowhead at the target when no target cardinality is set.',
    },
    strokeWidth: {
      type: 'number',
      minimum: 0.5,
      maximum: 24,
      description: 'Connector stroke width in CSS pixels.',
    },
    sourceCardinality: {
      type: 'string',
      enum: ['one', 'zero_or_one', 'one_or_many', 'zero_or_many'],
      description:
        "ER cardinality at the source endpoint: bar, circle plus bar, bar plus Crow's Foot, or circle plus Crow's Foot.",
    },
    targetCardinality: {
      type: 'string',
      enum: ['one', 'zero_or_one', 'one_or_many', 'zero_or_many'],
      description:
        "ER cardinality at the target endpoint: bar, circle plus bar, bar plus Crow's Foot, or circle plus Crow's Foot.",
    },
    strokeStyle: {
      type: ['string', 'null'] as any,
      enum: ['solid', 'dashed', 'dotted', null],
      description: 'Line pattern; omit or null for solid.',
    },
    strokeColor: { ...HEX_COLOR, description: 'Custom connector and arrowhead color.' },
    fontSize: { ...FONT_SIZE, description: 'Label font size in CSS pixels.' },
  },
  required: ['id', 'source', 'target'],
  additionalProperties: false,
};

const WORKSPACE_PROPERTY = {
  workspace_id: {
    type: 'string',
    description: 'Optional workspace UUID. Omit to use the current authenticated workspace.',
  },
};

const DOCUMENT_PROPERTIES = {
  name: { type: 'string', minLength: 1, description: 'Diagram name.' },
  description: {
    type: 'string',
    description:
      'Diagram overview. On update, pass an explicit empty string to clear it; omit it to preserve it.',
  },
  nodes: {
    type: 'array',
    items: NODE_SCHEMA,
    description: 'Complete React Flow-compatible node document.',
  },
  edges: {
    type: 'array',
    items: EDGE_SCHEMA,
    description:
      "Complete edge document. Every source and target must reference a supplied node id. For ER diagrams, set sourceCardinality and targetCardinality to render standard bar, circle, and Crow's Foot notation.",
  },
  viewport: VIEWPORT_SCHEMA,
};

const LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: WORKSPACE_PROPERTY,
};

const GET_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    diagram_id: { type: 'string', description: 'Sanka diagram UUID.' },
    ...WORKSPACE_PROPERTY,
  },
  required: ['diagram_id'],
};

const CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...DOCUMENT_PROPERTIES,
    ...WORKSPACE_PROPERTY,
  },
  required: ['name'],
};

const UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    diagram_id: { type: 'string', description: 'Sanka diagram UUID.' },
    revision: {
      type: 'integer',
      minimum: 1,
      description: 'Revision returned by get_ferry_diagram. Stale revisions are rejected.',
    },
    ...DOCUMENT_PROPERTIES,
    ...WORKSPACE_PROPERTY,
  },
  required: ['diagram_id', 'revision'],
};

const DIAGRAM_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {},
  additionalProperties: true,
};

const LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    diagrams: { type: 'array', items: DIAGRAM_OUTPUT_SCHEMA },
    count: { type: 'integer' },
  },
  required: ['diagrams', 'count'],
};

const DELETE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    deleted: { type: 'boolean' },
  },
  required: ['id', 'deleted'],
};

const readString = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const readWorkspaceParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  return workspaceID ? { workspace_id: workspaceID } : {};
};

const readObject = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ?
    (value as Record<string, unknown>)
  : undefined;

const readObjectArray = (value: unknown): Array<Record<string, unknown>> | undefined =>
  Array.isArray(value) && value.every((entry) => readObject(entry)) ?
    (value as Array<Record<string, unknown>>)
  : undefined;

const readViewport = (value: unknown): FerryDiagramViewport | undefined => {
  const viewport = readObject(value);
  const x = viewport?.['x'];
  const y = viewport?.['y'];
  const zoom = viewport?.['zoom'];
  if (
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    typeof y !== 'number' ||
    !Number.isFinite(y) ||
    typeof zoom !== 'number' ||
    !Number.isFinite(zoom) ||
    zoom < 0.1 ||
    zoom > 4
  ) {
    return undefined;
  }
  return { x, y, zoom };
};

const hasOwn = (args: Record<string, unknown> | undefined, key: string): boolean =>
  Boolean(args && Object.prototype.hasOwnProperty.call(args, key));

const asDiagramResult = (payload: Record<string, unknown>, verb: string): ToolCallResult => ({
  content: [
    {
      type: 'text',
      text: `${verb} Sanka diagram ${String(payload['name'] ?? payload['id'] ?? '').trim()}.`,
    },
  ],
  structuredContent: payload,
});

const buildCreateBody = (args: Record<string, unknown> | undefined): FerryDiagramCreateParams | undefined => {
  const name = readString(args?.['name']);
  if (!name) return undefined;
  const nodes = readObjectArray(args?.['nodes']);
  const edges = readObjectArray(args?.['edges']);
  const viewport = readViewport(args?.['viewport']);
  const description = typeof args?.['description'] === 'string' ? args['description'].trim() : undefined;
  return {
    name,
    ...(description !== undefined ? { description } : undefined),
    nodes: (nodes ?? []) as unknown as FerryDiagramNode[],
    edges: (edges ?? []) as unknown as FerryDiagramEdge[],
    viewport: viewport ?? { x: 0, y: 0, zoom: 1 },
    ...readWorkspaceParams(args),
  };
};

export const listFerryDiagramsTool: McpTool = {
  metadata: {
    resource: 'ferryDiagrams',
    operation: 'read',
    tags: ['ferry', 'diagrams'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/ferry/diagrams',
    operationId: 'public.ferryDiagrams.list',
  },
  tool: {
    name: 'list_ferry_diagrams',
    title: 'List Sanka diagrams',
    description: 'List saved Sanka migration and object-design diagrams in the current workspace.',
    inputSchema: LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List Sanka diagrams',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List Sanka diagrams' });
    if (authError) return authError;
    const payload = await reqContext.client.public.ferryDiagrams.list(readWorkspaceParams(args));
    return {
      content: [{ type: 'text', text: `Found ${payload.count} Sanka diagram(s).` }],
      structuredContent: payload as unknown as Record<string, unknown>,
    };
  },
};

export const getFerryDiagramTool: McpTool = {
  metadata: {
    resource: 'ferryDiagrams',
    operation: 'read',
    tags: ['ferry', 'diagrams'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/ferry/diagrams/{diagram_id}',
    operationId: 'public.ferryDiagrams.retrieve',
  },
  tool: {
    name: 'get_ferry_diagram',
    title: 'Get Sanka diagram',
    description: 'Load one saved Sanka diagram, including its complete nodes, edges, viewport, and revision.',
    inputSchema: GET_INPUT_SCHEMA,
    outputSchema: DIAGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get Sanka diagram',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Get Sanka diagram' });
    if (authError) return authError;
    const diagramID = readString(args?.['diagram_id']);
    if (!diagramID) return asErrorResult('`diagram_id` is required.');
    const payload = await reqContext.client.public.ferryDiagrams.retrieve(
      diagramID,
      readWorkspaceParams(args),
    );
    return asDiagramResult(payload as unknown as Record<string, unknown>, 'Loaded');
  },
};

export const createFerryDiagramTool: McpTool = {
  metadata: {
    resource: 'ferryDiagrams',
    operation: 'write',
    tags: ['ferry', 'diagrams'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/ferry/diagrams',
    operationId: 'public.ferryDiagrams.create',
  },
  tool: {
    name: 'create_ferry_diagram',
    title: 'Create Sanka diagram',
    description: `Create a saved Sanka migration, object-design or flowchart diagram from nodes and edges. ${SHAPE_GUIDE} ${STYLE_GUIDE}`,
    inputSchema: CREATE_INPUT_SCHEMA,
    outputSchema: DIAGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create Sanka diagram',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Create Sanka diagram' });
    if (authError) return authError;
    const body = buildCreateBody(args);
    if (!body) return asErrorResult('`name` is required.');
    const payload = await reqContext.client.public.ferryDiagrams.create(body);
    return asDiagramResult(payload as unknown as Record<string, unknown>, 'Created');
  },
};

export const updateFerryDiagramTool: McpTool = {
  metadata: {
    resource: 'ferryDiagrams',
    operation: 'write',
    tags: ['ferry', 'diagrams'],
    httpMethod: 'put',
    httpPath: '/api/v2/public/ferry/diagrams/{diagram_id}',
    operationId: 'public.ferryDiagrams.update',
  },
  tool: {
    name: 'update_ferry_diagram',
    title: 'Update Sanka diagram',
    description: `Update selected fields of a Sanka diagram while preserving unspecified graph fields. Pass the revision returned by get_ferry_diagram; stale revisions are rejected. ${SHAPE_GUIDE} ${STYLE_GUIDE}`,
    inputSchema: UPDATE_INPUT_SCHEMA,
    outputSchema: DIAGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update Sanka diagram',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Update Sanka diagram' });
    if (authError) return authError;
    const diagramID = readString(args?.['diagram_id']);
    const revision = Number(args?.['revision']);
    if (!diagramID) return asErrorResult('`diagram_id` is required.');
    if (!Number.isInteger(revision) || revision < 1)
      return asErrorResult('`revision` must be a positive integer.');
    const workspaceParams = readWorkspaceParams(args);
    const current = await reqContext.client.public.ferryDiagrams.retrieve(diagramID, workspaceParams);
    if (current.revision !== revision) {
      return asErrorResult(
        `Sanka diagram revision conflict: current revision is ${current.revision}; reload with get_ferry_diagram and retry.`,
      );
    }
    const nodes = hasOwn(args, 'nodes') ? readObjectArray(args?.['nodes']) : current.nodes;
    const edges = hasOwn(args, 'edges') ? readObjectArray(args?.['edges']) : current.edges;
    const viewport = hasOwn(args, 'viewport') ? readViewport(args?.['viewport']) : current.viewport;
    if (!nodes || !edges || !viewport) {
      return asErrorResult('`nodes`, `edges`, and `viewport` must use valid Sanka diagram object shapes.');
    }
    const body: FerryDiagramUpdateParams = {
      name: hasOwn(args, 'name') ? readString(args?.['name']) ?? '' : current.name,
      description:
        hasOwn(args, 'description') && typeof args?.['description'] === 'string' ?
          args['description'].trim()
        : current.description ?? '',
      nodes: nodes as FerryDiagramNode[],
      edges: edges as FerryDiagramEdge[],
      viewport,
      revision,
      ...workspaceParams,
    };
    if (!body.name) return asErrorResult('`name` cannot be empty.');
    const payload = await reqContext.client.public.ferryDiagrams.update(diagramID, body);
    return asDiagramResult(payload as unknown as Record<string, unknown>, 'Updated');
  },
};

export const deleteFerryDiagramTool: McpTool = {
  metadata: {
    resource: 'ferryDiagrams',
    operation: 'write',
    tags: ['ferry', 'diagrams'],
    httpMethod: 'delete',
    httpPath: '/api/v2/public/ferry/diagrams/{diagram_id}',
    operationId: 'public.ferryDiagrams.delete',
  },
  tool: {
    name: 'delete_ferry_diagram',
    title: 'Delete Sanka diagram',
    description: 'Permanently delete a saved Sanka diagram by UUID.',
    inputSchema: GET_INPUT_SCHEMA,
    outputSchema: DELETE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete Sanka diagram',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Delete Sanka diagram' });
    if (authError) return authError;
    const diagramID = readString(args?.['diagram_id']);
    if (!diagramID) return asErrorResult('`diagram_id` is required.');
    const payload = await reqContext.client.public.ferryDiagrams.delete(diagramID, readWorkspaceParams(args));
    return {
      content: [{ type: 'text', text: `Deleted Sanka diagram ${payload.id}.` }],
      structuredContent: payload as unknown as Record<string, unknown>,
    };
  },
};
