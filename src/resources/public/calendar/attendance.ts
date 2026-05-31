// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as CalendarAPI from './calendar';
import { APIPromise } from '../../../core/api-promise';
import { RequestOptions } from '../../../internal/request-options';
import { path } from '../../../internal/utils/path';
import { V2Envelope, unwrapV2Data } from '../../../internal/v2';

const unwrapV2CalendarEnvelope = <T extends { ctx_id?: string | null }>(
  promise: APIPromise<V2Envelope<Omit<T, 'ctx_id'>>>,
): APIPromise<T> => {
  return promise._thenUnwrap(
    (envelope) =>
      ({
        ...unwrapV2Data(envelope),
        ctx_id: envelope.meta.ctx_id ?? null,
      }) as T,
  );
};

export class Attendance extends APIResource {
  /**
   * Public Calendar Create Attendance
   */
  create(body: AttendanceCreateParams, options?: RequestOptions): APIPromise<PublicCalendarMutation> {
    return unwrapV2CalendarEnvelope(
      this._client.post('/api/v2/public/calendar/attendance', { body, ...options }),
    );
  }

  /**
   * Public Calendar Cancel Attendance
   */
  cancel(attendanceID: string, options?: RequestOptions): APIPromise<PublicCalendarMutation> {
    return unwrapV2CalendarEnvelope(
      this._client.post(path`/api/v2/public/calendar/attendance/${attendanceID}/cancel`, options),
    );
  }

  /**
   * Public Calendar Reschedule Attendance
   */
  reschedule(
    attendanceID: string,
    body: AttendanceRescheduleParams,
    options?: RequestOptions,
  ): APIPromise<PublicCalendarMutation> {
    return unwrapV2CalendarEnvelope(
      this._client.post(path`/api/v2/public/calendar/attendance/${attendanceID}/reschedule`, {
        body,
        ...options,
      }),
    );
  }
}

export interface PublicCalendarMutation {
  message: string;

  status: string;

  attendance?: CalendarAPI.PublicCalendarAttendance | null;

  ctx_id?: string | null;

  meet_link?: string | null;

  ok?: boolean;
}

export interface AttendanceCreateParams {
  date: string;

  email: string;

  event_id: string;

  name: string;

  time: string;

  comment?: string | null;

  timezone?: string | null;
}

export interface AttendanceRescheduleParams {
  date: string;

  time: string;

  comment?: string | null;

  email?: string | null;

  name?: string | null;

  timezone?: string | null;
}

export declare namespace Attendance {
  export {
    type PublicCalendarMutation as PublicCalendarMutation,
    type AttendanceCreateParams as AttendanceCreateParams,
    type AttendanceRescheduleParams as AttendanceRescheduleParams,
  };
}
