import {
  LEGACY_RECONNECT_SERVER_NAME,
  reconnectServerNameHintFromHeaders,
  resolveReconnectServerName,
} from '../../packages/mcp-server/src/reconnect-name';

describe('resolveReconnectServerName', () => {
  it('falls back to the legacy name when no hint is declared', () => {
    expect(resolveReconnectServerName(undefined)).toBe(LEGACY_RECONNECT_SERVER_NAME);
    expect(resolveReconnectServerName('')).toBe('sanka');
  });

  it('accepts a valid client-declared name', () => {
    expect(resolveReconnectServerName('sakura')).toBe('sakura');
    expect(resolveReconnectServerName(' Sakura ')).toBe('sakura');
    expect(resolveReconnectServerName('my_sanka-2')).toBe('my_sanka-2');
  });

  it('rejects invalid hints', () => {
    expect(resolveReconnectServerName('bad name')).toBe('sanka');
    expect(resolveReconnectServerName('-leading')).toBe('sanka');
    expect(resolveReconnectServerName('x'.repeat(80))).toBe('sanka');
  });
});

describe('reconnectServerNameHintFromHeaders', () => {
  it('reads string and array header values', () => {
    expect(
      reconnectServerNameHintFromHeaders({ 'x-mcp-reconnect-server-name': 'sakura' }),
    ).toBe('sakura');
    expect(
      reconnectServerNameHintFromHeaders({ 'x-mcp-reconnect-server-name': ['sakura'] }),
    ).toBe('sakura');
    expect(reconnectServerNameHintFromHeaders({})).toBeUndefined();
  });
});
