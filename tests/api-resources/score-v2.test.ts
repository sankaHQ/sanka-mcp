import Sanka from 'sanka-sdk';

const scoreData = {
  object_type: 'company',
  record_id: '00000000-0000-4000-8000-000000000111',
  snapshot_id: '00000000-0000-4000-8000-000000000222',
  algorithm_key: 'company_score',
  algorithm_version: 'v1',
  input_hash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
  output_hash: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
  score: 78,
  band: 'good',
  dimensions: [{ key: 'fit' }],
  reasons: [{ code: 'company_fit' }],
  explanation: 'Company fit scored 75/100.',
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('resource score on V2', () => {
  test('uses V2 score path and preserves legacy response shape', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        return envelope(scoreData);
      },
    });

    await expect(
      client.score.create({
        object_type: 'company',
        record_id: '00000000-0000-4000-8000-000000000111',
      }),
    ).resolves.toEqual({
      data: scoreData,
      message: 'Score calculated',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['POST http://localhost:5000/api/v2/score']);
  });
});
