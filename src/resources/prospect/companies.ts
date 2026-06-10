// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { V2Envelope, unwrapV2Data } from '../../internal/v2';

const wrapV2ProspectCompaniesEnvelope = (
  promise: APIPromise<V2Envelope<ProspectCompaniesCreateResponse.Data>>,
): APIPromise<ProspectCompaniesCreateResponse> => {
  return promise._thenUnwrap((envelope) => ({
    data: unwrapV2Data(envelope),
    message: 'Company prospecting completed',
    ctx_id: envelope.meta.ctx_id ?? null,
  }));
};

export class ProspectCompanies extends APIResource {
  /**
   * Prospect Companies from External Sources
   */
  create(
    body: ProspectCompaniesCreateParams,
    options?: RequestOptions,
  ): APIPromise<ProspectCompaniesCreateResponse> {
    return wrapV2ProspectCompaniesEnvelope(
      this._client.post('/api/v2/prospect/companies', { body, ...options }),
    );
  }
}

export interface ProspectCompaniesCreateResponse {
  data: ProspectCompaniesCreateResponse.Data;

  message: string;

  ctx_id?: string | null;
}

export namespace ProspectCompaniesCreateResponse {
  export interface Data {
    count: number;

    results: Array<Data.Result>;

    parsed_filters?: Data.ParsedFilters;

    provider_meta?: Record<string, unknown>;

    query?: string | null;
  }

  export namespace Data {
    export interface Result {
      name?: string | null;

      url?: string | null;

      domain?: string | null;

      industry?: string | null;

      employee_count?: number | null;

      employee_count_display?: string | null;

      address?: string | null;

      email?: string | null;

      phone_number?: string | null;

      linkedin_url?: string | null;

      description?: string | null;

      source_urls?: Array<string>;

      sources?: Array<string>;

      relevance_score?: number;

      match_reasons?: Array<string>;

      provider_meta?: Record<string, unknown>;
    }

    export interface ParsedFilters {
      query?: string | null;

      location?: string | null;

      industry?: string | null;

      min_employee_count?: number | null;

      max_employee_count?: number | null;
    }
  }
}

export interface ProspectCompaniesCreateParams {
  query?: string;

  location?: string;

  industry?: string;

  min_employee_count?: number;

  max_employee_count?: number;

  limit?: number;

  sources?: Array<string>;
}

export declare namespace ProspectCompanies {
  export {
    type ProspectCompaniesCreateResponse as ProspectCompaniesCreateResponse,
    type ProspectCompaniesCreateParams as ProspectCompaniesCreateParams,
  };
}
