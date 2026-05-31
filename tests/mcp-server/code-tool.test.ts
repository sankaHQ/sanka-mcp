import { clientOptionsForCodeWorker } from '../../packages/mcp-server/src/code-tool';

describe('code tool worker client options', () => {
  it('preserves V2-only and workspace configuration for execute calls', () => {
    expect(
      clientOptionsForCodeWorker({
        apiKey: 'soat_test',
        apiVersion: 'v2',
        baseURL: 'https://api.example.test',
        workspaceCode: '00001234',
      }),
    ).toEqual({
      apiKey: 'soat_test',
      apiVersion: 'v2',
      baseURL: 'https://api.example.test',
      workspaceCode: '00001234',
      defaultHeaders: {
        'X-Sanka-MCP': 'true',
      },
    });
  });
});
