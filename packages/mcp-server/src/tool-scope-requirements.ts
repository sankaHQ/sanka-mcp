import { McpTool } from './types';

export const SANKA_API_ACCESS_SCOPE = 'api-access';
export const SANKA_MCP_ACCESS_SCOPE = 'mcp:access';

export const DEFAULT_CONNECT_SANKA_SCOPES = [SANKA_MCP_ACCESS_SCOPE] as const;

export const SANKA_MCP_DELEGATED_SCOPES = [
  'account_messages:read',
  'account_messages:write',
  'app_builder:read',
  'app_builder:write',
  'approval_requests:read',
  'approval_requests:write',
  'associations:read',
  'associations:write',
  'auth:read',
  'auth:write',
  'bills:read',
  'bills:write',
  'absences:read',
  'absences:write',
  'attendance_records:read',
  'attendance_records:write',
  'calendar:read',
  'calendar:write',
  'cases:read',
  'cases:write',
  'companies:read',
  'companies:write',
  'contacts:read',
  'contacts:write',
  'custom_objects:read',
  'custom_objects:write',
  'deals:create',
  'deals:read',
  'deals:write',
  'disbursements:read',
  'disbursements:write',
  'downloads:read',
  'estimates:read',
  'estimates:write',
  'expenses:read',
  'expenses:write',
  'employees:read',
  'incentives:read',
  'incentives:write',
  'inventories:read',
  'inventories:write',
  'inventory_transactions:read',
  'inventory_transactions:write',
  'invoices:read',
  'invoices:write',
  'items:read',
  'items:write',
  'journals:read',
  'journals:write',
  'locations:read',
  'locations:write',
  'logs:read',
  'messages:read',
  'messages:write',
  'meters:read',
  'meters:write',
  'object_schemas:read',
  'object_schemas:write',
  'orders:read',
  'orders:write',
  'payments:read',
  'payments:write',
  'payroll:read',
  'payroll:write',
  'payroll_profiles:read',
  'payroll_profiles:write',
  'payroll_runs:read',
  'payroll_runs:write',
  'permission_sets:read',
  'permission_sets:write',
  'pipeline_snapshots:read',
  'pipeline_snapshots:write',
  'properties:read',
  'properties:write',
  'prospect:read',
  'purchase_orders:read',
  'purchase_orders:write',
  'records:read',
  'records:write',
  'reports:read',
  'reports:write',
  'score:read',
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
  'views:read',
  'views:write',
  'workspace_messages:read',
  'workspace_messages:write',
  'workflows:read',
  'workflows:write',
] as const;

const SANKA_MCP_DELEGATED_SCOPE_SET = new Set<string>(SANKA_MCP_DELEGATED_SCOPES);

const isDelegatedMcpToolScope = (scope: string): boolean => SANKA_MCP_DELEGATED_SCOPE_SET.has(scope);

const normalizeScopeResource = (resource: string): string =>
  resource
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();

export const oauthScopeSatisfied = ({
  grantedScopes,
  requiredScope,
}: {
  grantedScopes: Set<string>;
  requiredScope: string;
}): boolean =>
  grantedScopes.has(SANKA_API_ACCESS_SCOPE) ||
  grantedScopes.has(requiredScope) ||
  (grantedScopes.has(SANKA_MCP_ACCESS_SCOPE) && isDelegatedMcpToolScope(requiredScope));

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
  if (!oauthScheme) {
    return [];
  }
  const resource = normalizeScopeResource(tool.metadata.resource ?? '');
  if (!resource) {
    return [SANKA_MCP_ACCESS_SCOPE];
  }
  const action = tool.metadata.operation === 'read' ? 'read' : 'write';
  const scope = `${resource}:${action}`;
  return isDelegatedMcpToolScope(scope) ? [scope] : [SANKA_MCP_ACCESS_SCOPE];
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
