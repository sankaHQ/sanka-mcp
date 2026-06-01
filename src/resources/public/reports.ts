// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as ReportsAPI from './reports';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { V2Envelope, unwrapV2Data } from '../../internal/v2';

type V2ReportListData = {
  items?: Array<Record<string, unknown>>;
  total?: number;
  page?: number;
  page_size?: number;
  has_next_page?: boolean;
  message?: string;
};

type V2ReportDetailData = {
  report?: Record<string, unknown>;
  message?: string;
};

type V2ReportMutationData = {
  report_id?: string | null;
  report_number?: string | null;
  message?: string;
};

type V2ReportBulkMutationData = {
  ids?: Array<string>;
  count?: number;
  message?: string;
};

type V2ReportMutationBody = {
  name?: string;
  description?: string | null;
  panel_type?: string;
  data_source_type?: string | null;
  object_sources?: Array<string>;
  breakdown?: string | null;
  x_axis?: string | null;
  ratio?: number | null;
  filter?: Record<string, unknown> | null;
  meta_data?: Record<string, unknown> | null;
  metrics?: Array<Record<string, unknown>>;
};

const readRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
};

const appendSource = (sources: Array<string>, value: unknown): void => {
  if (Array.isArray(value)) {
    for (const item of value) appendSource(sources, item);
    return;
  }
  const source = readString(value);
  if (!source) return;
  for (const token of source.split(',')) {
    const normalized = token.trim();
    if (normalized && !sources.includes(normalized)) sources.push(normalized);
  }
};

const v2ReportMutationBody = (
  body: ReportCreateParams | ReportUpdateParams,
  mode: 'create' | 'update',
): V2ReportMutationBody => {
  const payload = body as Record<string, unknown>;
  const metadata = readRecord(payload['reportMetadata'] ?? payload['report_metadata']) ?? {};
  const panels = Array.isArray(payload['panels']) ? payload['panels'] : [];
  const panel = readRecord(panels[0]) ?? {};
  const reportType = readRecord(metadata['reportType'] ?? metadata['report_type']);
  const sources: Array<string> = [];
  appendSource(sources, reportType?.['type']);
  appendSource(sources, panel['dataSources'] ?? panel['data_sources']);
  appendSource(sources, panel['dataSource'] ?? panel['data_source']);
  appendSource(sources, panel['typeObjects'] ?? panel['type_objects']);

  const metrics =
    Array.isArray(panel['metrics']) ?
      (panel['metrics'] as Array<unknown>)
        .map((entry) => readRecord(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
        .map((metric) => ({
          ...(readString(metric['role']) ? { role: readString(metric['role']) } : undefined),
          ...(readString(metric['name']) ? { name: readString(metric['name']) } : undefined),
          metric: readString(metric['metric']) ?? 'number_orders',
          ...(readString(metric['metricType'] ?? metric['metric_type']) ?
            { metric_type: readString(metric['metricType'] ?? metric['metric_type']) }
          : undefined),
          ...(readNumber(metric['order']) !== undefined ? { order: readNumber(metric['order']) } : undefined),
          ...(readRecord(metric['filter']) ? { filter: readRecord(metric['filter']) } : undefined),
          ...(readString(metric['dataSource'] ?? metric['data_source']) ?
            { data_source: readString(metric['dataSource'] ?? metric['data_source']) }
          : undefined),
          ...(readString(metric['sort']) ? { sort: readString(metric['sort']) } : undefined),
          ...(readRecord(metric['metaData'] ?? metric['meta_data']) ?
            { meta_data: readRecord(metric['metaData'] ?? metric['meta_data']) }
          : undefined),
          ...(readString(metric['rawSql'] ?? metric['raw_sql']) ?
            { raw_sql: readString(metric['rawSql'] ?? metric['raw_sql']) }
          : undefined),
          ...(readString(metric['displayResult'] ?? metric['display_result']) ?
            { display_result: readString(metric['displayResult'] ?? metric['display_result']) }
          : undefined),
        }))
    : undefined;

  const result: V2ReportMutationBody = {};
  const name = readString(metadata['name']) ?? readString(panel['name']);
  if (name) {
    result.name = name;
  } else if (mode === 'create') {
    throw new Error('V2 public report creation requires reportMetadata.name or panel.name.');
  }
  const description = readString(metadata['description']) ?? readString(panel['description']);
  if (description) result.description = description;
  const panelType =
    readString(panel['panelType'] ?? panel['panel_type']) ?? readString(metadata['reportFormat']);
  if (panelType) {
    result.panel_type = panelType;
  } else if (mode === 'create') {
    result.panel_type = 'chart';
  }
  const dataSourceType = readString(panel['dataSourceType'] ?? panel['data_source_type']);
  if (dataSourceType) {
    result.data_source_type = dataSourceType;
  } else if (mode === 'create') {
    result.data_source_type = 'app';
  }
  if (sources.length > 0) result.object_sources = sources;
  const breakdown = readString(panel['breakdown']);
  if (breakdown) result.breakdown = breakdown;
  const xAxis = readString(panel['xAxis'] ?? panel['x_axis']);
  if (xAxis) result.x_axis = xAxis;
  const ratio = readNumber(panel['ratio']);
  if (ratio !== undefined) result.ratio = ratio;
  const filter =
    readRecord(panel['filter']) ?? readRecord(metadata['reportFilters'] ?? metadata['report_filters']);
  if (filter) result.filter = filter;
  const metaData = readRecord(panel['metaData'] ?? panel['meta_data']);
  if (metaData) result.meta_data = metaData;
  if (metrics) result.metrics = metrics;
  return result;
};

const unwrapV2ReportMutation = (
  promise: APIPromise<V2Envelope<V2ReportMutationData>>,
): APIPromise<CreateReport> =>
  promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    return {
      ok: true,
      status: data.message ?? 'OK',
      ctx_id: envelope.meta.ctx_id ?? null,
      report_id: data.report_id ?? null,
      report_extended_metadata: data.report_number ? { report_number: data.report_number } : null,
      report_metadata: null,
    };
  });

const unwrapV2ReportDelete = (
  promise: APIPromise<V2Envelope<V2ReportBulkMutationData>>,
): APIPromise<ReportDeleteResponse> =>
  promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    return {
      ok: true,
      status: data.message ?? 'OK',
      ctx_id: envelope.meta.ctx_id ?? null,
      report_id: data.ids?.[0] ?? null,
    };
  });

const unwrapV2ReportList = (
  promise: APIPromise<V2Envelope<V2ReportListData>>,
): APIPromise<ReportListResponse> =>
  promise._thenUnwrap((envelope) => {
    const data = unwrapV2Data(envelope);
    return (Array.isArray(data.items) ? data.items : []) as unknown as ReportListResponse;
  });

const unwrapV2ReportDetail = (
  promise: APIPromise<V2Envelope<V2ReportDetailData>>,
): APIPromise<ReportRetrieveResponse> =>
  promise._thenUnwrap(
    (envelope) => (unwrapV2Data(envelope).report ?? {}) as unknown as ReportRetrieveResponse,
  );

export class Reports extends APIResource {
  /**
   * Create Report
   */
  create(body: ReportCreateParams, options?: RequestOptions): APIPromise<CreateReport> {
    return unwrapV2ReportMutation(
      this._client.v2Post<V2ReportMutationData>('/public/reports', {
        body: v2ReportMutationBody(body, 'create'),
        ...options,
      }),
    );
  }

  /**
   * Get Report
   */
  retrieve(
    reportID: string,
    query: ReportRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ReportRetrieveResponse> {
    void query;
    return unwrapV2ReportDetail(
      this._client.v2Get<V2ReportDetailData>(path`/public/reports/${reportID}`, options),
    );
  }

  /**
   * Update Report
   */
  update(reportID: string, params: ReportUpdateParams, options?: RequestOptions): APIPromise<CreateReport> {
    const { workspace_id: _workspaceID, ...body } = params;
    void _workspaceID;
    return unwrapV2ReportMutation(
      this._client.v2Put<V2ReportMutationData>(path`/public/reports/${reportID}`, {
        body: v2ReportMutationBody(body, 'update'),
        ...options,
      }),
    );
  }

  /**
   * List Reports
   */
  list(
    query: ReportListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ReportListResponse> {
    const { workspace_id: _workspaceID, ...v2Query } = query ?? {};
    void _workspaceID;
    return unwrapV2ReportList(
      this._client.v2Get<V2ReportListData>('/public/reports', { query: v2Query, ...options }),
    );
  }

  /**
   * Delete Report
   */
  delete(
    reportID: string,
    params: ReportDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<ReportDeleteResponse> {
    void params;
    return unwrapV2ReportDelete(
      this._client.v2Delete<V2ReportBulkMutationData>(path`/public/reports/${reportID}`, options),
    );
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
  page?: number | null;

  limit?: number | null;

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
