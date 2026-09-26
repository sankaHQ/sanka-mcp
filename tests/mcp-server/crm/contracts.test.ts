import { File } from 'node:buffer';
import {
  crmCreateContractFromTemplateTool,
  crmDownloadContractTemplateTool,
  crmGetContractWorkflowStateTool,
  crmListContractTemplatesTool,
  crmReplaceContractPDFTool,
  crmSaveContractPlaceFieldsTool,
  crmSaveContractRecipientsTool,
  crmSaveContractSignersTool,
  crmScheduleContractRequestTool,
  crmSendContractRequestTool,
  crmUpdateContractMetadataTool,
  crmUploadContractPDFTool,
  crmUploadContractTemplateTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { resetBinaryDownloadStoreForTests } from '../../../packages/mcp-server/src/binary-download-store';
import { resetBinaryUploadStoreForTests } from '../../../packages/mcp-server/src/binary-upload-store';
import { describeV2Requests, firstTextContent, oauthContext, type V2RequestCase } from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'creates a contract from a template',
    tool: crmCreateContractFromTemplateTool,
    args: { template_id: 'template-1', title: 'NDA', workspace_id: 'workspace-1', language: 'ja' },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/contracts/create-from-template?workspace_id=workspace-1&language=ja',
        body: { template_id: 'template-1', title: 'NDA' },
      },
    ],
  },
  {
    name: 'updates contract metadata',
    tool: crmUpdateContractMetadataTool,
    args: { contract_id: 'contract-1', name: 'Updated NDA', workspace_id: 'workspace-1' },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/contracts/contract-1/metadata?workspace_id=workspace-1',
        body: { name: 'Updated NDA' },
      },
    ],
  },
  {
    name: 'saves contract signers',
    tool: crmSaveContractSignersTool,
    args: {
      contract_id: 'contract-1',
      signers: [{ name: 'Signer One', email: 'signer@example.com' }],
      workspace_id: 'workspace-1',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/contracts/contract-1/signers?workspace_id=workspace-1',
        body: { signers: [{ name: 'Signer One', email: 'signer@example.com' }] },
      },
    ],
  },
  {
    name: 'saves contract signature field placements',
    tool: crmSaveContractPlaceFieldsTool,
    args: {
      contract_id: 'contract-1',
      fields: [
        {
          signer_id: 'signer-1',
          page: 1,
          left: 120,
          top: 640,
          width: 180,
          height: 48,
          page_width: 612,
          page_height: 792,
        },
      ],
      workspace_id: 'workspace-1',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/contracts/contract-1/place-fields?workspace_id=workspace-1',
        body: {
          fields: [
            {
              signer_id: 'signer-1',
              left: 120,
              top: 640,
              width: 180,
              height: 48,
              page_width: 612,
              page_height: 792,
              page: 1,
            },
          ],
        },
      },
    ],
  },
  {
    name: 'loads the contract workflow state',
    tool: crmGetContractWorkflowStateTool,
    args: { contract_id: 'contract-1', workspace_id: 'workspace-1' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/contracts/contract-1/workflow-state?workspace_id=workspace-1',
      },
    ],
  },
  {
    name: 'sends a confirmed contract request',
    tool: crmSendContractRequestTool,
    args: {
      contract_id: 'contract-1',
      content: 'Please sign.',
      language: 'ja',
      confirm: true,
      workspace_id: 'workspace-1',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/contracts/contract-1/send-request?workspace_id=workspace-1',
        body: { content: 'Please sign.', language: 'ja' },
      },
    ],
  },
  {
    name: 'schedules a confirmed contract request',
    tool: crmScheduleContractRequestTool,
    args: {
      contract_id: 'contract-1',
      content: 'Please sign.',
      scheduled_at: '2026-07-01T09:00:00+09:00',
      confirm: true,
      workspace_id: 'workspace-1',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/contracts/contract-1/schedule-send?workspace_id=workspace-1',
        body: { content: 'Please sign.', scheduled_at: '2026-07-01T09:00:00+09:00' },
      },
    ],
  },
];

describe('CRM contract tools', () => {
  beforeEach(() => {
    resetBinaryDownloadStoreForTests();
    resetBinaryUploadStoreForTests();
  });

  it('lists contract templates through the V2 contract route', async () => {
    const withResponse = jest.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          templates: [
            {
              id: 'template-1',
              name: 'NDA',
              file_name: 'contract-documents/nda.pdf',
              source_file_name: 'nda.docx',
            },
          ],
          message: 'OK',
        },
        meta: {},
      },
      response: new Response('{}'),
    });
    const v2Get = jest.fn().mockReturnValue({ withResponse });

    const result = await crmListContractTemplatesTool.handler({
      reqContext: {
        client: { v2Get } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { workspace_id: 'workspace-1' },
    });

    expect(v2Get).toHaveBeenCalledWith('/contracts/templates', {
      query: { workspace_id: 'workspace-1' },
    });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      results: [
        {
          id: 'template-1',
          name: 'NDA',
          source_file_name: 'nda.docx',
        },
      ],
    });
  });

  it('downloads contract templates as stored binary results', async () => {
    const asResponse = jest.fn().mockResolvedValue(
      new Response(Buffer.from('%PDF-1.4\ntemplate'), {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="nda-template.pdf"',
        },
      }),
    );
    const v2Get = jest.fn().mockReturnValue({ asResponse });

    const result = await crmDownloadContractTemplateTool.handler({
      reqContext: {
        client: { v2Get } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        template_id: 'template-1',
        source: false,
        workspace_id: 'workspace-1',
      },
    });

    expect(v2Get).toHaveBeenCalledWith('/contracts/templates/template-1/download', {
      query: { workspace_id: 'workspace-1', source: false },
    });
    expect(result.structuredContent).toMatchObject({
      filename: 'nda-template.pdf',
      mime_type: 'application/pdf',
      download_complete: true,
      content_base64_available: true,
    });
  });

  it('uploads contract templates and contract PDFs as multipart documents', async () => {
    const v2Post = jest
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: { id: 'template-1', name: 'NDA' },
        meta: { ctx_id: 'ctx-template' },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { contract_id: 'contract-1', name: 'Uploaded NDA', status: 'draft' },
        meta: { ctx_id: 'ctx-contract' },
      });

    const templateResult = await crmUploadContractTemplateTool.handler({
      reqContext: {
        client: { v2Post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filename: 'nda.docx',
        content_base64: Buffer.from('docx').toString('base64'),
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        name: 'NDA',
        workspace_id: 'workspace-1',
      },
    });
    const pdfResult = await crmUploadContractPDFTool.handler({
      reqContext: {
        client: { v2Post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filename: '../../contract.pdf',
        content_base64: Buffer.from('%PDF-1.4\nbody').toString('base64'),
        title: 'Uploaded NDA',
        workspace_id: 'workspace-1',
      },
    });

    expect(v2Post).toHaveBeenNthCalledWith(1, '/contracts/templates', {
      body: expect.any(FormData),
      query: { workspace_id: 'workspace-1' },
    });
    expect(v2Post).toHaveBeenNthCalledWith(2, '/contracts/manual-upload', {
      body: expect.any(FormData),
      query: { workspace_id: 'workspace-1' },
    });
    const templateForm = v2Post.mock.calls[0][1].body as FormData;
    const pdfForm = v2Post.mock.calls[1][1].body as FormData;
    expect(templateForm.get('name')).toBe('NDA');
    expect((templateForm.get('doc') as File).name).toBe('nda.docx');
    expect(pdfForm.get('title')).toBe('Uploaded NDA');
    expect((pdfForm.get('doc') as File).name).toBe('contract.pdf');
    expect(templateResult.structuredContent).toMatchObject({ id: 'template-1', ctx_id: 'ctx-template' });
    expect(pdfResult.structuredContent).toMatchObject({
      contract_id: 'contract-1',
      ctx_id: 'ctx-contract',
    });
  });

  it('rejects oversized contract template uploads before decoding', async () => {
    const v2Post = jest.fn();

    const result = await crmUploadContractTemplateTool.handler({
      reqContext: {
        client: { v2Post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filename: 'huge-template.pdf',
        content_base64: 'A'.repeat(28 * 1024 * 1024),
      },
    });

    expect(v2Post).not.toHaveBeenCalled();
    expect(firstTextContent(result)).toContain('20 MiB or smaller');
  });

  it('rejects invalid contract upload base64 before decoding', async () => {
    const v2Post = jest.fn();

    const result = await crmUploadContractPDFTool.handler({
      reqContext: {
        client: { v2Post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        filename: 'contract.pdf',
        content_base64: 'data:application/pdf;bad,not-base64',
      },
    });

    expect(v2Post).not.toHaveBeenCalled();
    expect(firstTextContent(result)).toContain('must be valid base64 data');
  });

  it('replaces draft PDFs and authoritative signer and CC recipient lists', async () => {
    const v2Put = jest
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: {
          contract_id: 'contract-1',
          file_name: 'contract-documents/corrected.pdf',
          signature_fields_reset_count: 2,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          signers: [{ signer_id: 'signer-1', name: 'Yudai Abe' }],
          cc_recipients: [{ recipient_id: 'recipient-1', email: 'observer@example.com' }],
        },
      });
    const reqContext = {
      client: { v2Put } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    await crmReplaceContractPDFTool.handler({
      reqContext,
      args: {
        contract_id: 'contract-1',
        filename: 'corrected.pdf',
        content_base64: Buffer.from('%PDF-1.4\ncorrected').toString('base64'),
        title: 'Corrected contract',
        workspace_id: 'workspace-1',
      },
    });
    await crmSaveContractRecipientsTool.handler({
      reqContext,
      args: {
        contract_id: 'contract-1',
        signers: [
          {
            signer_id: 'signer-1',
            name: 'Yudai Abe',
            email: 'yudai.abe@capitaltokyo.com',
            ignored: 'value',
          },
        ],
        cc_recipients: [{ name: 'Observer', email: 'observer@example.com', ignored: 'value' }],
        workspace_id: 'workspace-1',
      },
    });

    expect(v2Put).toHaveBeenNthCalledWith(1, '/contracts/contract-1/pdf', {
      body: expect.any(FormData),
      query: { workspace_id: 'workspace-1' },
    });
    expect(v2Put).toHaveBeenNthCalledWith(2, '/contracts/contract-1/recipients', {
      body: {
        signers: [
          {
            signer_id: 'signer-1',
            name: 'Yudai Abe',
            email: 'yudai.abe@capitaltokyo.com',
          },
        ],
        cc_recipients: [{ name: 'Observer', email: 'observer@example.com' }],
      },
      query: { workspace_id: 'workspace-1' },
    });
  });

  it('requires explicit confirmation before sending contract requests', async () => {
    const v2Post = jest.fn();
    const reqContext = {
      client: { v2Post } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const sendResult = await crmSendContractRequestTool.handler({
      reqContext,
      args: {
        contract_id: 'contract-1',
        content: 'Please sign.',
      },
    });
    const scheduleResult = await crmScheduleContractRequestTool.handler({
      reqContext,
      args: {
        contract_id: 'contract-1',
        content: 'Please sign.',
        scheduled_at: '2026-07-01T09:00:00+09:00',
      },
    });

    expect(v2Post).not.toHaveBeenCalled();
    expect(firstTextContent(sendResult)).toContain('`confirm=true` is required');
    expect(firstTextContent(scheduleResult)).toContain('`confirm=true` is required');
  });

  describeV2Requests(v2Requests);
});
