import {
  buildToolErrorResult,
  normalizeToolCallResult,
} from '../../packages/mcp-server/src/tool-result-normalizer';
import { McpTool } from '../../packages/mcp-server/src/types';

const makeTool = (overrides: Partial<McpTool> = {}): McpTool =>
  ({
    metadata: {
      resource: 'deals',
      operation: 'write',
      tags: ['crm', 'deals'],
      httpMethod: 'put',
      httpPath: '/api/v2/public/deals/{case_id}',
      operationId: 'public.deals.update',
    },
    tool: {
      name: 'update_deal',
      title: 'Update deal',
      description: 'Update a deal.',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    handler: jest.fn(),
    ...overrides,
  }) as McpTool;

describe('normalizeToolCallResult', () => {
  const now = new Date('2026-05-22T02:00:00.000Z');

  it('adds AI-operable confirmation and remediation fields to successful mutations', () => {
    const result = normalizeToolCallResult({
      mcpTool: makeTool(),
      args: {
        case_id: 'case-1',
        currency: 'JPY',
      },
      now,
      result: {
        content: [{ type: 'text', text: 'Deal updated: case-1.' }],
        structuredContent: {
          ok: true,
          status: 'updated',
          case_id: 'case-1',
          ctx_id: 'ctx-1',
        },
      },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'SUCCESS update_deal updated case_id=case-1 ok=true fields currency="JPY" verification=read_after_write_recommended',
    });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      status: 'updated',
      case_id: 'case-1',
      meta: {
        ok: true,
        success: true,
        tool_name: 'update_deal',
        resource: 'deals',
        operation: 'write',
        action: 'updated',
        ctx_id: 'ctx-1',
        timestamp: now.toISOString(),
      },
      result: {
        ok: true,
        status: 'updated',
        case_id: 'case-1',
        ctx_id: 'ctx-1',
      },
      confirmation: {
        ok: true,
        status: 'updated',
        record_ids: {
          case_id: 'case-1',
        },
        requested_fields: {
          currency: 'JPY',
        },
        returned_fields: {},
        verification_needed: true,
        advisory_count: 0,
        needs_confirmation: false,
      },
      remediation: {
        safe_to_continue: true,
        can_retry: false,
        required_next_action: 'Read the record again before claiming exact field-level state to the user.',
      },
    });
  });

  it('marks field-level verification complete when the API returns a record preview', () => {
    const result = normalizeToolCallResult({
      mcpTool: makeTool(),
      args: {
        case_id: 'case-1',
        currency: 'JPY',
      },
      now,
      result: {
        content: [{ type: 'text', text: 'Deal updated: case-1.' }],
        structuredContent: {
          ok: true,
          status: 'updated',
          case_id: 'case-1',
          record_preview: {
            currency: 'JPY',
          },
        },
      },
    });

    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'SUCCESS update_deal updated case_id=case-1 ok=true fields currency="JPY"',
    });
    expect(result.structuredContent?.['confirmation']).toMatchObject({
      requested_fields: {
        currency: 'JPY',
      },
      returned_fields: {
        currency: 'JPY',
      },
      verification_needed: false,
    });
    expect(result.structuredContent?.['remediation']).toMatchObject({
      safe_to_continue: true,
      can_retry: false,
      required_next_action: undefined,
    });
  });

  it('does not add mutation success prose to read-only tools', () => {
    const result = normalizeToolCallResult({
      mcpTool: makeTool({
        metadata: {
          resource: 'deals',
          operation: 'read',
          tags: ['crm', 'deals'],
          httpMethod: 'get',
          httpPath: '/api/v2/public/deals/{case_id}',
          operationId: 'public.deals.retrieve',
        },
        tool: {
          name: 'get_deal',
          title: 'Get deal',
          description: 'Get a deal.',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
          },
        },
      }),
      args: { case_id: 'case-1' },
      now,
      result: {
        content: [{ type: 'text', text: 'Loaded Deal: case-1.' }],
        structuredContent: {
          id: 'case-1',
          currency: 'JPY',
        },
      },
    });

    expect(result.content).toEqual([{ type: 'text', text: 'Loaded Deal: case-1.' }]);
    expect(result.structuredContent?.['meta']).toMatchObject({
      success: true,
      tool_name: 'get_deal',
      operation: 'read',
    });
  });

  it('normalizes HTTP error payloads as MCP errors without success prose', () => {
    const result = normalizeToolCallResult({
      mcpTool: makeTool(),
      args: {
        case_id: 'case-1',
        currency: 'JPY',
      },
      now,
      result: {
        content: [{ type: 'text', text: 'Failed to update case' }],
        structuredContent: {
          status_code: 500,
          message: 'Failed to update case',
          ctx_id: 'ctx-err',
        },
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'Failed to update case' }]);
    expect(result.structuredContent).toMatchObject({
      meta: {
        success: false,
        tool_name: 'update_deal',
        ctx_id: 'ctx-err',
      },
      remediation: {
        safe_to_continue: false,
        can_retry: true,
        retry_reason: 'The tool failed without a client-correctable validation status.',
        required_next_action: 'Inspect the error message and ctx_id before retrying.',
      },
    });
  });

  it('preserves thrown SDK HTTP status and error payloads for remediation', () => {
    const error = Object.assign(new Error('500 Failed to update case'), {
      status: 500,
      error: {
        message: 'Failed to update case',
        ctx_id: 'ctx-500',
      },
    });

    const result = normalizeToolCallResult({
      mcpTool: makeTool(),
      args: {
        case_id: 'case-1',
        currency: 'JPY',
      },
      now,
      result: buildToolErrorResult(error),
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      ok: false,
      status: 'error',
      status_code: 500,
      message: 'Failed to update case',
      ctx_id: 'ctx-500',
      meta: {
        success: false,
        ctx_id: 'ctx-500',
      },
      remediation: {
        safe_to_continue: false,
        can_retry: true,
        required_next_action: 'Inspect the error message and ctx_id before retrying.',
      },
    });
  });
});
