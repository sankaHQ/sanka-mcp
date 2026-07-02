import {
  createChunkedAttachmentUploadTools,
  defineDetailTool,
  defineListTool,
  defineMutationTool,
} from '../../packages/mcp-server/src/tool-factories';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

const authenticatedContext = (client: unknown = {}): McpRequestContext =>
  ({
    client,
    auth: {
      authMode: 'oauth_bearer',
      clientOptions: {},
      oauth: {
        authorizationServerUrl: 'https://app.sanka.com',
        resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
        resourceUrl: 'https://mcp.sanka.com/mcp',
        scopes: [],
      },
    },
    toolProfile: 'full',
  }) as unknown as McpRequestContext;

const unauthenticatedContext = (): McpRequestContext =>
  ({
    client: {},
    auth: { authMode: 'none', clientOptions: {} },
    toolProfile: 'full',
  }) as unknown as McpRequestContext;

const firstTextContent = (result: { content: unknown[] }): string => {
  const entry = result.content.find(
    (content) => (content as Record<string, unknown> | undefined)?.['type'] === 'text',
  ) as Record<string, unknown> | undefined;
  return typeof entry?.['text'] === 'string' ? entry['text'] : '';
};

const WIDGET_INPUT_SCHEMA = { type: 'object' as const, properties: {} };
const WIDGET_OUTPUT_SCHEMA = { type: 'object' as const, properties: {} };

const widgetIdentity = {
  resource: 'widgets',
  tags: ['crm', 'widgets'],
  httpPath: '/api/v2/widgets',
  inputSchema: WIDGET_INPUT_SCHEMA,
  outputSchema: WIDGET_OUTPUT_SCHEMA,
};

describe('defineListTool', () => {
  const listWidgetsTool = defineListTool({
    ...widgetIdentity,
    httpMethod: 'get',
    operationId: 'public.widgets.list',
    name: 'list_widgets',
    title: 'List widgets',
    description: 'Review widgets.',
    label: 'widgets',
    previewKeys: ['name'],
    validateArgs: (args) =>
      args?.['broken'] ? { content: [{ type: 'text', text: 'broken args' }], isError: true } : undefined,
    fetchList: ({ reqContext, args }) =>
      (
        reqContext.client as unknown as {
          listWidgets: (args: unknown) => Promise<{
            count: number;
            data: Array<Record<string, unknown>>;
            message: string;
            page: number;
            total: number;
          }>;
        }
      ).listWidgets(args),
  });

  it('generates the tool descriptor and metadata from the identity', () => {
    expect(listWidgetsTool.metadata).toEqual({
      resource: 'widgets',
      operation: 'read',
      tags: ['crm', 'widgets'],
      httpMethod: 'get',
      httpPath: '/api/v2/widgets',
      operationId: 'public.widgets.list',
    });
    expect(listWidgetsTool.tool).toEqual({
      name: 'list_widgets',
      title: 'List widgets',
      description: 'Review widgets.',
      inputSchema: WIDGET_INPUT_SCHEMA,
      outputSchema: WIDGET_OUTPUT_SCHEMA,
      securitySchemes: [{ type: 'oauth2' }],
      annotations: {
        title: 'List widgets',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    });
  });

  it('returns the auth preamble error without fetching when unauthenticated', async () => {
    const listWidgets = jest.fn();
    const result = await listWidgetsTool.handler({
      reqContext: { ...unauthenticatedContext(), client: { listWidgets } as never },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain('Authentication required to use List widgets');
    expect(listWidgets).not.toHaveBeenCalled();
  });

  it('returns the validation error without fetching when validateArgs rejects', async () => {
    const listWidgets = jest.fn();
    const result = await listWidgetsTool.handler({
      reqContext: authenticatedContext({ listWidgets }),
      args: { broken: true },
    });

    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toBe('broken args');
    expect(listWidgets).not.toHaveBeenCalled();
  });

  it('delegates to fetchList and wraps the payload with the shared list plumbing', async () => {
    const listWidgets = jest.fn().mockResolvedValue({
      count: 1,
      data: [{ id: 'widget-1', name: 'Sprocket' }],
      message: 'ok',
      page: 1,
      total: 3,
      permission: 'edit',
    });
    const result = await listWidgetsTool.handler({
      reqContext: authenticatedContext({ listWidgets }),
      args: { search: 'Spro' },
    });

    expect(listWidgets).toHaveBeenCalledWith({ search: 'Spro' });
    expect(result.isError).toBeUndefined();
    expect(firstTextContent(result)).toContain('Found 3 widgets.');
    expect(firstTextContent(result)).toContain('Sprocket');
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 3,
      message: 'ok',
      permission: 'edit',
      results: [{ id: 'widget-1', name: 'Sprocket' }],
    });
  });
});

describe('defineDetailTool', () => {
  const getWidgetTool = defineDetailTool({
    ...widgetIdentity,
    httpMethod: 'get',
    httpPath: '/api/v2/widgets/{widget_id}',
    operationId: 'public.widgets.retrieve',
    name: 'get_widget',
    title: 'Get widget',
    description: 'Load one widget.',
    entity: 'widget',
    previewKeys: ['name'],
    missingTargetError: '`widget_id` is required.',
    resolveTarget: (args) => ({
      id: typeof args?.['widget_id'] === 'string' ? args['widget_id'] : undefined,
      params: { external_id: args?.['external_id'] },
    }),
    retrieve: ({ reqContext, id, params }) =>
      (
        reqContext.client as unknown as {
          retrieveWidget: (id: string, params: unknown) => Promise<unknown>;
        }
      ).retrieveWidget(id, params),
  });

  it('marks the tool read-only and non-destructive', () => {
    expect(getWidgetTool.metadata.operation).toBe('read');
    expect(getWidgetTool.tool.annotations).toEqual({
      title: 'Get widget',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    });
  });

  it('returns the missing-target error without retrieving', async () => {
    const retrieveWidget = jest.fn();
    const result = await getWidgetTool.handler({
      reqContext: authenticatedContext({ retrieveWidget }),
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toBe('`widget_id` is required.');
    expect(retrieveWidget).not.toHaveBeenCalled();
  });

  it('returns the auth preamble error without retrieving when unauthenticated', async () => {
    const retrieveWidget = jest.fn();
    const result = await getWidgetTool.handler({
      reqContext: { ...unauthenticatedContext(), client: { retrieveWidget } as never },
      args: { widget_id: 'widget-1' },
    });

    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain('Authentication required to use Get widget');
    expect(retrieveWidget).not.toHaveBeenCalled();
  });

  it('delegates to retrieve with the resolved target and wraps the detail summary', async () => {
    const retrieveWidget = jest.fn().mockResolvedValue({ id: 'widget-1', name: 'Sprocket' });
    const result = await getWidgetTool.handler({
      reqContext: authenticatedContext({ retrieveWidget }),
      args: { widget_id: 'widget-1', external_id: 'W-1' },
    });

    expect(retrieveWidget).toHaveBeenCalledWith('widget-1', { external_id: 'W-1' });
    expect(result.isError).toBeUndefined();
    expect(firstTextContent(result)).toBe('Loaded widget: Sprocket.');
    expect(result.structuredContent).toEqual({ id: 'widget-1', name: 'Sprocket' });
  });
});

describe('defineMutationTool', () => {
  const createWidgetTool = defineMutationTool({
    ...widgetIdentity,
    httpMethod: 'post',
    operationId: 'public.widgets.create',
    name: 'create_widget',
    title: 'Create widget',
    description: 'Create a widget.',
    entity: 'Widget',
    action: 'created',
    idKeys: ['widget_id'],
    execute: ({ reqContext, args }) =>
      (reqContext.client as unknown as { createWidget: (args: unknown) => Promise<unknown> }).createWidget(
        args,
      ),
  });

  const deleteWidgetTool = defineMutationTool({
    ...widgetIdentity,
    httpMethod: 'delete',
    httpPath: '/api/v2/widgets/{widget_id}',
    operationId: 'public.widgets.delete',
    name: 'delete_widget',
    title: 'Delete widget',
    description: 'Delete a widget.',
    entity: 'Widget',
    action: 'deleted',
    idKeys: ['widget_id'],
    missingTargetError: '`widget_id` is required.',
    resolveTarget: (args) => ({
      id: typeof args?.['widget_id'] === 'string' ? args['widget_id'] : undefined,
      params: { dry_run: args?.['dry_run'] },
    }),
    execute: ({ reqContext, id, params }) =>
      (
        reqContext.client as unknown as {
          deleteWidget: (id: string, params: unknown) => Promise<unknown>;
        }
      ).deleteWidget(id, params),
  });

  it('marks mutations as writes and derives destructiveHint from the action', () => {
    expect(createWidgetTool.metadata.operation).toBe('write');
    expect(createWidgetTool.tool.annotations).toEqual({
      title: 'Create widget',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    });
    expect(deleteWidgetTool.metadata.operation).toBe('write');
    expect(deleteWidgetTool.tool.annotations).toEqual({
      title: 'Delete widget',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    });
  });

  it('returns the auth preamble error without executing when unauthenticated', async () => {
    const createWidget = jest.fn();
    const result = await createWidgetTool.handler({
      reqContext: { ...unauthenticatedContext(), client: { createWidget } as never },
      args: { name: 'Sprocket' },
    });

    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain('Authentication required to use Create widget');
    expect(createWidget).not.toHaveBeenCalled();
  });

  it('delegates untargeted mutations to execute and wraps the mutation summary', async () => {
    const createWidget = jest.fn().mockResolvedValue({ ok: true, widget_id: 'widget-9' });
    const result = await createWidgetTool.handler({
      reqContext: authenticatedContext({ createWidget }),
      args: { name: 'Sprocket' },
    });

    expect(createWidget).toHaveBeenCalledWith({ name: 'Sprocket' });
    expect(result.isError).toBeUndefined();
    expect(firstTextContent(result)).toBe('Widget created: widget-9.');
    expect(result.structuredContent).toEqual({ ok: true, widget_id: 'widget-9' });
  });

  it('returns the missing-target error without executing targeted mutations', async () => {
    const deleteWidget = jest.fn();
    const result = await deleteWidgetTool.handler({
      reqContext: authenticatedContext({ deleteWidget }),
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toBe('`widget_id` is required.');
    expect(deleteWidget).not.toHaveBeenCalled();
  });

  it('delegates targeted mutations with the resolved id and params', async () => {
    const deleteWidget = jest.fn().mockResolvedValue({ status: 'archived' });
    const result = await deleteWidgetTool.handler({
      reqContext: authenticatedContext({ deleteWidget }),
      args: { widget_id: 'widget-9', dry_run: true },
    });

    expect(deleteWidget).toHaveBeenCalledWith('widget-9', { dry_run: true });
    expect(result.isError).toBeUndefined();
    expect(firstTextContent(result)).toBe('Widget deleted: archived.');
    expect(result.structuredContent).toEqual({ status: 'archived' });
  });
});

describe('createChunkedAttachmentUploadTools', () => {
  const triplet = createChunkedAttachmentUploadTools({
    resource: 'widgets',
    tags: ['crm', 'widgets'],
    httpPath: '/api/v2/widgets/files',
    operationIdPrefix: 'public.widgets',
    entityName: 'widget',
    attachmentLabel: 'widget attachment',
    fileKindLabel: 'widget PDFs',
    directUploadToolName: 'upload_widget_attachment',
    createToolName: 'create_widget',
    updateToolName: 'update_widget',
    startToolName: 'start_widget_attachment_upload',
    appendToolName: 'append_widget_attachment_upload_chunk',
    finishToolName: 'finish_widget_attachment_upload',
    startToolTitle: 'Start widget attachment upload',
    appendToolTitle: 'Append widget attachment upload chunk',
    finishToolTitle: 'Finish widget attachment upload',
    uploadAttachment: () => Promise.resolve({}),
  });

  it('generates the start/append/finish triplet from the resource config', () => {
    expect(triplet.startTool.tool.name).toBe('start_widget_attachment_upload');
    expect(triplet.appendTool.tool.name).toBe('append_widget_attachment_upload_chunk');
    expect(triplet.finishTool.tool.name).toBe('finish_widget_attachment_upload');
    expect(triplet.startTool.metadata).toEqual({
      resource: 'widgets',
      operation: 'write',
      tags: ['crm', 'widgets'],
      operationId: 'public.widgets.startChunkedAttachmentUpload',
    });
    expect(triplet.finishTool.metadata.httpPath).toBe('/api/v2/widgets/files');
    expect(triplet.startTool.tool.description).toContain('upload_widget_attachment');
    expect(triplet.startTool.tool.description).toContain('create_widget or update_widget');
  });

  it('applies the auth preamble to the generated start tool', async () => {
    const result = await triplet.startTool.handler({
      reqContext: unauthenticatedContext(),
      args: { filename: 'a.pdf' },
    });

    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain(
      'Authentication required to use Start widget attachment upload',
    );
  });
});
