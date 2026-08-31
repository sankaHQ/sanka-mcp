import { createHmac } from 'node:crypto';
import { buildMcpConnectToken, SANKA_MCP_CONNECT_AUDIENCE } from './mcp-connect';

describe('buildMcpConnectToken', () => {
  it('mints the API-compatible audience and resource claims', () => {
    const token = buildMcpConnectToken({
      now: 1_700_000_000_000,
      resource: 'https://mcp.sanka.com/mcp',
      sessionId: 'session-1',
      sharedSecret: 'shared-secret',
    });

    expect(token).toBeDefined();
    const [payload = '', signature = ''] = token!.split('.');
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))).toMatchObject({
      aud: SANKA_MCP_CONNECT_AUDIENCE,
      res: 'https://mcp.sanka.com/mcp',
      sid: 'session-1',
      v: 1,
    });
    expect(signature).toBe(createHmac('sha256', 'shared-secret').update(payload).digest('base64url'));
  });
});
