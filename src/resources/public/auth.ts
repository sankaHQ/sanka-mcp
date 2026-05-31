// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { V2Envelope, unwrapV2Data } from '../../internal/v2';

type V2AuthSessionData = {
  auth_mode?: string;
  principal_key?: string;
  user?: {
    id?: string | number;
    email?: string | null;
    username?: string | null;
  } | null;
  current_workspace?: {
    id?: string | null;
    code?: string | null;
    name?: string | null;
  } | null;
  permissions?: string[];
  permission_level?: string | null;
  token_id?: string | null;
  token_name?: string | null;
};

const unwrapV2AuthIdentity = (
  promise: APIPromise<V2Envelope<V2AuthSessionData>>,
): APIPromise<AuthGetCurrentIdentityResponse> => {
  return promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    const user = data.user ?? {};
    const workspace = data.current_workspace ?? {};
    return {
      data: {
        auth_mode: data.auth_mode ?? 'oauth_app',
        principal_key: data.principal_key ?? '',
        user_id: String(user.id ?? ''),
        email: user.email ?? null,
        username: user.username ?? null,
        workspace_id: workspace.id ?? null,
        workspace_code: workspace.code ?? null,
        workspace_name: workspace.name ?? null,
        permissions: data.permissions ?? [],
        permission_level: data.permission_level ?? null,
        token_id: data.token_id ?? null,
        token_name: data.token_name ?? null,
      },
      message: 'ok',
      ctx_id: envelope.meta.ctx_id ?? null,
    };
  });
};

export class Auth extends APIResource {
  /**
   * Get Current Public Auth Identity
   */
  getCurrentIdentity(options?: RequestOptions): APIPromise<AuthGetCurrentIdentityResponse> {
    return unwrapV2AuthIdentity(this._client.get('/api/v2/auth/session', options));
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
