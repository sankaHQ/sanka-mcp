import { previewWorkflowTool, startWorkflowTool } from '../../packages/mcp-server/src/workflow-run-tools';

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

// Sanka AI passed a tl;dv meeting link as a deal and the API answered that a HubSpot Deal id
// was missing; the user never learned that the link itself could not be used.
describe.each([
  ['preview_workflow', previewWorkflowTool],
  ['start_workflow', startWorkflowTool],
])('%s with a non-deal URL', (_name, tool) => {
  it('stops before the API and points to get_meeting', async () => {
    const post = jest.fn();

    const result = await tool.handler({
      reqContext: { client: { post } as any, auth: oauthContext() },
      args: {
        workflow_type: 'deal_to_estimate',
        source_record: {
          source_system: 'hubspot',
          object_type: 'deal',
          url: 'https://tldv.io/app/meetings/6ae17319d8d7bb0013a69f22',
        },
      },
    });

    expect(post).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).toContain('get_meeting');
  });
});
