import { randomUUID } from 'node:crypto';

// Keep upload chunks below common hosted-client tool output truncation thresholds.
export const BINARY_UPLOAD_CHUNK_BASE64_LENGTH = 8_000;

const UPLOAD_TTL_MS = 15 * 60 * 1000;
const MAX_UPLOADS = 100;
const MAX_UPLOAD_BASE64_LENGTH = 12 * 1024 * 1024;

type BinaryUploadEntry = {
  chunks: string[];
  filename: string;
  mimeType: string;
  contentBase64Length: number;
  expectedBase64Length?: number | undefined;
  expectedByteLength?: number | undefined;
  createdAt: number;
  expiresAt: number;
  sessionId?: string | undefined;
};

export type StartBinaryUploadInput = {
  filename: string;
  mimeType?: string | undefined;
  expectedBase64Length?: number | undefined;
  expectedByteLength?: number | undefined;
  sessionId?: string | undefined;
};

export type StartedBinaryUploadReference = {
  uploadToken: string;
  chunkSize: number;
  expiresAt: string;
  nextOffset: number;
};

export type AppendBinaryUploadChunkResult =
  | {
      ok: true;
      filename: string;
      mimeType: string;
      contentBase64Offset: number;
      contentBase64Length: number;
      nextOffset: number;
      done: boolean;
      chunkSize: number;
      expectedBase64Length?: number | undefined;
      expectedByteLength?: number | undefined;
      expiresAt: string;
    }
  | {
      ok: false;
      reason:
        | 'not_found'
        | 'session_mismatch'
        | 'invalid_chunk'
        | 'invalid_offset'
        | 'exceeds_expected_length'
        | 'exceeds_max_length';
      message: string;
    };

export type FinishBinaryUploadResult =
  | {
      ok: true;
      filename: string;
      mimeType: string;
      contentBase64Length: number;
      byteLength: number;
      buffer: Buffer;
    }
  | {
      ok: false;
      reason: 'not_found' | 'session_mismatch' | 'incomplete' | 'invalid_base64';
      message: string;
    };

const uploads = new Map<string, BinaryUploadEntry>();

const nowMs = (): number => Date.now();

const cleanupUploads = (now = nowMs()): void => {
  for (const [uploadToken, entry] of uploads) {
    if (entry.expiresAt <= now) {
      uploads.delete(uploadToken);
    }
  }

  while (uploads.size > MAX_UPLOADS) {
    const oldestToken = uploads.keys().next().value as string | undefined;
    if (!oldestToken) {
      return;
    }
    uploads.delete(oldestToken);
  }
};

const asPositiveInteger = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : undefined;

export const startBinaryUpload = (input: StartBinaryUploadInput): StartedBinaryUploadReference => {
  const now = nowMs();
  cleanupUploads(now);

  const uploadToken = randomUUID();
  const expiresAt = now + UPLOAD_TTL_MS;
  uploads.set(uploadToken, {
    chunks: [],
    filename: input.filename,
    mimeType: input.mimeType || 'application/octet-stream',
    contentBase64Length: 0,
    expectedBase64Length: asPositiveInteger(input.expectedBase64Length),
    expectedByteLength: asPositiveInteger(input.expectedByteLength),
    createdAt: now,
    expiresAt,
    sessionId: input.sessionId,
  });

  return {
    uploadToken,
    chunkSize: BINARY_UPLOAD_CHUNK_BASE64_LENGTH,
    expiresAt: new Date(expiresAt).toISOString(),
    nextOffset: 0,
  };
};

const hasOnlyBase64Characters = (value: string): boolean => /^[A-Za-z0-9+/=\s_-]*$/.test(value);

export const appendBinaryUploadChunk = ({
  uploadToken,
  contentBase64,
  offset,
  sessionId,
}: {
  uploadToken: string;
  contentBase64: string;
  offset?: number | undefined;
  sessionId?: string | undefined;
}): AppendBinaryUploadChunkResult => {
  const now = nowMs();
  cleanupUploads(now);

  const entry = uploads.get(uploadToken);
  if (!entry) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Upload token was not found or has expired. Start a new chunked upload.',
    };
  }

  if (entry.sessionId && entry.sessionId !== sessionId) {
    return {
      ok: false,
      reason: 'session_mismatch',
      message: 'Upload token belongs to a different MCP session. Start a new chunked upload.',
    };
  }

  const normalizedChunk = contentBase64.replace(/\s+/g, '');
  if (!normalizedChunk || !hasOnlyBase64Characters(normalizedChunk)) {
    return {
      ok: false,
      reason: 'invalid_chunk',
      message: '`content_base64` must be a non-empty base64 chunk.',
    };
  }

  const currentOffset = entry.contentBase64Length;
  const requestedOffset =
    typeof offset === 'number' && Number.isFinite(offset) ? Math.trunc(offset) : currentOffset;
  if (requestedOffset !== currentOffset) {
    return {
      ok: false,
      reason: 'invalid_offset',
      message: `Chunk offset ${requestedOffset} does not match current upload offset ${currentOffset}.`,
    };
  }

  const nextLength = currentOffset + normalizedChunk.length;
  if (nextLength > MAX_UPLOAD_BASE64_LENGTH) {
    return {
      ok: false,
      reason: 'exceeds_max_length',
      message: 'Chunked upload exceeds the maximum supported base64 length.',
    };
  }
  if (entry.expectedBase64Length !== undefined && nextLength > entry.expectedBase64Length) {
    return {
      ok: false,
      reason: 'exceeds_expected_length',
      message: 'Chunked upload exceeds the expected content_base64_length from start.',
    };
  }

  entry.chunks.push(normalizedChunk);
  entry.contentBase64Length = nextLength;

  const done =
    entry.expectedBase64Length !== undefined && entry.contentBase64Length >= entry.expectedBase64Length;

  return {
    ok: true,
    filename: entry.filename,
    mimeType: entry.mimeType,
    contentBase64Offset: currentOffset,
    contentBase64Length: entry.contentBase64Length,
    nextOffset: entry.contentBase64Length,
    done,
    chunkSize: BINARY_UPLOAD_CHUNK_BASE64_LENGTH,
    expectedBase64Length: entry.expectedBase64Length,
    expectedByteLength: entry.expectedByteLength,
    expiresAt: new Date(entry.expiresAt).toISOString(),
  };
};

export const finishBinaryUpload = ({
  uploadToken,
  sessionId,
}: {
  uploadToken: string;
  sessionId?: string | undefined;
}): FinishBinaryUploadResult => {
  const now = nowMs();
  cleanupUploads(now);

  const entry = uploads.get(uploadToken);
  if (!entry) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Upload token was not found or has expired. Start a new chunked upload.',
    };
  }

  if (entry.sessionId && entry.sessionId !== sessionId) {
    return {
      ok: false,
      reason: 'session_mismatch',
      message: 'Upload token belongs to a different MCP session. Start a new chunked upload.',
    };
  }

  if (entry.expectedBase64Length !== undefined && entry.contentBase64Length !== entry.expectedBase64Length) {
    return {
      ok: false,
      reason: 'incomplete',
      message: `Upload is incomplete: received ${entry.contentBase64Length} of ${entry.expectedBase64Length} base64 characters.`,
    };
  }

  const contentBase64 = entry.chunks.join('');
  let buffer: Buffer;
  try {
    buffer = Buffer.from(contentBase64, 'base64');
  } catch {
    return {
      ok: false,
      reason: 'invalid_base64',
      message: 'The uploaded chunks could not be decoded as base64.',
    };
  }

  if (entry.expectedByteLength !== undefined && buffer.byteLength !== entry.expectedByteLength) {
    return {
      ok: false,
      reason: 'invalid_base64',
      message: `Decoded file length ${buffer.byteLength} did not match expected byte_length ${entry.expectedByteLength}.`,
    };
  }

  uploads.delete(uploadToken);

  return {
    ok: true,
    filename: entry.filename,
    mimeType: entry.mimeType,
    contentBase64Length: entry.contentBase64Length,
    byteLength: buffer.byteLength,
    buffer,
  };
};

export const resetBinaryUploadStoreForTests = (): void => {
  uploads.clear();
};
