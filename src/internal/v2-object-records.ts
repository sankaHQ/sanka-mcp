// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIPromise } from '../core/api-promise';
import { V2Envelope, unwrapV2Data } from './v2';

export type V2ObjectRecord = {
  id: string;
  record_id?: string | null;
  object_type?: string | null;
  properties?: Record<string, unknown>;
};

export type V2ObjectRecordList = {
  items?: Array<V2ObjectRecord>;
  page?: number;
  page_size?: number;
  total?: number;
};

export type V2LifecycleData = {
  id?: string | null;
  record_id?: string | null;
  status?: string | null;
  usage_status?: string | null;
};

export const numericRecordID = (recordID: string | null | undefined): number | undefined => {
  if (typeof recordID !== 'string' || !recordID.trim()) return undefined;
  const value = Number(recordID);
  return Number.isFinite(value) ? value : undefined;
};

export const compactProperties = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

export const legacyObjectRecordFromV2 = <T>(
  record: V2ObjectRecord,
  formattedIDKey?: string,
  aliases: Record<string, unknown> = {},
): T => {
  const properties = record.properties ?? {};
  const formattedID =
    formattedIDKey == null ?
      {}
    : { [formattedIDKey]: numericRecordID(record.record_id) ?? (record.record_id as never) ?? null };
  return {
    ...properties,
    ...aliases,
    id: record.id,
    ...formattedID,
  } as T;
};

export const unwrapV2ObjectRecord = <T>(
  promise: APIPromise<V2Envelope<V2ObjectRecord>>,
  mapper: (record: V2ObjectRecord) => T,
): APIPromise<T> => promise._thenUnwrap((envelope) => mapper(unwrapV2Data(envelope)));

export const unwrapV2ObjectRecordArray = <T>(
  promise: APIPromise<V2Envelope<V2ObjectRecordList>>,
  mapper: (record: V2ObjectRecord) => T,
): APIPromise<Array<T>> =>
  promise._thenUnwrap((envelope) => (unwrapV2Data(envelope).items ?? []).map(mapper));

export const legacyListEnvelopeFromV2 = <T extends object>(
  envelope: V2Envelope<V2ObjectRecordList>,
  mapper: (record: V2ObjectRecord) => T,
  label: string,
) => {
  const data = unwrapV2Data(envelope);
  const rows = (data.items ?? []).map(mapper);
  const total = data.total ?? rows.length;
  const page = data.page ?? 1;
  return {
    count: rows.length,
    data: rows,
    message: `Returned ${rows.length} of ${total} ${label}.`,
    page,
    total,
    ctx_id: envelope.meta.ctx_id ?? null,
  };
};

export const legacyDeleteResponseFromV2 = <T extends object>(
  envelope: V2Envelope<V2LifecycleData>,
  idKey: string,
  externalID?: string | null,
): T => {
  const data = unwrapV2Data(envelope);
  return {
    ok: true,
    status: 'deleted',
    [idKey]: data.id ?? null,
    external_id: externalID ?? null,
    ctx_id: envelope.meta.ctx_id ?? null,
  } as unknown as T;
};

export const legacyMutationResponseFromV2 = <T extends object>(
  envelope: V2Envelope<V2ObjectRecord>,
  idKey: string,
  status: string,
  externalID?: string | null,
): T => {
  const data = unwrapV2Data(envelope);
  return {
    ok: true,
    status,
    [idKey]: data.id ?? null,
    external_id: externalID ?? null,
    ctx_id: envelope.meta.ctx_id ?? null,
  } as unknown as T;
};
