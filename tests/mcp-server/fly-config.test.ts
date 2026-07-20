import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe.each(['fly.toml', 'fly.staging.toml'])('%s OAuth routing', (configPath) => {
  const config = readFileSync(resolve(process.cwd(), configPath), 'utf8');

  it('keeps public OAuth discovery separate from internal auth requests', () => {
    expect(config).toContain('MCP_SERVER_AUTHORIZATION_SERVER_URL = "https://app.sanka.com"');
    expect(config).toContain('MCP_SERVER_INTERNAL_AUTHORIZATION_SERVER_URL = "https://api.prv.sanka.com"');
  });
});
