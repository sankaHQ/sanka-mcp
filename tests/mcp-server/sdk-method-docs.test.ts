import { generateSdkMethodDocs } from '../../scripts/generate-sdk-method-docs';
import { type SdkMethodDoc, sdkMethodDocs } from '../../packages/mcp-server/src/generated/sdk-method-docs';
import { LocalDocsSearch } from '../../packages/mcp-server/src/local-docs-search';
import { sdkMethods } from '../../packages/mcp-server/src/methods';

// methods.ts names path segments after the API ({item_id}); the generated index uses the
// client argument names ({itemID}). Only the shape of the path has to agree.
const pathShape = (endpoint: string) => endpoint.replace(/\{[^}]+\}/g, '{}');

describe('search_docs method index', () => {
  let generated: SdkMethodDoc[];

  beforeAll(async () => {
    generated = await generateSdkMethodDocs();
  }, 120_000);

  it('matches the methods and requests of the TypeScript client', () => {
    const committed = new Map(sdkMethodDocs.map((doc) => [doc.qualified, doc]));
    const current = new Map(generated.map((doc) => [doc.qualified, doc]));
    const stale: string[] = [];
    for (const doc of generated) {
      const committedDoc = committed.get(doc.qualified);
      if (!committedDoc) {
        stale.push(`${doc.qualified}: missing`);
        continue;
      }
      const changed = (Object.keys(doc) as (keyof SdkMethodDoc)[]).filter(
        (field) => JSON.stringify(committedDoc[field]) !== JSON.stringify(doc[field]),
      );
      if (changed.length > 0) stale.push(`${doc.qualified}: ${changed.join(', ')} changed`);
    }
    for (const doc of sdkMethodDocs) {
      if (!current.has(doc.qualified)) stale.push(`${doc.qualified}: no longer on the client`);
    }

    if (stale.length > 0) {
      throw new Error(
        'packages/mcp-server/src/generated/sdk-method-docs.ts is stale. ' +
          `Run \`pnpm generate:sdk-method-docs\`.\n${stale.join('\n')}`,
      );
    }
    expect(sdkMethodDocs).toEqual(generated);
  });

  it('lists every client method in the code tool method registry', () => {
    const registry = new Map(sdkMethods.map((method) => [method.clientCallName, method]));
    const problems: string[] = [];
    for (const doc of generated) {
      const fullyQualifiedName = doc.qualified.slice('client.'.length);
      const expected = `{ clientCallName: '${doc.qualified}', fullyQualifiedName: '${fullyQualifiedName}', httpMethod: '${doc.httpMethod}', httpPath: '${doc.endpoint}' }`;
      const entry = registry.get(doc.qualified);
      if (!entry) {
        problems.push(`missing ${expected}`);
      } else if (
        entry.fullyQualifiedName !== fullyQualifiedName ||
        entry.httpMethod !== doc.httpMethod ||
        pathShape(entry.httpPath ?? '') !== pathShape(doc.endpoint)
      ) {
        problems.push(`${entry.httpMethod} ${entry.httpPath} should be ${expected}`);
      }
    }
    for (const method of sdkMethods) {
      if (!generated.some((doc) => doc.qualified === method.clientCallName)) {
        problems.push(`${method.clientCallName} is not a client method`);
      }
    }

    expect(problems).toEqual([]);
  });

  it('returns the item routes the client calls', async () => {
    const search = await LocalDocsSearch.create();
    const find = (query: string, method: string) =>
      search
        .search({ query, language: 'typescript' })
        .results.find((result) => typeof result === 'object' && result['method'] === method);

    expect(find('delete item', 'client.public.items.delete')).toMatchObject({
      signature: expect.stringContaining('client.public.items.delete(itemID: string'),
      summary: 'Permanently delete an archived item.',
      endpoint: 'DELETE /api/v2/items/{itemID}',
    });
    expect(find('archive item', 'client.public.items.archive')).toMatchObject({
      endpoint: 'POST /api/v2/items/{itemID}/archive',
    });
    expect(find('update item', 'client.public.items.update')).toMatchObject({
      endpoint: 'PATCH /api/v2/items/{itemID}',
    });
    expect(
      search
        .search({ query: 'update item', language: 'typescript', detail: 'verbose' })
        .results.some((result) => String(result).includes('**patch** `/api/v2/items/{itemID}`')),
    ).toBe(true);
  });
});
