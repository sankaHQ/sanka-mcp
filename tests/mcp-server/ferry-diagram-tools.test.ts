import { selectTools } from '../../packages/mcp-server/src/server';
import {
  createFerryDiagramTool,
  deleteFerryDiagramTool,
  getFerryDiagramTool,
  listFerryDiagramsTool,
  updateFerryDiagramTool,
} from '../../packages/mcp-server/src/ferry-diagram-tools';
import { describeV2Requests } from './crm/helpers';

const DIAGRAMS = 'http://localhost:5000/api/v2/public/ferry/diagrams';

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

const diagram = {
  id: 'diagram-1',
  workspaceId: 'workspace-1',
  name: 'JVTA migration',
  description: 'Salesforce to HubSpot object design',
  nodes: [
    {
      id: 'node-1',
      type: 'objectTable',
      position: { x: 100, y: 100 },
      data: { label: 'Translator', color: 'brand' },
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  revision: 4,
};

// A flowchart as an agent draws it: a decision diamond at its default size and a resized cylinder.
const flowchartNodes = [
  { id: 'check', type: 'process', position: { x: 0, y: 0 }, data: { label: 'Approved?', shape: 'diamond' } },
  {
    id: 'ledger',
    type: 'process',
    position: { x: 320, y: 0 },
    data: { label: 'Ledger', shape: 'cylinder' },
    width: 240,
    height: 180,
  },
];

// get_ferry_diagram fills in every data field of a node, with shape null when it has none.
const storedData = { description: '', fields: [], moduleName: null, objectKey: null, objectSlug: null };
const storedNodes = [...diagram.nodes, ...flowchartNodes].map((node) => ({
  ...node,
  data: { ...storedData, color: 'default', shape: null, ...node.data },
}));

describe('Ferry diagram MCP tools', () => {
  describeV2Requests([
    {
      name: 'create_ferry_diagram sends shaped and resized process nodes',
      tool: createFerryDiagramTool,
      args: { name: 'Approval flow', nodes: flowchartNodes },
      expectedRequests: [
        {
          method: 'POST',
          url: DIAGRAMS,
          body: { name: 'Approval flow', nodes: flowchartNodes, edges: [], viewport: diagram.viewport },
        },
      ],
    },
    {
      name: 'update_ferry_diagram takes back the nodes get_ferry_diagram returned',
      tool: updateFerryDiagramTool,
      args: { diagram_id: 'diagram-1', revision: 4, nodes: storedNodes },
      response: { ...diagram, nodes: storedNodes },
      expectedRequests: [
        { method: 'GET', url: `${DIAGRAMS}/diagram-1` },
        {
          method: 'PUT',
          url: `${DIAGRAMS}/diagram-1`,
          body: {
            name: diagram.name,
            description: diagram.description,
            nodes: storedNodes,
            edges: [],
            viewport: diagram.viewport,
            revision: 4,
          },
        },
      ],
    },
  ]);

  it('registers all five tools in the hosted toolset', () => {
    const names = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'list_ferry_diagrams',
        'get_ferry_diagram',
        'create_ferry_diagram',
        'update_ferry_diagram',
        'delete_ferry_diagram',
      ]),
    );
    expect(listFerryDiagramsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(deleteFerryDiagramTool.tool.annotations?.destructiveHint).toBe(true);
    expect(listFerryDiagramsTool.tool.title).toBe('List Sanka diagrams');
    expect(listFerryDiagramsTool.tool.description).toBe(
      'List saved Sanka migration and object-design diagrams in the current workspace.',
    );
    expect((getFerryDiagramTool.tool.inputSchema as any).properties.diagram_id.description).toBe(
      'Sanka diagram UUID.',
    );
    expect(deleteFerryDiagramTool.tool.title).toBe('Delete Sanka diagram');
  });

  it('lists and gets diagrams through the public SDK resource', async () => {
    const list = jest.fn().mockResolvedValue({ diagrams: [diagram], count: 1 });
    const retrieve = jest.fn().mockResolvedValue(diagram);
    const client = { public: { ferryDiagrams: { list, retrieve } } } as any;

    const listResult = await listFerryDiagramsTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { workspace_id: 'workspace-1' },
    });
    const getResult = await getFerryDiagramTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { diagram_id: 'diagram-1', workspace_id: 'workspace-1' },
    });

    expect(list).toHaveBeenCalledWith({ workspace_id: 'workspace-1' });
    expect(retrieve).toHaveBeenCalledWith('diagram-1', { workspace_id: 'workspace-1' });
    expect(listResult.structuredContent).toEqual({ diagrams: [diagram], count: 1 });
    expect(getResult.structuredContent).toEqual(diagram);
  });

  it('creates a diagram with graph defaults', async () => {
    const create = jest.fn().mockResolvedValue(diagram);
    const client = { public: { ferryDiagrams: { create } } } as any;

    const result = await createFerryDiagramTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { name: 'JVTA migration', workspace_id: 'workspace-1' },
    });

    expect(create).toHaveBeenCalledWith({
      name: 'JVTA migration',
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      workspace_id: 'workspace-1',
    });
    expect(result.structuredContent).toEqual(diagram);
  });

  it('publishes and forwards the complete ER connector contract', async () => {
    const edgeProperties = (createFerryDiagramTool.tool.inputSchema as any).properties.edges.items.properties;
    expect(edgeProperties.type.enum).toEqual(['default', 'smoothstep', 'straight']);
    expect(edgeProperties.sourceArrow.type).toBe('boolean');
    expect(edgeProperties.targetArrow.type).toBe('boolean');
    expect(edgeProperties.strokeWidth).toMatchObject({ minimum: 0.5, maximum: 24 });
    expect(edgeProperties.sourceCardinality.enum).toEqual([
      'one',
      'zero_or_one',
      'one_or_many',
      'zero_or_many',
    ]);
    expect(edgeProperties.targetCardinality.enum).toEqual(edgeProperties.sourceCardinality.enum);

    const create = jest.fn().mockResolvedValue(diagram);
    const client = { public: { ferryDiagrams: { create } } } as any;
    const edge = {
      id: 'company-contact',
      source: 'company',
      sourceArrow: true,
      sourceCardinality: 'one',
      strokeWidth: 2.5,
      target: 'contact',
      targetArrow: true,
      targetCardinality: 'zero_or_many',
      type: 'straight',
    };

    await createFerryDiagramTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: {
        name: 'Customer ER model',
        edges: [edge],
      },
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        edges: [edge],
      }),
    );
  });

  it('preserves omitted graph fields during revision-safe updates', async () => {
    const retrieve = jest.fn().mockResolvedValue(diagram);
    const update = jest.fn().mockResolvedValue({ ...diagram, name: 'JVTA target model', revision: 5 });
    const client = { public: { ferryDiagrams: { retrieve, update } } } as any;

    const result = await updateFerryDiagramTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: {
        diagram_id: 'diagram-1',
        revision: 4,
        name: 'JVTA target model',
        workspace_id: 'workspace-1',
      },
    });

    expect(retrieve).toHaveBeenCalledWith('diagram-1', { workspace_id: 'workspace-1' });
    expect(update).toHaveBeenCalledWith('diagram-1', {
      name: 'JVTA target model',
      description: diagram.description,
      nodes: diagram.nodes,
      edges: diagram.edges,
      viewport: diagram.viewport,
      revision: 4,
      workspace_id: 'workspace-1',
    });
    expect(result.structuredContent).toMatchObject({ name: 'JVTA target model', revision: 5 });
  });

  it('rejects a stale revision before writing', async () => {
    const retrieve = jest.fn().mockResolvedValue(diagram);
    const update = jest.fn();
    const client = { public: { ferryDiagrams: { retrieve, update } } } as any;

    const result = await updateFerryDiagramTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { diagram_id: 'diagram-1', revision: 3, name: 'Stale update' },
    });

    expect(update).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Sanka diagram revision conflict'),
    });
  });

  it('clears the description only when an empty description is explicit', async () => {
    const retrieve = jest.fn().mockResolvedValue(diagram);
    const update = jest.fn().mockResolvedValue({ ...diagram, description: '', revision: 5 });
    const client = { public: { ferryDiagrams: { retrieve, update } } } as any;

    await updateFerryDiagramTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { diagram_id: 'diagram-1', revision: 4, description: '  ' },
    });

    expect(update).toHaveBeenCalledWith('diagram-1', expect.objectContaining({ description: '' }));
  });

  it('deletes a diagram through the public SDK resource', async () => {
    const del = jest.fn().mockResolvedValue({ id: 'diagram-1', deleted: true });
    const client = { public: { ferryDiagrams: { delete: del } } } as any;

    const result = await deleteFerryDiagramTool.handler({
      reqContext: { client, auth: oauthContext() },
      args: { diagram_id: 'diagram-1' },
    });

    expect(del).toHaveBeenCalledWith('diagram-1', {});
    expect(result.structuredContent).toEqual({ id: 'diagram-1', deleted: true });
  });
});
