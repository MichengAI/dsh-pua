# Upstream sync runbook

Agent-executable procedure for syncing this fork with its two upstreams. Policy: docs/adr/0003-upstream-sync-policy.md. Vocabulary: GLOSSARY.md (plugin upstream, material upstream, translation baseline, sync generation).

Recorded baseline (zero drift as of 2026-10-17): plugin upstream `MichengAI/dsh-pua` at `1d2e60988673c8f289903181914c5e91aae391dc` (v0.3.28); material upstream `tanweai/pua` at `e6e6cd237ad17750d179674bff52f8184abea8fd` (v3.5.1). The machine-readable copy of this baseline lives in `assets/pua/upstream.json` (`pluginUpstream` for the plugin side, top-level `revision`/`version` for the material side).

## 0. Preconditions

- A sync starts from a clean tree on a fresh branch; never sync on top of uncommitted work.
- Read docs/adr/0001, docs/adr/0002 and docs/adr/0003 before touching anything.
- Clone the upstreams into a scratch directory, never into this repo:

```bash
git clone https://github.com/MichengAI/dsh-pua.git "$TMP/dsh-pua"
git clone https://github.com/tanweai/pua.git "$TMP/pua"
```

## 1. Detect drift and file the ticket

Plugin side — compare the recorded baseline with the current head:

```bash
git ls-remote https://github.com/MichengAI/dsh-pua.git refs/heads/main
git ls-remote --tags https://github.com/MichengAI/dsh-pua.git
```

Material side — same, plus the upstream changelog for release notes:

```bash
git ls-remote https://github.com/tanweai/pua.git refs/heads/main
git -C "$TMP/pua" log --oneline <pinned-revision>..HEAD
git -C "$TMP/pua" diff --stat <pinned-revision>..HEAD
# Upstream writes per-release notes into CHANGELOG.md; read the entries newer than the pin.
```

Then run the fork's drift detector against both clones (read-only):

```bash
node scripts/sync-upstream.mjs --material "$TMP/pua" --plugin "$TMP/dsh-pua"
```

Open a ticket from docs/agents/sync-ticket.md and paste the detector output into it. The ticket is the spec the rest of this runbook executes.

## 2. Start the branch

```bash
git switch -c sync/upstream-<plugin-version> main
```

## 3. Material refresh (content-only branch)

Do this first: it is mechanical, and it makes the manifest consistent before any code merge.

1. Record the upstream delta per vendored file. For each changed file, read the upstream diff and translate **only** the changed passage into the corresponding English file. Never rebuild a file from upstream Chinese: the English wording is the source of truth for everything upstream did not touch.
   ```bash
   git -C "$TMP/pua" diff <pinned-revision>..<target-revision> -- skills/pua/SKILL.md
   ```
2. Ignore whitespace-only churn. If `git -C "$TMP/pua" diff -w <old>..<new> -- <path>` is empty, the English file does not change at all.
3. Keep the frozen structures intact while translating: hook heredoc markers and `case` labels (`assets/pua/upstream/hooks/*.sh`), the four `EOF_OUTPUT` blocks and their level counts, the `FLAVOR_CONTEXT` lines, the 15 flavor blocks with 8 `PUA_*` assignments each, and the zero-CJK rule plus the activation token `[PUA ACTIVE 🔥]` / `[PUA ACTIVE]` (see GLOSSARY.md and docs/adr/0002).
4. Advance the manifest pins (never hand-edit them):
   ```bash
   node scripts/sync-upstream.mjs --material "$TMP/pua" --revision <target-revision> --version <target-version> --write
   ```
5. Validate: `npm run build && npm run verify`. `scripts/verify.mjs` recomputes every `contentSha256` from the current bytes and asserts the zero-CJK rule.

## 4. Plugin merge (code layer)

```bash
git remote add upstream https://github.com/MichengAI/dsh-pua.git   # once
git fetch upstream --tags
git merge upstream/main            # or: git merge <target-revision>
```

Every file the upstream changed in `src/**` conflicts. For each conflicted path:

```bash
git diff <baseline-revision>..<target-revision> -- src/i18n.ts   # what upstream actually changed
```

Re-express that change in English in the fork's file, then `git add` it. Rules:

- Never use `-X theirs`, `-X ours`, or `git checkout --theirs`: they discard one side and produce a green build with a silently dropped upstream fix.
- Keep the fork's deliberate Chinese compat data out of the merge (the zh trigger/flavor aliases in `src/args.ts` and `src/flavors.ts`, the zh/ru UI dictionaries, the legacy session literals in `src/state.ts`) unless upstream actually changed those code paths; GLOSSARY.md lists them.
- Re-run the marker audit if upstream added narration strings: bracketed marker names are title-cased and the ASCII sentinels are frozen (GLOSSARY.md, docs/adr/0002).

Confirm nothing else moved: `git log --oneline <baseline-revision>..<target-revision>` and check each commit is accounted for by either a conflict resolution or an already-consistent file.

## 5. Structural-change gate

Stop and ask a human when upstream adds or removes a file or asset, adds or removes a flavor or mode, changes what a methodology means, would require widening the zero-CJK exemptions or `MAX_PROMPT_BYTES`, or changes LICENSE/NOTICE. Put the proposed mapping in the ticket (new upstream flavor -> fork flavor? new mode -> `MODES`? new manifest entry?) and wait for approval. A structural change blocks the release until the new material is fully translated.

## 6. Legacy duplicate assets (separate cleanup ticket)

The 19 top-level duplicate assets (`assets/pua/flavors.md`, 15 `methodology-*.md`, 3 `command-*.md`) have their own cleanup ticket, [#1](https://github.com/phucnd0604/dsh-pua-en/issues/1): they are never loaded at runtime (`SourceCatalog` only reads `upstream/**`) and are deleted together with the `scripts/verify.mjs` legacy assertion, taking the manifest from 104 to 85 entries. Do the deletion as its own commit, never inside a sync branch, and do not run the fork's own tag/version bump until it has landed.

## 7. Bump the fork version and record the baseline

Per docs/adr/0003 decision 2: MINOR + 1 when the plugin upstream's MINOR or MAJOR moved, PATCH + 1 for a small or material-only refresh. Update `package.json`/`package-lock.json`, add a `CHANGELOG.md` entry naming both upstream revisions, and update `pluginUpstream` in `assets/pua/upstream.json` to the merged plugin revision:

```bash
node scripts/sync-upstream.mjs --plugin "$TMP/dsh-pua" --set-plugin-baseline <merged-revision> --version <plugin-version> --write
npm run check
```

## 8. Acceptance checklist (all must be true before the PR)

- `npm ci --ignore-scripts && npm run check` exits 0 (typecheck, tests, verification).
- `npm run verify` prints `zero-CJK assets` and the manifest count; no CJK offender is listed.
- `npm pack --dry-run` succeeds and the tarball content list is unchanged apart from expected files.
- `assets/pua/upstream.json` has no hand edit: its `sourceSha256`/`gitBlobSha256` come from the detector, and every entry that still matches its source keeps `contentSha256 == sourceSha256`.
- The `pluginUpstream` baseline names the merged plugin revision.
- `CHANGELOG.md` names both upstream revisions; the PR body links the ticket.
- No commit in the branch pushes to `main`, tags, publishes, or edits LICENSE/NOTICE.

## 9. PR and handoff

```bash
git push -u origin sync/upstream-<plugin-version>
gh pr create --fill --body "$(cat <<'EOF'
Sync with plugin upstream <version> and material upstream <version>.
Ticket: #<n>
Detection: node scripts/sync-upstream.mjs ...
Acceptance: npm run check green; npm run verify zero-CJK.
EOF
)"
```

The PR runs `.github/workflows/ci.yml` (three operating systems plus the host compatibility matrix). Merging and tagging stay a human action.
