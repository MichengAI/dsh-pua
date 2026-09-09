#!/usr/bin/env python3
"""Minimal, local runtime state for the PUA Claude Code hooks.

The hook host already supplies the event payload.  This helper deliberately
persists only facts that the host can prove:

* a scoped hash of ``session_id + cwd`` (never either raw value);
* confirmed tool-failure counts and the derived pressure level;
* hashes of processed ``tool_use_id`` values for idempotency; and
* a PreCompact checkpoint containing those numeric facts.

On an official SessionStart ``source == "clear"`` event, the helper removes
only that exact hashed scope's local numeric state.  A host that reuses a
session id after ``/clear`` therefore cannot restore or escalate the prior
task's observations.

It does not read transcripts, prompts, model reasoning, tool input, tool
output, or error text, and it never writes a long-term memory/journal.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time
from typing import Any, Dict, Iterator, Optional, Tuple


SCHEMA_VERSION = 1
MAX_PROCESSED_IDS = 128
MAX_FAILURE_COUNT = 1_000_000
LOCK_TIMEOUT_SECONDS = 1.0
STALE_LOCK_SECONDS = 30.0


def utc_timestamp() -> str:
    """Return an auditable UTC timestamp without inspecting user content."""

    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def emit(action: str, count: int = 0, level: int = 0, scope: str = "-") -> None:
    """Emit a machine-readable, non-sensitive response for the shell wrappers."""

    print(f"{action}\t{count}\t{level}\t{scope}")


def read_payload() -> Dict[str, Any]:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError, ValueError):
        return {}
    return payload if isinstance(payload, dict) else {}


def scoped_identity(payload: Dict[str, Any], cwd_override: str) -> Optional[Tuple[str, str]]:
    """Bind all state to a real Claude session and workspace.

    A missing official identity is intentionally ignored rather than guessed.
    Guessing from a global file or shell fallback would recreate the old
    cross-session contamination bug.
    """

    session_id = payload.get("session_id")
    cwd = cwd_override or payload.get("cwd")
    if not isinstance(session_id, str) or not session_id.strip():
        return None
    if not isinstance(cwd, str) or not cwd.strip():
        return None

    # Resolve the path on the host Python runtime. The shell wrappers convert
    # Git-Bash paths with cygpath before passing --cwd to native Windows Python.
    canonical_cwd = os.path.realpath(os.path.abspath(cwd))
    material = f"pua-runtime-v{SCHEMA_VERSION}\0{session_id}\0{canonical_cwd}".encode(
        "utf-8", "surrogatepass"
    )
    scope = hashlib.sha256(material).hexdigest()
    return scope, scope[:12]


def state_root(home: str, configured_state_dir: str) -> Path:
    """Return the trusted process-local state directory.

    ``configured_state_dir`` comes only from the wrapper's PUA_STATE_DIR
    environment variable, never from the untrusted hook payload.  It is useful
    for an isolated Claude/cc0 process or tests; the normal persistent default
    remains HOME/.pua/runtime-state.
    """

    if configured_state_dir:
        return Path(configured_state_dir)
    return Path(home) / ".pua" / "runtime-state"


def state_path(home: str, configured_state_dir: str, scope: str) -> Path:
    return state_root(home, configured_state_dir) / f"{scope}.json"


def clamp_int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return max(0, min(number, MAX_FAILURE_COUNT))


def pressure_level(count: int) -> int:
    if count >= 5:
        return 4
    if count == 4:
        return 3
    if count == 3:
        return 2
    if count == 2:
        return 1
    return 0


def default_state(scope: str) -> Dict[str, Any]:
    now = utc_timestamp()
    return {
        "schema_version": SCHEMA_VERSION,
        "scope_fingerprint": scope,
        "failure_count": 0,
        "peak_pressure_level": 0,
        "processed_tool_use_ids": [],
        "created_at": now,
        "updated_at": now,
    }


def normalize_state(raw: Any, scope: str) -> Dict[str, Any]:
    """Discard malformed/unneeded fields instead of preserving user content."""

    state = default_state(scope)
    if not isinstance(raw, dict):
        return state

    state["failure_count"] = clamp_int(raw.get("failure_count"))
    state["peak_pressure_level"] = max(
        pressure_level(state["failure_count"]),
        min(4, clamp_int(raw.get("peak_pressure_level"))),
    )
    if isinstance(raw.get("created_at"), str):
        state["created_at"] = raw["created_at"]

    processed = raw.get("processed_tool_use_ids")
    if isinstance(processed, list):
        state["processed_tool_use_ids"] = [
            value
            for value in processed[-MAX_PROCESSED_IDS:]
            if isinstance(value, str)
            and len(value) == 64
            and all(char in "0123456789abcdef" for char in value)
        ]

    checkpoint = raw.get("checkpoint")
    if isinstance(checkpoint, dict) and isinstance(checkpoint.get("saved_at"), str):
        # Store only numeric runtime observations and a timestamp; no task text,
        # paths, commands, outputs, secrets, or hidden reasoning are retained.
        state["checkpoint"] = {
            "saved_at": checkpoint["saved_at"],
            "kind": "tool_observation_only",
            "failure_count": clamp_int(checkpoint.get("failure_count")),
            "peak_pressure_level": min(4, clamp_int(checkpoint.get("peak_pressure_level"))),
        }
    return state


def load_state(path: Path, scope: str) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)
    except (OSError, json.JSONDecodeError, ValueError):
        raw = None
    return normalize_state(raw, scope)


def write_state(path: Path, state: Dict[str, Any]) -> None:
    root = path.parent
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    try:
        os.chmod(root, 0o700)
    except OSError:
        pass

    fd, temporary_name = tempfile.mkstemp(prefix=f".{path.stem}.", suffix=".tmp", dir=str(root))
    try:
        try:
            os.chmod(temporary_name, 0o600)
        except OSError:
            pass
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(state, handle, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, path)
    finally:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(temporary_name)


@contextlib.contextmanager
def lock_scope(root: Path, scope: str) -> Iterator[bool]:
    """Use a portable short lock so concurrent hooks cannot double-increment."""

    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    lock = root / f"{scope}.lock"
    deadline = time.monotonic() + LOCK_TIMEOUT_SECONDS
    acquired = False

    while time.monotonic() < deadline:
        try:
            descriptor = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            try:
                if time.time() - lock.stat().st_mtime > STALE_LOCK_SECONDS:
                    lock.unlink()
                    continue
            except OSError:
                pass
            time.sleep(0.025)
            continue
        except OSError:
            break
        else:
            os.close(descriptor)
            acquired = True
            break

    try:
        yield acquired
    finally:
        if acquired:
            with contextlib.suppress(FileNotFoundError, OSError):
                lock.unlink()


def parsed_exit_code(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def explicit_tool_response_failure(response: Any) -> bool:
    """Read only official structured failure fields, never error-text heuristics."""

    # Restrict inspection to direct host fields. Recursing through arbitrary
    # nested content could mistake a successful command's printed JSON such as
    # {"status":"error"} for a host-level tool failure.
    if not isinstance(response, dict):
        return False
    for key in ("exit_code", "exitCode"):
        exit_code = parsed_exit_code(response.get(key))
        if exit_code is not None and exit_code != 0:
            return True
    if response.get("is_error") is True:
        return True
    return False


def is_interruption(payload: Dict[str, Any]) -> bool:
    value = payload.get("is_interrupt")
    return value is True or (isinstance(value, str) and value.lower() == "true")


def confirmed_failure(payload: Dict[str, Any]) -> bool:
    event_name = payload.get("hook_event_name")
    if event_name == "PostToolUseFailure":
        # User cancellation is not evidence that the task itself failed.
        return not is_interruption(payload)
    if event_name == "PostToolUse":
        # ``tool_result`` was a legacy/non-host field. Only the current official
        # ``tool_response`` structured value participates in accounting.
        return explicit_tool_response_failure(payload.get("tool_response"))
    return False


def tool_use_hash(payload: Dict[str, Any]) -> Optional[str]:
    tool_use_id = payload.get("tool_use_id")
    if not isinstance(tool_use_id, str) or not tool_use_id.strip():
        # The host provides tool_use_id. Without it an event cannot be
        # deduplicated safely, so fail closed rather than inventing a count.
        return None
    return hashlib.sha256(tool_use_id.encode("utf-8", "surrogatepass")).hexdigest()


def command_record(payload: Dict[str, Any], home: str, configured_state_dir: str, cwd_override: str) -> None:
    if payload.get("tool_name") != "Bash" or not confirmed_failure(payload):
        emit("ignored")
        return

    identity = scoped_identity(payload, cwd_override)
    event_hash = tool_use_hash(payload)
    if identity is None or event_hash is None:
        emit("ignored")
        return
    scope, short_scope = identity
    path = state_path(home, configured_state_dir, scope)

    with lock_scope(path.parent, scope) as acquired:
        if not acquired:
            emit("ignored")
            return
        state = load_state(path, scope)
        if event_hash in state["processed_tool_use_ids"]:
            emit("duplicate", state["failure_count"], state["peak_pressure_level"], short_scope)
            return

        count = min(state["failure_count"] + 1, MAX_FAILURE_COUNT)
        level = pressure_level(count)
        state["failure_count"] = count
        state["peak_pressure_level"] = max(state["peak_pressure_level"], level)
        state["processed_tool_use_ids"] = (state["processed_tool_use_ids"] + [event_hash])[-MAX_PROCESSED_IDS:]
        state["updated_at"] = utc_timestamp()
        write_state(path, state)
        emit("updated", count, state["peak_pressure_level"], short_scope)


def command_checkpoint(payload: Dict[str, Any], home: str, configured_state_dir: str, cwd_override: str) -> None:
    if payload.get("hook_event_name") != "PreCompact":
        emit("ignored")
        return
    identity = scoped_identity(payload, cwd_override)
    if identity is None:
        emit("ignored")
        return
    scope, short_scope = identity
    path = state_path(home, configured_state_dir, scope)

    with lock_scope(path.parent, scope) as acquired:
        if not acquired:
            emit("ignored")
            return
        state = load_state(path, scope)
        state["checkpoint"] = {
            "saved_at": utc_timestamp(),
            "kind": "tool_observation_only",
            "failure_count": state["failure_count"],
            "peak_pressure_level": state["peak_pressure_level"],
        }
        state["updated_at"] = utc_timestamp()
        write_state(path, state)
        emit("saved", state["failure_count"], state["peak_pressure_level"], short_scope)


def command_restore(payload: Dict[str, Any], home: str, configured_state_dir: str, cwd_override: str) -> None:
    if payload.get("hook_event_name") != "SessionStart":
        emit("ignored")
        return
    # Defense in depth for callers other than session-restore.sh: an official
    # /clear event is a fresh-context boundary, never a restore request.
    if payload.get("source") == "clear":
        emit("ignored")
        return
    identity = scoped_identity(payload, cwd_override)
    if identity is None:
        emit("ignored")
        return
    scope, short_scope = identity
    path = state_path(home, configured_state_dir, scope)
    if not path.is_file():
        emit("ignored")
        return
    state = load_state(path, scope)
    checkpoint = state.get("checkpoint")
    if not isinstance(checkpoint, dict) or not isinstance(checkpoint.get("saved_at"), str):
        emit("ignored")
        return
    emit(
        "restored",
        clamp_int(checkpoint.get("failure_count")),
        min(4, clamp_int(checkpoint.get("peak_pressure_level"))),
        short_scope,
    )


def command_clear(payload: Dict[str, Any], home: str, configured_state_dir: str, cwd_override: str) -> None:
    """Forget only this plugin's exact scope on an official ``/clear`` event.

    This intentionally neither traverses the configured state root nor reads
    task content.  It can unlink only the SHA-256-derived state filename for
    the supplied official session/workspace identity, so other sessions and
    user files remain untouched.
    """

    if payload.get("hook_event_name") != "SessionStart" or payload.get("source") != "clear":
        emit("ignored")
        return
    identity = scoped_identity(payload, cwd_override)
    if identity is None:
        emit("ignored")
        return
    scope, short_scope = identity
    path = state_path(home, configured_state_dir, scope)

    # A no-state /clear is a no-op. In particular, do not create the default
    # runtime directory merely because a disabled/missing configuration sees a
    # clear lifecycle event.
    if not path.is_file():
        emit("cleared", 0, 0, short_scope)
        return

    with lock_scope(path.parent, scope) as acquired:
        if not acquired:
            emit("ignored")
            return
        with contextlib.suppress(FileNotFoundError, OSError):
            path.unlink()
    emit("cleared", 0, 0, short_scope)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("operation", choices=("record", "checkpoint", "restore", "clear"))
    parser.add_argument("--home", required=True)
    parser.add_argument("--state-dir", default="")
    parser.add_argument("--cwd", default="")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload = read_payload()
    if not args.home:
        emit("ignored")
        return 0
    try:
        if args.operation == "record":
            command_record(payload, args.home, args.state_dir, args.cwd)
        elif args.operation == "checkpoint":
            command_checkpoint(payload, args.home, args.state_dir, args.cwd)
        elif args.operation == "restore":
            command_restore(payload, args.home, args.state_dir, args.cwd)
        else:
            command_clear(payload, args.home, args.state_dir, args.cwd)
    except Exception:
        # A hook must never leak event contents or block the host on state I/O.
        emit("ignored")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
