import { configureLogger } from '../../packages/mcp-server/src/logger';
import { selectTools } from '../../packages/mcp-server/src/server';
import { getInstructions } from '../../packages/mcp-server/src/instructions';

describe('profile-aware tool selection', () => {
  beforeAll(() => {
    configureLogger({ level: 'error', pretty: false });
  });

  it('keeps execute available in the full profile', () => {
    const toolNames = selectTools(undefined, 'full').map((tool) => tool.tool.name);

    expect(toolNames).toContain('execute');
    expect(toolNames).toContain('search_docs');
    expect(toolNames).not.toContain('crm.list_companies');
  });

  it('exposes only explicit CRM tools in the crm profile', () => {
    const toolNames = selectTools(undefined, 'crm').map((tool) => tool.tool.name);

    expect(toolNames).toEqual(['crm.auth_status', 'crm.list_companies', 'crm.list_contacts']);
  });

  it('returns crm-specific instructions for the crm profile', async () => {
    const instructions = await getInstructions({ toolProfile: 'crm' });

    expect(instructions).toContain('crm.auth_status');
    expect(instructions).toContain('crm.list_companies');
    expect(instructions).toContain('crm.list_contacts');
    expect(instructions).not.toContain('execute');
    expect(instructions).not.toContain('search_docs');
  });
});
