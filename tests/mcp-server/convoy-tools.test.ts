import {
  calculateConvoyCommissionsTool,
  convoyTools,
  createConvoyInvoiceRequestTool,
  createConvoyPartnerTool,
  inviteConvoyPartnerMemberTool,
  listConvoyPartnersTool,
  reviewConvoyInvoiceRequestTool,
} from '../../packages/mcp-server/src/convoy-tools';

const oauthContext = () => ({
  authMode: 'oauth_bearer' as const,
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: ['mcp:access'],
  },
});

const requestContext = (client: Record<string, jest.Mock>) => ({
  client: client as any,
  auth: oauthContext(),
});

describe('Convoy MCP tools', () => {
  it('registers the complete Convoy partner, billing, and commission surface', () => {
    expect(convoyTools.map((tool) => tool.tool.name)).toEqual([
      'list_convoy_partners',
      'get_convoy_partner',
      'create_convoy_partner',
      'update_convoy_partner',
      'archive_convoy_partner',
      'list_convoy_partner_members',
      'invite_convoy_partner_member',
      'resend_convoy_partner_invite',
      'revoke_convoy_partner_member',
      'list_convoy_invoice_requests',
      'get_convoy_invoice_request',
      'create_convoy_invoice_request',
      'review_convoy_invoice_request',
      'list_convoy_commissions',
      'get_convoy_commission',
      'calculate_convoy_commissions',
      'review_convoy_commission',
    ]);
  });

  it('lists partners with narrow filters and unwraps the V2 response envelope', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: { items: [{ id: 'partner-1', name: 'Hakuhodo' }], total: 1 },
    });

    const result = await listConvoyPartnersTool.handler({
      reqContext: requestContext({ get }),
      args: { q: 'Hakuhodo', status: 'active', page: 2, page_size: 25 },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/convoy/partners', {
      query: { page: 2, page_size: 25, q: 'Hakuhodo', status: 'active' },
    });
    expect(result.structuredContent).toEqual({
      items: [{ id: 'partner-1', name: 'Hakuhodo' }],
      total: 1,
    });
  });

  it('requires exactly one company source when creating a partner', async () => {
    const post = jest.fn();

    const result = await createConvoyPartnerTool.handler({
      reqContext: requestContext({ post }),
      args: {
        company_id: 'company-1',
        company: { name: 'Hakuhodo' },
      },
    });

    expect(result.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it('does not send a partner invitation without explicit send approval', async () => {
    const post = jest.fn();

    const blocked = await inviteConvoyPartnerMemberTool.handler({
      reqContext: requestContext({ post }),
      args: {
        partner_id: 'partner-1',
        email: 'partner@example.com',
        display_name: 'Partner Admin',
        confirm_send: false,
      },
    });

    expect(blocked.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();

    post.mockResolvedValue({
      success: true,
      data: { id: 'member-1', status: 'invited' },
    });
    const sent = await inviteConvoyPartnerMemberTool.handler({
      reqContext: requestContext({ post }),
      args: {
        partner_id: 'partner-1',
        email: 'partner@example.com',
        display_name: 'Partner Admin',
        language: 'ja',
        confirm_send: true,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/convoy/partners/partner-1/members', {
      body: {
        email: 'partner@example.com',
        display_name: 'Partner Admin',
        role: 'member',
        language: 'ja',
      },
    });
    expect(sent.isError).not.toBe(true);
  });

  it('requires approval before creating an invoice request that may notify partners', async () => {
    const post = jest.fn();
    const args = {
      partner_id: 'partner-1',
      period: '2026-07',
      expected_amount: 250000,
      currency: 'jpy',
      submission_due_date: '2026-08-05',
    };

    const blocked = await createConvoyInvoiceRequestTool.handler({
      reqContext: requestContext({ post }),
      args,
    });
    expect(blocked.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();

    post.mockResolvedValue({ success: true, data: { id: 'invoice-request-1' } });
    await createConvoyInvoiceRequestTool.handler({
      reqContext: requestContext({ post }),
      args: { ...args, confirm_send: true },
    });
    expect(post).toHaveBeenCalledWith('/api/v2/convoy/invoice-requests', {
      body: {
        partner_id: 'partner-1',
        period: '2026-07',
        expected_amount: 250000,
        currency: 'JPY',
        submission_due_date: '2026-08-05',
      },
    });
  });

  it('requires payment evidence before recording an invoice request as paid', async () => {
    const post = jest.fn();
    const result = await reviewConvoyInvoiceRequestTool.handler({
      reqContext: requestContext({ post }),
      args: {
        invoice_request_id: 'invoice-request-1',
        action: 'mark_paid',
        confirm: true,
      },
    });

    expect(result.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it('previews commissions by default and requires approval before storing drafts', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: { period: '2026-07', dry_run: true, items: [] },
    });

    await calculateConvoyCommissionsTool.handler({
      reqContext: requestContext({ post }),
      args: { period: '2026-07' },
    });
    expect(post).toHaveBeenCalledWith('/api/v2/convoy/commissions/calculate', {
      body: { period: '2026-07', dry_run: true },
    });

    post.mockClear();
    const blocked = await calculateConvoyCommissionsTool.handler({
      reqContext: requestContext({ post }),
      args: { period: '2026-07', dry_run: false },
    });
    expect(blocked.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });
});
