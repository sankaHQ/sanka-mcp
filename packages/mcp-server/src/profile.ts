export type ToolProfile = 'full' | 'crm';

const CHATGPT_CLIENT_NAME_PATTERN = /(chatgpt|openai|webplus)/i;
const CHATGPT_USER_AGENT_PATTERN = /(openai-mcp|chatgpt|webplus)/i;
const CRM_ROUTE_PATHS = new Set(['/mcp/crm', '/sse/crm', '/.well-known/oauth-protected-resource/mcp/crm']);

const normalizePathname = (value: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return '/';
  }
  return normalized.endsWith('/') && normalized !== '/' ? normalized.replace(/\/+$/, '') : normalized;
};

export function normalizeToolProfile(value: unknown): ToolProfile | undefined {
  if (typeof value !== 'string') return undefined;

  switch (value.trim().toLowerCase()) {
    case 'full':
      return 'full';
    case 'crm':
    case 'chatgpt':
      return 'crm';
    default:
      return undefined;
  }
}

export function isChatGPTClientName(value: unknown): boolean {
  return typeof value === 'string' && CHATGPT_CLIENT_NAME_PATTERN.test(value);
}

export function isChatGPTUserAgent(value: unknown): boolean {
  return typeof value === 'string' && CHATGPT_USER_AGENT_PATTERN.test(value);
}

export function inferToolProfile({
  routeProfile,
  explicitProfile,
  sessionProfile,
  clientInfoName,
  userAgent,
  authorizationHeader,
  apiKeyHeader,
}: {
  routeProfile?: ToolProfile | undefined;
  explicitProfile?: ToolProfile | undefined;
  sessionProfile?: ToolProfile | undefined;
  clientInfoName?: string | undefined;
  userAgent?: string | undefined;
  authorizationHeader?: string | undefined;
  apiKeyHeader?: string | undefined;
}): ToolProfile {
  if (routeProfile) return routeProfile;
  if (explicitProfile) return explicitProfile;
  if (sessionProfile) return sessionProfile;
  if (apiKeyHeader) return 'full';
  if (isChatGPTClientName(clientInfoName)) return 'crm';
  if (isChatGPTUserAgent(userAgent)) return 'crm';
  if (authorizationHeader) return 'full';
  return 'full';
}

export function inferPathProfile(pathname: unknown): ToolProfile | undefined {
  if (typeof pathname !== 'string') {
    return undefined;
  }
  return CRM_ROUTE_PATHS.has(normalizePathname(pathname)) ? 'crm' : undefined;
}
