import { File } from 'node:buffer';
import {
  crmCreateExpenseTool,
  crmDeleteExpenseTool,
  crmAuthStatusTool,
  crmGetExpenseTool,
  crmListCompaniesTool,
  crmListContactsTool,
  crmListExpensesTool,
  crmUpdateExpenseTool,
  crmUploadExpenseAttachmentTool,
} from '../../packages/mcp-server/src/crm-tools';

const oauthContext = (overrides?: {
  authMode?: 'none' | 'api_key' | 'legacy_oauth_jwt' | 'resource_oauth_jwt';
  scopes?: string[];
}) => ({
  authMode: overrides?.authMode ?? 'resource_oauth_jwt',
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: overrides?.scopes ?? [],
  },
});

describe('ChatGPT CRM tools', () => {
  it('advertises auth schemes on CRM tools', () => {
    expect(crmAuthStatusTool.tool.securitySchemes).toEqual([{ type: 'noauth' }]);
    expect(crmListCompaniesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListContactsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListExpensesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetExpenseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUploadExpenseAttachmentTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateExpenseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateExpenseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteExpenseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
  });

  it('returns a reauth challenge when auth status is checked without authentication', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      connected: false,
      auth_mode: 'none',
      tool_profile: 'full',
      scopes: [],
      message: 'Sanka CRM is not connected yet. Approve the OAuth prompt in your MCP client, then retry.',
      resource_url: 'https://mcp.sanka.com/mcp',
    });
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
  });

  it('reports connected auth status when OAuth is present', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      connected: true,
      auth_mode: 'resource_oauth_jwt',
      tool_profile: 'full',
      scopes: [],
      message: 'Sanka CRM is connected with OAuth.',
      resource_url: 'https://mcp.sanka.com/mcp',
    });
  });

  it('returns reauth metadata when list companies is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListCompaniesTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { list },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: { search: 'Acme' },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(list).not.toHaveBeenCalled();
  });

  it('lists companies when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      count: 1,
      data: [{ id: 'company-1', name: 'Acme' }],
      message: 'ok',
      page: 1,
      total: 1,
      permission: 'edit',
    });

    const result = await crmListCompaniesTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(list).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
  });

  it('lists companies with structured content when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      count: 2,
      data: [{ id: 'company-1', name: 'Acme' }],
      message: 'ok',
      page: 1,
      total: 2,
      permission: 'edit',
    });

    const result = await crmListCompaniesTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 5, page: 2, search: 'Acme', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        limit: 5,
        page: 2,
        search: 'Acme',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 2,
      message: 'ok',
      permission: 'edit',
      results: [{ id: 'company-1', name: 'Acme' }],
    });
  });

  it('lists contacts when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      count: 1,
      data: [{ id: 'contact-1', name: 'Jane Doe' }],
      message: 'ok',
      page: 1,
      total: 1,
      permission: 'view',
    });

    const result = await crmListContactsTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 20 },
    });

    expect(list).toHaveBeenCalledWith(
      {
        limit: 20,
        page: 1,
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'ok',
      permission: 'view',
      results: [{ id: 'contact-1', name: 'Jane Doe' }],
    });
  });

  it('lists expenses with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      { id: 'expense-1', description: 'Google Workspace', company_name: 'Google', amount: 20, currency: 'USD' },
      { id: 'expense-2', description: 'Zoom', company_name: 'Zoom', amount: 10, currency: 'USD' },
      { id: 'expense-3', description: 'Loom', company_name: 'Loom', amount: 5, currency: 'USD' },
    ]);

    const result = await crmListExpensesTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, language: 'en', workspace_id: 'workspace-1' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 expenses.',
      permission: undefined,
      results: [
        { id: 'expense-1', description: 'Google Workspace', company_name: 'Google', amount: 20, currency: 'USD' },
        { id: 'expense-2', description: 'Zoom', company_name: 'Zoom', amount: 10, currency: 'USD' },
      ],
    });
  });

  it('returns reauth metadata when list expenses is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListExpensesTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { list },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(list).not.toHaveBeenCalled();
  });

  it('gets one expense when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'expense-1',
      description: 'Google Workspace',
      company_name: 'Google',
      amount: 20,
      currency: 'USD',
      created_at: '2026-04-08T00:00:00Z',
    });

    const result = await crmGetExpenseTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { expense_id: 'expense-1', external_id: 'EXP-1', language: 'en' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'expense-1',
      {
        external_id: 'EXP-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'expense-1',
      description: 'Google Workspace',
      company_name: 'Google',
      amount: 20,
      currency: 'USD',
      created_at: '2026-04-08T00:00:00Z',
    });
  });

  it('uploads an expense attachment from base64 content', async () => {
    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'file-1',
      filename: 'receipt.pdf',
    });

    const result = await crmUploadExpenseAttachmentTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { uploadAttachment },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filename: 'receipt.pdf',
        mime_type: 'application/pdf',
        content_base64: Buffer.from('test receipt').toString('base64'),
      },
    });

    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const [payload] = uploadAttachment.mock.calls[0];
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe('receipt.pdf');
    expect(payload.file.type).toBe('application/pdf');
    expect(result.structuredContent).toEqual({
      ok: true,
      file_id: 'file-1',
      filename: 'receipt.pdf',
    });
  });

  it('creates an expense with uploaded attachment ids', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      expense_id: 'expense-1',
      external_id: 'EXP-1',
    });

    const result = await crmCreateExpenseTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        amount: 100,
        currency: 'USD',
        description: 'Hotel',
        status: 'submitted',
        attachment_file_ids: ['file-1', 'file-2'],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        amount: 100,
        currency: 'USD',
        description: 'Hotel',
        status: 'submitted',
        attachment_file: {
          files: [{ file_id: 'file-1' }, { file_id: 'file-2' }],
        },
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      expense_id: 'expense-1',
      external_id: 'EXP-1',
    });
  });

  it('updates an expense', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      expense_id: 'expense-1',
    });

    const result = await crmUpdateExpenseTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        expense_id: 'expense-1',
        description: 'Updated hotel',
        company_id: 'company-1',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'expense-1',
      {
        description: 'Updated hotel',
        company_id: 'company-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      expense_id: 'expense-1',
    });
  });

  it('deletes an expense', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      expense_id: 'expense-1',
    });

    const result = await crmDeleteExpenseTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        expense_id: 'expense-1',
        external_id: 'EXP-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'expense-1',
      {
        external_id: 'EXP-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      expense_id: 'expense-1',
    });
  });
});
