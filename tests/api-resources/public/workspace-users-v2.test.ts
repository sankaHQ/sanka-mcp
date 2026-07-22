import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public workspace user invitation resource', () => {
  test('uses the canonical V2 invitation routes and request shapes', async () => {
    const calls: Array<{ body?: unknown; method: string; url: string }> = [];
    const invitation = {
      id: 638,
      email: 'dev@sanka.com',
      role: 'partner',
      status: 'pending',
      date_sent: '2026-07-23T01:00:00Z',
      permission_set_id: null,
      permission_set_name: null,
    };
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const method = String(init?.method ?? 'GET').toUpperCase();
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ method, url: String(url), body });
        if (method === 'POST') {
          return envelope({
            invitation_id: '638',
            email: 'dev@sanka.com',
            role: 'partner',
            status: 'invited',
            invited_count: 1,
            invited: ['dev@sanka.com'],
            skipped_existing: 0,
            skipped_invited: 0,
            skipped_protected: 0,
            permission_set_id: null,
            email_delivery: 'sent',
          });
        }
        if (method === 'DELETE') {
          return envelope({ message: 'OK' });
        }
        return envelope({
          invitations: [invitation],
          total: 1,
          page: 2,
          page_size: 25,
          has_next_page: false,
          can_edit: true,
          message: 'OK',
        });
      },
    });

    await expect(
      client.public.workspaceUsers.invitations.create({
        email: 'dev@sanka.com',
        role: 'partner',
        permission_set_id: 'permission-set-1',
        simplified_invite: true,
        language: 'ja',
      }),
    ).resolves.toMatchObject({ invitation_id: '638', email: 'dev@sanka.com', role: 'partner' });
    await expect(
      client.public.workspaceUsers.invitations.list({ q: 'dev', page: 2, page_size: 25 }),
    ).resolves.toMatchObject({ invitations: [invitation], total: 1, page: 2 });
    await expect(client.public.workspaceUsers.invitations.cancel(638)).resolves.toEqual({ message: 'OK' });

    expect(calls).toEqual([
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/workspace-users/invitations',
        body: {
          email: 'dev@sanka.com',
          role: 'partner',
          permission_set_id: 'permission-set-1',
          simplified_invite: true,
          language: 'ja',
        },
      },
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/workspace-users/invitations?q=dev&page=2&page_size=25',
        body: undefined,
      },
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/workspace-users/invitations/638',
        body: undefined,
      },
    ]);
  });
});
