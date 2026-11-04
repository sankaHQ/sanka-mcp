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

const toolAt = (name: string, httpPath: string): McpTool => {
  const base = makeTool();
  return makeTool({ metadata: { ...base.metadata, httpPath }, tool: { ...base.tool, name } });
};

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

  const DEAL_PATH = '/api/v2/public/deals/{case_id}';
  const VIEW_PATH = '/api/v2/views/{view_id}';

  it.each([
    {
      name: 'a field that did not come back',
      tool: toolAt('update_deal', DEAL_PATH),
      args: { name: 'Renewal', currency: 'JPY' },
      response: { status: 'updated', record_preview: { currency: 'JPY' } },
      requested: ['name', 'currency'],
      returned: { currency: 'JPY' },
      verificationNeeded: true,
    },
    {
      name: 'selectors echoed while the field was dropped',
      tool: toolAt('update_view', VIEW_PATH),
      args: { view_id: 'view-1', object: 'deals', workspace_id: 'ws-1', columns: ['standard:name'] },
      response: { view_id: 'view-1', object: 'deals', workspace_id: 'ws-1' },
      requested: ['columns'],
      returned: {},
      verificationNeeded: true,
    },
    {
      name: 'a call that only selects a record',
      tool: toolAt('delete_view', VIEW_PATH),
      args: { view_id: 'view-1', object: 'deals', workspace_id: 'ws-1' },
      response: { ok: true, status: 'deleted' },
      requested: [],
      returned: {},
      verificationNeeded: false,
    },
    {
      name: 'every field back, with selectors and preconditions not echoed',
      tool: toolAt('update_deal', DEAL_PATH),
      args: { workspace_id: 'ws-1', expected_version: 3, idempotency_key: 'key-1', currency: 'JPY' },
      response: { status: 'updated', record_preview: { currency: 'JPY' } },
      requested: ['currency'],
      returned: { currency: 'JPY' },
      verificationNeeded: false,
    },
    {
      name: 'a selector passed under its camelCase alias',
      tool: toolAt('update_permission_set', '/api/v2/permission-sets/{permission_set_id}'),
      args: { permissionSetId: 'set-1', customObjectId: 'object-1', name: 'Sales' },
      response: { name: 'Sales' },
      requested: ['name'],
      returned: { name: 'Sales' },
      verificationNeeded: false,
    },
    {
      name: 'the call outcome read as the requested status',
      tool: toolAt('update_estimate', '/api/v2/public/estimates/{estimate_id}'),
      args: { status: 'sent' },
      response: { ok: true, status: 'updated' },
      requested: ['status'],
      returned: {},
      verificationNeeded: true,
    },
    {
      name: 'the record status beside the call outcome',
      tool: toolAt('update_estimate', '/api/v2/public/estimates/{estimate_id}'),
      args: { status: 'sent' },
      response: { status: 'updated', record_preview: { status: 'sent' } },
      requested: ['status'],
      returned: { status: 'sent' },
      verificationNeeded: false,
    },
    {
      name: 'a top-level status that is the requested one',
      tool: toolAt('update_watchtower_finding', '/api/v2/watchtower/findings/{finding_id}'),
      args: { status: 'confirmed' },
      response: { status: 'confirmed' },
      requested: ['status'],
      returned: { status: 'confirmed' },
      verificationNeeded: false,
    },
    {
      name: 'the response envelope read as the requested data',
      tool: toolAt('create_custom_object_record', '/api/v2/public/records/custom-objects/records'),
      args: { data: { subject: 'Kickoff' } },
      response: { data: { id: 'record-1' } },
      requested: ['data'],
      returned: {},
      verificationNeeded: true,
    },
    {
      name: 'a normalised value, which is not compared',
      tool: toolAt('update_view', VIEW_PATH),
      args: { columns: ['name'] },
      response: { record_preview: { columns: ['standard:name'] } },
      requested: ['columns'],
      returned: { columns: ['standard:name'] },
      verificationNeeded: false,
    },
    {
      name: 'an empty list back for a list that had rows',
      tool: toolAt('create_subscription', '/api/v2/subscriptions'),
      args: { items: [{ item_name: 'Plan' }] },
      response: { items: [] },
      requested: ['items'],
      returned: {},
      verificationNeeded: true,
    },
    {
      name: 'null back for a value',
      tool: toolAt('update_deal', DEAL_PATH),
      args: { currency: 'JPY' },
      response: { record_preview: { currency: null } },
      requested: ['currency'],
      returned: {},
      verificationNeeded: true,
    },
    {
      name: 'null back for a cleared field',
      tool: toolAt('update_deal', DEAL_PATH),
      args: { due_date: null },
      response: { record_preview: { due_date: null } },
      requested: ['due_date'],
      returned: { due_date: null },
      verificationNeeded: false,
    },
    {
      name: 'an instruction tool that echoes one argument',
      tool: toolAt('send_invoice_email', '/api/v2/invoices/{invoice_id}/send'),
      args: { to: 'a@example.com', subject: 'Invoice' },
      response: { to: 'a@example.com' },
      requested: ['to', 'subject'],
      returned: { to: 'a@example.com' },
      verificationNeeded: false,
    },
    {
      name: 'an instruction tool that echoes nothing',
      tool: toolAt('send_invoice_email', '/api/v2/invoices/{invoice_id}/send'),
      args: { to: 'a@example.com' },
      response: { ok: true },
      requested: ['to'],
      returned: {},
      verificationNeeded: true,
    },
  ])(
    'confirms requested fields: $name',
    ({ tool, args, response, requested, returned, verificationNeeded }) => {
      const result = normalizeToolCallResult({
        mcpTool: tool,
        args,
        now,
        result: { content: [], structuredContent: response },
      });

      const confirmation = result.structuredContent?.['confirmation'] as Record<string, unknown>;
      expect(Object.keys(confirmation['requested_fields'] as object)).toEqual(requested);
      expect(confirmation['returned_fields']).toEqual(returned);
      expect(confirmation['verification_needed']).toBe(verificationNeeded);
    },
  );

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

  it('summarizes arrays in the result copy instead of duplicating rows', () => {
    const rows = [
      { id: 'company-1', name: 'ADVATEC' },
      { id: 'company-2', name: 'Sanka' },
    ];
    const result = normalizeToolCallResult({
      mcpTool: makeTool(),
      args: { object_type: 'companies' },
      now,
      result: {
        content: [{ type: 'text', text: 'query_records returned 2 of 2 companies records.' }],
        structuredContent: {
          object_type: 'companies',
          count: 2,
          total: 2,
          message: 'OK',
          results: rows,
        },
      },
    });

    expect(result.structuredContent?.['results']).toEqual(rows);
    expect(result.structuredContent?.['result']).toEqual({
      object_type: 'companies',
      count: 2,
      total: 2,
      message: 'OK',
      results: '[array omitted: 2 items]',
    });
  });

  it('does not mark status-less string errors as retryable', () => {
    const result = normalizeToolCallResult({
      mcpTool: makeTool(),
      args: { case_id: 'case-1' },
      now,
      result: {
        content: [{ type: 'text', text: '`object_type` is required.' }],
        isError: true,
      },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent?.['remediation']).toMatchObject({
      safe_to_continue: false,
      can_retry: false,
      retry_reason: undefined,
      required_next_action: 'Inspect the error message and ctx_id before retrying.',
    });
  });

  it('keeps 429 rate limits retryable', () => {
    const result = normalizeToolCallResult({
      mcpTool: makeTool(),
      args: { case_id: 'case-1' },
      now,
      result: {
        content: [{ type: 'text', text: 'Rate limited' }],
        structuredContent: {
          status_code: 429,
          message: 'Rate limited',
        },
      },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent?.['remediation']).toMatchObject({
      can_retry: true,
      retry_reason: 'The tool failed without a client-correctable validation status.',
    });
  });

  it('keeps status-less connection errors retryable', () => {
    class APIConnectionError extends Error {}
    const result = normalizeToolCallResult({
      mcpTool: makeTool(),
      args: { case_id: 'case-1' },
      now,
      result: buildToolErrorResult(new APIConnectionError('Connection error.')),
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error_type: 'APIConnectionError',
      remediation: {
        can_retry: true,
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
