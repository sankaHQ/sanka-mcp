import {
  cancelExportJobTool,
  cancelImportJobTool,
  exportRecordsTool,
  getExportJobTool,
  getImportJobTool,
  importRecordsTool,
  listExportJobsTool,
  listImportJobsTool,
  listIntegrationChannelsTool,
  uploadImportFileTool,
} from '../../packages/mcp-server/src/transfer-tools';

const oauthContext = (overrides?: {
  authMode?: 'none' | 'api_key' | 'legacy_oauth_jwt' | 'resource_oauth_jwt';
  scopes?: string[];
}) => ({
  authMode: overrides?.authMode ?? 'resource_oauth_jwt',
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: overrides?.scopes ?? [],
  },
});

describe('public transfer MCP tools', () => {
  it('advertises oauth security schemes on the transfer tools', () => {
    for (const tool of [
      uploadImportFileTool,
      importRecordsTool,
      getImportJobTool,
      listImportJobsTool,
      cancelImportJobTool,
      listIntegrationChannelsTool,
      exportRecordsTool,
      getExportJobTool,
      listExportJobsTool,
      cancelExportJobTool,
    ]) {
      expect(tool.tool.securitySchemes).toEqual([{ type: 'oauth2' }]);
    }
  });

  it('returns a reauth challenge for upload_import_file without authentication', async () => {
    const uploadFile = jest.fn();

    const result = await uploadImportFileTool.handler({
      reqContext: {
        client: {
          public: { imports: { uploadFile } },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: {
        filename: 'items.csv',
        content_base64: Buffer.from('name,price\nWidget,10\n').toString('base64'),
      },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('uploads an import file and defaults object_type to item', async () => {
    const uploadFile = jest.fn().mockResolvedValue({
      file_id: 'file-123',
      ok: true,
      object_type: 'item',
      filename: 'items.csv',
    });

    const result = await uploadImportFileTool.handler({
      reqContext: {
        client: {
          public: { imports: { uploadFile } },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filename: 'items.csv',
        content_base64: Buffer.from('name,price\nWidget,10\n').toString('base64'),
      },
    });

    expect(uploadFile).toHaveBeenCalledTimes(1);
    const body = uploadFile.mock.calls[0][0];
    expect(body.object_type).toBe('item');
    expect(body.file.name).toBe('items.csv');
    expect(result.structuredContent).toEqual({
      file_id: 'file-123',
      ok: true,
      object_type: 'item',
      filename: 'items.csv',
    });
  });

  it('requires file_id for import_records', async () => {
    const create = jest.fn();

    const result = await importRecordsTool.handler({
      reqContext: {
        client: {
          public: { imports: { create } },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(create).not.toHaveBeenCalled();
    const block = result.content[0];
    expect(block).toMatchObject({ type: 'text' });
  });

  it('creates an import job with mapped params', async () => {
    const create = jest.fn().mockResolvedValue({
      job_id: 'imp-1',
      job_type: 'import',
      object_type: 'item',
      status: 'pending',
      mode: 'upsert',
      started_async: true,
      source_kind: 'file',
      file_format: 'csv',
      file_id: 'file-123',
      summary: { processed: 0, succeeded: 0, failed: 0, total: 10, emitted_event_ids: [] },
    });

    const result = await importRecordsTool.handler({
      reqContext: {
        client: {
          public: { imports: { create } },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        file_id: 'file-123',
        operation: 'upsert',
        mapping_mode: 'manual',
        key_field: 'external_id',
        column_mappings: [{ source_header: 'Name', target_field: 'name' }],
      },
    });

    expect(create).toHaveBeenCalledWith({
      object_type: 'item',
      file_id: 'file-123',
      source_kind: 'file',
      file_format: 'csv',
      operation: 'upsert',
      mapping_mode: 'manual',
      key_field: 'external_id',
      column_mappings: [{ source_header: 'Name', target_field: 'name' }],
    });
    expect(result.structuredContent?.['job_id']).toBe('imp-1');
  });

  it('lists integration channels for exports', async () => {
    const listChannels = jest.fn().mockResolvedValue({
      channels: [{ channel_id: 'chan-1', provider: 'hubspot' }],
      message: 'OK',
    });

    const result = await listIntegrationChannelsTool.handler({
      reqContext: {
        client: {
          public: { integrations: { listChannels } },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        provider: 'hubspot',
      },
    });

    expect(listChannels).toHaveBeenCalledWith({
      object_type: 'deal',
      provider: 'hubspot',
    });
    expect(result.structuredContent).toEqual({
      channels: [{ channel_id: 'chan-1', provider: 'hubspot' }],
      message: 'OK',
    });
  });

  it('validates export_records channel and selection args', async () => {
    const create = jest.fn();

    const missingChannel = await exportRecordsTool.handler({
      reqContext: {
        client: {
          public: { exports: { create } },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        record_ids: ['deal-1'],
      },
    });
    expect(missingChannel.isError).toBe(true);

    const missingSelection = await exportRecordsTool.handler({
      reqContext: {
        client: {
          public: { exports: { create } },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        channel_id: 'chan-1',
      },
    });
    expect(missingSelection.isError).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates an export job and exposes lookup/list/cancel tool calls', async () => {
    const create = jest.fn().mockResolvedValue({
      job_id: 'exp-1',
      job_type: 'export',
      object_type: 'deal',
      status: 'completed',
      mode: 'update',
      destination_kind: 'integration',
      provider: 'hubspot',
      channel_id: 'chan-1',
      summary: {
        processed: 2,
        succeeded: 2,
        failed: 0,
        total: 2,
        requested_count: 2,
        skipped_count: 0,
        emitted_event_ids: ['evt-1', 'evt-2'],
      },
    });
    const retrieveImport = jest.fn().mockResolvedValue({
      job_id: 'imp-1',
      job_type: 'import',
      object_type: 'item',
      status: 'pending',
      summary: { processed: 0, succeeded: 0, failed: 0, total: 1, emitted_event_ids: [] },
    });
    const listImports = jest.fn().mockResolvedValue({
      jobs: [{ job_id: 'imp-1', job_type: 'import', object_type: 'item', status: 'pending', summary: {} }],
      message: 'OK',
    });
    const cancelImport = jest.fn().mockResolvedValue({
      job_id: 'imp-1',
      job_type: 'import',
      object_type: 'item',
      status: 'canceled',
      summary: {},
    });
    const retrieveExport = jest.fn().mockResolvedValue({
      job_id: 'exp-1',
      job_type: 'export',
      object_type: 'deal',
      status: 'completed',
      summary: {},
    });
    const listExports = jest.fn().mockResolvedValue({
      jobs: [{ job_id: 'exp-1', job_type: 'export', object_type: 'deal', status: 'completed', summary: {} }],
      message: 'OK',
    });
    const cancelExport = jest.fn().mockResolvedValue({
      job_id: 'exp-2',
      job_type: 'export',
      object_type: 'deal',
      status: 'canceled',
      summary: {},
    });

    const client = {
      public: {
        imports: {
          retrieve: retrieveImport,
          list: listImports,
          cancel: cancelImport,
        },
        exports: {
          create,
          retrieve: retrieveExport,
          list: listExports,
          cancel: cancelExport,
        },
      },
    } as any;

    const exportResult = await exportRecordsTool.handler({
      reqContext: { client, auth: oauthContext(), toolProfile: 'full' },
      args: {
        channel_id: 'chan-1',
        record_ids: ['deal-1', 'deal-2'],
      },
    });
    expect(create).toHaveBeenCalledWith({
      object_type: 'deal',
      destination_kind: 'integration',
      provider: 'hubspot',
      channel_id: 'chan-1',
      operation: 'update',
      record_ids: ['deal-1', 'deal-2'],
    });
    expect(exportResult.structuredContent?.['job_id']).toBe('exp-1');

    await getImportJobTool.handler({
      reqContext: { client, auth: oauthContext(), toolProfile: 'full' },
      args: { job_id: 'imp-1' },
    });
    expect(retrieveImport).toHaveBeenCalledWith('imp-1');

    await listImportJobsTool.handler({
      reqContext: { client, auth: oauthContext(), toolProfile: 'full' },
      args: { limit: 10 },
    });
    expect(listImports).toHaveBeenCalledWith({ object_type: 'item', limit: 10 });

    await cancelImportJobTool.handler({
      reqContext: { client, auth: oauthContext(), toolProfile: 'full' },
      args: { job_id: 'imp-1' },
    });
    expect(cancelImport).toHaveBeenCalledWith('imp-1');

    await getExportJobTool.handler({
      reqContext: { client, auth: oauthContext(), toolProfile: 'full' },
      args: { job_id: 'exp-1' },
    });
    expect(retrieveExport).toHaveBeenCalledWith('exp-1');

    await listExportJobsTool.handler({
      reqContext: { client, auth: oauthContext(), toolProfile: 'full' },
      args: { limit: 5 },
    });
    expect(listExports).toHaveBeenCalledWith({ object_type: 'deal', limit: 5 });

    await cancelExportJobTool.handler({
      reqContext: { client, auth: oauthContext(), toolProfile: 'full' },
      args: { job_id: 'exp-2' },
    });
    expect(cancelExport).toHaveBeenCalledWith('exp-2');
  });
});
