import Sanka from '../../../src';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public workspace messages v2 resource', () => {
  const messagesData = {
    channels: [
      {
        id: 'channel-support',
        integration_slug: 'gmail',
        display_name: 'support@example.com',
        thread_count: 1,
        unread_count: 1,
      },
    ],
    threads: [
      {
        id: 'workspace-thread-1',
        title: 'Support request',
        channel_id: 'channel-support',
        channel_label: 'support@example.com',
        counterparty: 'Grace Hopper',
        preview: 'Latest shared inbox message',
        has_unread: true,
        message_count: 2,
        message_type: 'email',
        status: 'todo',
        assignee_username: 'ada',
      },
    ],
  };

  const threadData = {
    ...messagesData.threads[0],
    open_in_web_url: '/conversation/',
    can_reply: true,
    reply_target: 'grace@example.com',
    messages: [
      {
        id: 'workspace-message-1',
        body: 'Hello shared inbox',
        direction: 'incoming',
        sender_label: 'Grace Hopper',
        status: 'sent',
      },
    ],
  };

  test('uses V2 workspace message paths for shared inbox methods', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url) => {
        const requestURL = String(url);
        calls.push(requestURL);
        if (requestURL.includes('/reply')) {
          return envelope({
            thread_id: 'workspace-thread-1',
            has_unread: false,
            message_id: 'workspace-message-2',
            sender_email: 'hey@sanka.com',
            integration_slug: 'gmail',
          });
        }
        if (requestURL.includes('/threads/workspace-thread-1')) {
          return envelope(threadData);
        }
        return envelope(messagesData);
      },
    });

    await expect(client.public.workspaceMessages.list({ status: 'active' })).resolves.toMatchObject({
      data: messagesData,
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.workspaceMessages.threads.retrieve('workspace-thread-1'),
    ).resolves.toMatchObject({
      data: threadData,
    });
    await expect(
      client.public.workspaceMessages.threads.reply('workspace-thread-1', {
        body: 'Thanks for the update.',
      }),
    ).resolves.toMatchObject({
      data: {
        thread_id: 'workspace-thread-1',
        has_unread: false,
        message_id: 'workspace-message-2',
        sender_email: 'hey@sanka.com',
        integration_slug: 'gmail',
      },
    });
    await expect(
      client.public.workspaceMessages.sync({ channel_id: 'channel-support', status: 'active' }),
    ).resolves.toMatchObject({
      data: messagesData,
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'http://localhost:5000/api/v2/workspace/messages?status=active',
      'http://localhost:5000/api/v2/workspace/messages/threads/workspace-thread-1',
      'http://localhost:5000/api/v2/workspace/messages/threads/workspace-thread-1/reply',
      'http://localhost:5000/api/v2/workspace/messages/sync',
    ]);
  });
});
