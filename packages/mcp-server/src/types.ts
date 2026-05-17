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
): Promise<ToolCallResult> {
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const mimeType = blob.type || response.headers.get('content-type') || 'application/octet-stream';
  const contentDisposition = response.headers.get('content-disposition');
  const data = Buffer.from(arrayBuffer).toString('base64');

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
      filename: readContentDispositionFilename(contentDisposition) ?? fallbackFilename,
      byte_length: arrayBuffer.byteLength,
      content_base64: data,
    },
  };
}

export async function asBinaryContentResult(response: Response): Promise<ToolCallResult> {
  const blob = await response.blob();
  const mimeType = blob.type;
  const data = Buffer.from(await blob.arrayBuffer()).toString('base64');
  if (mimeType.startsWith('image/')) {
    return {
      content: [{ type: 'image', mimeType, data }],
    };
  } else if (mimeType.startsWith('audio/')) {
    return {
      content: [{ type: 'audio', mimeType, data }],
    };
  } else {
    return {
      content: [
        {
          type: 'resource',
          resource: {
            // We must give a URI, even though this isn't actually an MCP resource.
            uri: TOOL_RESPONSE_RESOURCE_URI,
            mimeType,
            blob: data,
          },
        },
      ],
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
