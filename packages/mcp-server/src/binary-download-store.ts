import { randomUUID } from 'node:crypto';

export const BINARY_DOWNLOAD_INLINE_BASE64_LIMIT = 24_000;
export const BINARY_DOWNLOAD_CHUNK_BASE64_LENGTH = 24_000;

const DOWNLOAD_TTL_MS = 15 * 60 * 1000;
const MAX_DOWNLOADS = 100;

type BinaryDownloadEntry = {
  contentBase64: string;
  contentDisposition?: string | undefined;
  filename: string;
  mimeType: string;
  byteLength: number;
  createdAt: number;
  expiresAt: number;
  sessionId?: string | undefined;
};

export type StoreBinaryDownloadInput = {
  contentBase64: string;
  contentDisposition?: string | undefined;
  filename: string;
  mimeType: string;
  byteLength: number;
  sessionId?: string | undefined;
};

export type StoredBinaryDownloadReference = {
  downloadToken: string;
  chunkSize: number;
  totalChunks: number;
  expiresAt: string;
  contentBase64Length: number;
};

export type ReadBinaryDownloadChunkResult =
  | {
      ok: true;
      contentBase64: string;
      contentBase64Length: number;
      contentBase64Offset: number;
      nextOffset: number;
      done: boolean;
      chunkSize: number;
      filename: string;
      mimeType: string;
      byteLength: number;
      contentDisposition?: string | undefined;
      expiresAt: string;
    }
  | {
      ok: false;
      reason: 'not_found' | 'session_mismatch' | 'invalid_offset';
      message: string;
    };

const downloads = new Map<string, BinaryDownloadEntry>();

const nowMs = (): number => Date.now();

const cleanupDownloads = (now = nowMs()): void => {
  for (const [downloadToken, entry] of downloads) {
    if (entry.expiresAt <= now) {
      downloads.delete(downloadToken);
    }
  }

  while (downloads.size > MAX_DOWNLOADS) {
    const oldestToken = downloads.keys().next().value as string | undefined;
    if (!oldestToken) {
      return;
    }
    downloads.delete(oldestToken);
  }
};

const normalizeChunkSize = (chunkSize?: number): number => {
  const requested =
    typeof chunkSize === 'number' && Number.isFinite(chunkSize) ?
      Math.trunc(chunkSize)
    : BINARY_DOWNLOAD_CHUNK_BASE64_LENGTH;
  const clamped = Math.min(Math.max(requested, 4), BINARY_DOWNLOAD_CHUNK_BASE64_LENGTH);
  return Math.floor(clamped / 4) * 4;
};

export const storeBinaryDownload = (input: StoreBinaryDownloadInput): StoredBinaryDownloadReference => {
  const now = nowMs();
  cleanupDownloads(now);

  const downloadToken = randomUUID();
  const expiresAt = now + DOWNLOAD_TTL_MS;
  downloads.set(downloadToken, {
    contentBase64: input.contentBase64,
    contentDisposition: input.contentDisposition,
    filename: input.filename,
    mimeType: input.mimeType,
    byteLength: input.byteLength,
    createdAt: now,
    expiresAt,
    sessionId: input.sessionId,
  });

  return {
    downloadToken,
    chunkSize: BINARY_DOWNLOAD_CHUNK_BASE64_LENGTH,
    totalChunks: Math.ceil(input.contentBase64.length / BINARY_DOWNLOAD_CHUNK_BASE64_LENGTH),
    expiresAt: new Date(expiresAt).toISOString(),
    contentBase64Length: input.contentBase64.length,
  };
};

export const readBinaryDownloadChunk = ({
  downloadToken,
  offset,
  chunkSize,
  sessionId,
}: {
  downloadToken: string;
  offset: number;
  chunkSize?: number | undefined;
  sessionId?: string | undefined;
}): ReadBinaryDownloadChunkResult => {
  const now = nowMs();
  cleanupDownloads(now);

  const entry = downloads.get(downloadToken);
  if (!entry) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Download token was not found or has expired. Re-run the original PDF download tool.',
    };
  }

  if (entry.sessionId && entry.sessionId !== sessionId) {
    return {
      ok: false,
      reason: 'session_mismatch',
      message: 'Download token belongs to a different MCP session. Re-run the original PDF download tool.',
    };
  }

  if (!Number.isFinite(offset) || offset < 0 || offset > entry.contentBase64.length) {
    return {
      ok: false,
      reason: 'invalid_offset',
      message: '`offset` must be between 0 and content_base64_length.',
    };
  }

  const normalizedOffset = Math.trunc(offset);
  const normalizedChunkSize = normalizeChunkSize(chunkSize);
  const contentBase64 = entry.contentBase64.slice(normalizedOffset, normalizedOffset + normalizedChunkSize);
  const nextOffset = normalizedOffset + contentBase64.length;

  return {
    ok: true,
    contentBase64,
    contentBase64Length: entry.contentBase64.length,
    contentBase64Offset: normalizedOffset,
    nextOffset,
    done: nextOffset >= entry.contentBase64.length,
    chunkSize: normalizedChunkSize,
    filename: entry.filename,
    mimeType: entry.mimeType,
    byteLength: entry.byteLength,
    contentDisposition: entry.contentDisposition,
    expiresAt: new Date(entry.expiresAt).toISOString(),
  };
};

export const resetBinaryDownloadStoreForTests = (): void => {
  downloads.clear();
};
