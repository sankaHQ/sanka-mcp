// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../core/resource';
import * as AttendanceAPI from './attendance';
import {
  Attendance,
  AttendanceCreateParams,
  AttendanceRescheduleParams,
  PublicCalendarMutation,
} from './attendance';
import { APIPromise } from '../../../core/api-promise';
import { RequestOptions } from '../../../internal/request-options';

export class Calendar extends APIResource {
  attendance: AttendanceAPI.Attendance = new AttendanceAPI.Attendance(this._client);

  /**
   * Public Calendar Bootstrap
   */
  bootstrap(
    query: CalendarBootstrapParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<CalendarBootstrapResponse> {
    return this._client.get('/v1/public/calendar/bootstrap', { query, ...options });
  }

  /**
   * Public Calendar Availability
   */
  checkAvailability(
    query: CalendarCheckAvailabilityParams,
    options?: RequestOptions,
  ): APIPromise<CalendarCheckAvailabilityResponse> {
    return this._client.get('/v1/public/calendar/availability', { query, ...options });
  }
}

export interface PublicCalendarAttendance {
  id: string;

  calendar_event_id?: string | null;

  comment?: string | null;

  event_id?: string | null;

  link?: string | null;

  select_date?: string | null;

  time_event?: string | null;

  timezone?: string | null;

  user_email?: string | null;

  user_name?: string | null;
}

export interface CalendarBootstrapResponse {
  message: string;

  mode: string;

  status: string;

  attendance?: PublicCalendarAttendance | null;

  ctx_id?: string | null;

  event?: CalendarBootstrapResponse.Event | null;

  workspace?: CalendarBootstrapResponse.Workspace | null;
}

export namespace CalendarBootstrapResponse {
  export interface Event {
    id: string;

    title: string;

    description?: string | null;

    duration?: string | null;

    location?: string | null;

    schedule?: Array<Event.Schedule>;

    slug?: string | null;

    status?: string | null;

    time_increment?: string | null;

    timezone?: string | null;

    timezone_label?: string | null;

    timezone_locked?: boolean;

    url?: string | null;
  }

  export namespace Event {
    export interface Schedule {
      day_index: number;

      day_name: string;

      enabled?: boolean;

      slots?: Array<Schedule.Slot>;
    }

    export namespace Schedule {
      export interface Slot {
        end: string;

        start: string;
      }
    }
  }

  export interface Workspace {
    id: string;

    name: string;

    short_id?: string | null;

    timezone?: string | null;
  }
}

export interface CalendarCheckAvailabilityResponse {
  message: string;

  ctx_id?: string | null;

  days?: Array<CalendarCheckAvailabilityResponse.Day>;

  timezone?: string | null;
}

export namespace CalendarCheckAvailabilityResponse {
  export interface Day {
    date: string;

    day_index: number;

    weekday: string;

    slots?: Array<string>;
  }
}

export interface CalendarBootstrapParams {
  attendance_id?: string | null;

  mode?: string;

  slug?: string | null;

  url?: string | null;
}

export interface CalendarCheckAvailabilityParams {
  event_id: string;

  start_date: string;

  days?: number;

  timezone?: string | null;
}

Calendar.Attendance = Attendance;

export declare namespace Calendar {
  export {
    type PublicCalendarAttendance as PublicCalendarAttendance,
    type CalendarBootstrapResponse as CalendarBootstrapResponse,
    type CalendarCheckAvailabilityResponse as CalendarCheckAvailabilityResponse,
    type CalendarBootstrapParams as CalendarBootstrapParams,
    type CalendarCheckAvailabilityParams as CalendarCheckAvailabilityParams,
  };

  export {
    Attendance as Attendance,
    type PublicCalendarMutation as PublicCalendarMutation,
    type AttendanceCreateParams as AttendanceCreateParams,
    type AttendanceRescheduleParams as AttendanceRescheduleParams,
  };
}
