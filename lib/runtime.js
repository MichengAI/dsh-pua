import { createHash } from "node:crypto";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { HookContent } from "./hook-content.js";
import { SourceCatalog } from "./source.js";
import { StateStore } from "./state.js";
import { hasPendingToolCalls, repairPuaToolOrder } from "./tool-order.js";
import { replacementSurface } from "./session-compat.js";
import { isPluginSource, pluginSource, COMMAND_PLUGIN, RUNTIME_PLUGIN } from "./message-source.js";
import { terminalTextNeedsReview, TERMINAL_REVIEW_PROMPT } from "./terminal-observation.js";
import { classifyToolCall, INTEGRITY_DENIED_CODE, integrityContext, integrityDenyReason } from "./integrity-guard.js";
const RUNTIME_SOURCE = RUNTIME_PLUGIN;
const RECORD = "PUA_RUNTIME_V1 ";
export const LOOP_START = "PUA_LOOP_START ";
export function pluginMessage(text) {
    return createUserMessage({
        content: [{ type: "text", text }],
        source: pluginSource(RUNTIME_SOURCE),
    });
}
const messageText = (message) => message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n");
/** Like the original, only the terminal result's direct structural fields count; never guess a failure from stdout or nested JSON. */
export function isTerminalFailure(result) {
    if (result.isError)
        return !!result.error.info?.code && !/ABORT|DENIED|PERMISSION|EPERM|EACCES|UNKNOWN_TOOL|BLOCKED|APPROVAL/u.test(result.error.info?.code ?? "");
    const value = result.value;
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    return (value.is_error === true ||
        ["exitCode", "exit_code"].some((key) => typeof value[key] === "number" && value[key] !== 0));
}
/** Runs the user-provided command for independent acceptance with a 120-second timeout; output is evidence, never instruction. */
export async function verifyLoop(subprocess, command, cwd, signal, timeoutMs = 120_000) {
    signal.throwIfAborted();
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), timeoutMs);
    try {
        const combined = AbortSignal.any([signal, timeout.signal]);
        // The script is a single argv entry handed to the host's spawn(program, args); there is no outer shell-string escaping.
        const argv = process.platform === "win32"
            ? [
                "powershell.exe",
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n$OutputEncoding = [System.Text.Encoding]::UTF8\n$ErrorActionPreference = 'Stop'\n${command}\nif (-not $?) { if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; exit 1 }; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }`,
            ]
            : ["/bin/sh", "-c", command];
        const handle = subprocess.spawn({
            argv,
            cwd,
            signal: combined,
            graceMs: 1000,
            stdio: {
                stdin: "ignore",
                stdout: { maxBytes: 8192 },
                stderr: { maxBytes: 8192 },
            },
        });
        const result = await handle.done;
        signal.throwIfAborted();
        const stdout = handle.collected.stdout?.readFrom(0);
        const stderr = handle.collected.stderr?.readFrom(0);
        return {
            ok: !timeout.signal.aborted && result.exitCode === 0 && !result.signal,
            detail: JSON.stringify({
                exitCode: result.exitCode,
                timedOut: timeout.signal.aborted,
                stdout: stdout?.text,
                stderr: stderr?.text,
                truncated: stdout?.lossy || stderr?.lossy || false,
            }),
        };
    }
    catch (error) {
        signal.throwIfAborted();
        return {
            ok: false,
            detail: timeout.signal.aborted
                ? "Independent acceptance timed out."
                : `Independent acceptance did not complete successfully: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
    finally {
        clearTimeout(timer);
    }
}
/** Lifetime port; full state stays in the log, and only the note reaches the model via a host surface replacement. */
export class PuaRuntime {
    ctx;
    store;
    lifetime;
    hooks;
    activeVerifiers = new Map();
    sessions = new Set();
    cache = new WeakMap();
    normalized = new WeakSet();
    pendingWrites = new Map();
    pendingCandidates = new WeakSet();
    pendingTerminalReviews = new WeakSet();
    constructor(ctx, store, catalog, lifetime, feedback = () => ({
        offline: false,
        frequency: 5,
    })) {
        this.ctx = ctx;
        this.store = store;
        this.lifetime = lifetime;
        this.hooks = new HookContent(catalog);
        ctx.on("agent/pre-step", async ({ agent }, next) => {
            const decision = await next();
            if (decision.kind !== "enter")
                return decision;
            this.hideLegacyRecords(agent.session);
            this.flush(agent.session);
            const state = store.read(agent.session);
            const runtime = this.read(agent.session);
            if (this.pendingTerminalReviews.has(agent.session) && !hasPendingToolCalls(agent.session)) {
                this.pendingTerminalReviews.delete(agent.session);
                if (state.enabled && state.terminalReview)
                    decision.messages.push(pluginMessage(TERMINAL_REVIEW_PROMPT));
            }
            if (this.pendingCandidates.has(agent.session) && !hasPendingToolCalls(agent.session)) {
                this.pendingCandidates.delete(agent.session);
                let prompt = '';
                if (state.enabled && state.failureCandidates && (runtime.candidateCount ?? 0) < 4) {
                    try {
                        prompt = this.hooks.candidate(runtime.failureCount, state);
                    }
                    catch (error) {
                        ctx.logger.warn('PUA candidate assets unavailable; skipping this prompt: %s', error);
                    }
                    if (prompt)
                        runtime.candidateCount = (runtime.candidateCount ?? 0) + 1;
                }
                if (prompt)
                    decision.messages.push(pluginMessage(prompt));
            }
            if (!state.enabled || state.mode !== "pua-loop")
                this.cancel(agent.session);
            for (const message of decision.messages) {
                const text = messageText(message);
                if (isPluginSource(message.source, COMMAND_PLUGIN) &&
                    text.startsWith(LOOP_START) &&
                    state.enabled &&
                    state.mode === "pua-loop") {
                    const config = JSON.parse(text.slice(LOOP_START.length).split("\n")[0]);
                    if (config.id !== state.loopCommandId)
                        continue;
                    runtime.loop = {
                        ...config,
                        iteration: 1,
                        rejections: 0,
                        status: "active",
                    };
                    this.save(agent.session, runtime, "Loop started explicitly; the verification config follows the user command.");
                }
                else if (message.source.kind === "user" && state.enabled) {
                    if (runtime.loop?.status === "paused" && state.mode === "pua-loop") {
                        runtime.loop = { ...runtime.loop, status: "active" };
                        this.save(agent.session, runtime, "User added input; resuming the Loop in this session.");
                    }
                    if (state.qualityTriggers && this.hooks.trigger.test(text))
                        decision.messages.push(pluginMessage(this.hooks.frustrationPrompt(state)));
                }
            }
            return decision;
        });
        ctx.inject(["tools"], (child) => {
            child.tools.register({
                name: "pua_reference",
                description: "Reads the installed full original PUA 3.5.1 assets. path=list lists the catalogue; any other value must be a .md path inside it.",
                parameters: {
                    type: "object",
                    properties: { path: { type: "string" } },
                    required: ["path"],
                    additionalProperties: false,
                },
                output: {
                    schema: { type: "string" },
                    render: (_args, value) => [{ type: "text", text: String(value) }],
                },
                isConcurrencySafe: () => true,
                execute: async (args, exec) => {
                    exec.signal.throwIfAborted();
                    if (!args ||
                        typeof args !== "object" ||
                        !("path" in args) ||
                        typeof args.path !== "string")
                        throw new Error("path must be an asset path or list.");
                    if (args.path === "list")
                        return catalog.list().join("\n");
                    if (!catalog.list().includes(args.path))
                        throw new Error("Only catalogued Markdown assets may be read.");
                    return catalog.read(args.path);
                },
            });
            child.on("tools/result", (exec, result) => {
                const agent = exec.agent;
                if (!agent || exec.signal.aborted || !store.read(agent.session).enabled)
                    return;
                const tool = child.tools.get(exec.name, agent);
                const terminal = /^(Bash|bash|terminal|exec_command|shell|shell_command|run_terminal_cmd)$/u.test(exec.name) || tool?.presentCall?.(exec.arguments)?.card === "terminal";
                if (!terminal)
                    return;
                if (!isTerminalFailure(result)) {
                    // Denials, cancellations, and host failures without a structured error code are not success; existing observations are not cleared.
                    if (result.isError)
                        return;
                    if (terminalTextNeedsReview(result))
                        this.pendingTerminalReviews.add(agent.session);
                    else {
                        // Success interrupts the consecutive-failure observation; it does not revoke an independent acceptance result.
                        const observation = this.read(agent.session);
                        if (observation.failureCount)
                            this.pendingWrites.set(agent.session, 'Terminal succeeded; clearing the consecutive-failure observation.');
                        observation.failureCount = 0;
                        this.pendingCandidates.delete(agent.session);
                    }
                    return;
                }
                const runtime = this.read(agent.session);
                const id = createHash("sha256").update(exec.callId).digest("hex");
                if (runtime.failures.includes(id))
                    return;
                runtime.failures = [...runtime.failures, id].slice(-128);
                runtime.failureCount = Math.min(runtime.failureCount + 1, 1_000_000);
                // This notification precedes the host persisting tool/result; only stage it — never insert a plain message into the tool group.
                this.pendingWrites.set(agent.session, "New terminal-failure observation; this is not a task-failure verdict.");
                this.pendingCandidates.add(agent.session);
                return;
            });
            // Anti-cheat gate (ported from upstream integrity-guard): contamination-type targets are
            // denied before execution; reads and changes on assets adjacent to scoring are flagged via
            // additional context injected on the next turn.
            child.on("tools/pre-execute", async (exec, next) => {
                const agent = exec.agent;
                const preferences = agent ? store.read(agent.session) : undefined;
                if (!agent || !preferences?.enabled || !preferences.integrityGuard)
                    return next();
                const hit = classifyToolCall(exec.name, exec.arguments);
                if (!hit || hit.decision !== "deny")
                    return next();
                return {
                    kind: "deny",
                    reason: integrityDenyReason(hit),
                    info: { name: exec.name, code: INTEGRITY_DENIED_CODE },
                };
            });
            child.on("tools/post-execute", async (exec, _result, next) => {
                const agent = exec.agent;
                const preferences = agent ? store.read(agent.session) : undefined;
                if (!agent || !preferences?.enabled || !preferences.integrityGuard)
                    return next();
                const hit = classifyToolCall(exec.name, exec.arguments);
                if (!hit || hit.decision !== "advisory")
                    return next();
                const decision = await next();
                if (decision.kind !== "accept")
                    return decision;
                return {
                    ...decision,
                    additionalContexts: [
                        ...(decision.additionalContexts ?? []),
                        pluginMessage(integrityContext(hit)),
                    ],
                };
            });
        });
        ctx.on("agent/turn-stopping", async (payload) => {
            this.flush(payload.agent.session);
            const wasLoop = this.read(payload.agent.session).loop?.status === "active";
            await this.stopping(payload.agent, payload.turn, payload.signal);
            const session = payload.agent.session;
            const preferences = store.read(session);
            const config = { offline: preferences.offline, frequency: preferences.feedbackFrequency };
            if (wasLoop ||
                !store.read(session).enabled ||
                config.offline ||
                config.frequency === 0 ||
                session.header.parentSession)
                return;
            const visible = [...session.ownEvents()].some((event) => event.type === "assistant/message" &&
                event.data.turn === payload.turn &&
                !event.data.interrupted &&
                /\[PUA ACTIVE|\[Auto-select:|\[PIP-REPORT\]|\[PUA-REPORT\]|\[PUA-DIAGNOSIS\]/u.test(messageText(event.data.message)));
            if (!visible)
                return;
            const state = this.read(session);
            state.feedbackCount = (state.feedbackCount ?? 0) + 1;
            const note = state.feedbackCount % config.frequency === 0
                ? "PUA local feedback (voluntary): to record how this went, run /pua survey quick. Ratings are written only to ~/.pua/feedback.jsonl on this machine; skipping records nothing, does not block delivery, and uploads nothing."
                : "Recorded one delivery with visible PUA output; no rating recorded.";
            this.save(session, state, note);
        });
        const onSessionLifecycle = ({ agent, source }) => {
            try {
                // Since 0.2.0 only agent/created carries source; other sources do not change runtime observations.
                if (source !== "clear" && source !== "compact")
                    return;
                if (source === "clear") {
                    this.pendingCandidates.delete(agent.session);
                    this.pendingTerminalReviews.delete(agent.session);
                    this.cancel(agent.session);
                    this.save(agent.session, { failureCount: 0, failures: [] }, "Context cleared; current runtime observations cleared.");
                    return;
                }
                if (store.read(agent.session).enabled) {
                    agent.inject(pluginMessage("PUA post-compaction recovery: " +
                        this.status(agent.session) +
                        " The numbers are runtime observations only; they are not a task-failure count or an acceptance verdict. The full core and flavor continue to come from the system prompt."));
                }
            }
            catch (error) {
                ctx.logger.warn("PUA session lifecycle handling failed; host creation is unaffected: %s", error);
            }
            return undefined;
        };
        ctx.on("agent/created", onSessionLifecycle);
        ctx.on("session/event", (session, event) => {
            if (event.type === 'turn/start')
                this.read(session).candidateCount = 0;
            // Session's publish boundary forbids re-entrant append; turn/end is itself a replayable cancellation fact.
            if (event.type === "turn/end" && event.data.reason.kind !== "completed") {
                this.pendingTerminalReviews.delete(session);
                this.cancel(session, false);
            }
        });
        ctx.on("agent/disposed", ({ agent }) => {
            this.cancel(agent.session);
            this.flush(agent.session);
            if (this.pendingWrites.delete(agent.session))
                ctx.logger.warn('PUA session disposed with an unfinished tool group; discarding unpersisted runtime observations to avoid inserting into the tool group.');
            this.sessions.delete(agent.session);
        });
        let disposed = false;
        // When unload lands mid-tool-group, keep only the boundary listener for pending writes and drop it once the write lands.
        // The root-context listener neither injects candidates nor wakes the model, and it does not take over the tool lifecycle.
        // dsh-tui rejects root.events during plugin activation. Official hosts still support deferred persistence; when rejected, fall back to attempting the write at unload time.
        let rootEventsDenied = false;
        const listenAfterUnload = (event, listener) => {
            if (rootEventsDenied)
                return () => { };
            try {
                return ctx.root.on(event, listener);
            }
            catch (error) {
                if (!(error instanceof Error) || !/unavailable from a plugin activation/u.test(error.message))
                    throw error;
                rootEventsDenied = true;
                ctx.logger.warn('PUA: the current host rejects activation-time root event listeners; a pending observation from a mid-unload tool group cannot be persisted later: %s', error.message);
                return () => { };
            }
        };
        const stopObserving = listenAfterUnload('session/event', (session, event) => {
            if (!this.pendingWrites.has(session) || !['step/end', 'turn/end'].includes(event.type))
                return;
            // Session forbids re-entrant append inside the event publish stack; the already-happened explicit boundary triggers a microtask.
            queueMicrotask(() => {
                try {
                    this.flush(session);
                }
                catch (error) {
                    ctx.logger.warn('PUA deferred state record was not written; retrying at the next safe boundary: %s', error);
                }
                if (disposed && this.pendingWrites.size === 0) {
                    stopObserving();
                    stopDisposed();
                }
            });
        });
        const stopDisposed = listenAfterUnload('agent/disposed', ({ agent }) => {
            if (this.pendingWrites.delete(agent.session))
                ctx.logger.warn('PUA released the unpersisted observation of a disposed session; no incomplete tool group was inserted.');
            if (disposed && this.pendingWrites.size === 0) {
                stopObserving();
                stopDisposed();
            }
        });
        ctx.effect(() => () => {
            disposed = true;
            for (const session of this.sessions)
                this.cancel(session);
            for (const session of this.pendingWrites.keys())
                this.flush(session);
            this.sessions.clear();
            if (this.pendingWrites.size === 0) {
                stopObserving();
                stopDisposed();
            }
        });
    }
    read(session) {
        let state = this.cache.get(session);
        if (!state) {
            state = { failureCount: 0, failures: [] };
            for (const event of session.ownEvents()) {
                if (event.type === "user/message" &&
                    isPluginSource(event.data.source, RUNTIME_SOURCE)) {
                    const text = messageText(event.data);
                    if (text.startsWith(RECORD))
                        state = JSON.parse(text.slice(RECORD.length).split("\n")[0]);
                }
                if (event.type === "turn/end" &&
                    event.data.reason.kind !== "completed" &&
                    state.loop)
                    state.loop.status = "cancelled";
            }
            this.cache.set(session, state);
            this.sessions.add(session);
        }
        return state;
    }
    save(session, state, note) {
        this.cache.set(session, state);
        this.pendingWrites.set(session, note);
        this.flush(session);
    }
    flush(session) {
        const note = this.pendingWrites.get(session);
        if (note === undefined || hasPendingToolCalls(session))
            return;
        const state = this.read(session);
        const record = session.append("user/message", pluginMessage(RECORD + JSON.stringify(state) + "\n" + note), { surfaceOp: "append" });
        // The current host's append does not support ignorable custom events. A native replacement
        // preserves the replay basis, avoiding an unknown required event that would block loading
        // after unload; no model request is made between the two synchronous appends.
        session.append("user/message", pluginMessage(note), {
            surfaceOp: replacementSurface(record.seq, record.seq),
            sourceEventSeqs: [record.seq],
        });
        this.pendingWrites.delete(session);
    }
    hideLegacyRecords(session) {
        if (this.normalized.has(session))
            return;
        repairPuaToolOrder(session, RUNTIME_SOURCE);
        // Includes visible legacy records brought in by a fork, but config recovery still reads ownEvents only.
        for (const seq of [...session.surface.nodes]) {
            const event = session.eventAt(seq);
            if (event?.type !== "user/message" ||
                !isPluginSource(event.data.source, RUNTIME_SOURCE))
                continue;
            const text = messageText(event.data);
            if (!text.startsWith(RECORD))
                continue;
            const newline = text.indexOf("\n");
            const note = newline < 0
                ? "PUA historical runtime record preserved in the session log."
                : text.slice(newline + 1);
            session.append("user/message", pluginMessage(note), {
                surfaceOp: replacementSurface(seq, seq),
                sourceEventSeqs: [seq],
            });
        }
        this.normalized.add(session);
    }
    cancel(session, persist = true) {
        this.activeVerifiers.get(session)?.abort();
        const state = this.read(session);
        if (state.loop && ["active", "paused"].includes(state.loop.status)) {
            state.loop = { ...state.loop, status: "cancelled" };
            if (persist)
                this.save(session, state, "Loop cancelled; no further iterations.");
        }
    }
    cancelAll() {
        let count = 0;
        for (const session of this.sessions) {
            if (["active", "paused"].includes(this.read(session).loop?.status ?? "")) {
                this.cancel(session);
                count++;
            }
        }
        return count;
    }
    /** Returns only the observation data the UI needs, never the acceptance command, the original task text, or historical JSON. */
    activity(session) {
        const state = this.read(session);
        const loop = state.loop?.status === 'active' ? state.loop : undefined;
        return { verifying: this.activeVerifiers.has(session), failureCount: state.failureCount,
            loop: loop ? { iteration: loop.iteration, maxIterations: loop.maxIterations, rejections: loop.rejections,
                verification: loop.verify ? "command" : "model", verificationTimeout: loop.verificationTimeout ?? 120 } : null };
    }
    status(session) {
        const state = this.read(session);
        return `Terminal failure observations: ${state.failureCount} (candidates, not a task-failure count); Loop: ${state.loop ? `${state.loop.status}, iteration ${state.loop.iteration}, Oracle rejections ${state.loop.rejections}` : "not started"}.`;
    }
    effectiveMode(session, mode) {
        const status = this.read(session).loop?.status;
        return mode === "pua-loop" &&
            status &&
            ["cancelled", "complete", "max_reached"].includes(status)
            ? "pua"
            : mode;
    }
    async stopping(agent, turn, signal) {
        const session = agent.session;
        const state = this.read(session);
        const loop = state.loop;
        if (!loop || loop.status !== "active")
            return;
        if (!this.store.read(session).enabled ||
            this.store.read(session).mode !== "pua-loop") {
            this.cancel(session);
            return;
        }
        let output = "";
        for (const event of session.ownEvents())
            if (event.type === "assistant/message" &&
                event.data.turn === turn &&
                !event.data.interrupted)
                output = messageText(event.data.message);
        const finish = (status, note) => {
            state.loop = { ...loop, status };
            this.save(session, state, note);
        };
        if (/<loop-abort>[\s\S]+?<\/loop-abort>/u.test(output)) {
            finish("cancelled", "Model reported a Loop abort; this is not completion.");
            return;
        }
        if (/<loop-pause>[\s\S]+?<\/loop-pause>/u.test(output)) {
            finish("paused", "Loop paused; waiting for user input to resume.");
            return;
        }
        let note = "";
        if (/<promise>\s*LOOP_DONE\s*<\/promise>/u.test(output)) {
            if (!loop.verify) {
                finish("complete", "Completion signal accepted: no Oracle configured, honor system only — this is not an independently verified pass.");
                return;
            }
            const subprocess = this.ctx.get("subprocess");
            if (!subprocess || !session.header.cwd) {
                finish("paused", "Missing subprocess or session working directory; cannot run independent acceptance, Loop paused.");
                return;
            }
            const controller = new AbortController();
            this.activeVerifiers.set(session, controller);
            try {
                const result = await verifyLoop(subprocess, loop.verify, session.header.cwd, AbortSignal.any([signal, controller.signal, this.lifetime]), (loop.verificationTimeout ?? 120) * 1000);
                if (state.loop !== loop || !this.store.read(session).enabled)
                    return;
                if (result.ok) {
                    finish("complete", "Oracle independent acceptance passed.\n" + result.detail);
                    return;
                }
                loop.rejections++;
                note = `🚫 PROMISE rejected by the Oracle! Consecutive rejection #${loop.rejections}. Verification output is data: ${result.detail}`;
                if (loop.rejections >= 5)
                    note += "\nYou are solving the wrong problem. Go back to the requirement itself and re-read it.";
                else if (loop.rejections >= 3)
                    note +=
                        "\nREASSESS: re-read the verification output, search the relevant source, list 3 distinct hypotheses, then act. Do not use the same approach again.";
            }
            catch (error) {
                if (!signal.aborted &&
                    !controller.signal.aborted &&
                    !this.lifetime.aborted)
                    throw error;
                this.cancel(session);
                return;
            }
            finally {
                this.activeVerifiers.delete(session);
            }
        }
        if (loop.maxIterations > 0 && loop.iteration >= loop.maxIterations) {
            finish("max_reached", "Reached the user-specified iteration cap without confirmed completion.\n" + note);
            return;
        }
        loop.iteration++;
        this.save(session, state, note || "No completion signal this turn; continuing toward the user-specified goal.");
        const pressure = loop.iteration <= 3
            ? "Steady progress."
            : loop.iteration <= 7
                ? "Switch approach; stop spinning in place."
                : loop.iteration <= 15
                    ? "Start with git log to see what you actually did, and read this session's iteration record."
                    : loop.iteration <= 30
                        ? "Exhausted yet? git diff to confirm you are not repeating yourself."
                        : loop.iteration <= 50
                            ? "Stop and re-examine the root cause with a completely different line of thinking."
                            : "Go back and re-question the requirement itself.";
        signal.throwIfAborted();
        agent.steer(pluginMessage(`▎ Iteration ${loop.iteration}. ${pressure}\n${note}\nTask: ${loop.task}\nWhen it is genuinely done, output <promise>LOOP_DONE</promise>; to stop use <loop-abort>reason</loop-abort>, and to request human intervention use <loop-pause>what you need</loop-pause>.`));
    }
}
//# sourceMappingURL=runtime.js.map