import {
  getCapabilityGuidanceTool,
  selectWorkflowGuidance,
} from '../../packages/mcp-server/src/capability-guidance-tools';
import {
  DEFAULT_INSTRUCTIONS_MAX_BYTES,
  SHARED_WORKFLOW_GUIDANCE,
  buildDefaultInstructions,
  getInstructions,
  getWorkflowGuidance,
} from '../../packages/mcp-server/src/instructions';
import { configureLogger } from '../../packages/mcp-server/src/logger';
import type { ToolProfile } from '../../packages/mcp-server/src/profile';
import { selectTools } from '../../packages/mcp-server/src/server';

beforeAll(() => {
  configureLogger({ level: 'error', pretty: false });
});

// Codex code mode ships every enabled tool definition in one IPC frame capped at 64 MiB and copies
// the server instructions into each MCP tool definition, so the catalog costs roughly
// `(tool count + 1) * instructions size` plus the tool definitions. Keep a wide margin below the cap.
const CODE_MODE_FRAME_LIMIT_BYTES = 64 * 1024 * 1024;
const CATALOG_BUDGET_BYTES = 16 * 1024 * 1024;

const PROFILES: ToolProfile[] = ['full', 'hosted'];

const estimateCodeModeFrameBytes = (profile: ToolProfile, instructions: string): number => {
  const tools = selectTools(undefined, profile);
  const definitions = Buffer.byteLength(JSON.stringify(tools.map((tool) => tool.tool)), 'utf8');
  return (tools.length + 1) * Buffer.byteLength(instructions, 'utf8') + definitions;
};

describe('default instructions', () => {
  it.each(PROFILES)('keeps the %s profile instructions within the catalog budget', async (profile) => {
    const instructions = await getInstructions({ toolProfile: profile });

    expect(instructions).toBe(buildDefaultInstructions(profile));
    expect(Buffer.byteLength(instructions, 'utf8')).toBeLessThanOrEqual(DEFAULT_INSTRUCTIONS_MAX_BYTES);

    const frameBytes = estimateCodeModeFrameBytes(profile, instructions);
    expect(frameBytes).toBeLessThanOrEqual(CATALOG_BUDGET_BYTES);
    expect(frameBytes).toBeLessThan(CODE_MODE_FRAME_LIMIT_BYTES);
  });

  it.each(PROFILES)('does not enumerate the %s tool catalog', async (profile) => {
    const instructions = await getInstructions({ toolProfile: profile });
    const lines = instructions.split('\n');
    const enumerated = selectTools(undefined, profile)
      .map((tool) => tool.tool.name)
      .filter((name) => lines.some((line) => line.startsWith(`- ${name}:`)));

    expect(enumerated).toEqual([]);
    expect(instructions).not.toContain('Available tools:');
    expect(instructions).not.toContain('Workflow:');
    expect(instructions).toContain('Guardrails:');
    expect(instructions).toContain('get_capability_guidance');
  });

  it.each(PROFILES)('keeps the %s guardrails that every client relies on', async (profile) => {
    const instructions = await getInstructions({ toolProfile: profile });

    expect(instructions).toContain('Never fabricate live Sanka data');
    expect(instructions).toContain('Order is "受注" and Invoice is "売上請求"');
    expect(instructions).toContain('expected_workspace_id');
    expect(instructions).toContain('Do not say a Sanka tool or API call failed unless');
  });

  it('serves the workflow rules per profile instead of embedding them', () => {
    const hosted = getWorkflowGuidance('hosted');
    const full = getWorkflowGuidance('full');

    expect(hosted).toEqual(SHARED_WORKFLOW_GUIDANCE);
    expect(full.slice(0, hosted.length)).toEqual(hosted);
    expect(full.length).toBeGreaterThan(hosted.length);
    expect(hosted.join('\n')).not.toContain('execute');
    expect(hosted.join('\n')).toContain('workflow_type=bill_export');
    expect(full.join('\n')).toContain('Use execute only for Sanka SDK workflows');
  });
});

describe('get_capability_guidance workflow rules', () => {
  it('returns the workflow rules that match the request hints', async () => {
    const result = await getCapabilityGuidanceTool.handler({
      reqContext: {
        client: {} as any,
      },
      args: {
        provider: 'quickbooks',
        object_type: 'bill',
        operation: 'export',
        intent: 'Export the approved bills to QuickBooks',
      },
    });

    const guidance = result.structuredContent?.['guidance'] as any;
    expect(guidance.workflow_guidance_scope).toBe('matched');
    expect(guidance.workflow_guidance.join('\n')).toContain('workflow_type=bill_export');
    expect(guidance.workflow_guidance.length).toBeLessThan(SHARED_WORKFLOW_GUIDANCE.length);
    expect(result.content[0]).toMatchObject({ type: 'text' });
  });

  it('falls back to every workflow rule when nothing matches', () => {
    expect(selectWorkflowGuidance({ intent: 'zzzz' })).toEqual({
      workflow_guidance: SHARED_WORKFLOW_GUIDANCE,
      workflow_guidance_scope: 'all',
    });
    expect(selectWorkflowGuidance(undefined).workflow_guidance_scope).toBe('all');
    expect(selectWorkflowGuidance({ intent: 'with this' }).workflow_guidance_scope).toBe('all');
  });
});
