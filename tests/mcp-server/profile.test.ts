import {
  inferPathProfile,
  inferToolProfile,
  isChatGPTClientName,
  isChatGPTUserAgent,
  normalizeToolProfile,
} from '../../packages/mcp-server/src/profile';

describe('tool profile detection', () => {
  it('normalizes explicit profile overrides', () => {
    expect(normalizeToolProfile('chatgpt')).toBe('crm');
    expect(normalizeToolProfile('crm')).toBe('crm');
    expect(normalizeToolProfile('FULL')).toBe('full');
    expect(normalizeToolProfile('unknown')).toBeUndefined();
  });

  it('detects ChatGPT-style client names', () => {
    expect(isChatGPTClientName('ChatGPT')).toBe(true);
    expect(isChatGPTClientName('OpenAI Developer Mode')).toBe(true);
    expect(isChatGPTClientName('Claude Desktop')).toBe(false);
  });

  it('detects ChatGPT-style user agents', () => {
    expect(isChatGPTUserAgent('openai-mcp/1.0.0 (ChatGPT)')).toBe(true);
    expect(isChatGPTUserAgent('ChatGPT')).toBe(true);
    expect(isChatGPTUserAgent('Claude Desktop')).toBe(false);
  });

  it('locks the crm profile for the dedicated route path', () => {
    expect(inferPathProfile('/mcp/crm')).toBe('crm');
    expect(inferPathProfile('/.well-known/oauth-protected-resource/mcp/crm')).toBe('crm');
    expect(inferPathProfile('/mcp')).toBeUndefined();
  });

  it('prefers explicit profile overrides', () => {
    expect(
      inferToolProfile({
        explicitProfile: 'crm',
        authorizationHeader: 'Bearer legacy-token',
      }),
    ).toBe('crm');
  });

  it('uses the remembered session profile when available', () => {
    expect(
      inferToolProfile({
        sessionProfile: 'crm',
        authorizationHeader: 'Bearer legacy-token',
      }),
    ).toBe('crm');
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

  it('routes recognized OpenAI clients to the crm profile', () => {
    expect(
      inferToolProfile({
        clientInfoName: 'ChatGPT',
      }),
    ).toBe('crm');
  });

  it('routes recognized OpenAI user agents to the crm profile', () => {
    expect(
      inferToolProfile({
        authorizationHeader: 'Bearer eyJ.example',
        userAgent: 'openai-mcp/1.0.0 (ChatGPT)',
      }),
    ).toBe('crm');
  });
});
