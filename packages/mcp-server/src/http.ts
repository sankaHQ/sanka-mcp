// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ClientOptions } from 'sanka-sdk';
import express from 'express';
import {
  AuthenticationError,
  extractMcpSessionId,
  generateMcpSessionId,
  isServerIssuedMcpSessionId,
  resolveClientAuth,
} from './auth';
import { getLogger } from './logger';
import {
  buildMcpConnectMarkdownLink,
  buildMcpConnectStructuredReply,
  buildMcpConnectUserFacingReply,
  normalizeMcpConnectScopes,
} from './mcp-connect';
import { McpClientInfo, valueLooksLikeClaude, valueLooksLikeCodex } from './mcp-client-info';
import { McpOptions } from './options';
import { ToolProfile } from './profile';
import { expressErrorLogger, expressRequestLogger } from './http-logging';
import { executeHandler, initMcpServer, newMcpServer } from './server';
import { resolveMissingScopes } from './tool-auth';
import { buildToolAccessRequirements } from './tool-scope-requirements';
import { crmAuthStatusTool, crmConnectSankaTool } from './crm-tools';
import { readBinaryDownloadFile } from './binary-download-store';
import type { McpRequestContext } from './types';

const DEFAULT_STREAMABLE_PATH = '/mcp';
const DEFAULT_METADATA_PATH = '/.well-known/oauth-protected-resource';
const STREAMABLE_HTTP_PATHS = ['/', DEFAULT_STREAMABLE_PATH, '/sse'];
const BINARY_DOWNLOAD_PATHS = [
  '/downloads/:downloadToken',
  `${DEFAULT_STREAMABLE_PATH}/downloads/:downloadToken`,
];
const INLINE_TOOL_HANDLERS = {
  auth_status: crmAuthStatusTool,
  connect_sanka: crmConnectSankaTool,
} as const;
const MCP_JSON_BODY_LIMIT = '16mb';
const RECONNECT_INSTRUCTIONS =
  'The assistant must include required_user_facing_reply in the next visible response. Do not omit the Connect Sanka URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. Then retry the original request.';
const MCP_CLIENT_INFO_CACHE_MAX = 1000;

const mcpClientInfoBySessionId = new Map<string, McpClientInfo>();

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toolCallName = (body: unknown): string | undefined => {
  if (!isObjectRecord(body) || body['method'] !== 'tools/call' || !isObjectRecord(body['params'])) {
    return undefined;
  }
  const name = body['params']['name'];
  return typeof name === 'string' ? name : undefined;
};

const appendReconnectInstructions = ({
  connectUrl,
  message,
}: {
  connectUrl?: string | undefined;
  message: string;
}): string =>
  [
    message,
    connectUrl ? `Connect Sanka: ${buildMcpConnectMarkdownLink(connectUrl)}` : undefined,
    connectUrl ?
      `Required user-facing reply: ${buildMcpConnectUserFacingReply(connectUrl).replace(/\s+/g, ' ')}`
    : undefined,
    connectUrl ? RECONNECT_INSTRUCTIONS : undefined,
  ]
    .filter(Boolean)
    .join(' ');

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
}): Promise<{
  auth: Awaited<ReturnType<typeof resolveClientAuth>>;
  generatedSessionId?: string | undefined;
  mcpClientInfo?: McpClientInfo | undefined;
  mcpSessionId: string;
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  toolAccessRequirements: Record<
    string,
    {
      authenticationRequired: boolean;
      requiredScopes: string[];
    }
  >;
} | null> => {
  const { resourceUrl, resourceMetadataUrl } = requestResourceUrls(req, mcpOptions);
  const requestedSessionId = extractMcpSessionId(req.headers);
  const incomingSessionId =
    (
      requestedSessionId &&
      isServerIssuedMcpSessionId({
        resourceUrl,
        sessionId: requestedSessionId,
        sharedSecret: mcpOptions.tokenExchangeSharedSecret,
      })
    ) ?
      requestedSessionId
    : undefined;
  const mcpSessionId =
    incomingSessionId ||
    generateMcpSessionId({
      resourceUrl,
      sharedSecret: mcpOptions.tokenExchangeSharedSecret,
    });
  const requestMcpClientInfo = extractRequestMcpClientInfo(req) ?? inferRequestMcpClientInfo(req);
  const requestMcpProtocolVersion = extractRequestMcpProtocolVersion(req);
  const requestMcpEnvironment = extractRequestMcpEnvironment(req);
  if (requestMcpClientInfo) {
    rememberMcpClientInfo(mcpSessionId, requestMcpClientInfo);
  }
  const mcpClientInfo = requestMcpClientInfo ?? mcpClientInfoBySessionId.get(mcpSessionId);
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

  const requestedToolName = toolCallName(req.body);
  let resolvedAuth: Awaited<ReturnType<typeof resolveClientAuth>>;
  try {
    resolvedAuth = await resolveClientAuth({
      mcpSessionId,
      mcpSessionIdForExchange: requestedToolName ? incomingSessionId : undefined,
      mcpOptions: effectiveMcpOptions,
      req,
      resourceMetadataUrl,
      resourceUrl,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      if (!incomingSessionId) {
        res.setHeader('mcp-session-id', mcpSessionId);
      }
      res.status(error.statusCode).json({
        error: 'authentication_failed',
        error_description: error.message,
      });
      return null;
    }
    throw error;
  }

  const transport = new StreamableHTTPServerTransport();

  const { tools: selectedTools } = await initMcpServer({
    server,
    mcpOptions: effectiveMcpOptions,
    clientOptions: {
      ...clientOptions,
      ...resolvedAuth.clientOptions,
    },
    mcpSessionId,
    mcpClientInfo,
    mcpProtocolVersion: requestMcpProtocolVersion,
    mcpRequestEnvironment: requestMcpEnvironment,
    toolProfile,
    auth: resolvedAuth,
    downloadBaseUrl: downloadBaseUrlFromResourceUrl(resourceUrl),
  });
  await server.connect(transport as any);

  const argsByToolName =
    (
      isObjectRecord(req.body) &&
      req.body['method'] === 'tools/call' &&
      isObjectRecord(req.body['params']) &&
      typeof req.body['params']['name'] === 'string'
    ) ?
      {
        [req.body['params']['name']]:
          isObjectRecord(req.body['params']['arguments']) ? req.body['params']['arguments'] : undefined,
      }
    : undefined;

  return {
    server,
    transport,
    auth: resolvedAuth,
    generatedSessionId: incomingSessionId ? undefined : mcpSessionId,
    mcpClientInfo,
    mcpSessionId,
    toolAccessRequirements: buildToolAccessRequirements({
      tools: selectedTools,
      argsByToolName,
    }),
  };
};

const getRequestAuthPreflight = ({
  auth,
  body,
  toolAccessRequirements,
}: {
  auth: Awaited<ReturnType<typeof resolveClientAuth>>;
  body: unknown;
  toolAccessRequirements: Record<
    string,
    {
      authenticationRequired: boolean;
      requiredScopes: string[];
    }
  >;
}):
  | {
      error: string;
      errorDescription: string;
      reconnectMetadata?: {
        connect_url?: string | undefined;
        connect_scopes?: string[] | undefined;
        connect_url_markdown?: string | undefined;
        required_user_facing_reply?: string | undefined;
        resource_url: string;
        reconnect_instructions: string;
        reconnect_mode: 'connect_sanka';
      };
      statusCode: number;
    }
  | undefined => {
  const messages = Array.isArray(body) ? body : [body];

  for (const message of messages) {
    if (!message || typeof message !== 'object') {
      continue;
    }

    const method = (message as { method?: unknown }).method;

    if (method !== 'tools/call') {
      continue;
    }

    const params = (message as { params?: { name?: unknown } }).params;
    const toolName = typeof params?.name === 'string' ? params.name : undefined;
    if (!toolName) {
      continue;
    }

    const accessRequirements = toolAccessRequirements[toolName];
    if (!accessRequirements?.authenticationRequired) {
      continue;
    }

    if (auth.authMode === 'none') {
      const authRequiredDescription = `Authentication required to use ${toolName}.`;
      const connectUrl = auth.oauth.connectUrlForScopes?.(accessRequirements.requiredScopes);
      const connectScopes = normalizeMcpConnectScopes(accessRequirements.requiredScopes);
      const description = appendReconnectInstructions({
        connectUrl,
        message: authRequiredDescription,
      });
      return {
        error: 'authentication_required',
        errorDescription: description,
        reconnectMetadata: {
          ...(connectUrl ?
            {
              connect_url: connectUrl,
              connect_scopes: connectScopes,
              ...buildMcpConnectStructuredReply(connectUrl),
            }
          : undefined),
          resource_url: auth.oauth.resourceUrl,
          reconnect_instructions: RECONNECT_INSTRUCTIONS,
          reconnect_mode: 'connect_sanka',
        },
        statusCode: 401,
      };
    }

    const requiredScopes = accessRequirements.requiredScopes;
    if (requiredScopes.length === 0) {
      continue;
    }

    const grantedScopes = new Set(auth.oauth.scopes);
    const missingScopes = resolveMissingScopes({
      grantedScopes,
      requiredScopes,
    });
    if (missingScopes.length === 0) {
      continue;
    }

    const description = `${toolName} requires the following Sanka access scopes: ${missingScopes.join(
      ', ',
    )}.`;
    return {
      error: 'insufficient_scope',
      errorDescription: description,
      statusCode: 403,
    };
  }

  return undefined;
};

const singleHeader = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const acceptsEventStream = (req: express.Request): boolean =>
  (singleHeader(req.headers.accept)?.toLowerCase() ?? '')
    .split(',')
    .map((acceptType) => acceptType.split(';')[0]?.trim())
    .includes('text/event-stream');

const extractRequestMcpClientInfo = (req: express.Request): McpClientInfo | undefined => {
  const params =
    isObjectRecord(req.body) && isObjectRecord(req.body['params']) ? req.body['params'] : undefined;
  const clientInfo = params && isObjectRecord(params['clientInfo']) ? params['clientInfo'] : undefined;
  const name = typeof clientInfo?.['name'] === 'string' ? clientInfo['name'].trim() : '';
  if (!name) {
    return undefined;
  }
  return {
    name,
    version: String(clientInfo?.['version'] ?? ''),
  };
};

const extractRequestMcpProtocolVersion = (req: express.Request): string | undefined => {
  const params =
    isObjectRecord(req.body) && isObjectRecord(req.body['params']) ? req.body['params'] : undefined;
  const bodyVersion = typeof params?.['protocolVersion'] === 'string' ? params['protocolVersion'].trim() : '';
  if (bodyVersion) {
    return bodyVersion;
  }
  return firstHeaderToken(
    singleHeader(req.headers['mcp-protocol-version']) ?? singleHeader(req.headers['x-mcp-protocol-version']),
  );
};

const firstHeaderToken = (value: string | undefined): string | undefined => {
  const normalized = value?.split(',')[0]?.trim();
  return normalized || undefined;
};

const cleanStringValue = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const readFirstMetaString = (
  meta: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined => {
  if (!meta) return undefined;
  for (const key of keys) {
    const value = cleanStringValue(meta[key]);
    if (value) return value;
  }
  return undefined;
};

const toolCallMeta = (req: express.Request): Record<string, unknown> | undefined => {
  if (!isObjectRecord(req.body) || req.body['method'] !== 'tools/call') return undefined;
  const params = isObjectRecord(req.body['params']) ? req.body['params'] : undefined;
  return params && isObjectRecord(params['_meta']) ? params['_meta'] : undefined;
};

const inferBrowserFromUserAgent = (userAgent: string | undefined): string | undefined => {
  const value = userAgent ?? '';
  if (!value.trim()) return undefined;
  if (valueLooksLikeCodex(value)) return 'Codex';
  if (valueLooksLikeClaude(value)) return 'Claude';
  if (/\bopenai\b/i.test(value)) return 'OpenAI';
  if (/\bchrome\//i.test(value)) return 'Chrome';
  if (/\bfirefox\//i.test(value)) return 'Firefox';
  if (/\bsafari\//i.test(value)) return 'Safari';
  if (/\bcurl\//i.test(value)) return 'curl';
  return undefined;
};

const inferOsFromUserAgent = (userAgent: string | undefined): string | undefined => {
  const value = userAgent ?? '';
  if (/\b(iPhone|iPad|iPod)\b/i.test(value)) return 'iOS';
  if (/\bAndroid\b/i.test(value)) return 'Android';
  if (/\bMacintosh\b|\bMac OS X\b/i.test(value)) return 'macOS';
  if (/\bWindows\b/i.test(value)) return 'Windows';
  if (/\bLinux\b/i.test(value)) return 'Linux';
  return undefined;
};

const inferDeviceTypeFromUserAgent = (userAgent: string | undefined): string | undefined => {
  const value = userAgent ?? '';
  if (/\b(iPad|Tablet)\b/i.test(value)) return 'tablet';
  if (/\b(Mobile|iPhone|Android)\b/i.test(value)) return 'mobile';
  if (value.trim()) return 'desktop';
  return undefined;
};

const inferModelProvider = (modelName: string | undefined): string | undefined => {
  const normalized = modelName?.trim();
  if (!normalized) return undefined;
  if (/\b(claude|opus|sonnet|haiku)\b/i.test(normalized)) return 'anthropic';
  if (/\b(gpt|openai|o\d)\b/i.test(normalized)) return 'openai';
  return undefined;
};

const extractRequestModelInfo = (
  req: express.Request,
): Pick<NonNullable<McpRequestContext['mcpRequestEnvironment']>, 'modelProvider' | 'modelName'> => {
  const meta = toolCallMeta(req);
  const metaModel = isObjectRecord(meta?.['model']) ? meta['model'] : undefined;
  const metaAi = isObjectRecord(meta?.['ai']) ? meta['ai'] : undefined;
  const metaLlm = isObjectRecord(meta?.['llm']) ? meta['llm'] : undefined;
  const modelName =
    firstHeaderToken(
      singleHeader(req.headers['x-sanka-ai-model']) ??
        singleHeader(req.headers['x-openai-model']) ??
        singleHeader(req.headers['openai-model']) ??
        singleHeader(req.headers['x-anthropic-model']) ??
        singleHeader(req.headers['x-claude-model']) ??
        singleHeader(req.headers['x-ai-model']) ??
        singleHeader(req.headers['x-model']),
    ) ??
    readFirstMetaString(meta, [
      'model_name',
      'modelName',
      'ai_model',
      'aiModel',
      'llm_model',
      'llmModel',
      'model',
    ]) ??
    readFirstMetaString(metaModel, ['name', 'id', 'model_name', 'modelName']) ??
    readFirstMetaString(metaAi, ['model', 'model_name', 'modelName']) ??
    readFirstMetaString(metaLlm, ['model', 'model_name', 'modelName']);
  const modelProvider =
    firstHeaderToken(
      singleHeader(req.headers['x-sanka-ai-provider']) ??
        singleHeader(req.headers['x-openai-provider']) ??
        singleHeader(req.headers['x-anthropic-provider']),
    ) ??
    readFirstMetaString(meta, [
      'model_provider',
      'modelProvider',
      'ai_provider',
      'aiProvider',
      'llm_provider',
      'llmProvider',
      'provider',
    ]) ??
    readFirstMetaString(metaModel, ['provider', 'model_provider', 'modelProvider']) ??
    readFirstMetaString(metaAi, ['provider', 'model_provider', 'modelProvider']) ??
    readFirstMetaString(metaLlm, ['provider', 'model_provider', 'modelProvider']) ??
    inferModelProvider(modelName);
  return { modelName, modelProvider };
};

const extractRequestMcpEnvironment = (req: express.Request): McpRequestContext['mcpRequestEnvironment'] => {
  const userAgent = singleHeader(req.headers['user-agent']);
  const ipAddress =
    firstHeaderToken(singleHeader(req.headers['fly-client-ip'])) ??
    firstHeaderToken(singleHeader(req.headers['cf-connecting-ip'])) ??
    firstHeaderToken(singleHeader(req.headers['true-client-ip'])) ??
    firstHeaderToken(singleHeader(req.headers['x-real-ip'])) ??
    firstHeaderToken(singleHeader(req.headers['x-forwarded-for'])) ??
    firstHeaderToken(req.ip) ??
    firstHeaderToken(req.socket.remoteAddress);
  const modelInfo = extractRequestModelInfo(req);
  const environment = {
    ipAddress,
    userAgent: userAgent?.trim() || undefined,
    browser: inferBrowserFromUserAgent(userAgent),
    os: inferOsFromUserAgent(userAgent),
    deviceType: inferDeviceTypeFromUserAgent(userAgent),
    ...modelInfo,
  };
  return Object.values(environment).some(Boolean) ? environment : undefined;
};

const inferRequestMcpClientInfo = (req: express.Request): McpClientInfo | undefined => {
  const openaiClient = singleHeader(req.headers['x-openai-client']);
  const codexClient = singleHeader(req.headers['x-codex-client']);
  const anthropicClient = singleHeader(req.headers['x-anthropic-client']);
  const claudeClient = singleHeader(req.headers['x-claude-client']);
  const userAgent = singleHeader(req.headers['user-agent']);
  const headerClientValues = [openaiClient, codexClient, anthropicClient, claudeClient, userAgent];
  const codexClientValue = headerClientValues.find(valueLooksLikeCodex);
  if (codexClientValue) {
    return {
      name: 'Codex',
      version: codexClientValue,
    };
  }
  if (anthropicClient || claudeClient || valueLooksLikeClaude(userAgent)) {
    const version = [anthropicClient, claudeClient, userAgent]
      .map((value) => cleanStringValue(value))
      .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
      .join(' / ');
    return {
      name: 'Claude',
      version,
    };
  }
  const claudeClientValue = headerClientValues.find(valueLooksLikeClaude);
  if (claudeClientValue) {
    return {
      name: 'Claude',
      version: claudeClientValue,
    };
  }
  return undefined;
};

export const __testing = {
  extractRequestModelInfo,
  inferRequestMcpClientInfo,
};

const rememberMcpClientInfo = (sessionId: string, clientInfo: McpClientInfo): void => {
  if (
    !mcpClientInfoBySessionId.has(sessionId) &&
    mcpClientInfoBySessionId.size >= MCP_CLIENT_INFO_CACHE_MAX
  ) {
    const oldestSessionId = mcpClientInfoBySessionId.keys().next().value;
    if (oldestSessionId) {
      mcpClientInfoBySessionId.delete(oldestSessionId);
    }
  }
  mcpClientInfoBySessionId.set(sessionId, clientInfo);
};

const requestOrigin = (req: express.Request): string => {
  const protocol = req.protocol || 'http';
  const host = req.get('host');
  if (!host || /[\r\n]/.test(host)) {
    return 'http://127.0.0.1';
  }
  return `${protocol}://${host}`;
};

const requestResourceUrls = (req: express.Request, mcpOptions: McpOptions) => {
  const resourceUrl =
    mcpOptions.resourceUrl || new URL(DEFAULT_STREAMABLE_PATH, requestOrigin(req)).toString();
  const metadataOrigin = new URL(resourceUrl).origin;
  return {
    resourceUrl,
    resourceMetadataUrl: new URL(DEFAULT_METADATA_PATH, metadataOrigin).toString(),
  };
};

const downloadBaseUrlFromResourceUrl = (resourceUrl: string): string => new URL('/', resourceUrl).origin;

const safeHeaderValue = (value: string | undefined): string | undefined => {
  if (!value || /[\r\n]/.test(value)) {
    return undefined;
  }
  return value;
};

const attachmentDispositionForFilename = (filename: string): string => {
  const asciiFilename = filename.replace(/[\r\n"]/g, '_') || 'download';
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

const requestProfile = (_req: express.Request): ToolProfile => 'hosted';

const shouldReturnToolResultAuthFallback = ({
  mcpOptions,
  req,
  toolProfile,
}: {
  mcpOptions: McpOptions;
  req: express.Request;
  toolProfile: ToolProfile;
}): boolean =>
  mcpOptions.streamableAuthFallback === 'tool_result' && toolProfile === 'hosted' && acceptsEventStream(req);

const maybeHandleInlineToolCall = async ({
  req,
  res,
  toolProfile,
  transportContext,
}: {
  req: express.Request;
  res: express.Response;
  toolProfile: ToolProfile;
  transportContext: Exclude<Awaited<ReturnType<typeof createRequestTransport>>, null>;
}): Promise<boolean> => {
  if (
    !isObjectRecord(req.body) ||
    req.body['method'] !== 'tools/call' ||
    !isObjectRecord(req.body['params']) ||
    typeof req.body['params']['name'] !== 'string'
  ) {
    return false;
  }

  const toolName = req.body['params']['name'];
  const inlineTool = INLINE_TOOL_HANDLERS[toolName as keyof typeof INLINE_TOOL_HANDLERS];
  if (!inlineTool) {
    return false;
  }

  const result = await executeHandler({
    mcpTool: inlineTool,
    reqContext: {
      client: undefined as any,
      mcpSessionId: transportContext.mcpSessionId,
      mcpClientInfo: transportContext.mcpClientInfo,
      toolProfile,
      auth: transportContext.auth,
    },
    args: isObjectRecord(req.body['params']['arguments']) ? req.body['params']['arguments'] : {},
  });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.send(
    `event: message\ndata: ${JSON.stringify({
      jsonrpc: '2.0',
      id: req.body['id'] ?? null,
      result,
    })}\n\n`,
  );
  return true;
};

const handleStreamableRequest =
  (options: { clientOptions: ClientOptions; mcpOptions: McpOptions }) =>
  async (req: express.Request, res: express.Response) => {
    const toolProfile = requestProfile(req);
    const transportContext = await createRequestTransport({ ...options, req, res, toolProfile });
    if (transportContext === null) {
      return;
    }

    if (transportContext.generatedSessionId) {
      res.setHeader('mcp-session-id', transportContext.generatedSessionId);
    }

    if (await maybeHandleInlineToolCall({ req, res, toolProfile, transportContext })) {
      return;
    }

    const authPreflight = getRequestAuthPreflight({
      auth: transportContext.auth,
      body: req.body,
      toolAccessRequirements: transportContext.toolAccessRequirements,
    });
    if (authPreflight) {
      if (
        authPreflight.error === 'authentication_required' &&
        transportContext.auth.authMode === 'none' &&
        shouldReturnToolResultAuthFallback({
          mcpOptions: options.mcpOptions,
          req,
          toolProfile,
        })
      ) {
        await transportContext.transport.handleRequest(req, res, req.body);
        return;
      }
      res.status(authPreflight.statusCode).json({
        error: authPreflight.error,
        error_description: authPreflight.errorDescription,
        ...authPreflight.reconnectMetadata,
      });
      return;
    }

    await transportContext.transport.handleRequest(req, res, req.body);
  };

export const streamableHTTPApp = ({
  clientOptions = {},
  mcpOptions,
}: {
  clientOptions?: ClientOptions;
  mcpOptions: McpOptions;
}): express.Express => {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'extended');
  app.use(express.json({ limit: MCP_JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: MCP_JSON_BODY_LIMIT }));
  app.use(expressRequestLogger());

  app.get('/health', async (req: express.Request, res: express.Response) => {
    res.status(200).send('OK');
  });
  const sendBinaryDownload = async (req: express.Request, res: express.Response) => {
    const downloadToken = req.params['downloadToken'];
    if (!downloadToken) {
      res.status(400).json({ error: 'missing_download_token' });
      return;
    }

    const sessionId = extractMcpSessionId(req.headers);
    const file = readBinaryDownloadFile({ downloadToken, sessionId });
    if (!file.ok) {
      res.status(file.reason === 'session_mismatch' ? 403 : 404).json({
        error: file.reason,
        error_description: file.message,
      });
      return;
    }

    const contentDisposition =
      safeHeaderValue(file.contentDisposition) ?? attachmentDispositionForFilename(file.filename);
    const data = Buffer.from(file.contentBase64, 'base64');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('Content-Length', String(file.byteLength));
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('X-Sanka-Download-Expires-At', file.expiresAt);
    res.status(200).send(data);
  };
  for (const routePath of BINARY_DOWNLOAD_PATHS) {
    app.get(routePath, sendBinaryDownload);
  }
  const streamableHandler = handleStreamableRequest({ clientOptions, mcpOptions });
  for (const routePath of STREAMABLE_HTTP_PATHS) {
    app.get(routePath, streamableHandler);
    app.post(routePath, streamableHandler);
    app.delete(routePath, streamableHandler);
  }
  app.use(expressErrorLogger());
  app.use(((error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const candidate = error as { status?: unknown; type?: unknown };
    const status = typeof candidate?.status === 'number' ? candidate.status : 500;
    const isInvalidJson =
      error instanceof SyntaxError && status === 400 && candidate.type === 'entity.parse.failed';
    if (isInvalidJson) {
      res.status(400).json({
        error: 'invalid_json',
        error_description: 'Request body must contain valid JSON.',
      });
      return;
    }

    const publicStatus = status >= 400 && status < 500 ? status : 500;
    res.status(publicStatus).json({
      error: publicStatus === 500 ? 'internal_server_error' : 'invalid_request',
      error_description:
        publicStatus === 500 ? 'The server could not process the request.' : 'The request is invalid.',
    });
  }) satisfies express.ErrorRequestHandler);

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
    logger.info(
      { event: 'mcp.server.started', address },
      `MCP Server running on streamable HTTP at ${address}`,
    );
  } else if (address !== null) {
    logger.info(
      { event: 'mcp.server.started', port: address.port },
      `MCP Server running on streamable HTTP on port ${address.port}`,
    );
  } else {
    logger.info(
      { event: 'mcp.server.started', port },
      `MCP Server running on streamable HTTP on port ${port}`,
    );
  }
};
