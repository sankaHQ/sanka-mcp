import { readRecord, readString } from './tool-factories';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpTool, ToolCallResult } from './types';

const CARGO_CATALOG_PATH = '/api/v2/manage/cargo';

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    message: { type: 'string' },
  },
};

const unwrapEnvelope = (payload: Record<string, unknown>): Record<string, unknown> => {
  const data = readRecord(payload['data']);
  const meta = readRecord(payload['meta']);
  return {
    ...(data ?? payload),
    ...(meta?.['ctx_id'] ? { ctx_id: meta['ctx_id'] } : undefined),
  };
};

const cargoResult = (payload: Record<string, unknown>, summary: string): ToolCallResult => {
  const structuredContent = unwrapEnvelope(payload);
  return {
    content: [
      { type: 'text', text: summary },
      {
        type: 'text',
        text: `Cargo catalog data:\n${JSON.stringify(structuredContent, null, 2)}`,
      },
    ],
    structuredContent,
  };
};

export const getCargoCatalogTool: McpTool = {
  metadata: {
    resource: 'cargo_catalog',
    operation: 'read',
    tags: ['cargo', 'catalog', 'research', 'suppliers'],
    httpMethod: 'get',
    httpPath: CARGO_CATALOG_PATH,
    operationId: 'manage.cargo.catalog.get',
  },
  tool: {
    name: 'get_cargo_catalog',
    title: 'Get Cargo catalog',
    description:
      'Read the global Cargo catalog operating view: category and supplier counts, research runs, publication blockers, RFQ intakes, LP snapshots, and import batches. This catalog is independent of workspace Company records.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          description: 'Optional category, research run, company, contact, or request search.',
        },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get Cargo catalog',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get Cargo catalog',
    });
    if (authError) return authError;

    const query = readString(args?.['query']);
    const response = (await reqContext.client.get(CARGO_CATALOG_PATH, {
      query: query ? { q: query } : {},
    })) as Record<string, unknown>;
    return cargoResult(response, 'Loaded the Cargo catalog operating view.');
  },
};

export const importCargoCatalogTool: McpTool = {
  metadata: {
    resource: 'cargo_catalog',
    operation: 'write',
    tags: ['cargo', 'catalog', 'research', 'import'],
    httpMethod: 'post',
    httpPath: `${CARGO_CATALOG_PATH}/imports`,
    operationId: 'manage.cargo.catalog.import',
  },
  tool: {
    name: 'import_cargo_catalog',
    title: 'Import Cargo catalog research',
    description:
      'Idempotently import a normalized Cargo research bundle into the global catalog. The bundle may contain categories, suppliers, research runs, sources, claims, raw artifacts, and draft or ready-for-review LP snapshots. This tool never publishes an LP snapshot.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['bundle'],
      properties: {
        bundle: {
          type: 'object',
          additionalProperties: true,
          required: ['idempotency_key', 'artifact_hash'],
          properties: {
            idempotency_key: { type: 'string', minLength: 1 },
            artifact_hash: { type: 'string', minLength: 8 },
            source_ref: { type: 'string' },
            verticals: { type: 'array', items: { type: 'object' } },
            suppliers: { type: 'array', items: { type: 'object' } },
            research_runs: { type: 'array', items: { type: 'object' } },
            sources: { type: 'array', items: { type: 'object' } },
            claims: { type: 'array', items: { type: 'object' } },
            artifacts: { type: 'array', items: { type: 'object' } },
            publications: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Import Cargo catalog research',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Import Cargo catalog research',
    });
    if (authError) return authError;

    const bundle = readRecord(args?.['bundle']);
    if (!bundle) return asErrorResult('Provide a Cargo catalog `bundle` object.');
    if (!readString(bundle['idempotency_key']) || !readString(bundle['artifact_hash'])) {
      return asErrorResult('The bundle requires `idempotency_key` and `artifact_hash`.');
    }

    const response = (await reqContext.client.post(`${CARGO_CATALOG_PATH}/imports`, {
      body: bundle,
    })) as Record<string, unknown>;
    return cargoResult(
      response,
      'Imported Cargo research into the review queue. No LP snapshot was published.',
    );
  },
};
