# Glossary

Terms and definitions used across this repo's issues, specs, and code.

Created by `/setup-matt-pocock-skills`. The `/domain-modeling` skill maintains it lazily when domain terms get resolved.

Locked for the EN translation (decisions from the grilling session: docs/adr/0001-dsh-pua-en-fork-strategy.md for fork identity and scope, docs/adr/0002-zero-cjk-assets-and-language-layers.md for the zero-CJK rule and per-layer language policy).

## Flavor — a company-inspired style bundle the user can choose for the agent (15 styles: alibaba, huawei, ...). In code: src/flavors.ts, assets/pua/methodology-*.md. NOT the same as: persona (a role profile like P9), skill (a capability), or methodology.

## Methodology — the company-specific problem-solving framework attached to a flavor (e.g. Huawei RCA + blue-team self-attack). Lives in assets/pua/methodology-*.md and as a chapter of the vendored PUA skill. NOT: flavor (the style wrapper), narration (the lines the agent speaks).

## Narration — the persona lines the agent says out loud (e.g. the upstream original `其实，我对你是有一些失望的...`), vendored as `PUA_L1`–`PUA_L4` variables in `assets/pua/upstream/hooks/flavor-helper.sh`. Translated to English in this fork; tone stays direct/PUA.

## Flavor switch / method switch — automatic selection and failure-triggered rotation between flavors. Lives in failure-detector.sh and the methodology-router reference. NOT: Loop.

## Loop (verification loop) — repeated work cycles that continue until verification passes, an iteration limit is hit, or the user cancels (/pua-loop). In code: src/runtime.ts, pua-loop-hook.sh. NOT: flavor switch.

## Verification — evidence-first completion check before claiming done (`/done-check`, `/evidence`, REVIEW_RULES). The Chinese trigger `验收` is kept as a deliberate compat alias for this command (src/args.ts:31). NOT: Loop (the repeating wrapper), NOT: integrity guard.

## Integrity guard — denial of reads of hidden benchmark answers and pre-edit reminders for test/scoring/CI files. In code: src/integrity-guard.ts, integrity-guard.sh. NOT: verification.

## Ding-inside / Ding-outside — EN rendering of the upstream labels `钉内`/`钉外` (DingTalk-in-group / out-group office politics framing), kept as accepted compat aliases in `src/flavors.ts` and `src/args.ts`. Proper nouns (company names, P7/P9/P10 role codes) are romanized as-is, never translated.

## P7 / P9 / P10 — Chinese big-tech role levels used as personas (senior engineer / tech lead / CTO). Kept as-is in EN; the "PIP" pua-en skill is the Western-performance-culture variant of the core skill.

## PIP (pua-en skill) — the vendored English core skill from upstream tanweai/pua ("Put your AI on a Performance Improvement Plan"), Western big-tech performance rhetoric. NOT a flavor.

## Silent injection — starting a PUA session without announcing "PUA is active" to the model (session-restore.sh L111). The model-side wording is English in this fork.

## Vendored upstream content — files under assets/pua/ whose source of truth is the vendored PUA project, pinned by assets/pua/upstream.json (tanweai/pua v3.5.1, revision e6e6cd2). This fork translates them; the manifest keeps original hashes for future diffing.

## Zero-CJK rule — every file under assets/pua/ (except assets/pua/upstream.json and the vendored Japanese skills/pua-ja/SKILL.md) must contain no CJK characters or CJK/fullwidth punctuation (U+3000–U+303F, U+4E00–U+9FFF, U+FF00–U+FFEF). Enforced by scripts/verify.mjs. Established by docs/adr/0002; applies to hooks too, while their parser-visible skeleton (heredoc markers, case labels, assignment lines) stays byte-identical in shape.

## Activation token — the exact string `[PUA ACTIVE 🔥]` (plain form `[PUA ACTIVE]`) replaces the upstream `[PUA生效 🔥]`/`[PUA生效]`. It is a detector string, not prose: src/runtime.ts matches it (with [Auto-select:, [PIP-REPORT], [PUA-REPORT], [PUA-DIAGNOSIS]) and assets/pua/upstream/hooks/stop-feedback.sh scans for the same prefix. Never retranslate or recase it.

## Narration marker — a bracketed, title-cased label the agent prints to narrate a mode (e.g. `[Methodology Routing 🧭]`, `[Methodology Switch 🔄]`, `[PUA Breakthrough ✨]`, `[P8 Self-Check]`, `[MOM APPROVES ✨]`). ASCII sentinel markers are frozen and never recased ([PUA-DIAGNOSIS], [PIP-REPORT], [PUA-REPORT], [PUA-CHECKPOINT], [PUA Always-On], [HW-REPORT], [P7-COMPLETION], [PUA-ESCALATION], [TEARDOWN], [Auto-select:). See docs/adr/0002.

## Legacy session strings — `PUA · 会话 · ` (SESSION_RESULT_PREFIX, src/state.ts:21) and the matcher prefix `PUA · 已提交任务请求，` (src/state.ts:128) stay in Chinese on purpose so pre-fork session logs still replay as non-legacy and classify as an activation task. They are historical log literals, not UI copy; do not translate them.

## Plugin upstream — `MichengAI/dsh-pua`, the repository this fork was forked from and the **primary** source of truth: its releases drive the fork's release cycle, and its git history is shared with this fork (the fork can merge from it). NOT: Material upstream.

## Material upstream — `tanweai/pua`, the source of the prompt material vendored under assets/pua/upstream/** and pinned in assets/pua/upstream.json by revision + version. **Secondary** source: it has no git relationship with this fork, so a refresh is a re-vendor plus re-translation, never a merge. NOT: Plugin upstream.

## Translation baseline — the pair of upstream revisions a given fork release was translated from (plugin upstream commit/version + material upstream revision/version), recorded machine-readably so an agent can diff against it without reading prose.

## Sync generation — one step of the fork's own version sequence produced by syncing with plugin upstream: MINOR increments when the upstream MINOR/MAJOR moves, PATCH for small or material-only refreshes. The fork's version is independent of upstream's number; the link between them lives in the translation baseline (deliberate fork versioning, see docs/adr/0003).

## Legacy duplicate assets — the top-level copies under assets/pua/ (`flavors.md`, 15 `methodology-*.md`, 3 `command-*.md`) that mirror the vendored tree. SourceCatalog only loads manifest entries whose `file` starts with `upstream/`, so these copies are never served at runtime; they still carry manifest entries and hashes (scripts/verify.mjs). Scheduled for deletion as their own cleanup ticket, [#1](https://github.com/phucnd0604/dsh-pua-en/issues/1).
