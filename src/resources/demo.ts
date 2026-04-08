// Hand-written addition for the demo workspace seeding endpoint. Tracked for
// inclusion in the next Stainless regeneration; safe to edit until then.

import { APIResource } from '../core/resource';
import { APIPromise } from '../core/api-promise';
import { RequestOptions } from '../internal/request-options';

export class Demo extends APIResource {
  /**
   * Seed a Sanka workspace with a curated demo template (companies, contacts,
   * items, deals, subscriptions, invoices, and receipts). Reuses an existing
   * workspace when ``workspace_id`` is provided; otherwise provisions a new
   * free-tier workspace owned by the caller.
   */
  generate(body: DemoGenerateParams, options?: RequestOptions): APIPromise<DemoGenerateResponse> {
    return this._client.post('/v1/demo/generate', { body, ...options });
  }
}

export interface DemoGenerateResponse {
  workspace_id: string;

  workspace_name: string;

  template: string;

  country: string;

  seed: number;

  created: boolean;

  counts: { [key: string]: number };

  sample_record_ids: { [key: string]: string[] };

  message: string;

  workspace_short_id?: number | null;

  ctx_id?: string | null;
}

export interface DemoGenerateParams {
  /**
   * Demo template slug, e.g. ``b2b_saas``, ``dtc_subscription``,
   * ``agency_services``.
   */
  template: string;

  /**
   * ISO country code (lowercase), e.g. ``us`` or ``jp``.
   */
  country: string;

  /**
   * Optional existing workspace UUID to seed into. When omitted, a new
   * free-tier workspace owned by the caller is created.
   */
  workspace_id?: string | null;

  /**
   * Optional seed for the deterministic random selections. Useful for
   * tests and replayable demos.
   */
  seed?: number | null;
}

export declare namespace Demo {
  export { type DemoGenerateResponse as DemoGenerateResponse, type DemoGenerateParams as DemoGenerateParams };
}
