import { inferToolProfile, isChatGPTClientName, normalizeToolProfile } from '../../packages/mcp-server/src/profile';

describe('tool profile detection', () => {
  it('normalizes explicit profile overrides', () => {
    expect(normalizeToolProfile('chatgpt')).toBe('chatgpt');
    expect(normalizeToolProfile('FULL')).toBe('full');
    expect(normalizeToolProfile('unknown')).toBeUndefined();
  });

  it('detects ChatGPT-style client names', () => {
    expect(isChatGPTClientName('ChatGPT')).toBe(true);
    expect(isChatGPTClientName('OpenAI Developer Mode')).toBe(true);
    expect(isChatGPTClientName('Claude Desktop')).toBe(false);
  });

  it('prefers explicit profile overrides', () => {
    expect(
      inferToolProfile({
        explicitProfile: 'chatgpt',
        authorizationHeader: 'Bearer legacy-token',
      }),
    ).toBe('chatgpt');
  });

  it('uses the remembered session profile when available', () => {
    expect(
      inferToolProfile({
        sessionProfile: 'chatgpt',
        authorizationHeader: 'Bearer legacy-token',
      }),
    ).toBe('chatgpt');
  });

  it('routes api-key and legacy bearer traffic to the full profile', () => {
    expect(
      inferToolProfile({
        apiKeyHeader: 'sk_live_example',
      }),
    ).toBe('full');

    expect(
      inferToolProfile({
        authorizationHeader: 'Bearer legacy-token',
      }),
    ).toBe('full');
  });

  it('routes recognized OpenAI clients to the chatgpt profile', () => {
    expect(
      inferToolProfile({
        clientInfoName: 'ChatGPT',
      }),
    ).toBe('chatgpt');
  });
});
