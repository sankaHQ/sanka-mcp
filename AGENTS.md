# sanka-mcp

The hosted Sanka MCP server (`packages/mcp-server/`) and the TypeScript client it
uses to call the Sanka API (`src/`). Read `CONTRIBUTING.md` for setup, the
repository model, tests and linting. Workspace-wide rules live in the
sanka-project workspace `AGENTS.md`; AI-authored changes use the workspace
`sanka-pr-flow`.

## Tests

Follow the workspace `test-audit` skill.

- Before adding a test, state in the PR which failure it catches (for new
  behaviour: the specified behaviour not holding) and why no existing test at a
  stronger boundary already catches it. Tests for new behaviour go at the single
  boundary that owns it; a test that cannot name a failure is not added.
- One owner per behaviour. A tool test asserts the outgoing HTTP request and the
  tool result for a given response (see
  `tests/mcp-server/mutation-passthrough-v2.test.ts`), not that an SDK mock was
  called. Route behaviour is owned by `sanka-api`; do not re-test it here.
- Never write a test that reads source, doc or config files as text and asserts
  on the text; pins descriptions, schema metadata or other literals that are not
  a public contract; only asserts that a mock was called; asserts
  `toBeDefined`/`typeof`; asserts that a tool is registered; or computes the
  expected value with the code under test.
- Documented compatibility contracts are the exception to the literal rule: tool
  names and input schemas that are published to clients, error codes and
  retained URLs are asserted exactly, once, at their owning boundary.
- Do not write unit tests after the code to cover a diff. A regression test must
  fail on the pre-fix code; say so in the PR.
- Test lines added in a PR may not exceed non-test lines added unless the PR
  explains why (bug reproduction, new pure module, table-driven cases).
- Extend a table or `test.each` row instead of copying a test. Split or trim a
  test file above 1,500 lines before adding anything to it.
- Fix a test slower than 0.5 s. Never add sleeps, real timers or real network
  waits.
- When a behaviour-preserving refactor breaks tests, delete or rewrite them at
  the owning boundary. Do not edit assertions to match the new implementation.
- No meta-tests that require other tests, docs listings or registrations to exist.
- Deleting a low-value test is a valid change on its own. Report test and
  non-test line counts separately in the PR.
