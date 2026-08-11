import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe.each(['fly.toml', 'fly.staging.toml'])('%s OAuth routing', (configPath) => {
  const config = readFileSync(resolve(process.cwd(), configPath), 'utf8');

  it('keeps public OAuth discovery separate from internal auth requests', () => {
    expect(config).toContain('MCP_SERVER_AUTHORIZATION_SERVER_URL = "https://app.sanka.com"');
    expect(config).toContain('MCP_SERVER_INTERNAL_AUTHORIZATION_SERVER_URL = "http://sanka-api.flycast"');
    expect(config).not.toContain(
      'MCP_SERVER_INTERNAL_AUTHORIZATION_SERVER_URL = "https://api.prv.sanka.com"',
    );
  });
});

describe('production deploy routing', () => {
  const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/deploy.yml'), 'utf8');

  it('accepts the Sanka PR flow deploy correlation input', () => {
    expect(workflow).toContain('upstream_deploy_id:');
    expect(workflow).toContain(
      'TRIGGER_ID: ${{ github.event.inputs.upstream_deploy_id || github.event.inputs.trigger_id }}',
    );
  });
});

describe('production API routing', () => {
  const config = readFileSync(resolve(process.cwd(), 'fly.toml'), 'utf8');

  it('routes hosted MCP API traffic through the Cloudflare-fronted host', () => {
    expect(config).toContain('SANKA_BASE_URL = "https://api-v2.sanka.com"');
    expect(config).not.toContain('SANKA_BASE_URL = "https://sanka-api.fly.dev"');
  });
});
