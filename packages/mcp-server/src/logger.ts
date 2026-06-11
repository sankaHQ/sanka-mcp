// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { pino, type Level, type Logger } from 'pino';
import pretty from 'pino-pretty';

let _logger: Logger | undefined;
let _loggerConfig: StandardLoggerConfig | undefined;

export type LogFormat = 'json' | 'pretty';
export type LogVerbosity = 'quiet' | 'standard' | 'verbose';

export type StandardLoggerConfig = {
  level: Level;
  format: LogFormat;
  verbosity: LogVerbosity;
  serviceName: string;
  env: string;
  version?: string | undefined;
  suppressFrameworkLogs: boolean;
  processName?: string | undefined;
};

type ConfigureLoggerOptions = {
  level?: Level | undefined;
  pretty?: boolean | undefined;
  logFormat?: LogFormat | undefined;
  verbosity?: LogVerbosity | undefined;
  serviceName?: string | undefined;
  env?: string | undefined;
  version?: string | undefined;
  suppressFrameworkLogs?: boolean | undefined;
};

const SECRET_KEY_RE =
  /(^|[_-])(authorization|cookie|set-cookie|token|secret|password|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token)($|[_-])/i;
const SECRET_ASSIGNMENT_RE =
  /\b(authorization|cookie|token|secret|password|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token)\s*[:=]\s*([^\s,;&]+)/gi;
const BEARER_TOKEN_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const URL_CREDENTIAL_RE = /\b([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^/\s@]+)@/gi;

const cleanString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const readBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
};

const normalizeLevel = (value: string | undefined): Level | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === 'warning') {
    return 'warn';
  }
  if (normalized === 'verbose') {
    return 'debug';
  }
  if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(normalized)) {
    return normalized as Level;
  }
  return undefined;
};

const normalizeFormat = (value: string | undefined): LogFormat | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === 'console') {
    return 'pretty';
  }
  if (normalized === 'json' || normalized === 'pretty') {
    return normalized;
  }
  return undefined;
};

const normalizeVerbosity = (value: string | undefined): LogVerbosity | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'quiet' || normalized === 'standard' || normalized === 'verbose') {
    return normalized;
  }
  return undefined;
};

const defaultLogEnv = (): string => {
  if (process.env['FLY_APP_NAME']) {
    return 'production';
  }
  return process.env['NODE_ENV'] === 'production' ? 'production' : 'development';
};

const defaultVersion = (): string | undefined =>
  cleanString(process.env['LOG_VERSION']) ??
  cleanString(process.env['SANKA_MCP_SERVER_VERSION']) ??
  cleanString(process.env['npm_package_version']) ??
  cleanString(process.env['FLY_IMAGE_REF']);

const defaultProcessName = (): string | undefined =>
  cleanString(process.env['FLY_PROCESS_GROUP']) ??
  cleanString(process.env['PROCESS_TYPE']) ??
  cleanString(process.env['npm_lifecycle_event']);

export function resolveLoggerConfig(options: ConfigureLoggerOptions = {}): StandardLoggerConfig {
  const format =
    normalizeFormat(process.env['LOG_FORMAT']) ??
    options.logFormat ??
    (options.pretty === true ? 'pretty' : undefined) ??
    (process.stderr.isTTY ? 'pretty' : 'json');

  return {
    level: normalizeLevel(process.env['LOG_LEVEL']) ?? options.level ?? 'info',
    format,
    verbosity: normalizeVerbosity(process.env['LOG_VERBOSITY']) ?? options.verbosity ?? 'standard',
    serviceName:
      cleanString(process.env['LOG_SERVICE_NAME']) ?? cleanString(options.serviceName) ?? 'sanka-mcp',
    env: cleanString(process.env['LOG_ENV']) ?? cleanString(options.env) ?? defaultLogEnv(),
    version: defaultVersion() ?? cleanString(options.version),
    suppressFrameworkLogs:
      options.suppressFrameworkLogs ?? readBoolean(process.env['LOG_SUPPRESS_FRAMEWORK_LOGS'], true),
    processName: defaultProcessName(),
  };
}

export function configureLogger(options: ConfigureLoggerOptions = {}): void {
  _loggerConfig = resolveLoggerConfig(options);
  const base: Record<string, string> = {
    service: _loggerConfig.serviceName,
    env: _loggerConfig.env,
  };
  if (_loggerConfig.version) {
    base['version'] = _loggerConfig.version;
  }
  if (_loggerConfig.processName) {
    base['process'] = _loggerConfig.processName;
  }

  _logger = pino(
    {
      level: _loggerConfig.level,
      base,
      messageKey: 'message',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label) {
          return { level: label };
        },
        log(object) {
          return redactLogValue(object) as Record<string, unknown>;
        },
      },
      serializers: {
        err: serializeError,
        error: serializeError,
      },
    },
    _loggerConfig.format === 'pretty' ?
      pretty({ colorize: true, levelFirst: true, destination: 2 })
    : process.stderr,
  );
}

export function getLogger(): Logger {
  if (!_logger) {
    throw new Error('Logger has not been configured. Call configureLogger() before using the logger.');
  }
  return _logger;
}

export function getOptionalLogger(): Logger | undefined {
  return _logger;
}

export function getLoggerConfig(): StandardLoggerConfig {
  return _loggerConfig ?? resolveLoggerConfig();
}

export function logVerbosity(): LogVerbosity {
  return getLoggerConfig().verbosity;
}

export function requestLogLevelForStatus(statusCode: number): 'info' | 'warn' | 'error' | undefined {
  if (statusCode >= 500) {
    return 'error';
  }
  if (statusCode >= 400) {
    return 'warn';
  }
  return logVerbosity() === 'quiet' ? undefined : 'info';
}

export function logAtLevel(
  logger: Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>,
  level: 'debug' | 'info' | 'warn' | 'error',
  payload: Record<string, unknown>,
  message: string,
): void {
  switch (level) {
    case 'debug':
      logger.debug(payload, message);
      break;
    case 'warn':
      logger.warn(payload, message);
      break;
    case 'error':
      logger.error(payload, message);
      break;
    default:
      logger.info(payload, message);
      break;
  }
}

export function redactString(value: string): string {
  return value
    .replace(URL_CREDENTIAL_RE, '$1[REDACTED]:[REDACTED]@')
    .replace(BEARER_TOKEN_RE, 'Bearer [REDACTED]')
    .replace(SECRET_ASSIGNMENT_RE, '$1=[REDACTED]');
}

export function redactLogValue(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[MAX_DEPTH]';
  }
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (value instanceof Error) {
    return serializeError(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactLogValue(entry, depth + 1));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = SECRET_KEY_RE.test(key) ? '[REDACTED]' : redactLogValue(entry, depth + 1);
  }
  return result;
}

export function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  return redactLogValue(headers) as Record<string, unknown>;
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return {
      type: typeof error,
      message: redactString(String(error)),
    };
  }

  const summary: Record<string, unknown> = {
    type: error.name || error.constructor.name || 'Error',
    message: redactString(error.message || String(error)),
  };
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause) {
    summary['cause'] = serializeError(cause);
  }
  if (logVerbosity() === 'verbose' && error.stack) {
    summary['stack'] = redactString(error.stack);
  }
  return summary;
}
