export type ToolProfile = 'full' | 'chatgpt';

const CHATGPT_CLIENT_NAME_PATTERN = /(chatgpt|openai|webplus)/i;

export function normalizeToolProfile(value: unknown): ToolProfile | undefined {
  if (typeof value !== 'string') return undefined;

  switch (value.trim().toLowerCase()) {
    case 'full':
      return 'full';
    case 'chatgpt':
      return 'chatgpt';
    default:
      return undefined;
  }
}

export function isChatGPTClientName(value: unknown): boolean {
  return typeof value === 'string' && CHATGPT_CLIENT_NAME_PATTERN.test(value);
}

export function inferToolProfile({
  explicitProfile,
  sessionProfile,
  clientInfoName,
  authorizationHeader,
  apiKeyHeader,
}: {
  explicitProfile?: ToolProfile | undefined;
  sessionProfile?: ToolProfile | undefined;
  clientInfoName?: string | undefined;
  authorizationHeader?: string | undefined;
  apiKeyHeader?: string | undefined;
}): ToolProfile {
  if (explicitProfile) return explicitProfile;
  if (sessionProfile) return sessionProfile;
  if (apiKeyHeader) return 'full';
  if (isChatGPTClientName(clientInfoName)) return 'chatgpt';
  if (authorizationHeader) return 'full';
  return 'full';
}
