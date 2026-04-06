import {
  inferPathProfile,
  inferToolProfile,
  isChatGPTClientName,
  isChatGPTUserAgent,
  normalizeToolProfile,
} from '../../packages/mcp-server/src/profile';

describe('tool profile detection', () => {
  it('only accepts the unified full profile', () => {
    expect(normalizeToolProfile('FULL')).toBe('full');
    expect(normalizeToolProfile('crm')).toBeUndefined();
    expect(normalizeToolProfile('chatgpt')).toBeUndefined();
  });

  it('no longer special-cases client names or user agents', () => {
    expect(isChatGPTClientName('ChatGPT')).toBe(false);
    expect(isChatGPTUserAgent('openai-mcp/1.0.0 (ChatGPT)')).toBe(false);
  });

  it('does not reserve a dedicated CRM route anymore', () => {
    expect(inferPathProfile('/mcp/crm')).toBeUndefined();
    expect(inferPathProfile('/.well-known/oauth-protected-resource/mcp/crm')).toBeUndefined();
    expect(inferPathProfile('/mcp')).toBeUndefined();
  });

  it('always resolves to the unified full profile', () => {
    expect(
      inferToolProfile({
        explicitProfile: 'full',
        authorizationHeader: 'Bearer legacy-token',
      }),
    ).toBe('full');

    expect(
      inferToolProfile({
        sessionProfile: 'full',
        apiKeyHeader: 'sk_live_example',
      }),
    ).toBe('full');

    expect(
      inferToolProfile({
        clientInfoName: 'ChatGPT',
        userAgent: 'openai-mcp/1.0.0 (ChatGPT)',
      }),
    ).toBe('full');
  });
});
