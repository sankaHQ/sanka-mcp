// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ClientOptions } from 'sanka-sdk';
import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import {
  buildOAuthWwwAuthenticateHeader,
  extractMcpSessionId,
  generateMcpSessionId,
  OAuthChallengeError,
  resolveClientAuth,
} from './auth';
import { getLogger } from './logger';
import { McpOptions } from './options';
import { ToolProfile } from './profile';
import { buildProtectedResourceMetadata } from './protected-resource-metadata';
import { executeHandler, initMcpServer, newMcpServer } from './server';
import { resolveMissingScopes } from './tool-auth';
import { crmAuthStatusTool, crmConnectSankaTool } from './crm-tools';

const DEFAULT_STREAMABLE_PATH = '/mcp';
const DEFAULT_AUTHORIZATION_METADATA_PATH = '/.well-known/oauth-authorization-server';
const DEFAULT_OPENID_CONFIGURATION_PATH = '/.well-known/openid-configuration';
const DEFAULT_METADATA_PATH = '/.well-known/oauth-protected-resource';
const DEFAULT_METADATA_ALIAS_PATH = '/.well-known/oauth-protected-resource/mcp';
const DEFAULT_AUTHORIZATION_SERVER_URL = 'https://app.sanka.com';
const OAUTH_AUTHORIZE_PATH = '/oauth/authorize';
const OAUTH_TOKEN_PATH = '/oauth/token';
const OAUTH_REGISTER_PATH = '/oauth/register';
const OAUTH_REVOKE_PATH = '/oauth/revoke';
const OAUTH_JWKS_PATH = '/oauth/jwks.json';
const STREAMABLE_HTTP_PATHS = ['/', DEFAULT_STREAMABLE_PATH, '/sse'];
const AUTHORIZATION_METADATA_PATHS = [
  DEFAULT_AUTHORIZATION_METADATA_PATH,
  `${DEFAULT_AUTHORIZATION_METADATA_PATH}${DEFAULT_STREAMABLE_PATH}`,
  `${DEFAULT_STREAMABLE_PATH}${DEFAULT_AUTHORIZATION_METADATA_PATH}`,
];
const OPENID_CONFIGURATION_PATHS = [
  DEFAULT_OPENID_CONFIGURATION_PATH,
  `${DEFAULT_OPENID_CONFIGURATION_PATH}${DEFAULT_STREAMABLE_PATH}`,
  `${DEFAULT_STREAMABLE_PATH}${DEFAULT_OPENID_CONFIGURATION_PATH}`,
];
const PROTECTED_RESOURCE_METADATA_PATHS = [
  DEFAULT_METADATA_PATH,
  DEFAULT_METADATA_ALIAS_PATH,
  `${DEFAULT_STREAMABLE_PATH}${DEFAULT_METADATA_PATH}`,
];
const TOOL_ACCESS_REQUIREMENTS: Record<
  string,
  {
    authenticationRequired: boolean;
    requiredScopes?: string[];
  }
> = {
  connect_sanka: { authenticationRequired: false },
  auth_status: { authenticationRequired: false },
  list_private_messages: { authenticationRequired: true },
  sync_private_messages: { authenticationRequired: true },
  get_private_message_thread: { authenticationRequired: true },
  reply_private_message_thread: { authenticationRequired: true },
  archive_private_message_thread: { authenticationRequired: true },
  list_companies: { authenticationRequired: true },
  get_company: { authenticationRequired: true },
  create_company: { authenticationRequired: true },
  update_company: { authenticationRequired: true },
  delete_company: { authenticationRequired: true },
  get_company_price_table: { authenticationRequired: true },
  update_company_price_table_company: { authenticationRequired: true },
  update_company_price_table_item: { authenticationRequired: true },
  apply_company_price_table_items: { authenticationRequired: true },
  list_contacts: { authenticationRequired: true },
  get_contact: { authenticationRequired: true },
  create_contact: { authenticationRequired: true },
  update_contact: { authenticationRequired: true },
  delete_contact: { authenticationRequired: true },
  list_deals: { authenticationRequired: true },
  get_deal: { authenticationRequired: true },
  create_deal: { authenticationRequired: true },
  update_deal: { authenticationRequired: true },
  delete_deal: { authenticationRequired: true },
  list_deal_pipelines: { authenticationRequired: true },
  list_items: { authenticationRequired: true },
  get_item: { authenticationRequired: true },
  create_item: { authenticationRequired: true },
  update_item: { authenticationRequired: true },
  delete_item: { authenticationRequired: true },
  list_orders: { authenticationRequired: true },
  get_order: { authenticationRequired: true },
  download_order_pdf: { authenticationRequired: true },
  create_order: { authenticationRequired: true },
  update_order: { authenticationRequired: true },
  delete_order: { authenticationRequired: true },
  list_tasks: { authenticationRequired: true },
  get_task: { authenticationRequired: true },
  create_task: { authenticationRequired: true },
  update_task: { authenticationRequired: true },
  delete_task: { authenticationRequired: true },
  list_estimates: { authenticationRequired: true },
  get_estimate: { authenticationRequired: true },
  download_estimate_pdf: { authenticationRequired: true },
  create_estimate: { authenticationRequired: true },
  update_estimate: { authenticationRequired: true },
  delete_estimate: { authenticationRequired: true },
  list_invoices: { authenticationRequired: true },
  list_overdue_invoices: { authenticationRequired: true },
  get_invoice: { authenticationRequired: true },
  download_invoice_pdf: { authenticationRequired: true },
  create_invoice: { authenticationRequired: true },
  update_invoice: { authenticationRequired: true },
  delete_invoice: { authenticationRequired: true },
  list_subscriptions: { authenticationRequired: true },
  get_subscription: { authenticationRequired: true },
  create_subscription: { authenticationRequired: true },
  update_subscription: { authenticationRequired: true },
  delete_subscription: { authenticationRequired: true },
  list_payments: { authenticationRequired: true },
  get_payment: { authenticationRequired: true },
  create_payment: { authenticationRequired: true },
  update_payment: { authenticationRequired: true },
  delete_payment: { authenticationRequired: true },
  download_payment_pdf: { authenticationRequired: true },
  download_slip_pdf: { authenticationRequired: true },
  list_tickets: { authenticationRequired: true },
  get_ticket: { authenticationRequired: true },
  create_ticket: { authenticationRequired: true },
  update_ticket: { authenticationRequired: true },
  delete_ticket: { authenticationRequired: true },
  list_ticket_pipelines: { authenticationRequired: true },
  update_ticket_status: { authenticationRequired: true },
  list_locations: { authenticationRequired: true },
  get_location: { authenticationRequired: true },
  create_location: { authenticationRequired: true },
  update_location: { authenticationRequired: true },
  delete_location: { authenticationRequired: true },
  list_inventories: { authenticationRequired: true },
  get_inventory: { authenticationRequired: true },
  create_inventory: { authenticationRequired: true },
  update_inventory: { authenticationRequired: true },
  delete_inventory: { authenticationRequired: true },
  list_inventory_transactions: { authenticationRequired: true },
  get_inventory_transaction: { authenticationRequired: true },
  create_inventory_transaction: { authenticationRequired: true },
  update_inventory_transaction: { authenticationRequired: true },
  delete_inventory_transaction: { authenticationRequired: true },
  list_expenses: { authenticationRequired: true },
  get_expense: { authenticationRequired: true },
  upload_expense_attachment: { authenticationRequired: true },
  create_expense: { authenticationRequired: true },
  update_expense: { authenticationRequired: true },
  delete_expense: { authenticationRequired: true },
  list_properties: { authenticationRequired: true },
  get_property: { authenticationRequired: true },
  create_property: { authenticationRequired: true },
  update_property: { authenticationRequired: true },
  delete_property: { authenticationRequired: true },
  get_calendar_bootstrap: { authenticationRequired: true },
  check_calendar_availability: { authenticationRequired: true },
  create_calendar_attendance: { authenticationRequired: true },
  cancel_calendar_attendance: { authenticationRequired: true },
  reschedule_calendar_attendance: { authenticationRequired: true },
  prospect_companies: { authenticationRequired: true },
  score_record: { authenticationRequired: true },
  upload_import_file: { authenticationRequired: true },
  import_records: { authenticationRequired: true },
  get_import_job: { authenticationRequired: true },
  list_import_jobs: { authenticationRequired: true },
  cancel_import_job: { authenticationRequired: true },
  list_integration_channels: { authenticationRequired: true },
  export_records: { authenticationRequired: true },
  get_export_job: { authenticationRequired: true },
  list_export_jobs: { authenticationRequired: true },
  cancel_export_job: { authenticationRequired: true },
};

const INLINE_TOOL_HANDLERS = {
  auth_status: crmAuthStatusTool,
  connect_sanka: crmConnectSankaTool,
} as const;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createRequestTransport = async ({
  clientOptions,
  mcpOptions,
  req,
  res,
  toolProfile,
}: {
  clientOptions: ClientOptions;
  mcpOptions: McpOptions;
  req: express.Request;
  res: express.Response;
  toolProfile: ToolProfile;
}): Promise<{
  auth: Awaited<ReturnType<typeof resolveClientAuth>>;
  generatedSessionId?: string | undefined;
  mcpSessionId: string;
  server: McpServer;
  transport: StreamableHTTPServerTransport;
} | null> => {
  const incomingSessionId = extractMcpSessionId(req.headers);
  const mcpSessionId = incomingSessionId || generateMcpSessionId();
  const customInstructionsPath = mcpOptions.customInstructionsPath;
  const server = await newMcpServer({ customInstructionsPath, toolProfile });

  // Parse client permission override headers.
  //
  // Note: Permissions are best-effort and intended to prevent clients from doing unexpected things;
  // they're not a hard security boundary, so we allow arbitrary, client-driven overrides.
  let effectiveMcpOptions = mcpOptions;
  const clientPermissionsHeader =
    req.headers['x-sanka-mcp-client-permissions'] ?? req.headers['x-stainless-mcp-client-permissions'];
  if (typeof clientPermissionsHeader === 'string') {
    try {
      const parsed = JSON.parse(clientPermissionsHeader);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        effectiveMcpOptions = {
          ...mcpOptions,
          ...(typeof parsed.allow_http_gets === 'boolean' && { codeAllowHttpGets: parsed.allow_http_gets }),
          ...(Array.isArray(parsed.allowed_methods) && { codeAllowedMethods: parsed.allowed_methods }),
          ...(Array.isArray(parsed.blocked_methods) && { codeBlockedMethods: parsed.blocked_methods }),
        };
        getLogger().info(
          { clientPermissions: parsed },
          'Overriding code execution permissions from client permissions header',
        );
      }
    } catch (error) {
      getLogger().warn({ error }, 'Failed to parse client permissions header');
    }
  }

  const { resourceUrl, resourceMetadataUrl } = requestResourceUrls(req, effectiveMcpOptions);
  let resolvedAuth: Awaited<ReturnType<typeof resolveClientAuth>>;
  try {
    resolvedAuth = await resolveClientAuth({
      advertisedAuthorizationServerUrl: requestAuthorizationServerUrl(req),
      mcpOptions: effectiveMcpOptions,
      mcpSessionId,
      req,
      resourceMetadataUrl,
      resourceUrl,
    });
  } catch (error) {
    if (error instanceof OAuthChallengeError) {
      if (!incomingSessionId) {
        res.setHeader('mcp-session-id', mcpSessionId);
      }
      res.setHeader('WWW-Authenticate', error.wwwAuthenticate);
      res.status(error.statusCode).json({
        error: 'authentication_failed',
        error_description: error.message,
      });
      return null;
    }
    throw error;
  }

  const transport = new StreamableHTTPServerTransport();

  await initMcpServer({
    server,
    mcpOptions: effectiveMcpOptions,
    clientOptions: {
      ...clientOptions,
      ...resolvedAuth.clientOptions,
    },
    mcpSessionId,
    mcpClientInfo:
      typeof req.body?.params?.clientInfo?.name === 'string' ?
        { name: req.body.params.clientInfo.name, version: String(req.body.params.clientInfo.version ?? '') }
      : undefined,
    toolProfile,
    auth: resolvedAuth,
  });
  await server.connect(transport as any);

  return {
    server,
    transport,
    auth: resolvedAuth,
    generatedSessionId: incomingSessionId ? undefined : mcpSessionId,
    mcpSessionId,
  };
};

const getRequestAuthPreflight = ({
  auth,
  body,
}: {
  auth: Awaited<ReturnType<typeof resolveClientAuth>>;
  body: unknown;
}):
  | {
      error: string;
      errorDescription: string;
      statusCode: number;
      wwwAuthenticate: string;
    }
  | undefined => {
  const messages = Array.isArray(body) ? body : [body];

  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      continue;
    }

    const method = (message as { method?: unknown }).method;

    if (method !== 'tools/call') {
      continue;
    }

    const params = (message as { params?: { name?: unknown } }).params;
    const toolName = typeof params?.name === 'string' ? params.name : undefined;
    if (!toolName) {
      continue;
    }

    const accessRequirements = TOOL_ACCESS_REQUIREMENTS[toolName];
    if (!accessRequirements?.authenticationRequired) {
      continue;
    }

    if (auth.authMode === 'api_key' || auth.authMode === 'mcp_session') {
      continue;
    }

    if (auth.authMode === 'none') {
      const description = `Authentication required to use ${toolName}.`;
      return {
        error: 'authentication_required',
        errorDescription: description,
        statusCode: 401,
        wwwAuthenticate: buildOAuthWwwAuthenticateHeader({
          authorizationServerUrl: auth.oauth.authorizationServerUrl,
          description,
          error: 'invalid_token',
          resourceMetadataUrl: auth.oauth.resourceMetadataUrl,
        }),
      };
    }

    const requiredScopes = accessRequirements.requiredScopes ?? [];
    if (requiredScopes.length === 0) {
      continue;
    }

    const grantedScopes = new Set(auth.oauth.scopes);
    if (grantedScopes.size === 0 && auth.authMode === 'legacy_oauth_jwt') {
      continue;
    }

    const missingScopes = resolveMissingScopes({
      grantedScopes,
      requiredScopes,
    });
    if (missingScopes.length === 0) {
      continue;
    }

    const description = `${toolName} requires the following OAuth scopes: ${missingScopes.join(', ')}.`;
    return {
      error: 'insufficient_scope',
      errorDescription: description,
      statusCode: 403,
      wwwAuthenticate: buildOAuthWwwAuthenticateHeader({
        authorizationServerUrl: auth.oauth.authorizationServerUrl,
        description,
        error: 'insufficient_scope',
        resourceMetadataUrl: auth.oauth.resourceMetadataUrl,
        scope: missingScopes.join(' '),
      }),
    };
  }

  return undefined;
};

const singleHeader = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const requestOrigin = (req: express.Request): string => {
  const forwardedProto = singleHeader(req.headers['x-forwarded-proto'])?.split(',')[0]?.trim();
  const forwardedHost = singleHeader(req.headers['x-forwarded-host'])?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host');
  return `${protocol}://${host}`;
};

const requestResourceUrls = (req: express.Request, mcpOptions: McpOptions) => {
  return {
    resourceUrl: mcpOptions.resourceUrl || new URL(DEFAULT_STREAMABLE_PATH, requestOrigin(req)).toString(),
    resourceMetadataUrl: new URL(DEFAULT_METADATA_PATH, requestOrigin(req)).toString(),
  };
};

const requestAuthorizationServerUrl = (req: express.Request): string => requestOrigin(req);

const upstreamAuthorizationServerUrl = (mcpOptions: McpOptions): string =>
  mcpOptions.authorizationServerUrl || DEFAULT_AUTHORIZATION_SERVER_URL;

const buildAuthorizationServerMetadata = ({
  authorizationServerUrl,
  scopesSupported,
}: {
  authorizationServerUrl: string;
  scopesSupported?: string[] | undefined;
}) => ({
  issuer: authorizationServerUrl,
  authorization_endpoint: `${authorizationServerUrl}${OAUTH_AUTHORIZE_PATH}`,
  token_endpoint: `${authorizationServerUrl}${OAUTH_TOKEN_PATH}`,
  revocation_endpoint: `${authorizationServerUrl}${OAUTH_REVOKE_PATH}`,
  jwks_uri: `${authorizationServerUrl}${OAUTH_JWKS_PATH}`,
  registration_endpoint: `${authorizationServerUrl}${OAUTH_REGISTER_PATH}`,
  response_types_supported: ['code'],
  response_modes_supported: ['query'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_methods_supported: ['none'],
  revocation_endpoint_auth_methods_supported: ['none'],
  code_challenge_methods_supported: ['S256'],
  client_id_metadata_document_supported: false,
  ...(scopesSupported && scopesSupported.length > 0 ? { scopes_supported: scopesSupported } : {}),
});

const filteredProxyRequestHeaders = (req: express.Request): Headers => {
  const headers = new Headers();
  const blockedHeaders = new Set(['connection', 'content-length', 'host']);
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || blockedHeaders.has(key.toLowerCase())) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }
    headers.set(key, value);
  }
  return headers;
};

const filteredProxyResponseHeaders = (response: Response): Record<string, string> => {
  const headers: Record<string, string> = {};
  const blockedHeaders = new Set(['connection', 'content-encoding', 'content-length', 'transfer-encoding']);
  response.headers.forEach((value, key) => {
    if (!blockedHeaders.has(key.toLowerCase())) {
      headers[key] = value;
    }
  });
  return headers;
};

const serializeProxyRequestBody = (req: express.Request): string | undefined => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return undefined;
  }

  const contentType = singleHeader(req.headers['content-type']) || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams();
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    for (const [key, value] of Object.entries(body)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          params.append(key, String(item));
        }
      } else if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    return params.toString();
  }

  if (typeof req.body === 'string') {
    return req.body;
  }

  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return JSON.stringify(req.body);
  }

  return undefined;
};

const proxyOAuthRequest =
  ({ path, upstreamBaseUrl }: { path: string; upstreamBaseUrl: string }) =>
  async (req: express.Request, res: express.Response) => {
    const upstreamUrl = new URL(path, upstreamBaseUrl);
    upstreamUrl.search =
      req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const requestBody = serializeProxyRequestBody(req);

    const response = await fetch(upstreamUrl, {
      method: req.method,
      headers: filteredProxyRequestHeaders(req),
      redirect: 'manual',
      ...(requestBody !== undefined ? { body: requestBody } : {}),
    });

    res.status(response.status);
    res.set(filteredProxyResponseHeaders(response));
    const responseBody = Buffer.from(await response.arrayBuffer());
    res.send(responseBody);
  };

const requestProfile = (_req: express.Request): ToolProfile => 'hosted';

const maybeHandleInlineToolCall = async ({
  req,
  res,
  toolProfile,
  transportContext,
}: {
  req: express.Request;
  res: express.Response;
  toolProfile: ToolProfile;
  transportContext: Exclude<Awaited<ReturnType<typeof createRequestTransport>>, null>;
}): Promise<boolean> => {
  if (
    !isObjectRecord(req.body) ||
    req.body['method'] !== 'tools/call' ||
    !isObjectRecord(req.body['params']) ||
    typeof req.body['params']['name'] !== 'string'
  ) {
    return false;
  }

  const toolName = req.body['params']['name'];
  const inlineTool = INLINE_TOOL_HANDLERS[toolName as keyof typeof INLINE_TOOL_HANDLERS];
  if (!inlineTool) {
    return false;
  }

  const result = await executeHandler({
    handler: inlineTool.handler,
    reqContext: {
      client: undefined as any,
      mcpSessionId: transportContext.mcpSessionId,
      toolProfile,
      auth: transportContext.auth,
    },
    args: isObjectRecord(req.body['params']['arguments']) ? req.body['params']['arguments'] : {},
  });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.send(
    `event: message\ndata: ${JSON.stringify({
      jsonrpc: '2.0',
      id: req.body['id'] ?? null,
      result,
    })}\n\n`,
  );
  return true;
};

const handleStreamableRequest =
  (options: { clientOptions: ClientOptions; mcpOptions: McpOptions }) =>
  async (req: express.Request, res: express.Response) => {
    const toolProfile = requestProfile(req);
    const transportContext = await createRequestTransport({ ...options, req, res, toolProfile });
    if (transportContext === null) {
      return;
    }

    if (transportContext.generatedSessionId) {
      res.setHeader('mcp-session-id', transportContext.generatedSessionId);
    }

    if (await maybeHandleInlineToolCall({ req, res, toolProfile, transportContext })) {
      return;
    }

    const authPreflight = getRequestAuthPreflight({
      auth: transportContext.auth,
      body: req.body,
    });
    if (authPreflight) {
      res.setHeader('WWW-Authenticate', authPreflight.wwwAuthenticate);
      res.status(authPreflight.statusCode).json({
        error: authPreflight.error,
        error_description: authPreflight.errorDescription,
      });
      return;
    }

    await transportContext.transport.handleRequest(req, res, req.body);
  };

const redactHeaders = (headers: Record<string, any>) => {
  const hiddenHeaders = /auth|cookie|key|token/i;
  const filtered = { ...headers };
  Object.keys(filtered).forEach((key) => {
    if (hiddenHeaders.test(key)) {
      filtered[key] = '[REDACTED]';
    }
  });
  return filtered;
};

export const streamableHTTPApp = ({
  clientOptions = {},
  mcpOptions,
}: {
  clientOptions?: ClientOptions;
  mcpOptions: McpOptions;
}): express.Express => {
  const app = express();
  app.set('query parser', 'extended');
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(
    pinoHttp({
      logger: getLogger(),
      customLogLevel: (req, res) => {
        if (res.statusCode >= 500) {
          return 'error';
        } else if (res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
      customSuccessMessage: function (req, res) {
        return `Request ${req.method} to ${req.url} completed with status ${res.statusCode}`;
      },
      customErrorMessage: function (req, res, err) {
        return `Request ${req.method} to ${req.url} errored with status ${res.statusCode}`;
      },
      serializers: {
        req: pino.stdSerializers.wrapRequestSerializer((req) => {
          return {
            ...req,
            headers: redactHeaders(req.raw.headers),
          };
        }),
        res: pino.stdSerializers.wrapResponseSerializer((res) => {
          return {
            ...res,
            headers: redactHeaders(res.headers),
          };
        }),
      },
    }),
  );

  app.get('/health', async (req: express.Request, res: express.Response) => {
    res.status(200).send('OK');
  });
  const sendAuthorizationServerMetadata = async (req: express.Request, res: express.Response) => {
    res.status(200).json(
      buildAuthorizationServerMetadata({
        authorizationServerUrl: requestAuthorizationServerUrl(req),
        scopesSupported: mcpOptions.scopesSupported,
      }),
    );
  };
  const sendProtectedResourceMetadata = async (req: express.Request, res: express.Response) => {
    const { resourceUrl } = requestResourceUrls(req, mcpOptions);
    res.status(200).json(
      buildProtectedResourceMetadata({
        resource: resourceUrl,
        authorizationServerUrl: requestAuthorizationServerUrl(req),
        resourceName: 'Sanka MCP Server',
        scopesSupported: mcpOptions.scopesSupported,
      }),
    );
  };
  for (const routePath of AUTHORIZATION_METADATA_PATHS) {
    app.get(routePath, sendAuthorizationServerMetadata);
  }
  for (const routePath of OPENID_CONFIGURATION_PATHS) {
    app.get(routePath, sendAuthorizationServerMetadata);
  }
  for (const routePath of PROTECTED_RESOURCE_METADATA_PATHS) {
    app.get(routePath, sendProtectedResourceMetadata);
  }
  app.get(OAUTH_AUTHORIZE_PATH, (req: express.Request, res: express.Response) => {
    const upstreamUrl = new URL(req.originalUrl, upstreamAuthorizationServerUrl(mcpOptions));
    res.redirect(302, upstreamUrl.toString());
  });
  app.get(
    OAUTH_JWKS_PATH,
    proxyOAuthRequest({ path: OAUTH_JWKS_PATH, upstreamBaseUrl: upstreamAuthorizationServerUrl(mcpOptions) }),
  );
  app.post(
    OAUTH_TOKEN_PATH,
    proxyOAuthRequest({
      path: OAUTH_TOKEN_PATH,
      upstreamBaseUrl: upstreamAuthorizationServerUrl(mcpOptions),
    }),
  );
  app.post(
    OAUTH_REGISTER_PATH,
    proxyOAuthRequest({
      path: OAUTH_REGISTER_PATH,
      upstreamBaseUrl: upstreamAuthorizationServerUrl(mcpOptions),
    }),
  );
  app.post(
    OAUTH_REVOKE_PATH,
    proxyOAuthRequest({
      path: OAUTH_REVOKE_PATH,
      upstreamBaseUrl: upstreamAuthorizationServerUrl(mcpOptions),
    }),
  );
  const streamableHandler = handleStreamableRequest({ clientOptions, mcpOptions });
  for (const routePath of STREAMABLE_HTTP_PATHS) {
    app.get(routePath, streamableHandler);
    app.post(routePath, streamableHandler);
    app.delete(routePath, streamableHandler);
  }

  return app;
};

export const launchStreamableHTTPServer = async ({
  mcpOptions,
  port,
}: {
  mcpOptions: McpOptions;
  port: number | string | undefined;
}) => {
  const app = streamableHTTPApp({ mcpOptions });
  const server = app.listen(port);
  const address = server.address();

  const logger = getLogger();

  if (typeof address === 'string') {
    logger.info(`MCP Server running on streamable HTTP at ${address}`);
  } else if (address !== null) {
    logger.info(`MCP Server running on streamable HTTP on port ${address.port}`);
  } else {
    logger.info(`MCP Server running on streamable HTTP on port ${port}`);
  }
};
