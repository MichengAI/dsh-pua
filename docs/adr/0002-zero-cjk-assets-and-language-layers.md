# ADR 0002: Zero-CJK vendored assets, ASCII runtime markers, and per-layer language policy

Date: 2025 (translation waves)
Status: Accepted

Supersedes parts of ADR 0001: decision 9 (hooks: "keep Chinese comments") and the implied permission for Chinese literals inside hooks and prompt material.

## Context

ADR 0001 chose "translate everything, keep the metaphors". Executing it exposed three facts that change the plan:

1. The hooks under `assets/pua/upstream/hooks/` are not dead weight: `src/hook-content.ts` parses `failure-detector.sh` (4 output blocks, 1 gate, 4 routing blocks, 2 flavor-context lines) and `flavor-helper.sh` (15 flavor blocks, each a `    <name>)` label followed by `PUA_*` assignments and a `      ;;` terminator). Their payload strings reach the model, so "translate only user-visible strings" is not a meaningful boundary — comments and payloads both live in the same file and reviewers cannot tell them apart.
2. Runtime detection keys on literal ASCII/Chinese markers. `src/runtime.ts` matched `/PUA生效|\[Auto-select:|\[PIP-REPORT\]|\[PUA-REPORT\]|\[PUA-DIAGNOSIS\]/u`; `integrity-guard.sh` and `stop-feedback.sh` grep'd the same Chinese token. Leaving the Chinese token in hooks while the docs emitted English would have silently disabled detection for every session.
3. The plugin ships real localization: `src/i18n.ts` holds `UI` / `ACTIVITY` records for zh/en/ru, and `locale/{en,zh,ru}.json` provide the settings metadata. Those Chinese strings are operator-facing UI data, not prompt material, and deleting them would remove working behavior.

## Decisions

1. **Zero-CJK inside `assets/pua/` only.** Every file under `assets/pua/` (skills, references, commands, agents, hooks, and the legacy top-level copies) contains no character matching `[\u4e00-\u9fff]` and no CJK/fullwidth punctuation (U+3000–U+303F, U+FF00–U+FFEF). This is the model-facing layer; a mixed-language prompt tree is the failure mode we are removing. Enforcement: `scripts/verify.mjs` gains a CJK assertion over `assets/pua/`.
2. **Hooks are translated in full, structure first.** Comments, payload heredocs, and `PUA_*` values all become English; the parser-visible skeleton is frozen. Concretely: `failure-detector.sh` keeps 4 `<< EOF_OUTPUT` blocks (L1 count 2, L2 3, L3 4, L4 else), 1 `<< EOF_GATE`, 4 `<< EOF_ROUTING` in the order locked-L2, locked-L4, default-L2, default-L4, and 2 `FLAVOR_CONTEXT="..."` lines; `flavor-helper.sh` keeps 15 `    <name>)` labels, 6-space `;;` terminators, and single-line `PUA_X="value"` assignments with no embedded quotes or backslashes.
3. **The Chinese-language override block in `flavor-helper.sh` is deleted, not translated.** The fork is English-only; a per-flavor `language: "zh"` switch would reintroduce Chinese output. Chinese aliases in the flavor normalization `case` (`阿里`/`华为`/.../`自动`/`微软`/`钉*`) are removed with it; Latin aliases and lowercase ids stay. This is a hook-layer change only: `src/flavors.ts` still accepts the zh flavor aliases as deliberate user-facing triggers (ADR 0001 decision 5).
4. **One ASCII activation token: `[PUA ACTIVE 🔥]` (`[PUA ACTIVE]` without the emoji).** It replaces `[PUA生效 🔥]` everywhere — docs, hooks, and the `src/runtime.ts` detector. Marker names are title-cased English: `[Methodology Routing 🧭]`, `[Methodology Switch 🔄]`, `[PUA Breakthrough ✨]`, `[P8 Self-Check]`. Existing ASCII markers (`[PUA-DIAGNOSIS]`, `[PIP-REPORT]`, `[PUA-REPORT]`, `[PUA-CHECKPOINT]`, `[PUA Always-On]`, `[HW-REPORT]`) are untouched because code and templates match them literally.
5. **Language policy by layer.** `assets/pua/**` = English only. `src/**` and `scripts/**` = English comments and identity-neutral runtime strings; the zh/ru dictionaries in `src/i18n.ts` and `locale/{zh,ru}.json` are kept as shipped localization. Repository docs are English-only: `README.zh-CN.md` and `README.ru.md` were removed. `locale/{zh,ru}.json` and `locale/remote/{zh,ru}.json` stay as shipped localization data for the trilingual UI. Proper nouns are romanized, never translated: `探微安全实验室` stays verbatim in `NOTICE` and `assets/pua/upstream.json` as provenance for the vendored MIT content. Deliberate exception inside `src/**`: the zh trigger/flavor alias data in `src/args.ts` and `src/flavors.ts`, the zh/ru UI dictionaries, and the legacy session log literals in `src/state.ts` are compatibility data, not prose — see GLOSSARY.md.
6. **Manifest semantics.** `assets/pua/upstream.json` remains a two-layer manifest: `sourceSha256`/`gitBlobSha256` pin the original Chinese bytes at upstream revision e6e6cd2 (diff base for future vendoring), `contentSha256` pins the English bytes actually served. Translation changes `contentSha256` only; `scripts/verify.mjs` recomputes and asserts it on every check (it never rewrites the manifest — updating it is the translation tooling's job).

## Consequences

- `scripts/verify.mjs` recomputes and asserts `contentSha256` for every translated entry (they change by design) and must be re-run after any asset edit; it does not update the manifest.
- Tests that pinned Chinese strings (runtime, tool-order, host, i18n, content, integrity-guard, args, ...) now pin the English equivalents; assertions on zh localization data stay.
- A future upstream sync cannot be applied as a patch: new zh content is translated first, then `contentSha256` is refreshed.
