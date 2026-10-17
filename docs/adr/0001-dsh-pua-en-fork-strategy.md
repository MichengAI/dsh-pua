# ADR 0001: dsh-pua-en fork strategy — English localization, vendoring, and identity

Date: 2025 (grilling session, /grill-with-docs)
Status: Accepted

## Context

This repo is a fork of MichengAI/dsh-pua (Apache-2.0), itself vendoring methodology content from tanweai/pua v3.5.1 (MIT, pinned in assets/pua/upstream.json). The fork's purpose: produce and maintain an English version of the DSH PUA plugin.

Inventory at fork time (upstream 0.3.28): 91 of 92 vendored .md files contain Chinese (all model-facing), 6 of 12 hook scripts emit Chinese at runtime, and the TS layer hardcodes ~46 Chinese Error(...) throws plus a Chinese HELP block, args errors, flavor labels, review rules, and loop narrations. UI components in src/i18n.ts and display.ts are already trilingual (zh/en/ru).

## Decisions

1. **Identity: anglicized fork, not English-native rebuild.** Keep the full codebase and all 15 flavors; translate Chinese content to English; rebrand as @phucnd0604/dsh-pua-en.
2. **Translation scope: translate-all-preserve.** Translate everything; keep original metaphors (Alibaba, Huawei, P7/P9/P10, Ding-inside/Ding-outside) — the company styles are the product's core feature. Command names (/ding, /mama, /kpi, /p7...) stay unchanged; only descriptions and prompt content are translated. pua-ja (Japanese) stays vendored as-is.
3. **Upstream strategy: vendoring.** No full-repo merges from the material upstream; pull new content from tanweai/pua via the upstream.json manifest when needed and translate the delta. upstream.json keeps original hashes as the zh source-of-truth reference. **Amended by** docs/adr/0003 decision 4: merges from the *plugin* upstream (MichengAI/dsh-pua) are the code-sync mechanism, resolved file by file in English; `-X theirs`/`-X ours` are forbidden.
4. **TS strings: EN-only for hardcoded runtime strings.** The Chinese HELP block, errors, results, settings descriptions, and prices loop narration become English single-locale (this fork's primary language is English). UI components may stay trilingual inline.
5. **Trigger aliases: EN primary + zh aliases kept in the runtime.** English aliases (`another way` / `try again` / `show me the evidence` / `no tests, no done`...) are added; the existing Chinese aliases (`换个方法`/`再试试`/`证据呢`/`验收`/`没跑测试别说完成`) stay as deliberate secondary triggers in `src/args.ts`, together with the `flavor` synonyms (`味道`/`风味`), `auto` (`自动`), and the Chinese review phrasing (`审查一下项目`). `src/flavors.ts` likewise keeps the zh flavor-alias list (`阿里`/`华为`/.../`钉内`/`钉外`). The hook-side flavor normalization `case` is the exception — its zh aliases were removed; see ADR 0002 decision 3.
6. **Locale direction: EN as default and primary.** resolveUiLang fallback becomes 'en'; en.json is the source. zh/ru locale files are kept (3 files, 2 keys each — negligible maintenance).
7. ~~**Packaging & publishing: publish npm separately as @phucnd0604/dsh-pua-en** (scope + NPM_TOKEN in GitHub Actions). CI workflows repoint from @michengai to @phucnd0604.~~ **Superseded:** the fork is distributed by installing the GitHub repository (`dsh plugin --profile web add github:phucnd0604/dsh-pua-en`). No npm registry publish and no NPM_TOKEN; `.github/workflows/publish.yml` is removed. The package name `@phucnd0604/dsh-pua-en` is kept because DSH derives plugin identity from package.json. See README.md "Installation" and CHANGELOG.md 0.1.0.
8. **Versioning: restart at 0.1.0.** New CHANGELOG; the first entry notes the base (fork of upstream 0.3.28).
9. ~~**Hooks: translate user-visible strings, keep code comments.** systemMessage/display strings become English; Chinese comments stay for upstream diffing.~~ **Superseded by** docs/adr/0002-zero-cjk-assets-and-language-layers.md decision 2: hooks are translated in full — comments and payloads alike — so `assets/pua/` stays zero-CJK; the parser-visible skeleton is what gets frozen instead.
10. **License & NOTICE: update NOTICE** to record derivation: plugin code Apache-2.0 from MichengAI/dsh-pua; vendored content MIT from tanweai/pua v3.5.1.
11. **Workflow: agent translates in batches (methodologies → flavors → commands → skills → hooks) with human review per batch. GLOSSARY-first: canonical EN terms locked in GLOSSARY.md before batch translation.**
12. ~~**Branding: new EN banner + EN screenshots.** Existing banner PNG is English already; zh variant and zh screenshots replaced when the EN UI lands.~~ **Partly superseded:** the zh banner and zh/ru READMEs are deleted (English-only repo); `assets/branding/dsh-pua-banner.png` is the English banner and the only branding asset any document references. See "Open work" for the screenshots.
13. **Tone: keep PUA humor as-is** — direct, harsh coaching survives translation; no softening for Western audiences.

## Consequences

- ~~First milestone: a single EN vertical (one flavor, end-to-end: skill + methodology + hook + UI copy) before scaling to the remaining 14.~~ **Superseded by the owner's big-bang pivot:** the whole surface was translated in one pass and shipped as 0.1.0 instead of growing flavor by flavor.
- `assets/pua/upstream.json` keeps the original zh hashes (`sourceSha256`, `gitBlobSha256`) as the diffing base. There is **no explicit "translated" flag**: an entry counts as translated when its `contentSha256` differs from its `sourceSha256` (99 of 104 entries at 0.1.0; the 5 still matching are `upstream/hooks/checkpoint-save.sh`, `upstream/hooks/hooks.json`, `upstream/hooks/runtime-state.py`, `upstream/skills/pua-en/SKILL.md`, and the intentionally exempt `upstream/skills/pua-ja/SKILL.md`).
- ~~Chinese-comments-only files in src/ are translated last (batch cleanup), lowest priority.~~ **Superseded by** docs/adr/0002 decision 5: `src/**` comments and runtime prose are English, except the deliberately-kept compat data listed in GLOSSARY.md (the zh trigger/flavor aliases in `src/args.ts` and `src/flavors.ts`, the zh/ru UI dictionaries, and the legacy session log literals in `src/state.ts`).

## Open work

- `assets/screenshots/pua-global-settings.png` and `assets/screenshots/pua-session-settings.png` still show the upstream Chinese UI. They ship only because `package.json` `files[]` includes `assets/screenshots`; no document references them. Either recapture them from the English UI (`scripts/preview-ui.mjs` + a browser) or drop `assets/screenshots` from `files[]`.
