import { execFile } from 'node:child_process';

import { readBinaryResponse } from './types';

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const supportAttachmentMime = (bytes: Buffer): string | undefined => {
  const header = bytes.subarray(0, 12);
  if (header.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (header.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png';
  if (header.subarray(0, 3).toString('hex') === 'ffd8ff') return 'image/jpeg';
  if (/^GIF8[79]a/.test(header.toString())) return 'image/gif';
  if (header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8) === 'WEBP') {
    return 'image/webp';
  }
  return undefined;
};

const renderPdfPage = (bytes: Buffer, page: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const number = String(page);
    const child = execFile(
      'pdftocairo',
      [
        '-jpeg',
        '-jpegopt',
        'quality=90',
        '-scale-to',
        '1800',
        '-singlefile',
        '-f',
        number,
        '-l',
        number,
        '-',
        '-',
      ],
      {
        encoding: 'buffer',
        maxBuffer: MAX_IMAGE_BYTES,
        timeout: 10_000,
        killSignal: 'SIGKILL',
        // Use Alpine's libraries ahead of the container's glibc compatibility layer.
        env: { PATH: process.env['PATH'], LD_LIBRARY_PATH: '/usr/lib:/lib' },
      },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
    // The process can exit before consuming stdin, for example on invalid input.
    child.stdin?.on('error', reject);
    child.stdin?.end(bytes);
  });

export const readSupportAttachment = async (
  response: Response,
  page: number,
): Promise<{ bytes: Buffer; mimeType: string; pdf: boolean; size: number } | { error: string }> => {
  const bytes = await readBinaryResponse(response, MAX_PDF_BYTES);
  if (!bytes) return { error: 'This attachment exceeds 25 MiB. Open it in the Sanka ticket.' };

  const mimeType = supportAttachmentMime(bytes);
  if (!mimeType) {
    return {
      error: 'MCP previews PDF, PNG, JPEG, GIF and WebP attachments. Open other files in the Sanka ticket.',
    };
  }
  if (mimeType !== 'application/pdf') {
    if (bytes.length > MAX_IMAGE_BYTES) {
      return { error: 'This image exceeds 4 MiB. Open it in the Sanka ticket.' };
    }
    return { bytes, mimeType, pdf: false, size: bytes.length };
  }
  try {
    const image = await renderPdfPage(bytes, page);
    if (!image.length) return { error: `No preview was produced for PDF page ${page}.` };
    return { bytes: image, mimeType: 'image/jpeg', pdf: true, size: bytes.length };
  } catch {
    return {
      error: `Could not render PDF page ${page}. Check the page number or open the PDF in the Sanka ticket.`,
    };
  }
};
