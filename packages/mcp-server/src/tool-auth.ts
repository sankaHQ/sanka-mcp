import { buildOAuthWwwAuthenticateHeader } from './auth';
import { McpRequestContext, ToolCallResult } from './types';

const authErrorResult = ({
  error,
  message,
  reqContext,
  requiredScopes,
}: {
  error: 'insufficient_scope' | 'invalid_token';
  message: string;
  reqContext: McpRequestContext;
  requiredScopes?: string[] | undefined;
}): ToolCallResult => {
  const oauth = reqContext.auth?.oauth;
  const wwwAuthenticate =
    oauth ?
      buildOAuthWwwAuthenticateHeader({
        authorizationServerUrl: oauth.authorizationServerUrl,
        description: message,
        error,
        resourceMetadataUrl: oauth.resourceMetadataUrl,
        ...(requiredScopes?.length ? { scope: requiredScopes.join(' ') } : undefined),
      })
    : undefined;

  return {
    content: [{ type: 'text', text: message }],
    isError: true,
    structuredContent: {
      error,
      ...(requiredScopes?.length ? { required_scopes: requiredScopes } : undefined),
    },
    ...(wwwAuthenticate ?
      {
        _meta: {
          'mcp/www_authenticate': [wwwAuthenticate],
        },
      }
    : undefined),
  };
};

export const requireScopes = ({
  reqContext,
  requiredScopes,
  toolTitle,
}: {
  reqContext: McpRequestContext;
  requiredScopes: string[];
  toolTitle: string;
}): ToolCallResult | null => {
  const auth = reqContext.auth;
  if (!auth) {
    return null;
  }

  if (auth.authMode === 'api_key') {
    return null;
  }

  if (auth.authMode === 'none') {
    return authErrorResult({
      error: 'invalid_token',
      message: `Authentication required to use ${toolTitle}.`,
      reqContext,
      requiredScopes,
    });
  }

  const grantedScopes = new Set(auth.oauth.scopes);
  if (grantedScopes.size === 0 && auth.authMode === 'legacy_oauth_jwt') {
    return null;
  }

  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.has(scope));
  if (missingScopes.length === 0) {
    return null;
  }

  return authErrorResult({
    error: 'insufficient_scope',
    message: `${toolTitle} requires the following OAuth scopes: ${missingScopes.join(', ')}.`,
    reqContext,
    requiredScopes: missingScopes,
  });
};
