// Ported from the upstream PUA integrity-guard.sh PreToolUse anti-cheating gate.
// Keeps the right to act separate from the rights to self-evaluate, score, and change the environment: contamination targets are denied outright,
// scoring-adjacent assets are read-only and produce an advisory injected into the model before any change.
// All classification logic is pure functions; it reads neither session nor configuration. Wiring lives in runtime.ts.

export interface IntegrityHit {
  readonly decision: "deny" | "advisory";
  readonly reason: string;
  readonly target: string;
}

export const INTEGRITY_DENIED_CODE = "PUA_INTEGRITY_GUARD_DENIED";

// These patterns are deliberately conservative: they target governance assets only and never touch ordinary business files.
const PROTECTED_WRITE_PATTERNS: readonly (readonly [RegExp, string])[] = [
  [
    /(^|\/)(tests?|__tests__|test|spec|evals?|e2e|cypress|playwright)(\/|$)|\.(test|spec)\.[A-Za-z0-9]+$|(^|\/)(playwright|cypress)\.config\./iu,
    "Grader gaming risk: tests/evals/E2E assets are scoring-adjacent.",
  ],
  [
    /(^|\/)(score|scoring|grader|verifier)(\.[A-Za-z0-9]+)?$|(^|\/)(scoring|grader|verifier)(\/|$)/iu,
    "Grader gaming risk: scoring/verifier assets must not be changed by the executor.",
  ],
  [
    /(^|\/)\.github\/workflows(\/|$)|(^|\/)ci(\/|$)|(^|\/)(buildkite|circleci|jenkins)(\/|$)/iu,
    "Environment-modification risk: CI gates are part of the verifier boundary.",
  ],
  [
    /(^|\/)(feature_contracts\.json|claude-progress\.md|progress\.json|status\.json)$/iu,
    "Self-report cheating risk: status/progress files need verifier ownership.",
  ],
  [
    /(^|\/)(memory|memories)(\/|$)|(^|\/)(decisions|failures)\.log\.jsonl$|(^|\/)CLAUDE\.md$|(^|\/)\.claude\/(settings|settings\.local)\.json$/iu,
    "Persistent-memory risk: long-term memory/status must be append-only or approved.",
  ],
  [
    /(^|\/)\.env(\.|$)|(^|\/)(secrets?|credentials?)(\.|\/|$)/iu,
    "Capability-abuse risk: secrets and environment files require human gate.",
  ],
];

const CONTAMINATION_PATTERNS: readonly (readonly [RegExp, string])[] = [
  [
    /(^|\/)(hidden[-_]?tests?|verifier[-_]?private|private[-_]?verifier|hidden[-_]?cases?)(\/|$)/iu,
    "Solution contamination risk: hidden tests/verifier-private assets must stay outside the agent workspace.",
  ],
  [
    /(^|\/)(hidden_solution|gold_patch|golden_patch|benchmark_answers?|answer_key|official_solution)(\.|\/|$)/iu,
    "Solution contamination risk: hidden solution / benchmark answer artifact detected.",
  ],
];

// Source module names (secret.ts, credentials.ts) are not credential files; this keeps an ordinary codebase from being treated as a sensitive read.
const SOURCE_FILE_EXT = "ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|cs|rb|php|vue|svelte";
const SENSITIVE_READ_PATTERNS: readonly (readonly [RegExp, string])[] = [
  [
    new RegExp(
      String.raw`(^|/)\.env(\.|$)|(^|/)(id_rsa|id_ed25519|private[-_]?key)(\.|$)|(^|/)(secrets?|credentials?)/|(^|/)(secrets?|credentials?)\.(?!(?:${SOURCE_FILE_EXT})$)`,
      "iu",
    ),
    "Capability-abuse risk: secrets and credentials require human gate.",
  ],
];

// Terminal-mutation detection. On top of the upstream bash vocabulary it adds common pwsh/cmd cmdlets and aliases,
// so Windows-style `Remove-Item tests/` or `copy gold.patch out` also hit.
const MUTATING_SHELL = /(^|[;&|()\s])(rm|del|erase|ri|mv|mi|move|cp|copy|cpi|chmod|chown|truncate|tee|touch|mkdir|rmdir|remove-item|move-item|copy-item|set-content|add-content|clear-content|out-file|new-item|git\s+(reset|clean|checkout|restore)|sed\s+(-i|--in-place)|perl\s+-p?i|python3?\s+.*open\(|node\s+.*writeFile|npm\s+version)\b|>>|>[^&]/isu;
const READING_SHELL = /(^|[;&|()\s])(cat|less|more|head|tail|type|sed|awk|grep|rg|find|python3?|node|get-content|get-childitem|get-item|select-string|gc|gci|sls)\b/iu;
const WEB_CONTAMINATION =
  /(hidden[-_\s]+solution|official[-_\s]+solution|gold[-_\s]+patch|benchmark[-_\s]+answer|swe[-_\s]?bench[-_\s]+solution|leaderboard[-_\s]+answer)/iu;

// apply/clean/rm/mv are judged separately in isMutatingGitCommand by their preview/dry-run semantics
// and never reach the lookup table; the entries stay so "which subcommands count as mutating" is defined in one place.
const GIT_MUTATING_SUBCOMMANDS = new Set([
  "reset",
  "clean",
  "checkout",
  "restore",
  "apply",
  "am",
  "rm",
  "mv",
]);
const GIT_DRY_RUN_SUBCOMMANDS = new Set(["clean", "rm", "mv"]);
const GIT_APPLY_PREVIEW_OPTIONS = ["check", "stat", "numstat", "summary"];
const GIT_GLOBAL_OPTIONS_WITH_VALUE = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--exec-path",
  "--super-prefix",
  "--config-env",
]);
const GIT_GLOBAL_OPTIONS_WITH_ATTACHED_VALUE = [
  "-C",
  "-c",
  "--git-dir=",
  "--work-tree=",
  "--namespace=",
  "--exec-path=",
  "--super-prefix=",
  "--config-env=",
];
const GIT_PATHSPEC_MAGIC = /(^:|[*?[\]{}$])/u;

const SSH_IDENTITY_RE = /\bssh\b.*-i\s/iu;
const SSH_KEY_PATH_RE = /(^|\/)\.ssh\/(id_|.*[-_]key)/iu;

interface ShellToken {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

// Approximates shlex(posix, punctuation_chars): quoted content becomes one token and ;|&()<> each become their own token,
// while every token's span in the original string is recorded so a git subcommand can be masked. Never throws.
function tokenize(command: string): ShellToken[] {
  const tokens: ShellToken[] = [];
  let index = 0;
  while (index < command.length) {
    const ch = command[index]!;
    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }
    const start = index;
    if (ch === '"' || ch === "'") {
      index += 1;
      while (index < command.length && command[index] !== ch) index += 1;
      index = Math.min(index + 1, command.length);
      tokens.push({ text: command.slice(start + 1, index - 1), start, end: index });
      continue;
    }
    if (";&|()<>".includes(ch!)) {
      while (index < command.length && ";&|()<>".includes(command[index]!))
        index += 1;
      tokens.push({ text: command.slice(start, index), start, end: index });
      continue;
    }
    while (
      index < command.length &&
      !/\s/.test(command[index]!) &&
      !"\"';&|()<>".includes(command[index]!)
    )
      index += 1;
    tokens.push({ text: command.slice(start, index), start, end: index });
  }
  return tokens;
}

function commandTokens(command: string): string[] {
  return tokenize(command)
    .map((token) => token.text)
    .filter(Boolean);
}

function isDirectGitCommand(tokens: readonly string[]): boolean {
  const executable = tokens[0]?.replace(/\\/g, "/").split("/").pop();
  return executable?.toLowerCase() === "git";
}

function gitSubcommandAndArgs(
  tokens: readonly string[],
): [string, string[]] | null {
  if (!isDirectGitCommand(tokens)) return null;
  let index = 1;
  while (index < tokens.length) {
    const arg = tokens[index]!;
    if (arg === "--") return null;
    if (arg === "-h" || arg === "--help" || arg === "--version") return null;
    if (GIT_GLOBAL_OPTIONS_WITH_VALUE.has(arg)) {
      index += 2;
      continue;
    }
    if (GIT_GLOBAL_OPTIONS_WITH_ATTACHED_VALUE.some((option) => arg.startsWith(option))) {
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      // Other git global flags (such as --no-pager) are treated as taking no value.
      index += 1;
      continue;
    }
    return [arg.toLowerCase(), tokens.slice(index + 1)];
  }
  return null;
}

function gitDryRunRequested(args: readonly string[]): boolean {
  let dryRun = false;
  for (const arg of args) {
    if (arg === "-n" || arg === "--dry-run") dryRun = true;
    else if (arg === "--no-dry-run") dryRun = false;
  }
  return dryRun;
}

function gitApplyMutates(args: readonly string[]): boolean {
  const preview = new Map(GIT_APPLY_PREVIEW_OPTIONS.map((name) => [name, false]));
  let applyOverride: boolean | undefined;
  for (const arg of args) {
    if (arg === "--apply") applyOverride = true;
    else if (arg === "--no-apply") applyOverride = false;
    for (const name of GIT_APPLY_PREVIEW_OPTIONS) {
      if (arg === `--${name}` || arg.startsWith(`--${name}=`)) preview.set(name, true);
      else if (arg === `--no-${name}`) preview.set(name, false);
    }
  }
  if (applyOverride !== undefined) return applyOverride;
  return ![...preview.values()].some(Boolean);
}

function isMutatingGitCommand(tokens: readonly string[]): boolean | null {
  const parts = gitSubcommandAndArgs(tokens);
  if (!parts) return null;
  const [subcommand, args] = parts;
  if (subcommand === "apply") return gitApplyMutates(args);
  if (GIT_DRY_RUN_SUBCOMMANDS.has(subcommand))
    return !gitDryRunRequested(args);
  if (
    subcommand === "am" &&
    args.some((arg) => arg === "--show-current-patch" || arg.startsWith("--show-current-patch="))
  )
    return false;
  return GIT_MUTATING_SUBCOMMANDS.has(subcommand);
}

// Mask only git's direct subcommand, then apply the shell heuristics: `git rm --dry-run` must not
// trip the old `rm` rule, while the redirect in `git diff > evals/out` is still a write.
function maskDirectGitSubcommand(command: string, subcommand: string): string {
  const tokens = tokenize(command);
  let sawExecutable = false;
  let globalOptionNeedsValue = false;
  for (const token of tokens) {
    if (!sawExecutable) {
      sawExecutable = true;
      continue;
    }
    if (globalOptionNeedsValue) {
      globalOptionNeedsValue = false;
      continue;
    }
    if (
      token.text === "--" ||
      /^[;&|()<>]+$/.test(token.text) ||
      token.text === "||" ||
      token.text === "&&"
    )
      return command;
    if (GIT_GLOBAL_OPTIONS_WITH_VALUE.has(token.text)) {
      globalOptionNeedsValue = true;
      continue;
    }
    if (GIT_GLOBAL_OPTIONS_WITH_ATTACHED_VALUE.some((option) => token.text.startsWith(option)))
      continue;
    if (token.text.startsWith("-")) continue;
    if (token.text.toLowerCase() !== subcommand) return command;
    return command.slice(0, token.start) + "__pua_git_subcommand__" + command.slice(token.end);
  }
  return command;
}

function isMutatingCommand(command: string): boolean {
  const tokens = commandTokens(command);
  const gitMutates = isMutatingGitCommand(tokens);
  if (gitMutates === true) return true;
  let candidate = command;
  if (gitMutates === false) {
    const parts = gitSubcommandAndArgs(tokens);
    if (parts) candidate = maskDirectGitSubcommand(command, parts[0]!);
  }
  if (MUTATING_SHELL.test(candidate)) return true;
  // A Python one-liner usually writes inside quotes, so probe for write APIs directly without relying on word boundaries.
  return /python3?\s+.*(open\(|write_text\(|write_bytes\(|Path\([^)]*\)\.write)/isu.test(
    command,
  );
}

function normPath(path: string): string {
  return path.replaceAll("\\", "/");
}

const PATH_KEYS = new Set(["file_path", "path", "notebook_path", "pattern", "glob"]);

function collectPaths(value: unknown, skip: ReadonlySet<string> = new Set()): string[] {
  const paths: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) paths.push(...collectPaths(item, skip));
    return paths;
  }
  if (typeof value !== "object" || value === null) return paths;
  for (const [key, entry] of Object.entries(value)) {
    if (!skip.has(key) && PATH_KEYS.has(key) && typeof entry === "string")
      paths.push(entry);
    else paths.push(...collectPaths(entry, skip));
  }
  return paths;
}

function findReasonForPath(
  path: string,
  includeWrite: boolean,
): IntegrityHit | null {
  const normalized = normPath(path);
  for (const [rx, reason] of CONTAMINATION_PATTERNS)
    if (rx.test(normalized)) return { decision: "deny", reason, target: normalized };
  for (const [rx, reason] of SENSITIVE_READ_PATTERNS)
    if (rx.test(normalized)) return { decision: "advisory", reason, target: normalized };
  if (includeWrite)
    for (const [rx, reason] of PROTECTED_WRITE_PATTERNS)
      if (rx.test(normalized)) return { decision: "advisory", reason, target: normalized };
  return null;
}

// A real path has a separator or an extension; a bare word such as the shell builtin `eval` must not
// be matched against (^|/)(evals?|tests?|…)(/|$).
function looksLikePath(value: string): boolean {
  if (value.includes("/") || value.includes("\\")) return true;
  return /\.[A-Za-z0-9]+$/.test(value);
}

function pathCandidates(tokens: readonly string[]): string[] {
  const candidates: string[] = [];
  for (const token of tokens) {
    if (!token) continue;
    const stripped = token.replace(/^["'`]+|["'`]+$/g, "");
    if (stripped && looksLikePath(stripped)) candidates.push(stripped);
    // Also catch paths embedded in quoted code strings, e.g. open("tests/fixtures.json", "w").
    for (const match of token.replaceAll("\\", "/").matchAll(/[A-Za-z0-9_.@+~:-]+(?:\/[A-Za-z0-9_.@+~:-]+)+/gu))
      candidates.push(match[0]);
  }
  return candidates;
}

function gitIncludePathCandidates(tokens: readonly string[]): string[] {
  const parts = gitSubcommandAndArgs(tokens);
  if (!parts || (parts[0] !== "apply" && parts[0] !== "am")) return [];
  const values: string[] = [];
  // The tokenizer splits --include="src/a.ts" into the two tokens `--include=` + `src/a.ts`,
  // so an empty --include= takes the next token as its value; do not mistake it for an unbounded change set.
  tokens.forEach((token, index) => {
    if (token.startsWith("--include=") && token.length > "--include=".length) {
      values.push(token.slice("--include=".length));
    } else if ((token === "--include" || token === "--include=") && index + 1 < tokens.length) {
      const value = tokens[index + 1]!;
      if (value && value !== "--") values.push(value);
    }
  });
  return values;
}

function isExplicitOrdinaryGitPath(path: string): boolean {
  const normalized = normPath(path);
  return (
    normalized.length > 0 &&
    looksLikePath(normalized) &&
    !normalized.endsWith("/") &&
    !GIT_PATHSPEC_MAGIC.test(normalized) &&
    findReasonForPath(normalized, true) === null
  );
}

function opaqueGitMutationTarget(tokens: readonly string[]): string | null {
  const parts = gitSubcommandAndArgs(tokens);
  if (!parts || isMutatingGitCommand(tokens) !== true) return null;
  const [subcommand, args] = parts;
  if (subcommand === "apply" || subcommand === "am") {
    const includePaths = gitIncludePathCandidates(tokens);
    if (includePaths.length > 0 && includePaths.every(isExplicitOrdinaryGitPath))
      return null;
    return `git ${subcommand} (unbounded target set)`;
  }
  if (subcommand === "reset" || subcommand === "checkout" || subcommand === "clean") {
    const separator = args.indexOf("--");
    if (separator >= 0) {
      const pathspecs = args.slice(separator + 1);
      if (pathspecs.length > 0 && pathspecs.every(isExplicitOrdinaryGitPath))
        return null;
    }
    return `git ${subcommand} (unbounded target set)`;
  }
  return null;
}

function isSshIdentityUsage(command: string, candidate: string): boolean {
  if (!SSH_IDENTITY_RE.test(command)) return false;
  return SSH_KEY_PATH_RE.test(normPath(candidate));
}

function commandHits(command: string): IntegrityHit | null {
  const tokens = commandTokens(command);
  // --include values carry an option prefix but are still protected paths; putting them first lets the advisory name the real asset.
  const candidates = [
    ...gitIncludePathCandidates(tokens),
    ...pathCandidates(tokens),
  ];
  const normalized = command.replaceAll("\\", "/");

  // Hidden/private answer assets are blocked even for reads.
  for (const candidate of candidates)
    for (const [rx, reason] of CONTAMINATION_PATTERNS)
      if (rx.test(normPath(candidate)))
        return { decision: "deny", reason, target: candidate };
  for (const [rx, reason] of CONTAMINATION_PATTERNS) {
    const match = rx.exec(normalized);
    if (match) return { decision: "deny", reason, target: match[0] };
  }
  if (WEB_CONTAMINATION.test(command))
    return {
      decision: "deny",
      reason: "Solution contamination risk: command appears to search/fetch benchmark or hidden answers.",
      target: command.slice(0, 160),
    };
  if (READING_SHELL.test(command)) {
    for (const candidate of candidates) {
      if (isSshIdentityUsage(command, candidate)) continue;
      for (const [rx, reason] of SENSITIVE_READ_PATTERNS)
        if (rx.test(normPath(candidate)))
          return { decision: "advisory", reason, target: candidate };
    }
  }

  // Scoring-adjacent assets require a human gate only when they are being changed.
  if (isMutatingCommand(command)) {
    for (const candidate of candidates)
      for (const [rx, reason] of PROTECTED_WRITE_PATTERNS)
        if (rx.test(normPath(candidate)))
          return { decision: "advisory", reason, target: candidate };
    // A bare-word target (`rm -rf tests`) has no separator and does not look like a path, so the normal candidates miss it;
    // non-flag tokens are then anchored as whole words as a fallback; the cost is that a rare bare word like `rm eval`
    // also hits evals? and yields an advisory — a warning, not a block.
    for (const token of tokens.slice(1)) {
      if (!token || token.startsWith("-") || /^[;&|()<>]+$/.test(token)) continue;
      for (const [rx, reason] of PROTECTED_WRITE_PATTERNS)
        if (rx.test(normPath(token)))
          return { decision: "advisory", reason, target: token };
    }
    for (const [rx, reason] of PROTECTED_WRITE_PATTERNS) {
      const match = rx.exec(normalized);
      if (match) return { decision: "advisory", reason, target: match[0] };
    }
    const opaqueTarget = opaqueGitMutationTarget(tokens);
    if (opaqueTarget)
      return {
        decision: "advisory",
        reason:
          "Grader gaming risk: Git mutation target set cannot be proven limited to ordinary source paths.",
        target: opaqueTarget,
      };
  }
  return null;
}

const WRITE_TOOLS = new Set(["write", "edit"]);
const READ_TOOLS = new Set(["read", "grep", "glob"]);
const WEB_TOOLS = new Set([
  "web_search",
  "web_fetch",
  "advanced_search",
  "platform_search",
  "multi_search",
]);
const TERMINAL_TOOLS =
  /^(pwsh|powershell|bash|sh|zsh|terminal|exec_command|shell|shell_command|run_terminal_cmd)$/iu;

function webQueryText(args: unknown): string {
  if (typeof args !== "object" || args === null) return "";
  const parts: string[] = [];
  for (const key of ["query", "queries", "url", "prompt"]) {
    const value = (args as Record<string, unknown>)[key];
    if (typeof value === "string") parts.push(value);
    else if (Array.isArray(value))
      parts.push(...value.map((item) => String(item ?? "")));
  }
  return parts.join("\n");
}

export function classifyToolCall(name: string, args: unknown): IntegrityHit | null {
  // DSH tool names are all lowercase; normalize case once more here to accommodate host naming
  // such as Read/Write/Bash and keep the whole defense line from failing open when the sets miss.
  const tool = name.toLowerCase();
  if (WRITE_TOOLS.has(tool)) {
    for (const path of collectPaths(args)) {
      const hit = findReasonForPath(path, true);
      if (hit) return hit;
    }
    return null;
  }
  if (READ_TOOLS.has(tool)) {
    // A grep/glob pattern is a search string, not a file path. Searching for answer_key must not be taken as reading a benchmark answer.
    const skip = tool === "grep" || tool === "glob" ? new Set(["pattern"]) : undefined;
    for (const path of collectPaths(args, skip)) {
      const hit = findReasonForPath(path, false);
      if (hit) return hit;
    }
    if (tool === "glob") {
      const pattern =
        typeof args === "object" && args !== null
          ? (args as { pattern?: unknown }).pattern
          : undefined;
      if (typeof pattern === "string" && looksLikePath(pattern)) {
        const hit = findReasonForPath(pattern, false);
        if (hit?.decision === "deny") return hit;
      }
    }
    return null;
  }
  if (TERMINAL_TOOLS.test(tool)) {
    const command =
      typeof args === "object" && args !== null
        ? String((args as Record<string, unknown>).command ?? "")
        : "";
    return commandHits(command);
  }
  if (WEB_TOOLS.has(tool)) {
    const query = webQueryText(args);
    if (query && WEB_CONTAMINATION.test(query))
      return {
        decision: "deny",
        reason:
          "Solution contamination risk: searching for benchmark/hidden answers can poison the task.",
        target: query.slice(0, 160),
      };
  }
  return null;
}

export function integrityDenyReason(hit: IntegrityHit): string {
  return (
    `PUA Integrity Guard: ${hit.reason} Four-power separation is active: ` +
    "action right, self-evaluation right, scoring right, and environment-modification right must remain separate. " +
    `Target: ${hit.target}`
  );
}

export function integrityContext(hit: IntegrityHit): string {
  return hit.decision === "deny"
    ? `PUA Integrity Guard: DENY — ${hit.reason} Target: ${hit.target}`
    : `PUA Integrity Guard (advisory): ${hit.reason} Target: ${hit.target}`;
}
