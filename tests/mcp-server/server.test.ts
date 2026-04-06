import { configureLogger } from '../../packages/mcp-server/src/logger';
import { selectTools } from '../../packages/mcp-server/src/server';
import { getInstructions } from '../../packages/mcp-server/src/instructions';

describe('profile-aware tool selection', () => {
  beforeAll(() => {
    configureLogger({ level: 'error', pretty: false });
  });

  it('exposes the unified toolset from the full profile', () => {
    const toolNames = selectTools(undefined, 'full').map((tool) => tool.tool.name);

    expect(toolNames).toContain('execute');
    expect(toolNames).toContain('search_docs');
    expect(toolNames).toContain('auth_status');
    expect(toolNames).toContain('list_companies');
    expect(toolNames).toContain('list_contacts');
  });

  it('returns unified instructions from the default profile', async () => {
    const instructions = await getInstructions({ toolProfile: 'full' });

    expect(instructions).toContain('execute');
    expect(instructions).toContain('search_docs');
    expect(instructions).toContain('auth_status');
    expect(instructions).toContain('list_companies');
    expect(instructions).toContain('list_contacts');
  });
});
