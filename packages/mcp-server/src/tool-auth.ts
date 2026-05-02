import { buildOAuthWwwAuthenticateHeader } from './auth';
import { McpRequestContext, ToolCallResult } from './types';

const scopeSatisfied = ({
  grantedScopes,
  requiredScope,
}: {
  grantedScopes: Set<string>;
  requiredScope: string;
}): boolean => grantedScopes.has(requiredScope);

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
  const reconnectMetadata =
    oauth ?
      {
        authorization_server_url: oauth.authorizationServerUrl,
        resource_metadata_url: oauth.resourceMetadataUrl,
        resource_url: oauth.resourceUrl,
        reconnect_mode: 'client_native_oauth',
        reconnect_rpc_method: 'mcpServer/oauth/login',
        reconnect_server_name: 'sanka_plugin',
        reconnect_instructions:
          'Use your MCP client OAuth flow to reconnect Sanka. In Codex, call mcpServer/oauth/login for server sanka_plugin. In Claude, approve the Sanka connector OAuth prompt. Then retry the original request.',
      }
    : undefined;
  const visibleMessage =
    reconnectMetadata ?
      `${message}\n\nUse your MCP client OAuth flow to reconnect Sanka. In Codex, call mcpServer/oauth/login for server sanka_plugin. In Claude, approve the Sanka connector OAuth prompt. Then retry.`
    : message;

  return {
    content: [{ type: 'text', text: visibleMessage }],
    isError: true,
    structuredContent: {
      error,
      ...(requiredScopes?.length ? { required_scopes: requiredScopes } : undefined),
      ...reconnectMetadata,
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

  if (auth.authMode === 'none') {
    return authErrorResult({
      error: 'invalid_token',
      message: `Authentication required to use ${toolTitle}.`,
      reqContext,
      requiredScopes,
    });
  }

  const grantedScopes = new Set(auth.oauth.scopes);
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

  if (auth.authMode === 'none') {
    return authErrorResult({
      error: 'invalid_token',
      message: `Authentication required to use ${toolTitle}.`,
      reqContext,
    });
  }

  return null;
};
