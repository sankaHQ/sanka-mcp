// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { createHmac, createPublicKey, createVerify, randomUUID } from 'node:crypto';
import { IncomingMessage, IncomingHttpHeaders } from 'node:http';
import { ClientOptions } from 'sanka-sdk';
import { McpOptions } from './options';

const DEFAULT_AUTHORIZATION_SERVER_URL = 'https://app.sanka.com';
const DEFAULT_LEGACY_JWT_AUDIENCE = 'sanka-api';
const DEFAULT_MCP_CONNECT_PATH = '/oauth/mcp/connect';
const DEFAULT_MCP_SESSION_TOKEN_PATH = '/oauth/internal/mcp-session-token';
const MCP_CONNECT_TOKEN_MAX_AGE_SECONDS = 900;
const TOKEN_EXCHANGE_SKEW_MS = 10_000;

type JwkKey = Record<string, unknown> & { kid?: string };

const remoteJwksCache = new Map<string, Promise<{ keys: JwkKey[] }>>();
const exchangedTokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

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

export type AuthMode = 'none' | 'api_key' | 'legacy_oauth_jwt' | 'resource_oauth_jwt' | 'mcp_session';

export type ResolvedClientAuth = {
  authMode: AuthMode;
  clientOptions: Partial<ClientOptions>;
  oauth: {
    authorizationServerUrl: string;
    connectUrl?: string | undefined;
    resourceMetadataUrl: string;
    resourceUrl: string;
    scopes: string[];
  };
};

type VerifiedOAuthToken = {
  audience: string;
  payload: Record<string, unknown>;
  token: string;
};

const singleHeader = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const normalizeRequestedScopes = (scopes: string[] | undefined): string[] => {
  const normalizedScopes =
    Array.isArray(scopes) ?
      scopes.map((scope) => scope.trim()).filter((scope) => scope.length > 0)
    : [];

  return [...new Set(['mcp:access', ...normalizedScopes])].sort();
};

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const isJwtLike = (value: string): boolean => value.split('.').length === 3;

const escapeHeaderValue = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const extractMcpSessionId = (headers: IncomingHttpHeaders): string | undefined => {
  const sessionId = singleHeader(headers['mcp-session-id'])?.trim();
  return sessionId ? sessionId : undefined;
};

export const generateMcpSessionId = (): string => randomUUID();

const buildMcpConnectToken = ({
  requestedScopes,
  sessionId,
  sharedSecret,
}: {
  requestedScopes?: string[] | undefined;
  sessionId: string;
  sharedSecret: string;
}): string => {
  const now = Math.floor(Date.now() / 1000);
  const normalizedRequestedScopes = normalizeRequestedScopes(requestedScopes);
  const payload = Buffer.from(
    JSON.stringify({
      exp: now + MCP_CONNECT_TOKEN_MAX_AGE_SECONDS,
      iat: now,
      ...(normalizedRequestedScopes.length ? { scp: normalizedRequestedScopes } : undefined),
      sid: sessionId,
      v: 1,
    }),
  ).toString('base64url');
  const signature = createHmac('sha256', sharedSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const buildMcpConnectUrl = ({
  authorizationServerUrl,
  requestedScopes,
  sessionId,
  tokenExchangeSharedSecret,
}: {
  authorizationServerUrl: string;
  requestedScopes?: string[] | undefined;
  sessionId?: string | undefined;
  tokenExchangeSharedSecret?: string | undefined;
}): string | undefined => {
  if (!sessionId || !tokenExchangeSharedSecret) {
    return undefined;
  }

  const token = buildMcpConnectToken({
    requestedScopes,
    sessionId,
    sharedSecret: tokenExchangeSharedSecret,
  });
  return `${authorizationServerUrl}${DEFAULT_MCP_CONNECT_PATH}?token=${encodeURIComponent(token)}`;
};

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
    `${authorizationServerUrl}/oauth/authorize`,
  )}", error="${escapeHeaderValue(error)}", error_description="${escapeHeaderValue(description)}"${
    scope ? `, scope="${escapeHeaderValue(scope)}"` : ''
  }`;

const getRemoteJwks = (jwksUrl: string) => {
  const existing = remoteJwksCache.get(jwksUrl);
  if (existing) {
    return existing;
  }

  const next = fetch(jwksUrl).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.status}`);
    }
    return (await response.json()) as { keys: JwkKey[] };
  });
  remoteJwksCache.set(jwksUrl, next);
  return next;
};

const describeJwtError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'OAuth access token verification failed.';
};

const decodeJwtSection = <T>(value: string): T => {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
};

const normalizeAudienceClaim = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
};

const normalizeScopeClaim = (value: unknown): string[] => {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
};

const verifyJwt = async ({
  audience,
  authorizationServerUrl,
  jwksUrl,
  token,
}: {
  audience: string;
  authorizationServerUrl: string;
  jwksUrl: string;
  token: string;
}): Promise<Record<string, unknown>> => {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('OAuth access token is not a valid JWT.');
  }

  const header = decodeJwtSection<{ alg?: string; kid?: string }>(encodedHeader);
  const payload = decodeJwtSection<Record<string, unknown>>(encodedPayload);
  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported JWT alg: ${header.alg ?? 'unknown'}`);
  }

  const jwks = await getRemoteJwks(jwksUrl);
  const key =
    (header.kid ? jwks.keys.find((candidate) => candidate.kid === header.kid) : undefined) || jwks.keys[0];
  if (!key) {
    throw new Error('No signing key was available from the authorization server.');
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  const publicKey = createPublicKey({ key, format: 'jwk' });
  const isValid = verifier.verify(publicKey, Buffer.from(encodedSignature, 'base64url'));
  if (!isValid) {
    throw new Error('OAuth access token signature verification failed.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload['exp'] === 'number' && payload['exp'] < now) {
    throw new Error('OAuth access token has expired.');
  }
  if (typeof payload['nbf'] === 'number' && payload['nbf'] > now) {
    throw new Error('OAuth access token is not active yet.');
  }
  if (payload['iss'] !== authorizationServerUrl) {
    throw new Error('OAuth access token issuer did not match the authorization server.');
  }

  const audiences = normalizeAudienceClaim(payload['aud']);
  if (!audiences.includes(audience)) {
    throw new Error(`OAuth access token audience did not include ${audience}.`);
  }

  return payload;
};

async function verifyOAuthJwt({
  authorizationServerUrl,
  legacyAudience,
  resourceUrl,
  resourceMetadataUrl,
  token,
}: {
  authorizationServerUrl: string;
  legacyAudience: string;
  resourceUrl: string;
  resourceMetadataUrl: string;
  token: string;
}): Promise<VerifiedOAuthToken> {
  const jwksUrl = `${authorizationServerUrl}/oauth/jwks.json`;
  const audiences = [...new Set([resourceUrl, legacyAudience])];
  let lastError: unknown;

  for (const audience of audiences) {
    try {
      return {
        audience,
        payload: await verifyJwt({
          audience,
          authorizationServerUrl,
          jwksUrl,
          token,
        }),
        token,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new OAuthChallengeError({
    message: 'OAuth bearer token verification failed.',
    wwwAuthenticate: buildOAuthWwwAuthenticateHeader({
      authorizationServerUrl,
      description: describeJwtError(lastError),
      resourceMetadataUrl,
    }),
  });
}

async function exchangeOAuthJwt({
  authorizationServerUrl,
  resourceUrl,
  resourceMetadataUrl,
  token,
  tokenExchangeSharedSecret,
  tokenExchangeUrl,
}: {
  authorizationServerUrl: string;
  resourceUrl: string;
  resourceMetadataUrl: string;
  token: string;
  tokenExchangeSharedSecret?: string;
  tokenExchangeUrl?: string;
}): Promise<string> {
  const cached = exchangedTokenCache.get(token);
  if (cached && cached.expiresAt - TOKEN_EXCHANGE_SKEW_MS > Date.now()) {
    return cached.accessToken;
  }

  if (!tokenExchangeSharedSecret) {
    throw new Error('Missing MCP token exchange shared secret.');
  }

  const resolvedExchangeUrl = tokenExchangeUrl || `${authorizationServerUrl}/oauth/internal/token-exchange`;

  const response = await fetch(resolvedExchangeUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Sanka-MCP-Token-Exchange-Secret': tokenExchangeSharedSecret,
    },
    body: JSON.stringify({
      resource: resourceUrl,
    }),
  });

  if (!response.ok) {
    let description = `Token exchange failed with status ${response.status}.`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) {
        description = payload.error;
      }
    } catch {
      // Ignore JSON parsing failures; the fallback status message is good enough.
    }
    if (response.status === 401 || response.status === 403) {
      throw new OAuthChallengeError({
        message: 'OAuth bearer token exchange failed.',
        wwwAuthenticate: buildOAuthWwwAuthenticateHeader({
          authorizationServerUrl,
          description,
          resourceMetadataUrl,
        }),
      });
    }
    throw new Error(description);
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error('Token exchange response did not include access_token.');
  }

  const expiresInSeconds =
    typeof payload.expires_in === 'number' && Number.isFinite(payload.expires_in) ? payload.expires_in : 300;
  exchangedTokenCache.set(token, {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });
  return payload.access_token;
}

async function resolveMcpSessionAccessToken({
  authorizationServerUrl,
  resourceUrl,
  sessionId,
  tokenExchangeSharedSecret,
}: {
  authorizationServerUrl: string;
  resourceUrl: string;
  sessionId: string;
  tokenExchangeSharedSecret?: string;
}): Promise<{ accessToken: string; scopes: string[] } | undefined> {
  if (!tokenExchangeSharedSecret) {
    return undefined;
  }

  const resolvedExchangeUrl = `${authorizationServerUrl}${DEFAULT_MCP_SESSION_TOKEN_PATH}`;
  const response = await fetch(resolvedExchangeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sanka-MCP-Token-Exchange-Secret': tokenExchangeSharedSecret,
    },
    body: JSON.stringify({
      resource: resourceUrl,
      session_id: sessionId,
    }),
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    let description = `MCP session token resolve failed with status ${response.status}.`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) {
        description = payload.error;
      }
    } catch {
      // Ignore JSON parse failures.
    }
    throw new Error(description);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    scope?: string;
  };
  if (!payload.access_token) {
    throw new Error('MCP session token resolve response did not include access_token.');
  }

  return {
    accessToken: payload.access_token,
    scopes: normalizeScopeClaim(payload.scope),
  };
}

export const resolveClientAuth = async ({
  advertisedAuthorizationServerUrl,
  mcpOptions,
  mcpSessionId,
  requestedScopes,
  req,
  resourceMetadataUrl,
  resourceUrl,
}: {
  advertisedAuthorizationServerUrl?: string;
  mcpOptions: McpOptions;
  mcpSessionId?: string | undefined;
  requestedScopes?: string[] | undefined;
  req: IncomingMessage;
  resourceMetadataUrl: string;
  resourceUrl: string;
}): Promise<ResolvedClientAuth> => {
  const authorizationHeader = singleHeader(req.headers.authorization);
  const apiKeyHeader = singleHeader(req.headers['x-sanka-api-key']);
  const resolvedMcpSessionId = mcpSessionId || extractMcpSessionId(req.headers);
  const internalAuthorizationServerUrl = stripTrailingSlash(
    mcpOptions.authorizationServerUrl || DEFAULT_AUTHORIZATION_SERVER_URL,
  );
  const authorizationServerUrl = stripTrailingSlash(
    advertisedAuthorizationServerUrl || internalAuthorizationServerUrl,
  );
  const connectUrl = buildMcpConnectUrl({
    authorizationServerUrl: internalAuthorizationServerUrl,
    requestedScopes,
    sessionId: resolvedMcpSessionId,
    tokenExchangeSharedSecret: mcpOptions.tokenExchangeSharedSecret,
  });

  if (!authorizationHeader) {
    if (!apiKeyHeader && resolvedMcpSessionId) {
      const resolvedSession = await resolveMcpSessionAccessToken({
        authorizationServerUrl: internalAuthorizationServerUrl,
        resourceUrl,
        sessionId: resolvedMcpSessionId,
        ...(mcpOptions.tokenExchangeSharedSecret !== undefined && {
          tokenExchangeSharedSecret: mcpOptions.tokenExchangeSharedSecret,
        }),
      });
      if (resolvedSession) {
        return {
          authMode: 'mcp_session',
          clientOptions: {
            apiKey: resolvedSession.accessToken,
          },
          oauth: {
            authorizationServerUrl,
            ...(connectUrl ? { connectUrl } : undefined),
            resourceMetadataUrl,
            resourceUrl,
            scopes: resolvedSession.scopes,
          },
        };
      }
    }

    return {
      authMode: apiKeyHeader ? 'api_key' : 'none',
      clientOptions: {
        ...(apiKeyHeader ? { apiKey: apiKeyHeader } : undefined),
      },
      oauth: {
        authorizationServerUrl,
        ...(connectUrl ? { connectUrl } : undefined),
        resourceMetadataUrl,
        resourceUrl,
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

  if (!isJwtLike(token)) {
    return {
      authMode: 'api_key',
      clientOptions: { apiKey: token },
      oauth: {
        authorizationServerUrl,
        ...(connectUrl ? { connectUrl } : undefined),
        resourceMetadataUrl,
        resourceUrl,
        scopes: [],
      },
    };
  }

  const legacyAudience = mcpOptions.legacyJwtAudience || DEFAULT_LEGACY_JWT_AUDIENCE;
  const verified = await verifyOAuthJwt({
    authorizationServerUrl: internalAuthorizationServerUrl,
    legacyAudience,
    resourceUrl,
    resourceMetadataUrl,
    token,
  });

  if (verified.audience === legacyAudience) {
    return {
      authMode: 'legacy_oauth_jwt',
      clientOptions: { apiKey: token },
      oauth: {
        authorizationServerUrl,
        ...(connectUrl ? { connectUrl } : undefined),
        resourceMetadataUrl,
        resourceUrl,
        scopes: normalizeScopeClaim(verified.payload['scope']),
      },
    };
  }

  const exchangedToken = await exchangeOAuthJwt({
    authorizationServerUrl: internalAuthorizationServerUrl,
    resourceUrl,
    resourceMetadataUrl,
    token,
    ...(mcpOptions.tokenExchangeSharedSecret !== undefined && {
      tokenExchangeSharedSecret: mcpOptions.tokenExchangeSharedSecret,
    }),
    ...(mcpOptions.tokenExchangeUrl !== undefined && {
      tokenExchangeUrl: mcpOptions.tokenExchangeUrl,
    }),
  });

  return {
    authMode: 'resource_oauth_jwt',
    clientOptions: { apiKey: exchangedToken },
    oauth: {
      authorizationServerUrl,
      ...(connectUrl ? { connectUrl } : undefined),
      resourceMetadataUrl,
      resourceUrl,
      scopes: normalizeScopeClaim(verified.payload['scope']),
    },
  };
};
