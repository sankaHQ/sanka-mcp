import { File } from 'node:buffer';
import {
  crmAppendBillAttachmentUploadChunkTool,
  crmAppendExpenseAttachmentUploadChunkTool,
  crmAppendOrderAttachmentUploadChunkTool,
  crmCreateBillTool,
  crmCreateExpenseTool,
  crmFinishBillAttachmentUploadTool,
  crmFinishExpenseAttachmentUploadTool,
  crmFinishOrderAttachmentUploadTool,
  crmStartBillAttachmentUploadTool,
  crmStartExpenseAttachmentUploadTool,
  crmStartOrderAttachmentUploadTool,
  crmUpdateBillTool,
  crmUpdateExpenseTool,
  crmUploadBillAttachmentTool,
  crmUploadEstimateAttachmentTool,
  crmUploadExpenseAttachmentTool,
  crmUploadInvoiceAttachmentTool,
  crmUploadOrderAttachmentTool,
  crmUploadPurchaseOrderAttachmentTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { resetBinaryDownloadStoreForTests } from '../../../packages/mcp-server/src/binary-download-store';
import {
  BINARY_UPLOAD_CHUNK_BASE64_LENGTH,
  resetBinaryUploadStoreForTests,
} from '../../../packages/mcp-server/src/binary-upload-store';
import { oauthContext } from './helpers';

describe('CRM attachment upload tools', () => {
  beforeEach(() => {
    resetBinaryDownloadStoreForTests();
    resetBinaryUploadStoreForTests();
  });

  it('uploads a bill attachment from base64 content', async () => {
    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'file-1',
      filename: 'bill.pdf',
    });

    const result = await crmUploadBillAttachmentTool.handler({
      reqContext: {
        client: {
          public: {
            bills: { uploadAttachment },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filename: 'bill.pdf',
        mime_type: 'application/pdf',
        content_base64: Buffer.from('test bill').toString('base64'),
      },
    });

    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const [payload] = uploadAttachment.mock.calls[0];
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe('bill.pdf');
    expect(payload.file.type).toBe('application/pdf');
    expect(result.structuredContent).toEqual({
      ok: true,
      file_id: 'file-1',
      filename: 'bill.pdf',
    });
  });

  it('surfaces chunked upload guidance on bill attachment and mutation tools', () => {
    const createDescription = crmCreateBillTool.tool.description ?? '';
    expect(createDescription).toContain('start_bill_attachment_upload');
    expect(createDescription).toContain('append_bill_attachment_upload_chunk');
    expect(createDescription).toContain('finish_bill_attachment_upload');
    expect(createDescription).toContain('Do not silently drop a provided or required attachment');

    const updateDescription = crmUpdateBillTool.tool.description ?? '';
    expect(updateDescription).toContain('start_bill_attachment_upload');
    expect(updateDescription).toContain('attachment_file_ids');

    const directUploadDescription = crmUploadBillAttachmentTool.tool.description ?? '';
    expect(directUploadDescription).toContain('already available base64');
    expect(directUploadDescription).toContain('start_bill_attachment_upload');

    const createInputSchema = crmCreateBillTool.tool.inputSchema as any;
    expect(createInputSchema.properties.attachment_file_ids.description).toContain(
      'append_bill_attachment_upload_chunk until done',
    );

    expect((crmAppendBillAttachmentUploadChunkTool.tool.inputSchema as any).required).toEqual([
      'content_base64',
    ]);
    expect((crmAppendBillAttachmentUploadChunkTool.tool.inputSchema as any).anyOf).toEqual([
      { required: ['upload_token'] },
      { required: ['token'] },
    ]);
    expect((crmFinishBillAttachmentUploadTool.tool.inputSchema as any).required ?? []).toEqual([]);
    expect((crmFinishBillAttachmentUploadTool.tool.inputSchema as any).anyOf).toEqual([
      { required: ['upload_token'] },
      { required: ['token'] },
    ]);
    expect(crmStartBillAttachmentUploadTool.tool.description).toContain('Do not abandon the attachment');
    expect(crmAppendBillAttachmentUploadChunkTool.tool.description).toContain(
      'Continue appending until the result returns done=true',
    );
  });

  it('uploads a bill attachment from chunked base64 content', async () => {
    const billBytes = Buffer.from('bill pdf bytes that are sent in chunks');
    const contentBase64 = billBytes.toString('base64');
    const firstChunk = contentBase64.slice(0, 12);
    const secondChunk = contentBase64.slice(12);
    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'file-1',
      filename: 'bill.pdf',
    });
    const reqContext = {
      client: {
        public: {
          bills: { uploadAttachment },
        },
      } as any,
      auth: oauthContext(),
      mcpSessionId: 'session-1',
      toolProfile: 'full' as const,
    };

    const startResult = await crmStartBillAttachmentUploadTool.handler({
      reqContext,
      args: {
        filename: 'bill.pdf',
        mime_type: 'application/pdf',
        content_base64_length: contentBase64.length,
        byte_length: billBytes.byteLength,
      },
    });
    const uploadToken = startResult.structuredContent?.['upload_token'] as string;
    expect(uploadToken).toBeTruthy();
    expect(startResult.structuredContent).toMatchObject({
      chunk_size: BINARY_UPLOAD_CHUNK_BASE64_LENGTH,
      recommended_chunk_count: 1,
      recommended_upload_strategy: 'single_append_then_finish',
      completion_status: 'requires_chunks',
      required_next_tool: 'append_bill_attachment_upload_chunk',
    });
    expect(startResult.structuredContent?.['next_action']).toEqual(
      expect.stringContaining('finish_bill_attachment_upload'),
    );
    expect(startResult.structuredContent?.['next_action']).toEqual(
      expect.stringContaining('do not drop it and call create_bill or update_bill without its file_id'),
    );

    const firstAppend = await crmAppendBillAttachmentUploadChunkTool.handler({
      reqContext,
      args: {
        upload_token: uploadToken,
        offset: 0,
        content_base64: firstChunk,
      },
    });
    expect(firstAppend.structuredContent).toMatchObject({
      content_base64_offset: 0,
      content_base64_length: firstChunk.length,
      next_offset: firstChunk.length,
      done: false,
      required_next_tool: 'append_bill_attachment_upload_chunk',
    });

    const secondAppend = await crmAppendBillAttachmentUploadChunkTool.handler({
      reqContext,
      args: {
        upload_token: uploadToken,
        offset: firstChunk.length,
        content_base64: secondChunk,
      },
    });
    expect(secondAppend.structuredContent).toMatchObject({
      content_base64_offset: firstChunk.length,
      content_base64_length: contentBase64.length,
      next_offset: contentBase64.length,
      done: true,
      required_next_tool: 'finish_bill_attachment_upload',
    });

    const finishResult = await crmFinishBillAttachmentUploadTool.handler({
      reqContext,
      args: { upload_token: uploadToken },
    });

    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const [payload] = uploadAttachment.mock.calls[0];
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe('bill.pdf');
    expect(payload.file.type).toBe('application/pdf');
    expect(finishResult.structuredContent).toEqual({
      ok: true,
      file_id: 'file-1',
      filename: 'bill.pdf',
      byte_length: billBytes.byteLength,
      content_base64_length: contentBase64.length,
      completion_status: 'uploaded',
      next_action:
        'Pass structuredContent.file_id in attachment_file_ids when calling create_bill or update_bill, then read the bill back if attachment confirmation matters.',
    });
  });

  it('uploads an order attachment from chunked base64 content through the shared helper', async () => {
    const orderBytes = Buffer.from('order pdf bytes sent in one reliable chunk');
    const contentBase64 = orderBytes.toString('base64');
    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'order-file-1',
      filename: 'order.pdf',
    });
    const reqContext = {
      client: {
        public: {
          orders: { uploadAttachment },
        },
      } as any,
      auth: oauthContext(),
      mcpSessionId: 'session-order-upload',
      toolProfile: 'full' as const,
    };

    expect(crmUploadOrderAttachmentTool.tool.description).toContain('start_order_attachment_upload');
    expect(crmStartOrderAttachmentUploadTool.tool.description).toContain('upload_order_attachment');
    expect((crmAppendOrderAttachmentUploadChunkTool.tool.inputSchema as any).required).toEqual([
      'content_base64',
    ]);
    expect((crmAppendOrderAttachmentUploadChunkTool.tool.inputSchema as any).anyOf).toEqual([
      { required: ['upload_token'] },
      { required: ['token'] },
    ]);
    expect((crmFinishOrderAttachmentUploadTool.tool.inputSchema as any).required ?? []).toEqual([]);
    expect((crmFinishOrderAttachmentUploadTool.tool.inputSchema as any).anyOf).toEqual([
      { required: ['upload_token'] },
      { required: ['token'] },
    ]);

    const startResult = await crmStartOrderAttachmentUploadTool.handler({
      reqContext,
      args: {
        filename: 'order.pdf',
        mime_type: 'application/pdf',
        content_base64_length: contentBase64.length,
        byte_length: orderBytes.byteLength,
      },
    });
    const uploadToken = startResult.structuredContent?.['upload_token'] as string;
    expect(startResult.structuredContent).toMatchObject({
      recommended_upload_strategy: 'single_append_then_finish',
      completion_status: 'requires_chunks',
      required_next_tool: 'append_order_attachment_upload_chunk',
    });

    const appendResult = await crmAppendOrderAttachmentUploadChunkTool.handler({
      reqContext,
      args: {
        upload_token: uploadToken,
        offset: 0,
        content_base64: contentBase64,
      },
    });
    expect(appendResult.structuredContent).toMatchObject({
      content_base64_offset: 0,
      content_base64_length: contentBase64.length,
      done: true,
      required_next_tool: 'finish_order_attachment_upload',
    });

    const finishResult = await crmFinishOrderAttachmentUploadTool.handler({
      reqContext,
      args: { upload_token: uploadToken },
    });

    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const [payload] = uploadAttachment.mock.calls[0];
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe('order.pdf');
    expect(payload.file.type).toBe('application/pdf');
    expect(Buffer.from(await payload.file.arrayBuffer())).toEqual(orderBytes);
    expect(finishResult.structuredContent).toMatchObject({
      ok: true,
      file_id: 'order-file-1',
      filename: 'order.pdf',
      byte_length: orderBytes.byteLength,
      content_base64_length: contentBase64.length,
      completion_status: 'uploaded',
      next_action:
        'Pass structuredContent.file_id in attachment_file_ids when calling create_order or update_order, then read the order back if attachment confirmation matters.',
    });
  });

  it('uploads an expense attachment from base64 content', async () => {
    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'file-1',
      filename: 'receipt.pdf',
    });

    const result = await crmUploadExpenseAttachmentTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { uploadAttachment },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filename: 'receipt.pdf',
        mime_type: 'application/pdf',
        content_base64: Buffer.from('test receipt').toString('base64'),
      },
    });

    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const [payload] = uploadAttachment.mock.calls[0];
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe('receipt.pdf');
    expect(payload.file.type).toBe('application/pdf');
    expect(result.structuredContent).toEqual({
      ok: true,
      file_id: 'file-1',
      filename: 'receipt.pdf',
    });
  });

  it('surfaces chunked upload guidance on expense attachment and mutation tools', () => {
    const createDescription = crmCreateExpenseTool.tool.description ?? '';
    expect(createDescription).toContain('start_expense_attachment_upload');
    expect(createDescription).toContain('append_expense_attachment_upload_chunk');
    expect(createDescription).toContain('finish_expense_attachment_upload');
    expect(createDescription).toContain('Attachments are optional');
    expect(createDescription).toContain('Do not silently drop a provided or required attachment');

    const updateDescription = crmUpdateExpenseTool.tool.description ?? '';
    expect(updateDescription).toContain('start_expense_attachment_upload');
    expect(updateDescription).toContain('attachment_file_ids');

    const directUploadDescription = crmUploadExpenseAttachmentTool.tool.description ?? '';
    expect(directUploadDescription).toContain('already available base64');
    expect(directUploadDescription).toContain('Prefer this direct upload for ordinary receipt/invoice PDFs');
    expect(directUploadDescription).toContain('use start_expense_attachment_upload');

    const createInputSchema = crmCreateExpenseTool.tool.inputSchema as any;
    expect(createInputSchema.properties.attachment_file_ids.description).toContain(
      'append_expense_attachment_upload_chunk until done',
    );
    expect(createInputSchema.properties.base_currency).toMatchObject({
      type: 'number',
      minimum: 0,
    });
    expect(createInputSchema.properties.base_currency.description).toContain(
      'overrides automatic currency conversion',
    );

    const updateInputSchema = crmUpdateExpenseTool.tool.inputSchema as any;
    expect(updateInputSchema.properties.base_currency).toMatchObject({
      type: 'number',
      minimum: 0,
    });
    expect(updateDescription).toContain('base_currency');

    const startOutputSchema = crmStartExpenseAttachmentUploadTool.tool.outputSchema as any;
    expect(startOutputSchema.required).toContain('recommended_upload_strategy');
    expect(startOutputSchema.properties.recommended_upload_strategy.enum).toEqual([
      'single_append_then_finish',
      'append_chunks_then_finish',
    ]);

    expect(crmStartExpenseAttachmentUploadTool.tool.description).toContain('Do not abandon the attachment');
    expect(crmAppendExpenseAttachmentUploadChunkTool.tool.description).toContain(
      'Continue appending until the result returns done=true',
    );
  });

  it('uploads an expense attachment from chunked base64 content', async () => {
    const receiptBytes = Buffer.from('receipt pdf bytes that are sent in chunks');
    const contentBase64 = receiptBytes.toString('base64');
    const firstChunk = contentBase64.slice(0, 16);
    const secondChunk = contentBase64.slice(16);
    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'file-1',
      filename: 'receipt.pdf',
    });
    const reqContext = {
      client: {
        public: {
          expenses: { uploadAttachment },
        },
      } as any,
      auth: oauthContext(),
      mcpSessionId: 'session-1',
      toolProfile: 'full' as const,
    };

    const startResult = await crmStartExpenseAttachmentUploadTool.handler({
      reqContext,
      args: {
        filename: 'receipt.pdf',
        mime_type: 'application/pdf',
        content_base64_length: contentBase64.length,
        byte_length: receiptBytes.byteLength,
      },
    });
    const uploadToken = startResult.structuredContent?.['upload_token'] as string;
    expect(uploadToken).toBeTruthy();
    expect(startResult.structuredContent).toMatchObject({
      chunk_size: BINARY_UPLOAD_CHUNK_BASE64_LENGTH,
      recommended_chunk_count: 1,
      recommended_upload_strategy: 'single_append_then_finish',
      next_action: expect.stringContaining(`around ${BINARY_UPLOAD_CHUNK_BASE64_LENGTH}`),
    });
    expect(startResult.structuredContent?.['next_action']).toEqual(
      expect.stringContaining('until append returns done=true'),
    );
    expect(startResult.structuredContent?.['next_action']).toEqual(
      expect.stringContaining('using max-size chunks this should take 1 append call(s)'),
    );
    expect(startResult.structuredContent?.['next_action']).toEqual(
      expect.stringContaining('do not drop it and call create_expense or update_expense without its file_id'),
    );
    expect((crmAppendExpenseAttachmentUploadChunkTool.tool.inputSchema as any).required).toEqual([
      'content_base64',
    ]);
    expect((crmAppendExpenseAttachmentUploadChunkTool.tool.inputSchema as any).anyOf).toEqual([
      { required: ['upload_token'] },
      { required: ['token'] },
    ]);
    expect((crmFinishExpenseAttachmentUploadTool.tool.inputSchema as any).required ?? []).toEqual([]);
    expect((crmFinishExpenseAttachmentUploadTool.tool.inputSchema as any).anyOf).toEqual([
      { required: ['upload_token'] },
      { required: ['token'] },
    ]);
    expect(startResult.structuredContent).toMatchObject({
      completion_status: 'requires_chunks',
      required_next_tool: 'append_expense_attachment_upload_chunk',
    });

    const firstAppend = await crmAppendExpenseAttachmentUploadChunkTool.handler({
      reqContext,
      args: {
        upload_token: uploadToken,
        offset: 0,
        content_base64: firstChunk,
      },
    });
    expect(firstAppend.structuredContent).toMatchObject({
      content_base64_offset: 0,
      content_base64_length: firstChunk.length,
      next_offset: firstChunk.length,
      done: false,
      recommended_chunk_count: 1,
      required_next_tool: 'append_expense_attachment_upload_chunk',
    });
    expect(firstAppend.structuredContent?.['next_action']).toEqual(
      expect.stringContaining('Do not drop this in-progress user-provided or required attachment'),
    );

    const secondAppend = await crmAppendExpenseAttachmentUploadChunkTool.handler({
      reqContext,
      args: {
        token: uploadToken,
        offset: firstChunk.length,
        content_base64: secondChunk,
      },
    });
    expect(secondAppend.structuredContent).toMatchObject({
      content_base64_offset: firstChunk.length,
      content_base64_length: contentBase64.length,
      next_offset: contentBase64.length,
      done: true,
      recommended_chunk_count: 1,
      required_next_tool: 'finish_expense_attachment_upload',
    });

    const finishResult = await crmFinishExpenseAttachmentUploadTool.handler({
      reqContext,
      args: { token: uploadToken },
    });

    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const [payload] = uploadAttachment.mock.calls[0];
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe('receipt.pdf');
    expect(payload.file.type).toBe('application/pdf');
    expect(Buffer.from(await payload.file.arrayBuffer())).toEqual(receiptBytes);
    expect(finishResult.structuredContent).toMatchObject({
      ok: true,
      file_id: 'file-1',
      filename: 'receipt.pdf',
      byte_length: receiptBytes.byteLength,
      content_base64_length: contentBase64.length,
      completion_status: 'uploaded',
    });
  });

  it('uploads a normal receipt-sized PDF in one append', async () => {
    const receiptBytes = Buffer.alloc(81_042, 9);
    const contentBase64 = receiptBytes.toString('base64');
    expect(contentBase64).toHaveLength(108_056);

    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'file-waw-receipt',
      filename: '20260620_株式会社サンカ_WAW+日本橋_24200.pdf',
    });
    const reqContext = {
      client: {
        public: {
          expenses: { uploadAttachment },
        },
      } as any,
      auth: oauthContext(),
      mcpSessionId: 'session-receipt-sized-upload',
      toolProfile: 'full' as const,
    };

    const startResult = await crmStartExpenseAttachmentUploadTool.handler({
      reqContext,
      args: {
        filename: '20260620_株式会社サンカ_WAW+日本橋_24200.pdf',
        mime_type: 'application/pdf',
        content_base64_length: contentBase64.length,
        byte_length: receiptBytes.byteLength,
      },
    });

    expect(startResult.structuredContent).toMatchObject({
      chunk_size: BINARY_UPLOAD_CHUNK_BASE64_LENGTH,
      recommended_chunk_count: 1,
      recommended_upload_strategy: 'single_append_then_finish',
      next_offset: 0,
      completion_status: 'requires_chunks',
      required_next_tool: 'append_expense_attachment_upload_chunk',
    });
    expect(startResult.structuredContent?.['next_action']).toEqual(
      expect.stringContaining('ordinary receipt/invoice PDFs'),
    );
    expect(startResult.structuredContent?.['next_action']).toEqual(
      expect.stringContaining('one reliable append call'),
    );

    const uploadToken = startResult.structuredContent?.['upload_token'] as string;
    const appendResult = await crmAppendExpenseAttachmentUploadChunkTool.handler({
      reqContext,
      args: {
        upload_token: uploadToken,
        offset: 0,
        content_base64: contentBase64,
      },
    });
    expect(appendResult.structuredContent).toMatchObject({
      content_base64_offset: 0,
      content_base64_length: contentBase64.length,
      done: true,
      required_next_tool: 'finish_expense_attachment_upload',
    });

    const finishResult = await crmFinishExpenseAttachmentUploadTool.handler({
      reqContext,
      args: { upload_token: uploadToken },
    });
    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const [payload] = uploadAttachment.mock.calls[0];
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe('20260620_株式会社サンカ_WAW+日本橋_24200.pdf');
    expect(payload.file.type).toBe('application/pdf');
    expect(Buffer.from(await payload.file.arrayBuffer())).toEqual(receiptBytes);
    expect(finishResult.structuredContent).toMatchObject({
      ok: true,
      file_id: 'file-waw-receipt',
      byte_length: receiptBytes.byteLength,
      content_base64_length: contentBase64.length,
      completion_status: 'uploaded',
    });
  });

  it('accepts a reliable receipt-sized append chunk larger than the recommended chunk size', async () => {
    const receiptBytes = Buffer.alloc(BINARY_UPLOAD_CHUNK_BASE64_LENGTH, 7);
    const contentBase64 = receiptBytes.toString('base64');
    expect(contentBase64.length).toBeGreaterThan(BINARY_UPLOAD_CHUNK_BASE64_LENGTH);
    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'file-large',
      filename: 'receipt-large.pdf',
    });
    const reqContext = {
      client: {
        public: {
          expenses: { uploadAttachment },
        },
      } as any,
      auth: oauthContext(),
      mcpSessionId: 'session-large-receipt-upload',
      toolProfile: 'full' as const,
    };

    const startResult = await crmStartExpenseAttachmentUploadTool.handler({
      reqContext,
      args: {
        filename: 'receipt-large.pdf',
        mime_type: 'application/pdf',
        content_base64_length: contentBase64.length,
        byte_length: receiptBytes.byteLength,
      },
    });
    const uploadToken = startResult.structuredContent?.['upload_token'] as string;

    const appendResult = await crmAppendExpenseAttachmentUploadChunkTool.handler({
      reqContext,
      args: {
        upload_token: uploadToken,
        offset: 0,
        content_base64: contentBase64,
      },
    });
    expect(appendResult.structuredContent).toMatchObject({
      content_base64_offset: 0,
      content_base64_length: contentBase64.length,
      done: true,
      required_next_tool: 'finish_expense_attachment_upload',
    });

    const finishResult = await crmFinishExpenseAttachmentUploadTool.handler({
      reqContext,
      args: { upload_token: uploadToken },
    });
    const [payload] = uploadAttachment.mock.calls[0];
    expect(Buffer.from(await payload.file.arrayBuffer())).toEqual(receiptBytes);
    expect(finishResult.structuredContent).toMatchObject({
      ok: true,
      file_id: 'file-large',
      byte_length: receiptBytes.byteLength,
      content_base64_length: contentBase64.length,
      completion_status: 'uploaded',
    });
  });

  it.each([
    [
      'order',
      crmUploadOrderAttachmentTool,
      (uploadAttachment: jest.Mock) => ({ orders: { uploadAttachment } }),
    ],
    [
      'purchase order',
      crmUploadPurchaseOrderAttachmentTool,
      (uploadAttachment: jest.Mock) => ({ purchaseOrders: { uploadAttachment } }),
    ],
    [
      'estimate',
      crmUploadEstimateAttachmentTool,
      (uploadAttachment: jest.Mock) => ({ estimates: { uploadAttachment } }),
    ],
    [
      'invoice',
      crmUploadInvoiceAttachmentTool,
      (uploadAttachment: jest.Mock) => ({ invoices: { uploadAttachment } }),
    ],
  ])('uploads a %s attachment from base64 content', async (_label, tool, publicClientFactory) => {
    const uploadAttachment = jest.fn().mockResolvedValue({
      ok: true,
      file_id: 'file-1',
      filename: 'document.pdf',
    });

    const result = await tool.handler({
      reqContext: {
        client: {
          public: publicClientFactory(uploadAttachment),
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filename: 'document.pdf',
        mime_type: 'application/pdf',
        content_base64: Buffer.from('test document').toString('base64'),
      },
    });

    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const [payload] = uploadAttachment.mock.calls[0];
    expect(payload.file).toBeInstanceOf(File);
    expect(payload.file.name).toBe('document.pdf');
    expect(payload.file.type).toBe('application/pdf');
    expect(result.structuredContent).toEqual({
      ok: true,
      file_id: 'file-1',
      filename: 'document.pdf',
    });
  });
});
