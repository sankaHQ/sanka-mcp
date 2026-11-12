import { createHash } from 'node:crypto';
import { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { ClientOptions } from 'sanka-sdk';
import { getLogger } from './logger';
import { McpOptions } from './options';

export const DEFAULT_OAUTH_ISSUER = 'https://api-v2.sanka.com/oauth/mcp';
export const MCP_OAUTH_SCOPE = 'mcp:access';
// The token exchange must never hang a request; individual Sanka API requests use a
// 30s budget, so a stricter 10s cap on this small internal round-trip fits within it.
const UPSTREAM_AUTH_REQUEST_TIMEOUT_MS = 10_000;
const API_ACCESS_TOKEN_PREFIX = 'soat_';
const MCP_OAUTH_ACCESS_TOKEN = /^Bearer\s+(smat_[A-Za-z0-9_-]{20,128})$/i;
const EXCHANGE_CACHE_MAX = 2000;
// A disconnected client's cached API token is refused by Sanka at once; re-checking
// the client's token every minute lets it see the 401 challenge and sign in again.
const EXCHANGE_CACHE_TTL_MS = 60_000;

/**
 * A request the MCP server must refuse before running any tool. ``oauthError`` is the
 * RFC 6750 error for the WWW-Authenticate challenge; absent for a missing token.
 */
export class AuthenticationError extends Error {
  readonly statusCode: number;
  readonly oauthError: 'invalid_request' | 'invalid_token' | undefined;

  constructor({
    message,
    statusCode = 401,
    oauthError,
  }: {
    message: string;
    statusCode?: number;
    oauthError?: 'invalid_request' | 'invalid_token' | undefined;
  }) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
    this.oauthError = oauthError;
  }
}

export type AuthMode = 'none' | 'oauth_bearer';

export type ResolvedClientAuth = {
  authMode: AuthMode;
  clientOptions: Partial<ClientOptions>;
  oauth: {
    authorizationServerUrl: string;
    resourceMetadataUrl: string;
    resourceUrl: string;
    scopes: string[];
    nativeOAuth?: boolean | undefined;
    client_id?: string | undefined;
    client_name?: string | undefined;
    workspace_id?: string | undefined;
    workspace_code?: string | undefined;
    workspace_name?: string | undefined;
    workspace_access?: 'invoice_pilot' | 'full_workspace' | undefined;
  };
};

export type ResolvedWorkspaceIdentity = {
  workspace_id?: string | undefined;
  workspace_code?: string | undefined;
  workspace_name?: string | undefined;
};

type ResourceExchangeEnvelope = {
  access_token?: string;
  error?: string;
  expires_in?: number;
  scope?: string;
  client_id?: string | null;
  client_name?: string | null;
  workspace_id?: string | null;
  workspace_code?: string | null;
  workspace_name?: string | null;
  workspace_access?: 'invoice_pilot' | 'full_workspace';
};

type CachedExchange = {
  apiToken: string;
  expiresAt: number;
  scopes: string[];
  client_id?: string | undefined;
  client_name?: string | undefined;
} & ResolvedWorkspaceIdentity;

// Keyed by a digest of (resource, bearer token): the client's token is never stored.
const exchangeCache = new Map<string, CachedExchange>();

const singleHeader = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const optionalTrimmed = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const normalizeScopeClaim = (value: unknown): string[] =>
  typeof value === 'string' ? value.split(/\s+/).filter((scope) => scope.length > 0) : [];

export const resolveOAuthIssuer = (mcpOptions: McpOptions): string =>
  stripTrailingSlash(mcpOptions.oauthIssuer || DEFAULT_OAUTH_ISSUER);

const resolveInternalApiOrigin = (mcpOptions: McpOptions): string =>
  stripTrailingSlash(
    mcpOptions.internalAuthorizationServerUrl || new URL(resolveOAuthIssuer(mcpOptions)).origin,
  );

/** Legacy Connect Sanka clients still send this header; it carries no identity now. */
export const extractMcpSessionId = (headers: IncomingHttpHeaders): string | undefined => {
  const sessionId = singleHeader(headers['mcp-session-id'])?.trim();
  return sessionId ? sessionId : undefined;
};

const exchangeCacheKey = (resourceUrl: string, token: string): string =>
  createHash('sha256').update(`${resourceUrl}\u0000${token}`).digest('base64url');

const readCachedExchange = (key: string): CachedExchange | undefined => {
  const cached = exchangeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }
  exchangeCache.delete(key);
  return undefined;
};

const writeCachedExchange = (key: string, entry: CachedExchange): void => {
  const now = Date.now();
  for (const [cachedKey, cached] of exchangeCache) {
    if (cached.expiresAt <= now) exchangeCache.delete(cachedKey);
  }
  if (!exchangeCache.has(key) && exchangeCache.size >= EXCHANGE_CACHE_MAX) {
    const oldest = exchangeCache.keys().next().value;
    if (oldest !== undefined) exchangeCache.delete(oldest);
  }
  exchangeCache.set(key, entry);
};

/** After switch_workspace: the connection, its API token and the cache now name the new workspace. */
export const updateResolvedClientAuthWorkspace = ({
  auth,
  workspace,
}: {
  auth?: ResolvedClientAuth | undefined;
  workspace: ResolvedWorkspaceIdentity;
}): void => {
  const workspacePatch = {
    ...(optionalTrimmed(workspace.workspace_id) ?
      { workspace_id: optionalTrimmed(workspace.workspace_id) }
    : undefined),
    ...(optionalTrimmed(workspace.workspace_code) ?
      { workspace_code: optionalTrimmed(workspace.workspace_code) }
    : undefined),
    ...(optionalTrimmed(workspace.workspace_name) ?
      { workspace_name: optionalTrimmed(workspace.workspace_name) }
    : undefined),
  };
  if (!auth || Object.keys(workspacePatch).length === 0) {
    return;
  }
  Object.assign(auth.oauth, workspacePatch);
  const apiToken = typeof auth.clientOptions.apiKey === 'string' ? auth.clientOptions.apiKey : '';
  if (!apiToken) {
    return;
  }
  for (const [key, cached] of exchangeCache) {
    if (cached.apiToken === apiToken) {
      exchangeCache.set(key, { ...cached, ...workspacePatch });
    }
  }
};

/**
 * Check a client's MCP OAuth access token with Sanka (the authorization server) and
 * receive this server's own short-lived API token for the same user and workspace.
 * The client's token is never sent to the business API (no token passthrough).
 */
const exchangeAccessToken = async ({
  mcpOptions,
  resourceUrl,
  token,
}: {
  mcpOptions: McpOptions;
  resourceUrl: string;
  token: string;
}): Promise<CachedExchange> => {
  const key = exchangeCacheKey(resourceUrl, token);
  const cached = readCachedExchange(key);
  if (cached) {
    return cached;
  }
  const secret = mcpOptions.oauthResourceServerSecret?.trim();
  if (!secret) {
    getLogger().error('MCP OAuth resource server secret is not configured');
    throw new AuthenticationError({
      message: 'Sanka authorization is temporarily unavailable.',
      statusCode: 503,
    });
  }
  let response: Response;
  try {
    response = await fetch(`${resolveInternalApiOrigin(mcpOptions)}/oauth/internal/mcp-oauth-token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Sanka-MCP-Resource-Secret': secret,
      },
      body: JSON.stringify({ access_token: token, resource: resourceUrl }),
      signal: AbortSignal.timeout(UPSTREAM_AUTH_REQUEST_TIMEOUT_MS),
      redirect: 'error',
    });
  } catch (error) {
    getLogger().warn(
      { error: error instanceof Error ? error.message : String(error) },
      'MCP OAuth token exchange request failed',
    );
    throw new AuthenticationError({
      message: 'Sanka authorization is temporarily unavailable.',
      statusCode: 503,
    });
  }
  const payload = (await response.json().catch(() => null)) as ResourceExchangeEnvelope | null;
  if (response.status === 401) {
    throw new AuthenticationError({
      message: 'The access token is invalid or expired.',
      oauthError: 'invalid_token',
    });
  }
  if (!response.ok) {
    getLogger().warn({ status: response.status, error: payload?.error }, 'MCP OAuth token exchange failed');
    // A refused service secret or unknown resource is our configuration, not the client.
    throw new AuthenticationError({
      message: 'Sanka authorization is temporarily unavailable.',
      statusCode: 503,
    });
  }
  const apiToken = optionalTrimmed(payload?.access_token);
  const scopes = normalizeScopeClaim(payload?.scope);
  const expiresIn = Number(payload?.expires_in);
  if (!apiToken?.startsWith(API_ACCESS_TOKEN_PREFIX) || !(expiresIn > 0)) {
    getLogger().warn('MCP OAuth token exchange returned an invalid Sanka API token');
    throw new AuthenticationError({
      message: 'Sanka returned an invalid authorization result.',
      statusCode: 503,
    });
  }
  const entry: CachedExchange = {
    apiToken,
    // Revocation still applies at once: Sanka checks the connection on every API call.
    expiresAt: Date.now() + Math.min(EXCHANGE_CACHE_TTL_MS, Math.max(1, expiresIn - 5) * 1000),
    scopes,
    ...(optionalTrimmed(payload?.client_id) ? { client_id: optionalTrimmed(payload?.client_id) } : undefined),
    ...(optionalTrimmed(payload?.client_name) ?
      { client_name: optionalTrimmed(payload?.client_name) }
    : undefined),
    ...(optionalTrimmed(payload?.workspace_id) ?
      { workspace_id: optionalTrimmed(payload?.workspace_id) }
    : undefined),
    ...(optionalTrimmed(payload?.workspace_code) ?
      { workspace_code: optionalTrimmed(payload?.workspace_code) }
    : undefined),
    ...(optionalTrimmed(payload?.workspace_name) ?
      { workspace_name: optionalTrimmed(payload?.workspace_name) }
    : undefined),
  };
  writeCachedExchange(key, entry);
  return entry;
};

/**
 * Resolve the caller from its MCP OAuth bearer token (MCP authorization spec,
 * 2026-07-28). Without a token the result is ``authMode: 'none'``; the HTTP layer
 * answers it with a 401 challenge that points at the protected resource metadata.
 */
export const resolveClientAuth = async ({
  mcpOptions,
  req,
  resourceMetadataUrl,
  resourceUrl,
}: {
  mcpOptions: McpOptions;
  req: IncomingMessage;
  resourceMetadataUrl: string;
  resourceUrl: string;
}): Promise<ResolvedClientAuth> => {
  if (mcpOptions.nativeOAuth) {
    return resolveChatGPTClientAuth({ mcpOptions, req, resourceMetadataUrl, resourceUrl });
  }
  const oauthContext = {
    authorizationServerUrl: resolveOAuthIssuer(mcpOptions),
    resourceMetadataUrl,
    resourceUrl,
  };
  if (req.headers['x-sanka-api-key']) {
    throw new AuthenticationError({
      message: 'API keys are not accepted here. Connect Sanka with OAuth from your AI client.',
      oauthError: 'invalid_request',
    });
  }
  const authorization = singleHeader(req.headers.authorization)?.trim();
  if (!authorization) {
    return { authMode: 'none', clientOptions: {}, oauth: { ...oauthContext, scopes: [] } };
  }
  const token = MCP_OAUTH_ACCESS_TOKEN.exec(authorization)?.[1];
  if (!token) {
    throw new AuthenticationError({
      message: 'The access token is invalid or expired.',
      oauthError: 'invalid_token',
    });
  }
  const access = await exchangeAccessToken({ mcpOptions, resourceUrl, token });
  return {
    authMode: 'oauth_bearer',
    clientOptions: { apiKey: access.apiToken },
    oauth: {
      ...oauthContext,
      scopes: access.scopes,
      ...(access.client_id ? { client_id: access.client_id } : undefined),
      ...(access.client_name ? { client_name: access.client_name } : undefined),
      ...(access.workspace_id ? { workspace_id: access.workspace_id } : undefined),
      ...(access.workspace_code ? { workspace_code: access.workspace_code } : undefined),
      ...(access.workspace_name ? { workspace_name: access.workspace_name } : undefined),
    },
  };
};

const resolveChatGPTClientAuth = async ({
  mcpOptions,
  req,
  resourceMetadataUrl,
  resourceUrl,
}: {
  mcpOptions: McpOptions;
  req: IncomingMessage;
  resourceMetadataUrl: string;
  resourceUrl: string;
}): Promise<ResolvedClientAuth> => {
  const header = singleHeader(req.headers.authorization) ?? '';
  const token = /^Bearer (sccat_[A-Za-z0-9_-]+)$/i.exec(header)?.[1];
  if (!token || req.headers['x-sanka-api-key']) {
    throw new AuthenticationError({ message: 'Connect Sanka Flow in ChatGPT to continue.' });
  }
  const origin =
    mcpOptions.internalAuthorizationServerUrl ?
      stripTrailingSlash(mcpOptions.internalAuthorizationServerUrl)
    : new URL(mcpOptions.chatgptConnectorIssuer!).origin;
  let response: Response;
  try {
    response = await fetch(`${origin}/oauth/internal/chatgpt-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sanka-MCP-Token-Exchange-Secret': mcpOptions.tokenExchangeSharedSecret ?? '',
      },
      body: JSON.stringify({ access_token: token, resource: resourceUrl }),
      signal: AbortSignal.timeout(UPSTREAM_AUTH_REQUEST_TIMEOUT_MS),
      redirect: 'error',
    });
  } catch {
    throw new AuthenticationError({
      message: 'Sanka authorization is temporarily unavailable.',
      statusCode: 503,
    });
  }
  if (!response.ok) {
    throw new AuthenticationError({
      message:
        response.status >= 500 ?
          'Sanka authorization is temporarily unavailable.'
        : 'Reconnect Sanka Flow in ChatGPT.',
      statusCode: response.status >= 500 ? 503 : 401,
    });
  }
  const payload = (await response.json().catch(() => ({}))) as ResourceExchangeEnvelope;
  const scopes = normalizeScopeClaim(payload.scope);
  if (
    typeof payload.access_token !== 'string' ||
    !payload.access_token.startsWith('soat_') ||
    typeof payload.workspace_id !== 'string' ||
    !payload.workspace_id ||
    !scopes.includes('mcp:access') ||
    !(Number(payload.expires_in) > 0)
  ) {
    throw new AuthenticationError({
      message: 'Sanka returned an invalid authorization result.',
      statusCode: 503,
    });
  }
  // This API credential is minted for the backend. Never pass the incoming
  // resource token through to the business API or cache authorization decisions.
  return {
    authMode: 'oauth_bearer',
    clientOptions: { apiKey: payload.access_token },
    oauth: {
      nativeOAuth: true,
      authorizationServerUrl: mcpOptions.chatgptConnectorIssuer!,
      resourceMetadataUrl,
      resourceUrl,
      scopes,
      workspace_id: payload.workspace_id,
      ...(payload.workspace_code ? { workspace_code: payload.workspace_code } : {}),
      ...(payload.workspace_name ? { workspace_name: payload.workspace_name } : {}),
      ...(payload.workspace_access ? { workspace_access: payload.workspace_access } : {}),
    },
  };
};
