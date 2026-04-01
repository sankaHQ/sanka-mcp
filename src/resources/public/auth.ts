// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';

export class Auth extends APIResource {
  /**
   * Get Current Public Auth Identity
   */
  getCurrentIdentity(options?: RequestOptions): APIPromise<AuthGetCurrentIdentityResponse> {
    return this._client.get('/v1/public/auth/whoami', options);
  }
}

export interface AuthGetCurrentIdentityResponse {
  data: AuthGetCurrentIdentityResponse.Data;

  message: string;

  ctx_id?: string | null;
}

export namespace AuthGetCurrentIdentityResponse {
  export interface Data {
    auth_mode: string;

    principal_key: string;

    user_id: string;

    email?: string | null;

    oauth_app_id?: string | null;

    permission_level?: string | null;

    permissions?: Array<string>;

    scopes?: Array<string>;

    token_id?: string | null;

    token_name?: string | null;

    username?: string | null;

    workspace_code?: string | null;

    workspace_id?: string | null;

    workspace_name?: string | null;
  }
}

export declare namespace Auth {
  export { type AuthGetCurrentIdentityResponse as AuthGetCurrentIdentityResponse };
}
