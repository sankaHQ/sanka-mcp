import {
  inferPathProfile,
  inferToolProfile,
  isChatGPTClientName,
  isChatGPTUserAgent,
  normalizeToolProfile,
} from '../../packages/mcp-server/src/profile';

describe('tool profile detection', () => {
  it('accepts the supported tool profiles', () => {
    expect(normalizeToolProfile('FULL')).toBe('full');
    expect(normalizeToolProfile('HOSTED')).toBe('hosted');
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

  it('prefers explicit route/session profiles before falling back to full', () => {
    expect(
      inferToolProfile({
        explicitProfile: 'full',
        authorizationHeader: 'Bearer legacy-token',
      }),
    ).toBe('full');

    expect(
      inferToolProfile({
        routeProfile: 'hosted',
        explicitProfile: 'full',
        authorizationHeader: 'Bearer legacy-token',
      }),
    ).toBe('hosted');

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
