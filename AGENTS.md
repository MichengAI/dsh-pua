# AGENTS.md

Agent-facing guidance for working in this repository (`@phucnd0604/dsh-pua-en` — the English fork of the DSH PUA plugin).

## Agent skills

### Issue tracker

Issues are tracked as GitHub Issues on phucnd0604/dsh-pua-en via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.

### Upstream sync

Two upstreams drive this fork: the **plugin upstream** `MichengAI/dsh-pua` (synced by `git merge`) and the **material upstream** `tanweai/pua` (re-vendored and re-translated). Policy: `docs/adr/0003-upstream-sync-policy.md`. Runbook: `docs/agents/upstream-sync.md`. Ticket template: `docs/agents/sync-ticket.md`. Mechanical drift detection and manifest pin updates: `node scripts/sync-upstream.mjs --material <clone> --plugin <clone>`.
