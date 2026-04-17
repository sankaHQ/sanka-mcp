// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { createHash, randomUUID } from 'node:crypto';
import { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { ClientOptions } from 'sanka-sdk';
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
    `${authorizationServerUrl}/oauth/authorize`,
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
  const authorizationHeader = singleHeader(req.headers.authorization);
  const apiKeyHeader = singleHeader(req.headers['x-sanka-api-key']);
  const authorizationServerUrl = resolveAuthorizationServerUrl(mcpOptions);

  const oauthContext = {
    authorizationServerUrl,
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
