import { configureLogger } from '../../packages/mcp-server/src/logger';
import { executeHandler, selectTools } from '../../packages/mcp-server/src/server';
import {
  canValidateToolArguments,
  INVALID_TOOL_ARGUMENTS_ERROR_TYPE,
  validateToolArguments,
} from '../../packages/mcp-server/src/tool-argument-validator';
import { normalizeToolCallResult } from '../../packages/mcp-server/src/tool-result-normalizer';
import { McpRequestContext, McpTool, ToolCallResult } from '../../packages/mcp-server/src/types';

const successResult: ToolCallResult = {
  content: [{ type: 'text', text: 'ok' }],
  structuredContent: { ok: true },
};

const makeTool = (handler: jest.Mock = jest.fn().mockResolvedValue(successResult)): McpTool =>
  ({
    metadata: {
      resource: 'widgets',
      operation: 'read',
      tags: ['widgets'],
    },
    tool: {
      name: 'list_widgets',
      title: 'List widgets',
      description: 'List widgets.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
        },
        required: ['name'],
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    handler,
  }) as unknown as McpTool;

const reqContext = { client: {} } as unknown as McpRequestContext;

describe('tool argument validation', () => {
  beforeAll(() => {
    configureLogger({ level: 'error', pretty: false });
  });

  it('rejects arguments that violate the input schema without invoking the handler', async () => {
    const handler = jest.fn();
    const result = await executeHandler({
      mcpTool: makeTool(handler),
      reqContext,
      args: { name: 42, limit: 500 },
    });

    expect(handler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('Invalid arguments for list_widgets');
    expect(text).toContain('/name must be string');
    expect(text).toContain('/limit must be <= 100');
    expect(text).toContain('Fix the listed arguments');
    expect(result.structuredContent).toMatchObject({
      ok: false,
      status: 'invalid_arguments',
      status_code: 400,
      error_type: INVALID_TOOL_ARGUMENTS_ERROR_TYPE,
      validation_errors: expect.arrayContaining([
        expect.stringContaining('/name must be string'),
        expect.stringContaining('/limit must be <= 100'),
      ]),
    });
  });

  it('reports missing required arguments, treating absent arguments as an empty object', async () => {
    const handler = jest.fn();
    const result = await executeHandler({
      mcpTool: makeTool(handler),
      reqContext,
      args: undefined,
    });

    expect(handler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("must have required property 'name'");
  });

  it('passes valid arguments through to the handler unchanged', async () => {
    const handler = jest.fn().mockResolvedValue(successResult);
    const result = await executeHandler({
      mcpTool: makeTool(handler),
      reqContext,
      args: { name: 'alpha', limit: 100 },
    });

    expect(handler).toHaveBeenCalledWith({ reqContext, args: { name: 'alpha', limit: 100 } });
    expect(result).toBe(successResult);
  });

  it('normalizes validation failures as non-retryable with fix-the-arguments remediation', () => {
    const mcpTool = makeTool();
    const validationError = validateToolArguments({ mcpTool, args: { name: 'alpha', limit: 101 } });

    expect(validationError).toBeDefined();
    const normalized = normalizeToolCallResult({
      mcpTool,
      args: { name: 'alpha', limit: 101 },
      result: validationError as ToolCallResult,
    });

    expect(normalized.isError).toBe(true);
    expect(normalized.structuredContent?.['remediation']).toMatchObject({
      safe_to_continue: false,
      can_retry: false,
      retry_reason: undefined,
      required_next_action:
        'Fix the arguments listed in validation_errors to match the tool input schema, then call the tool again with corrected arguments.',
    });
  });

  it('returns undefined for valid arguments', () => {
    expect(validateToolArguments({ mcpTool: makeTool(), args: { name: 'alpha' } })).toBeUndefined();
  });

  it('compiles a runtime validator for every selected tool input schema', () => {
    const tools = selectTools(undefined, 'full');

    expect(tools.length).toBeGreaterThan(0);
    const unvalidatable = tools
      .filter((mcpTool) => !canValidateToolArguments(mcpTool))
      .map((mcpTool) => mcpTool.tool.name);
    expect(unvalidatable).toEqual([]);
  });
});
