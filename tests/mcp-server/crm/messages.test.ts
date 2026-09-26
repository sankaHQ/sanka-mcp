import {
  crmArchivePrivateMessageThreadTool,
  crmGetPrivateMessageThreadTool,
  crmGetWorkspaceMessageThreadTool,
  crmListPrivateMessagesTool,
  crmListWorkspaceMessagesTool,
  crmReplyPrivateMessageThreadTool,
  crmReplyWorkspaceMessageThreadTool,
  crmSyncPrivateMessagesTool,
  crmSyncWorkspaceMessagesTool,
  crmUpdateWorkspaceMessageDraftTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { describeV2Requests, oauthContext, type V2RequestCase } from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'archives a private message thread',
    tool: crmArchivePrivateMessageThreadTool,
    args: { thread_id: 'thread-1', language: 'en' },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/me/messages/threads/thread-1/archive',
        headers: { 'accept-language': 'en' },
      },
    ],
  },
  {
    name: 'syncs workspace messages when authentication is present',
    tool: crmSyncWorkspaceMessagesTool,
    args: { channel_id: 'channel-support', status: 'active', language: 'ja' },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/workspace/messages/sync',
        body: { channel_id: 'channel-support', status: 'active' },
        headers: { 'accept-language': 'ja' },
      },
    ],
  },
];

describe('CRM private and workspace message tools', () => {
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
        sender_email: 'haegwan@sanka.com',
        integration_slug: 'gmail',
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
      args: {
        thread_id: 'thread-1',
        body: 'Thanks for the update.',
        confirm_send: true,
        expected_sender_email: 'haegwan@sanka.com',
        language: 'en',
      },
    });

    expect(reply).toHaveBeenCalledWith(
      'thread-1',
      {
        body: 'Thanks for the update.',
        expected_sender_email: 'haegwan@sanka.com',
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
      sender_email: 'haegwan@sanka.com',
      integration_slug: 'gmail',
    });
    expect(result.content).toEqual([
      { type: 'text', text: 'Replied to private message thread thread-1 from haegwan@sanka.com.' },
    ]);
  });

  it('does not reply to a private message thread without explicit send confirmation', async () => {
    const reply = jest.fn();

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
      args: { thread_id: 'thread-1', body: 'Draft only' },
    });

    expect(reply).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it('returns structured sender confirmation guidance without retrying', async () => {
    const reply = jest.fn().mockRejectedValue(
      Object.assign(new Error('409 Multiple sender email addresses are connected.'), {
        status: 409,
        error: {
          success: false,
          error: {
            code: 'SENDER_CONFIRMATION_REQUIRED',
            message: 'Multiple sender email addresses are connected. Confirm the sender before sending.',
            details: {
              available_sender_emails: ['haegwan@sanka.com', 'hey@sanka.com'],
              resolved_sender_email: 'haegwan@sanka.com',
            },
          },
          meta: { ctx_id: 'ctx-sender-confirmation' },
        },
      }),
    );

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
      args: {
        thread_id: 'thread-1',
        body: 'Thanks for the update.',
        confirm_send: true,
      },
    });

    expect(reply).toHaveBeenCalledTimes(1);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      ok: false,
      status: 'confirmation_required',
      code: 'SENDER_CONFIRMATION_REQUIRED',
      available_sender_emails: ['haegwan@sanka.com', 'hey@sanka.com'],
      resolved_sender_email: 'haegwan@sanka.com',
      ctx_id: 'ctx-sender-confirmation',
    });
    expect(result.structuredContent?.['required_user_facing_reply']).toContain('Do not retry');
  });

  it('handles an unwrapped V2 sender confirmation error without retrying', async () => {
    const reply = jest.fn().mockRejectedValue(
      Object.assign(new Error('Multiple sender email addresses are connected.'), {
        code: 'SENDER_CONFIRMATION_REQUIRED',
        details: {
          available_sender_emails: ['haegwan@sanka.com', 'hey@sanka.com'],
          resolved_sender_email: 'hey@sanka.com',
        },
        meta: { ctx_id: 'ctx-v2-sender-confirmation' },
      }),
    );

    const result = await crmReplyWorkspaceMessageThreadTool.handler({
      reqContext: {
        client: {
          public: {
            workspaceMessages: {
              threads: { reply },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        thread_id: 'thread-2',
        body: 'Thanks for the update.',
        confirm_send: true,
      },
    });

    expect(reply).toHaveBeenCalledTimes(1);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: 'SENDER_CONFIRMATION_REQUIRED',
      available_sender_emails: ['haegwan@sanka.com', 'hey@sanka.com'],
      resolved_sender_email: 'hey@sanka.com',
      ctx_id: 'ctx-v2-sender-confirmation',
    });
  });

  it.each([
    ['private', 'accountMessages', () => crmReplyPrivateMessageThreadTool],
    ['workspace', 'workspaceMessages', () => crmReplyWorkspaceMessageThreadTool],
  ])('returns an unconfirmed %s reply delivery as a do-not-resend error', async (_scope, resource, tool) => {
    const reply = jest.fn().mockRejectedValue(
      Object.assign(new Error('409 Delivery of this reply could not be confirmed.'), {
        status: 409,
        error: {
          success: false,
          error: {
            code: 'DELIVERY_UNKNOWN',
            message:
              "Delivery of this reply could not be confirmed. Check the sender's Sent folder before sending it again.",
            details: { status: 'delivery_unknown' },
          },
          meta: { ctx_id: 'ctx-delivery-unknown' },
        },
      }),
    );

    const result = await tool().handler({
      reqContext: {
        client: { public: { [resource]: { threads: { reply } } } } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        thread_id: 'thread-1',
        body: 'Thanks for the update.',
        confirm_send: true,
      },
    });

    expect(reply).toHaveBeenCalledTimes(1);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      ok: false,
      status: 'delivery_unknown',
      code: 'DELIVERY_UNKNOWN',
      delivery_status: 'delivery_unknown',
      ctx_id: 'ctx-delivery-unknown',
    });
    expect(result.structuredContent?.['required_user_facing_reply']).toContain('Do not retry');
  });

  it('reports a sent reply that only appears after the next inbox sync', async () => {
    const note = 'Reply sent. It will appear in this thread after the next inbox sync.';
    const reply = jest.fn().mockResolvedValue({
      success: true,
      data: {
        thread_id: 'workspace-thread-1',
        message_id: null,
        has_unread: false,
        sender_email: 'hey@sanka.com',
        integration_slug: 'gmail',
      },
      meta: {
        ctx_id: 'ctx-record-pending',
        toast: { variant: 'success', code: 'message.reply.record_pending', message: note },
      },
    });

    const result = await crmReplyWorkspaceMessageThreadTool.handler({
      reqContext: {
        client: { public: { workspaceMessages: { threads: { reply } } } } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        thread_id: 'workspace-thread-1',
        body: 'Thanks for the update.',
        confirm_send: true,
      },
    });

    expect(result.isError).toBeFalsy();
    // message_id is omitted rather than null, so the output schema still validates.
    expect(result.structuredContent).toEqual({
      message: 'ok',
      ctx_id: 'ctx-record-pending',
      thread_id: 'workspace-thread-1',
      has_unread: false,
      sender_email: 'hey@sanka.com',
      integration_slug: 'gmail',
      note,
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: `Replied to shared workspace message thread workspace-thread-1 from hey@sanka.com. ${note}`,
      },
    ]);
  });

  it('lists workspace messages when authentication is present', async () => {
    const list = jest.fn().mockResolvedValue({
      message: 'ok',
      ctx_id: 'ctx-workspace-list',
      data: {
        channels: [
          {
            id: 'channel-support',
            integration_slug: 'gmail',
            display_name: 'Support Inbox',
            thread_count: 1,
            unread_count: 1,
          },
        ],
        threads: [
          {
            id: 'workspace-thread-1',
            title: 'Support request',
            counterparty: 'Sarah Chen',
            preview: 'Checking in',
            channel_id: 'channel-support',
            channel_label: 'Support Inbox',
            has_unread: true,
            message_type: 'email',
            message_count: 2,
            status: 'todo',
            assignee_username: 'ada',
          },
        ],
      },
    });

    const result = await crmListWorkspaceMessagesTool.handler({
      reqContext: {
        client: {
          public: {
            workspaceMessages: { list },
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
      ctx_id: 'ctx-workspace-list',
      channels: [
        {
          id: 'channel-support',
          integration_slug: 'gmail',
          display_name: 'Support Inbox',
          thread_count: 1,
          unread_count: 1,
        },
      ],
      threads: [
        {
          id: 'workspace-thread-1',
          title: 'Support request',
          counterparty: 'Sarah Chen',
          preview: 'Checking in',
          channel_id: 'channel-support',
          channel_label: 'Support Inbox',
          has_unread: true,
          message_type: 'email',
          message_count: 2,
          status: 'todo',
          assignee_username: 'ada',
        },
      ],
    });
  });

  it('gets one workspace message thread when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      message: 'ok',
      data: {
        id: 'workspace-thread-1',
        title: 'Support request',
        counterparty: 'Sarah Chen',
        preview: 'Checking in',
        channel_id: 'channel-support',
        channel_label: 'Support Inbox',
        has_unread: false,
        message_type: 'email',
        message_count: 2,
        status: 'todo',
        assignee_username: 'ada',
        open_in_web_url: '/conversation/',
        can_reply: true,
        reply_target: 'sarah@example.com',
        messages: [
          {
            id: 'workspace-message-1',
            body: 'Hello',
            direction: 'incoming',
            sender_label: 'Sarah Chen',
          },
        ],
      },
    });

    const result = await crmGetWorkspaceMessageThreadTool.handler({
      reqContext: {
        client: {
          public: {
            workspaceMessages: {
              threads: { retrieve },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { thread_id: 'workspace-thread-1', language: 'en' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'workspace-thread-1',
      {
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      message: 'ok',
      ctx_id: undefined,
      id: 'workspace-thread-1',
      title: 'Support request',
      counterparty: 'Sarah Chen',
      preview: 'Checking in',
      channel_id: 'channel-support',
      channel_label: 'Support Inbox',
      has_unread: false,
      message_type: 'email',
      message_count: 2,
      status: 'todo',
      assignee_username: 'ada',
      open_in_web_url: '/conversation/',
      can_reply: true,
      reply_target: 'sarah@example.com',
      messages: [
        {
          id: 'workspace-message-1',
          body: 'Hello',
          direction: 'incoming',
          sender_label: 'Sarah Chen',
        },
      ],
    });
  });

  it('updates one workspace message draft in place without sending', async () => {
    const updateDraft = jest.fn().mockResolvedValue({
      message: 'ok',
      ctx_id: 'ctx-workspace-draft',
      data: {
        thread_id: 'workspace-thread-1',
        message_id: 'workspace-message-1',
        status: 'draft',
        channel_id: 'channel-support',
        subject: 'August invoice',
        body: 'Updated body',
        recipients: ['okai@example.com'],
        cc: ['uenoyama@example.com', 'utsumi@example.com'],
        bcc: [],
        scheduled_at: null,
      },
    });

    const result = await crmUpdateWorkspaceMessageDraftTool.handler({
      reqContext: {
        client: {
          public: {
            workspaceMessages: { updateDraft },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        message_id: 'workspace-message-1',
        subject: 'August invoice',
        body: 'Updated body',
        to: ['okai@example.com'],
        cc: ['uenoyama@example.com', 'utsumi@example.com'],
        bcc: [],
      },
    });

    expect(updateDraft).toHaveBeenCalledWith(
      'workspace-message-1',
      {
        subject: 'August invoice',
        body: 'Updated body',
        recipients: ['okai@example.com'],
        cc: ['uenoyama@example.com', 'utsumi@example.com'],
        bcc: [],
      },
      undefined,
    );
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      message_id: 'workspace-message-1',
      status: 'draft',
      recipients: ['okai@example.com'],
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Updated workspace message draft workspace-message-1 in place without sending.',
      },
    ]);
  });

  it('rejects workspace draft updates without a complete replacement payload', async () => {
    const updateDraft = jest.fn();
    const result = await crmUpdateWorkspaceMessageDraftTool.handler({
      reqContext: {
        client: { public: { workspaceMessages: { updateDraft } } } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        message_id: 'workspace-message-1',
        body: 'Updated body',
        to: [],
      },
    });

    expect(updateDraft).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it('replies to a workspace message thread from the returned sender identity', async () => {
    const reply = jest.fn().mockResolvedValue({
      message: 'ok',
      ctx_id: 'ctx-workspace-reply',
      data: {
        thread_id: 'workspace-thread-1',
        message_id: 'workspace-message-2',
        has_unread: false,
        sender_email: 'hey@sanka.com',
        integration_slug: 'gmail',
      },
    });

    const result = await crmReplyWorkspaceMessageThreadTool.handler({
      reqContext: {
        client: {
          public: {
            workspaceMessages: {
              threads: { reply },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        thread_id: 'workspace-thread-1',
        body: 'Thanks for the update.',
        confirm_send: true,
        expected_sender_email: 'hey@sanka.com',
        language: 'en',
      },
    });

    expect(reply).toHaveBeenCalledWith(
      'workspace-thread-1',
      {
        body: 'Thanks for the update.',
        expected_sender_email: 'hey@sanka.com',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      message: 'ok',
      ctx_id: 'ctx-workspace-reply',
      thread_id: 'workspace-thread-1',
      message_id: 'workspace-message-2',
      has_unread: false,
      sender_email: 'hey@sanka.com',
      integration_slug: 'gmail',
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Replied to shared workspace message thread workspace-thread-1 from hey@sanka.com.',
      },
    ]);
  });

  it('does not reply to a workspace message thread without explicit send confirmation', async () => {
    const reply = jest.fn();

    const result = await crmReplyWorkspaceMessageThreadTool.handler({
      reqContext: {
        client: {
          public: {
            workspaceMessages: {
              threads: { reply },
            },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { thread_id: 'workspace-thread-1', body: 'Draft only' },
    });

    expect(reply).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  describeV2Requests(v2Requests);
});
