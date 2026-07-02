// Reconnect RPCs (mcpServer/oauth/login) target the server name as keyed in
// the CLIENT's local MCP config, which this server cannot observe. The 0.5.0
// Sakura plugin declares its key via this header; clients that do not declare
// one are legacy installs keyed "sanka", so that stays the fallback until
// those installs are migrated.
export const RECONNECT_SERVER_NAME_HEADER = 'x-mcp-reconnect-server-name';
export const LEGACY_RECONNECT_SERVER_NAME = 'sanka';

const VALID_SERVER_NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const resolveReconnectServerName = (hint?: string | undefined): string => {
  const normalized = hint?.trim().toLowerCase();
  if (normalized && VALID_SERVER_NAME.test(normalized)) {
    return normalized;
  }
  return LEGACY_RECONNECT_SERVER_NAME;
};

export const reconnectServerNameHintFromHeaders = (headers: Record<string, unknown>): string | undefined => {
  const raw = headers[RECONNECT_SERVER_NAME_HEADER];
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    return raw[0];
  }
  return undefined;
};
