// Hand-written public Ferry Programs resource backed by the V2 public API.

import { APIPromise } from '../../core/api-promise';
import { APIResource } from '../../core/resource';
import { RequestOptions } from '../../internal/request-options';
import { compactProperties } from '../../internal/v2-object-records';
import { unwrapV2DataPromise } from '../../internal/v2';
import { path } from '../../internal/utils/path';

export class FerryPrograms extends APIResource {
  docs: FerryProgramDocs = new FerryProgramDocs(this._client);
  todos: FerryProgramTodos = new FerryProgramTodos(this._client);

  /** List Ferry migration programs in the current workspace. */
  list(
    params: FerryProgramListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FerryProgramListData> {
    return unwrapV2DataPromise(
      this._client.v2Get<FerryProgramListData>('/public/ferry/programs', {
        query: params ?? {},
        ...options,
      }),
    );
  }

  /** Get one Ferry migration program, including its current Todos. */
  retrieve(
    programID: string,
    params: FerryProgramRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FerryProgram> {
    return unwrapV2DataPromise(
      this._client.v2Get<FerryProgram>(path`/public/ferry/programs/${programID}`, {
        query: params ?? {},
        ...options,
      }),
    );
  }
}

export class FerryProgramDocs extends APIResource {
  /** List Docs (meeting updates) attached to a Ferry program. */
  list(
    programID: string,
    params: FerryProgramDocListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FerryProgramDocListData> {
    return unwrapV2DataPromise(
      this._client.v2Get<FerryProgramDocListData>(path`/public/ferry/programs/${programID}/meetings`, {
        query: params ?? {},
        ...options,
      }),
    );
  }

  /** Create a Doc (meeting update) in a Ferry program. */
  create(
    programID: string,
    params: FerryProgramDocCreateParams,
    options?: RequestOptions,
  ): APIPromise<FerryProgramDoc> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Post<FerryProgramDoc>(path`/public/ferry/programs/${programID}/meetings`, {
        query: workspace_id ? { workspace_id } : undefined,
        body: compactProperties(body as unknown as Record<string, unknown>),
        ...options,
      }),
    );
  }

  /** Update a Ferry program Doc. */
  update(
    programID: string,
    docID: string,
    params: FerryProgramDocUpdateParams,
    options?: RequestOptions,
  ): APIPromise<FerryProgramDoc> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Patch<FerryProgramDoc>(path`/public/ferry/programs/${programID}/meetings/${docID}`, {
        query: workspace_id ? { workspace_id } : undefined,
        body: compactProperties(body as unknown as Record<string, unknown>),
        ...options,
      }),
    );
  }
}

export class FerryProgramTodos extends APIResource {
  /** Create a Todo in a Ferry program. */
  create(
    programID: string,
    params: FerryProgramTodoCreateParams,
    options?: RequestOptions,
  ): APIPromise<FerryProgram> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Post<FerryProgram>(path`/public/ferry/programs/${programID}/todos`, {
        query: workspace_id ? { workspace_id } : undefined,
        body: compactProperties(body as unknown as Record<string, unknown>),
        ...options,
      }),
    );
  }

  /** Create or update up to 100 Ferry program Todos by id or sourceRef. */
  batchUpsert(
    programID: string,
    params: FerryProgramTodoBatchUpsertParams,
    options?: RequestOptions,
  ): APIPromise<FerryProgramTodoBatchUpsertData> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Post<FerryProgramTodoBatchUpsertData>(
        path`/public/ferry/programs/${programID}/todos/batch-upsert`,
        {
          query: workspace_id ? { workspace_id } : undefined,
          body: compactProperties(body as unknown as Record<string, unknown>),
          ...options,
        },
      ),
    );
  }

  /** Update one Ferry program Todo. */
  update(
    programID: string,
    todoID: string,
    params: FerryProgramTodoUpdateParams,
    options?: RequestOptions,
  ): APIPromise<FerryProgram> {
    const { workspace_id, ...body } = params;
    return unwrapV2DataPromise(
      this._client.v2Patch<FerryProgram>(path`/public/ferry/programs/${programID}/todos/${todoID}`, {
        query: workspace_id ? { workspace_id } : undefined,
        body: compactProperties(body as unknown as Record<string, unknown>),
        ...options,
      }),
    );
  }

  /** Delete one Ferry program Todo. */
  delete(
    programID: string,
    todoID: string,
    params: FerryProgramTodoDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<FerryProgram> {
    return unwrapV2DataPromise(
      this._client.v2Delete<FerryProgram>(path`/public/ferry/programs/${programID}/todos/${todoID}`, {
        query: params ?? {},
        ...options,
      }),
    );
  }
}

export type FerryProgramStatus = 'draft' | 'active' | 'ready' | 'completed' | 'archived';
export type FerryProgramPlan = 'self_serve' | 'sakura_led' | 'expert_led';
export type FerryProgramTodoStatus = 'not_started' | 'in_progress' | 'blocked' | 'completed';
export type FerryProgramTodoPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface FerryProgramEndpoint {
  id: string;
  kind: string;
  label: string;
  role: 'source' | 'destination';
  labelJa?: string | null;
  integrationSlug?: string | null;
  channelId?: string | null;
  sourceType?: string | null;
  objectTypes?: Array<string>;
  metadata?: Record<string, unknown>;
}

export interface FerryProgramPhase {
  id: string;
  name: string;
  nameJa?: string | null;
  sortOrder: number;
}

export interface FerryProgramTodo {
  id: string;
  title: string;
  category: string;
  required: boolean;
  status: FerryProgramTodoStatus;
  priority: FerryProgramTodoPriority;
  titleJa?: string | null;
  description?: string;
  descriptionJa?: string | null;
  notes?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  sourceRef?: string | null;
  phaseId?: string | null;
  parentTodoId?: string | null;
  sortOrder?: number | null;
  archivedAt?: string | null;
}

export interface FerryProgram {
  id: string;
  workspaceId: string;
  templateSlug: string;
  status: FerryProgramStatus;
  plan: FerryProgramPlan;
  name: string;
  description: string;
  updatesMarkdown: string;
  sources: Array<FerryProgramEndpoint>;
  destinations: Array<FerryProgramEndpoint>;
  todos: Array<FerryProgramTodo>;
  taskPhases: Array<FerryProgramPhase>;
  linkedRunIds: Array<string>;
  planChangeLocked?: boolean;
  paymentState?: string;
  billingCurrency?: string;
  recordCount?: number | null;
  listPrice?: number | null;
  quotedPrice?: number | null;
  feeWaived?: boolean;
  feeWaiverReason?: string;
  expertUserId?: number | null;
  expertReviewThreadId?: string | null;
  expertSettings?: Record<string, unknown>;
  entitlements?: Record<string, unknown>;
  createdById?: number | null;
  updatedById?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface FerryProgramListData {
  programs: Array<FerryProgram>;
  count: number;
}

export interface FerryProgramDoc {
  id: string;
  programId: string;
  workspaceId: string;
  title: string;
  contentMarkdown: string;
  meetingAt?: string | null;
  sourceRef?: string | null;
  sortOrder?: number | null;
  pinned?: boolean;
  archivedAt?: string | null;
  createdById?: number | null;
  updatedById?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface FerryProgramDocListData {
  meetings: Array<FerryProgramDoc>;
  count: number;
}

export interface FerryProgramListParams {
  workspace_id?: string | null;
}

export interface FerryProgramRetrieveParams extends FerryProgramListParams {}
export interface FerryProgramDocListParams extends FerryProgramListParams {}
export interface FerryProgramTodoDeleteParams extends FerryProgramListParams {}

export interface FerryProgramDocCreateParams extends FerryProgramListParams {
  title: string;
  meetingAt?: string | null;
  contentMarkdown?: string;
  sourceRef?: string | null;
}

export interface FerryProgramDocUpdateParams extends FerryProgramListParams {
  title?: string;
  meetingAt?: string | null;
  contentMarkdown?: string;
  pinned?: boolean;
  archivedAt?: string | null;
}

export interface FerryProgramTodoWriteParams extends FerryProgramListParams {
  title?: string;
  titleJa?: string | null;
  description?: string;
  descriptionJa?: string | null;
  category?: string;
  required?: boolean;
  status?: FerryProgramTodoStatus;
  notes?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  priority?: FerryProgramTodoPriority;
  sourceRef?: string | null;
  phaseId?: string | null;
  parentTodoId?: string | null;
  sortOrder?: number | null;
  archivedAt?: string | null;
}

export interface FerryProgramTodoCreateParams extends FerryProgramTodoWriteParams {
  title: string;
}

export interface FerryProgramTodoUpdateParams extends FerryProgramTodoWriteParams {}

export interface FerryProgramTodoBatchUpsertItem extends FerryProgramTodoWriteParams {
  id?: string | null;
}

export interface FerryProgramTodoBatchUpsertParams extends FerryProgramListParams {
  todos: Array<FerryProgramTodoBatchUpsertItem>;
}

export interface FerryProgramTodoBatchUpsertData {
  program: FerryProgram;
  createdCount: number;
  updatedCount: number;
}

FerryPrograms.Docs = FerryProgramDocs;
FerryPrograms.Todos = FerryProgramTodos;

export declare namespace FerryPrograms {
  export {
    FerryProgramDocs as Docs,
    FerryProgramTodos as Todos,
    type FerryProgramStatus as FerryProgramStatus,
    type FerryProgramPlan as FerryProgramPlan,
    type FerryProgramTodoStatus as FerryProgramTodoStatus,
    type FerryProgramTodoPriority as FerryProgramTodoPriority,
    type FerryProgramEndpoint as FerryProgramEndpoint,
    type FerryProgramPhase as FerryProgramPhase,
    type FerryProgramTodo as FerryProgramTodo,
    type FerryProgram as FerryProgram,
    type FerryProgramListData as FerryProgramListData,
    type FerryProgramDoc as FerryProgramDoc,
    type FerryProgramDocListData as FerryProgramDocListData,
    type FerryProgramListParams as FerryProgramListParams,
    type FerryProgramRetrieveParams as FerryProgramRetrieveParams,
    type FerryProgramDocListParams as FerryProgramDocListParams,
    type FerryProgramDocCreateParams as FerryProgramDocCreateParams,
    type FerryProgramDocUpdateParams as FerryProgramDocUpdateParams,
    type FerryProgramTodoCreateParams as FerryProgramTodoCreateParams,
    type FerryProgramTodoUpdateParams as FerryProgramTodoUpdateParams,
    type FerryProgramTodoDeleteParams as FerryProgramTodoDeleteParams,
    type FerryProgramTodoBatchUpsertItem as FerryProgramTodoBatchUpsertItem,
    type FerryProgramTodoBatchUpsertParams as FerryProgramTodoBatchUpsertParams,
    type FerryProgramTodoBatchUpsertData as FerryProgramTodoBatchUpsertData,
  };
}
