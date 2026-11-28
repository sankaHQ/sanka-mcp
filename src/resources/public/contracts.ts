// Maintained public Contracts resource. The methods mirror the V2 public developer contract under
// /v2/public/contracts for the token's workspace.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { unwrapV2DataPromise } from '../../internal/v2';

export type ContractUsageStatus = 'active' | 'archived';
export type ContractSortDirection = 'asc' | 'desc';
export type ContractFieldType = 'signature' | 'text' | 'date';

export interface ContractSignerData {
  signer_id: string;
  name?: string | null;
  email?: string | null;
  merge_status?: string | null;
  has_signature: boolean;
  placeholder_count: number;
  created_at?: string | null;
}

export interface ContractCopyRecipientData {
  recipient_id: string;
  name?: string | null;
  email: string;
  created_at?: string | null;
}

export interface ContractRecordData {
  id?: string | null;
  record_id?: number | null;
  contract_id: string;
  formatted_contract_id?: number | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  free_text_status?: string | null;
  usage_status?: string | null;
  email_body?: string | null;
  email_sent_at?: string | null;
  scheduled_send_at?: string | null;
  scheduled_send_status?: string | null;
  scheduled_task_id?: string | null;
  original_file_name?: string | null;
  page_count?: number | null;
  signed_file_name?: string | null;
  signer_label?: string | null;
  owner_id?: string | null;
  owner_label?: string | null;
  created_by_id?: string | null;
  created_by_label?: string | null;
  last_updated_by_id?: string | null;
  last_updated_by_label?: string | null;
  signer_count: number;
  signers: Array<ContractSignerData>;
  created_at?: string | null;
  updated_at?: string | null;
  meta?: Record<string, unknown>;
}

export interface ContractListData {
  items: Array<ContractRecordData>;
  page: number;
  page_size: number;
  total: number;
  meta?: Record<string, unknown>;
}

export interface ContractTemplateSummaryData {
  id: string;
  name: string;
  file_name?: string | null;
  source_content_type?: string | null;
  source_file?: string | null;
  source_file_name?: string | null;
  created_at?: string | null;
}

export interface ContractTemplateListData {
  templates: Array<ContractTemplateSummaryData>;
  meta?: Record<string, unknown>;
  message?: string;
}

export interface ContractSignatureFieldData {
  field_id: string;
  signer_id: string;
  field_type: ContractFieldType;
  page_number: number;
  left: number;
  top: number;
  width: number;
  height: number;
  page_width: number;
  page_height: number;
}

export interface ContractTimelineEventData {
  event_id: string;
  event_type: string;
  actor_name?: string | null;
  actor_email?: string | null;
  signer_id?: string | null;
  signer_name?: string | null;
  signer_email?: string | null;
  message?: string | null;
  scheduled_for?: string | null;
  created_at?: string | null;
}

export interface ContractWorkflowStateData {
  contract: ContractRecordData;
  signers: Array<ContractSignerData>;
  cc_recipients: Array<ContractCopyRecipientData>;
  signature_fields: Array<ContractSignatureFieldData>;
  timeline: Array<ContractTimelineEventData>;
  editable: boolean;
  meta?: Record<string, unknown>;
}

export interface ContractCreateData {
  contract_id: string;
  record_id?: number | null;
  name: string;
  description?: string | null;
  status: string;
  free_text_status: string;
  usage_status: string;
  file_name?: string | null;
  page_count?: number | null;
  meta?: Record<string, unknown>;
  message?: string;
}

export interface ContractSaveSignersData {
  ok: boolean;
  created_signers: number;
  signers: Array<ContractSignerData>;
  message?: string;
}

export interface ContractReplaceRecipientsData {
  ok: boolean;
  signers: Array<ContractSignerData>;
  cc_recipients: Array<ContractCopyRecipientData>;
  message?: string;
}

export interface ContractSavePlaceFieldsData {
  done_placing_fields: boolean;
  error_message?: string | null;
  trigger?: string | null;
  message?: string;
}

export interface ContractSendRequestData {
  ok: boolean;
  contract_id: string;
  status: string;
  email_sent_at?: string | null;
  signer_count: number;
  sent_count: number;
  cc_recipient_count: number;
  cc_sent_count: number;
  message?: string;
}

export interface ContractScheduleSendData {
  ok: boolean;
  contract_id: string;
  status: string;
  scheduled_send_at: string;
  scheduled_send_status: string;
  scheduled_task_id?: string | null;
  signer_count: number;
  cc_recipient_count: number;
  message?: string;
}

export interface ContractVoidData {
  contract_id: string;
  status: 'voided';
  usage_status: 'archived';
  updated_count: number;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface ContractArchiveData {
  contract_id: string;
  usage_status: string;
  updated_count: number;
  meta?: Record<string, unknown>;
}

export interface ContractWorkspaceParams {
  /** Query param: internal workspace UUID; defaults to the token's workspace. */
  workspace_id?: string | null;
}

export interface ContractListParams extends ContractWorkspaceParams {
  q?: string | null;
  status?: string | null;
  usage_status?: ContractUsageStatus | null;
  signer_email?: string | null;
  owner_id?: string | null;
  sort_field_id?: string | null;
  sort_direction?: ContractSortDirection | null;
  page?: number;
  limit?: number;
}

export interface ContractCreateFromTemplateParams extends ContractWorkspaceParams {
  /** Query param: optional language override. */
  language?: string | null;
  template_id?: string | null;
  template_name?: string | null;
  title?: string | null;
}

export interface ContractUpdateMetadataParams extends ContractWorkspaceParams {
  name?: string | null;
  description?: string | null;
  status?: string | null;
  free_text_status?: string | null;
  usage_status?: ContractUsageStatus | null;
  owner_id?: string | null;
}

export interface ContractSignerInput {
  signer_id?: string | null;
  name?: string | null;
  email?: string | null;
}

export interface ContractCopyRecipientInput {
  name?: string | null;
  email?: string | null;
}

export interface ContractSaveSignersParams extends ContractWorkspaceParams {
  signers?: Array<ContractSignerInput>;
  signature_id?: string | null;
  add_me_as_signer?: boolean;
}

export interface ContractReplaceRecipientsParams extends ContractWorkspaceParams {
  signers: Array<ContractSignerInput>;
  cc_recipients?: Array<ContractCopyRecipientInput>;
}

export interface ContractPlaceFieldInput {
  signer_id: string;
  field_type?: ContractFieldType;
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
  page_width: number;
  page_height: number;
}

export interface ContractPlaceFieldsParams extends ContractWorkspaceParams {
  fields?: Array<ContractPlaceFieldInput>;
  auto_place_last_page?: boolean;
}

export interface ContractSendRequestParams extends ContractWorkspaceParams {
  content?: string | null;
  language?: string | null;
  resend?: boolean;
  no_send_request?: boolean;
}

export interface ContractScheduleSendParams extends ContractWorkspaceParams {
  content?: string | null;
  scheduled_at: string;
  language?: string | null;
}

const compactObject = (input: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value != null));

const compactQuery = (query: Record<string, unknown>): Record<string, unknown> | undefined => {
  const entries = Object.entries(query).filter(([, value]) => value != null);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export class Contracts extends APIResource {
  /**
   * List contract templates uploaded to the workspace.
   */
  listTemplates(
    params: ContractWorkspaceParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ContractTemplateListData> {
    return unwrapV2DataPromise(
      this._client.v2Get<ContractTemplateListData>('/public/contracts/templates', {
        query: compactQuery({ ...params }),
        ...options,
      }),
    );
  }

  /**
   * List contracts in the workspace.
   */
  list(
    params: ContractListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ContractListData> {
    return unwrapV2DataPromise(
      this._client.v2Get<ContractListData>('/public/contracts', {
        query: compactQuery({ ...params }),
        ...options,
      }),
    );
  }

  /**
   * Get a contract and its signers.
   */
  retrieve(
    contractID: string,
    params: ContractWorkspaceParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ContractRecordData> {
    return unwrapV2DataPromise(
      this._client.v2Get<ContractRecordData>(path`/public/contracts/${contractID}`, {
        query: compactQuery({ ...params }),
        ...options,
      }),
    );
  }

  /**
   * Get a contract's full workflow state: signers, CC recipients, signature fields, and timeline.
   */
  workflowState(
    contractID: string,
    params: ContractWorkspaceParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ContractWorkflowStateData> {
    return unwrapV2DataPromise(
      this._client.v2Get<ContractWorkflowStateData>(path`/public/contracts/${contractID}/workflow-state`, {
        query: compactQuery({ ...params }),
        ...options,
      }),
    );
  }

  /**
   * Create a draft contract from a workspace contract template.
   */
  createFromTemplate(
    params: ContractCreateFromTemplateParams,
    options?: RequestOptions,
  ): APIPromise<ContractCreateData> {
    const { workspace_id, language, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Post<ContractCreateData>('/public/contracts/create-from-template', {
        query: compactQuery({ workspace_id, language }),
        body: compactObject(body),
        ...options,
      }),
    );
  }

  /**
   * Update a contract's metadata such as name or description.
   */
  updateMetadata(
    contractID: string,
    params: ContractUpdateMetadataParams,
    options?: RequestOptions,
  ): APIPromise<ContractRecordData> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Patch<ContractRecordData>(path`/public/contracts/${contractID}/metadata`, {
        query: compactQuery({ workspace_id }),
        body: compactObject(body),
        ...options,
      }),
    );
  }

  /**
   * Add signers to a contract draft.
   */
  saveSigners(
    contractID: string,
    params: ContractSaveSignersParams,
    options?: RequestOptions,
  ): APIPromise<ContractSaveSignersData> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Post<ContractSaveSignersData>(path`/public/contracts/${contractID}/signers`, {
        query: compactQuery({ workspace_id }),
        body: compactObject(body),
        ...options,
      }),
    );
  }

  /**
   * Replace the complete signer and CC recipient lists for a draft contract.
   */
  replaceRecipients(
    contractID: string,
    params: ContractReplaceRecipientsParams,
    options?: RequestOptions,
  ): APIPromise<ContractReplaceRecipientsData> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Put<ContractReplaceRecipientsData>(path`/public/contracts/${contractID}/recipients`, {
        query: compactQuery({ workspace_id }),
        body: compactObject(body),
        ...options,
      }),
    );
  }

  /**
   * Save explicit signature field placements or auto-place fields on the last page.
   */
  placeFields(
    contractID: string,
    params: ContractPlaceFieldsParams,
    options?: RequestOptions,
  ): APIPromise<ContractSavePlaceFieldsData> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Post<ContractSavePlaceFieldsData>(path`/public/contracts/${contractID}/place-fields`, {
        query: compactQuery({ workspace_id }),
        body: compactObject(body),
        ...options,
      }),
    );
  }

  /**
   * Send or resend a contract signature request to configured signers.
   */
  sendRequest(
    contractID: string,
    params: ContractSendRequestParams,
    options?: RequestOptions,
  ): APIPromise<ContractSendRequestData> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Post<ContractSendRequestData>(path`/public/contracts/${contractID}/send-request`, {
        query: compactQuery({ workspace_id }),
        body: compactObject(body),
        ...options,
      }),
    );
  }

  /**
   * Schedule a contract signature request for future delivery.
   */
  scheduleSend(
    contractID: string,
    params: ContractScheduleSendParams,
    options?: RequestOptions,
  ): APIPromise<ContractScheduleSendData> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Post<ContractScheduleSendData>(path`/public/contracts/${contractID}/schedule-send`, {
        query: compactQuery({ workspace_id }),
        body: compactObject(body),
        ...options,
      }),
    );
  }

  /**
   * Void a sent or scheduled contract signature request.
   */
  void(
    contractID: string,
    params: ContractWorkspaceParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ContractVoidData> {
    return unwrapV2DataPromise(
      this._client.v2Post<ContractVoidData>(path`/public/contracts/${contractID}/void`, {
        query: compactQuery({ ...params }),
        ...options,
      }),
    );
  }

  /**
   * Archive a contract.
   */
  archive(
    contractID: string,
    params: ContractWorkspaceParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ContractArchiveData> {
    return unwrapV2DataPromise(
      this._client.v2Delete<ContractArchiveData>(path`/public/contracts/${contractID}`, {
        query: compactQuery({ ...params }),
        ...options,
      }),
    );
  }
}
