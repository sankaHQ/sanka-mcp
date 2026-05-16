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
