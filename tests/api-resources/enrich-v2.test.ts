import Sanka from 'sanka-sdk';

const enrichData = {
  company_id: '00000000-0000-4000-8000-000000000111',
  run_id: '00000000-0000-4000-8000-000000000222',
  pipeline_version: 'v1',
  request_hash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
  updated_builtin_fields: {},
  updated_custom_fields: {},
  proposed_fields: { url: { value: 'https://acme.example' } },
  field_evidence: { url: { value: 'https://acme.example' } },
  skipped_fields: {},
  provider_meta: { bridge: 'legacy' },
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('resource enrich on V2', () => {
  test('uses V2 enrich path and preserves legacy response shape', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        return envelope(enrichData);
      },
    });

    await expect(
      client.enrich.create({
        object_type: 'company',
        record_id: '00000000-0000-4000-8000-000000000111',
      }),
    ).resolves.toEqual({
      data: enrichData,
      message: 'Company enrichment completed',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['POST http://localhost:5000/api/v2/enrich']);
  });
});
