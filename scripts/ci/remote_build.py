"""Host-local admission for Fly builds, including diagnostic build-only commands.

This coordinates one login's agents, not other hosts or deployment authorization.
Failed identical inputs require an explicit, recorded retry reason. A new image
label alone is not a changed input. The Fly child inherits the lock so loss of
the caller cannot admit a competing build while that child is still running.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import signal
import subprocess
import sys
import time
import uuid
from pathlib import Path


def is_remote_build(command: list[str]) -> bool:
    return (
        bool(command)
        and Path(command[0]).name in {"fly", "flyctl"}
        and len(command) > 1
        and command[1] == "deploy"
        and "--remote-only" in command
        and "--image" not in command
    )


def redactor(command: list[str]):
    secrets = [
        value.split("=", 1)[1]
        for index, value in enumerate(command)
        if index and command[index - 1] == "--build-secret" and "=" in value
    ]
    secrets += [os.environ.get(name, "") for name in ("SENTRY_AUTH_TOKEN", "SENTRY_API_KEY")]

    def redact(value: str) -> str:
        for secret in sorted(set(secrets) - {""}, key=len, reverse=True):
            value = value.replace(secret, "[REDACTED]")
        return value

    return redact


def fingerprint(command: list[str], cwd: Path) -> str:
    # Hash values, never retain command arguments or credentials in the ledger.
    normalized = []
    skip = False
    file_input = False
    for arg in command[1:]:
        if skip:
            skip = False
            continue
        if file_input:
            normalized.append(hashlib.sha256((cwd / arg).read_bytes()).hexdigest())
            file_input = False
            continue
        if arg == "--image-label":
            skip = True
            continue
        if arg in {"--config", "--dockerfile", "--ignorefile"}:
            file_input = True
        # Public assigns a fresh skew-protection token to each attempt; it is
        # not a fix for a build failure on otherwise identical source.
        normalized.append(
            "NEXT_DEPLOYMENT_ID=<per-release>" if arg.startswith("NEXT_DEPLOYMENT_ID=") else arg
        )
    digest = hashlib.sha256(json.dumps(normalized).encode())
    for args in (("rev-parse", "HEAD^{tree}"), ("diff", "HEAD", "--binary")):
        digest.update(subprocess.check_output(["git", *args], cwd=cwd))
    # Untracked, non-ignored Docker inputs also distinguish a diagnostic build.
    names = subprocess.check_output(
        ["git", "ls-files", "--others", "--exclude-standard", "-z"], cwd=cwd
    ).split(b"\0")
    for name in sorted(filter(None, names)):
        path = cwd / os.fsdecode(name)
        digest.update(name)
        digest.update(os.readlink(path).encode() if path.is_symlink() else path.read_bytes())
    # Fly can consume these even if they are not explicit command arguments.
    for name in sorted(os.environ):
        if name.startswith(("FLY_", "DOCKER_", "BUILDKIT_", "NEXT_PUBLIC_")):
            digest.update(name.encode() + b"=" + os.environ[name].encode())
    return digest.hexdigest()


def _write(path: Path, state: dict) -> None:
    temporary = path.with_suffix("." + uuid.uuid4().hex + ".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as output:
        json.dump(state, output, sort_keys=True)
    os.replace(temporary, path)


def _read(path: Path) -> dict:
    try:
        if path.is_symlink():
            raise RuntimeError("Remote build state must not be a symlink")
        return json.loads(path.read_text())
    except FileNotFoundError:
        return {}


def run_build(
    command: list[str], *, cwd: Path, watchdog_options: list[str] | None = None
) -> subprocess.CompletedProcess[str]:
    if not is_remote_build(command):
        raise RuntimeError(
            "Remote build guard requires a Fly deploy --remote-only command without --image"
        )
    root = Path(
        os.environ.get("SANKA_REMOTE_BUILD_DIR", Path.home() / ".local/state/sanka/remote-builds")
    )
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if root.is_symlink() or root.stat().st_uid != os.getuid() or root.stat().st_mode & 0o077:
        raise RuntimeError("Remote build state directory must be private to this login")
    fd = os.open(root / "builder.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    started = time.monotonic()
    notice = float("-inf")
    try:
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() - notice >= 30:
                    owner = _read(root / "current.json")
                    print(
                        f"REMOTE_BUILD_WAIT run={owner.get('run_id')} log={owner.get('log')}",
                        flush=True,
                    )
                    notice = time.monotonic()
                time.sleep(0.2)
        key = fingerprint(command, cwd)
        receipt = root / (key + ".json")
        previous = _read(receipt)
        owner = _read(root / "current.json")
        reason = os.environ.get("SANKA_BUILD_RETRY_REASON", "").strip()
        blocked = owner if owner.get("status") == "running" else previous
        if (
            blocked
            and blocked.get("exit_code") != 0
            and (not reason or reason == blocked.get("retry_reason"))
        ):
            raise RuntimeError(
                f"REMOTE_BUILD_BLOCKED prior_run={blocked.get('run_id')} log={blocked.get('log')}; "
                "inspect the failure and builder before retrying; set SANKA_BUILD_RETRY_REASON "
                "to record what changed. Do not repeat the same attempt from another agent."
            )
        run_id = uuid.uuid4().hex
        log = root / (run_id + ".log")
        state = {
            "run_id": run_id,
            "pid": os.getpid(),
            "key": key,
            "status": "running",
            "started_at": time.time(),
            "log": str(log),
            "retry_reason": reason,
            "release_state": os.environ.get("SANKA_RELEASE_STATE"),
            "exit_code": None,
        }
        _write(receipt, state)
        _write(root / "current.json", state)
        print(
            f"REMOTE_BUILD_OWNER run={run_id} "
            f"queue_seconds={time.monotonic() - started:.1f} log={log}",
            flush=True,
        )
        redact = redactor(command)
        print("$ " + redact(" ".join(command)), flush=True)
        lines = []
        code = 75
        launch = command
        env = dict(os.environ)
        if watchdog_options is not None:
            launch = [
                sys.executable,
                str(cwd / "scripts/ci/progress_watchdog.py"),
                *watchdog_options,
                "--",
                *command,
            ]
            env["SANKA_REMOTE_BUILD_FD"] = str(fd)
        try:
            log_fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with (
                os.fdopen(log_fd, "w") as output,
                subprocess.Popen(
                    launch,
                    cwd=cwd,
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    pass_fds=(fd,),
                    env=env,
                ) as child,
            ):
                try:
                    assert child.stdout is not None
                    for raw in child.stdout:
                        line = redact(raw)
                        lines.append(line)
                        output.write(line)
                        output.flush()
                        print(line, end="", flush=True)
                    code = child.wait()
                except BaseException:
                    child.terminate()
                    try:
                        child.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        child.kill()
                        child.wait()
                    raise
        finally:
            state.update(status="complete", exit_code=code, finished_at=time.time())
            _write(receipt, state)
            _write(root / "current.json", state)
        return subprocess.CompletedProcess([redact(arg) for arg in command], code, "".join(lines))
    finally:
        os.close(fd)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--watchdog-options", help="JSON array of Public watchdog options; starts after admission"
    )
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command

    # Turn normal cancellation into cleanup; SIGKILL still leaves a retained
    # child lock and an incomplete receipt that requires investigation.
    def stop(signum, _frame):
        raise KeyboardInterrupt

    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, stop)
    try:
        options = json.loads(args.watchdog_options) if args.watchdog_options else None
        if options is not None and (
            not isinstance(options, list) or not all(isinstance(x, str) for x in options)
        ):
            raise RuntimeError("Watchdog options must be a JSON array of strings")
        return run_build(command, cwd=Path.cwd(), watchdog_options=options).returncode
    except (RuntimeError, OSError, subprocess.CalledProcessError) as exc:
        print(f"REMOTE_BUILD_ERROR: {exc}", file=sys.stderr)
        return 75
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
