import Sanka from 'sanka-sdk';

const messagesData = {
  channels: [
    {
      id: 'channel-1',
      integration_slug: 'gmail',
      display_name: 'Gmail',
      thread_count: 1,
      unread_count: 1,
    },
  ],
  threads: [
    {
      id: 'thread-1',
      title: 'Hello',
      channel_id: 'channel-1',
      channel_label: 'Gmail',
      counterparty: 'customer@example.com',
      preview: 'Hi',
      has_unread: true,
      message_count: 1,
      message_type: 'email',
    },
  ],
  has_connected_private_inbox: true,
  setup_required: false,
};

const threadData = {
  ...messagesData.threads[0],
  can_reply: true,
  open_in_web_url: '/account/messages/thread-1',
  messages: [
    {
      id: 'message-1',
      body: 'Hi',
      direction: 'inbound',
      sender_label: 'Customer',
    },
  ],
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public account message resources on V2', () => {
  test('uses V2 message paths for account-message methods', async () => {
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
            thread_id: 'thread-1',
            has_unread: false,
            message_id: 'message-2',
            sender_email: 'haegwan@sanka.com',
            integration_slug: 'gmail',
          });
        }
        if (requestURL.includes('/threads/thread-1') && !requestURL.includes('/archive')) {
          return envelope(threadData);
        }
        return envelope(messagesData);
      },
    });

    await expect(client.public.accountMessages.list({ status: 'active' })).resolves.toMatchObject({
      data: messagesData,
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.accountMessages.bulkActions({ action: 'archive', thread_ids: ['thread-1'] }),
    ).resolves.toMatchObject({ data: messagesData });
    await expect(client.public.accountMessages.threads.retrieve('thread-1')).resolves.toMatchObject({
      data: threadData,
    });
    await expect(client.public.accountMessages.threads.archive('thread-1')).resolves.toMatchObject({
      data: messagesData,
    });
    await expect(
      client.public.accountMessages.threads.reply('thread-1', {
        body: 'Thanks',
        expected_sender_email: 'haegwan@sanka.com',
      }),
    ).resolves.toMatchObject({
      data: {
        thread_id: 'thread-1',
        has_unread: false,
        message_id: 'message-2',
        sender_email: 'haegwan@sanka.com',
        integration_slug: 'gmail',
      },
    });
    await expect(client.public.accountMessages.sync()).resolves.toMatchObject({
      data: messagesData,
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'http://localhost:5000/api/v2/me/messages?status=active',
      'http://localhost:5000/api/v2/me/messages/bulk-actions',
      'http://localhost:5000/api/v2/me/messages/threads/thread-1',
      'http://localhost:5000/api/v2/me/messages/threads/thread-1/archive',
      'http://localhost:5000/api/v2/me/messages/threads/thread-1/reply',
      'http://localhost:5000/api/v2/me/messages/sync',
    ]);
  });
});
