import {
  getWorkflowRunTool,
  previewWorkflowTool,
  resolveRecordTool,
  startWorkflowTool,
} from '../../packages/mcp-server/src/workflow-run-tools';
import { selectTools } from '../../packages/mcp-server/src/server';

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

describe('workflow run MCP tools', () => {
  it('registers generic workflow tools in the default toolset', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    expect(toolNames).toContain('resolve_record');
    expect(toolNames).toContain('preview_workflow');
    expect(toolNames).toContain('start_workflow');
    expect(toolNames).toContain('get_workflow_run');
  });

  it('advertises OAuth protection', () => {
    expect(resolveRecordTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(previewWorkflowTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(startWorkflowTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(getWorkflowRunTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
  });

  it('resolves records through the public workflow-runs endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: { candidates: [{ record_ref: { record_id: 'deal-1' } }] },
      message: 'ok',
    });

    const result = await resolveRecordTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        query: 'A Company',
        source_system: 'hubspot',
        limit: 3,
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/resolve-record', {
      body: {
        query: 'A Company',
        object_type: 'deal',
        source_system: 'hubspot',
        limit: 3,
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      candidates: [{ record_ref: { record_id: 'deal-1' } }],
    });
  });

  it('starts deal_to_estimate workflows through the public endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        run_id: 'run-1',
        status: 'waiting_for_approval',
      },
      message: 'started',
    });

    const result = await startWorkflowTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {
        workflow_type: 'deal_to_estimate',
        source_record: {
          source_system: 'sanka',
          object_type: 'deal',
          record_id: 'deal-1',
        },
        idempotency_key: 'key-1',
      },
    });

    expect(post).toHaveBeenCalledWith('/v1/public/workflow-runs/start', {
      body: {
        workflow_type: 'deal_to_estimate',
        source_record: {
          source_system: 'sanka',
          object_type: 'deal',
          record_id: 'deal-1',
        },
        options: {},
        idempotency_key: 'key-1',
      },
    });
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'run-1',
      status: 'waiting_for_approval',
    });
  });

  it('loads workflow runs by id', async () => {
    const get = jest.fn().mockResolvedValue({
      data: { run_id: 'run/1', status: 'completed' },
      message: 'ok',
    });

    const result = await getWorkflowRunTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
      },
      args: {
        run_id: 'run/1',
      },
    });

    expect(get).toHaveBeenCalledWith('/v1/public/workflow-runs/run%2F1');
    expect(result.structuredContent?.['data']).toEqual({
      run_id: 'run/1',
      status: 'completed',
    });
  });
});
