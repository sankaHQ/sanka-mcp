// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import qs from 'qs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import z from 'zod';

export type CLIOptions = McpOptions & {
  debug: boolean;
  logFormat: 'json' | 'pretty';
  transport: 'stdio' | 'http';
  port: number | undefined;
  socket: string | undefined;
};

export type McpOptions = {
  chatgptConnectorEnabled?: boolean | undefined;
  chatgptConnectorIssuer?: string | undefined;
  chatgptConnectorResource?: string | undefined;
  /** Set only by the dedicated HTTP route, never by client query parameters. */
  nativeOAuth?: boolean | undefined;
  /** Issuer of Sanka's MCP OAuth authorization server, advertised in resource metadata. */
  oauthIssuer?: string | undefined;
  /** Authenticates this server to Sanka's internal MCP OAuth token exchange. */
  oauthResourceServerSecret?: string | undefined;
  /** Internal base URL of sanka-api for the token exchanges (defaults to the issuer origin). */
  internalAuthorizationServerUrl?: string | undefined;
  /** ChatGPT connector exchange secret. */
  tokenExchangeSharedSecret?: string | undefined;
  includeCodeTool?: boolean | undefined;
  includeDocsTools?: boolean | undefined;
  docsDir?: string | undefined;
  codeAllowHttpGets?: boolean | undefined;
  codeAllowedMethods?: string[] | undefined;
  codeBlockedMethods?: string[] | undefined;
  customInstructionsPath?: string | undefined;
  resourceUrl?: string | undefined;
};

export function parseCLIOptions(): CLIOptions {
  const optionalString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const opts = yargs(hideBin(process.argv))
    .option('chatgpt-connector-enabled', {
      type: 'boolean',
      default: false,
      description: 'Enable the separate ChatGPT OAuth connector endpoint.',
    })
    .option('chatgpt-connector-issuer', {
      type: 'string',
      default: 'https://api-v2.sanka.com/oauth/chatgpt',
      description: 'Canonical OAuth issuer for the ChatGPT connector.',
    })
    .option('chatgpt-connector-resource', {
      type: 'string',
      default: 'https://mcp.sanka.com/chatgpt',
      description: 'Canonical resource identifier for the ChatGPT connector.',
    })
    .option('oauth-issuer', {
      type: 'string',
      default: 'https://api-v2.sanka.com/oauth/mcp',
      description: "Issuer of Sanka's MCP OAuth authorization server, advertised in resource metadata.",
    })
    .option('oauth-resource-server-secret', {
      type: 'string',
      description: "Secret this server sends to Sanka's internal MCP OAuth token exchange.",
    })
    .option('internal-authorization-server-url', {
      type: 'string',
      description: 'Internal base URL of sanka-api for token exchanges. Defaults to the issuer origin.',
    })
    .option('token-exchange-shared-secret', {
      type: 'string',
      description: 'Secret for the ChatGPT connector token exchange with sanka-api.',
    })
    .option('code-allow-http-gets', {
      type: 'boolean',
      description:
        'Allow all code tool methods that map to HTTP GET operations. If all code-allow-* flags are unset, then everything is allowed.',
    })
    .option('code-allowed-methods', {
      type: 'string',
      array: true,
      description:
        'Methods to explicitly allow for code tool. Evaluated as regular expressions against method fully qualified names. If all code-allow-* flags are unset, then everything is allowed.',
    })
    .option('code-blocked-methods', {
      type: 'string',
      array: true,
      description:
        'Methods to explicitly block for code tool. Evaluated as regular expressions against method fully qualified names. If all code-allow-* flags are unset, then everything is allowed.',
    })
    .option('custom-instructions-path', {
      type: 'string',
      description: 'Path to custom instructions for the MCP server',
    })
    .option('debug', { type: 'boolean', description: 'Enable debug logging' })
    .option('docs-dir', {
      type: 'string',
      description:
        'Path to a directory of local documentation files (markdown/JSON) to include in local docs search.',
    })
    .option('log-format', {
      type: 'string',
      choices: ['json', 'pretty'],
      description: 'Format for log output; defaults to json unless tty is detected',
    })
    .option('no-tools', {
      type: 'string',
      array: true,
      choices: ['code', 'docs'],
      description: 'Tools to explicitly disable',
    })
    .option('port', {
      type: 'number',
      default: 3000,
      description: 'Port to serve on if using http transport',
    })
    .option('resource-url', {
      type: 'string',
      description:
        'Canonical public URL of the /mcp endpoint, such as https://mcp.sanka.com/mcp. Its origin names every OAuth resource this server serves.',
    })
    .option('socket', { type: 'string', description: 'Unix socket to serve on if using http transport' })
    .option('tools', {
      type: 'string',
      array: true,
      choices: ['code', 'docs'],
      description: 'Tools to explicitly enable',
    })
    .option('transport', {
      type: 'string',
      choices: ['stdio', 'http'],
      default: 'stdio',
      description: 'What transport to use; stdio for local servers or http for remote servers',
    })
    .env('MCP_SERVER')
    .version(true)
    .help();

  const argv = opts.parseSync();

  const shouldIncludeToolType = (toolType: 'code' | 'docs') =>
    argv.noTools?.includes(toolType) ? false
    : argv.tools?.includes(toolType) ? true
    : undefined;

  const includeCodeTool = shouldIncludeToolType('code');
  const includeDocsTools = shouldIncludeToolType('docs');

  const transport = argv.transport as 'stdio' | 'http';
  const logFormat =
    argv.logFormat ? (argv.logFormat as 'json' | 'pretty')
    : process.stderr.isTTY ? 'pretty'
    : 'json';

  return {
    chatgptConnectorEnabled: argv.chatgptConnectorEnabled === true,
    chatgptConnectorIssuer: optionalString(argv.chatgptConnectorIssuer),
    chatgptConnectorResource: optionalString(argv.chatgptConnectorResource),
    oauthIssuer: optionalString(argv.oauthIssuer),
    oauthResourceServerSecret: optionalString(argv.oauthResourceServerSecret),
    internalAuthorizationServerUrl: optionalString(argv.internalAuthorizationServerUrl),
    tokenExchangeSharedSecret: optionalString(argv.tokenExchangeSharedSecret),
    ...(includeCodeTool !== undefined && { includeCodeTool }),
    ...(includeDocsTools !== undefined && { includeDocsTools }),
    debug: !!argv.debug,
    docsDir: argv.docsDir,
    codeAllowHttpGets: argv.codeAllowHttpGets,
    codeAllowedMethods: argv.codeAllowedMethods,
    codeBlockedMethods: argv.codeBlockedMethods,
    customInstructionsPath: argv.customInstructionsPath,
    resourceUrl: argv.resourceUrl,
    transport,
    logFormat,
    port: argv.port,
    socket: argv.socket,
  };
}

const coerceArray = <T extends z.ZodTypeAny>(zodType: T) =>
  z.preprocess(
    (val) =>
      Array.isArray(val) ? val
      : val ? [val]
      : val,
    z.array(zodType).optional(),
  );

const QueryOptions = z.object({
  tools: coerceArray(z.enum(['code', 'docs'])).describe('Specify which MCP tools to use'),
  no_tools: coerceArray(z.enum(['code', 'docs'])).describe('Specify which MCP tools to not use.'),
  tool: coerceArray(z.string()).describe('Include tools matching the specified names'),
});

export function parseQueryOptions(defaultOptions: McpOptions, query: unknown): McpOptions {
  const queryObject = typeof query === 'string' ? qs.parse(query) : query;
  const queryOptions = QueryOptions.parse(queryObject);

  let codeTool: boolean | undefined =
    queryOptions.no_tools && queryOptions.no_tools?.includes('code') ? false
    : queryOptions.tools?.includes('code') ? true
    : defaultOptions.includeCodeTool;

  let docsTools: boolean | undefined =
    queryOptions.no_tools && queryOptions.no_tools?.includes('docs') ? false
    : queryOptions.tools?.includes('docs') ? true
    : defaultOptions.includeDocsTools;

  return {
    oauthIssuer: defaultOptions.oauthIssuer,
    oauthResourceServerSecret: defaultOptions.oauthResourceServerSecret,
    internalAuthorizationServerUrl: defaultOptions.internalAuthorizationServerUrl,
    tokenExchangeSharedSecret: defaultOptions.tokenExchangeSharedSecret,
    ...(codeTool !== undefined && { includeCodeTool: codeTool }),
    ...(docsTools !== undefined && { includeDocsTools: docsTools }),
    docsDir: defaultOptions.docsDir,
    resourceUrl: defaultOptions.resourceUrl,
  };
}
