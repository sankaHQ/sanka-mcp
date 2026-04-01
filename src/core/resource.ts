// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import type { Sanka } from '../client';

export abstract class APIResource {
  protected _client: Sanka;

  constructor(client: Sanka) {
    this._client = client;
  }
}
