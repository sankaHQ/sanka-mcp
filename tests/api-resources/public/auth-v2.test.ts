import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public auth resource on V2', () => {
  test('maps the V2 auth session envelope to the public identity shape', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url) => {
        const requestURL = String(url);
        calls.push(requestURL);
        return envelope({
          auth_mode: 'oauth_app',
          principal_key: 'oauth:session:session-1',
          user: {
            id: 42,
            email: 'haegwan@example.com',
            username: 'haegwan',
          },
          current_workspace: {
            id: 'workspace-1',
            code: '39467777',
            name: 'Workspace A',
          },
          permissions: ['platform:read'],
          permission_level: 'admin',
          token_id: 'session-1',
          token_name: 'Sanka MCP',
        });
      },
    });

    await expect(client.public.auth.getCurrentIdentity()).resolves.toEqual({
      data: {
        auth_mode: 'oauth_app',
        principal_key: 'oauth:session:session-1',
        user_id: '42',
        email: 'haegwan@example.com',
        username: 'haegwan',
        workspace_id: 'workspace-1',
        workspace_code: '39467777',
        workspace_name: 'Workspace A',
        permissions: ['platform:read'],
        permission_level: 'admin',
        token_id: 'session-1',
        token_name: 'Sanka MCP',
      },
      message: 'ok',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['http://localhost:5000/api/v2/auth/session']);
  });
});
