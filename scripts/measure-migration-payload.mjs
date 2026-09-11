#!/usr/bin/env node
// Static serialization measurement only; does not run an agent or model tokenizer.
import fs from 'node:fs';

const suppliedPath = process.argv[2];
const payload =
  suppliedPath ?
    JSON.parse(fs.readFileSync(suppliedPath, 'utf8'))
  : {
      data: {
        workspace_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        migration_id: 'migration-1',
        state: 'blocked',
        result_version: 'fixture-v1',
        routes: Array.from({ length: 10 }, (_, route) => ({
          route_key: `object-${route}`,
          source_count: null,
          mappings: Array.from({ length: 100 }, (_, field) => ({
            source: `property_${field}`,
            destination: `property_${field}`,
            transform: null,
          })),
          blockers: [{ code: 'IDENTITY_REQUIRED', message: 'Review destination identity.' }],
        })),
      },
    };
const bytes = (value) => Buffer.byteLength(value, 'utf8');
const pretty = JSON.stringify(payload, null, 2);
const compact = JSON.stringify(payload);
const structuredContent = { ...payload, workspace_id: payload.data?.workspace_id };
const envelope = (text) => JSON.stringify({ content: [{ type: 'text', text }], structuredContent });
console.log(
  JSON.stringify(
    {
      measurement: 'static UTF-8 serialization; not model tokens or an agent run',
      source:
        suppliedPath ? 'provided payload' : (
          'synthetic: 10 routes × 100 property mappings, unknown counts and blockers'
        ),
      calls_before: 1,
      calls_after: 1,
      text_bytes_before: bytes(pretty),
      text_bytes_after: bytes(compact),
      mcp_envelope_bytes_before: bytes(envelope(pretty)),
      mcp_envelope_bytes_after: bytes(envelope(compact)),
      evidence_preserved: JSON.stringify(JSON.parse(pretty)) === compact,
      limitation:
        'Both content representations remain. Client model visibility is unknown. API pagination and artifact reuse need separate end-to-end measurement.',
    },
    null,
    2,
  ),
);
