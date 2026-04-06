export type ToolProfile = 'full';

export function normalizeToolProfile(value: unknown): ToolProfile | undefined {
  return typeof value === 'string' && value.trim().toLowerCase() === 'full' ? 'full' : undefined;
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
  return 'full';
}

export function inferPathProfile(_pathname: unknown): ToolProfile | undefined {
  return undefined;
}
