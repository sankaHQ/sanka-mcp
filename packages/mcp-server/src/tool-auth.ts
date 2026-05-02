import { buildOAuthWwwAuthenticateHeader } from './auth';
import { buildOAuthAuthorizationUrl, normalizeMcpConnectScopes } from './mcp-connect';
import { oauthScopeSatisfied } from './tool-scope-requirements';
import { McpRequestContext, ToolCallResult } from './types';

export const resolveMissingScopes = ({
  grantedScopes,
  requiredScopes,
}: {
  grantedScopes: Set<string>;
  requiredScopes: string[];
}): string[] =>
  requiredScopes.filter(
    (requiredScope) =>
      !oauthScopeSatisfied({
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
  const authorizationUrl =
    oauth ? oauth.authorizationUrl ?? buildOAuthAuthorizationUrl(oauth.authorizationServerUrl) : undefined;
  const connectUrl = oauth?.connectUrlForScopes?.(requiredScopes);
  const connectScopes = normalizeMcpConnectScopes(requiredScopes);
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
        authorization_url: authorizationUrl,
        ...(connectUrl ? { connect_url: connectUrl, connect_scopes: connectScopes } : undefined),
        resource_metadata_url: oauth.resourceMetadataUrl,
        resource_url: oauth.resourceUrl,
        reconnect_mode: 'client_native_oauth',
        reconnect_rpc_method: 'mcpServer/oauth/login',
        reconnect_server_name: 'sanka_plugin',
        reconnect_instructions:
          'Use your MCP client OAuth flow to reconnect Sanka. If connect_url is present, include the exact full connect_url in the visible response body without abbreviation. In Codex, call mcpServer/oauth/login for server sanka_plugin. In Claude, open the full Connect Sanka URL or approve the Sanka connector OAuth prompt. Then retry the original request.',
      }
    : undefined;
  const visibleMessage =
    reconnectMetadata ?
      [
        message,
        connectUrl ? `Connect Sanka: ${connectUrl}` : undefined,
        connectUrl ?
          `Required user-facing reply: include this exact full Connect Sanka URL in the response body as a clickable link. Do not abbreviate the token, replace it with "...", or refer only to "the link above": ${connectUrl}`
        : undefined,
        `OAuth authorization URL: ${authorizationUrl}`,
        `MCP resource metadata URL: ${oauth?.resourceMetadataUrl}`,
        'Codex reconnect action: mcpServer/oauth/login for server sanka_plugin.',
        'Claude: open the Connect Sanka URL or approve the Sanka connector OAuth prompt, then retry.',
      ]
        .filter(Boolean)
        .join('\n\n')
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
