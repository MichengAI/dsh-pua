# Changelog — dsh-pua-en

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
- Install from this GitHub repository (github:phucnd0604/dsh-pua-en); npm publishing is
  intentionally not used for this fork.
- Versioning restarts at 0.1.0; this fork does not continue the upstream 0.3.x series.
