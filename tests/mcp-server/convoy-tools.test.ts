import { configureLogger } from '../../packages/mcp-server/src/logger';
import { initMcpServer } from '../../packages/mcp-server/src/server';
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
      'list_partners',
      'get_partner',
      'create_partner',
      'update_partner',
      'archive_partner',
      'list_partner_members',
      'invite_partner_member',
      'resend_partner_invite',
      'revoke_partner_member',
      'list_partner_invoice_requests',
      'get_partner_invoice_request',
      'create_partner_invoice_request',
      'review_partner_invoice_request',
      'list_partner_commissions',
      'get_partner_commission',
      'calculate_partner_commissions',
      'review_partner_commission',
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

// 2026-11-10: the Convoy tools were renamed to Sanka Partner names. Clients that cached the
// catalog, and saved prompts or skills, still call list_convoy_partners and the other old names.
describe('pre-rename Convoy tool names', () => {
  const startServer = async () => {
    const handlers = new Map<string, (request: unknown) => Promise<unknown>>();
    const fakeServer = {
      setRequestHandler: (schema: unknown, handler: (request: unknown) => Promise<unknown>) => {
        const method = (schema as { shape?: { method?: { value?: unknown } } }).shape?.method?.value;
        if (typeof method === 'string') handlers.set(method, handler);
      },
      sendLoggingMessage: jest.fn().mockResolvedValue(undefined),
    };
    const requests: string[] = [];
    const fetchImpl = jest.fn(async (input: unknown): Promise<Response> => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes('/api/v2/mcp/tool-call-log')) requests.push(url);
      return new Response(JSON.stringify({ success: true, data: { items: [], total: 0 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    await initMcpServer({
      server: fakeServer as never,
      clientOptions: { apiKey: 'soat_partner_aliases', fetch: fetchImpl as never },
      mcpSessionId: 'session-partner-aliases',
      toolProfile: 'hosted',
      auth: oauthContext(),
    });
    return { handlers, requests };
  };

  beforeAll(() => {
    configureLogger({ level: 'error', pretty: false });
  });

  it('are still callable but no longer listed', async () => {
    const { handlers, requests } = await startServer();

    const listed = (await handlers.get('tools/list')!({})) as { tools: Array<{ name: string }> };
    const names = listed.tools.map((tool) => tool.name);
    expect(names).toContain('list_partners');
    expect(names).not.toContain('list_convoy_partners');

    const result = (await handlers.get('tools/call')!({
      params: { name: 'list_convoy_partners', arguments: { q: 'Harbor' } },
    })) as { isError?: boolean };
    expect(result.isError).toBeFalsy();
    expect(requests).toEqual([expect.stringContaining('/api/v2/convoy/partners?')]);
  });
});
