export const TERMINAL_REVIEW_PROMPT = 'PUA · Terminal state needs verification: the output carries text markers for a non-zero exit, a timeout, or an abnormally ended shell, but the command itself may have printed them. Judge against the real error, the current sub-goal, and whatever independent check you need before picking a fix; never claim a failure count, pressure escalation, or passing acceptance from a marker alone.';
/** Gives a verification cue when a persistent terminal returns text only; forgeable output is never counted as a structured failure. */
export function terminalTextNeedsReview(result) {
    if (result.isError || typeof result.value !== 'string')
        return false;
    const value = result.value.trim();
    const exit = /(?:^|\n)\[(?:exit code: |shell exited: code |Command finished with exit code )(-?\d+)\](?:\r?\nThe persistent (?:pwsh|bash) shell was reset;[^\n]*)?$/u.exec(value);
    return (exit !== null && Number(exit[1]) !== 0)
        || /^Your command timed out after \d+ seconds or experienced an OOM error\./u.test(value)
        || /(?:^|\n)\[shell killed by signal: [A-Z0-9]+\](?:\r?\nThe persistent (?:pwsh|bash) shell was reset;[^\n]*)?$/u.test(value);
}
//# sourceMappingURL=terminal-observation.js.map