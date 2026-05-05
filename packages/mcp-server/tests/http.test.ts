import { buildAuthorizationServerMetadata } from '../src/http';

describe('buildAuthorizationServerMetadata', () => {
  it('omits client_id when oauth client id is not configured', () => {
    const metadata = buildAuthorizationServerMetadata({
      authorizationServerUrl: 'https://app.example.com',
      scopesSupported: ['user-scope', 'api-access'],
    });

    expect(metadata.client_id).toBeUndefined();
    expect(metadata.registration_endpoint).toBe('https://app.example.com/api/v1/oauth/register');
  });

  it('includes client_id when oauth client id is configured', () => {
    const metadata = buildAuthorizationServerMetadata({
      authorizationServerUrl: 'https://app.example.com',
      oauthClientId: 'oauth-client-123',
      scopesSupported: ['user-scope', 'api-access'],
    });

    expect(metadata.client_id).toBe('oauth-client-123');
    expect(metadata.registration_endpoint).toBe('https://app.example.com/api/v1/oauth/register');
  });
});
