export type McpClientInfo = {
  name: string;
  version: string;
};

export const valueLooksLikeCodex = (value: string | undefined): boolean => /\bcodex\b/i.test(value ?? '');

export const valueLooksLikeClaude = (value: string | undefined): boolean =>
  /\b(anthropic|claude)\b/i.test(value ?? '');

export const valueLooksLikeNativeOAuthClient = (value: string | undefined): boolean =>
  valueLooksLikeCodex(value) || valueLooksLikeClaude(value);

export const mcpClientLooksLikeCodex = (clientInfo: McpClientInfo | undefined): boolean =>
  valueLooksLikeCodex(clientInfo?.name) || valueLooksLikeCodex(clientInfo?.version);

export const mcpClientLooksLikeClaude = (clientInfo: McpClientInfo | undefined): boolean =>
  valueLooksLikeClaude(clientInfo?.name) || valueLooksLikeClaude(clientInfo?.version);

export const mcpClientLooksLikeNativeOAuthClient = (clientInfo: McpClientInfo | undefined): boolean =>
  mcpClientLooksLikeCodex(clientInfo) || mcpClientLooksLikeClaude(clientInfo);
