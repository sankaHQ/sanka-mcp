import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib';
import {
  storeBinaryDownload,
  resetBinaryDownloadStoreForTests,
} from '../../packages/mcp-server/src/binary-download-store';
import { streamableHTTPApp } from '../../packages/mcp-server/src/http';
import {
  LocalDocsSearch,
  resetSharedLocalDocsSearchForTests,
} from '../../packages/mcp-server/src/local-docs-search';
import { configureLogger } from '../../packages/mcp-server/src/logger';

const HTTP_INTEGRATION_TEST_TIMEOUT_MS = 15_000;
const ISSUER = 'https://api.example.test/oauth/mcp';
const AUTHORIZATION_SERVER_METADATA = { issuer: ISSUER, token_endpoint: `${ISSUER}/token` };
// The exchange cache is keyed by token, so each test uses its own MCP OAuth token.
const token = (name: string) => `smat_${name.padEnd(24, '0')}`;

const listen = (server: http.Server) =>
  new Promise<string>((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
    );
  });

describe('streamable HTTP transport', () => {
  let server: http.Server;
  let api: http.Server;
  let baseUrl: string;
  let exchanges: { secret: unknown; body: { access_token: string; resource: string } }[] = [];
  let apiRequests: { url: string; authorization: unknown; sessionHeader: unknown }[] = [];
  let currentWorkspace = 'ws-1';

  beforeAll(async () => {
    configureLogger({ level: 'error', pretty: false });
    // Stands in for sanka-api: the internal token exchange, its metadata and two business routes.
    api = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += String(chunk)));
      req.on('end', () => {
        const send = (status: number, body: unknown) => {
          res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
        };
        if (req.url === '/oauth/internal/mcp-oauth-token') {
          const body = JSON.parse(raw);
          exchanges.push({ secret: req.headers['x-sanka-mcp-resource-secret'], body });
          const name = String(body.access_token).slice(5);
          if (name.startsWith('unreachable')) return req.socket.destroy();
          if (name.startsWith('revoked')) return send(401, { error: 'invalid_token' });
          if (name.startsWith('outage')) return send(503, { error: 'unavailable' });
          return send(200, {
            access_token: `soat_${name}`,
            expires_in: 300,
            scope: name.startsWith('noscope') ? 'other:scope' : 'mcp:access',
            client_name: 'Claude',
            workspace_id: 'ws-1',
          });
        }
        if (req.url === '/.well-known/oauth-authorization-server/oauth/mcp') {
          return send(200, AUTHORIZATION_SERVER_METADATA);
        }
        // The tool-call audit log is posted after the result and owned by server-tool-log.test.
        if (req.url === '/api/v2/mcp/tool-call-log') return send(200, {});
        if (req.url === '/api/v2/manage-support/access') {
          // The API's Support admin rule for this token's user.
          const admin = String(req.headers.authorization).startsWith('Bearer soat_supportadmin');
          return send(200, { success: true, data: { is_support_admin: admin } });
        }
        apiRequests.push({
          url: String(req.url),
          authorization: req.headers.authorization,
          sessionHeader: req.headers['x-sanka-mcp-session-id'],
        });
        if (req.url === '/api/v2/workspaces/switch') currentWorkspace = JSON.parse(raw).target_workspace_id;
        return send(200, {
          success: true,
          data: {
            current_workspace: { id: currentWorkspace, code: '10101010', name: 'Test' },
            workspaces: [{ id: currentWorkspace, code: '10101010', name: 'Test' }],
          },
        });
      });
    });
    const apiBase = await listen(api);
    server = http.createServer(
      streamableHTTPApp({
        clientOptions: { baseURL: apiBase, maxRetries: 0 },
        mcpOptions: {
          oauthIssuer: ISSUER,
          internalAuthorizationServerUrl: apiBase,
          oauthResourceServerSecret: 'resource-secret',
        },
      }),
    );
    baseUrl = await listen(server);
  });

  afterAll(async () => {
    await Promise.all(
      [server, api].map(
        (item) =>
          new Promise<void>((resolve) => {
            item.close(() => resolve());
            item.closeAllConnections();
          }),
      ),
    );
  }, HTTP_INTEGRATION_TEST_TIMEOUT_MS);

  beforeEach(() => {
    exchanges = [];
    apiRequests = [];
    currentWorkspace = 'ws-1';
  });

  afterEach(() => {
    resetBinaryDownloadStoreForTests();
  });

  const rpc = async (
    path: string,
    { headers = {}, method = 'tools/list', params = {} }: Record<string, any> = {},
  ) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const text = await response.text();
    const event = text.split('\n').find((line) => line.startsWith('data: '));
    return { response, message: event ? JSON.parse(event.slice(6)) : undefined };
  };
  const bearer = (name: string) => ({ Authorization: `Bearer ${token(name)}` });
  const callTool = (path: string, tokenName: string, name: string, args = {}, headers = {}) =>
    rpc(path, {
      headers: { ...bearer(tokenName), ...headers },
      method: 'tools/call',
      params: { name, arguments: args },
    });

  it.each(
    ['/', '/mcp', '/sse', '/chatgpt', '/missing'].flatMap((route) =>
      ['application/json', 'application/x-www-form-urlencoded'].flatMap((contentType) =>
        (
          [
            ['br', brotliCompressSync],
            ['BR', brotliCompressSync],
            ['gzip', gzipSync],
            ['deflate', deflateSync],
          ] as const
        ).map(([encoding, compress]) => ({ route, contentType, encoding, compress })),
      ),
    ),
  )(
    'rejects $encoding $contentType at $route before authentication',
    async ({ route, contentType, encoding, compress }) => {
      const body = contentType === 'application/json' ? '{}' : 'method=initialize';
      const response = await fetch(`${baseUrl}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': contentType, 'Content-Encoding': encoding },
        body: compress(Buffer.from(body)),
      });
      expect(response.status).toBe(415);
      expect(await response.json()).toMatchObject({ error: 'invalid_request' });
    },
  );

  // MCP authorization (2026-07-28): a client follows the challenge to the resource metadata,
  // signs in with the authorization server it names, then retries with its token.
  it.each([
    ['/', ''],
    ['/mcp', '/mcp'],
    ['/sse', '/sse'],
  ])('runs the OAuth discovery flow at %s, as its own resource', async (path, suffix) => {
    const unauthenticated = await rpc(path, {
      method: 'tools/call',
      // Receipt-sized: the body is read before the challenge, not refused for its size.
      params: {
        name: 'append_expense_attachment_upload_chunk',
        arguments: { content_base64: 'A'.repeat(150_000) },
      },
    });
    const metadataUrl = `${baseUrl}/.well-known/oauth-protected-resource${suffix}`;
    expect(unauthenticated.response.status).toBe(401);
    expect(unauthenticated.response.headers.get('www-authenticate')).toBe(
      `Bearer scope="mcp:access", resource_metadata="${metadataUrl}"`,
    );

    const metadata = await fetch(metadataUrl);
    expect(await metadata.json()).toMatchObject({
      resource: `${baseUrl}${suffix}`,
      authorization_servers: [ISSUER],
      scopes_supported: ['mcp:access'],
      bearer_methods_supported: ['header'],
    });

    const tokenName = `flow${suffix.replace('/', '_')}`;
    const { response } = await callTool(path, tokenName, 'current_workspace');
    expect(response.status).toBe(200);
    expect(exchanges).toEqual([
      {
        secret: 'resource-secret',
        body: { access_token: token(tokenName), resource: `${baseUrl}${suffix}` },
      },
    ]);
    // Sanka's API sees only the API token minted for this server, never the client's token.
    expect(apiRequests[0]).toMatchObject({
      url: '/api/v2/auth/session',
      authorization: `Bearer soat_${token(tokenName).slice(5)}`,
    });
  });

  it('mirrors the authorization server metadata for clients that look on this origin', async () => {
    const response = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(AUTHORIZATION_SERVER_METADATA);
  });

  it.each([
    ['an expired or revoked token', bearer('revoked'), 401, 'invalid_token'],
    [
      'a token not issued for MCP',
      { Authorization: 'Bearer soat_aaaaaaaaaaaaaaaaaaaaaaaa' },
      401,
      'invalid_token',
    ],
    ['a developer API key', { 'X-Sanka-API-Key': 'sk_live_example' }, 401, 'invalid_request'],
    ['an exchange outage', bearer('outage'), 503, undefined],
    ['an unreachable exchange', bearer('unreachable'), 503, undefined],
  ])('refuses %s before any tool runs', async (_name, headers, status, oauthError) => {
    const { response } = await rpc('/mcp', { headers });

    expect(response.status).toBe(status);
    const challenge = response.headers.get('www-authenticate');
    if (oauthError) {
      expect(challenge).toContain(`error="${oauthError}"`);
    } else {
      expect(challenge).toBeNull();
    }
    expect(apiRequests).toEqual([]);
  });

  it('answers a token without the scope a tool needs with an insufficient_scope challenge', async () => {
    const { response } = await callTool('/mcp', 'noscope', 'list_deals');

    expect(response.status).toBe(403);
    expect(response.headers.get('www-authenticate')).toContain('error="insufficient_scope"');
    expect(apiRequests).toEqual([]);
  });

  // The bug: each request re-checks the token with Sanka, or a switch_workspace is lost on the next
  // request because the cached exchange still names the old workspace.
  it('reuses one exchange per token and keeps a workspace switch for the next request', async () => {
    // A client-sent session id carries no identity and is never forwarded to Sanka.
    const legacySession = { 'mcp-session-id': 'client-chosen-session' };
    const switched = await callTool(
      '/mcp',
      'switch',
      'switch_workspace',
      { workspace_id: 'ws-2' },
      legacySession,
    );
    expect(switched.message.result.isError).toBeFalsy();

    const status = await callTool('/mcp', 'switch', 'auth_status', {}, legacySession);
    expect(status.message.result.structuredContent).toMatchObject({
      workspace_id: 'ws-2',
      // Clients on older protocol versions are named by the grant the user approved.
      client_name: 'Claude',
    });
    expect(exchanges).toHaveLength(1);
    expect(apiRequests.filter((request) => request.sessionHeader !== undefined)).toEqual([]);
  });

  it('serves stateless requests without issuing a session and declines the standalone GET stream', async () => {
    const initialize = await rpc('/mcp', {
      headers: bearer('stateless'),
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'ChatGPT', version: '1' },
      },
    });
    expect(initialize.response.status).toBe(200);
    expect(initialize.response.headers.get('mcp-session-id')).toBeNull();

    const list = await rpc('/mcp', {
      headers: { ...bearer('stateless'), 'mcp-protocol-version': '2025-11-25' },
    });
    expect(list.response.status).toBe(200);

    const stream = await fetch(`${baseUrl}/mcp`, { headers: { Accept: 'text/event-stream' } });
    // An idle stream here is reset by the edge, and clients re-initialize after repeated resets.
    expect(stream.status).toBe(405);
    await stream.body?.cancel();
  });

  it('returns a generic JSON response for malformed JSON without framework headers', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: '{',
    });
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-powered-by')).toBeNull();
    expect(JSON.parse(text)).toEqual({
      error: 'invalid_json',
      error_description: 'Request body must contain valid JSON.',
    });
    expect(text).not.toContain('SyntaxError');
    expect(text).not.toContain('/app/');
    expect(text).not.toContain('node_modules');
  });

  it('does not expose the Express framework header', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-powered-by')).toBeNull();
  });

  it('serves prepared binary downloads without base64 chunk transport', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4\n% fast download\n%%EOF\n');
    const stored = storeBinaryDownload({
      contentBase64: pdfBytes.toString('base64'),
      contentDisposition: 'attachment; filename="invoice-7.pdf"',
      filename: 'invoice-7.pdf',
      mimeType: 'application/pdf',
      byteLength: pdfBytes.length,
      sessionId: 'session-1',
    });

    const response = await fetch(`${baseUrl}/downloads/${stored.downloadToken}`, {
      headers: { 'mcp-session-id': 'session-1' },
    });
    const body = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="invoice-7.pdf"');
    expect(response.headers.get('content-length')).toBe(String(pdfBytes.length));
    expect(response.headers.get('content-type')).toContain('application/pdf');
    expect(response.headers.get('x-sanka-download-expires-at')).toBe(stored.expiresAt);
    expect(body).toEqual(pdfBytes);
  });

  it('rejects prepared binary downloads from a different MCP session', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4\n% private download\n%%EOF\n');
    const stored = storeBinaryDownload({
      contentBase64: pdfBytes.toString('base64'),
      filename: 'invoice-7.pdf',
      mimeType: 'application/pdf',
      byteLength: pdfBytes.length,
      sessionId: 'session-1',
    });

    const response = await fetch(`${baseUrl}/downloads/${stored.downloadToken}`, {
      headers: { 'mcp-session-id': 'session-2' },
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      error: 'session_mismatch',
      error_description: expect.stringContaining('different MCP session'),
    });
  });

  it('serves prepared binary downloads from the /mcp alias path', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4\n% alias download\n%%EOF\n');
    const stored = storeBinaryDownload({
      contentBase64: pdfBytes.toString('base64'),
      filename: 'estimate-1.pdf',
      mimeType: 'application/pdf',
      byteLength: pdfBytes.length,
    });

    const response = await fetch(`${baseUrl}/mcp/downloads/${stored.downloadToken}`);
    const body = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('filename="estimate-1.pdf"');
    expect(body).toEqual(pdfBytes);
  });

  it('returns 404 for unknown prepared download tokens', async () => {
    const response = await fetch(`${baseUrl}/downloads/missing-token`);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      error: 'not_found',
      error_description: expect.stringContaining('Download token was not found'),
    });
  });

  it.each([
    ['a support admin', 'supportadmin', true],
    ['anyone else', 'customer', false],
  ])('lists the Support admin tools only for %s', async (_who, tokenName, listed) => {
    const { message } = await rpc('/mcp', { headers: bearer(tokenName) });
    const names = (message.result.tools as { name: string }[]).map((tool) => tool.name);

    expect(names).toEqual(expect.arrayContaining(['support_list_my_tickets', 'support_get_my_ticket']));
    expect(names.includes('support_admin_reply')).toBe(listed);
    expect(names.includes('support_admin_list_tickets')).toBe(listed);
  });

  it('returns the unified toolset for stateless tools/list requests', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-11-25',
        'User-Agent': 'openai-mcp/1.0.0 (ChatGPT)',
        Authorization: `Bearer ${token('toolset')}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/list',
        params: {},
      }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('"name":"connect_sanka"');
    expect(text).toContain('"name":"auth_status"');
    const tools = JSON.parse(
      text
        .split('\n')
        .find((line) => line.startsWith('data: '))!
        .slice(6),
    ).result.tools as { securitySchemes?: unknown }[];
    for (const tool of tools) {
      expect(tool.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['mcp:access'] }]);
    }
    expect(text).toContain('"name":"list_private_messages"');
    expect(text).toContain('"name":"sync_private_messages"');
    expect(text).toContain('"name":"get_private_message_thread"');
    expect(text).toContain('"name":"reply_private_message_thread"');
    expect(text).toContain('"name":"archive_private_message_thread"');
    expect(text).toContain('"name":"list_workspace_messages"');
    expect(text).toContain('"name":"sync_workspace_messages"');
    expect(text).toContain('"name":"get_workspace_message_thread"');
    expect(text).toContain('"name":"reply_workspace_message_thread"');
    expect(text).toContain('"name":"list_companies"');
    expect(text).toContain('"name":"get_company"');
    expect(text).toContain('"name":"create_company"');
    expect(text).toContain('"name":"update_company"');
    expect(text).toContain('"name":"delete_company"');
    expect(text).toContain('"name":"get_company_price_table"');
    expect(text).toContain('"name":"update_company_price_table_company"');
    expect(text).toContain('"name":"update_company_price_table_item"');
    expect(text).toContain('"name":"apply_company_price_table_items"');
    expect(text).toContain('"name":"list_contacts"');
    expect(text).toContain('"name":"get_contact"');
    expect(text).toContain('"name":"create_contact"');
    expect(text).toContain('"name":"update_contact"');
    expect(text).toContain('"name":"delete_contact"');
    expect(text).toContain('"name":"list_deals"');
    expect(text).toContain('"name":"get_deal"');
    expect(text).toContain('"name":"create_deal"');
    expect(text).toContain('"name":"update_deal"');
    expect(text).toContain('"name":"delete_deal"');
    expect(text).toContain('"name":"list_deal_pipelines"');
    expect(text).toContain('"name":"list_items"');
    expect(text).toContain('"name":"get_item"');
    expect(text).toContain('"name":"create_item"');
    expect(text).toContain('"name":"update_item"');
    expect(text).toContain('"name":"delete_item"');
    expect(text).toContain('"name":"list_tickets"');
    expect(text).toContain('"name":"get_ticket"');
    expect(text).toContain('"name":"create_ticket"');
    expect(text).toContain('"name":"update_ticket"');
    expect(text).toContain('"name":"delete_ticket"');
    expect(text).toContain('"name":"list_ticket_pipelines"');
    expect(text).toContain('"name":"update_ticket_status"');
    expect(text).toContain('"name":"list_expenses"');
    expect(text).toContain('"name":"get_expense"');
    expect(text).toContain('"name":"upload_expense_attachment"');
    expect(text).toContain('"name":"upload_import_file"');
    expect(text).toContain('"name":"import_records"');
    expect(text).toContain('"name":"list_integration_channels"');
    expect(text).toContain('"name":"export_records"');
    expect(text).toContain('"name":"create_expense"');
    expect(text).toContain('"name":"update_expense"');
    expect(text).toContain('"name":"delete_expense"');
    expect(text).toContain('"name":"list_properties"');
    expect(text).toContain('"name":"get_property"');
    expect(text).toContain('"name":"create_property"');
    expect(text).toContain('"name":"update_property"');
    expect(text).toContain('"name":"delete_property"');
    expect(text).toContain('"name":"get_calendar_bootstrap"');
    expect(text).toContain('"name":"check_calendar_availability"');
    expect(text).toContain('"name":"create_calendar_attendance"');
    expect(text).toContain('"name":"cancel_calendar_attendance"');
    expect(text).toContain('"name":"reschedule_calendar_attendance"');
    expect(text).toContain('"name":"list_orders"');
    expect(text).toContain('"name":"get_order"');
    expect(text).toContain('"name":"create_order"');
    expect(text).toContain('"name":"update_order"');
    expect(text).toContain('"name":"activate_order"');
    expect(text).toContain('"name":"delete_order"');
    expect(text).toContain('"name":"permanent_delete_order"');
    expect(text).toContain('"name":"list_purchase_orders"');
    expect(text).toContain('"name":"get_purchase_order"');
    expect(text).toContain('"name":"download_purchase_order_pdf"');
    expect(text).toContain('"name":"create_purchase_order"');
    expect(text).toContain('"name":"update_purchase_order"');
    expect(text).toContain('"name":"delete_purchase_order"');
    expect(text).toContain('"name":"list_estimates"');
    expect(text).toContain('"name":"get_estimate"');
    expect(text).toContain('"name":"create_estimate"');
    expect(text).toContain('"name":"update_estimate"');
    expect(text).toContain('"name":"delete_estimate"');
    expect(text).toContain('"name":"list_invoices"');
    expect(text).toContain('"name":"list_overdue_invoices"');
    expect(text).toContain('"name":"get_invoice"');
    expect(text).toContain('"name":"send_invoice_email"');
    expect(text).toContain('"name":"create_invoice"');
    expect(text).toContain('"name":"update_invoice"');
    expect(text).toContain('"name":"activate_invoice"');
    expect(text).toContain('"name":"delete_invoice"');
    expect(text).toContain('"name":"permanent_delete_invoice"');
    expect(text).toContain('"name":"list_subscriptions"');
    expect(text).toContain('"name":"get_subscription"');
    expect(text).toContain('"name":"create_subscription"');
    expect(text).toContain('"name":"update_subscription"');
    expect(text).toContain('"name":"delete_subscription"');
    expect(text).toContain('"name":"list_payments"');
    expect(text).toContain('"name":"get_payment"');
    expect(text).toContain('"name":"create_payment"');
    expect(text).toContain('"name":"update_payment"');
    expect(text).toContain('"name":"delete_payment"');
    expect(text).toContain('"name":"list_slips"');
    expect(text).toContain('"name":"get_slip"');
    expect(text).toContain('"name":"create_slip"');
    expect(text).toContain('"name":"update_slip"');
    expect(text).toContain('"name":"delete_slip"');
    expect(text).toContain('"name":"list_bills"');
    expect(text).toContain('"name":"get_bill"');
    expect(text).toContain('"name":"create_bill"');
    expect(text).toContain('"name":"update_bill"');
    expect(text).toContain('"name":"delete_bill"');
    expect(text).toContain('"name":"list_disbursements"');
    expect(text).toContain('"name":"get_disbursement"');
    expect(text).toContain('"name":"create_disbursement"');
    expect(text).toContain('"name":"update_disbursement"');
    expect(text).toContain('"name":"delete_disbursement"');
    expect(text).toContain('"name":"list_disbursement_allocations"');
    expect(text).toContain('"name":"create_disbursement_allocation"');
    expect(text).toContain('"name":"update_disbursement_allocation"');
    expect(text).toContain('"name":"delete_disbursement_allocation"');
    expect(text).toContain('"name":"list_locations"');
    expect(text).toContain('"name":"get_location"');
    expect(text).toContain('"name":"create_location"');
    expect(text).toContain('"name":"update_location"');
    expect(text).toContain('"name":"delete_location"');
    expect(text).toContain('"name":"list_inventories"');
    expect(text).toContain('"name":"get_inventory"');
    expect(text).toContain('"name":"create_inventory"');
    expect(text).toContain('"name":"update_inventory"');
    expect(text).toContain('"name":"delete_inventory"');
    expect(text).toContain('"name":"list_inventory_transactions"');
    expect(text).toContain('"name":"get_inventory_transaction"');
    expect(text).toContain('"name":"create_inventory_transaction"');
    expect(text).toContain('"name":"update_inventory_transaction"');
    expect(text).toContain('"name":"delete_inventory_transaction"');
    expect(text).toContain('"name":"prospect_companies"');
    expect(text).toContain('"name":"score_record"');
    expect(text).toContain('"name":"generate_demo_workspace"');
    expect(text).toContain('"name":"push_integration_sync"');
    expect(text).not.toContain('"name":"execute"');
    expect(text).not.toContain('"name":"search_docs"');
  });

  it('builds the local docs search once across multiple requests', async () => {
    resetSharedLocalDocsSearchForTests();
    const createSpy = jest.spyOn(LocalDocsSearch, 'create');
    try {
      for (const id of [61, 62]) {
        const response = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            Accept: 'application/json, text/event-stream',
            'Content-Type': 'application/json',
            'MCP-Protocol-Version': '2025-11-25',
            Authorization: `Bearer ${token('docs')}`,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            method: 'tools/list',
            params: {},
          }),
        });
        expect(response.status).toBe(200);
        await response.text();
      }

      expect(createSpy).toHaveBeenCalledTimes(1);
    } finally {
      createSpy.mockRestore();
    }
  });

  it('serves the correct hosted tool set to requests with different client permission headers', async () => {
    const listToolsWithPermissions = async (permissions: string, id: number): Promise<string> => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2025-11-25',
          'x-sanka-mcp-client-permissions': permissions,
          Authorization: `Bearer ${token('permissions')}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'tools/list',
          params: {},
        }),
      });
      expect(response.status).toBe(200);
      return response.text();
    };

    const blockedOrdersText = await listToolsWithPermissions(
      JSON.stringify({ blocked_methods: ['public\\.orders\\..*'] }),
      63,
    );
    const allowedGetsText = await listToolsWithPermissions(
      JSON.stringify({ allow_http_gets: true, allowed_methods: ['public\\.companies\\..*'] }),
      64,
    );

    // Client permission overrides only affect the code tool, which the hosted
    // profile never exposes: both requests must still get the full hosted set,
    // and neither cached selection may leak code tools into the other.
    for (const text of [blockedOrdersText, allowedGetsText]) {
      expect(text).toContain('"name":"connect_sanka"');
      expect(text).toContain('"name":"list_companies"');
      expect(text).toContain('"name":"create_invoice"');
      expect(text).not.toContain('"name":"execute"');
      expect(text).not.toContain('"name":"search_docs"');
    }
  });
});
