import { randomUUID } from 'node:crypto';

// Keep normal receipt/invoice PDFs to one append call while staying below the
// receipt-sized JSON-RPC payloads accepted by hosted clients.
export const BINARY_UPLOAD_CHUNK_BASE64_LENGTH = 160_000;

const UPLOAD_TTL_MS = 60 * 60 * 1000;
const MAX_UPLOADS = 100;
const MAX_PRINCIPAL_UPLOADS = 8;
const MAX_UPLOAD_BASE64_LENGTH = 12 * 1024 * 1024;
// Reserve for the ASCII buffer, assembly, decoded bytes, and outbound File/body
// copies. Leave most of the 1 GiB host available for normal MCP requests.
const MAX_RESERVED_BYTES = 400 * 1024 * 1024;
const MAX_PRINCIPAL_RESERVED_BYTES = 200 * 1024 * 1024;

type BinaryUploadEntry = {
  content: Buffer;
  reservedBytes: number;
  principalId: string;
  finishing: boolean;
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
  principalId?: string | undefined;
};

export type StartedBinaryUploadReference = {
  ok: true;
  uploadToken: string;
  chunkSize: number;
  expiresAt: string;
  nextOffset: number;
};

type StartBinaryUploadResult =
  | StartedBinaryUploadReference
  | {
      ok: false;
      reason: 'invalid_length' | 'capacity_exceeded';
      message: string;
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
      release: () => void;
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
    if (!entry.finishing && entry.expiresAt <= now) {
      uploads.delete(uploadToken);
    }
  }
};

const validLength = (value: number | undefined, maximum: number): boolean =>
  value === undefined || (Number.isSafeInteger(value) && value > 0 && value <= maximum);

export const startBinaryUpload = (input: StartBinaryUploadInput): StartBinaryUploadResult => {
  const now = nowMs();
  cleanupUploads(now);

  if (
    !validLength(input.expectedBase64Length, MAX_UPLOAD_BASE64_LENGTH) ||
    !validLength(input.expectedByteLength, (MAX_UPLOAD_BASE64_LENGTH * 3) / 4)
  ) {
    return {
      ok: false,
      reason: 'invalid_length',
      message: 'Upload lengths must be positive integers within the supported file limit.',
    };
  }
  const capacity =
    input.expectedBase64Length ??
    (input.expectedByteLength === undefined ?
      MAX_UPLOAD_BASE64_LENGTH
    : Math.ceil(input.expectedByteLength / 3) * 4);
  const principalId = input.principalId ?? 'stdio';
  const reservedBytes = capacity * 8 + 4096 + 2 * (input.filename.length + (input.mimeType?.length ?? 0));
  let globalReserved = 0;
  let principalReserved = 0;
  let principalCount = 0;
  for (const entry of uploads.values()) {
    globalReserved += entry.reservedBytes;
    if (entry.principalId === principalId) {
      principalReserved += entry.reservedBytes;
      principalCount++;
    }
  }
  if (
    uploads.size >= MAX_UPLOADS ||
    principalCount >= MAX_PRINCIPAL_UPLOADS ||
    globalReserved + reservedBytes > MAX_RESERVED_BYTES ||
    principalReserved + reservedBytes > MAX_PRINCIPAL_RESERVED_BYTES
  ) {
    return {
      ok: false,
      reason: 'capacity_exceeded',
      message: 'Chunked upload capacity is full. Finish existing uploads or retry after they expire.',
    };
  }

  const uploadToken = randomUUID();
  const expiresAt = now + UPLOAD_TTL_MS;
  uploads.set(uploadToken, {
    content: Buffer.allocUnsafe(capacity),
    reservedBytes,
    principalId,
    finishing: false,
    filename: input.filename,
    mimeType: input.mimeType || 'application/octet-stream',
    contentBase64Length: 0,
    expectedBase64Length: input.expectedBase64Length,
    expectedByteLength: input.expectedByteLength,
    createdAt: now,
    expiresAt,
    sessionId: input.sessionId,
  });

  return {
    ok: true,
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
  principalId = 'stdio',
}: {
  uploadToken: string;
  contentBase64: string;
  offset?: number | undefined;
  sessionId?: string | undefined;
  principalId?: string | undefined;
}): AppendBinaryUploadChunkResult => {
  const now = nowMs();
  cleanupUploads(now);

  const entry = uploads.get(uploadToken);
  if (!entry || entry.finishing) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Upload token was not found or has expired. Start a new chunked upload.',
    };
  }

  if (entry.sessionId !== sessionId || entry.principalId !== principalId) {
    return {
      ok: false,
      reason: 'session_mismatch',
      message: 'Upload token belongs to a different MCP session. Start a new chunked upload.',
    };
  }

  if (contentBase64.length > MAX_UPLOAD_BASE64_LENGTH) {
    return { ok: false, reason: 'exceeds_max_length', message: 'Chunk exceeds the supported upload size.' };
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
  if (nextLength > entry.content.length) {
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

  entry.content.write(normalizedChunk, currentOffset, 'ascii');
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
  principalId = 'stdio',
}: {
  uploadToken: string;
  sessionId?: string | undefined;
  principalId?: string | undefined;
}): FinishBinaryUploadResult => {
  const now = nowMs();
  cleanupUploads(now);

  const entry = uploads.get(uploadToken);
  if (!entry || entry.finishing) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Upload token was not found or has expired. Start a new chunked upload.',
    };
  }

  if (entry.sessionId !== sessionId || entry.principalId !== principalId) {
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

  const contentBase64 = entry.content.toString('ascii', 0, entry.contentBase64Length);
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

  entry.finishing = true;
  entry.content = Buffer.alloc(0);

  return {
    ok: true,
    filename: entry.filename,
    mimeType: entry.mimeType,
    contentBase64Length: entry.contentBase64Length,
    byteLength: buffer.byteLength,
    buffer,
    release: () => {
      uploads.delete(uploadToken);
    },
  };
};

export const resetBinaryUploadStoreForTests = (): void => {
  uploads.clear();
};
