import { APIPromise } from '../../core/api-promise';
import { APIResource } from '../../core/resource';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { unwrapV2DataPromise } from '../../internal/v2';

export class WorkspaceUsers extends APIResource {
  invitations: WorkspaceUserInvitations = new WorkspaceUserInvitations(this._client);
}

export class WorkspaceUserInvitations extends APIResource {
  /** Invite a user to the authenticated workspace. */
  create(
    body: WorkspaceInvitationCreateParams,
    options?: RequestOptions,
  ): APIPromise<WorkspaceInvitationCreateResponse> {
    return unwrapV2DataPromise(
      this._client.v2Post<WorkspaceInvitationCreateResponse>('/workspace-users/invitations', {
        body,
        ...options,
      }),
    );
  }

  /** List pending and historical invitations for the authenticated workspace. */
  list(
    params: WorkspaceInvitationListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<WorkspaceInvitationListResponse> {
    return unwrapV2DataPromise(
      this._client.v2Get<WorkspaceInvitationListResponse>('/workspace-users/invitations', {
        query: params ?? {},
        ...options,
      }),
    );
  }

  /** Cancel a pending workspace invitation. */
  cancel(invitationID: number, options?: RequestOptions): APIPromise<WorkspaceInvitationCancelResponse> {
    return unwrapV2DataPromise(
      this._client.v2Delete<WorkspaceInvitationCancelResponse>(
        path`/workspace-users/invitations/${invitationID}`,
        options,
      ),
    );
  }
}

export type WorkspaceUserRole = 'admin' | 'staff' | 'view_only' | 'partner';

export interface WorkspaceInvitationCreateParams {
  email: string;
  role: WorkspaceUserRole;
  permissions?: Record<string, string> | null;
  permission_set_id?: string | null;
  language?: 'ja' | 'en' | null;
  simplified_invite?: boolean;
}

export interface WorkspaceInvitationCreateResponse {
  invitation_id: string;
  email: string;
  role: WorkspaceUserRole | string;
  status: string;
  invited_count: number;
  invited: Array<string>;
  skipped_existing: number;
  skipped_invited: number;
  skipped_protected: number;
  permission_set_id?: string | null;
  email_delivery?: string | null;
}

export interface WorkspaceInvitationListParams {
  q?: string | null;
  page?: number;
  page_size?: number;
}

export interface WorkspaceInvitationListItem {
  id: number;
  email?: string | null;
  role?: WorkspaceUserRole | string | null;
  status?: string | null;
  date_sent?: string | null;
  permission_set_id?: string | null;
  permission_set_name?: string | null;
}

export interface WorkspaceInvitationListResponse {
  invitations: Array<WorkspaceInvitationListItem>;
  total: number;
  page: number;
  page_size: number;
  has_next_page: boolean;
  can_edit: boolean;
  message: string;
}

export interface WorkspaceInvitationCancelResponse {
  message: string;
}

WorkspaceUsers.Invitations = WorkspaceUserInvitations;

export declare namespace WorkspaceUsers {
  export {
    WorkspaceUserInvitations as Invitations,
    type WorkspaceUserRole as WorkspaceUserRole,
    type WorkspaceInvitationCreateParams as WorkspaceInvitationCreateParams,
    type WorkspaceInvitationCreateResponse as WorkspaceInvitationCreateResponse,
    type WorkspaceInvitationListParams as WorkspaceInvitationListParams,
    type WorkspaceInvitationListItem as WorkspaceInvitationListItem,
    type WorkspaceInvitationListResponse as WorkspaceInvitationListResponse,
    type WorkspaceInvitationCancelResponse as WorkspaceInvitationCancelResponse,
  };
}
