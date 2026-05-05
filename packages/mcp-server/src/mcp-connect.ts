import { createHmac } from 'node:crypto';

export const MCP_ACCESS_SCOPE = 'mcp:access';

const DEFAULT_CONNECT_TOKEN_TTL_SECONDS = 15 * 60;
const MCP_CONNECT_PATH = '/oauth/mcp/connect';

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const base64UrlEncode = (value: Buffer | string): string => Buffer.from(value).toString('base64url');

export const buildOAuthAuthorizationUrl = (authorizationServerUrl: string): string =>
  `${stripTrailingSlash(authorizationServerUrl)}/oauth/authorize`;

export const normalizeMcpConnectScopes = (_scopes?: string[] | undefined): string[] => [MCP_ACCESS_SCOPE];

export const buildMcpConnectMarkdownLink = (connectUrl: string): string => `[${connectUrl}](${connectUrl})`;

export const buildMcpConnectUserFacingReply = (connectUrl: string): string =>
  [
    'Sanka MCP authentication is required. Open this exact full Connect Sanka URL, then retry:',
    '',
    buildMcpConnectMarkdownLink(connectUrl),
  ].join('\n');

export const buildMcpConnectStructuredReply = (
  connectUrl: string | undefined,
): Record<string, unknown> | undefined =>
  connectUrl ?
    {
      connect_url_markdown: buildMcpConnectMarkdownLink(connectUrl),
      required_user_facing_reply: buildMcpConnectUserFacingReply(connectUrl),
    }
  : undefined;

export const buildMcpConnectToken = ({
  now = Date.now(),
  scopes,
  sessionId,
  sharedSecret,
  ttlSeconds = DEFAULT_CONNECT_TOKEN_TTL_SECONDS,
}: {
  now?: number;
  scopes?: string[] | undefined;
  sessionId: string;
  sharedSecret: string;
  ttlSeconds?: number;
}): string | undefined => {
  const normalizedSecret = sharedSecret.trim();
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSecret || !normalizedSessionId) {
    return undefined;
  }

  const issuedAt = Math.floor(now / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      v: 1,
      sid: normalizedSessionId,
      scp: normalizeMcpConnectScopes(scopes),
      iat: issuedAt,
      exp: issuedAt + ttlSeconds,
    }),
  );
  const signature = createHmac('sha256', normalizedSecret).update(payload).digest();
  return `${payload}.${base64UrlEncode(signature)}`;
};

export const buildMcpConnectUrl = ({
  authorizationServerUrl,
  scopes,
  sessionId,
  sharedSecret,
}: {
  authorizationServerUrl: string;
  scopes?: string[] | undefined;
  sessionId: string;
  sharedSecret?: string | undefined;
}): string | undefined => {
  if (!sharedSecret) {
    return undefined;
  }
  const token = buildMcpConnectToken({
    scopes,
    sessionId,
    sharedSecret,
  });
  if (!token) {
    return undefined;
  }

  const url = new URL(MCP_CONNECT_PATH, `${stripTrailingSlash(authorizationServerUrl)}/`);
  url.searchParams.set('token', token);
  return url.toString();
};
