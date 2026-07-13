import type {
  FerryDiagramCreateParams,
  FerryDiagramEdge,
  FerryDiagramNode,
  FerryDiagramUpdateParams,
  FerryDiagramViewport,
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

const NODE_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    type: { type: 'string', enum: ['objectTable', 'process', 'note'] },
    position: POSITION_SCHEMA,
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
      },
      required: ['label'],
      additionalProperties: false,
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
    type: { type: 'string', enum: ['default', 'smoothstep'] },
    sourceHandle: { type: ['string', 'null'] as any },
    targetHandle: { type: ['string', 'null'] as any },
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
  name: { type: 'string', description: 'Diagram name.' },
  description: { type: 'string', description: 'Diagram overview.' },
  nodes: {
    type: 'array',
    items: NODE_SCHEMA,
    description: 'Complete React Flow-compatible node document.',
  },
  edges: {
    type: 'array',
    items: EDGE_SCHEMA,
    description: 'Complete edge document. Every source and target must reference a supplied node id.',
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
    diagram_id: { type: 'string', description: 'Ferry diagram UUID.' },
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
    diagram_id: { type: 'string', description: 'Ferry diagram UUID.' },
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

const hasOwn = (args: Record<string, unknown> | undefined, key: string): boolean =>
  Boolean(args && Object.prototype.hasOwnProperty.call(args, key));

const asDiagramResult = (payload: Record<string, unknown>, verb: string): ToolCallResult => ({
  content: [
    {
      type: 'text',
      text: `${verb} Ferry diagram ${String(payload['name'] ?? payload['id'] ?? '').trim()}.`,
    },
  ],
  structuredContent: payload,
});

const buildCreateBody = (args: Record<string, unknown> | undefined): FerryDiagramCreateParams | undefined => {
  const name = readString(args?.['name']);
  if (!name) return undefined;
  const nodes = readObjectArray(args?.['nodes']);
  const edges = readObjectArray(args?.['edges']);
  const viewport = readObject(args?.['viewport']);
  return {
    name,
    description: typeof args?.['description'] === 'string' ? args['description'].trim() : '',
    nodes: (nodes ?? []) as unknown as FerryDiagramNode[],
    edges: (edges ?? []) as unknown as FerryDiagramEdge[],
    viewport: (viewport ?? { x: 0, y: 0, zoom: 1 }) as unknown as FerryDiagramViewport,
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
    title: 'List Ferry diagrams',
    description: 'List saved Ferry migration and object-design diagrams in the current Sanka workspace.',
    inputSchema: LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List Ferry diagrams',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List Ferry diagrams' });
    if (authError) return authError;
    const payload = await reqContext.client.public.ferryDiagrams.list(readWorkspaceParams(args));
    return {
      content: [{ type: 'text', text: `Found ${payload.count} Ferry diagram(s).` }],
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
    title: 'Get Ferry diagram',
    description: 'Load one saved Ferry diagram, including its complete nodes, edges, viewport, and revision.',
    inputSchema: GET_INPUT_SCHEMA,
    outputSchema: DIAGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get Ferry diagram',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Get Ferry diagram' });
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
    title: 'Create Ferry diagram',
    description: 'Create a saved Ferry migration or object-design diagram from nodes and edges.',
    inputSchema: CREATE_INPUT_SCHEMA,
    outputSchema: DIAGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create Ferry diagram',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Create Ferry diagram' });
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
    title: 'Update Ferry diagram',
    description:
      'Update selected fields of a Ferry diagram while preserving unspecified graph fields. Pass the revision returned by get_ferry_diagram; stale revisions are rejected.',
    inputSchema: UPDATE_INPUT_SCHEMA,
    outputSchema: DIAGRAM_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update Ferry diagram',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Update Ferry diagram' });
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
        `Ferry diagram revision conflict: current revision is ${current.revision}; reload with get_ferry_diagram and retry.`,
      );
    }
    const nodes = hasOwn(args, 'nodes') ? readObjectArray(args?.['nodes']) : current.nodes;
    const edges = hasOwn(args, 'edges') ? readObjectArray(args?.['edges']) : current.edges;
    const viewport = hasOwn(args, 'viewport') ? readObject(args?.['viewport']) : current.viewport;
    if (!nodes || !edges || !viewport) {
      return asErrorResult('`nodes`, `edges`, and `viewport` must use valid Ferry diagram object shapes.');
    }
    const body: FerryDiagramUpdateParams = {
      name: hasOwn(args, 'name') ? readString(args?.['name']) ?? '' : current.name,
      description:
        hasOwn(args, 'description') && typeof args?.['description'] === 'string' ?
          args['description'].trim()
        : current.description ?? '',
      nodes: nodes as FerryDiagramNode[],
      edges: edges as FerryDiagramEdge[],
      viewport: viewport as unknown as FerryDiagramViewport,
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
    title: 'Delete Ferry diagram',
    description: 'Permanently delete a saved Ferry diagram by UUID.',
    inputSchema: GET_INPUT_SCHEMA,
    outputSchema: DELETE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Delete Ferry diagram',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Delete Ferry diagram' });
    if (authError) return authError;
    const diagramID = readString(args?.['diagram_id']);
    if (!diagramID) return asErrorResult('`diagram_id` is required.');
    const payload = await reqContext.client.public.ferryDiagrams.delete(diagramID, readWorkspaceParams(args));
    return {
      content: [{ type: 'text', text: `Deleted Ferry diagram ${payload.id}.` }],
      structuredContent: payload as unknown as Record<string, unknown>,
    };
  },
};
