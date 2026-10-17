import { FLAVORS } from './flavors.js';
import { SourceCatalog } from './source.js';
export const MAX_PROMPT_BYTES = 192 * 1024;
export const MODES = ['pua', 'p7', 'p9', 'p10', 'pro', 'yes', 'mama', 'pua-loop', 'shot', 'pua-en', 'pua-ja'];
export const QUALITY_COMMANDS = ['again', 'done-check', 'evidence'];
const PLATFORM = `## DSH platform mapping (platform interfaces are substituted only; roles and behavioral protocols still apply; table rendering follows the rules below)
The core, flavor, and role protocols all come from the pinned PUA 3.5.1 original text; body text is not rewritten into a summary.
Material paths are relative to the original plugin root. Use pua_reference to read the full material and list to browse the directory; do not recursively invoke /pua routing to load yourself. Names such as Read, Bash, Skill, and Task denote capabilities of the original host; in DSH use the read, PowerShell/terminal, skill, and subagent tools actually available.
Toggles, flavors, and offline settings are managed by native /pua commands and DSH settings; do not execute shell fragments from the original text that write ~/.pua/config.json or .claude state. Command responses state the actual persistence scope. The flavor the user currently specifies and locks takes precedence; auto keeps the original intelligent routing.
The loop is driven by this plugin's DSH stop boundary; when the current request does not explicitly start a loop, no loop runs. Configuration, cancellation, caps, and independent verification results follow actual host feedback; do not write state files yourself or claim the original shell hooks were installed.
Subagents use the capabilities DSH currently provides and pass along the full core and role material; when a capability is missing, state the limitation plainly - never invent teammates, processes, or results. Team cleanup is handled by host resource ownership; do not run the original cross-project deletion scripts.
Long-term self-evolution and surveys run only when the user explicitly selects that entry point and the host allows it; capabilities that are not enabled must not expand on their own. The original Pro note at the end that "network features have been removed" applies to the whole document; do not carry out the remote refresh or reporting instructions left over in earlier sections.
PUA keeps the original roles, tough talk, narration, and Owner requirements; the original runtime contract's positions on task scope, real evidence, user locking, authorization, and not re-verifying acceptance are kept as well.

## DSH table rendering (overrides the original box tables)
DSH's MarkdownText renders GFM pipe tables and does not lay out Unicode box characters as tables. The requirement in the SKILL.md and display-protocol.md above ("you must use ┌─┬─┐ boxes, never markdown | | tables") is void in DSH.
Status tables, sprint banners, progress tables, KPI cards, and pressure panels: whenever it is a table, emit a GFM pipe table directly: do not put it in a code block, do not draw tables with box characters. Narration may still use a leading ▎ or a markdown blockquote. A text progress bar ██████░░░░ may stay on its own line; do not draw a box around it.
Example:

| Field | Content |
| --- | --- |
| Task | One-sentence description |
| Flavor | Alibaba flavor |
| Pressure | L0 · trust period |`;
/** Prevents original literal templates from being interpolated by host variables; otherwise the body is preserved. */
export function escapePromptLiteral(text) { return text.replaceAll('{{', '{ {'); }
/** Joins the full original core with the current mode; mode differences come from the original extension protocols. */
export function renderOriginalPrompt(catalog, flavor, mode = 'pua') {
    const parts = [catalog.body('skills/pua/SKILL.md'), catalog.body('skills/pua/references/display-protocol.md'), catalog.body('skills/pua/references/methodology-router.md')];
    if (mode !== 'pua')
        parts.push(catalog.body(`skills/${mode}/SKILL.md`));
    if (mode === 'pro')
        parts.push(catalog.body('skills/pua/references/evolution-protocol.md'), catalog.body('skills/pua/references/platform.md'));
    if (mode === 'p7' || mode === 'p9' || mode === 'p10')
        parts.push(catalog.body(`skills/pua/references/${mode}-protocol.md`));
    if (mode === 'p9' || mode === 'p10')
        parts.push(catalog.body('skills/pua/references/agent-team.md'));
    if (flavor !== 'auto') {
        const descriptor = FLAVORS.find(item => item.id === flavor);
        const section = catalog.body('skills/pua/references/flavors.md').split(/(?=^## \d+\. )/mu).find(text => text.startsWith(`## ${descriptor.chapter}. `));
        if (!section)
            throw new Error(`Original flavor chapter missing: ${flavor}`);
        parts.push(section.trim(), catalog.body(`skills/pua/references/methodology-${flavor}.md`));
        if (flavor === 'ding')
            parts.push(catalog.body('skills/pua/references/ding-reminders.md'));
    }
    parts.push(PLATFORM, `Current DSH mode: ${mode}. ${flavor === 'auto' ? 'Flavor not locked; choose per the original methodology router, starting from the Alibaba flavor when no task type is recognizable.' : `User-locked flavor: ${flavor}; automatic routing must not change the style of expression.`} ${mode === 'yes' || mode === 'mama' ? `This request explicitly selected ${mode}; its original emotional expression replaces the default leadership tone, while the behavioral floor still applies.` : ''}`);
    const prompt = escapePromptLiteral(parts.join('\n\n'));
    if (Buffer.byteLength(prompt, 'utf8') > MAX_PROMPT_BYTES)
        throw new Error(`Original ${mode}/${flavor} exceeds the prompt budget; check the source material and never truncate silently.`);
    return prompt;
}
export function loadPrompts() {
    const catalog = new SourceCatalog();
    return new Map(FLAVORS.map(flavor => [flavor.id, renderOriginalPrompt(catalog, flavor.id)]));
}
export function loadCommandPrompts() {
    const catalog = new SourceCatalog();
    return new Map(QUALITY_COMMANDS.map(name => [name, catalog.body(`commands/${name}.md`)]));
}
export const DISABLED_PROMPT = '## Current DSH PUA state\nPUA mode is off for the current task. Stop carrying over PUA narration, flavor, and pressure-escalation requirements from earlier messages, compacted summaries, or the parent session; continue working normally as the user asks. Only an explicit PUA request made after this point re-enables it.';
//# sourceMappingURL=content.js.map