import { buildOAuthWwwAuthenticateHeader } from './auth';
import { McpRequestContext, ToolCallResult } from './types';

export const AI_CLIENT_MCP_SCOPE = 'mcp:access';
export const LEGACY_CRM_READ_SCOPES = ['contacts:read', 'companies:read'] as const;

const scopeSatisfied = ({
  grantedScopes,
  requiredScope,
}: {
  grantedScopes: Set<string>;
  requiredScope: string;
}): boolean => {
  if (requiredScope !== AI_CLIENT_MCP_SCOPE) {
    return grantedScopes.has(requiredScope);
  }

  return (
    grantedScopes.has(AI_CLIENT_MCP_SCOPE) ||
    LEGACY_CRM_READ_SCOPES.some((legacyScope) => grantedScopes.has(legacyScope))
  );
};

export const resolveMissingScopes = ({
  grantedScopes,
  requiredScopes,
}: {
  grantedScopes: Set<string>;
  requiredScopes: string[];
}): string[] =>
  requiredScopes.filter(
    (requiredScope) =>
      !scopeSatisfied({
        grantedScopes,
        requiredScope,
      }),
  );

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

  const missingScopes = resolveMissingScopes({
    grantedScopes,
    requiredScopes,
  });
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

export const requireAuthentication = ({
  reqContext,
  toolTitle,
}: {
  reqContext: McpRequestContext;
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
    });
  }

  return null;
};
