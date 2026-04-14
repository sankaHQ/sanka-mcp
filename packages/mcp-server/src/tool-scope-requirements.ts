import { McpTool } from './types';

const SUPPORTED_SCOPE_KEYS = new Set([
  'bills',
  'cases',
  'companies',
  'contacts',
  'deals',
  'disbursements',
  'estimates',
  'expenses',
  'inventories',
  'inventory_transactions',
  'invoices',
  'items',
  'locations',
  'messages',
  'meters',
  'orders',
  'payments',
  'purchase_orders',
  'reports',
  'slips',
  'subscriptions',
  'tasks',
  'tickets',
  'transfers',
  'workflows',
]);

const RESOURCE_SCOPE_KEY_OVERRIDES: Record<string, string> = {
  account_messages: 'messages',
  purchaseOrders: 'purchase_orders',
};

const PROPERTY_OBJECT_SCOPE_KEY_OVERRIDES: Record<string, string> = {
  'inventory-transactions': 'inventory_transactions',
  'purchase-orders': 'purchase_orders',
};

const PROPERTY_OBJECT_SCOPE_KEY_ALIASES: Record<string, string> = {
  inventory: 'inventories',
  inventory_transaction: 'inventory-transactions',
  inventory_transactions: 'inventory-transactions',
  purchase_orders: 'purchase-orders',
  purchaseorder: 'purchase-orders',
};

type ToolAccessRequirement = {
  authenticationRequired: boolean;
  requiredScopes: string[];
};

const normalizePropertyObjectName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase().replace(/_/g, '-');
  if (!trimmed) {
    return undefined;
  }

  return PROPERTY_OBJECT_SCOPE_KEY_ALIASES[trimmed] ?? trimmed;
};

const scopeKeyForResource = (resource: string): string | undefined => {
  const explicit = RESOURCE_SCOPE_KEY_OVERRIDES[resource];
  if (explicit) {
    return explicit;
  }

  return SUPPORTED_SCOPE_KEYS.has(resource) ? resource : undefined;
};

const scopeKeyForPropertiesTool = (args: Record<string, unknown> | undefined): string | undefined => {
  const normalizedObjectName = normalizePropertyObjectName(args?.['object_name']);
  if (!normalizedObjectName) {
    return undefined;
  }

  const explicit = PROPERTY_OBJECT_SCOPE_KEY_OVERRIDES[normalizedObjectName];
  if (explicit) {
    return explicit;
  }

  const direct = normalizedObjectName.replace(/-/g, '_');
  return SUPPORTED_SCOPE_KEYS.has(direct) ? direct : undefined;
};

export const getToolRequiredScopes = ({
  tool,
  args,
}: {
  tool: McpTool;
  args?: Record<string, unknown> | undefined;
}): string[] => {
  const oauthScheme = tool.tool.securitySchemes?.find((scheme) => scheme.type === 'oauth2');
  if (!oauthScheme) {
    return [];
  }

  if (tool.metadata.resource === 'properties') {
    const propertyScopeKey = scopeKeyForPropertiesTool(args);
    if (!propertyScopeKey) {
      return [];
    }
    return [`${propertyScopeKey}:${tool.metadata.operation}`];
  }

  const scopeKey = scopeKeyForResource(tool.metadata.resource);
  if (!scopeKey) {
    return [];
  }

  return [`${scopeKey}:${tool.metadata.operation}`];
};

export const buildToolAccessRequirements = ({
  tools,
  argsByToolName,
}: {
  tools: McpTool[];
  argsByToolName?: Record<string, Record<string, unknown> | undefined> | undefined;
}): Record<string, ToolAccessRequirement> =>
  Object.fromEntries(
    tools.map((tool) => {
      const authenticationRequired =
        tool.tool.securitySchemes?.some((scheme) => scheme.type === 'oauth2') ?? false;
      const requiredScopes = getToolRequiredScopes({
        tool,
        args: argsByToolName?.[tool.tool.name],
      });
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
