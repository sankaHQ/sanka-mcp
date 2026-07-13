import Sanka from 'sanka-sdk';

const diagram = {
  id: 'diagram-1',
  workspaceId: 'workspace-1',
  name: 'JVTA migration',
  description: 'Salesforce to HubSpot object design',
  nodes: [
    {
      id: 'node-1',
      type: 'objectTable',
      position: { x: 100, y: 120 },
      data: { label: 'Translator', color: 'brand' },
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  revision: 1,
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-diagram' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public Ferry diagrams resource', () => {
  test('uses public Ferry diagram paths and typed CRUD bodies', async () => {
    const calls: Array<{ body?: unknown; method: string; url: string }> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const method = String(init?.method ?? 'GET').toUpperCase();
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ method, url: String(url), body });
        if (method === 'GET' && !String(url).includes('diagram-1')) {
          return envelope({ diagrams: [{ ...diagram, nodeCount: 1, edgeCount: 0 }], count: 1 });
        }
        if (method === 'DELETE') {
          return envelope({ id: 'diagram-1', deleted: true });
        }
        if (method === 'PUT') {
          return envelope({ ...diagram, name: 'Updated migration', revision: 2 });
        }
        return envelope(diagram);
      },
    });

    await expect(client.public.ferryDiagrams.list({ workspace_id: 'workspace-1' })).resolves.toMatchObject({
      count: 1,
      diagrams: [{ id: 'diagram-1', nodeCount: 1 }],
    });
    await expect(client.public.ferryDiagrams.retrieve('diagram-1')).resolves.toEqual(diagram);
    await expect(
      client.public.ferryDiagrams.create({
        workspace_id: 'workspace-1',
        name: diagram.name,
        description: diagram.description,
        nodes: diagram.nodes as any,
        edges: [],
        viewport: diagram.viewport,
      }),
    ).resolves.toEqual(diagram);
    await expect(
      client.public.ferryDiagrams.update('diagram-1', {
        name: 'Updated migration',
        description: diagram.description,
        nodes: diagram.nodes as any,
        edges: [],
        viewport: diagram.viewport,
        revision: 1,
      }),
    ).resolves.toMatchObject({ name: 'Updated migration', revision: 2 });
    await expect(client.public.ferryDiagrams.delete('diagram-1')).resolves.toEqual({
      id: 'diagram-1',
      deleted: true,
    });

    expect(calls).toEqual([
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/ferry/diagrams?workspace_id=workspace-1',
        body: undefined,
      },
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/ferry/diagrams/diagram-1',
        body: undefined,
      },
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/ferry/diagrams?workspace_id=workspace-1',
        body: {
          name: diagram.name,
          description: diagram.description,
          nodes: diagram.nodes,
          edges: [],
          viewport: diagram.viewport,
        },
      },
      {
        method: 'PUT',
        url: 'http://localhost:5000/api/v2/public/ferry/diagrams/diagram-1',
        body: {
          name: 'Updated migration',
          description: diagram.description,
          nodes: diagram.nodes,
          edges: [],
          viewport: diagram.viewport,
          revision: 1,
        },
      },
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/public/ferry/diagrams/diagram-1',
        body: undefined,
      },
    ]);
  });
});
