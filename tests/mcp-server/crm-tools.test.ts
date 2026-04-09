import { File } from 'node:buffer';
import {
  crmArchivePrivateMessageThreadTool,
  crmCancelCalendarAttendanceTool,
  crmCheckCalendarAvailabilityTool,
  crmCreateCalendarAttendanceTool,
  crmCreateCompanyTool,
  crmCreateContactTool,
  crmCreateDealTool,
  crmCreateEstimateTool,
  crmCreateExpenseTool,
  crmCreateInvoiceTool,
  crmCreateOrderTool,
  crmCreatePropertyTool,
  crmCreateTaskTool,
  crmCreateTicketTool,
  crmDeleteCompanyTool,
  crmDeleteContactTool,
  crmDeleteDealTool,
  crmDeleteEstimateTool,
  crmDeletePropertyTool,
  crmDeleteExpenseTool,
  crmDeleteInvoiceTool,
  crmDeleteOrderTool,
  crmDeleteTaskTool,
  crmDeleteTicketTool,
  crmAuthStatusTool,
  crmGetCalendarBootstrapTool,
  crmGetPrivateMessageThreadTool,
  crmGetCompanyTool,
  crmGetContactTool,
  crmGetDealTool,
  crmGetEstimateTool,
  crmGetExpenseTool,
  crmGetInvoiceTool,
  crmGetOrderTool,
  crmGetPropertyTool,
  crmGetTaskTool,
  crmGetTicketTool,
  crmListCompaniesTool,
  crmListContactsTool,
  crmListDealPipelinesTool,
  crmListDealsTool,
  crmListEstimatesTool,
  crmListExpensesTool,
  crmListInvoicesTool,
  crmListOrdersTool,
  crmListTasksTool,
  crmListPrivateMessagesTool,
  crmListPropertiesTool,
  crmListTicketPipelinesTool,
  crmListTicketsTool,
  crmProspectCompaniesTool,
  crmReplyPrivateMessageThreadTool,
  crmRescheduleCalendarAttendanceTool,
  crmScoreRecordTool,
  crmSyncPrivateMessagesTool,
  crmUpdateCompanyTool,
  crmUpdateContactTool,
  crmUpdateDealTool,
  crmUpdateEstimateTool,
  crmUpdateExpenseTool,
  crmUpdateInvoiceTool,
  crmUpdateOrderTool,
  crmUpdateTaskTool,
  crmUpdatePropertyTool,
  crmUpdateTicketStatusTool,
  crmUpdateTicketTool,
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
    expect(crmListPrivateMessagesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmSyncPrivateMessagesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetPrivateMessageThreadTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmReplyPrivateMessageThreadTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmArchivePrivateMessageThreadTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListCompaniesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetCompanyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateCompanyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateCompanyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteCompanyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListContactsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetContactTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateContactTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateContactTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteContactTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListDealsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetDealTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateDealTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateDealTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteDealTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListDealPipelinesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListOrdersTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetOrderTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateOrderTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateOrderTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteOrderTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListTasksTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetTaskTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateTaskTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateTaskTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteTaskTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListEstimatesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetEstimateTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateEstimateTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateEstimateTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteEstimateTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListInvoicesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetInvoiceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateInvoiceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateInvoiceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteInvoiceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListTicketsTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetTicketTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateTicketTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateTicketTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteTicketTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListTicketPipelinesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateTicketStatusTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListExpensesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetExpenseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUploadExpenseAttachmentTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateExpenseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdateExpenseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeleteExpenseTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmListPropertiesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetPropertyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreatePropertyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmUpdatePropertyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmDeletePropertyTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmGetCalendarBootstrapTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCheckCalendarAvailabilityTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCreateCalendarAttendanceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmCancelCalendarAttendanceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmRescheduleCalendarAttendanceTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmProspectCompaniesTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    expect(crmScoreRecordTool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
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

  it('returns reauth metadata when list private messages is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListPrivateMessagesTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: { list },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: { status: 'active' },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(list).not.toHaveBeenCalled();
  });

  it('lists private messages when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      message: 'ok',
      ctx_id: 'ctx-private-list',
      data: {
        has_connected_private_inbox: true,
        setup_required: false,
        setup_message: null,
        channels: [
          {
            id: 'channel-1',
            integration_slug: 'gmail',
            display_name: 'My Inbox',
            thread_count: 2,
            unread_count: 1,
          },
        ],
        threads: [
          {
            id: 'thread-1',
            title: 'Quarterly check-in',
            counterparty: 'Sarah Chen',
            preview: 'Checking in',
            channel_id: 'channel-1',
            channel_label: 'My Inbox',
            has_unread: true,
            message_type: 'email',
            message_count: 2,
          },
        ],
      },
    });

    const result = await crmListPrivateMessagesTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { status: 'active', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        status: 'active',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      message: 'ok',
      ctx_id: 'ctx-private-list',
      has_connected_private_inbox: true,
      setup_required: false,
      setup_message: undefined,
      channels: [
        {
          id: 'channel-1',
          integration_slug: 'gmail',
          display_name: 'My Inbox',
          thread_count: 2,
          unread_count: 1,
        },
      ],
      threads: [
        {
          id: 'thread-1',
          title: 'Quarterly check-in',
          counterparty: 'Sarah Chen',
          preview: 'Checking in',
          channel_id: 'channel-1',
          channel_label: 'My Inbox',
          has_unread: true,
          message_type: 'email',
          message_count: 2,
        },
      ],
    });
  });

  it('lists private messages with a setup message when no private inbox is connected', async () => {
    const list = jest.fn().mockResolvedValue({
      message: 'ok',
      ctx_id: 'ctx-private-list-empty',
      data: {
        has_connected_private_inbox: false,
        setup_required: true,
        setup_message:
          'No private inbox channel is connected in Sanka yet. Connect a private email channel, then retry.',
        channels: [],
        threads: [],
      },
    });

    const result = await crmListPrivateMessagesTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { status: 'active', language: 'en' },
    });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'No private inbox channel is connected in Sanka yet. Connect a private email channel, then retry.',
      },
    ]);
    expect(result.structuredContent).toEqual({
      message: 'ok',
      ctx_id: 'ctx-private-list-empty',
      has_connected_private_inbox: false,
      setup_required: true,
      setup_message:
        'No private inbox channel is connected in Sanka yet. Connect a private email channel, then retry.',
      channels: [],
      threads: [],
    });
  });

  it('syncs private messages when authentication is present', async () => {
    const sync = jest.fn().mockResolvedValue({
      message: 'ok',
      data: {
        has_connected_private_inbox: false,
        setup_required: true,
        setup_message:
          'No private inbox channel is connected in Sanka yet. Connect a private email channel, then retry.',
        channels: [],
        threads: [],
      },
    });

    const result = await crmSyncPrivateMessagesTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: { sync },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { channel_id: 'channel-1', status: 'active', language: 'ja' },
    });

    expect(sync).toHaveBeenCalledWith(
      {
        channel_id: 'channel-1',
        status: 'active',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'No private inbox channel is connected in Sanka yet. Connect a private email channel, then retry.',
      },
    ]);
  });

  it('gets one private message thread when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      message: 'ok',
      data: {
        id: 'thread-1',
        title: 'Quarterly check-in',
        counterparty: 'Sarah Chen',
        preview: 'Checking in',
        channel_id: 'channel-1',
        channel_label: 'My Inbox',
        has_unread: false,
        message_type: 'email',
        message_count: 2,
        open_in_web_url: 'https://mail.google.com',
        can_reply: true,
        reply_target: 'sarah@example.com',
        messages: [
          {
            id: 'message-1',
            body: 'Hello',
            direction: 'received',
            sender_label: 'Sarah Chen',
          },
        ],
      },
    });

    const result = await crmGetPrivateMessageThreadTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: {
              threads: { retrieve },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { thread_id: 'thread-1', language: 'en' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'thread-1',
      {
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      message: 'ok',
      ctx_id: undefined,
      id: 'thread-1',
      title: 'Quarterly check-in',
      counterparty: 'Sarah Chen',
      preview: 'Checking in',
      channel_id: 'channel-1',
      channel_label: 'My Inbox',
      has_unread: false,
      message_type: 'email',
      message_count: 2,
      open_in_web_url: 'https://mail.google.com',
      can_reply: true,
      reply_target: 'sarah@example.com',
      messages: [
        {
          id: 'message-1',
          body: 'Hello',
          direction: 'received',
          sender_label: 'Sarah Chen',
        },
      ],
    });
  });

  it('replies to a private message thread', async () => {
    const reply = jest.fn().mockResolvedValue({
      message: 'ok',
      ctx_id: 'ctx-private-reply',
      data: {
        thread_id: 'thread-1',
        message_id: 'message-2',
        has_unread: false,
      },
    });

    const result = await crmReplyPrivateMessageThreadTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: {
              threads: { reply },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { thread_id: 'thread-1', body: 'Thanks for the update.', language: 'en' },
    });

    expect(reply).toHaveBeenCalledWith(
      'thread-1',
      {
        body: 'Thanks for the update.',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      message: 'ok',
      ctx_id: 'ctx-private-reply',
      thread_id: 'thread-1',
      message_id: 'message-2',
      has_unread: false,
    });
  });

  it('archives a private message thread', async () => {
    const archive = jest.fn().mockResolvedValue({
      message: 'ok',
      data: {
        channels: [],
        threads: [],
      },
    });

    const result = await crmArchivePrivateMessageThreadTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: {
              threads: { archive },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { thread_id: 'thread-1', language: 'en' },
    });

    expect(archive).toHaveBeenCalledWith(
      'thread-1',
      {
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.isError).toBeUndefined();
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

  it('gets one company when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'company-1',
      company_id: 101,
      name: 'Acme',
      email: 'team@acme.com',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetCompanyTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { company_id: 'company-1', external_id: 'COMP-1' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'company-1',
      {
        external_id: 'COMP-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'company-1',
      company_id: 101,
      name: 'Acme',
      email: 'team@acme.com',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
  });

  it('creates a company', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      company_id: 'company-1',
      external_id: 'COMP-1',
    });

    const result = await crmCreateCompanyTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        external_id: 'COMP-1',
        name: 'Acme',
        email: 'team@acme.com',
        allowed_in_store: false,
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        external_id: 'COMP-1',
        name: 'Acme',
        email: 'team@acme.com',
        allowed_in_store: false,
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      company_id: 'company-1',
      external_id: 'COMP-1',
    });
  });

  it('updates a company', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      company_id: 'company-1',
    });

    const result = await crmUpdateCompanyTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'company-1',
        phone_number: '+1-555-0100',
        url: 'https://acme.com',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'company-1',
      {
        phone_number: '+1-555-0100',
        url: 'https://acme.com',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      company_id: 'company-1',
    });
  });

  it('deletes a company', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      company_id: 'company-1',
    });

    const result = await crmDeleteCompanyTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'company-1',
        external_id: 'COMP-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'company-1',
      {
        external_id: 'COMP-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      company_id: 'company-1',
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

  it('gets one contact when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'contact-1',
      contact_id: 200,
      name: 'Jane Doe',
      email: 'jane@acme.com',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetContactTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { contact_id: 'contact-1', external_id: 'CONT-1' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'contact-1',
      {
        external_id: 'CONT-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'contact-1',
      contact_id: 200,
      name: 'Jane Doe',
      email: 'jane@acme.com',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
  });

  it('creates a contact', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      contact_id: 'contact-1',
      external_id: 'CONT-1',
    });

    const result = await crmCreateContactTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        external_id: 'CONT-1',
        name: 'Jane',
        last_name: 'Doe',
        allowed_in_store: true,
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        external_id: 'CONT-1',
        name: 'Jane',
        last_name: 'Doe',
        allowed_in_store: true,
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      contact_id: 'contact-1',
      external_id: 'CONT-1',
    });
  });

  it('updates a contact', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      contact_id: 'contact-1',
    });

    const result = await crmUpdateContactTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        contact_id: 'contact-1',
        email: 'jane@acme.com',
        company: 'Acme',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'contact-1',
      {
        email: 'jane@acme.com',
        company: 'Acme',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      contact_id: 'contact-1',
    });
  });

  it('deletes a contact', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      contact_id: 'contact-1',
    });

    const result = await crmDeleteContactTool.handler({
      reqContext: {
        client: {
          public: {
            contacts: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        contact_id: 'contact-1',
        external_id: 'CONT-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'contact-1',
      {
        external_id: 'CONT-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      contact_id: 'contact-1',
    });
  });

  it('returns reauth metadata when list deals is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListDealsTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { list },
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

  it('lists deals with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'deal-1',
        deal_id: 101,
        name: 'Acme renewal',
        stage_label: 'Negotiation',
        pipeline_name: 'Sales',
      },
      {
        id: 'deal-2',
        deal_id: 102,
        name: 'Globex POC',
        stage_label: 'Discovery',
        pipeline_name: 'Sales',
      },
      {
        id: 'deal-3',
        deal_id: 103,
        name: 'Initech upsell',
        stage_label: 'Proposal',
        pipeline_name: 'Sales',
      },
    ]);

    const result = await crmListDealsTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { list },
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
      message: 'Returned 2 of 3 deals.',
      permission: undefined,
      results: [
        {
          id: 'deal-1',
          deal_id: 101,
          name: 'Acme renewal',
          stage_label: 'Negotiation',
          pipeline_name: 'Sales',
        },
        {
          id: 'deal-2',
          deal_id: 102,
          name: 'Globex POC',
          stage_label: 'Discovery',
          pipeline_name: 'Sales',
        },
      ],
    });
  });

  it('gets one deal when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'deal-1',
      deal_id: 101,
      name: 'Acme renewal',
      stage_label: 'Negotiation',
      pipeline_name: 'Sales',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetDealTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { case_id: 'deal-1', external_id: 'EXT-1', language: 'en' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'deal-1',
      {
        external_id: 'EXT-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      id: 'deal-1',
      deal_id: 101,
      name: 'Acme renewal',
      stage_label: 'Negotiation',
      pipeline_name: 'Sales',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
  });

  it('creates a deal', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      case_id: 'deal-1',
      external_id: 'DEAL-1',
    });

    const result = await crmCreateDealTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        external_id: 'DEAL-1',
        name: 'Acme renewal',
        case_status: 'opportunities',
        company_id: 'company-1',
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        externalId: 'DEAL-1',
        name: 'Acme renewal',
        caseStatus: 'opportunities',
        companyId: 'company-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      case_id: 'deal-1',
      external_id: 'DEAL-1',
    });
  });

  it('updates a deal with separate lookup and body external ids', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      case_id: 'deal-1',
      external_id: 'DEAL-2',
    });

    const result = await crmUpdateDealTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        case_id: 'deal-1',
        lookup_external_id: 'DEAL-1',
        external_id: 'DEAL-2',
        contact_external_id: 'CONT-1',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'deal-1',
      {
        external_id: 'DEAL-1',
        externalId: 'DEAL-2',
        contactExternalId: 'CONT-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      case_id: 'deal-1',
      external_id: 'DEAL-2',
    });
  });

  it('deletes a deal', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      case_id: 'deal-1',
    });

    const result = await crmDeleteDealTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        case_id: 'deal-1',
        external_id: 'DEAL-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'deal-1',
      {
        external_id: 'DEAL-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      case_id: 'deal-1',
    });
  });

  it('lists deal pipelines when authentication is present', async () => {
    const listPipelines = jest.fn().mockResolvedValue([
      {
        id: 'pipeline-1',
        name: 'Sales',
        internal_name: 'sales',
        is_default: true,
        order: 1,
        stages: [
          { id: 'stage-1', name: 'Discovery', internal_value: 'discovery', order: 1 },
          { id: 'stage-2', name: 'Negotiation', internal_value: 'negotiation', order: 2 },
        ],
      },
    ]);

    const result = await crmListDealPipelinesTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { listPipelines },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { workspace_id: 'workspace-1' },
    });

    expect(listPipelines).toHaveBeenCalledWith({ workspace_id: 'workspace-1' }, undefined);
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'Returned 1 deal pipelines.',
      permission: undefined,
      results: [
        {
          id: 'pipeline-1',
          name: 'Sales',
          internal_name: 'sales',
          is_default: true,
          order: 1,
          stages: [
            { id: 'stage-1', name: 'Discovery', internal_value: 'discovery', order: 1 },
            { id: 'stage-2', name: 'Negotiation', internal_value: 'negotiation', order: 2 },
          ],
        },
      ],
    });
  });

  it('lists orders when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      count: 1,
      data: [{ id: 'order-1', order_id: 501 }],
      message: 'ok',
      page: 2,
      total: 8,
    });

    const result = await crmListOrdersTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 20, page: 2, search: 'Acme', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        limit: 20,
        page: 2,
        search: 'Acme',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 2,
      total: 8,
      message: 'ok',
      permission: undefined,
      results: [{ id: 'order-1', order_id: 501 }],
    });
  });

  it('gets one order when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'order-1',
      order_id: 501,
      order_at: '2026-04-09T09:00:00Z',
      created_at: '2026-04-09T09:00:00Z',
      updated_at: '2026-04-09T10:00:00Z',
    });

    const result = await crmGetOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { order_id: 'order-1', external_id: 'ORD-1' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'order-1',
      {
        external_id: 'ORD-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'order-1',
      order_id: 501,
      order_at: '2026-04-09T09:00:00Z',
      created_at: '2026-04-09T09:00:00Z',
      updated_at: '2026-04-09T10:00:00Z',
    });
  });

  it('creates an order', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      job_id: 'job-1',
      results: [{ external_id: 'ORD-1', status: 'created', order_id: 'order-1' }],
    });

    const result = await crmCreateOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        create_missing_items: true,
        order: {
          external_id: 'ORD-1',
          company_external_id: 'COMP-1',
          order_at: '2026-04-09T09:00:00Z',
          items: [{ item_external_id: 'ITEM-1', quantity: 2, price: 50 }],
        },
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        createMissingItems: true,
        order: {
          externalId: 'ORD-1',
          companyExternalId: 'COMP-1',
          orderAt: '2026-04-09T09:00:00Z',
          items: [{ itemExternalId: 'ITEM-1', quantity: 2, price: 50 }],
        },
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      job_id: 'job-1',
      results: [{ external_id: 'ORD-1', status: 'created', order_id: 'order-1' }],
    });
  });

  it('updates an order', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      results: [{ external_id: 'ORD-1', status: 'updated', order_id: 'order-1' }],
    });

    const result = await crmUpdateOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
        trigger_workflows: false,
        order: {
          external_id: 'ORD-1',
          delivery_status: 'shipped',
          items: [{ item_id: 'item-1', quantity: 1, tax_rate: 0.1 }],
        },
      },
    });

    expect(update).toHaveBeenCalledWith(
      'order-1',
      {
        triggerWorkflows: false,
        order: {
          externalId: 'ORD-1',
          deliveryStatus: 'shipped',
          items: [{ item_id: 'item-1', quantity: 1, tax_rate: 0.1 }],
        },
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      results: [{ external_id: 'ORD-1', status: 'updated', order_id: 'order-1' }],
    });
  });

  it('deletes an order', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      order_id: 'order-1',
    });

    const result = await crmDeleteOrderTool.handler({
      reqContext: {
        client: {
          public: {
            orders: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        order_id: 'order-1',
        external_id: 'ORD-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'order-1',
      {
        external_id: 'ORD-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      order_id: 'order-1',
    });
  });

  it('lists tasks when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      data: [{ id: 'task-1', task_id: 701, title: 'Follow up with Acme' }],
      page: 2,
      count: 1,
      total: 4,
      has_next: true,
      message: 'ok',
    });

    const result = await crmListTasksTool.handler({
      reqContext: {
        client: {
          public: {
            tasks: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        search: 'Acme',
        usage_status: 'active',
        project_id: 'project-1',
        page: 2,
        limit: 20,
        workspace_id: 'workspace-1',
        language: 'en',
      },
    });

    expect(list).toHaveBeenCalledWith(
      {
        search: 'Acme',
        usage_status: 'active',
        project_id: 'project-1',
        page: 2,
        limit: 20,
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 2,
      total: 4,
      message: 'ok',
      permission: undefined,
      results: [{ id: 'task-1', task_id: 701, title: 'Follow up with Acme' }],
    });
  });

  it('gets one task when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'task-1',
      task_id: 701,
      title: 'Follow up with Acme',
      description: 'Send the latest customer update',
      status: 'open',
      created_at: '2026-04-09T09:00:00Z',
      updated_at: '2026-04-09T10:00:00Z',
    });

    const result = await crmGetTaskTool.handler({
      reqContext: {
        client: {
          public: {
            tasks: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        task_id: 'task-1',
        external_id: 'TASK-1',
        workspace_id: 'workspace-1',
        language: 'en',
      },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'task-1',
      {
        external_id: 'TASK-1',
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'task-1',
      task_id: 701,
      title: 'Follow up with Acme',
      description: 'Send the latest customer update',
      status: 'open',
      created_at: '2026-04-09T09:00:00Z',
      updated_at: '2026-04-09T10:00:00Z',
    });
  });

  it('creates a task', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      task_id: 'task-1',
      external_id: 'TASK-1',
    });

    const result = await crmCreateTaskTool.handler({
      reqContext: {
        client: {
          public: {
            tasks: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        external_id: 'TASK-1',
        title: 'Follow up with Acme',
        description: 'Send the latest customer update',
        assignees: ['user-1'],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        external_id: 'TASK-1',
        title: 'Follow up with Acme',
        description: 'Send the latest customer update',
        assignees: ['user-1'],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      task_id: 'task-1',
      external_id: 'TASK-1',
    });
  });

  it('updates a task with separate lookup and body external ids', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      task_id: 'task-1',
      external_id: 'TASK-2',
    });

    const result = await crmUpdateTaskTool.handler({
      reqContext: {
        client: {
          public: {
            tasks: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        task_id: 'task-1',
        lookup_external_id: 'TASK-1',
        external_id: 'TASK-2',
        description: 'Append the latest customer note',
        projects: ['project-1'],
      },
    });

    expect(update).toHaveBeenCalledWith(
      'task-1',
      {
        external_id: 'TASK-1',
        body_external_id: 'TASK-2',
        description: 'Append the latest customer note',
        projects: ['project-1'],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      task_id: 'task-1',
      external_id: 'TASK-2',
    });
  });

  it('deletes a task', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      task_id: 'task-1',
    });

    const result = await crmDeleteTaskTool.handler({
      reqContext: {
        client: {
          public: {
            tasks: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        task_id: 'task-1',
        external_id: 'TASK-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'task-1',
      {
        external_id: 'TASK-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      task_id: 'task-1',
    });
  });

  it('lists estimates with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      { id_est: 1, company_name: 'Acme', total_price: 100 },
      { id_est: 2, company_name: 'Globex', total_price: 200 },
      { id_est: 3, company_name: 'Initech', total_price: 300 },
    ]);

    const result = await crmListEstimatesTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, workspace_id: 'workspace-1', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 estimates.',
      permission: undefined,
      results: [
        { id_est: 1, company_name: 'Acme', total_price: 100 },
        { id_est: 2, company_name: 'Globex', total_price: 200 },
      ],
    });
  });

  it('gets one estimate when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id_est: 1,
      company_name: 'Acme',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetEstimateTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { estimate_id: 'estimate-1', external_id: 'EST-1', language: 'ja' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'estimate-1',
      {
        external_id: 'EST-1',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id_est: 1,
      company_name: 'Acme',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
  });

  it('creates an estimate', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      estimate_id: 'estimate-1',
      external_id: 'EST-1',
    });

    const result = await crmCreateEstimateTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'company-1',
        total_price: 100,
        currency: 'USD',
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        company_id: 'company-1',
        total_price: 100,
        currency: 'USD',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      estimate_id: 'estimate-1',
      external_id: 'EST-1',
    });
  });

  it('updates an estimate', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      estimate_id: 'estimate-1',
    });

    const result = await crmUpdateEstimateTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        estimate_id: 'estimate-1',
        status: 'sent',
        notes: 'Updated notes',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'estimate-1',
      {
        status: 'sent',
        notes: 'Updated notes',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      estimate_id: 'estimate-1',
    });
  });

  it('deletes an estimate', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      estimate_id: 'estimate-1',
    });

    const result = await crmDeleteEstimateTool.handler({
      reqContext: {
        client: {
          public: {
            estimates: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        estimate_id: 'estimate-1',
        external_id: 'EST-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'estimate-1',
      {
        external_id: 'EST-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      estimate_id: 'estimate-1',
    });
  });

  it('lists invoices with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      { id_inv: 1, company_name: 'Acme', total_price: 100 },
      { id_inv: 2, company_name: 'Globex', total_price: 200 },
      { id_inv: 3, company_name: 'Initech', total_price: 300 },
    ]);

    const result = await crmListInvoicesTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, workspace_id: 'workspace-1', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 invoices.',
      permission: undefined,
      results: [
        { id_inv: 1, company_name: 'Acme', total_price: 100 },
        { id_inv: 2, company_name: 'Globex', total_price: 200 },
      ],
    });
  });

  it('gets one invoice when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id_inv: 1,
      company_name: 'Acme',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetInvoiceTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { invoice_id: 'invoice-1', external_id: 'INV-1', language: 'ja' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'invoice-1',
      {
        external_id: 'INV-1',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id_inv: 1,
      company_name: 'Acme',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
  });

  it('creates an invoice', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      invoice_id: 'invoice-1',
      external_id: 'INV-1',
    });

    const result = await crmCreateInvoiceTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        company_id: 'company-1',
        total_price: 120,
        currency: 'USD',
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        company_id: 'company-1',
        total_price: 120,
        currency: 'USD',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      invoice_id: 'invoice-1',
      external_id: 'INV-1',
    });
  });

  it('updates an invoice', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      invoice_id: 'invoice-1',
    });

    const result = await crmUpdateInvoiceTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        status: 'paid',
        notes: 'Updated invoice notes',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'invoice-1',
      {
        status: 'paid',
        notes: 'Updated invoice notes',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      invoice_id: 'invoice-1',
    });
  });

  it('deletes an invoice', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      invoice_id: 'invoice-1',
    });

    const result = await crmDeleteInvoiceTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        external_id: 'INV-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'invoice-1',
      {
        external_id: 'INV-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      invoice_id: 'invoice-1',
    });
  });

  it('returns reauth metadata when list tickets is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListTicketsTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { list },
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

  it('lists tickets with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'ticket-1',
        ticket_id: 401,
        title: 'Broken integration',
        stage_key: 'triage',
        status: 'active',
      },
      {
        id: 'ticket-2',
        ticket_id: 402,
        title: 'Upgrade billing plan',
        stage_key: 'investigating',
        status: 'active',
      },
      {
        id: 'ticket-3',
        ticket_id: 403,
        title: 'Webhook failure',
        stage_key: 'resolved',
        status: 'archived',
      },
    ]);

    const result = await crmListTicketsTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, workspace_id: 'workspace-1' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 tickets.',
      permission: undefined,
      results: [
        {
          id: 'ticket-1',
          ticket_id: 401,
          title: 'Broken integration',
          stage_key: 'triage',
          status: 'active',
        },
        {
          id: 'ticket-2',
          ticket_id: 402,
          title: 'Upgrade billing plan',
          stage_key: 'investigating',
          status: 'active',
        },
      ],
    });
  });

  it('gets one ticket when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'ticket-1',
      ticket_id: 401,
      title: 'Broken integration',
      stage_key: 'triage',
      status: 'active',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });

    const result = await crmGetTicketTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { ticket_id: 'ticket-1', external_id: 'TICK-1', workspace_id: 'workspace-1' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'ticket-1',
      {
        external_id: 'TICK-1',
        workspace_id: 'workspace-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'ticket-1',
      ticket_id: 401,
      title: 'Broken integration',
      stage_key: 'triage',
      status: 'active',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
  });

  it('creates a ticket', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      ticket_id: 'ticket-1',
      external_id: 'TICK-1',
    });

    const result = await crmCreateTicketTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        external_id: 'TICK-1',
        title: 'Broken integration',
        priority: 'high',
        deal_ids: ['deal-1'],
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        body_external_id: 'TICK-1',
        title: 'Broken integration',
        priority: 'high',
        deal_ids: ['deal-1'],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      ticket_id: 'ticket-1',
      external_id: 'TICK-1',
    });
  });

  it('updates a ticket with separate lookup and body external ids', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      ticket_id: 'ticket-1',
      external_id: 'TICK-2',
    });

    const result = await crmUpdateTicketTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        ticket_id: 'ticket-1',
        lookup_external_id: 'TICK-1',
        external_id: 'TICK-2',
        status: 'archived',
      },
    });

    expect(update).toHaveBeenCalledWith(
      'ticket-1',
      {
        external_id: 'TICK-1',
        body_external_id: 'TICK-2',
        status: 'archived',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      ticket_id: 'ticket-1',
      external_id: 'TICK-2',
    });
  });

  it('deletes a ticket', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      ticket_id: 'ticket-1',
    });

    const result = await crmDeleteTicketTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        ticket_id: 'ticket-1',
        external_id: 'TICK-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'ticket-1',
      {
        external_id: 'TICK-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      ticket_id: 'ticket-1',
    });
  });

  it('lists ticket pipelines when authentication is present', async () => {
    const listPipelines = jest.fn().mockResolvedValue([
      {
        id: 'pipeline-1',
        name: 'Support',
        internal_name: 'support',
        is_default: true,
        order: 1,
        stages: [
          { id: 'stage-1', name: 'Triage', internal_value: 'triage', order: 1 },
          { id: 'stage-2', name: 'Resolved', internal_value: 'resolved', order: 2 },
        ],
      },
    ]);

    const result = await crmListTicketPipelinesTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { listPipelines },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { workspace_id: 'workspace-1' },
    });

    expect(listPipelines).toHaveBeenCalledWith({ workspace_id: 'workspace-1' }, undefined);
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'Returned 1 ticket pipelines.',
      permission: undefined,
      results: [
        {
          id: 'pipeline-1',
          name: 'Support',
          internal_name: 'support',
          is_default: true,
          order: 1,
          stages: [
            { id: 'stage-1', name: 'Triage', internal_value: 'triage', order: 1 },
            { id: 'stage-2', name: 'Resolved', internal_value: 'resolved', order: 2 },
          ],
        },
      ],
    });
  });

  it('updates only the ticket status or stage', async () => {
    const updateStatus = jest.fn().mockResolvedValue({
      ok: true,
      status: 'archived',
      ticket_id: 'ticket-1',
      external_id: 'TICK-1',
    });

    const result = await crmUpdateTicketStatusTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { updateStatus },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        ticket_id: 'ticket-1',
        lookup_external_id: 'TICK-1',
        stage_key: 'resolved',
        status: 'archived',
        language: 'ja',
      },
    });

    expect(updateStatus).toHaveBeenCalledWith(
      'ticket-1',
      {
        external_id: 'TICK-1',
        stage_key: 'resolved',
        status: 'archived',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'archived',
      ticket_id: 'ticket-1',
      external_id: 'TICK-1',
    });
  });

  it('lists expenses with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'expense-1',
        description: 'Google Workspace',
        company_name: 'Google',
        amount: 20,
        currency: 'USD',
      },
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
        {
          id: 'expense-1',
          description: 'Google Workspace',
          company_name: 'Google',
          amount: 20,
          currency: 'USD',
        },
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

  it('lists properties with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'prop-1',
        name: 'Priority',
        internal_name: 'priority',
        object: 'orders',
        is_custom: true,
        immutable: false,
      },
      {
        id: 'prop-2',
        name: 'Region',
        internal_name: 'region',
        object: 'orders',
        is_custom: true,
        immutable: false,
      },
      {
        id: 'prop-3',
        name: 'Channel',
        internal_name: 'channel',
        object: 'orders',
        is_custom: true,
        immutable: false,
      },
    ]);

    const result = await crmListPropertiesTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'orders',
        custom_only: true,
        limit: 2,
        workspace_id: 'workspace-1',
        language: 'en',
      },
    });

    expect(list).toHaveBeenCalledWith(
      'orders',
      {
        custom_only: true,
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 properties.',
      permission: undefined,
      results: [
        {
          id: 'prop-1',
          name: 'Priority',
          internal_name: 'priority',
          object: 'orders',
          is_custom: true,
          immutable: false,
        },
        {
          id: 'prop-2',
          name: 'Region',
          internal_name: 'region',
          object: 'orders',
          is_custom: true,
          immutable: false,
        },
      ],
    });
  });

  it('gets one property when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'prop-1',
      object: 'orders',
      name: 'Priority',
      internal_name: 'priority',
      is_custom: true,
      immutable: false,
    });

    const result = await crmGetPropertyTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { object_name: 'orders', property_ref: 'prop-1', workspace_id: 'workspace-1', language: 'en' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'prop-1',
      {
        object_name: 'orders',
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      id: 'prop-1',
      object: 'orders',
      name: 'Priority',
      internal_name: 'priority',
      is_custom: true,
      immutable: false,
    });
  });

  it('creates a property', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      object: 'orders',
      property_id: 'prop-1',
      ctx_id: 'ctx-1',
    });

    const result = await crmCreatePropertyTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'orders',
        name: 'Priority',
        internal_name: 'priority',
        type: 'text',
        tag_values: [],
      },
    });

    expect(create).toHaveBeenCalledWith(
      'orders',
      {
        name: 'Priority',
        internal_name: 'priority',
        type: 'text',
        tag_values: [],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      object: 'orders',
      property_id: 'prop-1',
      ctx_id: 'ctx-1',
    });
  });

  it('updates a property', async () => {
    const update = jest.fn().mockResolvedValue({
      ok: true,
      status: 'updated',
      object: 'orders',
      property_id: 'prop-1',
      ctx_id: 'ctx-2',
    });

    const result = await crmUpdatePropertyTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { update },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'orders',
        property_ref: 'prop-1',
        required_field: true,
        choice_values: ['high', 'low'],
      },
    });

    expect(update).toHaveBeenCalledWith(
      'prop-1',
      {
        object_name: 'orders',
        required_field: true,
        choice_values: ['high', 'low'],
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'updated',
      object: 'orders',
      property_id: 'prop-1',
      ctx_id: 'ctx-2',
    });
  });

  it('deletes a property', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      object: 'orders',
      property_id: 'prop-1',
      ctx_id: 'ctx-3',
    });

    const result = await crmDeletePropertyTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'orders',
        property_ref: 'prop-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'prop-1',
      {
        object_name: 'orders',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      object: 'orders',
      property_id: 'prop-1',
      ctx_id: 'ctx-3',
    });
  });

  it('returns reauth metadata when calendar bootstrap is called without authentication', async () => {
    const bootstrap = jest.fn();

    const result = await crmGetCalendarBootstrapTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: { bootstrap },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: { slug: 'demo-event' },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it('loads calendar bootstrap context', async () => {
    const bootstrap = jest.fn().mockResolvedValue({
      message: 'ok',
      mode: 'book',
      status: 'ready',
      event: {
        id: 'event-1',
        title: 'Intro Call',
      },
      workspace: {
        id: 'workspace-1',
        name: 'Acme',
      },
    });

    const result = await crmGetCalendarBootstrapTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: { bootstrap },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        slug: 'intro-call',
        mode: 'book',
      },
    });

    expect(bootstrap).toHaveBeenCalledWith(
      {
        mode: 'book',
        slug: 'intro-call',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      message: 'ok',
      mode: 'book',
      status: 'ready',
      event: {
        id: 'event-1',
        title: 'Intro Call',
      },
      workspace: {
        id: 'workspace-1',
        name: 'Acme',
      },
    });
  });

  it('checks calendar availability', async () => {
    const checkAvailability = jest.fn().mockResolvedValue({
      message: 'ok',
      timezone: 'Asia/Tokyo',
      days: [
        {
          date: '2026-04-10',
          day_index: 5,
          weekday: 'Friday',
          slots: ['09:00', '10:00'],
        },
      ],
    });

    const result = await crmCheckCalendarAvailabilityTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: { checkAvailability },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        event_id: 'event-1',
        start_date: '2026-04-10',
        days: 3,
        timezone: 'Asia/Tokyo',
      },
    });

    expect(checkAvailability).toHaveBeenCalledWith(
      {
        event_id: 'event-1',
        start_date: '2026-04-10',
        days: 3,
        timezone: 'Asia/Tokyo',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      message: 'ok',
      timezone: 'Asia/Tokyo',
      days: [
        {
          date: '2026-04-10',
          day_index: 5,
          weekday: 'Friday',
          slots: ['09:00', '10:00'],
        },
      ],
    });
  });

  it('creates calendar attendance', async () => {
    const create = jest.fn().mockResolvedValue({
      ok: true,
      status: 'created',
      message: 'Booked successfully.',
      attendance: {
        id: 'attendance-1',
      },
      meet_link: 'https://meet.example.com/abc',
    });

    const result = await crmCreateCalendarAttendanceTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: {
              attendance: { create },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        event_id: 'event-1',
        date: '2026-04-10',
        time: '09:00',
        name: 'Jane Doe',
        email: 'jane@example.com',
        timezone: 'Asia/Tokyo',
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        event_id: 'event-1',
        date: '2026-04-10',
        time: '09:00',
        name: 'Jane Doe',
        email: 'jane@example.com',
        timezone: 'Asia/Tokyo',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'created',
      message: 'Booked successfully.',
      attendance: {
        id: 'attendance-1',
      },
      meet_link: 'https://meet.example.com/abc',
    });
  });

  it('cancels calendar attendance', async () => {
    const cancel = jest.fn().mockResolvedValue({
      ok: true,
      status: 'cancelled',
      message: 'Attendance cancelled.',
      attendance: {
        id: 'attendance-1',
      },
    });

    const result = await crmCancelCalendarAttendanceTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: {
              attendance: { cancel },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        attendance_id: 'attendance-1',
      },
    });

    expect(cancel).toHaveBeenCalledWith('attendance-1', undefined);
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'cancelled',
      message: 'Attendance cancelled.',
      attendance: {
        id: 'attendance-1',
      },
    });
  });

  it('reschedules calendar attendance', async () => {
    const reschedule = jest.fn().mockResolvedValue({
      ok: true,
      status: 'rescheduled',
      message: 'Attendance rescheduled.',
      attendance: {
        id: 'attendance-1',
        select_date: '2026-04-11',
        time_event: '11:00',
      },
    });

    const result = await crmRescheduleCalendarAttendanceTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: {
              attendance: { reschedule },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        attendance_id: 'attendance-1',
        date: '2026-04-11',
        time: '11:00',
        comment: 'Need a later slot',
      },
    });

    expect(reschedule).toHaveBeenCalledWith(
      'attendance-1',
      {
        date: '2026-04-11',
        time: '11:00',
        comment: 'Need a later slot',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'rescheduled',
      message: 'Attendance rescheduled.',
      attendance: {
        id: 'attendance-1',
        select_date: '2026-04-11',
        time_event: '11:00',
      },
    });
  });

  it('prospects companies when authentication is present', async () => {
    const create = jest.fn().mockResolvedValue({
      data: {
        count: 1,
        query: 'manufacturing companies in Tokyo',
        parsed_filters: {
          location: 'Tokyo',
          industry: 'Manufacturing',
        },
        results: [
          {
            name: 'Acme Manufacturing',
            domain: 'acme.example',
            industry: 'Manufacturing',
            relevance_score: 0.92,
          },
        ],
      },
      message: 'Prospecting completed.',
    });

    const result = await crmProspectCompaniesTool.handler({
      reqContext: {
        client: {
          prospect: {
            companies: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        query: 'manufacturing companies in Tokyo',
        location: 'Tokyo',
        industry: 'Manufacturing',
        limit: 5,
      },
    });

    expect(create).toHaveBeenCalledWith({
      query: 'manufacturing companies in Tokyo',
      location: 'Tokyo',
      industry: 'Manufacturing',
      limit: 5,
    });
    expect(result.structuredContent).toEqual({
      query: 'manufacturing companies in Tokyo',
      parsed_filters: {
        location: 'Tokyo',
        industry: 'Manufacturing',
      },
      count: 1,
      results: [
        {
          name: 'Acme Manufacturing',
          domain: 'acme.example',
          industry: 'Manufacturing',
          relevance_score: 0.92,
        },
      ],
      message: 'Prospecting completed.',
    });
  });

  it('scores a record when authentication is present', async () => {
    const create = jest.fn().mockResolvedValue({
      data: {
        object_type: 'company',
        record_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        snapshot_id: 'snap-1',
        algorithm_key: 'transparent_company_fit',
        algorithm_version: '2026-04-01',
        score_model_id: 'model-1',
        score_model_name: 'Default Fit',
        score_model_version: 3,
        input_hash: 'input-1',
        output_hash: 'output-1',
        score: 82,
        band: 'high',
        dimensions: [{ key: 'firmographics', score: 40 }],
        reasons: [{ label: 'ICP match', weight: 20 }],
        explanation: 'Strong ICP fit.',
      },
      message: 'Scoring completed.',
      ctx_id: 'ctx-score-1',
    });

    const result = await crmScoreRecordTool.handler({
      reqContext: {
        client: {
          score: { create },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'company',
        record_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        score_model_id: 'model-1',
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        object_type: 'company',
        record_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        score_model_id: 'model-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      data: {
        object_type: 'company',
        record_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
        snapshot_id: 'snap-1',
        algorithm_key: 'transparent_company_fit',
        algorithm_version: '2026-04-01',
        score_model_id: 'model-1',
        score_model_name: 'Default Fit',
        score_model_version: 3,
        input_hash: 'input-1',
        output_hash: 'output-1',
        score: 82,
        band: 'high',
        dimensions: [{ key: 'firmographics', score: 40 }],
        reasons: [{ label: 'ICP match', weight: 20 }],
        explanation: 'Strong ICP fit.',
      },
      message: 'Scoring completed.',
      ctx_id: 'ctx-score-1',
    });
  });
});
