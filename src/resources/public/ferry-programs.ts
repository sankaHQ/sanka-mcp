// Hand-written Ferry program resource backed by the V2 public API.

import { APIPromise } from '../../core/api-promise';
import { APIResource } from '../../core/resource';
import { RequestOptions } from '../../internal/request-options';
import { compactProperties } from '../../internal/v2-object-records';
import { unwrapV2DataPromise } from '../../internal/v2';
import { path } from '../../internal/utils/path';

export class FerryPrograms extends APIResource {
  list(options?: RequestOptions): APIPromise<FerryProgramListData> {
    return unwrapV2DataPromise(this._client.v2Get<FerryProgramListData>('/public/ferry/programs', options));
  }

  retrieve(programID: string, options?: RequestOptions): APIPromise<FerryProgram> {
    return unwrapV2DataPromise(
      this._client.v2Get<FerryProgram>(path`/public/ferry/programs/${programID}`, options),
    );
  }

  listMeetings(programID: string, options?: RequestOptions): APIPromise<FerryProgramMeetingListData> {
    return unwrapV2DataPromise(
      this._client.v2Get<FerryProgramMeetingListData>(
        path`/public/ferry/programs/${programID}/meetings`,
        options,
      ),
    );
  }

  createMeeting(
    programID: string,
    params: FerryProgramMeetingCreateParams,
    options?: RequestOptions,
  ): APIPromise<FerryProgramMeeting> {
    return unwrapV2DataPromise(
      this._client.v2Post<FerryProgramMeeting>(path`/public/ferry/programs/${programID}/meetings`, {
        body: compactProperties(params as unknown as Record<string, unknown>),
        ...options,
      }),
    );
  }

  updateMeeting(
    programID: string,
    meetingID: string,
    params: FerryProgramMeetingUpdateParams,
    options?: RequestOptions,
  ): APIPromise<FerryProgramMeeting> {
    return unwrapV2DataPromise(
      this._client.v2Patch<FerryProgramMeeting>(
        path`/public/ferry/programs/${programID}/meetings/${meetingID}`,
        {
          body: compactProperties(params as unknown as Record<string, unknown>),
          ...options,
        },
      ),
    );
  }

  createTodo(
    programID: string,
    params: FerryProgramTodoCreateParams,
    options?: RequestOptions,
  ): APIPromise<FerryProgram> {
    return unwrapV2DataPromise(
      this._client.v2Post<FerryProgram>(path`/public/ferry/programs/${programID}/todos`, {
        body: compactProperties(params as unknown as Record<string, unknown>),
        ...options,
      }),
    );
  }

  batchUpsertTodos(
    programID: string,
    params: FerryProgramTodoBatchUpsertParams,
    options?: RequestOptions,
  ): APIPromise<FerryProgramTodoBatchUpsertData> {
    return unwrapV2DataPromise(
      this._client.v2Post<FerryProgramTodoBatchUpsertData>(
        path`/public/ferry/programs/${programID}/todos/batch-upsert`,
        {
          body: compactProperties(params as unknown as Record<string, unknown>),
          ...options,
        },
      ),
    );
  }

  updateTodo(
    programID: string,
    todoID: string,
    params: FerryProgramTodoUpdateParams,
    options?: RequestOptions,
  ): APIPromise<FerryProgram> {
    return unwrapV2DataPromise(
      this._client.v2Patch<FerryProgram>(path`/public/ferry/programs/${programID}/todos/${todoID}`, {
        body: compactProperties(params as unknown as Record<string, unknown>),
        ...options,
      }),
    );
  }

  deleteTodo(programID: string, todoID: string, options?: RequestOptions): APIPromise<FerryProgram> {
    return unwrapV2DataPromise(
      this._client.v2Delete<FerryProgram>(path`/public/ferry/programs/${programID}/todos/${todoID}`, options),
    );
  }
}

export type FerryProgramTodoStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';
export type FerryProgramTodoPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface FerryProgramTodo {
  id: string;
  title: string;
  titleJa?: string | null;
  description?: string;
  descriptionJa?: string | null;
  category?: string;
  required?: boolean;
  status: FerryProgramTodoStatus;
  notes?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  priority?: FerryProgramTodoPriority;
  sourceRef?: string | null;
}

export interface FerryProgram {
  id: string;
  workspaceId: string;
  templateSlug: string;
  status: 'draft' | 'active' | 'ready' | 'completed' | 'archived';
  name: string;
  description?: string;
  updatesMarkdown?: string;
  todos: Array<FerryProgramTodo>;
  [key: string]: unknown;
}

export interface FerryProgramListData {
  programs: Array<FerryProgram>;
  count: number;
}

export interface FerryProgramMeeting {
  id: string;
  programId: string;
  workspaceId: string;
  title: string;
  meetingAt?: string | null;
  contentMarkdown: string;
  sourceRef?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface FerryProgramMeetingListData {
  meetings: Array<FerryProgramMeeting>;
  count: number;
}

export interface FerryProgramMeetingCreateParams {
  title: string;
  meetingAt?: string | null;
  contentMarkdown?: string;
  sourceRef?: string | null;
}

export interface FerryProgramMeetingUpdateParams {
  title?: string;
  meetingAt?: string | null;
  contentMarkdown?: string;
}

export interface FerryProgramTodoCreateParams {
  title: string;
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
}

export interface FerryProgramTodoBatchUpsertItem extends FerryProgramTodoCreateParams {
  id?: string;
}

export interface FerryProgramTodoBatchUpsertParams {
  todos: Array<FerryProgramTodoBatchUpsertItem>;
}

export interface FerryProgramTodoUpdateParams extends Partial<FerryProgramTodoCreateParams> {}

export interface FerryProgramTodoBatchUpsertData {
  program: FerryProgram;
  createdCount: number;
  updatedCount: number;
}

export declare namespace FerryPrograms {
  export {
    type FerryProgramTodoStatus as FerryProgramTodoStatus,
    type FerryProgramTodoPriority as FerryProgramTodoPriority,
    type FerryProgramTodo as FerryProgramTodo,
    type FerryProgram as FerryProgram,
    type FerryProgramListData as FerryProgramListData,
    type FerryProgramMeeting as FerryProgramMeeting,
    type FerryProgramMeetingListData as FerryProgramMeetingListData,
    type FerryProgramMeetingCreateParams as FerryProgramMeetingCreateParams,
    type FerryProgramMeetingUpdateParams as FerryProgramMeetingUpdateParams,
    type FerryProgramTodoCreateParams as FerryProgramTodoCreateParams,
    type FerryProgramTodoBatchUpsertItem as FerryProgramTodoBatchUpsertItem,
    type FerryProgramTodoBatchUpsertParams as FerryProgramTodoBatchUpsertParams,
    type FerryProgramTodoUpdateParams as FerryProgramTodoUpdateParams,
    type FerryProgramTodoBatchUpsertData as FerryProgramTodoBatchUpsertData,
  };
}
