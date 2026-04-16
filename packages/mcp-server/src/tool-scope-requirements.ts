import { McpTool } from './types';

export const SANKA_API_ACCESS_SCOPE = 'api-access';

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

  return [SANKA_API_ACCESS_SCOPE];
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
