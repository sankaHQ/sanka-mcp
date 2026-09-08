# Connected client names

The HTTP transport passes the MCP client name discovered during initialization
(or the existing header fallback) into authentication. Connect Sanka links carry
an optional signed `client_name` claim, trimmed and limited to 255 characters.
The API stores it on the approved session so Integrations can show the name
before the first tool call. Missing names keep the existing unnamed fallback.

Deploy the companion sanka-api session-column migration and API change first.
Older API versions safely ignore the optional claim, but will not save the name.
Existing sessions can reconnect to save it; tool-call logs remain the fallback.
No MCP tools, schemas, or plugin instructions change, so sanka-plugin does not
need regeneration.
