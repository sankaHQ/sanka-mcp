// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ClientOptions } from 'sanka-sdk';
import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { OAuthChallengeError, resolveClientAuth } from './auth';
import { getLogger } from './logger';
import { McpOptions } from './options';
import { inferPathProfile, inferToolProfile, normalizeToolProfile, ToolProfile } from './profile';
import { buildProtectedResourceMetadata } from './protected-resource-metadata';
import { initMcpServer, newMcpServer } from './server';

const DEFAULT_STREAMABLE_PATH = '/mcp';
const CRM_STREAMABLE_PATH = '/mcp/crm';
const CRM_STREAMABLE_SSE_PATH = '/sse/crm';
const DEFAULT_METADATA_PATH = '/.well-known/oauth-protected-resource';
const DEFAULT_METADATA_ALIAS_PATH = '/.well-known/oauth-protected-resource/mcp';
const CRM_METADATA_PATH = '/.well-known/oauth-protected-resource/mcp/crm';
const STREAMABLE_HTTP_PATHS = ['/', DEFAULT_STREAMABLE_PATH, '/sse', CRM_STREAMABLE_PATH, CRM_STREAMABLE_SSE_PATH];

const createRequestTransport = async ({
  clientOptions,
  mcpOptions,
  req,
  res,
  toolProfile,
}: {
  clientOptions: ClientOptions;
  mcpOptions: McpOptions;
  req: express.Request;
  res: express.Response;
  toolProfile: ToolProfile;
}): Promise<{ server: McpServer; transport: StreamableHTTPServerTransport } | null> => {
  const customInstructionsPath = mcpOptions.customInstructionsPath;
  const server = await newMcpServer({ customInstructionsPath, toolProfile });

  // Parse client permission override headers.
  //
  // Note: Permissions are best-effort and intended to prevent clients from doing unexpected things;
  // they're not a hard security boundary, so we allow arbitrary, client-driven overrides.
  let effectiveMcpOptions = mcpOptions;
  const clientPermissionsHeader =
    req.headers['x-sanka-mcp-client-permissions'] ?? req.headers['x-stainless-mcp-client-permissions'];
  if (typeof clientPermissionsHeader === 'string') {
    try {
      const parsed = JSON.parse(clientPermissionsHeader);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        effectiveMcpOptions = {
          ...mcpOptions,
          ...(typeof parsed.allow_http_gets === 'boolean' && { codeAllowHttpGets: parsed.allow_http_gets }),
          ...(Array.isArray(parsed.allowed_methods) && { codeAllowedMethods: parsed.allowed_methods }),
          ...(Array.isArray(parsed.blocked_methods) && { codeBlockedMethods: parsed.blocked_methods }),
        };
        getLogger().info(
          { clientPermissions: parsed },
          'Overriding code execution permissions from client permissions header',
        );
      }
    } catch (error) {
      getLogger().warn({ error }, 'Failed to parse client permissions header');
    }
  }

  const { resourceUrl, resourceMetadataUrl } = requestResourceUrls(req, effectiveMcpOptions);
  let resolvedAuth: Awaited<ReturnType<typeof resolveClientAuth>>;
  try {
    resolvedAuth = await resolveClientAuth({
      mcpOptions: effectiveMcpOptions,
      req,
      resourceMetadataUrl,
      resourceUrl,
    });
  } catch (error) {
    if (error instanceof OAuthChallengeError) {
      res.setHeader('WWW-Authenticate', error.wwwAuthenticate);
      res.status(error.statusCode).json({
        error: 'authentication_failed',
        error_description: error.message,
      });
      return null;
    }
    throw error;
  }

  const transport = new StreamableHTTPServerTransport();

  await initMcpServer({
    server,
    mcpOptions: effectiveMcpOptions,
    clientOptions: {
      ...clientOptions,
      ...resolvedAuth.clientOptions,
    },
    mcpClientInfo:
      typeof req.body?.params?.clientInfo?.name === 'string' ?
        { name: req.body.params.clientInfo.name, version: String(req.body.params.clientInfo.version ?? '') }
      : undefined,
    toolProfile,
    auth: resolvedAuth,
  });
  await server.connect(transport as any);

  return {
    server,
    transport,
  };
};

const singleHeader = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const requestOrigin = (req: express.Request): string => {
  const forwardedProto = singleHeader(req.headers['x-forwarded-proto'])?.split(',')[0]?.trim();
  const forwardedHost = singleHeader(req.headers['x-forwarded-host'])?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host');
  return `${protocol}://${host}`;
};

const streamablePathForProfile = (toolProfile: ToolProfile): string =>
  toolProfile === 'crm' ? CRM_STREAMABLE_PATH : DEFAULT_STREAMABLE_PATH;

const metadataPathForProfile = (toolProfile: ToolProfile): string =>
  toolProfile === 'crm' ? CRM_METADATA_PATH : DEFAULT_METADATA_PATH;

const requestResourceUrls = (req: express.Request, mcpOptions: McpOptions) => {
  const routeProfile = inferPathProfile(req.path);
  const resourceProfile = routeProfile ?? 'full';

  return {
    resourceUrl:
      resourceProfile === 'crm' ?
        new URL(streamablePathForProfile(resourceProfile), requestOrigin(req)).toString()
      : (mcpOptions.resourceUrl ||
          new URL(streamablePathForProfile(resourceProfile), requestOrigin(req)).toString()),
    resourceMetadataUrl: new URL(metadataPathForProfile(resourceProfile), requestOrigin(req)).toString(),
  };
};

const requestProfile = (req: express.Request): ToolProfile => {
  const routeProfile = inferPathProfile(req.path);
  const queryProfile = Array.isArray(req.query['profile']) ? req.query['profile'][0] : req.query['profile'];
  const explicitProfile =
    normalizeToolProfile(singleHeader(req.headers['x-sanka-mcp-profile'])) ||
    normalizeToolProfile(queryProfile);
  const toolProfile = inferToolProfile({
    routeProfile,
    explicitProfile,
    clientInfoName:
      typeof req.body?.params?.clientInfo?.name === 'string' ? req.body.params.clientInfo.name : undefined,
    authorizationHeader: singleHeader(req.headers.authorization),
    apiKeyHeader: singleHeader(req.headers['x-sanka-api-key']),
  });

  return toolProfile;
};

const handleStreamableRequest =
  (options: { clientOptions: ClientOptions; mcpOptions: McpOptions }) =>
  async (req: express.Request, res: express.Response) => {
    const toolProfile = requestProfile(req);
    const transportContext = await createRequestTransport({ ...options, req, res, toolProfile });
    if (transportContext === null) {
      return;
    }

    await transportContext.transport.handleRequest(req, res, req.body);
  };

const redactHeaders = (headers: Record<string, any>) => {
  const hiddenHeaders = /auth|cookie|key|token/i;
  const filtered = { ...headers };
  Object.keys(filtered).forEach((key) => {
    if (hiddenHeaders.test(key)) {
      filtered[key] = '[REDACTED]';
    }
  });
  return filtered;
};

export const streamableHTTPApp = ({
  clientOptions = {},
  mcpOptions,
}: {
  clientOptions?: ClientOptions;
  mcpOptions: McpOptions;
}): express.Express => {
  const app = express();
  app.set('query parser', 'extended');
  app.use(express.json());
  app.use(
    pinoHttp({
      logger: getLogger(),
      customLogLevel: (req, res) => {
        if (res.statusCode >= 500) {
          return 'error';
        } else if (res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
      customSuccessMessage: function (req, res) {
        return `Request ${req.method} to ${req.url} completed with status ${res.statusCode}`;
      },
      customErrorMessage: function (req, res, err) {
        return `Request ${req.method} to ${req.url} errored with status ${res.statusCode}`;
      },
      serializers: {
        req: pino.stdSerializers.wrapRequestSerializer((req) => {
          return {
            ...req,
            headers: redactHeaders(req.raw.headers),
          };
        }),
        res: pino.stdSerializers.wrapResponseSerializer((res) => {
          return {
            ...res,
            headers: redactHeaders(res.headers),
          };
        }),
      },
    }),
  );

  app.get('/health', async (req: express.Request, res: express.Response) => {
    res.status(200).send('OK');
  });
  const sendProtectedResourceMetadata = async (req: express.Request, res: express.Response) => {
    const toolProfile = inferPathProfile(req.path) ?? 'full';
    const { resourceUrl } = requestResourceUrls(req, mcpOptions);
    res.status(200).json(
      buildProtectedResourceMetadata({
        resource: resourceUrl,
        authorizationServerUrl: mcpOptions.authorizationServerUrl || 'https://app.sanka.com',
        scopesSupported: mcpOptions.scopesSupported,
      }),
    );
  };
  app.get(DEFAULT_METADATA_PATH, sendProtectedResourceMetadata);
  app.get(DEFAULT_METADATA_ALIAS_PATH, sendProtectedResourceMetadata);
  app.get(CRM_METADATA_PATH, sendProtectedResourceMetadata);
  const streamableHandler = handleStreamableRequest({ clientOptions, mcpOptions });
  for (const routePath of STREAMABLE_HTTP_PATHS) {
    app.get(routePath, streamableHandler);
    app.post(routePath, streamableHandler);
    app.delete(routePath, streamableHandler);
  }

  return app;
};

export const launchStreamableHTTPServer = async ({
  mcpOptions,
  port,
}: {
  mcpOptions: McpOptions;
  port: number | string | undefined;
}) => {
  const app = streamableHTTPApp({ mcpOptions });
  const server = app.listen(port);
  const address = server.address();

  const logger = getLogger();

  if (typeof address === 'string') {
    logger.info(`MCP Server running on streamable HTTP at ${address}`);
  } else if (address !== null) {
    logger.info(`MCP Server running on streamable HTTP on port ${address.port}`);
  } else {
    logger.info(`MCP Server running on streamable HTTP on port ${port}`);
  }
};
