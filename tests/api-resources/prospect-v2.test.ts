import Sanka from 'sanka-sdk';

const prospectData = {
  query: 'manufacturing companies in Tokyo',
  parsed_filters: {
    query: 'manufacturing companies in Tokyo',
    location: 'Tokyo',
    industry: 'Manufacturing',
    min_employee_count: null,
    max_employee_count: null,
  },
  results: [
    {
      name: 'Acme Manufacturing',
      url: 'https://acme.example',
      domain: 'acme.example',
      industry: 'Manufacturing',
      source_urls: ['https://acme.example'],
      sources: ['exa'],
      relevance_score: 0.92,
      match_reasons: ['matched discovery query'],
      provider_meta: { bridge: 'legacy' },
    },
  ],
  count: 1,
  provider_meta: { bridge: 'legacy' },
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('resource prospect companies on V2', () => {
  test('uses V2 prospect path and preserves legacy response shape', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        return envelope(prospectData);
      },
    });

    await expect(
      client.prospect.companies.create({
        query: 'manufacturing companies in Tokyo',
        limit: 3,
      }),
    ).resolves.toEqual({
      data: prospectData,
      message: 'Company prospecting completed',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['POST http://localhost:5000/api/v2/prospect/companies']);
  });
});
