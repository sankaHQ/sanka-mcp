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

  it('exposes only explicit CRM tools in the chatgpt profile', () => {
    const toolNames = selectTools(undefined, 'chatgpt').map((tool) => tool.tool.name);

    expect(toolNames).toEqual(['crm.list_companies', 'crm.list_contacts']);
  });

  it('returns chatgpt-specific instructions for the chatgpt profile', async () => {
    const instructions = await getInstructions({ toolProfile: 'chatgpt' });

    expect(instructions).toContain('crm.list_companies');
    expect(instructions).toContain('crm.list_contacts');
    expect(instructions).not.toContain('execute');
    expect(instructions).not.toContain('search_docs');
  });
});
