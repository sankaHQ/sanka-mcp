export type ToolProfile = 'full' | 'hosted';

export function normalizeToolProfile(value: unknown): ToolProfile | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'full' || normalized === 'hosted') {
    return normalized;
  }
  return undefined;
}

export function isChatGPTClientName(_value: unknown): boolean {
  return false;
}

export function isChatGPTUserAgent(_value: unknown): boolean {
  return false;
}

export function inferToolProfile(_: {
  routeProfile?: ToolProfile | undefined;
  explicitProfile?: ToolProfile | undefined;
  sessionProfile?: ToolProfile | undefined;
  clientInfoName?: string | undefined;
  userAgent?: string | undefined;
  authorizationHeader?: string | undefined;
  apiKeyHeader?: string | undefined;
}): ToolProfile {
  return _.routeProfile ?? _.explicitProfile ?? _.sessionProfile ?? 'full';
}

export function inferPathProfile(_pathname: unknown): ToolProfile | undefined {
  return undefined;
}
