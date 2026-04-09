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
    expect(toolNames).toContain('list_expenses');
    expect(toolNames).toContain('get_expense');
    expect(toolNames).toContain('upload_expense_attachment');
    expect(toolNames).toContain('create_expense');
    expect(toolNames).toContain('update_expense');
    expect(toolNames).toContain('delete_expense');
  });

  it('hides generic docs/code tools from the hosted profile', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    expect(toolNames).not.toContain('execute');
    expect(toolNames).not.toContain('search_docs');
    expect(toolNames).toContain('auth_status');
    expect(toolNames).toContain('list_companies');
    expect(toolNames).toContain('list_contacts');
    expect(toolNames).toContain('list_expenses');
    expect(toolNames).toContain('get_expense');
    expect(toolNames).toContain('upload_expense_attachment');
    expect(toolNames).toContain('create_expense');
    expect(toolNames).toContain('update_expense');
    expect(toolNames).toContain('delete_expense');
  });

  it('returns unified instructions from the default profile', async () => {
    const instructions = await getInstructions({ toolProfile: 'full' });

    expect(instructions).toContain('execute');
    expect(instructions).toContain('search_docs');
    expect(instructions).toContain('auth_status');
    expect(instructions).toContain('list_companies');
    expect(instructions).toContain('list_contacts');
    expect(instructions).toContain('list_expenses');
    expect(instructions).toContain('get_expense');
    expect(instructions).toContain('upload_expense_attachment');
    expect(instructions).toContain('create_expense');
    expect(instructions).toContain('update_expense');
    expect(instructions).toContain('delete_expense');
  });

  it('returns hosted instructions without generic docs/code tools', async () => {
    const instructions = await getInstructions({ toolProfile: 'hosted' });

    expect(instructions).not.toContain('execute');
    expect(instructions).not.toContain('search_docs');
    expect(instructions).toContain('auth_status');
    expect(instructions).toContain('list_companies');
    expect(instructions).toContain('list_contacts');
    expect(instructions).toContain('list_expenses');
    expect(instructions).toContain('get_expense');
    expect(instructions).toContain('upload_expense_attachment');
    expect(instructions).toContain('create_expense');
    expect(instructions).toContain('update_expense');
    expect(instructions).toContain('delete_expense');
  });
});
