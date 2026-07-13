// Hand-written public Ferry diagram resource backed by the V2 public API.

import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { RequestOptions } from '../../internal/request-options';
import { path } from '../../internal/utils/path';
import { compactProperties } from '../../internal/v2-object-records';
import { unwrapV2DataPromise } from '../../internal/v2';

export class FerryDiagrams extends APIResource {
  /** List Ferry diagrams in the current workspace. */
  list(
    params: FerryDiagramListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FerryDiagramListData> {
    return unwrapV2DataPromise(
      this._client.v2Get<FerryDiagramListData>('/public/ferry/diagrams', {
        query: params ?? {},
        ...options,
      }),
    );
  }

  /** Get a Ferry diagram by UUID. */
  retrieve(
    diagramID: string,
    params: FerryDiagramRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FerryDiagram> {
    return unwrapV2DataPromise(
      this._client.v2Get<FerryDiagram>(path`/public/ferry/diagrams/${diagramID}`, {
        query: params ?? {},
        ...options,
      }),
    );
  }

  /** Create a Ferry diagram. */
  create(params: FerryDiagramCreateParams, options?: RequestOptions): APIPromise<FerryDiagram> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Post<FerryDiagram>('/public/ferry/diagrams', {
        query: workspace_id ? { workspace_id } : undefined,
        body: compactProperties(body as unknown as Record<string, unknown>),
        ...options,
      }),
    );
  }

  /** Replace a Ferry diagram document using optimistic concurrency. */
  update(
    diagramID: string,
    params: FerryDiagramUpdateParams,
    options?: RequestOptions,
  ): APIPromise<FerryDiagram> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Put<FerryDiagram>(path`/public/ferry/diagrams/${diagramID}`, {
        query: workspace_id ? { workspace_id } : undefined,
        body: compactProperties(body as unknown as Record<string, unknown>),
        ...options,
      }),
    );
  }

  /** Permanently delete a Ferry diagram. */
  delete(
    diagramID: string,
    params: FerryDiagramDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FerryDiagramDeleteData> {
    return unwrapV2DataPromise(
      this._client.v2Delete<FerryDiagramDeleteData>(path`/public/ferry/diagrams/${diagramID}`, {
        query: params ?? {},
        ...options,
      }),
    );
  }
}

export type FerryDiagramNodeType = 'objectTable' | 'process' | 'note';
export type FerryDiagramColor = 'default' | 'brand' | 'success' | 'warning' | 'danger';
export type FerryDiagramEdgeType = 'default' | 'smoothstep';

export interface FerryDiagramPosition {
  x: number;
  y: number;
}

export interface FerryDiagramViewport extends FerryDiagramPosition {
  zoom: number;
}

export interface FerryDiagramNodeData {
  label: string;
  description?: string;
  fields?: Array<string>;
  moduleName?: string | null;
  objectKey?: string | null;
  objectSlug?: string | null;
  color?: FerryDiagramColor;
}

export interface FerryDiagramNode {
  id: string;
  type: FerryDiagramNodeType;
  position: FerryDiagramPosition;
  data: FerryDiagramNodeData;
}

export interface FerryDiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: FerryDiagramEdgeType;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface FerryDiagramDocument {
  name: string;
  description?: string;
  nodes?: Array<FerryDiagramNode>;
  edges?: Array<FerryDiagramEdge>;
  viewport?: FerryDiagramViewport;
}

export interface FerryDiagram extends FerryDiagramDocument {
  id: string;
  workspaceId: string;
  revision: number;
  createdById?: number | null;
  updatedById?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface FerryDiagramSummary {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  edgeCount: number;
  revision: number;
  createdById?: number | null;
  updatedById?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface FerryDiagramListData {
  diagrams: Array<FerryDiagramSummary>;
  count: number;
}

export interface FerryDiagramDeleteData {
  id: string;
  deleted: boolean;
}

export interface FerryDiagramListParams {
  workspace_id?: string | null;
}

export interface FerryDiagramRetrieveParams extends FerryDiagramListParams {}
export interface FerryDiagramDeleteParams extends FerryDiagramListParams {}

export interface FerryDiagramCreateParams extends FerryDiagramDocument {
  workspace_id?: string | null;
}

export interface FerryDiagramUpdateParams extends FerryDiagramDocument {
  revision: number;
  workspace_id?: string | null;
}

export declare namespace FerryDiagrams {
  export {
    type FerryDiagramNodeType as FerryDiagramNodeType,
    type FerryDiagramColor as FerryDiagramColor,
    type FerryDiagramEdgeType as FerryDiagramEdgeType,
    type FerryDiagramPosition as FerryDiagramPosition,
    type FerryDiagramViewport as FerryDiagramViewport,
    type FerryDiagramNodeData as FerryDiagramNodeData,
    type FerryDiagramNode as FerryDiagramNode,
    type FerryDiagramEdge as FerryDiagramEdge,
    type FerryDiagramDocument as FerryDiagramDocument,
    type FerryDiagram as FerryDiagram,
    type FerryDiagramSummary as FerryDiagramSummary,
    type FerryDiagramListData as FerryDiagramListData,
    type FerryDiagramDeleteData as FerryDiagramDeleteData,
    type FerryDiagramListParams as FerryDiagramListParams,
    type FerryDiagramRetrieveParams as FerryDiagramRetrieveParams,
    type FerryDiagramCreateParams as FerryDiagramCreateParams,
    type FerryDiagramUpdateParams as FerryDiagramUpdateParams,
    type FerryDiagramDeleteParams as FerryDiagramDeleteParams,
  };
}
