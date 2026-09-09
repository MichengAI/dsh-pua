#!/usr/bin/env bash
# PUA Integrity Guard — PreToolUse anti-cheating gate
# Separates action rights from scoring / verifier / environment-modification rights.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/flavor-helper.sh"
PUA_PY="$(pua_python_cmd 2>/dev/null || true)"
[ -n "$PUA_PY" ] || exit 0
PUA_CONFIG_PY="$(pua_to_python_path "$(pua_config_file)")"
export PUA_CONFIG_PY

TMP_INPUT=$(mktemp)
trap 'rm -f "$TMP_INPUT"' EXIT
cat > "$TMP_INPUT"

"$PUA_PY" - "$TMP_INPUT" <<'PY'
import io
import json
import os
import re
import shlex
import sys
from pathlib import Path

input_path = Path(sys.argv[1])
try:
    data = json.loads(input_path.read_text(encoding='utf-8') or '{}')
except Exception:
    sys.exit(0)

PUA_MARKERS = [
    'PUA ACTIVATED',
    'PUA Always-On',
    'PUA生效',
    '[PUA',
    'pua:pua',
    'pua-loop',
    'Confidence Gate',
]


def read_text_tail(path: str, max_bytes: int = 200_000) -> str:
    try:
        p = Path(path).expanduser()
        if not p.is_file():
            return ''
        size = p.stat().st_size
        with p.open('rb') as f:
            if size > max_bytes:
                f.seek(size - max_bytes)
            return f.read().decode('utf-8', errors='ignore')
    except Exception:
        return ''


def config_always_on() -> bool:
    cfg = os.environ.get('PUA_CONFIG_PY') or os.environ.get('PUA_CONFIG') or str(Path.home() / '.pua' / 'config.json')
    try:
        return bool(json.loads(Path(cfg).expanduser().read_text(encoding='utf-8')).get('always_on', False))
    except Exception:
        return False


def is_active() -> bool:
    if os.environ.get('PUA_INTEGRITY_FORCE') == '1' or os.environ.get('PUA_FORCE_ON') == '1':
        return True
    if config_always_on():
        return True
    transcript = data.get('transcript_path') or ''
    text = read_text_tail(transcript)
    return any(marker in text for marker in PUA_MARKERS)

if not is_active():
    sys.exit(0)

tool = data.get('tool_name') or ''
tool_input = data.get('tool_input') or {}

# Keep these patterns intentionally conservative: they target governance assets,
# not ordinary application files.
PROTECTED_WRITE_PATTERNS = [
    (re.compile(r'(^|/)(tests?|__tests__|test|spec|evals?|e2e|cypress|playwright)(/|$)|\.(test|spec)\.[A-Za-z0-9]+$|(^|/)(playwright|cypress)\.config\.', re.I), 'Grader gaming risk: tests/evals/E2E assets are scoring-adjacent.'),
    (re.compile(r'(^|/)(score|scoring|grader|verifier)(\.[A-Za-z0-9]+)?$|(^|/)(scoring|grader|verifier)(/|$)', re.I), 'Grader gaming risk: scoring/verifier assets must not be changed by the executor.'),
    (re.compile(r'(^|/)\.github/workflows(/|$)|(^|/)ci(/|$)|(^|/)(buildkite|circleci|jenkins)(/|$)', re.I), 'Environment-modification risk: CI gates are part of the verifier boundary.'),
    (re.compile(r'(^|/)(feature_contracts\.json|claude-progress\.md|progress\.json|status\.json)$', re.I), 'Self-report cheating risk: status/progress files need verifier ownership.'),
    (re.compile(r'(^|/)(memory|memories)(/|$)|(^|/)(decisions|failures)\.log\.jsonl$|(^|/)CLAUDE\.md$|(^|/)\.claude/(settings|settings\.local)\.json$', re.I), 'Persistent-memory risk: long-term memory/status must be append-only or approved.'),
    (re.compile(r'(^|/)\.env(\.|$)|(^|/)(secrets?|credentials?)(\.|/|$)', re.I), 'Capability-abuse risk: secrets and environment files require human gate.'),
]

CONTAMINATION_PATTERNS = [
    (re.compile(r'(^|/)(hidden[-_]?tests?|verifier[-_]?private|private[-_]?verifier|hidden[-_]?cases?)(/|$)', re.I), 'Solution contamination risk: hidden tests/verifier-private assets must stay outside the agent workspace.'),
    (re.compile(r'(^|/)(hidden_solution|gold_patch|golden_patch|benchmark_answers?|answer_key|official_solution)(\.|/|$)', re.I), 'Solution contamination risk: hidden solution / benchmark answer artifact detected.'),
]

SENSITIVE_READ_PATTERNS = [
    (re.compile(r'(^|/)\.env(\.|$)|(^|/)(secrets?|credentials?)(\.|/|$)|(^|/)(id_rsa|id_ed25519|private[-_]?key)(\.|$)', re.I), 'Capability-abuse risk: secrets and credentials require human gate.'),
]

MUTATING_BASH = re.compile(
    r'(^|[;&|()\s])(rm|mv|cp|chmod|chown|truncate|tee|touch|mkdir|rmdir|git\s+(reset|clean|checkout|restore)|sed\s+(-i|--in-place)|perl\s+-p?i|python3?\s+.*open\(|node\s+.*writeFile|npm\s+version)\b|>>|>[^&]',
    re.I | re.S,
)
READING_BASH = re.compile(r'(^|[;&|()\s])(cat|less|more|head|tail|sed|awk|grep|rg|find|python3?|node)\b', re.I)
WEB_CONTAMINATION = re.compile(r'(hidden[-_\s]+solution|official[-_\s]+solution|gold[-_\s]+patch|benchmark[-_\s]+answer|swe[-_\s]?bench[-_\s]+solution|leaderboard[-_\s]+answer)', re.I)
GIT_MUTATING_SUBCOMMANDS = {
    'reset', 'clean', 'checkout', 'restore', 'apply', 'am', 'rm', 'mv',
}
GIT_DRY_RUN_SUBCOMMANDS = {'clean', 'rm', 'mv'}
GIT_APPLY_PREVIEW_OPTIONS = ('check', 'stat', 'numstat', 'summary')
GIT_GLOBAL_OPTIONS_WITH_VALUE = {
    '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path',
    '--super-prefix', '--config-env',
}
GIT_GLOBAL_OPTIONS_WITH_ATTACHED_VALUE = (
    '-C', '-c', '--git-dir=', '--work-tree=', '--namespace=', '--exec-path=',
    '--super-prefix=', '--config-env=',
)
GIT_PATHSPEC_MAGIC = re.compile(r'(^:|[\*\?\[\]\{\}\$])')


def command_tokens(command: str):
    try:
        return shlex.split(command)
    except Exception:
        return re.split(r'\s+', command)


def is_direct_git_command(tokens) -> bool:
    if not tokens:
        return False
    executable = tokens[0].replace('\\', '/').rsplit('/', 1)[-1].lower()
    return executable in {'git', 'git.exe'}


def git_subcommand_and_args(tokens):
    """Return a direct Git subcommand and its arguments, if one is present."""
    if not is_direct_git_command(tokens):
        return None

    arg_index = 1
    while arg_index < len(tokens):
        arg = tokens[arg_index]
        if arg == '--':
            return None
        if arg in {'-h', '--help', '--version'}:
            return None
        if arg in GIT_GLOBAL_OPTIONS_WITH_VALUE:
            arg_index += 2
            continue
        if arg.startswith(GIT_GLOBAL_OPTIONS_WITH_ATTACHED_VALUE):
            arg_index += 1
            continue
        if arg.startswith('-'):
            # Other Git global flags (for example --no-pager) take no argument
            # for this narrow recognizer.
            arg_index += 1
            continue
        return arg.lower(), tokens[arg_index + 1:]
    return None


def git_dry_run_requested(args) -> bool:
    dry_run = False
    for arg in args:
        if arg in {'-n', '--dry-run'}:
            dry_run = True
        elif arg == '--no-dry-run':
            dry_run = False
    return dry_run


def git_apply_mutates(args) -> bool:
    """Handle apply's documented preview flags without parsing patch contents."""
    preview = {name: False for name in GIT_APPLY_PREVIEW_OPTIONS}
    apply_override = None
    for arg in args:
        if arg == '--apply':
            apply_override = True
        elif arg == '--no-apply':
            apply_override = False
        for name in GIT_APPLY_PREVIEW_OPTIONS:
            if arg == f'--{name}' or arg.startswith(f'--{name}='):
                preview[name] = True
            elif arg == f'--no-{name}':
                preview[name] = False
    if apply_override is not None:
        return apply_override
    return not any(preview.values())


def is_mutating_git_command(tokens):
    """Classify selected direct Git worktree changes and documented previews.

    Git permits forms such as ``git -C /repo restore -- evals/case.sh``.
    This intentionally handles only explicit worktree-changing subcommands and
    their common preview forms; it is not a shell parser or Git policy engine.
    """
    parts = git_subcommand_and_args(tokens)
    if parts is None:
        return None
    subcommand, args = parts
    if subcommand == 'apply':
        return git_apply_mutates(args)
    if subcommand in GIT_DRY_RUN_SUBCOMMANDS:
        return not git_dry_run_requested(args)
    if subcommand == 'am' and any(
        arg == '--show-current-patch' or arg.startswith('--show-current-patch=')
        for arg in args
    ):
        return False
    return subcommand in GIT_MUTATING_SUBCOMMANDS


def mask_direct_git_subcommand(command: str, subcommand: str) -> str:
    """Mask only Git's leading subcommand before applying the shell heuristic.

    A preview such as ``git rm --dry-run`` must not match the legacy ``rm``
    shell rule.  Conversely, ``git diff ... > evals/out`` and ``git show |
    tee tests/out`` still have shell-side effects.  This deliberately finds
    only the direct Git subcommand (including global options), rather than
    attempting to parse arbitrary shell syntax.
    """
    try:
        lexer = shlex.shlex(
            io.StringIO(command), posix=True, punctuation_chars='|&;()<>'
        )
        lexer.whitespace_split = True
        saw_executable = False
        global_option_needs_value = False
        while True:
            token_start = lexer.instream.tell()
            token = lexer.get_token()
            token_end = lexer.instream.tell()
            if token is None:
                return command
            if not saw_executable:
                saw_executable = True
                continue
            if global_option_needs_value:
                global_option_needs_value = False
                continue
            if token == '--' or token in {'|', '||', '&', '&&', ';', '(', ')', '<', '>', '>>'}:
                return command
            if token in GIT_GLOBAL_OPTIONS_WITH_VALUE:
                global_option_needs_value = True
                continue
            if token.startswith(GIT_GLOBAL_OPTIONS_WITH_ATTACHED_VALUE):
                continue
            if token.startswith('-'):
                continue
            if token.lower() != subcommand:
                return command
            raw_token = command[token_start:token_end]
            match = re.search(re.escape(subcommand), raw_token, re.I)
            if not match:
                return command
            start = token_start + match.start()
            end = token_start + match.end()
            return command[:start] + '__pua_git_subcommand__' + command[end:]
    except Exception:
        return command


def is_mutating_command(command: str) -> bool:
    tokens = command_tokens(command)
    git_mutates = is_mutating_git_command(tokens)
    if git_mutates is True:
        return True
    if git_mutates is False:
        # Do not short-circuit the generic heuristic: a read-only Git command
        # can still redirect or pipe into a separate shell write.  Mask only
        # the recognized Git subcommand so preview flags do not inherit the
        # generic ``rm``/``mv`` false positive.
        parts = git_subcommand_and_args(tokens)
        if parts is not None:
            command = mask_direct_git_subcommand(command, parts[0])
    if MUTATING_BASH.search(command):
        return True
    # Python one-liners often hide writes inside quoted code, so detect common
    # write APIs separately instead of relying on shell-token boundaries.
    return bool(re.search(r'python3?\s+.*(open\(|write_text\(|write_bytes\(|Path\([^)]*\)\.write)', command, re.I | re.S))


def norm_path(p: str) -> str:
    if not p:
        return ''
    return p.replace('\\', '/')


def collect_paths(value):
    paths = []
    if isinstance(value, dict):
        for k, v in value.items():
            if k in {'file_path', 'path', 'notebook_path', 'pattern', 'glob'} and isinstance(v, str):
                paths.append(v)
            else:
                paths.extend(collect_paths(v))
    elif isinstance(value, list):
        for item in value:
            paths.extend(collect_paths(item))
    return paths


def find_reason_for_path(path: str, include_write: bool):
    n = norm_path(path)
    for rx, reason in CONTAMINATION_PATTERNS:
        if rx.search(n):
            return 'deny', reason, n
    for rx, reason in SENSITIVE_READ_PATTERNS:
        if rx.search(n):
            return 'advisory', reason, n
    if include_write:
        for rx, reason in PROTECTED_WRITE_PATTERNS:
            if rx.search(n):
                return 'advisory', reason, n
    return None


def looks_like_path(s: str) -> bool:
    # A real path has a directory separator or a file-extension suffix; bare
    # identifiers like the shell `eval` builtin do not, and must not be matched
    # against (^|/)(evals?|tests?|spec|...)(/|$) as if they were paths.
    if '/' in s or '\\' in s:
        return True
    return bool(re.search(r'\.[A-Za-z0-9]+$', s))


def path_candidates(tokens):
    for token in tokens:
        if not token:
            continue
        stripped = token.strip("\"'`")
        if stripped and looks_like_path(stripped):
            yield stripped
        # Pull paths embedded inside code strings, e.g. open("tests/fixtures.json", "w").
        for match in re.findall(r'[A-Za-z0-9_.@+~:-]+(?:/[A-Za-z0-9_.@+~:-]+)+', token.replace('\\', '/')):
            yield match


def git_include_path_candidates(tokens):
    """Extract Git apply/am include values as paths, not option spellings."""
    parts = git_subcommand_and_args(tokens)
    if parts is None or parts[0] not in {'apply', 'am'}:
        return
    for index, token in enumerate(tokens):
        if token.startswith('--include='):
            value = token.split('=', 1)[1]
            if value:
                yield value
        elif token == '--include' and index + 1 < len(tokens):
            value = tokens[index + 1]
            if value and value != '--':
                yield value


def is_explicit_ordinary_git_path(path: str) -> bool:
    """Whether a literal path proves a Git mutation stays off protected assets."""
    normalized = norm_path(path)
    return bool(
        normalized
        and looks_like_path(normalized)
        and not normalized.endswith('/')
        and not GIT_PATHSPEC_MAGIC.search(normalized)
        and find_reason_for_path(normalized, include_write=True) is None
    )


def opaque_git_mutation_target(tokens):
    """Return a target label when a mutating Git command lacks safe scope.

    Patch application can touch an unknown set unless literal --include paths
    bound it.  reset/checkout/clean need literal pathspecs after ``--``; a
    branch, ref, or no pathspec can affect protected assets.  This is a narrow
    command-boundary check, not a Git or shell sandbox.
    """
    parts = git_subcommand_and_args(tokens)
    if parts is None or is_mutating_git_command(tokens) is not True:
        return None
    subcommand, args = parts
    if subcommand in {'apply', 'am'}:
        include_paths = list(git_include_path_candidates(tokens))
        if include_paths and all(is_explicit_ordinary_git_path(path) for path in include_paths):
            return None
        return f'git {subcommand} (unbounded target set)'
    if subcommand in {'reset', 'checkout', 'clean'}:
        if '--' in args:
            pathspecs = args[args.index('--') + 1:]
            if pathspecs and all(is_explicit_ordinary_git_path(path) for path in pathspecs):
                return None
        return f'git {subcommand} (unbounded target set)'
    return None


SSH_IDENTITY_RE = re.compile(r'\bssh\b.*-i\s', re.I)
SSH_KEY_PATH_RE = re.compile(r'(^|/)\.ssh/(id_|.*[-_]key)', re.I)


def is_ssh_identity_usage(command: str, candidate: str) -> bool:
    if not SSH_IDENTITY_RE.search(command):
        return False
    return bool(SSH_KEY_PATH_RE.search(norm_path(candidate)))


def command_hits(command: str):
    tokens = [t for t in command_tokens(command) if t]
    # Include values are protected paths even though their command-line token
    # begins with an option prefix. Put them first so advisory output names the
    # actual asset rather than ``--include=<path>``.
    candidates = list(git_include_path_candidates(tokens))
    candidates.extend(path_candidates(tokens))
    normalized = command.replace('\\', '/')

    # Hidden/private solution artifacts are blocked even for read-like commands.
    for candidate in candidates:
        for rx, reason in CONTAMINATION_PATTERNS:
            if rx.search(norm_path(candidate)):
                return 'deny', reason, candidate
    for rx, reason in CONTAMINATION_PATTERNS:
        m = rx.search(normalized)
        if m:
            return 'deny', reason, m.group(0)
    if WEB_CONTAMINATION.search(command):
        return 'deny', 'Solution contamination risk: command appears to search/fetch benchmark or hidden answers.', command[:160]
    if READING_BASH.search(command):
        for candidate in candidates:
            if is_ssh_identity_usage(command, candidate):
                continue
            for rx, reason in SENSITIVE_READ_PATTERNS:
                if rx.search(norm_path(candidate)):
                    return 'advisory', reason, candidate

    # Protected scoring assets need a human gate only when the command mutates them.
    if is_mutating_command(command):
        for candidate in candidates:
            for rx, reason in PROTECTED_WRITE_PATTERNS:
                if rx.search(norm_path(candidate)):
                    return 'advisory', reason, candidate
        for rx, reason in PROTECTED_WRITE_PATTERNS:
            m = rx.search(normalized)
            if m:
                return 'advisory', reason, m.group(0)
        opaque_target = opaque_git_mutation_target(tokens)
        if opaque_target:
            return (
                'advisory',
                'Grader gaming risk: Git mutation target set cannot be proven limited to ordinary source paths.',
                opaque_target,
            )
    return None

hit = None

if tool in {'Write', 'Edit', 'MultiEdit'}:
    for path in collect_paths(tool_input):
        hit = find_reason_for_path(path, include_write=True)
        if hit:
            break
elif tool in {'Read', 'Grep', 'Glob'}:
    for path in collect_paths(tool_input):
        hit = find_reason_for_path(path, include_write=False)
        if hit:
            break
elif tool == 'Bash':
    command = str(tool_input.get('command') or '')
    hit = command_hits(command)
elif tool in {'WebSearch', 'WebFetch'}:
    query = '\n'.join(str(tool_input.get(k) or '') for k in ('query', 'url', 'prompt'))
    if WEB_CONTAMINATION.search(query):
        hit = ('deny', 'Solution contamination risk: searching for benchmark/hidden answers can poison the task.', query[:160])

if not hit:
    sys.exit(0)

decision, reason, target = hit
message = (
    'PUA Integrity Guard: ' + reason +
    ' Four-power separation is active: action right, self-evaluation right, scoring right, and environment-modification right must remain separate. '
    f'Target: {target}'
)

output = {'hookSpecificOutput': {'hookEventName': 'PreToolUse'}}
if decision == 'deny':
    output['hookSpecificOutput']['permissionDecision'] = 'deny'
    output['hookSpecificOutput']['permissionDecisionReason'] = message
    output['hookSpecificOutput']['additionalContext'] = (
        'PUA Integrity Guard: DENY — ' + reason + f' Target: {target}'
    )
else:
    output['hookSpecificOutput']['additionalContext'] = (
        'PUA Integrity Guard (advisory): ' + reason + f' Target: {target}'
    )
print(json.dumps(output, ensure_ascii=False, separators=(',', ':')))
PY
