// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ClientOptions } from 'sanka-sdk';
import express from 'express';
import {
  buildOAuthWwwAuthenticateHeader,
  extractMcpSessionId,
  generateMcpSessionId,
  OAuthChallengeError,
  resolveClientAuth,
} from './auth';
import {
  reconnectServerNameHintFromHeaders,
  resolveReconnectServerName,
} from './reconnect-name';
import { getLogger } from './logger';
import {
  buildMcpConnectMarkdownLink,
  buildMcpConnectStructuredReply,
  buildMcpConnectUserFacingReply,
  buildOAuthAuthorizationUrl,
  normalizeMcpConnectScopes,
} from './mcp-connect';
import {
  McpClientInfo,
  mcpClientLooksLikeNativeOAuthClient,
  valueLooksLikeClaude,
  valueLooksLikeCodex,
  valueLooksLikeNativeOAuthClient,
} from './mcp-client-info';
import { McpOptions } from './options';
import { ToolProfile } from './profile';
import { expressErrorLogger, expressRequestLogger } from './http-logging';
import { buildProtectedResourceMetadata } from './protected-resource-metadata';
import { executeHandler, initMcpServer, newMcpServer } from './server';
import { resolveMissingScopes } from './tool-auth';
import {
  buildToolAccessRequirements,
  SANKA_API_ACCESS_SCOPE,
  SANKA_MCP_ACCESS_SCOPE,
  SANKA_MCP_DELEGATED_SCOPES,
} from './tool-scope-requirements';
import { crmAuthStatusTool, crmConnectSankaTool } from './crm-tools';
import { readBinaryDownloadFile } from './binary-download-store';
import type { McpRequestContext } from './types';

const DEFAULT_STREAMABLE_PATH = '/mcp';
const DEFAULT_AUTHORIZATION_METADATA_PATH = '/.well-known/oauth-authorization-server';
const DEFAULT_OPENID_CONFIGURATION_PATH = '/.well-known/openid-configuration';
const DEFAULT_METADATA_PATH = '/.well-known/oauth-protected-resource';
const DEFAULT_METADATA_ALIAS_PATH = '/.well-known/oauth-protected-resource/mcp';
const DEFAULT_AUTHORIZATION_SERVER_URL = 'https://app.sanka.com';
const OAUTH_AUTHORIZE_PATH = '/oauth/authorize';
const OAUTH_TOKEN_PATH = '/api/v1/oauth/token';
const OAUTH_REVOKE_PATH = '/api/v1/oauth/revoke';
const OAUTH_REGISTER_PATH = '/api/v1/oauth/register';
const DEFAULT_SCOPES_SUPPORTED = [
  SANKA_MCP_ACCESS_SCOPE,
  SANKA_API_ACCESS_SCOPE,
  ...SANKA_MCP_DELEGATED_SCOPES,
];
const STREAMABLE_HTTP_PATHS = ['/', DEFAULT_STREAMABLE_PATH, '/sse'];
const BINARY_DOWNLOAD_PATHS = [
  '/downloads/:downloadToken',
  `${DEFAULT_STREAMABLE_PATH}/downloads/:downloadToken`,
];
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

const MCP_JSON_BODY_LIMIT = '16mb';
const RECONNECT_INSTRUCTIONS =
  'If connect_url is present, the assistant must include required_user_facing_reply in the next visible response. Do not omit the URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. In clients with native OAuth UI, that UI may also be used, then retry.';
const MCP_CLIENT_INFO_CACHE_MAX = 1000;

const mcpClientInfoBySessionId = new Map<string, McpClientInfo>();

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toolCallName = (body: unknown): string | undefined => {
  if (!isObjectRecord(body) || body['method'] !== 'tools/call' || !isObjectRecord(body['params'])) {
    return undefined;
  }
  const name = body['params']['name'];
  return typeof name === 'string' ? name : undefined;
};

const jsonRpcMethod = (body: unknown): string | undefined => {
  if (!isObjectRecord(body)) {
    return undefined;
  }
  const method = body['method'];
  return typeof method === 'string' ? method : undefined;
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
  mcpClientInfo?: McpClientInfo | undefined;
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
  const requestMcpClientInfo = extractRequestMcpClientInfo(req) ?? inferRequestMcpClientInfo(req);
  const requestMcpProtocolVersion = extractRequestMcpProtocolVersion(req);
  const requestMcpEnvironment = extractRequestMcpEnvironment(req);
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

  const { tools: selectedTools } = await initMcpServer({
    server,
    mcpOptions: effectiveMcpOptions,
    clientOptions: {
      ...clientOptions,
      ...resolvedAuth.clientOptions,
    },
    mcpSessionId,
    mcpClientInfo,
    mcpProtocolVersion: requestMcpProtocolVersion,
    mcpRequestEnvironment: requestMcpEnvironment,
    toolProfile,
    auth: resolvedAuth,
    downloadBaseUrl: downloadBaseUrlFromResourceUrl(resourceUrl),
  });
  await server.connect(transport as any);

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
  reconnectServerName,
  toolAccessRequirements,
}: {
  auth: Awaited<ReturnType<typeof resolveClientAuth>>;
  body: unknown;
  reconnectServerName: string;
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
        reconnect_server_name: string;
      };
      nativeErrorDescription?: string | undefined;
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
      const nativeErrorDescription = `Authentication required to use ${toolName}.`;
      const connectUrl = auth.oauth.connectUrlForScopes?.(accessRequirements.requiredScopes);
      const connectScopes = normalizeMcpConnectScopes(accessRequirements.requiredScopes);
      const authorizationUrl = buildOAuthAuthorizationUrl(auth.oauth.authorizationServerUrl);
      const description = appendReconnectInstructions({
        authorizationUrl,
        connectUrl,
        message: nativeErrorDescription,
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
          reconnect_server_name: reconnectServerName,
        },
        nativeErrorDescription,
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

const extractRequestMcpClientInfo = (req: express.Request): McpClientInfo | undefined => {
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

const extractRequestMcpProtocolVersion = (req: express.Request): string | undefined => {
  const params =
    isObjectRecord(req.body) && isObjectRecord(req.body['params']) ? req.body['params'] : undefined;
  const bodyVersion = typeof params?.['protocolVersion'] === 'string' ? params['protocolVersion'].trim() : '';
  if (bodyVersion) {
    return bodyVersion;
  }
  return firstHeaderToken(
    singleHeader(req.headers['mcp-protocol-version']) ?? singleHeader(req.headers['x-mcp-protocol-version']),
  );
};

const firstHeaderToken = (value: string | undefined): string | undefined => {
  const normalized = value?.split(',')[0]?.trim();
  return normalized || undefined;
};

const cleanStringValue = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const readFirstMetaString = (
  meta: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined => {
  if (!meta) return undefined;
  for (const key of keys) {
    const value = cleanStringValue(meta[key]);
    if (value) return value;
  }
  return undefined;
};

const toolCallMeta = (req: express.Request): Record<string, unknown> | undefined => {
  if (!isObjectRecord(req.body) || req.body['method'] !== 'tools/call') return undefined;
  const params = isObjectRecord(req.body['params']) ? req.body['params'] : undefined;
  return params && isObjectRecord(params['_meta']) ? params['_meta'] : undefined;
};

const inferBrowserFromUserAgent = (userAgent: string | undefined): string | undefined => {
  const value = userAgent ?? '';
  if (!value.trim()) return undefined;
  if (valueLooksLikeCodex(value)) return 'Codex';
  if (valueLooksLikeClaude(value)) return 'Claude';
  if (/\bopenai\b/i.test(value)) return 'OpenAI';
  if (/\bchrome\//i.test(value)) return 'Chrome';
  if (/\bfirefox\//i.test(value)) return 'Firefox';
  if (/\bsafari\//i.test(value)) return 'Safari';
  if (/\bcurl\//i.test(value)) return 'curl';
  return undefined;
};

const inferOsFromUserAgent = (userAgent: string | undefined): string | undefined => {
  const value = userAgent ?? '';
  if (/\b(iPhone|iPad|iPod)\b/i.test(value)) return 'iOS';
  if (/\bAndroid\b/i.test(value)) return 'Android';
  if (/\bMacintosh\b|\bMac OS X\b/i.test(value)) return 'macOS';
  if (/\bWindows\b/i.test(value)) return 'Windows';
  if (/\bLinux\b/i.test(value)) return 'Linux';
  return undefined;
};

const inferDeviceTypeFromUserAgent = (userAgent: string | undefined): string | undefined => {
  const value = userAgent ?? '';
  if (/\b(iPad|Tablet)\b/i.test(value)) return 'tablet';
  if (/\b(Mobile|iPhone|Android)\b/i.test(value)) return 'mobile';
  if (value.trim()) return 'desktop';
  return undefined;
};

const inferModelProvider = (modelName: string | undefined): string | undefined => {
  const normalized = modelName?.trim();
  if (!normalized) return undefined;
  if (/\b(claude|opus|sonnet|haiku)\b/i.test(normalized)) return 'anthropic';
  if (/\b(gpt|openai|o\d)\b/i.test(normalized)) return 'openai';
  return undefined;
};

const extractRequestModelInfo = (
  req: express.Request,
): Pick<NonNullable<McpRequestContext['mcpRequestEnvironment']>, 'modelProvider' | 'modelName'> => {
  const meta = toolCallMeta(req);
  const metaModel = isObjectRecord(meta?.['model']) ? meta['model'] : undefined;
  const metaAi = isObjectRecord(meta?.['ai']) ? meta['ai'] : undefined;
  const metaLlm = isObjectRecord(meta?.['llm']) ? meta['llm'] : undefined;
  const modelName =
    firstHeaderToken(
      singleHeader(req.headers['x-sanka-ai-model']) ??
        singleHeader(req.headers['x-openai-model']) ??
        singleHeader(req.headers['openai-model']) ??
        singleHeader(req.headers['x-anthropic-model']) ??
        singleHeader(req.headers['x-claude-model']) ??
        singleHeader(req.headers['x-ai-model']) ??
        singleHeader(req.headers['x-model']),
    ) ??
    readFirstMetaString(meta, [
      'model_name',
      'modelName',
      'ai_model',
      'aiModel',
      'llm_model',
      'llmModel',
      'model',
    ]) ??
    readFirstMetaString(metaModel, ['name', 'id', 'model_name', 'modelName']) ??
    readFirstMetaString(metaAi, ['model', 'model_name', 'modelName']) ??
    readFirstMetaString(metaLlm, ['model', 'model_name', 'modelName']);
  const modelProvider =
    firstHeaderToken(
      singleHeader(req.headers['x-sanka-ai-provider']) ??
        singleHeader(req.headers['x-openai-provider']) ??
        singleHeader(req.headers['x-anthropic-provider']),
    ) ??
    readFirstMetaString(meta, [
      'model_provider',
      'modelProvider',
      'ai_provider',
      'aiProvider',
      'llm_provider',
      'llmProvider',
      'provider',
    ]) ??
    readFirstMetaString(metaModel, ['provider', 'model_provider', 'modelProvider']) ??
    readFirstMetaString(metaAi, ['provider', 'model_provider', 'modelProvider']) ??
    readFirstMetaString(metaLlm, ['provider', 'model_provider', 'modelProvider']) ??
    inferModelProvider(modelName);
  return { modelName, modelProvider };
};

const extractRequestMcpEnvironment = (req: express.Request): McpRequestContext['mcpRequestEnvironment'] => {
  const userAgent = singleHeader(req.headers['user-agent']);
  const ipAddress =
    firstHeaderToken(singleHeader(req.headers['fly-client-ip'])) ??
    firstHeaderToken(singleHeader(req.headers['cf-connecting-ip'])) ??
    firstHeaderToken(singleHeader(req.headers['true-client-ip'])) ??
    firstHeaderToken(singleHeader(req.headers['x-real-ip'])) ??
    firstHeaderToken(singleHeader(req.headers['x-forwarded-for'])) ??
    firstHeaderToken(req.ip) ??
    firstHeaderToken(req.socket.remoteAddress);
  const modelInfo = extractRequestModelInfo(req);
  const environment = {
    ipAddress,
    userAgent: userAgent?.trim() || undefined,
    browser: inferBrowserFromUserAgent(userAgent),
    os: inferOsFromUserAgent(userAgent),
    deviceType: inferDeviceTypeFromUserAgent(userAgent),
    ...modelInfo,
  };
  return Object.values(environment).some(Boolean) ? environment : undefined;
};

const inferRequestMcpClientInfo = (req: express.Request): McpClientInfo | undefined => {
  const openaiClient = singleHeader(req.headers['x-openai-client']);
  const codexClient = singleHeader(req.headers['x-codex-client']);
  const anthropicClient = singleHeader(req.headers['x-anthropic-client']);
  const claudeClient = singleHeader(req.headers['x-claude-client']);
  const userAgent = singleHeader(req.headers['user-agent']);
  const headerClientValues = [openaiClient, codexClient, anthropicClient, claudeClient, userAgent];
  const codexClientValue = headerClientValues.find(valueLooksLikeCodex);
  if (codexClientValue) {
    return {
      name: 'Codex',
      version: codexClientValue,
    };
  }
  if (anthropicClient || claudeClient || valueLooksLikeClaude(userAgent)) {
    const version = [anthropicClient, claudeClient, userAgent]
      .map((value) => cleanStringValue(value))
      .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
      .join(' / ');
    return {
      name: 'Claude',
      version,
    };
  }
  const claudeClientValue = headerClientValues.find(valueLooksLikeClaude);
  if (claudeClientValue) {
    return {
      name: 'Claude',
      version: claudeClientValue,
    };
  }
  return undefined;
};

export const __testing = {
  extractRequestModelInfo,
  inferRequestMcpClientInfo,
};

const rememberMcpClientInfo = (sessionId: string, clientInfo: McpClientInfo): void => {
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

const requestLooksLikeNativeOAuthClient = ({
  mcpClientInfo,
  req,
}: {
  mcpClientInfo?: McpClientInfo | undefined;
  req: express.Request;
}): boolean =>
  mcpClientLooksLikeNativeOAuthClient(mcpClientInfo) ||
  [
    singleHeader(req.headers['user-agent']),
    singleHeader(req.headers['x-openai-client']),
    singleHeader(req.headers['x-codex-client']),
    singleHeader(req.headers['x-anthropic-client']),
    singleHeader(req.headers['x-claude-client']),
  ].some(valueLooksLikeNativeOAuthClient);

const requestOrigin = (req: express.Request): string => {
  const protocol = req.protocol || 'http';
  const host = req.get('host');
  if (!host || /[\r\n]/.test(host)) {
    return 'http://127.0.0.1';
  }
  return `${protocol}://${host}`;
};

const requestResourceUrls = (req: express.Request, mcpOptions: McpOptions) => {
  const resourceUrl =
    mcpOptions.resourceUrl || new URL(DEFAULT_STREAMABLE_PATH, requestOrigin(req)).toString();
  const metadataOrigin = new URL(resourceUrl).origin;
  return {
    resourceUrl,
    resourceMetadataUrl: new URL(DEFAULT_METADATA_PATH, metadataOrigin).toString(),
  };
};

const downloadBaseUrlFromResourceUrl = (resourceUrl: string): string => new URL('/', resourceUrl).origin;

const safeHeaderValue = (value: string | undefined): string | undefined => {
  if (!value || /[\r\n]/.test(value)) {
    return undefined;
  }
  return value;
};

const attachmentDispositionForFilename = (filename: string): string => {
  const asciiFilename = filename.replace(/[\r\n"]/g, '_') || 'download';
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
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
  registration_endpoint: `${authorizationServerUrl}${OAUTH_REGISTER_PATH}`,
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
  mcpOptions,
  req,
  toolProfile,
}: {
  mcpOptions: McpOptions;
  req: express.Request;
  toolProfile: ToolProfile;
}): boolean =>
  mcpOptions.streamableAuthFallback === 'tool_result' && toolProfile === 'hosted' && acceptsEventStream(req);

const getNativeOAuthConnectionAuthChallenge = ({
  auth,
  body,
  mcpClientInfo,
  req,
}: {
  auth: Awaited<ReturnType<typeof resolveClientAuth>>;
  body: unknown;
  mcpClientInfo?: McpClientInfo | undefined;
  req: express.Request;
}):
  | {
      error: 'authentication_required';
      errorDescription: string;
      statusCode: 401;
      wwwAuthenticate: string;
    }
  | undefined => {
  const method = jsonRpcMethod(body);
  if (
    auth.authMode !== 'none' ||
    !requestLooksLikeNativeOAuthClient({ mcpClientInfo, req }) ||
    !['initialize', 'tools/list'].includes(method ?? '')
  ) {
    return undefined;
  }

  const errorDescription =
    method === 'initialize' ?
      'Authentication required to connect Sanka MCP.'
    : 'Authentication required to list Sanka MCP tools.';

  return {
    error: 'authentication_required',
    errorDescription,
    statusCode: 401,
    wwwAuthenticate: buildOAuthWwwAuthenticateHeader({
      authorizationServerUrl: auth.oauth.authorizationServerUrl,
      description: errorDescription,
      error: 'invalid_token',
      resourceMetadataUrl: auth.oauth.resourceMetadataUrl,
    }),
  };
};

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
    mcpTool: inlineTool,
    reqContext: {
      client: undefined as any,
      mcpSessionId: transportContext.mcpSessionId,
      mcpClientInfo: transportContext.mcpClientInfo,
      toolProfile,
      auth: transportContext.auth,
      reconnectServerName: resolveReconnectServerName(
        reconnectServerNameHintFromHeaders(req.headers),
      ),
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

    const nativeConnectionAuthChallenge = getNativeOAuthConnectionAuthChallenge({
      auth: transportContext.auth,
      body: req.body,
      mcpClientInfo: transportContext.mcpClientInfo,
      req,
    });
    if (nativeConnectionAuthChallenge) {
      res.setHeader('WWW-Authenticate', nativeConnectionAuthChallenge.wwwAuthenticate);
      res.status(nativeConnectionAuthChallenge.statusCode).json({
        error: nativeConnectionAuthChallenge.error,
        error_description: nativeConnectionAuthChallenge.errorDescription,
      });
      return;
    }

    if (await maybeHandleInlineToolCall({ req, res, toolProfile, transportContext })) {
      return;
    }

    const authPreflight = getRequestAuthPreflight({
      auth: transportContext.auth,
      body: req.body,
      reconnectServerName: resolveReconnectServerName(
        reconnectServerNameHintFromHeaders(req.headers),
      ),
      toolAccessRequirements: transportContext.toolAccessRequirements,
    });
    if (authPreflight) {
      const shouldUseNativeOAuthChallenge =
        authPreflight.error === 'authentication_required' &&
        transportContext.auth.authMode === 'none' &&
        requestLooksLikeNativeOAuthClient({ mcpClientInfo: transportContext.mcpClientInfo, req });
      if (
        authPreflight.error === 'authentication_required' &&
        transportContext.auth.authMode === 'none' &&
        !shouldUseNativeOAuthChallenge &&
        shouldReturnToolResultAuthFallback({
          mcpOptions: options.mcpOptions,
          req,
          toolProfile,
        })
      ) {
        await transportContext.transport.handleRequest(req, res, req.body);
        return;
      }
      const errorDescription =
        shouldUseNativeOAuthChallenge ?
          authPreflight.nativeErrorDescription ?? authPreflight.errorDescription
        : authPreflight.errorDescription;
      const wwwAuthenticate =
        shouldUseNativeOAuthChallenge && transportContext.auth.authMode === 'none' ?
          buildOAuthWwwAuthenticateHeader({
            authorizationServerUrl: transportContext.auth.oauth.authorizationServerUrl,
            description: errorDescription,
            error: 'invalid_token',
            resourceMetadataUrl: transportContext.auth.oauth.resourceMetadataUrl,
          })
        : authPreflight.wwwAuthenticate;

      res.setHeader('WWW-Authenticate', wwwAuthenticate);
      res.status(authPreflight.statusCode).json({
        error: authPreflight.error,
        error_description: errorDescription,
        ...(shouldUseNativeOAuthChallenge ? undefined : authPreflight.reconnectMetadata),
      });
      return;
    }

    await transportContext.transport.handleRequest(req, res, req.body);
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
  app.use(express.json({ limit: MCP_JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: MCP_JSON_BODY_LIMIT }));
  app.use(expressRequestLogger());

  app.get('/health', async (req: express.Request, res: express.Response) => {
    res.status(200).send('OK');
  });
  const sendBinaryDownload = async (req: express.Request, res: express.Response) => {
    const downloadToken = req.params['downloadToken'];
    if (!downloadToken) {
      res.status(400).json({ error: 'missing_download_token' });
      return;
    }

    const sessionId = extractMcpSessionId(req.headers);
    const file = readBinaryDownloadFile({ downloadToken, sessionId });
    if (!file.ok) {
      res.status(file.reason === 'session_mismatch' ? 403 : 404).json({
        error: file.reason,
        error_description: file.message,
      });
      return;
    }

    const contentDisposition =
      safeHeaderValue(file.contentDisposition) ?? attachmentDispositionForFilename(file.filename);
    const data = Buffer.from(file.contentBase64, 'base64');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('Content-Length', String(file.byteLength));
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('X-Sanka-Download-Expires-At', file.expiresAt);
    res.status(200).send(data);
  };
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
  for (const routePath of BINARY_DOWNLOAD_PATHS) {
    app.get(routePath, sendBinaryDownload);
  }
  const streamableHandler = handleStreamableRequest({ clientOptions, mcpOptions });
  for (const routePath of STREAMABLE_HTTP_PATHS) {
    app.get(routePath, streamableHandler);
    app.post(routePath, streamableHandler);
    app.delete(routePath, streamableHandler);
  }
  app.use(expressErrorLogger());

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
    logger.info(
      { event: 'mcp.server.started', address },
      `MCP Server running on streamable HTTP at ${address}`,
    );
  } else if (address !== null) {
    logger.info(
      { event: 'mcp.server.started', port: address.port },
      `MCP Server running on streamable HTTP on port ${address.port}`,
    );
  } else {
    logger.info(
      { event: 'mcp.server.started', port },
      `MCP Server running on streamable HTTP on port ${port}`,
    );
  }
};
