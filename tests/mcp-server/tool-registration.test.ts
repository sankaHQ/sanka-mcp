import { configureLogger } from '../../packages/mcp-server/src/logger';
import { selectTools } from '../../packages/mcp-server/src/server';
import { McpTool } from '../../packages/mcp-server/src/types';
import * as browserUseTools from '../../packages/mcp-server/src/browser-use-tools';
import * as capabilityGuidanceTools from '../../packages/mcp-server/src/capability-guidance-tools';
import * as crmTools from '../../packages/mcp-server/src/crm-tools';
import * as demoTools from '../../packages/mcp-server/src/demo-tools';
import * as docsSearchTool from '../../packages/mcp-server/src/docs-search-tool';
import * as sankaBuyTools from '../../packages/mcp-server/src/sanka-buy-tools';
import * as transferTools from '../../packages/mcp-server/src/transfer-tools';
import * as workflowRunTools from '../../packages/mcp-server/src/workflow-run-tools';
import * as workflowTools from '../../packages/mcp-server/src/workflow-tools';

/**
 * Every module that defines McpTool consts consumed by selectTools in
 * server.ts. Add new tool modules here so their exports are covered by the
 * registration-completeness check below.
 */
const TOOL_MODULES: Record<string, Record<string, unknown>> = {
  'browser-use-tools': browserUseTools,
  'capability-guidance-tools': capabilityGuidanceTools,
  'crm-tools': crmTools,
  'demo-tools': demoTools,
  'docs-search-tool': docsSearchTool,
  'sanka-buy-tools': sankaBuyTools,
  'transfer-tools': transferTools,
  'workflow-run-tools': workflowRunTools,
  'workflow-tools': workflowTools,
};

/**
 * Tools that are exported from a tool module but intentionally NOT registered
 * in selectTools. Every entry must explain why it is excluded; the test fails
 * if an entry is stale (registered after all) or unknown.
 */
const INTENTIONALLY_UNREGISTERED: Record<string, string> = {
  // (none today - a defined-but-unregistered tool is a bug unless listed here)
};

const isMcpTool = (value: unknown): value is McpTool => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const tool = candidate['tool'] as Record<string, unknown> | undefined;
  return (
    typeof candidate['handler'] === 'function' &&
    typeof candidate['metadata'] === 'object' &&
    candidate['metadata'] !== null &&
    typeof tool === 'object' &&
    tool !== null &&
    typeof tool['name'] === 'string'
  );
};

const definedTools = (): Array<{ module: string; exportName: string; toolName: string }> => {
  const found: Array<{ module: string; exportName: string; toolName: string }> = [];
  for (const [moduleName, moduleExports] of Object.entries(TOOL_MODULES)) {
    for (const [exportName, value] of Object.entries(moduleExports)) {
      if (isMcpTool(value)) {
        found.push({ module: moduleName, exportName, toolName: value.tool.name });
      }
    }
  }
  return found;
};

describe('tool registration completeness', () => {
  let registeredNames: Set<string>;

  beforeAll(() => {
    configureLogger({ level: 'error', pretty: false });
    registeredNames = new Set(selectTools(undefined, 'full').map((mcpTool) => mcpTool.tool.name));
  });

  it('finds the exported tool definitions', () => {
    // Guards the introspection itself: if the export scan ever breaks, this
    // fails loudly instead of the main test passing vacuously.
    expect(definedTools().length).toBeGreaterThan(250);
  });

  it('registers every exported tool in the full profile', () => {
    const missing = definedTools()
      .filter(({ exportName }) => !(exportName in INTENTIONALLY_UNREGISTERED))
      .filter(({ toolName }) => !registeredNames.has(toolName))
      .map(({ module, exportName, toolName }) => `${module}.${exportName} (${toolName})`);

    // A tool defined in a module but missing from selectTools in server.ts is
    // silently unreachable. Register it in selectTools, or add it to
    // INTENTIONALLY_UNREGISTERED with a reason.
    expect(missing).toEqual([]);
  });

  it('keeps the intentional-exclusion list accurate', () => {
    const definedByExportName = new Map(definedTools().map((entry) => [entry.exportName, entry]));
    for (const exportName of Object.keys(INTENTIONALLY_UNREGISTERED)) {
      const entry = definedByExportName.get(exportName);
      // Unknown entries are stale: the export no longer exists.
      expect(entry).toBeDefined();
      // Registered entries are stale: the tool is no longer excluded.
      expect(registeredNames.has(entry!.toolName)).toBe(false);
    }
  });

  it('never registers two tools under the same name', () => {
    const names = selectTools(undefined, 'full').map((mcpTool) => mcpTool.tool.name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    expect(duplicates).toEqual([]);
  });
});
