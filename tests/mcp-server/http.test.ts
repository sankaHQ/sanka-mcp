import http from 'node:http';
import type { AddressInfo } from 'node:net';
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
const RECONNECT_INSTRUCTIONS =
  'The assistant must include required_user_facing_reply in the next visible response. Do not omit the Connect Sanka URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. Then retry the original request.';

const connectSankaRequiredBody = (baseUrl: string, toolName: string) => ({
  asymmetricMatch: (body: Record<string, unknown>) =>
    body?.['error'] === 'authentication_required' &&
    typeof body['error_description'] === 'string' &&
    body['error_description'].includes(`Authentication required to use ${toolName}.`) &&
    body['error_description'].includes('Connect Sanka: [https://app.sanka.com/oauth/mcp/connect?token=') &&
    body['error_description'].includes('Required user-facing reply: Sanka MCP authentication is required.') &&
    typeof body['connect_url'] === 'string' &&
    body['connect_url'].startsWith('https://app.sanka.com/oauth/mcp/connect?token=') &&
    typeof body['connect_url_markdown'] === 'string' &&
    body['connect_url_markdown'] === `[${body['connect_url']}](${body['connect_url']})` &&
    typeof body['required_user_facing_reply'] === 'string' &&
    body['required_user_facing_reply'].includes(`[${body['connect_url']}](${body['connect_url']})`) &&
    body['resource_url'] === `${baseUrl}/mcp` &&
    body['reconnect_instructions'] === RECONNECT_INSTRUCTIONS &&
    body['reconnect_mode'] === 'connect_sanka' &&
    body['authorization_server_url'] === undefined &&
    body['authorization_url'] === undefined &&
    body['resource_metadata_url'] === undefined &&
    body['reconnect_rpc_method'] === undefined,
  toString: () => 'Connect Sanka required body',
});

describe('streamable HTTP transport', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    configureLogger({ level: 'error', pretty: false });

    const app = streamableHTTPApp({
      mcpOptions: {
        authorizationServerUrl: 'https://app.sanka.com/',
        streamableAuthFallback: 'tool_result',
        tokenExchangeSharedSecret: 'test-secret',
      },
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
      server.closeAllConnections();
    });
  }, HTTP_INTEGRATION_TEST_TIMEOUT_MS);

  afterEach(() => {
    resetBinaryDownloadStoreForTests();
  });

  it.each([
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp',
    '/mcp/.well-known/oauth-protected-resource',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-authorization-server/mcp',
    '/mcp/.well-known/oauth-authorization-server',
    '/.well-known/openid-configuration',
    '/.well-known/openid-configuration/mcp',
    '/mcp/.well-known/openid-configuration',
  ])('does not advertise retired native OAuth metadata at %s', async (path) => {
    const response = await fetch(`${baseUrl}${path}`);

    expect(response.status).toBe(404);
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

  it('rejects direct bearer authentication without advertising an OAuth challenge', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer a.b.c',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual({
      error: 'authentication_failed',
      error_description:
        'Direct Authorization header authentication is not supported. Connect Sanka through this MCP session instead.',
    });
  });

  it('rejects direct bearer authentication on initialize without advertising metadata', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer a.b.c',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: {
            name: 'ChatGPT',
            version: '1.0.0',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual({
      error: 'authentication_failed',
      error_description:
        'Direct Authorization header authentication is not supported. Connect Sanka through this MCP session instead.',
    });
  });

  it('allows unauthenticated initialize requests so clients do not prompt on startup', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: {
            name: 'ChatGPT',
            version: '1.0.0',
          },
        },
      }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toContain('"protocolVersion"');
    expect(body).toContain('"serverInfo"');
  });

  it('allows Claude initialize without forcing native OAuth', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: {
            name: 'Claude Desktop',
            version: '1.0.0',
          },
        },
      }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeTruthy();
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toContain('"protocolVersion"');
    expect(body).toContain('"serverInfo"');
  });

  it('allows Claude tools/list without forcing native OAuth', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'X-Anthropic-Client': 'Claude Desktop',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toContain('"tools"');
    expect(body).toContain('"connect_sanka"');
  });

  it('supports stateless follow-up requests after authenticated initialize', async () => {
    const initializeResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: {
            name: 'ChatGPT',
            version: '1.0.0',
          },
        },
      }),
    });

    expect(initializeResponse.status).toBe(200);
    const sessionId = initializeResponse.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();
    await initializeResponse.text();

    const listResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'mcp-protocol-version': '2025-11-25',
        ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    });

    expect(listResponse.status).toBe(200);
    await listResponse.text();

    const streamResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'mcp-protocol-version': '2025-11-25',
        ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      },
    });

    expect(streamResponse.status).toBe(200);
    expect(streamResponse.headers.get('content-type')).toContain('text/event-stream');
    await streamResponse.body?.cancel();
  });

  it('returns the unified toolset for stateless tools/list requests', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-11-25',
        'User-Agent': 'openai-mcp/1.0.0 (ChatGPT)',
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
    expect(text).not.toContain('"type":"oauth2"');
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

  it('returns Connect Sanka details for protected CRM tool calls without authentication', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'list_companies',
          arguments: {
            search: 'OpenAI',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'list_companies'));
  });

  it('accepts receipt-sized JSON-RPC payloads before authentication preflight', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 18,
        method: 'tools/call',
        params: {
          name: 'append_expense_attachment_upload_chunk',
          arguments: {
            upload_token: 'upload-token',
            offset: 0,
            content_base64: 'A'.repeat(150_000),
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'append_expense_attachment_upload_chunk'));
  });

  it('returns Connect Sanka details for reply_private_message_thread when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 17,
        method: 'tools/call',
        params: {
          name: 'reply_private_message_thread',
          arguments: {
            thread_id: 'thread-1',
            body: 'Thanks for the update.',
            confirm_send: true,
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'reply_private_message_thread'));
  });

  it('returns the auth_status fallback payload when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'auth_status',
          arguments: {},
        },
      }),
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(response.headers.get('mcp-session-id')).toBeTruthy();
    expect(text).toContain('"connected":false');
    expect(text).toContain('"auth_mode":"none"');
    expect(text).toContain('"tool_profile":"hosted"');
    expect(text).toContain(
      'Sanka CRM is not connected yet. Open the Connect Sanka URL, finish connecting, then retry.',
    );
    expect(text).not.toContain('"mcp/www_authenticate"');
    expect(text).not.toContain('"authorization_server_url"');
    expect(text).not.toContain('"authorization_url"');
    expect(text).toContain('"connect_url":"https://app.sanka.com/oauth/mcp/connect?token=');
    expect(text).toContain('"connect_url_markdown":"[https://app.sanka.com/oauth/mcp/connect?token=');
    expect(text).toContain('"required_user_facing_reply":"Sanka MCP authentication is required.');
    expect(text).not.toContain('"resource_metadata_url"');
    expect(text).toContain(`"resource_url":"${baseUrl}/mcp"`);
    expect(text).toContain('"reconnect_mode":"connect_sanka"');
    expect(text).not.toContain('"reconnect_rpc_method"');
    expect(text).not.toContain('"reconnect_server_name"');
    expect(text).toContain('The assistant must include required_user_facing_reply');
  });

  it('replaces caller-chosen session ids with a server-issued resource capability', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'mcp-session-id': 'attacker-fixed-session',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 70,
        method: 'tools/call',
        params: {
          name: 'auth_status',
          arguments: {},
        },
      }),
    });
    const text = await response.text();
    const issuedSessionId = response.headers.get('mcp-session-id');
    const connectUrlMatch = text.match(/"connect_url":"([^"]+)"/);
    const connectUrl = JSON.parse(`"${connectUrlMatch?.[1]}"`);
    const token = new URL(connectUrl).searchParams.get('token');
    const payloadPart = String(token).split('.', 1)[0]!;
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as {
      aud?: string;
      res?: string;
      sid?: string;
    };

    expect(response.status).toBe(200);
    expect(issuedSessionId).toBeTruthy();
    expect(issuedSessionId).not.toBe('attacker-fixed-session');
    expect(payload).toMatchObject({
      aud: 'sanka-mcp',
      res: `${baseUrl}/mcp`,
      sid: issuedSessionId,
    });
  });

  it('keeps auth_status reconnect tokens scoped to MCP access', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 17,
        method: 'tools/call',
        params: {
          name: 'auth_status',
          arguments: {
            required_scopes: ['expenses:write'],
          },
        },
      }),
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain('"required_scopes":["expenses:write"]');

    const connectUrlMatch = text.match(/"connect_url":"([^"]+)"/);
    expect(connectUrlMatch?.[1]).toBeTruthy();
    const connectUrl = JSON.parse(`"${connectUrlMatch?.[1]}"`);
    const token = new URL(connectUrl).searchParams.get('token');
    expect(token).toBeTruthy();
    const payload = String(token).split('.', 1)[0]!;
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))).toMatchObject({
      scp: ['mcp:access'],
    });
  });

  it('returns the connect_sanka fallback payload when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 18,
        method: 'tools/call',
        params: {
          name: 'connect_sanka',
          arguments: {},
        },
      }),
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(response.headers.get('mcp-session-id')).toBeTruthy();
    expect(text).toContain('"connected":false');
    expect(text).toContain('"auth_mode":"none"');
    expect(text).toContain('"tool_profile":"hosted"');
    expect(text).toContain(
      'Sanka CRM is not connected yet. Open the Connect Sanka URL, finish connecting, then retry.',
    );
    expect(text).not.toContain('"mcp/www_authenticate"');
    expect(text).not.toContain('"authorization_server_url"');
    expect(text).not.toContain('"authorization_url"');
    expect(text).toContain('"connect_url":"https://app.sanka.com/oauth/mcp/connect?token=');
    expect(text).toContain('"connect_url_markdown":"[https://app.sanka.com/oauth/mcp/connect?token=');
    expect(text).toContain('"required_user_facing_reply":"Sanka MCP authentication is required.');
    expect(text).not.toContain('"resource_metadata_url"');
    expect(text).toContain(`"resource_url":"${baseUrl}/mcp"`);
    expect(text).toContain('"reconnect_mode":"connect_sanka"');
    expect(text).not.toContain('"reconnect_rpc_method"');
    expect(text).not.toContain('"reconnect_server_name"');
    expect(text).toContain('The assistant must include required_user_facing_reply');
  });

  it('returns Connect Sanka details for list_expenses when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'list_expenses',
          arguments: {},
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'list_expenses'));
  });

  it('keeps the HTTP 401 response for streamable tool calls unless tool-result fallback is enabled', async () => {
    const defaultApp = streamableHTTPApp({
      mcpOptions: {
        authorizationServerUrl: 'https://app.sanka.com',
        tokenExchangeSharedSecret: 'test-secret',
      },
    });
    let defaultServer: http.Server | undefined;
    let defaultBaseUrl = '';

    await new Promise<void>((resolve) => {
      defaultServer = defaultApp.listen(0, () => {
        const address = defaultServer?.address() as AddressInfo;
        defaultBaseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    try {
      const response = await fetch(`${defaultBaseUrl}/mcp`, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 8,
          method: 'tools/call',
          params: {
            name: 'list_expenses',
            arguments: {},
          },
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBeNull();
      expect(body).toEqual(connectSankaRequiredBody(defaultBaseUrl, 'list_expenses'));
    } finally {
      await new Promise<void>((resolve, reject) => {
        defaultServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });

  it('returns visible reconnect details for streamable tool calls when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'list_expenses',
          arguments: {},
        },
      }),
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(text).toContain('Authentication required to use List expenses.');
    expect(text).toContain('Connect Sanka: [https://app.sanka.com/oauth/mcp/connect?token=');
    expect(text).toContain('Required user-facing reply: Sanka MCP authentication is required.');
    expect(text).toContain('"required_user_facing_reply":"Sanka MCP authentication is required.');
    expect(text).toContain('"reconnect_mode":"connect_sanka"');
    expect(text).not.toContain('mcpServer/oauth/login');
    expect(text).not.toContain('"mcp/www_authenticate"');
  });

  it('returns Connect Sanka details for Codex streamable tool calls', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'User-Agent': 'Codex Desktop/0.128.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'list_expenses',
          arguments: {},
        },
      }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toContain('/oauth/mcp/connect');
    expect(body).toContain('required_user_facing_reply');
    expect(body).not.toContain('mcpServer/oauth/login');
  });

  it('returns Connect Sanka details for Claude streamable tool calls', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'User-Agent': 'Claude-User',
        'X-Anthropic-Client': 'ClaudeCode',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'list_expenses',
          arguments: {},
        },
      }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toContain('/oauth/mcp/connect');
    expect(body).toContain('required_user_facing_reply');
    expect(body).not.toContain('mcpServer/oauth/login');
  });

  it('returns Connect Sanka details for create_expense when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'create_expense',
          arguments: {
            description: 'Hotel',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'create_expense'));
  });

  it('returns Connect Sanka details for create_company when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'create_company',
          arguments: {
            external_id: 'COMP-1',
            name: 'Acme',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'create_company'));
  });

  it('returns Connect Sanka details for get_company_price_table when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 10.5,
        method: 'tools/call',
        params: {
          name: 'get_company_price_table',
          arguments: {
            company_id: 'company-1',
            search: 'Widget',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'get_company_price_table'));
  });

  it('returns Connect Sanka details for create_ticket when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'create_ticket',
          arguments: {
            title: 'Broken integration',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'create_ticket'));
  });

  it('returns Connect Sanka details for create_calendar_attendance when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'create_calendar_attendance',
          arguments: {
            event_id: 'event-1',
            date: '2026-04-10',
            time: '09:00',
            name: 'Jane Doe',
            email: 'jane@example.com',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'create_calendar_attendance'));
  });

  it('returns Connect Sanka details for create_order when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'create_order',
          arguments: {
            order: {
              external_id: 'ORDER-1',
              items: [
                {
                  item_id: 'item-1',
                  quantity: 2,
                },
              ],
            },
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'create_order'));
  });

  it('returns Connect Sanka details for create_estimate when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: {
          name: 'create_estimate',
          arguments: {
            external_id: 'EST-1',
            company_id: 'company-1',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'create_estimate'));
  });

  it('returns Connect Sanka details for create_invoice when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: {
          name: 'create_invoice',
          arguments: {
            external_id: 'INV-1',
            company_id: 'company-1',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'create_invoice'));
  });

  it('returns Connect Sanka details for create_payment when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 16,
        method: 'tools/call',
        params: {
          name: 'create_payment',
          arguments: {
            external_id: 'PAY-1',
            company_id: 'company-1',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'create_payment'));
  });

  it('returns Connect Sanka details for score_record when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 17,
        method: 'tools/call',
        params: {
          name: 'score_record',
          arguments: {
            object_type: 'company',
            record_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(body).toEqual(connectSankaRequiredBody(baseUrl, 'score_record'));
  });
});
