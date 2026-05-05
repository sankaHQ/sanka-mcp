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
import {
  buildMcpConnectMarkdownLink,
  buildMcpConnectStructuredReply,
  buildMcpConnectUserFacingReply,
  buildOAuthAuthorizationUrl,
  normalizeMcpConnectScopes,
} from './mcp-connect';
import { McpOptions } from './options';
import { ToolProfile } from './profile';
import { buildProtectedResourceMetadata } from './protected-resource-metadata';
import { executeHandler, initMcpServer, newMcpServer, selectTools } from './server';
import { resolveMissingScopes } from './tool-auth';
import { buildToolAccessRequirements } from './tool-scope-requirements';
import { crmAuthStatusTool, crmConnectSankaTool } from './crm-tools';

const DEFAULT_STREAMABLE_PATH = '/mcp';
const DEFAULT_AUTHORIZATION_METADATA_PATH = '/.well-known/oauth-authorization-server';
const DEFAULT_OPENID_CONFIGURATION_PATH = '/.well-known/openid-configuration';
const DEFAULT_METADATA_PATH = '/.well-known/oauth-protected-resource';
const DEFAULT_METADATA_ALIAS_PATH = '/.well-known/oauth-protected-resource/mcp';
const DEFAULT_AUTHORIZATION_SERVER_URL = 'https://app.sanka.com';
const OAUTH_AUTHORIZE_PATH = '/oauth/authorize';
const OAUTH_TOKEN_PATH = '/api/v1/oauth/token';
const OAUTH_REVOKE_PATH = '/api/v1/oauth/revoke';
const DEFAULT_SCOPES_SUPPORTED = ['user-scope', 'api-access'];
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
const INLINE_TOOL_HANDLERS = {
  auth_status: crmAuthStatusTool,
  connect_sanka: crmConnectSankaTool,
} as const;
const RECONNECT_RPC_METHOD = 'mcpServer/oauth/login';
const RECONNECT_SERVER_NAME = 'sanka';
const RECONNECT_INSTRUCTIONS =
  'If connect_url is present, the assistant must include required_user_facing_reply in the next visible response. Do not omit the URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. In clients with native OAuth UI, that UI may also be used, then retry.';
const MCP_CLIENT_INFO_CACHE_MAX = 1000;

const mcpClientInfoBySessionId = new Map<string, { name: string; version: string }>();

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toolCallName = (body: unknown): string | undefined => {
  if (!isObjectRecord(body) || body['method'] !== 'tools/call' || !isObjectRecord(body['params'])) {
    return undefined;
  }
  const name = body['params']['name'];
  return typeof name === 'string' ? name : undefined;
};

const appendReconnectInstructions = ({
  authorizationUrl,
  connectUrl,
  message,
  resourceMetadataUrl,
}: {
  authorizationUrl: string;
  connectUrl?: string | undefined;
  message: string;
  resourceMetadataUrl: string;
}): string =>
  [
    message,
    connectUrl ? `Connect Sanka: ${buildMcpConnectMarkdownLink(connectUrl)}` : undefined,
    connectUrl ?
      `Required user-facing reply: ${buildMcpConnectUserFacingReply(connectUrl).replace(/\s+/g, ' ')}`
    : undefined,
    `OAuth authorization URL: ${authorizationUrl}`,
    `MCP resource metadata URL: ${resourceMetadataUrl}`,
    RECONNECT_INSTRUCTIONS,
  ]
    .filter(Boolean)
    .join(' ');

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

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
  mcpClientInfo?: { name: string; version: string } | undefined;
  mcpSessionId: string;
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  toolAccessRequirements: Record<
    string,
    {
      authenticationRequired: boolean;
      requiredScopes: string[];
    }
  >;
} | null> => {
  const incomingSessionId = extractMcpSessionId(req.headers);
  const mcpSessionId = incomingSessionId || generateMcpSessionId();
  const requestMcpClientInfo = extractRequestMcpClientInfo(req);
  if (requestMcpClientInfo) {
    rememberMcpClientInfo(mcpSessionId, requestMcpClientInfo);
  }
  const mcpClientInfo = requestMcpClientInfo ?? mcpClientInfoBySessionId.get(mcpSessionId);
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
  const requestedToolName = toolCallName(req.body);
  let resolvedAuth: Awaited<ReturnType<typeof resolveClientAuth>>;
  try {
    resolvedAuth = await resolveClientAuth({
      mcpSessionId,
      mcpSessionIdForExchange: requestedToolName ? incomingSessionId : undefined,
      mcpOptions: effectiveMcpOptions,
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
    mcpClientInfo,
    toolProfile,
    auth: resolvedAuth,
  });
  await server.connect(transport as any);

  const selectedTools = selectTools(effectiveMcpOptions, toolProfile);
  const argsByToolName =
    (
      isObjectRecord(req.body) &&
      req.body['method'] === 'tools/call' &&
      isObjectRecord(req.body['params']) &&
      typeof req.body['params']['name'] === 'string'
    ) ?
      {
        [req.body['params']['name']]:
          isObjectRecord(req.body['params']['arguments']) ? req.body['params']['arguments'] : undefined,
      }
    : undefined;

  return {
    server,
    transport,
    auth: resolvedAuth,
    generatedSessionId: incomingSessionId ? undefined : mcpSessionId,
    mcpClientInfo,
    mcpSessionId,
    toolAccessRequirements: buildToolAccessRequirements({
      tools: selectedTools,
      argsByToolName,
    }),
  };
};

const getRequestAuthPreflight = ({
  auth,
  body,
  toolAccessRequirements,
}: {
  auth: Awaited<ReturnType<typeof resolveClientAuth>>;
  body: unknown;
  toolAccessRequirements: Record<
    string,
    {
      authenticationRequired: boolean;
      requiredScopes: string[];
    }
  >;
}):
  | {
      error: string;
      errorDescription: string;
      reconnectMetadata?: {
        authorization_server_url: string;
        authorization_url: string;
        connect_url?: string | undefined;
        connect_scopes?: string[] | undefined;
        connect_url_markdown?: string | undefined;
        required_user_facing_reply?: string | undefined;
        resource_metadata_url: string;
        resource_url: string;
        reconnect_instructions: string;
        reconnect_mode: 'client_native_oauth';
        reconnect_rpc_method: typeof RECONNECT_RPC_METHOD;
        reconnect_server_name: typeof RECONNECT_SERVER_NAME;
      };
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

    const accessRequirements = toolAccessRequirements[toolName];
    if (!accessRequirements?.authenticationRequired) {
      continue;
    }

    if (auth.authMode === 'none') {
      const connectUrl = auth.oauth.connectUrlForScopes?.(accessRequirements.requiredScopes);
      const connectScopes = normalizeMcpConnectScopes(accessRequirements.requiredScopes);
      const authorizationUrl = buildOAuthAuthorizationUrl(auth.oauth.authorizationServerUrl);
      const description = appendReconnectInstructions({
        authorizationUrl,
        connectUrl,
        message: `Authentication required to use ${toolName}.`,
        resourceMetadataUrl: auth.oauth.resourceMetadataUrl,
      });
      return {
        error: 'authentication_required',
        errorDescription: description,
        reconnectMetadata: {
          authorization_server_url: auth.oauth.authorizationServerUrl,
          authorization_url: authorizationUrl,
          ...(connectUrl ?
            {
              connect_url: connectUrl,
              connect_scopes: connectScopes,
              ...buildMcpConnectStructuredReply(connectUrl),
            }
          : undefined),
          resource_metadata_url: auth.oauth.resourceMetadataUrl,
          resource_url: auth.oauth.resourceUrl,
          reconnect_instructions: RECONNECT_INSTRUCTIONS,
          reconnect_mode: 'client_native_oauth',
          reconnect_rpc_method: RECONNECT_RPC_METHOD,
          reconnect_server_name: RECONNECT_SERVER_NAME,
        },
        statusCode: 401,
        wwwAuthenticate: buildOAuthWwwAuthenticateHeader({
          authorizationServerUrl: auth.oauth.authorizationServerUrl,
          description,
          error: 'invalid_token',
          resourceMetadataUrl: auth.oauth.resourceMetadataUrl,
        }),
      };
    }

    const requiredScopes = accessRequirements.requiredScopes;
    if (requiredScopes.length === 0) {
      continue;
    }

    const grantedScopes = new Set(auth.oauth.scopes);
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

const acceptsEventStream = (req: express.Request): boolean =>
  (singleHeader(req.headers.accept)?.toLowerCase() ?? '')
    .split(',')
    .map((acceptType) => acceptType.split(';')[0]?.trim())
    .includes('text/event-stream');

const extractRequestMcpClientInfo = (req: express.Request): { name: string; version: string } | undefined => {
  const params =
    isObjectRecord(req.body) && isObjectRecord(req.body['params']) ? req.body['params'] : undefined;
  const clientInfo = params && isObjectRecord(params['clientInfo']) ? params['clientInfo'] : undefined;
  const name = typeof clientInfo?.['name'] === 'string' ? clientInfo['name'].trim() : '';
  if (!name) {
    return undefined;
  }
  return {
    name,
    version: String(clientInfo?.['version'] ?? ''),
  };
};

const rememberMcpClientInfo = (sessionId: string, clientInfo: { name: string; version: string }): void => {
  if (
    !mcpClientInfoBySessionId.has(sessionId) &&
    mcpClientInfoBySessionId.size >= MCP_CLIENT_INFO_CACHE_MAX
  ) {
    const oldestSessionId = mcpClientInfoBySessionId.keys().next().value;
    if (oldestSessionId) {
      mcpClientInfoBySessionId.delete(oldestSessionId);
    }
  }
  mcpClientInfoBySessionId.set(sessionId, clientInfo);
};

const valueLooksLikeCodex = (value: string | undefined): boolean => /\bcodex\b/i.test(value ?? '');

const requestLooksLikeCodex = ({
  mcpClientInfo,
  req,
}: {
  mcpClientInfo?: { name: string; version: string } | undefined;
  req: express.Request;
}): boolean =>
  [
    mcpClientInfo?.name,
    mcpClientInfo?.version,
    singleHeader(req.headers['user-agent']),
    singleHeader(req.headers['x-openai-client']),
    singleHeader(req.headers['x-codex-client']),
  ].some(valueLooksLikeCodex);

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

const upstreamAuthorizationServerUrl = (mcpOptions: McpOptions): string =>
  stripTrailingSlash(mcpOptions.authorizationServerUrl || DEFAULT_AUTHORIZATION_SERVER_URL);

const resolveAdvertisedScopesSupported = (mcpOptions: McpOptions): string[] =>
  mcpOptions.scopesSupported && mcpOptions.scopesSupported.length > 0 ?
    mcpOptions.scopesSupported
  : DEFAULT_SCOPES_SUPPORTED;

export const buildAuthorizationServerMetadata = ({
  authorizationServerUrl,
  oauthClientId,
  scopesSupported,
}: {
  authorizationServerUrl: string;
  oauthClientId?: string | undefined;
  scopesSupported?: string[] | undefined;
}) => ({
  issuer: authorizationServerUrl,
  authorization_endpoint: `${authorizationServerUrl}${OAUTH_AUTHORIZE_PATH}`,
  token_endpoint: `${authorizationServerUrl}${OAUTH_TOKEN_PATH}`,
  revocation_endpoint: `${authorizationServerUrl}${OAUTH_REVOKE_PATH}`,
  response_types_supported: ['code'],
  response_modes_supported: ['query'],
  grant_types_supported: ['authorization_code'],
  token_endpoint_auth_methods_supported: ['none'],
  revocation_endpoint_auth_methods_supported: ['none'],
  code_challenge_methods_supported: ['S256'],
  client_id_metadata_document_supported: false,
  ...(oauthClientId ? { client_id: oauthClientId } : {}),
  ...(scopesSupported && scopesSupported.length > 0 ? { scopes_supported: scopesSupported } : {}),
});

const requestProfile = (_req: express.Request): ToolProfile => 'hosted';

const shouldReturnToolResultAuthFallback = ({
  mcpClientInfo,
  mcpOptions,
  req,
  toolProfile,
}: {
  mcpClientInfo?: { name: string; version: string } | undefined;
  mcpOptions: McpOptions;
  req: express.Request;
  toolProfile: ToolProfile;
}): boolean =>
  mcpOptions.streamableAuthFallback === 'tool_result' &&
  toolProfile === 'hosted' &&
  acceptsEventStream(req) &&
  !requestLooksLikeCodex({ mcpClientInfo, req });

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
      mcpClientInfo: transportContext.mcpClientInfo,
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
      toolAccessRequirements: transportContext.toolAccessRequirements,
    });
    if (authPreflight) {
      if (
        authPreflight.error === 'authentication_required' &&
        transportContext.auth.authMode === 'none' &&
        shouldReturnToolResultAuthFallback({
          mcpClientInfo: transportContext.mcpClientInfo,
          mcpOptions: options.mcpOptions,
          req,
          toolProfile,
        })
      ) {
        await transportContext.transport.handleRequest(req, res, req.body);
        return;
      }
      res.setHeader('WWW-Authenticate', authPreflight.wwwAuthenticate);
      res.status(authPreflight.statusCode).json({
        error: authPreflight.error,
        error_description: authPreflight.errorDescription,
        ...authPreflight.reconnectMetadata,
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
  const sendAuthorizationServerMetadata = async (_req: express.Request, res: express.Response) => {
    const authorizationServerUrl = upstreamAuthorizationServerUrl(mcpOptions);
    res.status(200).json(
      buildAuthorizationServerMetadata({
        authorizationServerUrl,
        oauthClientId: mcpOptions.oauthClientId,
        scopesSupported: resolveAdvertisedScopesSupported(mcpOptions),
      }),
    );
  };
  const sendProtectedResourceMetadata = async (req: express.Request, res: express.Response) => {
    const { resourceUrl } = requestResourceUrls(req, mcpOptions);
    const authorizationServerUrl = upstreamAuthorizationServerUrl(mcpOptions);
    res.status(200).json(
      buildProtectedResourceMetadata({
        resource: resourceUrl,
        authorizationServerUrl,
        resourceName: 'Sanka MCP Server',
        scopesSupported: resolveAdvertisedScopesSupported(mcpOptions),
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
