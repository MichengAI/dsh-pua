# Changelog — dsh-pua-en

## 0.2.0

Sync with plugin upstream MichengAI/dsh-pua v1.0.1
(commit 791733b1a7c63f7818b36501eeeaa4dc85f9b0ff); the previous baseline was v0.3.28
(commit 1d2e60988673c8f289903181914c5e91aae391dc). Material upstream tanweai/pua is
unchanged at v3.5.1 (commit e6e6cd237ad17750d179674bff52f8184abea8fd).

- Adopt upstream's breaking host-range change: supported hosts are DeepSeek Harness
  0.2.0-rc.1, 0.2.0-rc.2, 0.2.1-rc.1, and 0.2.1-rc.2. Hosts before 0.2.0 (including
  0.2.1 alphas) are rejected by the version gate. Development dependencies align to
  0.2.1-rc.2 (Cordis 4.0.5, Schemastery 3.18.5).
- Re-express the upstream code changes in English: import the Regular icon names directly
  instead of probing a numbered-icon fallback, write only the plugin:<name> message source,
  take boundary schemas through create() only, handle lifecycle only on agent/created,
  and read settings only from the Profile's volatile configuration.
- Remove the fallback paths kept for hosts before 0.2.0: the numbered icon fallback,
  settings.register, agent/session-start, the legacy message-source shape, and the
  missing-volatile() / missing-create() fallbacks. Reading plugin messages and command
  results already stored in older session logs is unchanged.
- Keep this fork's repo-only install path; README.zh-CN.md and README.ru.md stay deleted.

## 0.1.0

English fork of @michengai/dsh-pua, based on upstream dsh-pua 0.3.28 with vendored PUA
content from tanweai/pua v3.5.1 (commit e6e6cd237ad17750d179674bff52f8184abea8fd).

- Translate the entire Chinese-facing surface to English using GLOSSARY.md terminology:
  vendored methodology/flavor/command Markdown, hooks' user-visible strings, and TypeScript
  runtime strings (commands, args results, settings copy, review rules, platform prompt, narration).
- Keep command names (slash commands like /pua, /ding, /mama, /kpi, /p7) unchanged;
  only descriptions and content are English.
- Keep the trilingual UI machinery (zh/en/ru); the fallback/default UI language is now English.
- Keep zh quick-command aliases and Chinese flavor/brand aliases as secondary triggers
  alongside the new English aliases; the zh/ru UI dictionaries and locale JSON stay as shipped
  localization data.
- Rename the activation token to `[PUA ACTIVE 🔥]` / `[PUA ACTIVE]` and title-case the narration
  markers (`[Methodology Routing 🧭]`, `[Methodology Switch 🔄]`, `[PUA Breakthrough ✨]`,
  `[P8 Self-Check]`); the frozen ASCII sentinels (`[PUA-DIAGNOSIS]`, `[PIP-REPORT]`, ...) are unchanged.
- Enforce zero CJK inside `assets/pua/**` from `scripts/verify.mjs` (only exemptions: the
  provenance `author` name in `assets/pua/upstream.json` and the Japanese `pua-ja` skill).
- Repository docs are English-only: `README.zh-CN.md`, `README.ru.md` and the Chinese banner were
  removed. Pre-fork session logs still replay: the legacy `PUA · 会话 ·` and
  `PUA · 已提交任务请求，` result strings stay in Chinese in `src/state.ts`.
- Two-layer provenance manifest (assets/pua/upstream.json, schemaVersion 2):
  sourceSha256/gitBlobSha256 pin the original Chinese bytes; contentSha256 pins the current
  English bytes and is checked by scripts/verify.mjs.
- Drop the 19 legacy top-level duplicate assets (`assets/pua/flavors.md`, 15 `methodology-*.md`,
  3 `command-*.md`): they were never loaded, because `SourceCatalog` reads only `upstream/**`
  entries. The manifest now holds the 85 vendored files, where `sourceSha256` and `gitBlobSha256`
  agree for every row and the whole manifest is regenerable from a material-upstream clone.
- Install from this GitHub repository (github:phucnd0604/dsh-pua-en); npm publishing is
  intentionally not used for this fork.
- Remove the release plumbing that only existed for npm publishing: `.github/workflows/publish.yml`
  and `scripts/release-notes.mjs` (nothing references it). CI keeps `.github/workflows/ci.yml`.
- Define and automate the upstream-sync process: `docs/adr/0003-upstream-sync-policy.md`,
  `docs/agents/upstream-sync.md` (runbook), `docs/agents/sync-ticket.md` (ticket template) and
  `scripts/sync-upstream.mjs` (offline drift detection plus manifest pin updates, which refuses to
  write through a structural change unless `--allow-additions` / `--allow-removals` says a human
  approved it). Record the plugin-upstream baseline in the manifest as `pluginUpstream`.
- Versioning restarts at 0.1.0; this fork does not continue the upstream 0.3.x series.
