# Sanka Doc presentation tools

Thirteen hosted MCP tools build, preview, illustrate and export Sanka Doc presentations: slide
decks stored as Docs (`sanka.deck/v1`), in a Sanka migration program's Docs when a call passes
`program_id`, else in Sanka Flow Docs. They call the public developer API through the client's
`client.public.presentations` (Sanka Flow Docs) and `client.public.programPresentations`
(program Docs) resources in `src/resources/public/presentations.ts`. The API owns the catalog,
deck, op, image and export validation, permissions and the `docs-presentations` feature flag. The
contract and agent loop are in the workspace spec `docs/architecture/sanka-doc-presentations.md`
(§8.12 and §10).

`{base}` is `/api/v2/public/ferry/programs/{program_id}/presentations` with `program_id`, else
`/api/v2/public/documents/presentations`. The program routes keep their published `ferry` prefix;
the client and tool code use no ferry names.

| Tool                                     | Method                                        | Route                                                   |
| ---------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `get_presentation_catalog`               | GET                                           | `/api/v2/public/presentations/catalog`                  |
| `list_presentations`                     | GET                                           | `{base}`                                                |
| `create_presentation`                    | POST                                          | `{base}`                                                |
| `get_presentation`                       | GET                                           | `{base}/{presentation_id}`                              |
| `update_presentation`                    | PATCH (`ops`, or `title` alone), PUT (`deck`) | `{base}/{presentation_id}`                              |
| `preview_presentation`                   | POST (GET the deck first without `slide_ids`) | `{base}/{presentation_id}/previews`                     |
| `start_presentation_image_upload`        | none (stages bytes in the MCP server)         |                                                         |
| `append_presentation_image_upload_chunk` | none                                          |                                                         |
| `finish_presentation_image_upload`       | POST multipart (`file`, `alt`)                | `{base}/{presentation_id}/images`                       |
| `import_presentation_image`              | POST                                          | `{base}/{presentation_id}/images/import`                |
| `export_presentation`                    | POST                                          | `{base}/{presentation_id}/exports`                      |
| `get_presentation_export`                | GET                                           | `{base}/{presentation_id}/exports/{export_id}`          |
| `download_presentation_export`           | GET (binary, after the export status)         | `{base}/{presentation_id}/exports/{export_id}/download` |

The client also has `cancelExport` (`POST …/exports/{export_id}/cancel`), which no tool uses yet.

## Inputs and results

- Inputs are snake_case; request bodies use the API's camelCase (`pageSize`, `sourceDocumentId`,
  `folderId`, `sourceRef`, `expectedRevision`, `slideIds`, `includeHidden`, `includeNotes`). Slides,
  ops and decks pass through unchanged. Published tool names and input schemas only gain optional
  inputs and enum values, except that `program_id` must not be blank (a blank one used to route to
  Sanka Flow Docs) and the new image upload start tool requires `content_base64_length`.
- `create_presentation` takes at most one of `slides` (wrapped in a `sanka.deck/v1` deck with the
  optional `footer`), `markdown` and `source_doc_id` (a Markdown Doc of the same Docs to convert);
  with none the API starts one title slide. It always sends `pageSize` (`page_size`, default
  `16:9`; `a4-landscape` for printed proposals), and `theme`, `folder_id` and `source_ref` when
  given. `theme` no longer needs `slides`; `footer` without `slides` is refused before any request,
  as are two sources. Creating again with the same `source_ref` returns the existing presentation.
- `update_presentation` takes `ops` (PATCH, with a new `title` appended as a `set_title` op) or
  `deck` (PUT, with `title`), never both; a `title` alone is one `set_title` op, and a call
  without any of them sends nothing. Every update carries `expected_revision`.
- `list_presentations` returns metadata only (no decks): `presentation_id`, `title`, `revision`,
  `slide_count`, `page_size`, `theme_id`, `folder_id`, `updated_via`, `updated_at` and `app_url`,
  with `next_cursor` for the next page.
- `preview_presentation` renders at most six slides per call as JPEG (`width` 640, 960 or 1280,
  default 960). Without `slide_ids` it reads the deck, previews the first six visible slides and
  returns every other visible slide as `next_slide_id_batches` (batches of six for the next calls;
  `next_slide_ids` is the first). The result has one text block listing the slides in image order
  with any `SLIDE_OVERFLOW`, then one MCP `image` content block per slide
  (`{type: "image", data, mimeType: "image/jpeg"}`); `structuredContent` has each slide's
  `slide_id`, `index` and `fit` (`scale`, and `overflow` with `block_ids` and `overflow_px`),
  `overflowing_slide_ids` and the render `warnings`, without the image data.
- Images belong to one presentation and go in after it exists. `start_presentation_image_upload`,
  `append_presentation_image_upload_chunk` and `finish_presentation_image_upload` are built with
  `createChunkedUploadTools` in `tool-factories.ts` (the attachment chunk tools are its
  `createChunkedAttachmentUploadTools` form, unchanged): the finish tool uploads the assembled file
  as multipart `file` with the optional `alt` and returns `asset_id`. The start tool requires
  `content_base64_length`, without which append could never report `done`; a chunk carries up to
  160,000 base64 characters (about 117 KiB of image), so most images take several appends. The
  finish tool refuses unknown inputs. A finish refused before the upload (inputs, workspace) or by
  the API with a 4xx other than an `IMAGE_*` error keeps the image staged (`upload_kept: true`),
  so it can be finished again with the same `upload_token`; an `IMAGE_*` error or a server error
  closes the upload. These are options of the factory (`startRequired`, `descriptions.append` and
  `chunk`, `finish.additionalProperties`, `finish.keepUploadOnError`, the last backed by an opt-in
  `retain` of `finishBinaryUpload`) that the attachment tools do not set. The MCP upload store
  holds up to 9 MiB per file; the API takes images up to 10 MiB. `import_presentation_image`
  (`openWorldHint`) has Sanka fetch a public `https://` URL. Both return `asset_id`,
  `content_type`, `size_bytes`, `width`, `height` and `alt` for an image block or accent.
- `export_presentation` takes `format` `pptx` (the default) or `pdf`. Export results return
  `export_id`, `status`, `progress`, `revision`, `format`, `filename`, `size_bytes`, `warnings`,
  `error_code` and `error_message`, and `app_download_url` once completed. The completed text
  names `download_presentation_export` for passing the file through MCP.
- `download_presentation_export` first reads the export status: it downloads nothing until the
  export is completed, and refuses a file over 25 MiB, by the status's `size_bytes`, the declared
  `Content-Length` or, when neither is known, while streaming, pointing to `app_download_url`
  instead. It reads the file into one buffer sized from the status and encodes the base64 once,
  for `binaryDownloadResult` (the response-free half of `asBinaryDownloadResult`), which keeps it
  in the binary download store: the result has a session-bound `download_url`
  (`/downloads/{token}`) and a `download_token` for `read_binary_download_chunk`, or the base64
  inline for a small file. The 25 MiB cap bounds what one download holds in memory (about 58 MiB
  while encoding) and keeps in the shared store (about 33 MiB of base64 for 15 minutes).
- Write and read results return `presentation_id`, `title`, `revision`, `product`, `program_id`,
  `slide_count`, `app_url` and the API's static `warnings`; `get_presentation` adds `updated_via`,
  `updated_at` and either `deck` (the default, with the slide and block ids that ops use) or
  `outline`.
- `app_url` and `app_download_url` join the API's app-relative `appPath` and `downloadPath` to the
  app origin that record links use (`SANKA_V2_APP_BASE_URL`), else `https://app.sanka.com`. Public
  export responses name the developer API's download route (`/v2/public/…`); `app_download_url`
  uses the same route under `/api/v2/`, which a browser signed in to Sanka reaches through the
  app's API proxy.

## Workspace, retries and errors

- Every request carries `X-Sanka-MCP-Session-ID` when the call has an MCP session: the public
  routes resolve the workspace that session is bound to. The tools take no `workspace_id`.
- Writes (`create_presentation`, `update_presentation`, `finish_presentation_image_upload`,
  `import_presentation_image`, `export_presentation`) require `expected_workspace_id`, the
  `workspace_id` from `current_workspace`. Like the workflow tools, a write with an MCP session
  first reads `/api/v2/public/auth/session` and sends nothing when its workspace differs; without
  a session (stdio) the API check stands alone. The write then carries
  `X-Sanka-Expected-Workspace-ID` and `X-Sanka-MCP: true`, so the API rejects a mismatch again
  with 409 `WORKSPACE_CONTEXT_MISMATCH` and records the edit as made through MCP. Both cases return
  the same result: `code` and `error` `WORKSPACE_CONTEXT_MISMATCH`, the expected and current
  workspace in `details`, and text saying nothing changed and not to retry in another workspace.
- Writes and previews are sent with `maxRetries: 0`: the API checks its limit of 60 previews an
  hour before its cache, so every retried preview would render again and spend the user's quota.
  Previews also get a 90 s timeout, above the API's worst case (one render attempt of 30 s plus
  15 s of HTTP grace). Other reads and downloads keep the SDK retries. `export_presentation` sends
  `idempotency_key` as `Idempotency-Key`: the same key returns the same export, and a new key starts
  another one.
- A 4xx answer becomes `{ok: false, status: 'error', status_code, code, message, details, ctx_id}`
  with the next step in the text. `PRESENTATION_REVISION_CONFLICT` adds `current_revision` and says
  to re-read and re-apply only the intended change; `PRESENTATION_INVALID` and
  `PRESENTATION_LIMIT_EXCEEDED` list the JSON Pointer paths; `VALIDATION_ERROR`, whose `details`
  is the request's `[{loc, msg, type}]` (kept as is in `structuredContent`), lists each problem at
  the JSON Pointer of its `loc` without the leading `body` and the op name that tags an op (such as
  `/ops/0/blockId`); `PRESENTATION_OP_TARGET_NOT_FOUND`
  names the op or slide ids; `PRESENTATION_ASSET_NOT_FOUND`, `PRESENTATION_EXPORT_NOT_FOUND`,
  `IMAGE_IMPORT_BLOCKED`, `IMAGE_IMPORT_FAILED`, `IMAGE_TOO_LARGE`, `IMAGE_UNSUPPORTED`,
  `DOCUMENT_KIND_MISMATCH`, `DOCUMENT_FOLDER_CONFLICT`, `IDEMPOTENCY_KEY_REUSED`, `RATE_LIMITED`,
  404 and 403 (presentations off, or no permission) have their own hints. Server and transport
  errors, such as 503 `RENDER_UNAVAILABLE`, keep the server's generic error result.

## Scopes, guidance and validation

- The tools' metadata resource is `documents`, so they require `documents:read` or
  `documents:write`; both are in `SANKA_MCP_DELEGATED_SCOPES`, so `mcp:access` covers them.
- `get_capability_guidance` returns the `sanka_doc_presentations` family for presentation, slide,
  deck, PowerPoint, pptx, スライド, プレゼン and パワポ intents, before the migration family (a deck
  about a migration routes here). Its route is the spec §10.3 agent loop: the catalog once, the
  outline first, previews in batches of six fixing every `SLIDE_OVERFLOW`, A4 for printed
  proposals, images by upload or import with alt text, revisions on edits, then export. The
  guidance version is `2026-10-09.presentations.v2`. The initialize instructions name
  presentations among the guidance areas and stay under 8 KiB.
- `tests/mcp-server/presentation-tools.test.ts` asserts the published tool names and input schemas
  once, and sends each tool call through the SDK client to a fake fetch, checking the requests
  (headers, bodies, multipart fields), the results (including the preview image blocks), the error
  mapping, the chunked image upload and the download store. Route behaviour stays owned by
  sanka-api. The generated types in `src/generated/openapi.d.ts` add only the presentation paths,
  operations and the schemas they reference.

## Plugin

The sanka-plugin generic `sanka` skill reaches these tools through `get_capability_guidance`, and
no plugin file lists hosted tools, so nothing in sanka-plugin goes stale with this change. The
per-tool skills and the presentations router skill of the spec (§10.4) need scope rules in
`scripts/sync-codex-skill-metadata.mjs` (a `presentation` skill maps to `documents`, and
`start-`, `append-` and `finish-` skills are writes), then `scripts/sync-codex-skill-metadata.mjs`
and `scripts/sync-codex-package.mjs`. Local clients pass a local image path only once the packaged
proxy's `vendor/mcp-remote/sanka-local-file-bridge.mjs` accepts the image upload tools, as it does
the expense attachment tools.
