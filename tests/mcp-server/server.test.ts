import { configureLogger } from '../../packages/mcp-server/src/logger';
import { recordMcpToolCall, selectTools } from '../../packages/mcp-server/src/server';
import {
  DEFAULT_INSTRUCTIONS_MAX_BYTES,
  getInstructions,
  getWorkflowGuidance,
} from '../../packages/mcp-server/src/instructions';
import { applyRequiredScopesToSecuritySchemes } from '../../packages/mcp-server/src/tool-scope-requirements';

describe('profile-aware tool selection', () => {
  beforeAll(() => {
    configureLogger({ level: 'error', pretty: false });
  });

  it('records MCP tool calls through the V2 audit route', async () => {
    const post = jest.fn().mockResolvedValue({});
    const logger = { warn: jest.fn() };

    await recordMcpToolCall({
      client: { post } as never,
      logger,
      mcpTool: {
        tool: { name: 'list_deals', title: 'List deals' },
        metadata: { resource: 'deals', operation: 'list' },
      } as never,
      reqContext: {
        mcpSessionId: 'mcp-session-1',
        auth: { authMode: 'oauth_bearer' },
        mcpClientInfo: { name: 'Claude', version: '1.0.0' },
      } as never,
      result: { content: [], isError: false },
      startedAt: Date.now() - 12,
    });

    expect(post).toHaveBeenCalledWith('/api/v2/mcp/tool-call-log', {
      body: expect.objectContaining({
        tool_name: 'list_deals',
        tool_title: 'List deals',
        resource: 'deals',
        operation: 'list',
        success: true,
        client_name: 'Claude',
        client_version: '1.0.0',
      }),
      headers: { 'X-Sanka-MCP-Session-ID': 'mcp-session-1' },
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not register duplicate tool names', () => {
    for (const profile of ['full', 'hosted'] as const) {
      const toolNames = selectTools(undefined, profile).map((tool) => tool.tool.name);
      expect(toolNames).toHaveLength(new Set(toolNames).size);
    }
  });

  it('keeps cleanup tools available for workflow-created records', () => {
    const workflowCleanupTools = [
      'delete_estimate',
      'delete_order',
      'delete_invoice',
      'delete_subscription',
      'delete_purchase_order',
      'delete_task',
    ];

    for (const profile of ['full', 'hosted'] as const) {
      const selectedTools = selectTools(undefined, profile);
      const toolsByName = new Map(selectedTools.map((selected) => [selected.tool.name, selected.tool]));

      for (const toolName of workflowCleanupTools) {
        const tool = toolsByName.get(toolName);
        expect(tool).toBeDefined();
        expect(tool?.annotations?.destructiveHint).toBe(true);
      }
    }
  });

  it('hides generic docs/code tools from the hosted profile', () => {
    const hostedNames = new Set(selectTools(undefined, 'hosted').map((tool) => tool.tool.name));
    const fullNames = selectTools(undefined, 'full').map((tool) => tool.tool.name);

    expect(fullNames.filter((name) => !hostedNames.has(name))).toEqual(['execute', 'search_docs']);
  });

  it('advertises resource-specific OAuth scopes on protected tools', () => {
    const tools = selectTools(undefined, 'hosted').map(applyRequiredScopesToSecuritySchemes);
    const listDeals = tools.find((tool) => tool.tool.name === 'list_deals');
    const listInventories = tools.find((tool) => tool.tool.name === 'list_inventories');
    const getWorkflowRun = tools.find((tool) => tool.tool.name === 'get_workflow_run');

    expect(listDeals?.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['deals:read'] }]);
    expect(listInventories?.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['inventories:read'] }]);
    expect(getWorkflowRun?.tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['mcp:access'] }]);
  });

  it('returns compact unified instructions from the default profile', async () => {
    const instructions = await getInstructions({ toolProfile: 'full' });
    const documented = [instructions, ...getWorkflowGuidance('full')].join('\n');

    expect(Buffer.byteLength(instructions, 'utf8')).toBeLessThanOrEqual(DEFAULT_INSTRUCTIONS_MAX_BYTES);
    expect(instructions).toContain('execute');
    expect(instructions).toContain('search_docs');
    expect(instructions).toContain('get_capability_guidance');
    expect(instructions).toContain('Guardrails:');
    expect(documented).not.toContain('Sakura plugin');
    for (const phrase of [
      'qbo_expense_account_id',
      'workflow_type=bill_export',
      'QuickBooks BillPayment is a separate workflow',
      'Do not render Sanka record numbers as Markdown issue references',
      '売上請求番号 7',
      'Order is "受注" and Invoice is "売上請求"',
      'status=draft should be shown as "下書き"',
      'For Sanka company cycles',
      'billing_cycle and payment_cycle are standard company fields',
      'Do not say a Sanka tool or API call failed unless',
      'structuredContent.required_user_facing_reply',
      'prefer the plugin-attached namespace',
      'mcp__sakura_plugin__*',
      'installed Sanka plugin chip',
      'mcp__sanka_key__*',
      'Only use download_estimate_pdf when the user explicitly asks',
    ]) {
      expect(documented).toContain(phrase);
    }
  });

  it('returns hosted instructions without generic docs/code tools', async () => {
    const instructions = await getInstructions({ toolProfile: 'hosted' });
    const documented = [instructions, ...getWorkflowGuidance('hosted')].join('\n');

    expect(Buffer.byteLength(instructions, 'utf8')).toBeLessThanOrEqual(DEFAULT_INSTRUCTIONS_MAX_BYTES);
    expect(instructions).not.toContain('execute');
    expect(instructions).not.toContain('search_docs');
    expect(instructions).toContain('get_capability_guidance');
    expect(instructions).toContain('Guardrails:');
    expect(documented).not.toContain('Sakura plugin');
    for (const phrase of [
      'qbo_expense_account_id',
      'additional_pdf_attachments',
      'workflow_type=bill_export',
      'QuickBooks BillPayment is a separate workflow',
      'action="draft"',
      'structuredContent.required_user_facing_reply',
      'prefer the plugin-attached namespace',
      'mcp__sakura_plugin__*',
      'installed Sanka plugin chip',
      'mcp__sanka_key__*',
      'Only use download_estimate_pdf when the user explicitly asks',
    ]) {
      expect(documented).toContain(phrase);
    }
  });
});
