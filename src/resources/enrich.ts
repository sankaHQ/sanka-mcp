// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../core/resource';
import { APIPromise } from '../core/api-promise';
import { RequestOptions } from '../internal/request-options';
import { V2Envelope, unwrapV2Data } from '../internal/v2';

const wrapV2EnrichEnvelope = (
  promise: APIPromise<V2Envelope<EnrichCreateResponse.Data>>,
): APIPromise<EnrichCreateResponse> => {
  return promise._thenUnwrap((envelope) => ({
    data: unwrapV2Data(envelope),
    message: 'Company enrichment completed',
    ctx_id: envelope.meta.ctx_id ?? null,
  }));
};

export class Enrich extends APIResource {
  /**
   * Enrich Company Data
   */
  create(body: EnrichCreateParams, options?: RequestOptions): APIPromise<EnrichCreateResponse> {
    return wrapV2EnrichEnvelope(this._client.post('/api/v2/enrich', { body, ...options }));
  }
}

export interface EnrichCreateResponse {
  data: EnrichCreateResponse.Data;

  message: string;

  ctx_id?: string | null;
}

export namespace EnrichCreateResponse {
  export interface Data {
    pipeline_version: string;

    request_hash: string;

    run_id: string;

    company_id?: string | null;

    field_evidence?: { [key: string]: unknown };

    proposed_fields?: { [key: string]: unknown };

    provider_meta?: { [key: string]: unknown };

    seed_external_id?: string | null;

    skipped_fields?: { [key: string]: unknown };

    updated_builtin_fields?: { [key: string]: unknown };

    updated_custom_fields?: { [key: string]: unknown };
  }
}

export interface EnrichCreateParams {
  object_type: string;

  custom_field_map?: { [key: string]: string };

  dry_run?: boolean;

  force_refresh?: boolean;

  record_id?: string | null;

  seed?: EnrichCreateParams.Seed | null;
}

export namespace EnrichCreateParams {
  export interface Seed {
    external_id?: string | null;

    name?: string | null;

    url?: string | null;
  }
}

export declare namespace Enrich {
  export { type EnrichCreateResponse as EnrichCreateResponse, type EnrichCreateParams as EnrichCreateParams };
}
