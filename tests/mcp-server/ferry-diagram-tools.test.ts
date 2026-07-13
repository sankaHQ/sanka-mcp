import { selectTools } from '../../packages/mcp-server/src/server';
import {
  createFerryDiagramTool,
  deleteFerryDiagramTool,
  getFerryDiagramTool,
  listFerryDiagramsTool,
  updateFerryDiagramTool,
} from '../../packages/mcp-server/src/ferry-diagram-tools';

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

describe('Ferry diagram MCP tools', () => {
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
      description: '',
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      workspace_id: 'workspace-1',
    });
    expect(result.structuredContent).toEqual(diagram);
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
    expect(result.content[0]).toMatchObject({ type: 'text' });
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
