// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { createHash, randomUUID } from 'node:crypto';
import { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { ClientOptions } from 'sanka-sdk';
import { getLogger } from './logger';
import { buildMcpConnectUrl, buildOAuthAuthorizationUrl } from './mcp-connect';
import { McpOptions } from './options';

const DEFAULT_AUTHORIZATION_SERVER_URL = 'https://app.sanka.com';
const DEFAULT_INTROSPECTION_PATH = '/api/v1/oauth/introspect';
// Successful introspections are cached so bursts of tool calls do not re-hit the
// authorization server on every request. Tradeoff: a token revoked upstream can
// keep working on this server for up to this TTL after revocation.
const INTROSPECTION_CACHE_TTL_MS = 60_000;
// Upstream auth calls (introspection, MCP session token exchange) must never
// hang a request; individual Sanka API requests use a 30s budget, so a stricter
// 10s cap on these small internal auth round-trips is comfortably within it.
const UPSTREAM_AUTH_REQUEST_TIMEOUT_MS = 10_000;
const OAUTH_ACCESS_TOKEN_PREFIX = 'soat_';

const oauthIntrospectionCache = new Map<
  string,
  {
    expiresAt: number;
    payload: OAuthIntrospectionPayload;
  }
>();

export class OAuthChallengeError extends Error {
  readonly statusCode: number;
  readonly wwwAuthenticate: string;

  constructor({
    message,
    wwwAuthenticate,
    statusCode = 401,
  }: {
    message: string;
    wwwAuthenticate: string;
    statusCode?: number;
  }) {
    super(message);
    this.name = 'OAuthChallengeError';
    this.statusCode = statusCode;
    this.wwwAuthenticate = wwwAuthenticate;
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
    authorizationUrl?: string | undefined;
    connectUrl?: string | undefined;
    connectUrlForScopes?: ((scopes?: string[] | undefined) => string | undefined) | undefined;
    workspace_id?: string | undefined;
    workspace_code?: string | undefined;
    workspace_name?: string | undefined;
  };
};

type OAuthIntrospectionPayload = {
  active?: boolean;
  client_id?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  scope?: string | null;
  session_id?: string | null;
  user_id?: string | null;
  workspace_id?: string | null;
  workspace_code?: string | null;
  workspace_name?: string | null;
};

type OAuthIntrospectionEnvelope = {
  data?: OAuthIntrospectionPayload;
  error?: string;
  message?: string;
};

type McpSessionTokenEnvelope = {
  access_token?: string;
  error?: string;
  expires_in?: number;
  message?: string;
  scope?: string;
  token_type?: string;
  workspace_id?: string | null;
  workspace_code?: string | null;
  workspace_name?: string | null;
};

const mcpSessionTokenCache = new Map<
  string,
  {
    accessToken: string;
    expiresAt: number;
    scopes: string[];
    workspace_id?: string | undefined;
    workspace_code?: string | undefined;
    workspace_name?: string | undefined;
  }
>();

const singleHeader = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const escapeHeaderValue = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const normalizeScopeClaim = (value: unknown): string[] => {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
};

const isSankaOAuthAccessToken = (value: string): boolean => value.startsWith(OAUTH_ACCESS_TOKEN_PREFIX);

const resolveAuthorizationServerUrl = (mcpOptions: McpOptions): string =>
  stripTrailingSlash(mcpOptions.authorizationServerUrl || DEFAULT_AUTHORIZATION_SERVER_URL);

const resolveInternalAuthorizationServerUrl = (mcpOptions: McpOptions): string =>
  stripTrailingSlash(
    mcpOptions.internalAuthorizationServerUrl ||
      mcpOptions.authorizationServerUrl ||
      DEFAULT_AUTHORIZATION_SERVER_URL,
  );

const resolveIntrospectionUrl = (authorizationServerUrl: string): string =>
  `${authorizationServerUrl}${DEFAULT_INTROSPECTION_PATH}`;

const resolveMcpSessionTokenUrl = (authorizationServerUrl: string): string =>
  `${authorizationServerUrl}/oauth/internal/mcp-session-token`;

const cacheKeyForToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const readCachedIntrospection = (token: string): OAuthIntrospectionPayload | null => {
  const cacheKey = cacheKeyForToken(token);
  const cached = oauthIntrospectionCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    oauthIntrospectionCache.delete(cacheKey);
    return null;
  }

  return cached.payload;
};

const writeCachedIntrospection = (token: string, payload: OAuthIntrospectionPayload): void => {
  oauthIntrospectionCache.set(cacheKeyForToken(token), {
    payload,
    expiresAt: Date.now() + INTROSPECTION_CACHE_TTL_MS,
  });
};

export const extractMcpSessionId = (headers: IncomingHttpHeaders): string | undefined => {
  const sessionId = singleHeader(headers['mcp-session-id'])?.trim();
  return sessionId ? sessionId : undefined;
};

export const generateMcpSessionId = (): string => randomUUID();

export const buildOAuthWwwAuthenticateHeader = ({
  authorizationServerUrl,
  description,
  error = 'invalid_token',
  resourceMetadataUrl,
  scope,
}: {
  authorizationServerUrl: string;
  description: string;
  error?: 'insufficient_scope' | 'invalid_token';
  resourceMetadataUrl: string;
  scope?: string | undefined;
}): string =>
  `Bearer realm="sanka_mcp", resource_metadata="${escapeHeaderValue(
    resourceMetadataUrl,
  )}", authorization_uri="${escapeHeaderValue(
    buildOAuthAuthorizationUrl(authorizationServerUrl),
  )}", error="${escapeHeaderValue(error)}", error_description="${escapeHeaderValue(description)}"${
    scope ? `, scope="${escapeHeaderValue(scope)}"` : ''
  }`;

const buildOAuthAccessTokenChallenge = ({
  authorizationServerUrl,
  description,
  resourceMetadataUrl,
  statusCode = 401,
}: {
  authorizationServerUrl: string;
  description: string;
  resourceMetadataUrl: string;
  statusCode?: number;
}): OAuthChallengeError =>
  new OAuthChallengeError({
    message: description,
    statusCode,
    wwwAuthenticate: buildOAuthWwwAuthenticateHeader({
      authorizationServerUrl,
      description,
      resourceMetadataUrl,
    }),
  });

const introspectOAuthAccessToken = async ({
  authorizationServerUrl,
  challengeAuthorizationServerUrl,
  resourceMetadataUrl,
  token,
}: {
  authorizationServerUrl: string;
  challengeAuthorizationServerUrl?: string | undefined;
  resourceMetadataUrl: string;
  token: string;
}): Promise<OAuthIntrospectionPayload> => {
  const cached = readCachedIntrospection(token);
  if (cached) {
    return cached;
  }

  let response: Response;
  try {
    response = await fetch(resolveIntrospectionUrl(authorizationServerUrl), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(UPSTREAM_AUTH_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // Network failures and timeouts follow the same 401 challenge path as a
    // failed introspection instead of surfacing as an unhandled server error.
    getLogger().warn(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'OAuth token introspection request failed',
    );
    throw buildOAuthAccessTokenChallenge({
      authorizationServerUrl: challengeAuthorizationServerUrl ?? authorizationServerUrl,
      description: 'OAuth token introspection request failed or timed out.',
      resourceMetadataUrl,
    });
  }

  const payload = (await response.json().catch(() => null)) as OAuthIntrospectionEnvelope | null;
  const description = String(
    payload?.message || payload?.error || `OAuth token introspection failed with status ${response.status}.`,
  );

  if (!response.ok) {
    throw buildOAuthAccessTokenChallenge({
      authorizationServerUrl: challengeAuthorizationServerUrl ?? authorizationServerUrl,
      description,
      resourceMetadataUrl,
      statusCode: response.status === 400 ? 400 : 401,
    });
  }

  const data = payload?.data;
  if (!data?.active) {
    throw buildOAuthAccessTokenChallenge({
      authorizationServerUrl: challengeAuthorizationServerUrl ?? authorizationServerUrl,
      description: 'OAuth access token is invalid or inactive.',
      resourceMetadataUrl,
    });
  }

  writeCachedIntrospection(token, data);
  return data;
};

const readCachedMcpSessionToken = ({
  authorizationServerUrl,
  resourceUrl,
  sessionId,
}: {
  authorizationServerUrl: string;
  resourceUrl: string;
  sessionId: string;
}): {
  accessToken: string;
  scopes: string[];
  workspace_id?: string | undefined;
  workspace_code?: string | undefined;
  workspace_name?: string | undefined;
} | null => {
  const cacheKey = `${authorizationServerUrl}:${resourceUrl}:${sessionId}`;
  const cached = mcpSessionTokenCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    mcpSessionTokenCache.delete(cacheKey);
    return null;
  }
  return {
    accessToken: cached.accessToken,
    scopes: cached.scopes,
    ...(cached.workspace_id ? { workspace_id: cached.workspace_id } : undefined),
    ...(cached.workspace_code ? { workspace_code: cached.workspace_code } : undefined),
    ...(cached.workspace_name ? { workspace_name: cached.workspace_name } : undefined),
  };
};

const writeCachedMcpSessionToken = ({
  accessToken,
  authorizationServerUrl,
  expiresInSeconds,
  resourceUrl,
  scopes,
  sessionId,
  workspace_code,
  workspace_id,
  workspace_name,
}: {
  accessToken: string;
  authorizationServerUrl: string;
  expiresInSeconds: number;
  resourceUrl: string;
  scopes: string[];
  sessionId: string;
  workspace_code?: string | undefined;
  workspace_id?: string | undefined;
  workspace_name?: string | undefined;
}): void => {
  const cacheKey = `${authorizationServerUrl}:${resourceUrl}:${sessionId}`;
  mcpSessionTokenCache.set(cacheKey, {
    accessToken,
    scopes,
    expiresAt: Date.now() + Math.max(1, expiresInSeconds - 5) * 1000,
    ...(workspace_id ? { workspace_id } : undefined),
    ...(workspace_code ? { workspace_code } : undefined),
    ...(workspace_name ? { workspace_name } : undefined),
  });
};

const exchangeMcpSessionForAccessToken = async ({
  authorizationServerUrl,
  resourceUrl,
  sessionId,
  sharedSecret,
}: {
  authorizationServerUrl: string;
  resourceUrl: string;
  sessionId: string | undefined;
  sharedSecret: string | undefined;
}): Promise<{
  accessToken: string;
  scopes: string[];
  workspace_id?: string | undefined;
  workspace_code?: string | undefined;
  workspace_name?: string | undefined;
} | null> => {
  const normalizedSessionId = sessionId?.trim();
  const normalizedSecret = sharedSecret?.trim();
  if (!normalizedSessionId || !normalizedSecret) {
    return null;
  }

  const cached = readCachedMcpSessionToken({
    authorizationServerUrl,
    resourceUrl,
    sessionId: normalizedSessionId,
  });
  if (cached) {
    return cached;
  }

  let response: Response;
  try {
    response = await fetch(resolveMcpSessionTokenUrl(authorizationServerUrl), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Sanka-MCP-Token-Exchange-Secret': normalizedSecret,
      },
      body: JSON.stringify({
        resource: resourceUrl,
        session_id: normalizedSessionId,
      }),
      signal: AbortSignal.timeout(UPSTREAM_AUTH_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    getLogger().warn(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'MCP session token exchange request failed',
    );
    return null;
  }

  const payload = (await response.json().catch(() => null)) as McpSessionTokenEnvelope | null;
  if (!response.ok) {
    if (response.status !== 404) {
      getLogger().warn(
        {
          status: response.status,
          error: payload && 'error' in payload ? payload.error : undefined,
        },
        'MCP session token exchange failed',
      );
    }
    return null;
  }

  const accessToken = String(payload?.access_token || '').trim();
  if (!accessToken || !isSankaOAuthAccessToken(accessToken)) {
    getLogger().warn('MCP session token exchange returned an invalid Sanka access token');
    return null;
  }

  const scopes = normalizeScopeClaim(payload?.scope);
  const workspaceID = typeof payload?.workspace_id === 'string' ? payload.workspace_id.trim() : '';
  const workspaceCode = typeof payload?.workspace_code === 'string' ? payload.workspace_code.trim() : '';
  const workspaceName = typeof payload?.workspace_name === 'string' ? payload.workspace_name.trim() : '';
  writeCachedMcpSessionToken({
    accessToken,
    authorizationServerUrl,
    expiresInSeconds:
      typeof payload?.expires_in === 'number' && Number.isFinite(payload.expires_in) ?
        payload.expires_in
      : 300,
    resourceUrl,
    scopes,
    sessionId: normalizedSessionId,
    ...(workspaceID ? { workspace_id: workspaceID } : undefined),
    ...(workspaceCode ? { workspace_code: workspaceCode } : undefined),
    ...(workspaceName ? { workspace_name: workspaceName } : undefined),
  });

  return {
    accessToken,
    scopes,
    ...(workspaceID ? { workspace_id: workspaceID } : undefined),
    ...(workspaceCode ? { workspace_code: workspaceCode } : undefined),
    ...(workspaceName ? { workspace_name: workspaceName } : undefined),
  };
};

export const resolveClientAuth = async ({
  mcpSessionId,
  mcpSessionIdForExchange,
  mcpOptions,
  req,
  resourceMetadataUrl,
  resourceUrl,
}: {
  mcpSessionId?: string | undefined;
  mcpSessionIdForExchange?: string | undefined;
  mcpOptions: McpOptions;
  req: IncomingMessage;
  resourceMetadataUrl: string;
  resourceUrl: string;
}): Promise<ResolvedClientAuth> => {
  const authorizationHeader = singleHeader(req.headers.authorization);
  const apiKeyHeader = singleHeader(req.headers['x-sanka-api-key']);
  const authorizationServerUrl = resolveAuthorizationServerUrl(mcpOptions);
  const internalAuthorizationServerUrl = resolveInternalAuthorizationServerUrl(mcpOptions);

  const connectUrlForScopes =
    mcpSessionId && mcpOptions.tokenExchangeSharedSecret ?
      (scopes?: string[] | undefined) =>
        buildMcpConnectUrl({
          authorizationServerUrl,
          scopes,
          sessionId: mcpSessionId,
          sharedSecret: mcpOptions.tokenExchangeSharedSecret,
        })
    : undefined;
  const oauthContext = {
    authorizationServerUrl,
    authorizationUrl: buildOAuthAuthorizationUrl(authorizationServerUrl),
    ...(connectUrlForScopes ?
      {
        connectUrl: connectUrlForScopes(),
        connectUrlForScopes,
      }
    : undefined),
    resourceMetadataUrl,
    resourceUrl,
  };

  if (apiKeyHeader) {
    throw buildOAuthAccessTokenChallenge({
      authorizationServerUrl,
      description:
        'Sanka MCP accepts only Sanka OAuth access tokens. Developer API tokens are not supported for MCP access.',
      resourceMetadataUrl,
    });
  }

  if (!authorizationHeader) {
    const mcpSessionAccess = await exchangeMcpSessionForAccessToken({
      authorizationServerUrl: internalAuthorizationServerUrl,
      resourceUrl,
      sessionId: mcpSessionIdForExchange,
      sharedSecret: mcpOptions.tokenExchangeSharedSecret,
    });
    if (mcpSessionAccess) {
      return {
        authMode: 'oauth_bearer',
        clientOptions: { apiKey: mcpSessionAccess.accessToken },
        oauth: {
          ...oauthContext,
          scopes: mcpSessionAccess.scopes,
          ...(mcpSessionAccess.workspace_id ? { workspace_id: mcpSessionAccess.workspace_id } : undefined),
          ...(mcpSessionAccess.workspace_code ?
            { workspace_code: mcpSessionAccess.workspace_code }
          : undefined),
          ...(mcpSessionAccess.workspace_name ?
            { workspace_name: mcpSessionAccess.workspace_name }
          : undefined),
        },
      };
    }

    return {
      authMode: 'none',
      clientOptions: {},
      oauth: {
        ...oauthContext,
        scopes: [],
      },
    };
  }

  const [scheme, ...rest] = authorizationHeader.split(' ');
  const token = rest.join(' ').trim();
  if (scheme !== 'Bearer' || !token) {
    throw new OAuthChallengeError({
      message: 'Unsupported authorization scheme.',
      wwwAuthenticate: buildOAuthWwwAuthenticateHeader({
        authorizationServerUrl,
        description: 'Expected Authorization: Bearer <token>.',
        resourceMetadataUrl,
      }),
      statusCode: 400,
    });
  }

  if (!isSankaOAuthAccessToken(token)) {
    throw buildOAuthAccessTokenChallenge({
      authorizationServerUrl,
      description: 'Sanka MCP accepts only Sanka OAuth access tokens that start with soat_.',
      resourceMetadataUrl,
    });
  }

  const introspected = await introspectOAuthAccessToken({
    authorizationServerUrl: internalAuthorizationServerUrl,
    challengeAuthorizationServerUrl: authorizationServerUrl,
    resourceMetadataUrl,
    token,
  });

  return {
    authMode: 'oauth_bearer',
    clientOptions: { apiKey: token },
    oauth: {
      ...oauthContext,
      scopes: normalizeScopeClaim(introspected.scope),
      ...(introspected.workspace_id ? { workspace_id: introspected.workspace_id } : undefined),
      ...(introspected.workspace_code ? { workspace_code: introspected.workspace_code } : undefined),
      ...(introspected.workspace_name ? { workspace_name: introspected.workspace_name } : undefined),
    },
  };
};
