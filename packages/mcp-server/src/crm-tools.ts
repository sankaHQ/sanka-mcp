import { buildOAuthWwwAuthenticateHeader } from './auth';
import { McpRequestContext, McpTool, ToolCallResult } from './types';
import { requireScopes } from './tool-auth';

const LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    search: {
      type: 'string',
      description: 'Free-text search query.',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return.',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
    page: {
      type: 'integer',
      description: 'Page number to fetch.',
      minimum: 1,
      default: 1,
    },
    sort: {
      type: 'string',
      description: 'Sort field, optionally prefixed with "-" for descending order.',
    },
    view: {
      type: 'string',
      description: 'Optional saved view identifier.',
    },
    reference_id: {
      type: 'string',
      description: 'Optional reference ID for idempotent pagination or tracing.',
    },
    language: {
      type: 'string',
      description: 'Optional language override sent as Accept-Language.',
    },
  },
};

const LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    count: { type: 'integer' },
    page: { type: 'integer' },
    total: { type: 'integer' },
    message: { type: 'string' },
    permission: { type: 'string' },
    results: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
  },
  required: ['count', 'page', 'total', 'message', 'results'],
};

const AUTH_STATUS_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    connected: { type: 'boolean' },
    auth_mode: { type: 'string' },
    tool_profile: { type: 'string' },
    scopes: {
      type: 'array',
      items: { type: 'string' },
    },
    message: { type: 'string' },
    resource_url: { type: 'string' },
  },
  required: ['connected', 'auth_mode', 'tool_profile', 'scopes', 'message'],
};

const readNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const buildListSummary = (label: string, rows: Array<Record<string, unknown>>, total: number): string => {
  if (rows.length === 0) {
    return `No ${label} matched the current filters.`;
  }

  const preview = rows
    .slice(0, 3)
    .map((row) => {
      const name = row['name'];
      return typeof name === 'string' && name.trim().length > 0 ? name.trim() : null;
    })
    .filter((name): name is string => Boolean(name));

  const previewText = preview.length > 0 ? ` Examples: ${preview.join(', ')}.` : '';
  return `Found ${total} ${label}.${previewText}`;
};

const buildListResult = ({
  label,
  payload,
}: {
  label: string;
  payload: {
    count: number;
    data: Array<Record<string, unknown>>;
    message: string;
    page: number;
    total: number;
    permission?: string | null;
  };
}): ToolCallResult => ({
  content: [
    {
      type: 'text',
      text: buildListSummary(label, payload.data, payload.total),
    },
  ],
  structuredContent: {
    count: payload.count,
    page: payload.page,
    total: payload.total,
    message: payload.message,
    permission: payload.permission ?? undefined,
    results: payload.data,
  },
});

const buildListParams = (args: Record<string, unknown> | undefined) => {
  const referenceID = readString(args?.['reference_id']);
  const search = readString(args?.['search']);
  const sort = readString(args?.['sort']);
  const view = readString(args?.['view']);
  const language = readString(args?.['language']);

  return {
    limit: readNumber(args?.['limit'], 10),
    page: readNumber(args?.['page'], 1),
    ...(referenceID ? { reference_id: referenceID } : undefined),
    ...(search ? { search } : undefined),
    ...(sort ? { sort } : undefined),
    ...(view ? { view } : undefined),
    ...(language ? { 'Accept-Language': language } : undefined),
  };
};

const buildAuthStatusChallenge = ({
  message,
  reqContext,
}: {
  message: string;
  reqContext: McpRequestContext;
}): ToolCallResult => {
  const oauth = reqContext.auth?.oauth;
  const wwwAuthenticate =
    oauth ?
      buildOAuthWwwAuthenticateHeader({
        authorizationServerUrl: oauth.authorizationServerUrl,
        description: message,
        error: 'invalid_token',
        resourceMetadataUrl: oauth.resourceMetadataUrl,
      })
    : undefined;

  return {
    content: [{ type: 'text', text: message }],
    isError: true,
    structuredContent: {
      connected: false,
      auth_mode: reqContext.auth?.authMode ?? 'none',
      tool_profile: reqContext.toolProfile ?? 'full',
      scopes: reqContext.auth?.oauth.scopes ?? [],
      message,
      resource_url: oauth?.resourceUrl,
    },
    ...(wwwAuthenticate
      ? {
          _meta: {
            'mcp/www_authenticate': [wwwAuthenticate],
          },
        }
      : undefined),
  };
};

export const crmAuthStatusTool: McpTool = {
  metadata: {
    resource: 'auth',
    operation: 'read',
    tags: ['crm'],
    operationId: 'crm.auth_status',
  },
  tool: {
    name: 'crm.auth_status',
    title: 'Check CRM authentication status',
    description:
      'Check whether the Sanka CRM connector is authenticated and ready before using CRM lookup tools.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: AUTH_STATUS_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'noauth' }],
    annotations: {
      title: 'Check CRM authentication status',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext }) => {
    const authMode = reqContext.auth?.authMode ?? 'none';
    const scopes = reqContext.auth?.oauth.scopes ?? [];

    if (authMode === 'none') {
      return buildAuthStatusChallenge({
        message: 'Sanka CRM is not connected yet. Approve the OAuth prompt in your MCP client, then retry.',
        reqContext,
      });
    }

    const message =
      authMode === 'api_key' ?
        'Sanka CRM is connected with an API key.'
      : `Sanka CRM is connected with OAuth${scopes.length > 0 ? ` and scopes: ${scopes.join(', ')}.` : '.'}`;

    return {
      content: [{ type: 'text', text: message }],
      structuredContent: {
        connected: true,
        auth_mode: authMode,
        tool_profile: reqContext.toolProfile ?? 'full',
        scopes,
        message,
        resource_url: reqContext.auth?.oauth.resourceUrl,
      },
    };
  },
};

export const crmListCompaniesTool: McpTool = {
  metadata: {
    resource: 'companies',
    operation: 'read',
    tags: ['crm'],
    httpMethod: 'get',
    httpPath: '/v1/public/companies',
    operationId: 'public.companies.list',
  },
  tool: {
    name: 'crm.list_companies',
    title: 'List companies',
    description:
      'Search and review companies in Sanka. Use this when the user wants to find or inspect companies, not to create or update them.',
    inputSchema: LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2', scopes: ['companies:read'] }],
    annotations: {
      title: 'List companies',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const scopeError = requireScopes({
      reqContext,
      requiredScopes: ['companies:read'],
      toolTitle: 'List companies',
    });
    if (scopeError) {
      return scopeError;
    }

    const payload = await reqContext.client.public.companies.list(buildListParams(args), undefined);

    return buildListResult({
      label: 'companies',
      payload,
    });
  },
};

export const crmListContactsTool: McpTool = {
  metadata: {
    resource: 'contacts',
    operation: 'read',
    tags: ['crm'],
    httpMethod: 'get',
    httpPath: '/v1/public/contacts',
    operationId: 'public.contacts.list',
  },
  tool: {
    name: 'crm.list_contacts',
    title: 'List contacts',
    description:
      'Search and review contacts in Sanka. Use this when the user wants to find or inspect contacts, not to create or update them.',
    inputSchema: LIST_INPUT_SCHEMA,
    outputSchema: LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2', scopes: ['contacts:read'] }],
    annotations: {
      title: 'List contacts',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const scopeError = requireScopes({
      reqContext,
      requiredScopes: ['contacts:read'],
      toolTitle: 'List contacts',
    });
    if (scopeError) {
      return scopeError;
    }

    const payload = await reqContext.client.public.contacts.list(buildListParams(args), undefined);

    return buildListResult({
      label: 'contacts',
      payload,
    });
  },
};
