import {
  redactHeaders,
  redactLogValue,
  requestLogLevelForStatus,
  resolveLoggerConfig,
  serializeError,
} from '../../packages/mcp-server/src/logger';

const withEnv = (env: Record<string, string | undefined>, run: () => void) => {
  const original = new Map<string, string | undefined>();
  for (const key of Object.keys(env)) {
    original.set(key, process.env[key]);
    const value = env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    run();
  } finally {
    for (const [key, value] of original.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

describe('standard MCP logger config', () => {
  it('reads standard LOG_* environment values', () => {
    withEnv(
      {
        LOG_LEVEL: 'DEBUG',
        LOG_FORMAT: 'json',
        LOG_VERBOSITY: 'verbose',
        LOG_SERVICE_NAME: 'sanka-mcp',
        LOG_ENV: 'staging',
        LOG_VERSION: 'v1.2.3',
        LOG_SUPPRESS_FRAMEWORK_LOGS: 'false',
      },
      () => {
        expect(resolveLoggerConfig()).toMatchObject({
          level: 'debug',
          format: 'json',
          verbosity: 'verbose',
          serviceName: 'sanka-mcp',
          env: 'staging',
          version: 'v1.2.3',
          suppressFrameworkLogs: false,
        });
      },
    );
  });

  it('keeps warning and error request logs in quiet mode', () => {
    withEnv({ LOG_VERBOSITY: 'quiet' }, () => {
      expect(requestLogLevelForStatus(200)).toBeUndefined();
      expect(requestLogLevelForStatus(404)).toBe('warn');
      expect(requestLogLevelForStatus(500)).toBe('error');
    });
  });

  it('redacts sensitive keys and token-shaped strings', () => {
    expect(
      redactLogValue({
        authorization: 'Bearer abc.def.ghi',
        db_url: 'postgres://user:secret@example.com/db',
        nested: {
          client_secret: 'raw-secret',
          message: 'password=super-secret token:abc123',
        },
      }),
    ).toEqual({
      authorization: '[REDACTED]',
      db_url: 'postgres://[REDACTED]:[REDACTED]@example.com/db',
      nested: {
        client_secret: '[REDACTED]',
        message: 'password=[REDACTED] token=[REDACTED]',
      },
    });
  });

  it('redacts request headers by sensitive header name', () => {
    expect(
      redactHeaders({
        authorization: 'Bearer abc.def',
        cookie: 'session=abc',
        'user-agent': 'Codex/1.0',
      }),
    ).toEqual({
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      'user-agent': 'Codex/1.0',
    });
  });

  it('includes stack traces only in verbose exception mode', () => {
    const error = new Error('failed password=secret');
    withEnv({ LOG_VERBOSITY: 'standard' }, () => {
      expect(serializeError(error)).toMatchObject({
        type: 'Error',
        message: 'failed password=[REDACTED]',
      });
      expect(serializeError(error)).not.toHaveProperty('stack');
    });
    withEnv({ LOG_VERBOSITY: 'verbose' }, () => {
      expect(serializeError(error)).toMatchObject({
        type: 'Error',
        message: 'failed password=[REDACTED]',
      });
      expect(serializeError(error)).toHaveProperty('stack');
    });
  });
});
