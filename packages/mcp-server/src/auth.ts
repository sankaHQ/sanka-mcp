// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { createHash, randomUUID } from 'node:crypto';
import { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { ClientOptions } from 'sanka-sdk';
import { getLogger } from './logger';
import { buildMcpConnectUrl, buildOAuthAuthorizationUrl } from './mcp-connect';
import { McpOptions } from './options';

const DEFAULT_AUTHORIZATION_SERVER_URL = 'https://app.sanka.com';
const DEFAULT_INTROSPECTION_PATH = '/api/v1/oauth/introspect';
const INTROSPECTION_CACHE_TTL_MS = 2_000;
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
};

const mcpSessionTokenCache = new Map<
  string,
  {
    accessToken: string;
    expiresAt: number;
    scopes: string[];
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
  resourceMetadataUrl,
  token,
}: {
  authorizationServerUrl: string;
  resourceMetadataUrl: string;
  token: string;
}): Promise<OAuthIntrospectionPayload> => {
  const cached = readCachedIntrospection(token);
  if (cached) {
    return cached;
  }

  const response = await fetch(resolveIntrospectionUrl(authorizationServerUrl), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as OAuthIntrospectionEnvelope | null;
  const description = String(
    payload?.message || payload?.error || `OAuth token introspection failed with status ${response.status}.`,
  );

  if (!response.ok) {
    throw buildOAuthAccessTokenChallenge({
      authorizationServerUrl,
      description,
      resourceMetadataUrl,
      statusCode: response.status === 400 ? 400 : 401,
    });
  }

  const data = payload?.data;
  if (!data?.active) {
    throw buildOAuthAccessTokenChallenge({
      authorizationServerUrl,
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
}): { accessToken: string; scopes: string[] } | null => {
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
  };
};

const writeCachedMcpSessionToken = ({
  accessToken,
  authorizationServerUrl,
  expiresInSeconds,
  resourceUrl,
  scopes,
  sessionId,
}: {
  accessToken: string;
  authorizationServerUrl: string;
  expiresInSeconds: number;
  resourceUrl: string;
  scopes: string[];
  sessionId: string;
}): void => {
  const cacheKey = `${authorizationServerUrl}:${resourceUrl}:${sessionId}`;
  mcpSessionTokenCache.set(cacheKey, {
    accessToken,
    scopes,
    expiresAt: Date.now() + Math.max(1, expiresInSeconds - 5) * 1000,
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
}): Promise<{ accessToken: string; scopes: string[] } | null> => {
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
  });

  return {
    accessToken,
    scopes,
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
      authorizationServerUrl,
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
    authorizationServerUrl,
    resourceMetadataUrl,
    token,
  });

  return {
    authMode: 'oauth_bearer',
    clientOptions: { apiKey: token },
    oauth: {
      ...oauthContext,
      scopes: normalizeScopeClaim(introspected.scope),
    },
  };
};
