// Maintained public talent resources. These methods mirror the externally
// supported V2 API contract and intentionally expose lifecycle actions instead
// of permanent record deletion.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { V2Envelope, unwrapV2Data } from '../../internal/v2';

export type PublicTalentUsageStatus = 'active' | 'archived';
export type PublicTalentPlanningStatus = 'draft' | 'approved' | 'cancelled';
export type PublicTalentStaffingPhase =
  | 'planned'
  | 'ready_to_hire'
  | 'recruiting'
  | 'interviewing'
  | 'offer'
  | 'filled';

export interface PublicTalentRecord {
  id: string;
  record_id: string;
  object_type: string;
  custom_object_id?: string | null;
  status?: string | null;
  usage_status?: string | null;
  properties: Record<string, unknown | null>;
  display_properties: Record<string, unknown>;
}

export interface PublicTalentRecordListResponse {
  object_type: string;
  view: Record<string, unknown>;
  columns: Array<string>;
  column_labels: Record<string, string>;
  items: Array<PublicTalentRecord>;
  page: number;
  page_size: number;
  total: number;
  next_cursor?: string | null;
  subtotals: Array<Record<string, unknown>>;
  meta: Record<string, unknown>;
  ctx_id?: string | null;
}

export interface PublicTalentRecordListParams {
  workspace_id?: string | null;
  search?: string | null;
  language?: string | null;
  status?: string | null;
  usage_status?: PublicTalentUsageStatus | null;
  filters?: string | null;
  page?: number | null;
  limit?: number | null;
  sort?: string | null;
  created_at_from?: string | null;
  created_at_to?: string | null;
  updated_at_from?: string | null;
  updated_at_to?: string | null;
  'Accept-Language'?: string | null;
  'X-Language'?: string | null;
}

export interface PublicTalentRecordRetrieveParams {
  workspace_id?: string | null;
  'Accept-Language'?: string | null;
  'X-Language'?: string | null;
}

export interface PublicTalentRecordCreateParams extends PublicTalentRecordRetrieveParams {
  view_id?: string | null;
  form_view_id?: string | null;
  cost_line_items?: Array<unknown> | null;
  line_items?: Array<unknown> | null;
  properties: Record<string, unknown | null>;
}

export interface PublicTalentRecordUpdateParams extends PublicTalentRecordRetrieveParams {
  view_id?: string | null;
  form_view_id?: string | null;
  associations?: Array<Record<string, unknown>> | null;
  cost_line_items?: Array<unknown> | null;
  files?: Array<Record<string, unknown>> | null;
  line_items?: Array<unknown> | null;
  properties?: Record<string, unknown | null>;
}

const buildTalentHeaders = (
  acceptLanguage: string | null | undefined,
  xLanguage: string | null | undefined,
  options?: RequestOptions,
) =>
  buildHeaders([
    {
      ...(acceptLanguage != null ? { 'Accept-Language': acceptLanguage } : undefined),
      ...(xLanguage != null ? { 'X-Language': xLanguage } : undefined),
    },
    options?.headers,
  ]);

const unwrapTalentData = <T>(promise: APIPromise<V2Envelope<T>>): APIPromise<T> =>
  promise._thenUnwrap((envelope) => unwrapV2Data(envelope));

abstract class RecruitingRecordsResource extends APIResource {
  protected abstract readonly resourcePath: string;

  list(
    params: PublicTalentRecordListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicTalentRecordListResponse> {
    const { 'Accept-Language': acceptLanguage, 'X-Language': xLanguage, ...query } = params ?? {};
    return unwrapTalentData(
      this._client.v2Get<PublicTalentRecordListResponse>(this.resourcePath, {
        query,
        ...options,
        headers: buildTalentHeaders(acceptLanguage, xLanguage, options),
      }),
    );
  }

  retrieve(
    recordRef: string,
    params: PublicTalentRecordRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicTalentRecord> {
    const { 'Accept-Language': acceptLanguage, 'X-Language': xLanguage, workspace_id } = params ?? {};
    return unwrapTalentData(
      this._client.v2Get<PublicTalentRecord>(`${this.resourcePath}/${encodeURIComponent(recordRef)}`, {
        query: workspace_id != null ? { workspace_id } : undefined,
        ...options,
        headers: buildTalentHeaders(acceptLanguage, xLanguage, options),
      }),
    );
  }

  create(params: PublicTalentRecordCreateParams, options?: RequestOptions): APIPromise<PublicTalentRecord> {
    const { 'Accept-Language': acceptLanguage, 'X-Language': xLanguage, workspace_id, ...body } = params;
    return unwrapTalentData(
      this._client.v2Post<PublicTalentRecord>(this.resourcePath, {
        query: workspace_id != null ? { workspace_id } : undefined,
        body,
        ...options,
        headers: buildTalentHeaders(acceptLanguage, xLanguage, options),
      }),
    );
  }

  update(
    recordRef: string,
    params: PublicTalentRecordUpdateParams,
    options?: RequestOptions,
  ): APIPromise<PublicTalentRecord> {
    const { 'Accept-Language': acceptLanguage, 'X-Language': xLanguage, workspace_id, ...body } = params;
    return unwrapTalentData(
      this._client.v2Patch<PublicTalentRecord>(`${this.resourcePath}/${encodeURIComponent(recordRef)}`, {
        query: workspace_id != null ? { workspace_id } : undefined,
        body,
        ...options,
        headers: buildTalentHeaders(acceptLanguage, xLanguage, options),
      }),
    );
  }

  archive(
    recordRef: string,
    params: PublicTalentRecordRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicTalentRecord> {
    return this.lifecycle(recordRef, 'archive', params, options);
  }

  activate(
    recordRef: string,
    params: PublicTalentRecordRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PublicTalentRecord> {
    return this.lifecycle(recordRef, 'activate', params, options);
  }

  private lifecycle(
    recordRef: string,
    action: 'archive' | 'activate',
    params: PublicTalentRecordRetrieveParams | null | undefined,
    options?: RequestOptions,
  ): APIPromise<PublicTalentRecord> {
    const { 'Accept-Language': acceptLanguage, 'X-Language': xLanguage, workspace_id } = params ?? {};
    return unwrapTalentData(
      this._client.v2Post<PublicTalentRecord>(
        `${this.resourcePath}/${encodeURIComponent(recordRef)}/${action}`,
        {
          query: workspace_id != null ? { workspace_id } : undefined,
          ...options,
          headers: buildTalentHeaders(acceptLanguage, xLanguage, options),
        },
      ),
    );
  }
}

export class JobPostings extends RecruitingRecordsResource {
  protected readonly resourcePath = '/public/job-postings';
}

export class Applicants extends RecruitingRecordsResource {
  protected readonly resourcePath = '/public/applicants';
}

export class Interviews extends RecruitingRecordsResource {
  protected readonly resourcePath = '/public/interviews';
}

export interface PositionOccupantData {
  employee_id?: string | null;
  display_name?: string | null;
  profile_photo_url?: string | null;
  redacted: boolean;
}

export interface PositionJobData {
  id: string;
  display_id: number;
  name: string;
  status: string;
  applicant_count: number;
  interview_count: number;
}

export interface WorkforcePositionData {
  id: string;
  display_id: number;
  parent_position_id?: string | null;
  title: string;
  department?: string | null;
  team?: string | null;
  level?: string | null;
  location?: string | null;
  employment_type?: string | null;
  fte: number;
  target_start_date?: string | null;
  planning_status: PublicTalentPlanningStatus;
  staffing_phase: PublicTalentStaffingPhase;
  version: number;
  occupant?: PositionOccupantData | null;
  job?: PositionJobData | null;
}

export interface WorkforceOrganizationData {
  can_manage_occupants: boolean;
  nodes: Array<WorkforcePositionData>;
  unassigned_jobs: Array<Record<string, unknown>>;
  summary: Record<string, number>;
}

export interface WorkforceWorkspaceParams {
  workspace_id?: string | null;
}

export interface WorkforcePositionCreateParams extends WorkforceWorkspaceParams {
  title: string;
  parent_position_id?: string | null;
  department?: string | null;
  team?: string | null;
  level?: string | null;
  location?: string | null;
  employment_type?: string | null;
  fte?: number;
  target_start_date?: string | null;
  planning_status?: PublicTalentPlanningStatus;
  job_id?: string | null;
  employee_id?: string | null;
}

export interface WorkforcePositionUpdateParams extends WorkforceWorkspaceParams {
  expected_version: number;
  title?: string | null;
  parent_position_id?: string | null;
  department?: string | null;
  team?: string | null;
  level?: string | null;
  location?: string | null;
  employment_type?: string | null;
  fte?: number | null;
  target_start_date?: string | null;
  planning_status?: PublicTalentPlanningStatus | null;
  job_id?: string | null;
  employee_id?: string | null;
}

export interface WorkforcePositionJobParams extends WorkforceWorkspaceParams {
  expected_version: number;
  job_id: string | null;
}

export interface WorkforcePositionOccupantParams extends WorkforceWorkspaceParams {
  expected_version: number;
  employee_id: string | null;
  source_applicant_id?: string | null;
}

export class WorkforcePlanning extends APIResource {
  retrieveOrganization(
    params: WorkforceWorkspaceParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<WorkforceOrganizationData> {
    return unwrapTalentData(
      this._client.v2Get<WorkforceOrganizationData>('/public/workforce-planning/organization', {
        query: params?.workspace_id != null ? { workspace_id: params.workspace_id } : undefined,
        ...options,
      }),
    );
  }

  createPosition(
    params: WorkforcePositionCreateParams,
    options?: RequestOptions,
  ): APIPromise<WorkforcePositionData> {
    const { workspace_id, ...body } = params;
    return unwrapTalentData(
      this._client.v2Post<WorkforcePositionData>('/public/workforce-planning/positions', {
        query: workspace_id != null ? { workspace_id } : undefined,
        body,
        ...options,
      }),
    );
  }

  updatePosition(
    positionID: string,
    params: WorkforcePositionUpdateParams,
    options?: RequestOptions,
  ): APIPromise<WorkforcePositionData> {
    const { workspace_id, ...body } = params;
    return unwrapTalentData(
      this._client.v2Patch<WorkforcePositionData>(path`/public/workforce-planning/positions/${positionID}`, {
        query: workspace_id != null ? { workspace_id } : undefined,
        body,
        ...options,
      }),
    );
  }

  setPositionJob(
    positionID: string,
    params: WorkforcePositionJobParams,
    options?: RequestOptions,
  ): APIPromise<WorkforcePositionData> {
    const { workspace_id, ...body } = params;
    return unwrapTalentData(
      this._client.v2Put<WorkforcePositionData>(
        path`/public/workforce-planning/positions/${positionID}/job`,
        {
          query: workspace_id != null ? { workspace_id } : undefined,
          body,
          ...options,
        },
      ),
    );
  }

  setPositionOccupant(
    positionID: string,
    params: WorkforcePositionOccupantParams,
    options?: RequestOptions,
  ): APIPromise<WorkforcePositionData> {
    const { workspace_id, ...body } = params;
    return unwrapTalentData(
      this._client.v2Put<WorkforcePositionData>(
        path`/public/workforce-planning/positions/${positionID}/occupant`,
        {
          query: workspace_id != null ? { workspace_id } : undefined,
          body,
          ...options,
        },
      ),
    );
  }
}
