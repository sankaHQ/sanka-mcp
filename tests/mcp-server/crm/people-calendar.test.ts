import {
  crmCalculatePayrollRunTool,
  crmCancelCalendarAttendanceTool,
  crmCheckCalendarAvailabilityTool,
  crmCreateAbsenceTool,
  crmCreateCalendarAttendanceTool,
  crmCreatePayrollJournalEntryTool,
  crmDownloadPayrollPayslipPDFTool,
  crmGetCalendarBootstrapTool,
  crmListAttendanceRecordsTool,
  crmListEmployeesTool,
  crmRescheduleCalendarAttendanceTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { resetBinaryDownloadStoreForTests } from '../../../packages/mcp-server/src/binary-download-store';
import { resetBinaryUploadStoreForTests } from '../../../packages/mcp-server/src/binary-upload-store';
import { describeV2Requests, oauthContext, type V2RequestCase } from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'loads calendar bootstrap context',
    tool: crmGetCalendarBootstrapTool,
    args: {
      slug: 'intro-call',
      mode: 'book',
    },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/calendar/bootstrap?mode=book&slug=intro-call',
      },
    ],
  },
  {
    name: 'checks calendar availability',
    tool: crmCheckCalendarAvailabilityTool,
    args: {
      event_id: 'event-1',
      start_date: '2026-04-10',
      days: 3,
      timezone: 'Asia/Tokyo',
    },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/calendar/availability?event_id=event-1&start_date=2026-04-10&timezone=Asia%2FTokyo&days=3',
      },
    ],
  },
  {
    name: 'creates calendar attendance',
    tool: crmCreateCalendarAttendanceTool,
    args: {
      event_id: 'event-1',
      date: '2026-04-10',
      time: '09:00',
      name: 'Jane Doe',
      email: 'jane@example.com',
      timezone: 'Asia/Tokyo',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/calendar/attendance',
        body: {
          date: '2026-04-10',
          email: 'jane@example.com',
          event_id: 'event-1',
          name: 'Jane Doe',
          time: '09:00',
          timezone: 'Asia/Tokyo',
        },
      },
    ],
  },
  {
    name: 'cancels calendar attendance',
    tool: crmCancelCalendarAttendanceTool,
    args: {
      attendance_id: 'attendance-1',
    },
    expectedRequests: [
      { method: 'POST', url: 'http://localhost:5000/api/v2/public/calendar/attendance/attendance-1/cancel' },
    ],
  },
  {
    name: 'reschedules calendar attendance',
    tool: crmRescheduleCalendarAttendanceTool,
    args: {
      attendance_id: 'attendance-1',
      date: '2026-04-11',
      time: '11:00',
      comment: 'Need a later slot',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/calendar/attendance/attendance-1/reschedule',
        body: { comment: 'Need a later slot', date: '2026-04-11', time: '11:00' },
      },
    ],
  },
  {
    name: 'lists employees',
    tool: crmListEmployeesTool,
    args: { limit: 5, search: 'NM', language: 'ja' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/employees?limit=5&page=1&search=NM&language=ja',
      },
    ],
  },
  {
    name: 'creates an absence',
    tool: crmCreateAbsenceTool,
    args: {
      worker_id: 'worker-1',
      start_date: '2026-05-22',
      end_date: '2026-05-22',
      absence_type: 'pto',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/absences',
        body: {
          worker_id: 'worker-1',
          start_date: '2026-05-22',
          end_date: '2026-05-22',
          absence_type: 'pto',
        },
      },
    ],
  },
  {
    name: 'lists attendance records',
    tool: crmListAttendanceRecordsTool,
    args: { limit: 5, search: 'Daily' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/attendance-records?limit=5&page=1&search=Daily',
      },
    ],
  },
  {
    name: 'calculates a payroll run',
    tool: crmCalculatePayrollRunTool,
    args: { period: '2026-04', pay_date: '2026-04-30' },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/payroll/runs/calculate',
        body: { period: '2026-04', pay_date: '2026-04-30' },
      },
    ],
  },
  {
    name: 'creates a payroll journal entry',
    tool: crmCreatePayrollJournalEntryTool,
    args: { run_id: 'run-1', notes: 'Monthly payroll journal' },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/payroll/runs/run-1/journal-entry',
        body: { notes: 'Monthly payroll journal' },
      },
    ],
  },
];

describe('CRM people and calendar tools', () => {
  beforeEach(() => {
    resetBinaryDownloadStoreForTests();
    resetBinaryUploadStoreForTests();
  });

  it('downloads payroll payslip PDFs as binary results', async () => {
    const pdfBytes = Buffer.from('%PDF-payroll');
    const asResponse = jest.fn().mockResolvedValue(
      new Response(pdfBytes, {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="payslip.pdf"; filename*=UTF-8\'\'payroll-payslip.pdf',
        },
      }),
    );
    const get = jest.fn().mockReturnValue({ asResponse });
    const reqContext = {
      client: { get } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const payslipResult = await crmDownloadPayrollPayslipPDFTool.handler({
      reqContext,
      args: {
        run_id: 'run-1',
        result_id: 'result-1',
        language: 'ja',
      },
    });

    expect(get).toHaveBeenLastCalledWith('/api/v2/public/payroll/runs/run-1/payslips/pdf', {
      query: {
        result_id: 'result-1',
        language: 'ja',
      },
    });
    expect(payslipResult.structuredContent).toMatchObject({
      mime_type: 'application/pdf',
      filename: 'payroll-payslip.pdf',
      byte_length: pdfBytes.byteLength,
      download_complete: true,
      content_base64_available: true,
      content_base64: pdfBytes.toString('base64'),
    });
  });

  describeV2Requests(v2Requests);
});
