# Browser Use Worker on Fly

The `browser_use` MCP tool delegates registered browser workflows to a separate worker. The MCP server owns OAuth, audit metadata, workflow allowlisting, and confirmation gates. The worker owns persistent browser profiles and third-party UI automation.

## Production Shape

- MCP app: `sanka-mcp`
- Worker app: `sanka-browser-use-worker`
- Worker private URL: `http://sanka-browser-use-worker.internal:8787/run`
- Worker volume: `browser_use_data` mounted at `/data`
- Profile root: `/data/browser-use/profiles`
- Artifact root: `/data/browser-use/artifacts`

Keep the worker token shared only between `sanka-mcp` and `sanka-browser-use-worker`.

## First Deploy

```sh
flyctl apps create sanka-browser-use-worker --org sanka-934
flyctl volumes create browser_use_data --app sanka-browser-use-worker --region nrt --size 3
flyctl secrets set --app sanka-browser-use-worker SANKA_BROWSER_USE_WORKER_TOKEN="<shared-secret>"
flyctl deploy --remote-only -c fly.browser-use-worker.toml --app sanka-browser-use-worker
```

Then configure the MCP app to call the worker:

```sh
flyctl secrets set --app sanka-mcp \
  SANKA_BROWSER_USE_WORKER_URL="http://sanka-browser-use-worker.internal:8787/run" \
  SANKA_BROWSER_USE_WORKER_TOKEN="<shared-secret>"
```

## Profile Seeding

For HubSpot avatar workflows, seed a logged-in agent-browser profile into:

```text
/data/browser-use/profiles/<browser_profile_id>
```

Example:

```sh
tar -C packages/mcp-server/.browser-use-profiles -czf /tmp/hubspot-demo-harukaze-local.tgz hubspot-demo-harukaze-local
flyctl ssh sftp put /tmp/hubspot-demo-harukaze-local.tgz /tmp/hubspot-demo-harukaze-local.tgz --app sanka-browser-use-worker
flyctl ssh console --app sanka-browser-use-worker -C \
  "mkdir -p /data/browser-use/profiles && tar -C /data/browser-use/profiles -xzf /tmp/hubspot-demo-harukaze-local.tgz && chown -R nodejs:nodejs /data/browser-use/profiles/hubspot-demo-harukaze-local && rm /tmp/hubspot-demo-harukaze-local.tgz"
```

## HubSpot Profile Bootstrap

A raw browser profile copy is enough only when browser storage is portable across the source and target operating systems. For macOS-to-Linux bootstrap, HubSpot login cookies can be platform-bound, so use this flow:

1. Open HubSpot locally with the source profile and confirm the target portal is accessible.
2. Export cookies from the local authenticated profile with `agent-browser cookies --json`. Treat the exported file as a secret.
3. Upload the cookie file and a small importer script to the worker, import cookies into the Fly profile with `agent-browser cookies set`, then open `https://app.hubspot.com/home?portalId=<portal_id>` once with the Fly profile.
4. Delete the local cookie export and any uploaded temporary cookie files.
5. Run `browser_use` with `dry_run=true` for one company before a confirmed mutation.

## Validation

Check worker health from inside the MCP app so the private Fly hostname is tested from the real caller network:

```sh
flyctl ssh console --app sanka-mcp -C \
  "node -e \"fetch('http://sanka-browser-use-worker.internal:8787/health').then(r=>r.text()).then(console.log)\""
```

The `browser_use` MCP tool should still be run with `dry_run=true` before any confirmed mutation.
