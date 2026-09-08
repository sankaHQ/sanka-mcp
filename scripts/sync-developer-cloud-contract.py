#!/usr/bin/env python3
"""Generate MCP request schemas from the shared V2 SDK OpenAPI input."""
import argparse
import json
from pathlib import Path


def refs(value):
    if isinstance(value, dict):
        if "$ref" in value:
            yield value["$ref"].rsplit("/", 1)[1]
        for item in value.values():
            yield from refs(item)
    elif isinstance(value, list):
        for item in value:
            yield from refs(item)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    spec = json.loads(args.source.read_text())
    pending = {"DeveloperCloud" + name for name in (
        "SourceUploadRequest", "CloudRunRequest", "FleetRequest", "FleetRetryRequest", "CertificateRevokeRequest"
    )}
    found = {}
    while pending:
        name = pending.pop()
        if name in found:
            continue
        found[name] = spec["components"]["schemas"][name]
        pending.update(refs(found[name]))
    found = {name.removeprefix("DeveloperCloud"): found[name] for name in sorted(found)}
    raw = json.dumps(found, indent=2).replace("#/components/schemas/DeveloperCloud", "#/$defs/")
    target = Path(__file__).resolve().parents[1] / "packages/mcp-server/src/generated/developer-cloud-schemas.ts"
    target.write_text(
        "// Generated from the maintained V2 Developer Cloud OpenAPI request schemas.\n"
        "// Run scripts/sync-developer-cloud-contract.py; do not edit by hand.\n"
        "export const developerCloudSchemas = " + raw + ";\n"
    )


if __name__ == "__main__":
    main()
