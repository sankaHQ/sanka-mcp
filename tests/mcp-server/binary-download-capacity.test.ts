import {
  storeBinaryDownload,
  readBinaryDownloadFile,
  resetBinaryDownloadStoreForTests,
} from '../../packages/mcp-server/src/binary-download-store';
import { asBinaryDownloadResult } from '../../packages/mcp-server/src/types';

const file = (contentBase64 = 'YQ==') => ({
  contentBase64,
  filename: 'file.pdf',
  mimeType: 'application/pdf',
  byteLength: Math.floor((contentBase64.length * 3) / 4),
  sessionId: 'session',
});
beforeEach(() => resetBinaryDownloadStoreForTests());

it('rejects a full store without removing a live download', () => {
  const first = storeBinaryDownload(file());
  for (let i = 1; i < 100; i++) storeBinaryDownload(file());
  expect(() => storeBinaryDownload(file())).toThrow(/capacity/);
  expect(readBinaryDownloadFile({ downloadToken: first.downloadToken, sessionId: 'session' })).toMatchObject({
    ok: true,
    contentBase64: 'YQ==',
  });
});

it('bounds retained bytes even when the entry count is small', () => {
  const payload = 'A'.repeat(22 * 1024 * 1024);
  const first = storeBinaryDownload(file(payload));
  storeBinaryDownload(file(payload));
  expect(() => storeBinaryDownload(file(payload))).toThrow(/capacity/);
  expect(readBinaryDownloadFile({ downloadToken: first.downloadToken, sessionId: 'session' })).toMatchObject({
    ok: true,
  });
});

it.each([true, false])(
  'rejects oversized binary responses before retention (declared=%s)',
  async (declared) => {
    const chunk = new Uint8Array(256 * 1024);
    let remaining = 130;
    let cancelled = false;
    const body = new ReadableStream({
      pull(controller) {
        if (remaining-- > 0) controller.enqueue(chunk);
        else controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const response = new Response(body, {
      headers: declared ? { 'content-length': String(33 * 1024 * 1024) } : {},
    });
    await expect(asBinaryDownloadResult(response)).rejects.toThrow(/limit/);
    expect(cancelled).toBe(true);
  },
);

it('preserves a normal PDF result', async () => {
  const result = await asBinaryDownloadResult(
    new Response('pdf', { headers: { 'content-type': 'application/pdf' } }),
    'test.pdf',
  );
  expect(result.structuredContent).toMatchObject({
    filename: 'test.pdf',
    mime_type: 'application/pdf',
    content_base64: 'cGRm',
    byte_length: 3,
  });
});
