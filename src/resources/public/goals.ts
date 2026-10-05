// Maintained public Goals resource. The methods mirror the V2 public developer contract under
// /v2/public/goals for the token's workspace. Deleting a goal archives it.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { unwrapV2DataPromise } from '../../internal/v2';

export type GoalMetric = 'deals_created' | 'invoice_revenue' | 'custom';
export type GoalAmount = 'before_tax' | 'including_tax';
export type GoalAssignment = 'company' | 'people' | 'company_and_people';
export type GoalUnit = 'count' | 'money' | 'number';
export type GoalPeriod = 'month' | 'quarter' | 'half' | 'year';
export type GoalProgressRange = 'fiscal_year' | 'last_12_months';

/** A saved-view filter expression: `field.field_id` is `standard:<name>` or `custom_property:<uuid>`. */
export interface GoalFilterExpression {
  field: { field_id: string; source?: string | null; label?: string | null };
  operator: string;
  value?: unknown;
  selected_label?: string | null;
}

/** What a goal counts or sums: one object's active records by the month of one of their dates. */
export interface GoalMetricDefinition {
  source: string;
  measure?: string;
  date_field?: string;
  filters?: Array<GoalFilterExpression>;
}

/** A workspace member: `id` is the member id that `assignee_ids` and `owner_id` take. */
export interface GoalOwner {
  id: number;
  label: string;
}

export interface GoalData {
  id: string;
  name: string;
  metric: GoalMetric;
  unit: GoalUnit;
  source: string;
  definition: GoalMetricDefinition;
  amount: GoalAmount | null;
  currency: string | null;
  assignment: GoalAssignment;
  assignees: Array<GoalOwner>;
  version: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/** Decimal amounts arrive as strings. */
export interface GoalPeriodProgress {
  key: GoalPeriod;
  start: string;
  end: string;
  actual: string;
  target: string | null;
  expected: string | null;
}

export interface GoalListItem {
  goal: GoalData;
  this_month: GoalPeriodProgress;
}

export interface GoalListData {
  items: Array<GoalListItem>;
  total: number;
  can_edit: boolean;
  fiscal_year_start_month: number;
  default_currency: string;
}

/** One target per entry of `GoalDetailData.months`; a null owner is the company row. */
export interface GoalTargetRow {
  owner: GoalOwner | null;
  targets: Array<string | null>;
}

export interface GoalDetailData {
  goal: GoalData;
  fiscal_year: number;
  fiscal_year_start_month: number;
  months: Array<string>;
  rows: Array<GoalTargetRow>;
  can_edit: boolean;
}

export interface GoalMonthPoint {
  month: string;
  actual: string | null;
  target: string | null;
}

export interface GoalPersonProgress {
  owner: GoalOwner | null;
  actual: string;
  target: string | null;
  expected: string | null;
}

export interface GoalProgressData {
  goal: GoalData;
  subject: string;
  owner: GoalOwner | null;
  as_of: string;
  fiscal_year: number;
  months: Array<GoalMonthPoint>;
  periods: Array<GoalPeriodProgress>;
  people_period?: GoalPeriod | null;
  people?: Array<GoalPersonProgress>;
  excluded_records?: number;
}

export interface GoalOption {
  key: string;
  label: string;
}

export interface GoalMeasureOption extends GoalOption {
  unit: GoalUnit;
}

export interface GoalSourceOption extends GoalOption {
  measures: Array<GoalMeasureOption>;
  date_fields: Array<GoalOption>;
  default_date_field: string;
  has_owner: boolean;
  filter_object_type: string | null;
}

export interface GoalTemplate extends GoalOption {
  metric: GoalMetric;
  definition: GoalMetricDefinition;
  unit: GoalUnit;
}

export interface GoalMetricCatalog {
  templates: Array<GoalTemplate>;
  sources: Array<GoalSourceOption>;
}

export interface GoalWorkspaceParams {
  /** Query param: internal workspace UUID; defaults to the token's workspace. */
  workspace_id?: string | null;
}

export interface GoalLanguageParams extends GoalWorkspaceParams {
  /** Query param: label language, such as en or ja. */
  language?: string | null;
}

export interface GoalListParams extends GoalLanguageParams {
  page?: number;
  /** Goals per page, up to 100. */
  limit?: number;
}

export type GoalListMetricsParams = GoalLanguageParams;

export interface GoalRetrieveParams extends GoalLanguageParams {
  /** Query param: fiscal year named by the calendar year it ends in; defaults to the current one. */
  fiscal_year?: number | null;
}

export interface GoalCreateParams extends GoalLanguageParams {
  name: string;
  metric: GoalMetric;
  /** Body param: invoice_revenue goals only. */
  amount?: GoalAmount;
  /** Body param: money goals; defaults to the workspace currency. */
  currency?: string | null;
  /** Body param: required for, and only for, custom goals. */
  definition?: GoalMetricDefinition | null;
  assignment?: GoalAssignment;
  /** Body param: workspace member ids; required unless the assignment is company. */
  assignee_ids?: Array<number>;
}

export interface GoalUpdateParams extends GoalLanguageParams {
  expected_version: number;
  name?: string | null;
  amount?: GoalAmount | null;
  definition?: GoalMetricDefinition | null;
  assignment?: GoalAssignment | null;
  /** Body param: the full list of assigned members; people taken off lose their targets. */
  assignee_ids?: Array<number> | null;
}

export type GoalDeleteParams = GoalWorkspaceParams;

export interface GoalTargetCell {
  /** A workspace member id, or null for the company row. */
  owner_id?: number | null;
  /** First day of the month, YYYY-MM-01. */
  month: string;
  /** A null target clears the cell. */
  target?: number | string | null;
}

export interface GoalSetTargetsParams extends GoalLanguageParams {
  /** Query param: fiscal year of the returned targets; defaults to the current one. */
  fiscal_year?: number | null;
  expected_version: number;
  cells: Array<GoalTargetCell>;
}

export interface GoalRetrieveProgressParams extends GoalLanguageParams {
  /** Query param: company, me or owner:<member id>. */
  subject?: string;
  range?: GoalProgressRange;
  fiscal_year?: number | null;
  /** Query param: adds one row per person for the period containing today. */
  people_period?: GoalPeriod | null;
}

// Query parameters the caller left unset are not sent.
const compactQuery = (query: Record<string, unknown>): Record<string, unknown> | undefined => {
  const entries = Object.entries(query).filter(([, value]) => value != null);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export class Goals extends APIResource {
  /**
   * List active goals with this month's actual, target and pace.
   */
  list(params: GoalListParams | null | undefined = {}, options?: RequestOptions): APIPromise<GoalListData> {
    return unwrapV2DataPromise(
      this._client.v2Get<GoalListData>('/public/goals', { query: compactQuery({ ...params }), ...options }),
    );
  }

  /**
   * Create a goal.
   */
  create(params: GoalCreateParams, options?: RequestOptions): APIPromise<GoalData> {
    const { workspace_id, language, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Post<GoalData>('/public/goals', {
        query: compactQuery({ workspace_id, language }),
        body,
        ...options,
      }),
    );
  }

  /**
   * List the goal metric catalog: templates, and per object its measures, date fields and filter
   * object type.
   */
  listMetrics(
    params: GoalListMetricsParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<GoalMetricCatalog> {
    return unwrapV2DataPromise(
      this._client.v2Get<GoalMetricCatalog>('/public/goals/metrics', {
        query: compactQuery({ ...params }),
        ...options,
      }),
    );
  }

  /**
   * Get a goal with its monthly targets for one fiscal year.
   */
  retrieve(
    goalID: string,
    params: GoalRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<GoalDetailData> {
    return unwrapV2DataPromise(
      this._client.v2Get<GoalDetailData>(path`/public/goals/${goalID}`, {
        query: compactQuery({ ...params }),
        ...options,
      }),
    );
  }

  /**
   * Update a goal's name, revenue amount, custom definition or assigned people. Fails with
   * VERSION_CONFLICT when `expected_version` is stale.
   */
  update(goalID: string, params: GoalUpdateParams, options?: RequestOptions): APIPromise<GoalData> {
    const { workspace_id, language, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Patch<GoalData>(path`/public/goals/${goalID}`, {
        query: compactQuery({ workspace_id, language }),
        body,
        ...options,
      }),
    );
  }

  /**
   * Archive a goal and return it.
   */
  delete(
    goalID: string,
    params: GoalDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<GoalData> {
    return unwrapV2DataPromise(
      this._client.v2Delete<GoalData>(path`/public/goals/${goalID}`, {
        query: compactQuery({ ...params }),
        ...options,
      }),
    );
  }

  /**
   * Set or clear monthly targets for the company row and assigned people. Fails with
   * VERSION_CONFLICT when `expected_version` is stale.
   */
  setTargets(
    goalID: string,
    params: GoalSetTargetsParams,
    options?: RequestOptions,
  ): APIPromise<GoalDetailData> {
    const { workspace_id, language, fiscal_year, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Put<GoalDetailData>(path`/public/goals/${goalID}/targets`, {
        query: compactQuery({ fiscal_year, workspace_id, language }),
        body,
        ...options,
      }),
    );
  }

  /**
   * Get a goal's target versus actual by month and for the current periods, optionally per person.
   */
  retrieveProgress(
    goalID: string,
    params: GoalRetrieveProgressParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<GoalProgressData> {
    return unwrapV2DataPromise(
      this._client.v2Get<GoalProgressData>(path`/public/goals/${goalID}/progress`, {
        query: compactQuery({ ...params }),
        ...options,
      }),
    );
  }
}
