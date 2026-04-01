// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as ReportsAPI from './reports';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';

export class Reports extends APIResource {
  /**
   * Create Report
   */
  create(body: ReportCreateParams, options?: RequestOptions): APIPromise<CreateReport> {
    return this._client.post('/v1/public/reports', { body, ...options });
  }

  /**
   * Get Report
   */
  retrieve(
    reportID: string,
    query: ReportRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ReportRetrieveResponse> {
    return this._client.get(path`/v1/public/reports/${reportID}`, { query, ...options });
  }

  /**
   * Update Report
   */
  update(reportID: string, params: ReportUpdateParams, options?: RequestOptions): APIPromise<CreateReport> {
    const { workspace_id, ...body } = params;
    return this._client.put(path`/v1/public/reports/${reportID}`, {
      query: { workspace_id },
      body,
      ...options,
    });
  }

  /**
   * List Reports
   */
  list(
    query: ReportListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ReportListResponse> {
    return this._client.get('/v1/public/reports', { query, ...options });
  }

  /**
   * Delete Report
   */
  delete(
    reportID: string,
    params: ReportDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ReportDeleteResponse> {
    const { workspace_id } = params ?? {};
    return this._client.delete(path`/v1/public/reports/${reportID}`, { query: { workspace_id }, ...options });
  }
}

export interface CreateReport {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  report_extended_metadata?: { [key: string]: unknown } | null;

  report_id?: string | null;

  report_metadata?: { [key: string]: unknown } | null;
}

export interface ReportFilters {
  filters?: Array<ReportFilters.Filter>;
}

export namespace ReportFilters {
  export interface Filter {
    filter_operator: string;

    filter_select: string;

    filter_input?: Array<Filter.FilterInput>;

    filter_source?: string | null;

    filter_type?: string | null;
  }

  export namespace Filter {
    export interface FilterInput {
      value: unknown;
    }
  }
}

export interface ReportPanel {
  breakdown?: string | null;

  dataSource?: string | null;

  dataSources?: Array<string>;

  dataSourceType?: string | null;

  description?: string | null;

  filter?: { [key: string]: unknown } | null;

  heightPx?: number | null;

  metaData?: { [key: string]: unknown } | null;

  metrics?: Array<ReportPanel.Metric>;

  name?: string | null;

  order?: number | null;

  panelType?: string | null;

  ratio?: number | null;

  typeObjects?: Array<string>;

  widthUnits?: number | null;
}

export namespace ReportPanel {
  export interface Metric {
    metric: string;

    dataSource?: string | null;

    displayResult?: string | null;

    filter?: { [key: string]: unknown } | null;

    metaData?: { [key: string]: unknown } | null;

    metricType?: string | null;

    name?: string | null;

    order?: number | null;

    rawSql?: string | null;

    role?: string | null;

    sort?: string | null;
  }
}

export interface ReportType {
  type: string;
}

export interface ReportRetrieveResponse {
  id: string;

  created_at: string;

  updated_at: string;

  description?: string | null;

  name?: string | null;

  panel_count?: number;

  panels?: Array<ReportRetrieveResponse.Panel>;

  report_type?: string | null;
}

export namespace ReportRetrieveResponse {
  export interface Panel {
    id: string;

    created_at: string;

    order: number;

    updated_at: string;

    breakdown?: string | null;

    data_source?: string | null;

    data_source_type?: string | null;

    description?: string | null;

    filter?: { [key: string]: unknown } | null;

    height_px?: number;

    meta_data?: { [key: string]: unknown } | null;

    metrics?: Array<Panel.Metric>;

    name?: string | null;

    panel_type?: string | null;

    ratio?: number;

    type_objects?: string | null;

    width_units?: number;
  }

  export namespace Panel {
    export interface Metric {
      id: string;

      data_source?: string | null;

      filter?: { [key: string]: unknown } | null;

      meta_data?: { [key: string]: unknown } | null;

      metric?: string | null;

      metric_type?: string | null;

      name?: string | null;

      order?: number;

      role?: string | null;

      sort?: string | null;
    }
  }
}

export type ReportListResponse = Array<ReportListResponse.ReportListResponseItem>;

export namespace ReportListResponse {
  export interface ReportListResponseItem {
    id: string;

    created_at: string;

    updated_at: string;

    description?: string | null;

    name?: string | null;

    panel_count?: number;

    report_type?: string | null;
  }
}

export interface ReportDeleteResponse {
  ok: boolean;

  status: string;

  ctx_id?: string | null;

  report_id?: string | null;
}

export interface ReportCreateParams {
  reportMetadata: ReportCreateParams.ReportMetadata;

  createDefaultPanel?: boolean;

  panels?: Array<ReportPanel>;
}

export namespace ReportCreateParams {
  export interface ReportMetadata {
    name: string;

    reportType: ReportsAPI.ReportType;

    description?: string | null;

    detailColumns?: Array<string>;

    groupingsAcross?: Array<string>;

    groupingsDown?: Array<string>;

    reportFilters?: ReportsAPI.ReportFilters | null;

    reportFormat?: string | null;
  }
}

export interface ReportRetrieveParams {
  workspace_id?: string | null;
}

export interface ReportUpdateParams {
  /**
   * Query param
   */
  workspace_id?: string | null;

  /**
   * Body param
   */
  createDefaultPanel?: boolean;

  /**
   * Body param
   */
  panels?: Array<ReportPanel> | null;

  /**
   * Body param
   */
  reportMetadata?: ReportUpdateParams.ReportMetadata | null;
}

export namespace ReportUpdateParams {
  export interface ReportMetadata {
    description?: string | null;

    detailColumns?: Array<string> | null;

    groupingsAcross?: Array<string> | null;

    groupingsDown?: Array<string> | null;

    name?: string | null;

    reportFilters?: ReportsAPI.ReportFilters | null;

    reportFormat?: string | null;

    reportType?: ReportsAPI.ReportType | null;
  }
}

export interface ReportListParams {
  workspace_id?: string | null;
}

export interface ReportDeleteParams {
  workspace_id?: string | null;
}

export declare namespace Reports {
  export {
    type CreateReport as CreateReport,
    type ReportFilters as ReportFilters,
    type ReportPanel as ReportPanel,
    type ReportType as ReportType,
    type ReportRetrieveResponse as ReportRetrieveResponse,
    type ReportListResponse as ReportListResponse,
    type ReportDeleteResponse as ReportDeleteResponse,
    type ReportCreateParams as ReportCreateParams,
    type ReportRetrieveParams as ReportRetrieveParams,
    type ReportUpdateParams as ReportUpdateParams,
    type ReportListParams as ReportListParams,
    type ReportDeleteParams as ReportDeleteParams,
  };
}
