// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../core/resource';
import { APIPromise } from '../core/api-promise';
import { RequestOptions } from '../internal/request-options';

export class Score extends APIResource {
  /**
   * Score Company or Deal Data
   */
  create(body: ScoreCreateParams, options?: RequestOptions): APIPromise<ScoreCreateResponse> {
    return this._client.post('/v1/score', { body, ...options });
  }
}

export interface ScoreCreateResponse {
  data: ScoreCreateResponse.Data;

  message: string;

  ctx_id?: string | null;
}

export namespace ScoreCreateResponse {
  export interface Data {
    algorithm_key: string;

    algorithm_version: string;

    band: string;

    input_hash: string;

    object_type: string;

    output_hash: string;

    record_id: string;

    score: number;

    snapshot_id: string;

    dimensions?: Array<{ [key: string]: unknown }>;

    explanation?: string;

    reasons?: Array<{ [key: string]: unknown }>;

    score_model_id?: string | null;

    score_model_name?: string | null;

    score_model_version?: number | null;
  }
}

export interface ScoreCreateParams {
  object_type: string;

  record_id: string;

  score_model_id?: string | null;
}

export declare namespace Score {
  export { type ScoreCreateResponse as ScoreCreateResponse, type ScoreCreateParams as ScoreCreateParams };
}
