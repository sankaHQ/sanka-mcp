import {
  buildMcpConnectMarkdownLink,
  buildMcpConnectStructuredReply,
  buildMcpConnectUserFacingReply,
  normalizeMcpConnectScopes,
} from './mcp-connect';
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
  const connectUrl = oauth?.connectUrlForScopes?.(requiredScopes);
  const connectScopes = normalizeMcpConnectScopes(requiredScopes);
  const reconnectMetadata =
    oauth ?
      {
        ...(connectUrl ?
          {
            connect_url: connectUrl,
            connect_scopes: connectScopes,
            ...buildMcpConnectStructuredReply(connectUrl),
          }
        : undefined),
        resource_url: oauth.resourceUrl,
        reconnect_mode: 'connect_sanka',
        reconnect_instructions:
          'The assistant must include required_user_facing_reply in the next visible response. Do not omit the Connect Sanka URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. Then retry the original request.',
      }
    : undefined;
  const visibleMessage =
    reconnectMetadata ?
      [
        message,
        connectUrl ? `Connect Sanka: ${buildMcpConnectMarkdownLink(connectUrl)}` : undefined,
        connectUrl ? `Required user-facing reply: ${buildMcpConnectUserFacingReply(connectUrl)}` : undefined,
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
    message: `${toolTitle} requires the following Sanka access scopes: ${missingScopes.join(', ')}.`,
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
