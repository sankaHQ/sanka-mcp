import {
  appendBinaryUploadChunk,
  finishBinaryUpload,
  resetBinaryUploadStoreForTests,
  startBinaryUpload,
} from '../../packages/mcp-server/src/binary-upload-store';

beforeEach(resetBinaryUploadStoreForTests);

it('rejects exhausted admissions without evicting another principal or bypassing quota via sessions', () => {
  const other = startBinaryUpload({ filename: 'other.pdf', sessionId: 'B', principalId: 'workspace-B' });
  if (!other.ok) throw new Error(other.message);
  const attempts = Array.from({ length: 105 }, (_, index) =>
    startBinaryUpload({ filename: 'a.pdf', sessionId: `A-${index}`, principalId: 'workspace-A' }),
  );
  expect(
    appendBinaryUploadChunk({
      uploadToken: other.uploadToken,
      sessionId: 'B',
      principalId: 'workspace-B',
      contentBase64: 'cGRm',
    }),
  ).toMatchObject({ ok: true });
  expect(attempts.some((result) => result.ok === false)).toBe(true);
});

it('bounds aggregate reservations across different principals and recovers expired capacity', () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
  try {
    const attempts = Array.from({ length: 20 }, (_, index) =>
      startBinaryUpload({
        filename: 'a.pdf',
        principalId: `workspace-${index}`,
      }),
    );
    expect(attempts.filter((result) => result.ok).length).toBeGreaterThan(1);
    expect(attempts.some((result) => !result.ok)).toBe(true);
    clock.mockReturnValue(1000 + 60 * 60 * 1000);
    expect(startBinaryUpload({ filename: 'new.pdf', principalId: 'new' }).ok).toBe(true);
  } finally {
    clock.mockRestore();
  }
});

it('holds finishing reservations across expiry and prevents duplicate consumption', () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
  try {
    const transfers = Array.from({ length: 2 }, () => {
      const started = startBinaryUpload({ filename: 'a.pdf', principalId: 'A' });
      if (!started.ok) throw new Error(started.message);
      const identity = { uploadToken: started.uploadToken, principalId: 'A' };
      expect(appendBinaryUploadChunk({ ...identity, contentBase64: 'cGRm' }).ok).toBe(true);
      const finished = finishBinaryUpload(identity);
      if (!finished.ok) throw new Error(finished.message);
      expect(finished.buffer.toString()).toBe('pdf');
      expect(finishBinaryUpload(identity).ok).toBe(false);
      expect(appendBinaryUploadChunk({ ...identity, contentBase64: 'cGRm' }).ok).toBe(false);
      return finished;
    });
    clock.mockReturnValue(1000 + 60 * 60 * 1000);
    expect(startBinaryUpload({ filename: 'blocked.pdf', principalId: 'A' }).ok).toBe(false);
    transfers[0]!.release();
    transfers[0]!.release();
    expect(startBinaryUpload({ filename: 'retry.pdf', principalId: 'A' }).ok).toBe(true);
    expect(startBinaryUpload({ filename: 'still-blocked.pdf', principalId: 'A' }).ok).toBe(false);
    transfers[1]!.release();
  } finally {
    clock.mockRestore();
  }
});

it.each([NaN, Infinity, -1, 0, 1.5, 13 * 1024 * 1024])('rejects invalid expected length %s', (length) => {
  expect(startBinaryUpload({ filename: 'a.pdf', expectedBase64Length: length }).ok).toBe(false);
});

it('binds tokens to both principal and session and keeps rejected chunks out of the assembled file', () => {
  const started = startBinaryUpload({
    filename: 'a.pdf',
    principalId: 'A',
    sessionId: 'S',
    expectedBase64Length: 4,
  });
  if (!started.ok) throw new Error(started.message);
  const identity = { uploadToken: started.uploadToken, principalId: 'A', sessionId: 'S' };
  for (const wrong of [
    { principalId: 'B', sessionId: 'S' },
    { principalId: 'A', sessionId: 'other' },
  ]) {
    expect(appendBinaryUploadChunk({ ...identity, ...wrong, contentBase64: 'cGRm' }).ok).toBe(false);
    expect(finishBinaryUpload({ ...identity, ...wrong }).ok).toBe(false);
  }
  expect(appendBinaryUploadChunk({ ...identity, contentBase64: 'cGRmcGRm' }).ok).toBe(false);
  expect(appendBinaryUploadChunk({ ...identity, contentBase64: 'cG Rm' }).ok).toBe(true);
  const finished = finishBinaryUpload(identity);
  if (!finished.ok) throw new Error(finished.message);
  expect(finished.buffer.toString()).toBe('pdf');
  finished.release();
});

it('keeps stdio uploads within their process identity', () => {
  const started = startBinaryUpload({ filename: 'a.pdf', expectedBase64Length: 4 });
  if (!started.ok) throw new Error(started.message);
  expect(
    appendBinaryUploadChunk({ uploadToken: started.uploadToken, sessionId: 'hosted', contentBase64: 'cGRm' })
      .ok,
  ).toBe(false);
  expect(appendBinaryUploadChunk({ uploadToken: started.uploadToken, contentBase64: 'cGRm' }).ok).toBe(true);
  const finished = finishBinaryUpload({ uploadToken: started.uploadToken });
  if (!finished.ok) throw new Error(finished.message);
  expect(finished.buffer.toString()).toBe('pdf');
  finished.release();
});
