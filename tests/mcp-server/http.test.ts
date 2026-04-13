import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { streamableHTTPApp } from '../../packages/mcp-server/src/http';
import { configureLogger } from '../../packages/mcp-server/src/logger';
import { AI_CLIENT_MCP_SCOPE } from '../../packages/mcp-server/src/tool-auth';

describe('protected resource metadata route', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    configureLogger({ level: 'error', pretty: false });

    const app = streamableHTTPApp({
      mcpOptions: {
        authorizationServerUrl: 'https://app.sanka.com',
        scopesSupported: [AI_CLIENT_MCP_SCOPE],
        tokenExchangeSharedSecret: 'shared-secret',
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
    });
  });

  it('serves metadata using the request origin when resourceUrl is unset', async () => {
    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header'],
      resource_name: 'Sanka MCP Server',
      scopes_supported: [AI_CLIENT_MCP_SCOPE],
    });
  });

  it('serves the same metadata from the /mcp alias path', async () => {
    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header'],
      resource_name: 'Sanka MCP Server',
      scopes_supported: [AI_CLIENT_MCP_SCOPE],
    });
  });

  it('serves same-origin authorization server metadata for native Codex OAuth', async () => {
    const response = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      revocation_endpoint: `${baseUrl}/oauth/revoke`,
      jwks_uri: `${baseUrl}/oauth/jwks.json`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      client_id_metadata_document_supported: false,
      scopes_supported: [AI_CLIENT_MCP_SCOPE],
    });
  });

  it('serves the same authorization metadata from resource-specific alias paths', async () => {
    const suffixResponse = await fetch(`${baseUrl}/.well-known/oauth-authorization-server/mcp`);
    const suffixBody = await suffixResponse.json();

    expect(suffixResponse.status).toBe(200);
    expect(suffixBody).toEqual({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      revocation_endpoint: `${baseUrl}/oauth/revoke`,
      jwks_uri: `${baseUrl}/oauth/jwks.json`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      client_id_metadata_document_supported: false,
      scopes_supported: [AI_CLIENT_MCP_SCOPE],
    });

    const prefixedResponse = await fetch(`${baseUrl}/mcp/.well-known/oauth-authorization-server`);
    const prefixedBody = await prefixedResponse.json();

    expect(prefixedResponse.status).toBe(200);
    expect(prefixedBody).toEqual(suffixBody);
  });

  it('serves the same OpenID configuration from resource-specific alias paths', async () => {
    const suffixResponse = await fetch(`${baseUrl}/.well-known/openid-configuration/mcp`);
    const suffixBody = await suffixResponse.json();

    expect(suffixResponse.status).toBe(200);
    expect(suffixBody).toEqual({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      revocation_endpoint: `${baseUrl}/oauth/revoke`,
      jwks_uri: `${baseUrl}/oauth/jwks.json`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      client_id_metadata_document_supported: false,
      scopes_supported: [AI_CLIENT_MCP_SCOPE],
    });

    const prefixedResponse = await fetch(`${baseUrl}/mcp/.well-known/openid-configuration`);
    const prefixedBody = await prefixedResponse.json();

    expect(prefixedResponse.status).toBe(200);
    expect(prefixedBody).toEqual(suffixBody);
  });

  it('serves protected resource metadata from the /mcp-prefixed alias path', async () => {
    const response = await fetch(`${baseUrl}/mcp/.well-known/oauth-protected-resource`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header'],
      resource_name: 'Sanka MCP Server',
      scopes_supported: [AI_CLIENT_MCP_SCOPE],
    });
  });

  it('returns an OAuth challenge when a JWT bearer token fails verification', async () => {
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
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(body).toEqual({
      error: 'authentication_failed',
      error_description: 'OAuth bearer token verification failed.',
    });
  });

  it('keeps the default /mcp resource metadata on initialize', async () => {
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
    expect(response.headers.get('www-authenticate')).toContain(
      `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
    );
    expect(response.headers.get('www-authenticate')).not.toContain('/mcp/crm');
    expect(body).toEqual({
      error: 'authentication_failed',
      error_description: 'OAuth bearer token verification failed.',
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

  it('supports stateless follow-up requests after authenticated initialize', async () => {
    const initializeResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer opaque-token',
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
        Authorization: 'Bearer opaque-token',
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
        Authorization: 'Bearer opaque-token',
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
        Authorization: 'Bearer opaque-token',
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
    expect(text).toContain('"name":"list_private_messages"');
    expect(text).toContain('"name":"sync_private_messages"');
    expect(text).toContain('"name":"get_private_message_thread"');
    expect(text).toContain('"name":"reply_private_message_thread"');
    expect(text).toContain('"name":"archive_private_message_thread"');
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
    expect(text).toContain('"name":"delete_order"');
    expect(text).toContain('"name":"list_purchase_orders"');
    expect(text).toContain('"name":"get_purchase_order"');
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
    expect(text).toContain('"name":"create_invoice"');
    expect(text).toContain('"name":"update_invoice"');
    expect(text).toContain('"name":"delete_invoice"');
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

  it('returns an OAuth challenge for protected CRM tool calls without authentication', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
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
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use list_companies.',
    });
  });

  it('returns an OAuth challenge for reply_private_message_thread when authentication is missing', async () => {
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
          name: 'reply_private_message_thread',
          arguments: {
            thread_id: 'thread-1',
            body: 'Thanks for the update.',
          },
        },
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use reply_private_message_thread.',
    });
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
      'Sanka CRM is not connected yet. Approve the OAuth prompt in your MCP client, then retry.',
    );
    expect(text).toContain('"mcp/www_authenticate"');
    expect(text).toContain(`"authorization_server_url":"${baseUrl}"`);
    expect(text).toContain(`"resource_metadata_url":"${baseUrl}/.well-known/oauth-protected-resource"`);
    expect(text).toContain(`"resource_url":"${baseUrl}/mcp"`);
    expect(text).toContain('"connect_url":"https://app.sanka.com/oauth/mcp/connect?token=');
    expect(text).toContain('"reconnect_mode":"client_native_oauth"');
    expect(text).toContain('"reconnect_rpc_method":"mcpServer/oauth/login"');
    expect(text).toContain('"reconnect_server_name":"sanka_plugin"');
    expect(text).toContain('In Codex, call mcpServer/oauth/login for server sanka_plugin');
    expect(text).toContain('resource_metadata=');
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
      'Sanka CRM is not connected yet. Approve the OAuth prompt in your MCP client, then retry.',
    );
    expect(text).toContain('"mcp/www_authenticate"');
    expect(text).toContain(`"authorization_server_url":"${baseUrl}"`);
    expect(text).toContain(`"resource_metadata_url":"${baseUrl}/.well-known/oauth-protected-resource"`);
    expect(text).toContain(`"resource_url":"${baseUrl}/mcp"`);
    expect(text).toContain('"connect_url":"https://app.sanka.com/oauth/mcp/connect?token=');
    expect(text).toContain('"reconnect_mode":"client_native_oauth"');
    expect(text).toContain('"reconnect_rpc_method":"mcpServer/oauth/login"');
    expect(text).toContain('"reconnect_server_name":"sanka_plugin"');
    expect(text).toContain('In Codex, call mcpServer/oauth/login for server sanka_plugin');
  });

  it('returns an OAuth challenge for list_expenses when authentication is missing', async () => {
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
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use list_expenses.',
    });
  });

  it('returns an OAuth challenge for create_expense when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
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
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use create_expense.',
    });
  });

  it('returns an OAuth challenge for create_company when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
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
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use create_company.',
    });
  });

  it('returns an OAuth challenge for get_company_price_table when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
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
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use get_company_price_table.',
    });
  });

  it('returns an OAuth challenge for create_ticket when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
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
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use create_ticket.',
    });
  });

  it('returns an OAuth challenge for create_calendar_attendance when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
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
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use create_calendar_attendance.',
    });
  });

  it('returns an OAuth challenge for create_order when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
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
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use create_order.',
    });
  });

  it('returns an OAuth challenge for create_estimate when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
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
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use create_estimate.',
    });
  });

  it('returns an OAuth challenge for create_invoice when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
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
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use create_invoice.',
    });
  });

  it('returns an OAuth challenge for create_payment when authentication is missing', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
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
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use create_payment.',
    });
  });

  it('returns an OAuth challenge for score_record when authentication is missing', async () => {
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
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
    expect(response.headers.get('www-authenticate')).not.toContain('scope=');
    expect(body).toEqual({
      error: 'authentication_required',
      error_description: 'Authentication required to use score_record.',
    });
  });
});
