import { buildOAuthWwwAuthenticateHeader } from './auth';
import {
  buildMcpConnectMarkdownLink,
  buildMcpConnectStructuredReply,
  buildMcpConnectUserFacingReply,
  buildOAuthAuthorizationUrl,
  normalizeMcpConnectScopes,
} from './mcp-connect';
import { mcpClientLooksLikeNativeOAuthClient } from './mcp-client-info';
import { oauthScopeSatisfied } from './tool-scope-requirements';
import { McpRequestContext, ToolCallResult } from './types';

const RECONNECT_SERVER_NAME = 'sanka';

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
  const isNativeOAuthClient = mcpClientLooksLikeNativeOAuthClient(reqContext.mcpClientInfo);
  const shouldIncludeConnectUrl = !isNativeOAuthClient;
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
        ...(connectUrl && shouldIncludeConnectUrl ?
          {
            connect_url: connectUrl,
            connect_scopes: connectScopes,
            ...buildMcpConnectStructuredReply(connectUrl),
          }
        : undefined),
        resource_metadata_url: oauth.resourceMetadataUrl,
        resource_url: oauth.resourceUrl,
        reconnect_mode: 'client_native_oauth',
        reconnect_rpc_method: 'mcpServer/oauth/login',
        reconnect_server_name: RECONNECT_SERVER_NAME,
        reconnect_instructions:
          isNativeOAuthClient ?
            'Use the MCP client native OAuth reconnect flow for this Sanka server, then retry the original request. Do not show a Connect URL to the user.'
          : 'If connect_url is present, the assistant must include required_user_facing_reply in the next visible response. Do not omit the URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. In clients with native OAuth UI, that UI may also be used, then retry the original request.',
      }
    : undefined;
  const visibleMessage =
    reconnectMetadata ?
      [
        message,
        connectUrl && shouldIncludeConnectUrl ?
          `Connect Sanka: ${buildMcpConnectMarkdownLink(connectUrl)}`
        : undefined,
        connectUrl && shouldIncludeConnectUrl ?
          `Required user-facing reply: ${buildMcpConnectUserFacingReply(connectUrl)}`
        : undefined,
        `OAuth authorization URL: ${authorizationUrl}`,
        `MCP resource metadata URL: ${oauth?.resourceMetadataUrl}`,
        `Codex reconnect action: mcpServer/oauth/login for server ${RECONNECT_SERVER_NAME}.`,
        shouldIncludeConnectUrl ?
          'Claude: open the Connect Sanka URL or approve the Sanka connector OAuth prompt, then retry.'
        : undefined,
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
