// Maintained public presentations resources: Sanka Doc slide decks (`sanka.deck/v1`) in Sanka Flow
// Docs (`client.public.presentations`) and in a Sanka program's Docs
// (`client.public.programPresentations`). The methods mirror the V2 public developer contract; body
// fields are camelCase like the API's. Program routes keep their published
// `/public/ferry/programs/{program_id}` prefix.

import type { Sanka } from '../../client';
import { APIResource } from '../../core/resource';
import { APIPromise } from '../../core/api-promise';
import { type Uploadable } from '../../core/uploads';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { multipartFormRequestOptions } from '../../internal/uploads';
import { path } from '../../internal/utils/path';
import { unwrapV2DataPromise } from '../../internal/v2';

export type PresentationProduct = 'sanka' | 'flow';
export type PresentationPageSize = '16:9' | 'a4-landscape';
export type PresentationUpdatedVia = 'app' | 'api' | 'mcp' | 'system';
export type PresentationExportFormat = 'pptx' | 'pdf' | 'google_slides';
export type PresentationExportStatus =
  | 'queued'
  | 'rendering'
  | 'writing'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type PresentationPreviewWidth = 640 | 960 | 1280;
export type PresentationOpName =
  | 'insert_slides'
  | 'replace_slide'
  | 'update_slide'
  | 'delete_slides'
  | 'move_slides'
  | 'insert_blocks'
  | 'update_block'
  | 'replace_block'
  | 'delete_blocks'
  | 'move_block'
  | 'set_theme'
  | 'set_title'
  | 'set_footer';

export interface PresentationThemeChoice {
  /** A theme id from the catalog, such as sanka-paper. */
  id: string;
  /** Omit for the latest version. */
  version?: number | null;
}

/** A `sanka.deck/v1` deck as JSON; `catalog()` publishes its JSON Schema. */
export interface PresentationDeck {
  schema?: string;
  page?: { size?: PresentationPageSize };
  theme?: PresentationThemeChoice;
  footer?: { pageNumbers?: boolean; text?: string };
  slides: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/** One edit, applied in order with the others of a request, all or nothing; fields are camelCase. */
export interface PresentationOp {
  op: PresentationOpName;
  [key: string]: unknown;
}

/** A static deck problem; `path` is a JSON Pointer into the deck. */
export interface PresentationWarning {
  code: string;
  path: string;
  message: string;
}

export interface Presentation {
  id: string;
  programId?: string | null;
  workspaceId: string;
  product: PresentationProduct;
  kind: 'presentation';
  title: string;
  revision: number;
  deck: PresentationDeck;
  slideCount: number;
  /** Read-only Markdown outline derived from the deck. */
  outline: string;
  updatedVia: PresentationUpdatedVia;
  sourceRef?: string | null;
  pinned?: boolean;
  archivedAt?: string | null;
  createdById?: number | null;
  updatedById?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** App-relative URL of the Docs page with this presentation open. */
  appPath: string;
  warnings?: Array<PresentationWarning>;
}

/** A presentation in a list: metadata only, never the deck. */
export interface PresentationSummary {
  id: string;
  programId?: string | null;
  product: PresentationProduct;
  title: string;
  revision: number;
  slideCount: number;
  pageSize: PresentationPageSize;
  themeId: string;
  folderId?: string | null;
  pinned?: boolean;
  archivedAt?: string | null;
  updatedVia: PresentationUpdatedVia;
  createdAt?: string | null;
  updatedAt?: string | null;
  appPath: string;
}

export interface PresentationList {
  presentations: Array<PresentationSummary>;
  /** Pass as `cursor` for the next page; null on the last page. */
  nextCursor?: string | null;
}

export interface PresentationCatalog {
  schemaVersions: Array<string>;
  pageSizes: Array<Record<string, unknown>>;
  layouts: Array<Record<string, unknown>>;
  blocks: Array<Record<string, unknown>>;
  accents: Array<Record<string, unknown>>;
  themes: Array<Record<string, unknown>>;
  /** Lucide icon names allowed in card items. */
  icons: Array<string>;
  limits: Record<string, number>;
  guidance: Array<string>;
  deckJsonSchema: Record<string, unknown>;
  example: Record<string, unknown>;
}

/** An image stored with the presentation; use `assetId` in image blocks and accents. */
export interface PresentationImage {
  assetId: string;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
  alt?: string | null;
}

export interface PresentationSlideFit {
  scale: number;
  /** Set when the content does not fit even at the theme's minimum scale. */
  overflow?: { blockIds: Array<string>; overflowPx: number } | null;
}

export interface PresentationPreviewSlide {
  slideId: string;
  /** 0-based position in the deck. */
  index: number;
  image: { contentType: string; base64: string };
  fit: PresentationSlideFit;
}

export interface PresentationPreview {
  revision: number;
  slides: Array<PresentationPreviewSlide>;
  /** Render warnings such as SLIDE_OVERFLOW or IMAGE_ALT_MISSING, with their slideId. */
  warnings?: Array<Record<string, unknown>>;
}

export interface PresentationExport {
  id: string;
  documentId: string;
  product: PresentationProduct;
  revision: number;
  format: PresentationExportFormat;
  status: PresentationExportStatus;
  progress?: number;
  filename?: string | null;
  sizeBytes?: number | null;
  warnings?: Array<Record<string, unknown>>;
  errorCode?: string | null;
  errorMessage?: string | null;
  /** App-relative download route; present once the export completed. */
  downloadPath?: string | null;
  /** Editable file in the requesting user's connected Google Drive. */
  googleSlidesUrl?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  expiresAt?: string | null;
}

export interface PresentationWorkspaceParams {
  /** Query param: internal workspace UUID; defaults to the token's or MCP session's workspace. */
  workspace_id?: string | null;
}

export interface PresentationListParams extends PresentationWorkspaceParams {
  /** Query param: only presentations in this Docs folder. */
  folder_id?: string | null;
  /** Query param: `nextCursor` from the previous page. */
  cursor?: string | null;
  /** Query param: presentations per page, up to 100 (default 50). */
  limit?: number;
  include_archived?: boolean;
}

export interface PresentationCreateParams extends PresentationWorkspaceParams {
  title: string;
  /** Body param: give at most one of deck, markdown and sourceDocumentId; none starts one title slide. */
  deck?: PresentationDeck | null;
  /** Body param: Markdown to lay out as slides. */
  markdown?: string | null;
  /** Body param: a Markdown Doc in the same Docs to convert; the Doc itself is unchanged. */
  sourceDocumentId?: string | null;
  /** Body param: slide size, overriding `deck.page.size`; defaults to 16:9. */
  pageSize?: PresentationPageSize | null;
  /** Body param: theme, overriding `deck.theme`. */
  theme?: PresentationThemeChoice | null;
  folderId?: string | null;
  /** Body param: creating again with the same sourceRef returns the existing presentation. */
  sourceRef?: string | null;
}

export type PresentationRetrieveParams = PresentationWorkspaceParams;

export interface PresentationReplaceParams extends PresentationWorkspaceParams {
  expectedRevision: number;
  title?: string | null;
  deck: PresentationDeck;
}

export interface PresentationUpdateParams extends PresentationWorkspaceParams {
  expectedRevision: number;
  ops: Array<PresentationOp>;
}

export interface PresentationUploadImageParams extends PresentationWorkspaceParams {
  /** Body param: a PNG, JPEG or WebP image up to 10 MiB. */
  file: Uploadable;
  alt?: string | null;
}

export interface PresentationImportImageParams extends PresentationWorkspaceParams {
  /** Body param: a public https:// image URL (JPEG, PNG or WebP, at most 10 MiB). */
  url: string;
  alt?: string | null;
}

export interface PresentationPreviewParams extends PresentationWorkspaceParams {
  /** Body param: slides to preview (up to 12); omit for the first 12 visible slides. */
  slideIds?: Array<string> | null;
  /** Body param: image width in px (default 960). */
  width?: PresentationPreviewWidth;
  format?: 'jpeg' | 'png';
}

export interface PresentationCreateExportParams extends PresentationWorkspaceParams {
  format: PresentationExportFormat;
  slideIds?: Array<string> | null;
  includeHidden?: boolean;
  includeNotes?: boolean;
  /** Header param: the same key returns the same export; a new key starts another one. */
  'Idempotency-Key'?: string;
}

export type PresentationExportParams = PresentationWorkspaceParams;

// Query fields the caller left unset are not sent.
const compactQuery = (query: Record<string, unknown>): Record<string, unknown> | undefined => {
  const entries = Object.entries(query).filter(([, value]) => value != null);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

// Bodies always go out, as the routes require one; unset fields are left out.
const compactBody = (body: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(body).filter(([, value]) => value != null));

// The requests of one Docs product, under its presentations route.
const presentationRequests = (client: Sanka, base: string) => {
  const item = (presentationID: string) => `${base}${path`/${presentationID}`}`;
  const exportItem = (presentationID: string, exportID: string) =>
    `${item(presentationID)}${path`/exports/${exportID}`}`;
  return {
    list: (params: PresentationListParams | null | undefined, options?: RequestOptions) =>
      unwrapV2DataPromise(
        client.v2Get<PresentationList>(base, { query: compactQuery({ ...params }), ...options }),
      ),
    create: (params: PresentationCreateParams, options?: RequestOptions) => {
      const { workspace_id, ...body } = params;
      return unwrapV2DataPromise(
        client.v2Post<Presentation>(base, {
          query: compactQuery({ workspace_id }),
          body: compactBody(body),
          ...options,
        }),
      );
    },
    retrieve: (
      presentationID: string,
      params: PresentationRetrieveParams | null | undefined,
      options?: RequestOptions,
    ) =>
      unwrapV2DataPromise(
        client.v2Get<Presentation>(item(presentationID), { query: compactQuery({ ...params }), ...options }),
      ),
    replace: (presentationID: string, params: PresentationReplaceParams, options?: RequestOptions) => {
      const { workspace_id, ...body } = params;
      return unwrapV2DataPromise(
        client.v2Put<Presentation>(item(presentationID), {
          query: compactQuery({ workspace_id }),
          body: compactBody(body),
          ...options,
        }),
      );
    },
    update: (presentationID: string, params: PresentationUpdateParams, options?: RequestOptions) => {
      const { workspace_id, ...body } = params;
      return unwrapV2DataPromise(
        client.v2Patch<Presentation>(item(presentationID), {
          query: compactQuery({ workspace_id }),
          body: compactBody(body),
          ...options,
        }),
      );
    },
    uploadImage: (
      presentationID: string,
      params: PresentationUploadImageParams,
      options?: RequestOptions,
    ) => {
      const { workspace_id, ...body } = params;
      return unwrapV2DataPromise(
        client.v2Post<PresentationImage>(
          `${item(presentationID)}/images`,
          multipartFormRequestOptions(
            { query: compactQuery({ workspace_id }), body: compactBody(body), ...options },
            client,
          ),
        ),
      );
    },
    importImage: (
      presentationID: string,
      params: PresentationImportImageParams,
      options?: RequestOptions,
    ) => {
      const { workspace_id, ...body } = params;
      return unwrapV2DataPromise(
        client.v2Post<PresentationImage>(`${item(presentationID)}/images/import`, {
          query: compactQuery({ workspace_id }),
          body: compactBody(body),
          ...options,
        }),
      );
    },
    preview: (
      presentationID: string,
      params: PresentationPreviewParams | null | undefined,
      options?: RequestOptions,
    ) => {
      const { workspace_id, ...body }: PresentationPreviewParams = params ?? {};
      return unwrapV2DataPromise(
        client.v2Post<PresentationPreview>(`${item(presentationID)}/previews`, {
          query: compactQuery({ workspace_id }),
          body: compactBody(body),
          ...options,
        }),
      );
    },
    createExport: (
      presentationID: string,
      params: PresentationCreateExportParams,
      options?: RequestOptions,
    ) => {
      const { workspace_id, 'Idempotency-Key': idempotencyKey, ...body } = params;
      return unwrapV2DataPromise(
        client.v2Post<PresentationExport>(`${item(presentationID)}/exports`, {
          query: compactQuery({ workspace_id }),
          body: compactBody(body),
          ...options,
          headers: buildHeaders([
            { ...(idempotencyKey != null ? { 'Idempotency-Key': idempotencyKey } : undefined) },
            options?.headers,
          ]),
        }),
      );
    },
    retrieveExport: (
      presentationID: string,
      exportID: string,
      params: PresentationExportParams | null | undefined,
      options?: RequestOptions,
    ) =>
      unwrapV2DataPromise(
        client.v2Get<PresentationExport>(exportItem(presentationID, exportID), {
          query: compactQuery({ ...params }),
          ...options,
        }),
      ),
    downloadExport: (
      presentationID: string,
      exportID: string,
      params: PresentationExportParams | null | undefined,
      options?: RequestOptions,
    ) =>
      client.get<Response>(client.v2Path(`${exportItem(presentationID, exportID)}/download`), {
        query: compactQuery({ ...params }),
        ...options,
        __binaryResponse: true,
      }),
    cancelExport: (
      presentationID: string,
      exportID: string,
      params: PresentationExportParams | null | undefined,
      options?: RequestOptions,
    ) =>
      unwrapV2DataPromise(
        client.v2Post<PresentationExport>(`${exportItem(presentationID, exportID)}/cancel`, {
          query: compactQuery({ ...params }),
          ...options,
        }),
      ),
  };
};

const FLOW_PRESENTATIONS = '/public/documents/presentations';

const programRequests = (client: Sanka, programID: string) =>
  presentationRequests(client, path`/public/ferry/programs/${programID}/presentations`);

/** Presentations in Sanka Flow Docs. */
export class Presentations extends APIResource {
  /**
   * The presentation catalog: page sizes, layouts, blocks with their JSON Schemas and limits,
   * accents, themes, icons, authoring guidance, the deck JSON Schema and an example deck.
   */
  catalog(options?: RequestOptions): APIPromise<PresentationCatalog> {
    return unwrapV2DataPromise(
      this._client.v2Get<PresentationCatalog>('/public/presentations/catalog', options),
    );
  }

  /**
   * List Sanka Flow presentations, most recently updated first (metadata only, no decks).
   */
  list(
    params: PresentationListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PresentationList> {
    return presentationRequests(this._client, FLOW_PRESENTATIONS).list(params, options);
  }

  /**
   * Create a presentation from deck JSON, Markdown, a Markdown Doc, or just a title.
   */
  create(params: PresentationCreateParams, options?: RequestOptions): APIPromise<Presentation> {
    return presentationRequests(this._client, FLOW_PRESENTATIONS).create(params, options);
  }

  /**
   * Get a presentation: the deck with its slide and block IDs, its revision and an outline.
   */
  retrieve(
    presentationID: string,
    params: PresentationRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Presentation> {
    return presentationRequests(this._client, FLOW_PRESENTATIONS).retrieve(presentationID, params, options);
  }

  /**
   * Replace the whole deck at `expectedRevision`; a stale revision fails with
   * PRESENTATION_REVISION_CONFLICT.
   */
  replace(
    presentationID: string,
    params: PresentationReplaceParams,
    options?: RequestOptions,
  ): APIPromise<Presentation> {
    return presentationRequests(this._client, FLOW_PRESENTATIONS).replace(presentationID, params, options);
  }

  /**
   * Apply edit operations at `expectedRevision`, all or nothing.
   */
  update(
    presentationID: string,
    params: PresentationUpdateParams,
    options?: RequestOptions,
  ): APIPromise<Presentation> {
    return presentationRequests(this._client, FLOW_PRESENTATIONS).update(presentationID, params, options);
  }

  /**
   * Upload an image (multipart) to the presentation; reference its `assetId` in the deck.
   */
  uploadImage(
    presentationID: string,
    params: PresentationUploadImageParams,
    options?: RequestOptions,
  ): APIPromise<PresentationImage> {
    return presentationRequests(this._client, FLOW_PRESENTATIONS).uploadImage(
      presentationID,
      params,
      options,
    );
  }

  /**
   * Fetch a public https:// image into the presentation, with its metadata stripped.
   */
  importImage(
    presentationID: string,
    params: PresentationImportImageParams,
    options?: RequestOptions,
  ): APIPromise<PresentationImage> {
    return presentationRequests(this._client, FLOW_PRESENTATIONS).importImage(
      presentationID,
      params,
      options,
    );
  }

  /**
   * Render slide images (base64) with each slide's fit; an overflow means the content did not fit.
   */
  preview(
    presentationID: string,
    params: PresentationPreviewParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PresentationPreview> {
    return presentationRequests(this._client, FLOW_PRESENTATIONS).preview(presentationID, params, options);
  }

  /**
   * Start a PowerPoint or PDF export of the current revision; poll it until it is completed.
   */
  createExport(
    presentationID: string,
    params: PresentationCreateExportParams,
    options?: RequestOptions,
  ): APIPromise<PresentationExport> {
    return presentationRequests(this._client, FLOW_PRESENTATIONS).createExport(
      presentationID,
      params,
      options,
    );
  }

  /**
   * Get an export's status, progress, warnings and, once completed, its download path.
   */
  retrieveExport(
    presentationID: string,
    exportID: string,
    params: PresentationExportParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PresentationExport> {
    return presentationRequests(this._client, FLOW_PRESENTATIONS).retrieveExport(
      presentationID,
      exportID,
      params,
      options,
    );
  }

  /**
   * Download a completed export's `.pptx` or `.pdf` file, while it has not expired (7 days).
   */
  downloadExport(
    presentationID: string,
    exportID: string,
    params: PresentationExportParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Response> {
    return presentationRequests(this._client, FLOW_PRESENTATIONS).downloadExport(
      presentationID,
      exportID,
      params,
      options,
    );
  }

  /**
   * Cancel a queued or running export; a finished export is returned as it is.
   */
  cancelExport(
    presentationID: string,
    exportID: string,
    params: PresentationExportParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PresentationExport> {
    return presentationRequests(this._client, FLOW_PRESENTATIONS).cancelExport(
      presentationID,
      exportID,
      params,
      options,
    );
  }
}

/** Presentations in a Sanka (migration) program's Docs. */
export class ProgramPresentations extends APIResource {
  /**
   * List a Sanka program's presentations, most recently updated first (metadata only, no decks).
   */
  list(
    programID: string,
    params: PresentationListParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PresentationList> {
    return programRequests(this._client, programID).list(params, options);
  }

  /**
   * Create a presentation in a Sanka program's Docs from deck JSON, Markdown, a Markdown Doc, or
   * just a title.
   */
  create(
    programID: string,
    params: PresentationCreateParams,
    options?: RequestOptions,
  ): APIPromise<Presentation> {
    return programRequests(this._client, programID).create(params, options);
  }

  /**
   * Get a Sanka program presentation: the deck with its slide and block IDs, its revision and an
   * outline.
   */
  retrieve(
    programID: string,
    presentationID: string,
    params: PresentationRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Presentation> {
    return programRequests(this._client, programID).retrieve(presentationID, params, options);
  }

  /**
   * Replace the whole deck of a Sanka program presentation at `expectedRevision`.
   */
  replace(
    programID: string,
    presentationID: string,
    params: PresentationReplaceParams,
    options?: RequestOptions,
  ): APIPromise<Presentation> {
    return programRequests(this._client, programID).replace(presentationID, params, options);
  }

  /**
   * Apply edit operations to a Sanka program presentation at `expectedRevision`, all or nothing.
   */
  update(
    programID: string,
    presentationID: string,
    params: PresentationUpdateParams,
    options?: RequestOptions,
  ): APIPromise<Presentation> {
    return programRequests(this._client, programID).update(presentationID, params, options);
  }

  /**
   * Upload an image (multipart) to a Sanka program presentation; reference its `assetId` in the
   * deck.
   */
  uploadImage(
    programID: string,
    presentationID: string,
    params: PresentationUploadImageParams,
    options?: RequestOptions,
  ): APIPromise<PresentationImage> {
    return programRequests(this._client, programID).uploadImage(presentationID, params, options);
  }

  /**
   * Fetch a public https:// image into a Sanka program presentation, with its metadata stripped.
   */
  importImage(
    programID: string,
    presentationID: string,
    params: PresentationImportImageParams,
    options?: RequestOptions,
  ): APIPromise<PresentationImage> {
    return programRequests(this._client, programID).importImage(presentationID, params, options);
  }

  /**
   * Render slide images (base64) of a Sanka program presentation with each slide's fit.
   */
  preview(
    programID: string,
    presentationID: string,
    params: PresentationPreviewParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PresentationPreview> {
    return programRequests(this._client, programID).preview(presentationID, params, options);
  }

  /**
   * Start a PowerPoint or PDF export of a Sanka program presentation; poll it until it is
   * completed.
   */
  createExport(
    programID: string,
    presentationID: string,
    params: PresentationCreateExportParams,
    options?: RequestOptions,
  ): APIPromise<PresentationExport> {
    return programRequests(this._client, programID).createExport(presentationID, params, options);
  }

  /**
   * Get a Sanka program presentation export's status, progress, warnings and download path.
   */
  retrieveExport(
    programID: string,
    presentationID: string,
    exportID: string,
    params: PresentationExportParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PresentationExport> {
    return programRequests(this._client, programID).retrieveExport(presentationID, exportID, params, options);
  }

  /**
   * Download a completed Sanka program presentation export's `.pptx` or `.pdf` file.
   */
  downloadExport(
    programID: string,
    presentationID: string,
    exportID: string,
    params: PresentationExportParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<Response> {
    return programRequests(this._client, programID).downloadExport(presentationID, exportID, params, options);
  }

  /**
   * Cancel a queued or running Sanka program presentation export.
   */
  cancelExport(
    programID: string,
    presentationID: string,
    exportID: string,
    params: PresentationExportParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<PresentationExport> {
    return programRequests(this._client, programID).cancelExport(presentationID, exportID, params, options);
  }
}
