import { selectTools } from '../../packages/mcp-server/src/server';
import {
  createWorkflowTool,
  runWorkflowTool,
  updateWorkflowTool,
} from '../../packages/mcp-server/src/workflow-tools';

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

describe('workflow definition MCP tools', () => {
  it('registers workflow definition tools in the hosted toolset', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    expect(toolNames).toContain('create_workflow');
    expect(toolNames).toContain('update_workflow');
    expect(toolNames).toContain('run_workflow');
    expect(toolNames).not.toContain('create_hubspot_workflow');
  });

  it('advertises provider-aware V2 workflow endpoints', () => {
    expect(createWorkflowTool.metadata.httpPath).toBe('/api/v2/public/workflows');
    expect(updateWorkflowTool.metadata.httpPath).toBe('/api/v2/public/workflows/{workflow_id}');
    expect(runWorkflowTool.metadata.httpPath).toBe('/api/v2/public/workflows/{workflow_id}/run');
    expect((createWorkflowTool.tool.inputSchema as any).properties.provider.enum).toEqual([
      'sanka',
      'hubspot',
    ]);
  });

  it('creates HubSpot workflow previews through the shared workflow endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        provider: 'hubspot',
        dry_run: true,
        platform_payload: { objectTypeId: '0-3' },
      },
      message: 'Previewed HubSpot workflow mutation.',
    });

    const result = await createWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        provider: 'hubspot',
        channel_id: 'hubspot-channel-1',
        title: 'Set amount on closed won',
        object_type: 'deal',
        trigger: { property: 'dealstage', value: 'closedwon' },
        actions: [{ type: 'set_property', property: 'amount', value: 100 }],
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflows', {
      body: expect.objectContaining({
        provider: 'hubspot',
        channel_id: 'hubspot-channel-1',
        title: 'Set amount on closed won',
        dry_run: true,
        confirm: false,
      }),
    });
    expect(result.structuredContent?.['data']).toMatchObject({
      provider: 'hubspot',
      dry_run: true,
    });
  });

  it('updates workflows through the shared workflow endpoint', async () => {
    const patch = jest.fn().mockResolvedValue({
      data: { provider: 'hubspot', external_id: 'flow-1', status: 'updated' },
      message: 'Updated workflow',
    });

    await updateWorkflowTool.handler({
      reqContext: {
        client: { patch } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_id: 'flow-1',
        provider: 'hubspot',
        platform_payload: { revisionId: '1', name: 'Updated' },
        confirm: true,
      },
    });

    expect(patch).toHaveBeenCalledWith('/api/v2/public/workflows/flow-1', {
      body: expect.objectContaining({
        provider: 'hubspot',
        confirm: true,
        platform_payload: { revisionId: '1', name: 'Updated' },
      }),
    });
  });

  it('runs Sanka workflows through the V2 workflow run endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: { run_id: 'run-1', workflow_id: 'workflow-1', status: 'running' },
      message: 'ok',
    });

    const result = await runWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: { workflow_id: 'workflow-1' },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/workflows/workflow-1/run', {
      body: { provider: 'sanka', options: {}, payload: {} },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'run-1',
      workflow_id: 'workflow-1',
      status: 'running',
    });
  });
});
