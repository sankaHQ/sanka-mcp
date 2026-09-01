export type McpClientInfo = {
  name: string;
  version: string;
};

export const valueLooksLikeCodex = (value: string | undefined): boolean => /\bcodex\b/i.test(value ?? '');

export const valueLooksLikeClaude = (value: string | undefined): boolean =>
  /\b(anthropic|claude)\b/i.test(value ?? '');
