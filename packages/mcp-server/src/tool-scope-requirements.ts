import { McpTool } from './types';

export const SANKA_API_ACCESS_SCOPE = 'api-access';
export const SANKA_MCP_ACCESS_SCOPE = 'mcp:access';

export const DEFAULT_CONNECT_SANKA_SCOPES = [SANKA_MCP_ACCESS_SCOPE] as const;

const SANKA_MCP_DELEGATED_SCOPES = new Set([
  'bills:read',
  'bills:write',
  'cases:read',
  'cases:write',
  'companies:read',
  'companies:write',
  'contacts:read',
  'contacts:write',
  'deals:create',
  'deals:read',
  'deals:write',
  'disbursements:read',
  'disbursements:write',
  'estimates:read',
  'estimates:write',
  'expenses:read',
  'expenses:write',
  'inventories:read',
  'inventories:write',
  'inventory_transactions:read',
  'inventory_transactions:write',
  'invoices:read',
  'invoices:write',
  'items:read',
  'items:write',
  'locations:read',
  'locations:write',
  'logs:read',
  'messages:read',
  'messages:write',
  'meters:read',
  'meters:write',
  'orders:read',
  'orders:write',
  'payments:read',
  'payments:write',
  'purchase_orders:read',
  'purchase_orders:write',
  'reports:read',
  'reports:write',
  'slips:read',
  'slips:write',
  'subscriptions:read',
  'subscriptions:write',
  'tasks:read',
  'tasks:write',
  'tickets:read',
  'tickets:write',
  'transfers:read',
  'transfers:write',
  'workflows:read',
  'workflows:write',
]);

export const oauthScopeSatisfied = ({
  grantedScopes,
  requiredScope,
}: {
  grantedScopes: Set<string>;
  requiredScope: string;
}): boolean =>
  grantedScopes.has(SANKA_API_ACCESS_SCOPE) ||
  grantedScopes.has(requiredScope) ||
  (grantedScopes.has(SANKA_MCP_ACCESS_SCOPE) && SANKA_MCP_DELEGATED_SCOPES.has(requiredScope));

type ToolAccessRequirement = {
  authenticationRequired: boolean;
  requiredScopes: string[];
};

export const getToolRequiredScopes = ({
  tool,
}: {
  tool: McpTool;
  args?: Record<string, unknown> | undefined;
}): string[] => {
  const oauthScheme = tool.tool.securitySchemes?.find((scheme) => scheme.type === 'oauth2');
  return oauthScheme ? [SANKA_MCP_ACCESS_SCOPE] : [];
};

export const buildToolAccessRequirements = ({
  tools,
}: {
  tools: McpTool[];
  argsByToolName?: Record<string, Record<string, unknown> | undefined> | undefined;
}): Record<string, ToolAccessRequirement> =>
  Object.fromEntries(
    tools.map((tool) => {
      const authenticationRequired =
        tool.tool.securitySchemes?.some((scheme) => scheme.type === 'oauth2') ?? false;
      const requiredScopes = getToolRequiredScopes({ tool });
      return [
        tool.tool.name,
        {
          authenticationRequired,
          requiredScopes,
        },
      ];
    }),
  );

export const applyRequiredScopesToSecuritySchemes = (tool: McpTool): McpTool => {
  const requiredScopes = getToolRequiredScopes({ tool });
  if (requiredScopes.length === 0 || !tool.tool.securitySchemes?.length) {
    return tool;
  }

  const securitySchemes = tool.tool.securitySchemes.map((scheme) =>
    scheme.type === 'oauth2' ? { ...scheme, scopes: requiredScopes } : scheme,
  );

  return {
    ...tool,
    tool: {
      ...tool.tool,
      securitySchemes,
    },
  };
};
