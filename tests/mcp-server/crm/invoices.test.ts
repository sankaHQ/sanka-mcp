import {
  crmActivateInvoiceTool,
  crmCreateInvoiceTool,
  crmDeleteInvoiceTool,
  crmDownloadInvoicePDFTool,
  crmGetInvoiceTool,
  crmListInvoiceLineItemsTool,
  crmListInvoicesTool,
  crmListOverdueInvoicesTool,
  crmPermanentDeleteInvoiceTool,
  crmReadBinaryDownloadChunkTool,
  crmSendInvoiceEmailTool,
  crmUpdateInvoiceTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { resetBinaryDownloadStoreForTests } from '../../../packages/mcp-server/src/binary-download-store';
import { resetBinaryUploadStoreForTests } from '../../../packages/mcp-server/src/binary-upload-store';
import { describeV2Requests, firstTextContent, oauthContext, type V2RequestCase } from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'creates an invoice',
    tool: crmCreateInvoiceTool,
    args: {
      company_id: 'company-1',
      total_price: 120,
      currency: 'USD',
      attachment_file_ids: ['file-1'],
      custom_fields: { owner_email: 'owner@example.com' },
      line_items: [{ item_name: 'Implementation', quantity: 1, unit_price: 120, tax_rate: 10 }],
      send_from: 'Sanka Billing\n100 Market St',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/invoices',
        body: {
          properties: {
            attachment_file: { files: [{ file_id: 'file-1' }] },
            company_id: 'company-1',
            currency: 'USD',
            custom_fields: { owner_email: 'owner@example.com' },
            send_from: 'Sanka Billing\n100 Market St',
            total_price: 120,
          },
          line_items: [{ item_name: 'Implementation', quantity: 1, unit_price: 120, tax_rate: 10 }],
        },
      },
    ],
  },
  {
    name: 'updates an invoice',
    tool: crmUpdateInvoiceTool,
    args: {
      invoice_id: 'invoice-1',
      custom_fields: { owner_email: 'updated@example.com' },
      due_date: '2026-06-30',
      line_items: [{ item_name: 'Retainer', quantity: 1, unit_price: 200, tax_rate: 10 }],
      notes: 'Updated invoice notes',
      send_from: 'Updated Sanka Billing\n100 Market St',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/invoices/invoice-1',
        body: {
          properties: {
            custom_fields: { owner_email: 'updated@example.com' },
            due_date: '2026-06-30',
            notes: 'Updated invoice notes',
            send_from: 'Updated Sanka Billing\n100 Market St',
          },
          line_items: [{ item_name: 'Retainer', quantity: 1, unit_price: 200, tax_rate: 10 }],
        },
      },
    ],
  },
];

describe('CRM invoice tools', () => {
  beforeEach(() => {
    resetBinaryDownloadStoreForTests();
    resetBinaryUploadStoreForTests();
  });

  it('lists invoices with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id_inv: 1,
        company_name: 'Acme',
        total_price: 100,
        app_url: 'https://app.sanka.com/ja/99112888/invoices/?id=invoice-1',
      },
      { id_inv: 2, company_name: 'Globex', total_price: 200 },
      { id_inv: 3, company_name: 'Initech', total_price: 300 },
    ]);

    const result = await crmListInvoicesTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, workspace_id: 'workspace-1', language: 'en' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 invoices.',
      permission: undefined,
      results: [
        {
          id_inv: 1,
          company_name: 'Acme',
          total_price: 100,
          app_url: 'https://app.sanka.com/ja/99112888/invoices/?id=invoice-1',
        },
        { id_inv: 2, company_name: 'Globex', total_price: 200 },
      ],
    });
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    expect(text).toContain('Found 3 invoices. Examples: Invoice No. 1, Invoice No. 2.');
    expect(text).toContain('invoices model context:');
    expect(text).toContain('"company_name": "Acme"');
  });

  it('lists overdue invoices with a local result limit', async () => {
    const listOverdue = jest.fn().mockResolvedValue([
      { id_inv: 1, company_name: 'Acme', outstanding_balance: 100, days_overdue: 7 },
      { id_inv: 2, company_name: 'Globex', outstanding_balance: 80, days_overdue: 3 },
      { id_inv: 3, company_name: 'Initech', outstanding_balance: 50, days_overdue: 1 },
    ]);

    const result = await crmListOverdueInvoicesTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { listOverdue },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, workspace_id: 'workspace-1', as_of_date: '2026-04-10', language: 'en' },
    });

    expect(listOverdue).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
        as_of_date: '2026-04-10',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 overdue invoices.',
      permission: undefined,
      results: [
        { id_inv: 1, company_name: 'Acme', outstanding_balance: 100, days_overdue: 7 },
        { id_inv: 2, company_name: 'Globex', outstanding_balance: 80, days_overdue: 3 },
      ],
    });
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    expect(text).toContain('Found 3 overdue invoices. Examples: Invoice No. 1, Invoice No. 2.');
    expect(text).toContain('overdue invoices model context:');
    expect(text).toContain('"outstanding_balance": 100');
  });

  it('gets one invoice when authentication is present', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      id: 'invoice-1',
      id_inv: 1,
      app_url: 'https://app.sanka.com/ja/99112888/invoices/?id=invoice-1',
      workspace_code: '99112888',
      company_name: 'Acme',
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
    const listLineItems = jest.fn().mockResolvedValue([
      {
        line_item_id: 'line-item-1',
        item_name: 'Implementation',
        quantity: 1,
        unit_price: 120,
        custom_fields: {
          'property-1': { value: '2', value_number_format: 'number' },
        },
      },
    ]);

    const result = await crmGetInvoiceTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { listLineItems, retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { invoice_id: 'invoice-1', external_id: 'INV-1', language: 'ja' },
    });

    expect(retrieve).toHaveBeenCalledWith(
      'invoice-1',
      {
        external_id: 'INV-1',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(listLineItems).toHaveBeenCalledWith('invoice-1', undefined);
    expect(result.structuredContent).toEqual({
      id: 'invoice-1',
      id_inv: 1,
      app_url: 'https://app.sanka.com/ja/99112888/invoices/?id=invoice-1',
      workspace_code: '99112888',
      company_name: 'Acme',
      line_items: [
        {
          line_item_id: 'line-item-1',
          item_name: 'Implementation',
          quantity: 1,
          unit_price: 120,
          custom_fields: {
            'property-1': { value: '2', value_number_format: 'number' },
          },
        },
      ],
      created_at: '2026-04-08T00:00:00Z',
      updated_at: '2026-04-09T00:00:00Z',
    });
    const firstContent = result.content?.[0];
    expect(firstContent?.type).toBe('text');
    if (firstContent?.type === 'text') {
      expect(firstContent.text).toContain('Loaded invoice successfully: Invoice No. 1.');
      expect(firstContent.text).toContain('app_url');
    }
  });

  it('lists invoice line items with custom property values', async () => {
    const listLineItems = jest.fn().mockResolvedValue([
      {
        line_item_id: 'line-item-1',
        item_name: 'Implementation',
        quantity: 1,
        custom_fields: {
          'property-1': { value: '2', value_number_format: 'number' },
        },
      },
    ]);

    const result = await crmListInvoiceLineItemsTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { listLineItems },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { invoice_id: 'invoice-1' },
    });

    expect(listLineItems).toHaveBeenCalledWith('invoice-1', undefined);
    expect(result.structuredContent).toEqual({
      invoice_id: 'invoice-1',
      count: 1,
      line_items: [
        {
          line_item_id: 'line-item-1',
          item_name: 'Implementation',
          quantity: 1,
          custom_fields: {
            'property-1': { value: '2', value_number_format: 'number' },
          },
        },
      ],
    });
    expect(firstTextContent(result)).toContain('Returned 1 line item for invoice invoice-1.');
  });

  it('downloads invoice PDFs with structured base64 content', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4\ninvoice');
    const contentDisposition = `attachment; filename="invoice-fallback.pdf"; filename*=UTF-8''invoice%205.pdf`;
    const downloadPDF = jest.fn().mockResolvedValue(
      new Response(pdfBytes, {
        headers: {
          'content-disposition': contentDisposition,
          'content-type': 'application/pdf',
        },
      }),
    );

    const result = await crmDownloadInvoicePDFTool.handler({
      reqContext: {
        client: { public: { invoices: { downloadPDF } } } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        external_id: 'INV-1',
        template_select: 'modern',
        language: 'ja',
      },
    });

    const contentBase64 = pdfBytes.toString('base64');
    expect(downloadPDF).toHaveBeenCalledWith(
      'invoice-1',
      {
        external_id: 'INV-1',
        template_select: 'modern',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      content_disposition: contentDisposition,
      mime_type: 'application/pdf',
      filename: 'invoice 5.pdf',
      byte_length: pdfBytes.length,
      completion_status: 'inline_content',
      download_complete: true,
      file_assembly_required: false,
      content_base64_available: true,
      content_base64: contentBase64,
      resource_uri: 'resource://tool-response',
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: `Downloaded invoice 5.pdf (${pdfBytes.length} bytes). Decode structuredContent.content_base64 to save the PDF locally.`,
      },
    ]);
    expect(Buffer.from(result.structuredContent?.['content_base64'] as string, 'base64')).toEqual(pdfBytes);
  });

  it('keeps large invoice PDF downloads below Codex output truncation limits and serves chunks', async () => {
    const pdfBytes = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(104732 - 9, 65)]);
    const contentBase64 = pdfBytes.toString('base64');
    const downloadPDF = jest.fn().mockResolvedValue(
      new Response(pdfBytes, {
        headers: {
          'content-disposition': 'attachment; filename="invoice-7.pdf"',
          'content-type': 'application/pdf',
        },
      }),
    );
    const reqContext = {
      client: { public: { invoices: { downloadPDF } } } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
      mcpSessionId: 'session-large-pdf',
      downloadBaseUrl: 'https://mcp.example.test',
    };

    const result = await crmDownloadInvoicePDFTool.handler({
      reqContext,
      args: {
        invoice_id: 'invoice-7',
        language: 'ja',
      },
    });

    expect(downloadPDF).toHaveBeenCalledWith('invoice-7', { 'Accept-Language': 'ja' }, undefined);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured).toMatchObject({
      mime_type: 'application/pdf',
      filename: 'invoice-7.pdf',
      byte_length: pdfBytes.length,
      completion_status: 'download_url_ready',
      download_complete: false,
      file_assembly_required: false,
      content_base64_available: false,
      content_base64_length: contentBase64.length,
      download_transfer_mode: 'url',
      fallback_next_tool: 'read_binary_download_chunk',
      chunk_size: 24000,
      total_chunks: Math.ceil(contentBase64.length / 24000),
      next_offset: 0,
    });
    expect(typeof structured['next_action']).toBe('string');
    expect(structured['next_action']).toContain('attach or save');
    expect(structured).not.toHaveProperty('content_base64');
    expect(typeof structured['download_token']).toBe('string');
    expect(structured['download_url']).toBe(
      `https://mcp.example.test/downloads/${structured['download_token']}`,
    );
    expect(structured['download_url_expires_at']).toBe(structured['expires_at']);
    expect(structured).not.toHaveProperty('required_next_tool');
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Download it from download_url with the current MCP session'),
    });
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('before telling the user the PDF download is complete'),
    });
    expect(JSON.stringify(structured).length).toBeLessThan(48000);

    const downloadToken = structured['download_token'] as string;
    let offset = structured['next_offset'] as number;
    let stitchedBase64 = '';
    let done = false;

    for (let i = 0; i < 20 && !done; i += 1) {
      const chunkResult = await crmReadBinaryDownloadChunkTool.handler({
        reqContext,
        args: { download_token: downloadToken, offset },
      });
      const chunk = chunkResult.structuredContent as Record<string, unknown>;
      expect(JSON.stringify(chunk).length).toBeLessThan(48000);
      expect(chunk['content_base64_offset']).toBe(offset);
      expect(chunk['file_assembly_required']).toBe(true);
      expect(typeof chunk['next_action']).toBe('string');
      stitchedBase64 += chunk['content_base64'] as string;
      offset = chunk['next_offset'] as number;
      done = chunk['done'] as boolean;
      expect(chunk['completion_status']).toBe(done ? 'chunks_read' : 'requires_next_chunk');
      if (done) {
        expect(chunk).not.toHaveProperty('required_next_tool');
        expect(chunk['next_action']).toContain('attach or save');
      } else {
        expect(chunk['required_next_tool']).toBe('read_binary_download_chunk');
      }
    }

    expect(done).toBe(true);
    expect(stitchedBase64).toBe(contentBase64);
    expect(Buffer.from(stitchedBase64, 'base64')).toEqual(pdfBytes);
  });

  it('sends or schedules invoice emails through the public invoice email endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      ok: true,
      status: 'scheduled',
      invoice_id: 'invoice-1',
      id_inv: 1233,
      message_thread_ids: ['message-thread-1'],
      scheduled_at: '2026-05-21T09:00:00+09:00',
    });

    const result = await crmSendInvoiceEmailTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        action: 'schedule',
        to: ['finance@example.com'],
        cc: ['ops@example.com'],
        subject: 'May invoice',
        body: 'Please see attached.',
        scheduled_at: '2026-05-21T09:00:00+09:00',
        template_select: 'template-1',
        language: 'ja',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/invoices/invoice-1/email', {
      body: {
        action: 'schedule',
        to: ['finance@example.com'],
        cc: ['ops@example.com'],
        subject: 'May invoice',
        body: 'Please see attached.',
        scheduled_at: '2026-05-21T09:00:00+09:00',
        template_select: 'template-1',
      },
      query: {
        language: 'ja',
      },
    });
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'scheduled',
      invoice_id: 'invoice-1',
      id_inv: 1233,
      message_thread_ids: ['message-thread-1'],
      scheduled_at: '2026-05-21T09:00:00+09:00',
    });
    expect((result.content[0] as any).text).toContain('Scheduled Invoice No. 1233 email');
  });

  it('creates draft invoice emails with explicit extra PDF attachments', async () => {
    const post = jest.fn().mockResolvedValue({
      ok: true,
      status: 'draft',
      invoice_id: 'invoice-1',
      formatted_invoice_id: 1233,
      message_thread_ids: ['message-thread-1'],
      attachment_count: 3,
    });

    const result = await crmSendInvoiceEmailTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        action: 'draft',
        to: ['finance@example.com'],
        subject: 'June invoices',
        additional_pdf_attachments: [
          {
            record_id: 'invoice-2',
            template_select: 'default',
            filename: '請求書-1262.pdf',
          },
          {
            template_select: 'delivery-note',
            filename: '納品書-1261.pdf',
          },
        ],
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/invoices/invoice-1/email', {
      body: {
        action: 'draft',
        to: ['finance@example.com'],
        subject: 'June invoices',
        additional_pdf_attachments: [
          {
            object_type: 'invoices',
            record_id: 'invoice-2',
            template_select: 'default',
            filename: '請求書-1262.pdf',
          },
          {
            object_type: 'invoices',
            record_id: 'invoice-1',
            template_select: 'delivery-note',
            filename: '納品書-1261.pdf',
          },
        ],
      },
      query: {
        language: 'ja',
      },
    });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      status: 'draft',
      attachment_count: 3,
    });
    expect((result.content[0] as any).text).toContain('Created draft Invoice No. 1233 email');
  });

  it('replaces generated PDF attachments on an existing invoice email draft in place', async () => {
    const post = jest.fn().mockResolvedValue({
      ok: true,
      status: 'draft',
      invoice_id: 'invoice-1',
      id_inv: 1233,
      thread_id: 'thread-existing',
      message_id: 'message-existing',
      to: ['finance@example.com'],
      cc: [],
      attachment_count: 1,
      message: 'Invoice email draft attachments replaced.',
    });

    const result = await crmSendInvoiceEmailTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        action: 'draft',
        replace_draft_message_id: 'message-existing',
        language: 'ja',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/invoices/invoice-1/email', {
      body: {
        action: 'draft',
        replace_draft_message_id: 'message-existing',
      },
      query: {
        language: 'ja',
      },
    });
    expect(result.structuredContent).toMatchObject({
      status: 'draft',
      thread_id: 'thread-existing',
      message_id: 'message-existing',
      attachment_count: 1,
    });
    expect((result.content[0] as any).text).toContain(
      'Replaced generated PDF attachments on draft Invoice No. 1233 message message-existing in thread thread-existing.',
    );
  });

  it('sends an existing invoice draft through its saved sender and thread', async () => {
    const post = jest.fn().mockResolvedValue({
      ok: true,
      action: 'send',
      status: 'sent',
      invoice_id: 'invoice-1',
      formatted_invoice_id: 1310,
      thread_id: 'thread-existing',
      message_id: 'message-existing',
      channel_id: 'channel-gmail',
      from_email: 'hey@sanka.com',
      reply_to_email: 'hey@sanka.com',
      provider: 'gmail',
      provider_message_id: 'gmail-message-1',
      history_locations: ['sanka', 'gmail_sent'],
      attachment_count: 1,
    });

    const result = await crmSendInvoiceEmailTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        action: 'send',
        send_draft_message_id: 'message-existing',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/invoices/invoice-1/email', {
      body: {
        action: 'send',
        send_draft_message_id: 'message-existing',
      },
      query: {
        language: 'ja',
      },
    });
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        thread_id: 'thread-existing',
        message_id: 'message-existing',
        from_email: 'hey@sanka.com',
        reply_to_email: 'hey@sanka.com',
        provider: 'gmail',
      }),
    );
    expect((result.content[0] as any).text).toBe(
      'Sent Invoice No. 1310 email from hey@sanka.com via gmail. Reply-To: hey@sanka.com. History: Sanka, Gmail Sent. Thread: thread-existing.',
    );
  });

  it('schedules an existing invoice draft in place through its saved channel', async () => {
    expect(
      (crmSendInvoiceEmailTool.tool.inputSchema as any).properties.schedule_draft_message_id,
    ).toMatchObject({
      type: 'string',
    });
    const post = jest.fn().mockResolvedValue({
      ok: true,
      action: 'schedule',
      status: 'scheduled',
      invoice_id: 'invoice-1',
      formatted_invoice_id: 1310,
      thread_id: 'thread-existing',
      message_id: 'message-existing',
      channel_id: 'channel-gmail',
      scheduled_at: '2026-08-03T08:00:00+09:00',
      to: ['finance@example.com'],
      cc: [],
      attachment_count: 1,
      attachments: [
        {
          object_type: 'invoice',
          record_id: 'invoice-1',
          filename: '請求書-1310.pdf',
        },
      ],
    });

    const result = await crmSendInvoiceEmailTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        action: 'schedule',
        scheduled_at: '2026-08-03T08:00:00+09:00',
        schedule_draft_message_id: 'message-existing',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/invoices/invoice-1/email', {
      body: {
        action: 'schedule',
        scheduled_at: '2026-08-03T08:00:00+09:00',
        schedule_draft_message_id: 'message-existing',
      },
      query: {
        language: 'ja',
      },
    });
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        thread_id: 'thread-existing',
        message_id: 'message-existing',
        channel_id: 'channel-gmail',
        attachment_count: 1,
      }),
    );
    expect((result.content[0] as any).text).toBe(
      'Scheduled Invoice No. 1310 email for 2026-08-03T08:00:00+09:00. Message threads: 1.',
    );
  });

  it('reports the managed invoice sender and reply route when no channel is saved', async () => {
    const post = jest.fn().mockResolvedValue({
      ok: true,
      action: 'send',
      status: 'sent',
      invoice_id: 'invoice-1',
      formatted_invoice_id: 1311,
      thread_id: 'thread-managed',
      message_id: 'message-managed',
      channel_id: null,
      from_email: 'invoices@sanka.com',
      reply_to_email: 'hey@sanka.com',
      provider: 'sendgrid',
      provider_message_id: 'sendgrid-message-1',
      history_locations: ['sanka'],
      attachment_count: 1,
    });

    const result = await crmSendInvoiceEmailTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        action: 'send',
        send_draft_message_id: 'message-managed',
      },
    });

    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        from_email: 'invoices@sanka.com',
        reply_to_email: 'hey@sanka.com',
        provider: 'sendgrid',
      }),
    );
    expect((result.content[0] as any).text).toBe(
      'Sent Invoice No. 1311 email from invoices@sanka.com via sendgrid. Reply-To: hey@sanka.com. History: Sanka. Thread: thread-managed.',
    );
  });

  it('activates an invoice with read-after-write verification', async () => {
    const v2Post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'invoice-1',
        record_id: '7003',
        object_type: 'invoice',
        status: 'active',
        usage_status: 'active',
        updated_count: 1,
        meta: { operation: 'activate' },
      },
      meta: { ctx_id: 'ctx-test' },
    });
    const retrieve = jest.fn().mockResolvedValue({
      id: 'invoice-1',
      usage_status: 'active',
    });

    const result = await crmActivateInvoiceTool.handler({
      reqContext: {
        client: {
          v2Post,
          public: {
            invoices: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        external_id: 'INV-1',
      },
    });

    expect(v2Post).toHaveBeenCalledWith('/invoices/invoice-1/activate', {
      query: { external_id: 'INV-1' },
    });
    expect(retrieve).toHaveBeenCalledWith(
      'invoice-1',
      {
        external_id: 'INV-1',
      },
      undefined,
    );
    expect(result.structuredContent).toMatchObject({
      ok: true,
      operation: 'activate',
      status: 'active',
      usage_status: 'active',
      invoice_id: 'invoice-1',
      ctx_id: 'ctx-test',
      verification: {
        entity: 'invoice',
        expected_status: 'active',
        actual_status: 'active',
        matched: true,
      },
    });
  });

  it('archives an invoice with read-after-write verification', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      operation: 'archive',
      status: 'archived',
      usage_status: 'archived',
      permanently_deleted: false,
      invoice_id: 'invoice-1',
    });
    const retrieve = jest.fn().mockResolvedValue({
      id: 'invoice-1',
      status: '下書き',
      status_key: 'draft',
      usage_status: 'archived',
    });

    const result = await crmDeleteInvoiceTool.handler({
      reqContext: {
        client: {
          public: {
            invoices: { delete: del, retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        external_id: 'INV-1',
      },
    });

    expect(del).toHaveBeenCalledWith(
      'invoice-1',
      {
        external_id: 'INV-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      ok: true,
      operation: 'archive',
      status: 'archived',
      usage_status: 'archived',
      permanently_deleted: false,
      invoice_id: 'invoice-1',
      verification: {
        entity: 'invoice',
        expected_status: 'archived',
        actual_status: 'archived',
        matched: true,
        record_id: 'invoice-1',
      },
    });
  });

  it('permanently deletes an archived invoice only with explicit confirmation', async () => {
    const del = jest.fn().mockResolvedValue({
      ok: true,
      operation: 'permanent_delete',
      status: 'deleted',
      permanently_deleted: true,
      invoice_id: 'invoice-1',
    });
    const retrieve = jest.fn().mockRejectedValue(new Error('Not found'));

    const result = await crmPermanentDeleteInvoiceTool.handler({
      reqContext: {
        client: {
          delete: del,
          public: {
            invoices: { retrieve },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
        external_id: 'INV-1',
        confirm: true,
      },
    });

    expect(del).toHaveBeenCalledWith('/api/v2/public/invoices/invoice-1/permanent-delete', {
      query: { external_id: 'INV-1', confirm: true },
    });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      operation: 'permanent_delete',
      status: 'deleted',
      permanently_deleted: true,
      invoice_id: 'invoice-1',
      verification: {
        entity: 'invoice',
        expected_status: 'deleted',
        actual_status: 'not_found',
        matched: true,
      },
    });

    const blocked = await crmPermanentDeleteInvoiceTool.handler({
      reqContext: {
        client: {
          delete: jest.fn(),
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        invoice_id: 'invoice-1',
      },
    });
    expect(blocked.isError).toBe(true);
  });

  describeV2Requests(v2Requests);
});
