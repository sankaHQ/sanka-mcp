// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import type express from 'express';
import {
  getOptionalLogger,
  logAtLevel,
  logVerbosity,
  redactHeaders,
  requestLogLevelForStatus,
  serializeError,
} from './logger';

const firstHeaderToken = (value: string | string[] | undefined): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = raw?.split(',')[0]?.trim();
  return normalized || undefined;
};

const requestPath = (req: express.Request): string => req.path || req.originalUrl.split('?')[0] || req.url;

const clientIp = (req: express.Request): string | undefined =>
  firstHeaderToken(req.headers['fly-client-ip']) ??
  firstHeaderToken(req.headers['cf-connecting-ip']) ??
  firstHeaderToken(req.headers['true-client-ip']) ??
  firstHeaderToken(req.headers['x-real-ip']) ??
  firstHeaderToken(req.headers['x-forwarded-for']) ??
  firstHeaderToken(req.ip) ??
  firstHeaderToken(req.socket.remoteAddress);

const requestId = (req: express.Request): string | undefined =>
  firstHeaderToken(req.headers['x-request-id']) ??
  firstHeaderToken(req.headers['fly-request-id']) ??
  firstHeaderToken(req.headers['x-correlation-id']);

const requestPayload = (req: express.Request, includeHeaders: boolean): Record<string, unknown> => ({
  method: req.method,
  path: requestPath(req),
  ...(requestId(req) ? { request_id: requestId(req) } : undefined),
  ...(clientIp(req) ? { source_ip_address: clientIp(req) } : undefined),
  ...(req.headers['user-agent'] ? { user_agent: firstHeaderToken(req.headers['user-agent']) } : undefined),
  ...(includeHeaders ? { headers: redactHeaders(req.headers as Record<string, unknown>) } : undefined),
});

export const expressRequestLogger = (): express.RequestHandler => (req, res, next) => {
  const logger = getOptionalLogger();
  const startedAt = process.hrtime.bigint();
  const verbose = logVerbosity() === 'verbose';

  if (logger && verbose) {
    logger.debug(
      {
        event: 'http.request.started',
        req: requestPayload(req, true),
      },
      'HTTP request started',
    );
  }

  res.on('finish', () => {
    const finishedLogger = getOptionalLogger();
    if (!finishedLogger) {
      return;
    }
    const level = requestLogLevelForStatus(res.statusCode);
    if (!level) {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const includeHeaders = verbose || res.statusCode >= 400;
    logAtLevel(
      finishedLogger,
      level,
      {
        event: 'http.request.finished',
        req: requestPayload(req, includeHeaders),
        res: {
          status_code: res.statusCode,
          ...(includeHeaders ? { headers: redactHeaders(res.getHeaders()) } : undefined),
        },
        status_code: res.statusCode,
        duration_ms: Math.round(durationMs * 100) / 100,
      },
      'HTTP request finished',
    );
  });

  next();
};

export const expressErrorLogger = (): express.ErrorRequestHandler => (error, req, _res, next) => {
  const logger = getOptionalLogger();
  if (logger) {
    logger.error(
      {
        event: 'http.request.exception',
        req: requestPayload(req, true),
        error: serializeError(error),
      },
      'Unhandled HTTP request exception',
    );
  }
  next(error);
};
