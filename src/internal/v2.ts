// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIPromise } from '../core/api-promise';
import { fromBase64 } from './utils/base64';

export interface V2EnvelopeMeta {
  ctx_id?: string | null;
  pagination?: Record<string, number> | null;
  [key: string]: unknown;
}

export interface V2ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export type V2Envelope<T> =
  | {
      success: true;
      data: T;
      meta: V2EnvelopeMeta;
    }
  | {
      success: false;
      error: V2ErrorBody;
      meta: V2EnvelopeMeta;
    };

export class V2EnvelopeError extends Error {
  code: string;
  details: unknown;
  meta: V2EnvelopeMeta;

  constructor(error: V2ErrorBody, meta: V2EnvelopeMeta) {
    super(error.message);
    this.name = 'V2EnvelopeError';
    this.code = error.code;
    this.details = error.details;
    this.meta = meta;
  }
}

export const isV2Envelope = (value: unknown): value is V2Envelope<unknown> => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as { success?: unknown; meta?: unknown; data?: unknown; error?: unknown };
  if (typeof candidate.success !== 'boolean') return false;
  if (!candidate.meta || typeof candidate.meta !== 'object') return false;
  if (candidate.success) return 'data' in candidate;

  const error = candidate.error as { code?: unknown; message?: unknown } | undefined;
  return !!error && typeof error.code === 'string' && typeof error.message === 'string';
};

export const unwrapV2Data = <T>(envelope: V2Envelope<T>): T => {
  if (envelope.success) return envelope.data;
  throw new V2EnvelopeError(envelope.error, envelope.meta);
};

export const unwrapV2DataPromise = <T>(promise: APIPromise<V2Envelope<T>>): APIPromise<T> => {
  return promise._thenUnwrap((envelope) => unwrapV2Data(envelope));
};

export interface V2PdfData {
  object_type?: string | null;
  record_id?: string | null;
  filename?: string | null;
  media_type?: string | null;
  disposition?: string | null;
  content_base64?: string | null;
}

export interface V2PdfDownloadParams {
  external_id?: string | null;
  template_id?: string | null;
  template_select?: string | null;
  lang?: string | null;
  language?: string | null;
  'Accept-Language'?: string;
}

export const buildV2PdfRequest = (
  params: (V2PdfDownloadParams & object) | null | undefined,
): {
  acceptLanguage?: string;
  externalID?: string | null;
  query: Record<string, unknown>;
} => {
  const pdfParams = (params ?? {}) as V2PdfDownloadParams & Record<string, unknown>;
  const {
    'Accept-Language': acceptLanguage,
    external_id,
    template_id,
    template_select,
    lang,
    language,
    ...query
  } = pdfParams;
  const resolvedTemplateID = template_id ?? template_select;
  const resolvedLanguage = language ?? lang;
  return {
    ...(acceptLanguage !== undefined ? { acceptLanguage } : undefined),
    ...(external_id !== undefined ? { externalID: external_id } : undefined),
    query: {
      ...query,
      ...(resolvedTemplateID != null ? { template_id: resolvedTemplateID } : undefined),
      ...(resolvedLanguage != null ? { language: resolvedLanguage } : undefined),
    },
  };
};

const escapeDispositionFilename = (filename: string): string => filename.replace(/(["\\])/g, '\\$1');

export const v2PdfDataToResponse = (data: V2PdfData): Response => {
  const body = data.content_base64 ? fromBase64(data.content_base64) : new Uint8Array();
  const filename = data.filename || 'download.pdf';
  const disposition = data.disposition || 'attachment';
  const headers = new Headers();
  headers.set('Content-Type', data.media_type || 'application/pdf');
  headers.set('Content-Disposition', `${disposition}; filename="${escapeDispositionFilename(filename)}"`);
  return new Response(body, { headers });
};

export const unwrapV2PdfResponse = (promise: APIPromise<V2Envelope<V2PdfData>>): APIPromise<Response> => {
  return promise._thenUnwrapResponse((envelope) => v2PdfDataToResponse(unwrapV2Data(envelope)));
};
