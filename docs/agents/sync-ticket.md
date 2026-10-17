# Upstream sync ticket template

Open one GitHub issue per sync on `phucnd0604/dsh-pua-en`, then execute docs/agents/upstream-sync.md against it. Create it with:

```bash
gh issue create --title "Sync with plugin upstream <version>" --body-file <this file with the blanks filled>
```

---

## Baseline

- Plugin upstream: `MichengAI/dsh-pua` at `<revision>` (v<version>)
- Material upstream: `tanweai/pua` at `<revision>` (v<version>)
- Fork version after sync: `0.x.y` (per docs/adr/0003 decision 2)

## Drift evidence

Paste the output of:

```bash
node scripts/sync-upstream.mjs --material <clone> --plugin <clone>
```

- Plugin commits since baseline: `<git log --oneline <baseline>..<target>`>
- Material files added / modified / deleted: `<sync-upstream summary>`

## Material delta (translate only these)

| Vendored path | Upstream change | English action |
| --- | --- | --- |
| `upstream/<path>` | `<one line>` | `<re-express / whitespace-only, no change>` |

## Plugin delta (code layer)

| Upstream path | What changed | English re-expression needed |
| --- | --- | --- |
| `src/<path>` | `<one line>` | `<yes/no + note>` |

## Structural changes (human decision required)

- [ ] None
- [ ] Added/removed file or asset: `<list + proposed mapping>`
- [ ] Added/removed flavor or mode: `<list + proposed mapping>`
- [ ] Methodology meaning changed: `<file + judgement needed>`
- [ ] Zero-CJK exemption or `MAX_PROMPT_BYTES` affected: `<why>`
- [ ] LICENSE/NOTICE affected: `<why>`

If any box is checked, request approval in a comment and **do not** start coding.

## Acceptance checklist

- [ ] `npm ci --ignore-scripts && npm run check` green
- [ ] `npm run verify` reports zero-CJK assets
- [ ] `npm pack --dry-run` succeeds
- [ ] manifest pins advanced by `scripts/sync-upstream.mjs`, `pluginUpstream` updated
- [ ] `CHANGELOG.md` entry names both upstream revisions
- [ ] branch pushed, PR opened, no push to `main`, no tag, no publish

## Guardrails

docs/adr/0003 decision 7: branch, commit, push the branch, open a PR. No `main` pushes, no tags, no publishes, no unattended LICENSE/NOTICE edits.
