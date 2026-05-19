// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Sanka from 'sanka-sdk';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ResolvedClientAuth } from './auth';
import { ToolProfile } from './profile';

type TextContentBlock = {
  type: 'text';
  text: string;
};

type ImageContentBlock = {
  type: 'image';
  data: string;
  mimeType: string;
};

type AudioContentBlock = {
  type: 'audio';
  data: string;
  mimeType: string;
};

type ResourceContentBlock = {
  type: 'resource';
  resource:
    | {
        uri: string;
        mimeType: string;
        text: string;
      }
    | {
        uri: string;
        mimeType: string;
        blob: string;
      };
};

export type ContentBlock = TextContentBlock | ImageContentBlock | AudioContentBlock | ResourceContentBlock;

export type ToolCallResult = {
  content: ContentBlock[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

export type ToolSecurityScheme =
  | {
      type: 'noauth';
    }
  | {
      type: 'oauth2';
      scopes?: string[] | undefined;
    };

export type AppTool = Tool & {
  securitySchemes?: ToolSecurityScheme[] | undefined;
};

export type McpRequestContext = {
  client: Sanka;
  mcpSessionId?: string | undefined;
  mcpClientInfo?: { name: string; version: string } | undefined;
  toolProfile?: ToolProfile | undefined;
  auth?: ResolvedClientAuth | undefined;
  downloadBaseUrl?: string | undefined;
};

export type HandlerFunction = ({
  reqContext,
  args,
}: {
  reqContext: McpRequestContext;
  args: Record<string, unknown> | undefined;
}) => Promise<ToolCallResult>;

export function asTextContentResult(result: unknown): ToolCallResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

const TOOL_RESPONSE_RESOURCE_URI = 'resource://tool-response';

export type StoreBinaryDownload = (input: {
  contentBase64: string;
  contentDisposition?: string | undefined;
  filename: string;
  mimeType: string;
  byteLength: number;
  sessionId?: string | undefined;
}) => {
  downloadToken: string;
  chunkSize: number;
  totalChunks: number;
  expiresAt: string;
  contentBase64Length: number;
};

export type CreateBinaryDownloadUrl = (downloadToken: string) => string | undefined;

const trimContentDispositionValue = (value: string): string => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const decodeContentDispositionFilename = (value: string): string => {
  const unquoted = trimContentDispositionValue(value);
  const rfc5987Match = /^([^']*)'[^']*'(.*)$/.exec(unquoted);
  const encodedFilename = rfc5987Match?.[2] ?? unquoted;

  try {
    return decodeURIComponent(encodedFilename);
  } catch {
    return encodedFilename;
  }
};

const readContentDispositionFilename = (contentDisposition: string | null): string | undefined => {
  if (!contentDisposition) {
    return undefined;
  }

  const filenameStarMatch = /(?:^|;)\s*filename\*\s*=\s*([^;]+)/i.exec(contentDisposition);
  if (filenameStarMatch?.[1]) {
    const decodedFilename = decodeContentDispositionFilename(filenameStarMatch[1]);
    if (decodedFilename) {
      return decodedFilename;
    }
  }

  const filenameMatch = /(?:^|;)\s*filename\s*=\s*("[^"]*"|[^;]+)/i.exec(contentDisposition);
  if (filenameMatch?.[1]) {
    const filename = trimContentDispositionValue(filenameMatch[1]);
    if (filename) {
      return filename;
    }
  }

  return undefined;
};

export async function asBinaryDownloadResult(
  response: Response,
  fallbackFilename = 'download',
  options?: {
    inlineBase64Limit?: number | undefined;
    sessionId?: string | undefined;
    storeLargeDownload?: StoreBinaryDownload | undefined;
    createDownloadUrl?: CreateBinaryDownloadUrl | undefined;
  },
): Promise<ToolCallResult> {
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const mimeType = blob.type || response.headers.get('content-type') || 'application/octet-stream';
  const contentDisposition = response.headers.get('content-disposition');
  const filename = readContentDispositionFilename(contentDisposition) ?? fallbackFilename;
  const byteLength = arrayBuffer.byteLength;
  const data = Buffer.from(arrayBuffer).toString('base64');
  const inlineBase64Limit = options?.inlineBase64Limit;

  if (options?.storeLargeDownload && inlineBase64Limit !== undefined && data.length > inlineBase64Limit) {
    const stored = options.storeLargeDownload({
      contentBase64: data,
      contentDisposition: contentDisposition ?? undefined,
      filename,
      mimeType,
      byteLength,
      sessionId: options.sessionId,
    });
    const downloadUrl = options.createDownloadUrl?.(stored.downloadToken);
    if (downloadUrl) {
      return {
        content: [
          {
            type: 'text',
            text: `Prepared ${filename} (${byteLength} bytes). Download it directly from download_url before telling the user the PDF download is complete. If the URL is unavailable, fall back to read_binary_download_chunk with download_token ${stored.downloadToken}.`,
          },
        ],
        structuredContent: {
          ...(contentDisposition ? { content_disposition: contentDisposition } : undefined),
          mime_type: mimeType,
          filename,
          byte_length: byteLength,
          completion_status: 'download_url_ready',
          download_complete: false,
          file_assembly_required: false,
          content_base64_available: false,
          content_base64_length: stored.contentBase64Length,
          download_token: stored.downloadToken,
          download_url: downloadUrl,
          download_url_expires_at: stored.expiresAt,
          download_transfer_mode: 'url',
          fallback_next_tool: 'read_binary_download_chunk',
          chunk_size: stored.chunkSize,
          total_chunks: stored.totalChunks,
          expires_at: stored.expiresAt,
          next_offset: 0,
          next_action:
            'Download the file from download_url and attach or save it before reporting completion. If the URL fails, call read_binary_download_chunk from next_offset until done=true, concatenate content_base64 chunks in offset order, decode the combined base64, then attach or save the decoded PDF.',
        },
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: `Prepared ${filename} (${byteLength} bytes), but the PDF file is not attached yet. The base64 payload is too large for a single MCP result; call read_binary_download_chunk with download_token ${stored.downloadToken} from offset 0 until done=true, concatenate chunks before decoding, then attach or save the decoded PDF before telling the user the download is complete.`,
        },
      ],
      structuredContent: {
        ...(contentDisposition ? { content_disposition: contentDisposition } : undefined),
        mime_type: mimeType,
        filename,
        byte_length: byteLength,
        completion_status: 'requires_chunks',
        download_complete: false,
        file_assembly_required: true,
        content_base64_available: false,
        content_base64_length: stored.contentBase64Length,
        download_token: stored.downloadToken,
        required_next_tool: 'read_binary_download_chunk',
        chunk_size: stored.chunkSize,
        total_chunks: stored.totalChunks,
        expires_at: stored.expiresAt,
        next_offset: 0,
        next_action:
          'Call read_binary_download_chunk from next_offset until done=true, concatenate content_base64 chunks in offset order, decode the combined base64, then attach or save the decoded PDF before reporting completion.',
      },
    };
  }

  return {
    content: [
      {
        type: 'resource',
        resource: {
          uri: TOOL_RESPONSE_RESOURCE_URI,
          mimeType,
          blob: data,
        },
      },
    ],
    structuredContent: {
      ...(contentDisposition ? { content_disposition: contentDisposition } : undefined),
      mime_type: mimeType,
      filename,
      byte_length: byteLength,
      completion_status: 'inline_content',
      download_complete: true,
      file_assembly_required: false,
      content_base64_available: true,
      content_base64: data,
    },
  };
}

export async function asBinaryContentResult(response: Response): Promise<ToolCallResult> {
  const blob = await response.blob();
  const mimeType = blob.type;
  const buffer = Buffer.from(await blob.arrayBuffer());
  const data = buffer.toString('base64');
  const binaryMeta = {
    mime_type: mimeType,
    byte_length: buffer.byteLength,
    content_base64: data,
  };
  if (mimeType.startsWith('image/')) {
    return {
      content: [{ type: 'image', mimeType, data }],
      _meta: binaryMeta,
    };
  } else if (mimeType.startsWith('audio/')) {
    return {
      content: [{ type: 'audio', mimeType, data }],
      _meta: binaryMeta,
    };
  } else {
    const resourceUri = 'resource://tool-response';
    return {
      content: [
        {
          type: 'resource',
          resource: {
            // We must give a URI, even though this isn't actually an MCP resource.
            uri: resourceUri,
            mimeType,
            blob: data,
          },
        },
      ],
      _meta: {
        ...binaryMeta,
        resource_uri: resourceUri,
      },
    };
  }
}

export function asErrorResult(message: string): ToolCallResult {
  return {
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
    isError: true,
  };
}

export type Metadata = {
  resource: string;
  operation: 'read' | 'write';
  tags: string[];
  httpMethod?: string;
  httpPath?: string;
  operationId?: string;
};

export type McpTool = {
  metadata: Metadata;
  tool: AppTool;
  handler: HandlerFunction;
};
