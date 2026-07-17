import { lookoutCreateLpBatchTool, lookoutGetRunTool } from '../../packages/mcp-server/src/lookout-tools';

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

describe('Lookout landing-page MCP tools', () => {
  it('does not report an older run when the new signal has no matching run yet', async () => {
    const post = jest.fn().mockResolvedValue({
      data: { id: 'signal-new', status: 'processed' },
    });
    const patch = jest.fn().mockResolvedValue({ data: { id: 'motion-1' } });
    const get = jest.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: 'run-old',
            signal_id: 'signal-old',
            status: 'awaiting_approval',
          },
        ],
      },
    });

    const result = await lookoutCreateLpBatchTool.handler({
      reqContext: { client: { get, patch, post } as any, auth: oauthContext() },
      args: {
        motion_id: 'motion-1',
        master_page_id: 'master-1',
        campaign_id: 'campaign-1',
        pages: [{ slug: 'lp/exp-a', html_title: 'Experiment A' }],
      },
    });

    expect(result.structuredContent).toMatchObject({
      motion_id: 'motion-1',
      signal_id: 'signal-new',
    });
    expect(result.structuredContent).not.toHaveProperty('run_id');
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('no run was found'),
    });
  });

  it('reports provider-action truncation when the requested run is outside the available page', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `action-${index}`,
      run_id: `other-run-${index}`,
    }));
    const get = jest.fn().mockImplementation((path: string) => {
      if (path.endsWith('/runs/run-101')) {
        return Promise.resolve({
          data: { run: { id: 'run-101', status: 'succeeded', approval_status: 'approved' } },
        });
      }
      return Promise.resolve({ data: { items: firstPage, total: 101 } });
    });

    const result = await lookoutGetRunTool.handler({
      reqContext: { client: { get } as any, auth: oauthContext() },
      args: { run_id: 'run-101' },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/lookout/provider-actions', {
      query: { limit: 100, status: '' },
    });
    expect(result.structuredContent).toMatchObject({
      provider_actions_truncated: true,
      provider_actions_scanned: 100,
      provider_actions_total: 101,
    });
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('provider-action results may be truncated'),
    });
  });
});
