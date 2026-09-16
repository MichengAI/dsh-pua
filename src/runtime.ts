import type { Context } from "@deepseek-ai/cordis";
import { createHash } from "node:crypto";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import type { Session, UserMessage } from "@deepseek-ai/dsh-session";
import type { ToolExecutionResult } from "@deepseek-ai/dsh-tools";
import type { SubprocessRuntime } from "@deepseek-ai/dsh-subprocess";
import type { Action } from "./args.js";
import { HookContent } from "./hook-content.js";
import { SourceCatalog } from "./source.js";
import { StateStore } from "./state.js";
import type { PuaMode } from "./content.js";
import { hasPendingToolCalls, repairPuaToolOrder } from "./tool-order.js";
import { replacementSurface } from "./session-compat.js";
import { terminalTextNeedsReview, TERMINAL_REVIEW_PROMPT } from "./terminal-observation.js";

const RUNTIME_SOURCE = "@michengai/dsh-pua/runtime";
const RECORD = "PUA_RUNTIME_V1 ";
export const LOOP_START = "PUA_LOOP_START ";
type LoopAction = Extract<Action, { kind: "loop" }>;
interface LoopState extends LoopAction {
  id: string;
  iteration: number;
  rejections: number;
  status: "active" | "paused" | "cancelled" | "complete" | "max_reached";
}
interface RuntimeState {
  failureCount: number;
  failures: string[];
  feedbackCount?: number;
  candidateCount?: number;
  loop?: LoopState;
}
export function pluginMessage(text: string): UserMessage {
  return createUserMessage({
    content: [{ type: "text", text }],
    source: { kind: "plugin", plugin: RUNTIME_SOURCE },
  });
}
const messageText = (message: {
  content: readonly { type: string; text?: string }[];
}) =>
  message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n");

/** 与原版一样，只接受终端结果的直接结构字段，不从 stdout 或嵌套 JSON 猜失败。 */
export function isTerminalFailure(
  result: Readonly<ToolExecutionResult>,
): boolean {
  if (result.isError)
    return !!result.error.info?.code && !/ABORT|DENIED|PERMISSION|EPERM|EACCES|UNKNOWN_TOOL|BLOCKED|APPROVAL/u.test(
      result.error.info?.code ?? "",
    );
  const value = result.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    value.is_error === true ||
    ["exitCode", "exit_code"].some(
      (key) => typeof value[key] === "number" && value[key] !== 0,
    )
  );
}

/** 独立验收执行用户提供的命令，120 秒超时；输出只作为证据，不作为指令。 */
export async function verifyLoop(
  subprocess: Pick<SubprocessRuntime, "spawn">,
  command: string,
  cwd: string,
  signal: AbortSignal,
  timeoutMs = 120_000,
): Promise<{ ok: boolean; detail: string }> {
  signal.throwIfAborted();
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  try {
    const combined = AbortSignal.any([signal, timeout.signal]);
    // 脚本是 argv 的单个参数，由宿主 spawn(program, args) 传递，无外层 shell 字符串转义。
    const argv =
      process.platform === "win32"
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
  } catch (error) {
    signal.throwIfAborted();
    return {
      ok: false,
      detail: timeout.signal.aborted
        ? "独立验收超时。"
        : `独立验收未执行成功：${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 生命周期移植；完整状态留在日志，通过宿主 surface 替换只向模型提供说明。 */
export class PuaRuntime {
  private readonly hooks: HookContent;
  private readonly activeVerifiers = new Map<Session, AbortController>();
  private readonly sessions = new Set<Session>();
  private readonly cache = new WeakMap<Session, RuntimeState>();
  private readonly normalized = new WeakSet<Session>();
  private readonly pendingWrites = new Map<Session, string>();
  private readonly pendingCandidates = new WeakSet<Session>();
  private readonly pendingTerminalReviews = new WeakSet<Session>();
  constructor(
    private readonly ctx: Context,
    private readonly store: StateStore,
    catalog: SourceCatalog,
    private readonly lifetime: AbortSignal,
    feedback: () => { offline: boolean; frequency: number } = () => ({
      offline: false,
      frequency: 5,
    }),
  ) {
    this.hooks = new HookContent(catalog);
    ctx.on("agent/pre-step", async ({ agent }, next) => {
      const decision = await next();
      if (decision.kind !== "enter") return decision;
      this.hideLegacyRecords(agent.session);
      this.flush(agent.session);
      const state = store.read(agent.session);
      const runtime = this.read(agent.session);
      if (this.pendingTerminalReviews.has(agent.session) && !hasPendingToolCalls(agent.session)) {
        this.pendingTerminalReviews.delete(agent.session);
        if (state.enabled && state.terminalReview) decision.messages.push(pluginMessage(TERMINAL_REVIEW_PROMPT));
      }
      if (this.pendingCandidates.has(agent.session) && !hasPendingToolCalls(agent.session)) {
        this.pendingCandidates.delete(agent.session);
        let prompt = '';
        if (state.enabled && state.failureCandidates && (runtime.candidateCount ?? 0) < 4) {
          try { prompt = this.hooks.candidate(runtime.failureCount, state); }
          catch (error) { ctx.logger.warn('PUA 候选素材不可用，跳过本次提示：%s', error); }
          if (prompt) runtime.candidateCount = (runtime.candidateCount ?? 0) + 1;
        }
        if (prompt) decision.messages.push(pluginMessage(prompt));
      }
      if (!state.enabled || state.mode !== "pua-loop")
        this.cancel(agent.session);
      for (const message of decision.messages) {
        const text = messageText(message);
        if (
          message.source.kind === "plugin" &&
          message.source.plugin === "@michengai/dsh-pua" &&
          text.startsWith(LOOP_START) &&
          state.enabled &&
          state.mode === "pua-loop"
        ) {
          const config = JSON.parse(
            text.slice(LOOP_START.length).split("\n")[0]!,
          ) as LoopAction & { id: string };
          if (config.id !== state.loopCommandId) continue;
          runtime.loop = {
            ...config,
            iteration: 1,
            rejections: 0,
            status: "active",
          };
          this.save(
            agent.session,
            runtime,
            "显式启动 Loop；验证配置以用户命令为准。",
          );
        } else if (message.source.kind === "user" && state.enabled) {
          if (runtime.loop?.status === "paused" && state.mode === "pua-loop") {
            runtime.loop = { ...runtime.loop, status: "active" };
            this.save(
              agent.session,
              runtime,
              "用户补充输入，恢复同会话 Loop。",
            );
          }
          if (state.qualityTriggers && this.hooks.trigger.test(text))
            decision.messages.push(
              pluginMessage(this.hooks.frustrationPrompt(state)),
            );
        }
      }
      return decision;
    });
    ctx.inject(["tools"], (child) => {
      child.tools.register({
        name: "pua_reference",
        description:
          "读取已安装的 PUA 3.5.1 完整原版资料。path=list 列目录；其他值必须为目录中 .md 路径。",
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
          if (
            !args ||
            typeof args !== "object" ||
            !("path" in args) ||
            typeof args.path !== "string"
          )
            throw new Error("path 必须为资料路径或 list。");
          if (args.path === "list") return catalog.list().join("\n");
          if (!catalog.list().includes(args.path))
            throw new Error("仅允许读取已收录的 Markdown 资料。");
          return catalog.read(args.path);
        },
      });
      child.on("tools/result", (exec, result) => {
        const agent = exec.agent;
        if (!agent || exec.signal.aborted || !store.read(agent.session).enabled)
          return;
        const tool = child.tools.get(exec.name, agent);
        const terminal =
          /^(Bash|bash|terminal|exec_command|shell|shell_command|run_terminal_cmd)$/u.test(
            exec.name,
          ) || tool?.presentCall?.(exec.arguments)?.card === "terminal";
        if (!terminal) return;
        if (!isTerminalFailure(result)) {
          // 拒绝、取消及无结构化错误码的宿主故障不是成功，不清零已有观察。
          if (result.isError) return;
          if (terminalTextNeedsReview(result)) this.pendingTerminalReviews.add(agent.session);
          else {
            // 成功打断连续失败观察；不会撤销独立验收结果。
            const observation = this.read(agent.session);
            if (observation.failureCount) this.pendingWrites.set(agent.session, '终端成功，清除连续失败观察。');
            observation.failureCount = 0;
            this.pendingCandidates.delete(agent.session);
          }
          return;
        }
        const runtime = this.read(agent.session);
        const id = createHash("sha256").update(exec.callId).digest("hex");
        if (runtime.failures.includes(id)) return;
        runtime.failures = [...runtime.failures, id].slice(-128);
        runtime.failureCount = Math.min(runtime.failureCount + 1, 1_000_000);
        // 此通知早于宿主 tool/result 落库；只暂存，不能在工具组中插入普通消息。
        this.pendingWrites.set(
          agent.session,
          "新增终端失败观察；不是任务失败判定。",
        );
        this.pendingCandidates.add(agent.session);
        return;
      });
    });
    ctx.on("agent/turn-stopping", async (payload) => {
      this.flush(payload.agent.session);
      const wasLoop =
        this.read(payload.agent.session).loop?.status === "active";
      await this.stopping(payload.agent, payload.turn, payload.signal);
      const session = payload.agent.session;
      const preferences = store.read(session);
      const config = { offline: preferences.offline, frequency: preferences.feedbackFrequency };
      if (
        wasLoop ||
        !store.read(session).enabled ||
        config.offline ||
        config.frequency === 0 ||
        session.header.parentSession
      )
        return;
      const visible = [...session.ownEvents()].some(
        (event) =>
          event.type === "assistant/message" &&
          event.data.turn === payload.turn &&
          !event.data.interrupted &&
          /PUA生效|\[Auto-select:|\[PIP-REPORT\]|\[PUA-REPORT\]|\[PUA-DIAGNOSIS\]/u.test(
            messageText(event.data.message),
          ),
      );
      if (!visible) return;
      const state = this.read(session);
      state.feedbackCount = (state.feedbackCount ?? 0) + 1;
      const note =
        state.feedbackCount % config.frequency === 0
          ? "PUA 本地反馈（自愿）：如需记录本次效果，可运行 /pua survey quick。评分只写本机 ~/.pua/feedback.jsonl；跳过不记录，不阻断交付，不上传。"
          : "记录一次有可见 PUA 输出的交付，不记录评分。";
      this.save(session, state, note);
    });
    const onSessionLifecycle = ({ agent, source }: { agent: Agent; source: string }) => {
      if (source === "clear") {
        this.pendingCandidates.delete(agent.session);
        this.pendingTerminalReviews.delete(agent.session);
        this.cancel(agent.session);
        this.save(
          agent.session,
          { failureCount: 0, failures: [] },
          "清空上下文，清除当前运行观察。",
        );
      } else if (source === "compact" && store.read(agent.session).enabled) {
        agent.inject(
          pluginMessage(
            "PUA 压缩后恢复：" +
              this.status(agent.session) +
              " 数值仅为运行观察；不代表任务失败次数或验收结论。完整核心与风味继续由系统提示词提供。",
          ),
        );
      }
    };
    // 0.1.5 发 session-start；0.1.6 改为异步串行 created。两条都挂，各宿主只发其中一个。
    const listen = ctx.on.bind(ctx) as (event: string, listener: typeof onSessionLifecycle) => void;
    listen("agent/session-start", onSessionLifecycle);
    listen("agent/created", onSessionLifecycle);
    ctx.on("session/event", (session, event) => {
      if (event.type === 'turn/start') this.read(session).candidateCount = 0;
      // Session 的发布边界禁止重入 append；turn/end 本身已是可回放的取消事实。
      if (event.type === "turn/end" && event.data.reason.kind !== "completed") {
        this.pendingTerminalReviews.delete(session);
        this.cancel(session, false);
      }
    });
    ctx.on("agent/disposed", ({ agent }) => {
      this.cancel(agent.session);
      this.flush(agent.session);
      if (this.pendingWrites.delete(agent.session)) ctx.logger.warn('PUA 会话已销毁且工具组未完整结束，丢弃未落库的运行观察，避免插入工具组。');
      this.sessions.delete(agent.session);
    });
    let disposed = false;
    // 卸载发生在工具组中途时，只保留待写状态的边界监听，写完即撤销。
    // 根上下文监听不注入候选或唤醒模型，也不接管工具生命周期。
    const stopObserving = ctx.root.on('session/event', (session, event) => {
      if (!this.pendingWrites.has(session) || !['step/end', 'turn/end'].includes(event.type)) return;
      // Session 禁止在事件发布栈重入 append；由已发生的明确边界触发微任务。
      queueMicrotask(() => {
        try { this.flush(session); }
        catch (error) { ctx.logger.warn('PUA 延后状态记录未写入，将在下一安全边界重试：%s', error); }
        if (disposed && this.pendingWrites.size === 0) { stopObserving(); stopDisposed(); }
      });
    });
    const stopDisposed = ctx.root.on('agent/disposed', ({ agent }) => {
      if (this.pendingWrites.delete(agent.session)) ctx.logger.warn('PUA 已销毁会话的未落库观察已释放；未插入不完整工具组。');
      if (disposed && this.pendingWrites.size === 0) { stopObserving(); stopDisposed(); }
    });
    ctx.effect(() => () => {
      disposed = true;
      for (const session of this.sessions) this.cancel(session);
      for (const session of this.pendingWrites.keys()) this.flush(session);
      this.sessions.clear();
      if (this.pendingWrites.size === 0) { stopObserving(); stopDisposed(); }
    });
  }
  read(session: Session): RuntimeState {
    let state = this.cache.get(session);
    if (!state) {
      state = { failureCount: 0, failures: [] };
      for (const event of session.ownEvents()) {
        if (
          event.type === "user/message" &&
          event.data.source.kind === "plugin" &&
          event.data.source.plugin === RUNTIME_SOURCE
        ) {
          const text = messageText(event.data);
          if (text.startsWith(RECORD))
            state = JSON.parse(
              text.slice(RECORD.length).split("\n")[0]!,
            ) as RuntimeState;
        }
        if (
          event.type === "turn/end" &&
          event.data.reason.kind !== "completed" &&
          state.loop
        )
          state.loop.status = "cancelled";
      }
      this.cache.set(session, state);
      this.sessions.add(session);
    }
    return state;
  }
  private save(session: Session, state: RuntimeState, note: string): void {
    this.cache.set(session, state);
    this.pendingWrites.set(session, note);
    this.flush(session);
  }
  private flush(session: Session): void {
    const note = this.pendingWrites.get(session);
    if (note === undefined || hasPendingToolCalls(session)) return;
    const state = this.read(session);
    const record = session.append(
      "user/message",
      pluginMessage(RECORD + JSON.stringify(state) + "\n" + note),
      { surfaceOp: "append" },
    );
    // 当前宿主 append 不支持 ignorable 自定义事件。用原生替换保留回放依据，
    // 避免未知必需事件导致卸载后无法加载；两次同步 append 之间不发起模型请求。
    session.append("user/message", pluginMessage(note), {
      surfaceOp: replacementSurface(record.seq, record.seq),
      sourceEventSeqs: [record.seq],
    });
    this.pendingWrites.delete(session);
  }
  private hideLegacyRecords(session: Session): void {
    if (this.normalized.has(session)) return;
    repairPuaToolOrder(session, RUNTIME_SOURCE);
    // 包括分叉带入的可见旧记录，但配置恢复仍只读取 ownEvents。
    for (const seq of [...session.surface.nodes]) {
      const event = session.eventAt(seq);
      if (
        event?.type !== "user/message" ||
        event.data.source.kind !== "plugin" ||
        event.data.source.plugin !== RUNTIME_SOURCE
      )
        continue;
      const text = messageText(event.data);
      if (!text.startsWith(RECORD)) continue;
      const newline = text.indexOf("\n");
      const note =
        newline < 0
          ? "PUA 历史运行记录已保留在会话日志中。"
          : text.slice(newline + 1);
      session.append("user/message", pluginMessage(note), {
        surfaceOp: replacementSurface(seq, seq),
        sourceEventSeqs: [seq],
      });
    }
    this.normalized.add(session);
  }
  cancel(session: Session, persist = true): void {
    this.activeVerifiers.get(session)?.abort();
    const state = this.read(session);
    if (state.loop && ["active", "paused"].includes(state.loop.status)) {
      state.loop = { ...state.loop, status: "cancelled" };
      if (persist) this.save(session, state, "Loop 已取消，不再续轮。");
    }
  }
  cancelAll(): number {
    let count = 0;
    for (const session of this.sessions) {
      if (
        ["active", "paused"].includes(this.read(session).loop?.status ?? "")
      ) {
        this.cancel(session);
        count++;
      }
    }
    return count;
  }
  /** 仅返回界面需要的观察数据，不暴露验收命令、任务原文或历史 JSON。 */
  activity(session: Session) {
    const state = this.read(session);
    const loop = state.loop?.status === 'active' ? state.loop : undefined;
    return { verifying: this.activeVerifiers.has(session), failureCount: state.failureCount,
      loop: loop ? { iteration: loop.iteration, maxIterations: loop.maxIterations, rejections: loop.rejections,
        verification: loop.verify ? "command" as const : "model" as const, verificationTimeout: loop.verificationTimeout ?? 120 } : null };
  }
  status(session: Session): string {
    const state = this.read(session);
    return `终端失败观察：${state.failureCount}（候选，非任务失败数）；Loop：${state.loop ? `${state.loop.status}，第 ${state.loop.iteration} 轮，Oracle 拒绝 ${state.loop.rejections} 次` : "未启动"}。`;
  }
  effectiveMode(session: Session, mode: PuaMode): PuaMode {
    const status = this.read(session).loop?.status;
    return mode === "pua-loop" &&
      status &&
      ["cancelled", "complete", "max_reached"].includes(status)
      ? "pua"
      : mode;
  }
  private async stopping(
    agent: Agent,
    turn: number,
    signal: AbortSignal,
  ): Promise<void> {
    const session = agent.session;
    const state = this.read(session);
    const loop = state.loop;
    if (!loop || loop.status !== "active") return;
    if (
      !this.store.read(session).enabled ||
      this.store.read(session).mode !== "pua-loop"
    ) {
      this.cancel(session);
      return;
    }
    let output = "";
    for (const event of session.ownEvents())
      if (
        event.type === "assistant/message" &&
        event.data.turn === turn &&
        !event.data.interrupted
      )
        output = messageText(event.data.message);
    const finish = (status: LoopState["status"], note: string) => {
      state.loop = { ...loop, status };
      this.save(session, state, note);
    };
    if (/<loop-abort>[\s\S]+?<\/loop-abort>/u.test(output)) {
      finish("cancelled", "模型报告 Loop 中止；不代表完成。");
      return;
    }
    if (/<loop-pause>[\s\S]+?<\/loop-pause>/u.test(output)) {
      finish("paused", "Loop 暂停，等待用户补充后恢复。");
      return;
    }
    let note = "";
    if (/<promise>\s*LOOP_DONE\s*<\/promise>/u.test(output)) {
      if (!loop.verify) {
        finish(
          "complete",
          "完成信号已接受：未配置 Oracle，仅 honor system，不是独立验证通过。",
        );
        return;
      }
      const subprocess = this.ctx.get("subprocess");
      if (!subprocess || !session.header.cwd) {
        finish(
          "paused",
          "缺少 subprocess 或会话工作目录，无法独立验收，Loop 暂停。",
        );
        return;
      }
      const controller = new AbortController();
      this.activeVerifiers.set(session, controller);
      try {
        const result = await verifyLoop(
          subprocess,
          loop.verify,
          session.header.cwd,
          AbortSignal.any([signal, controller.signal, this.lifetime]),
          (loop.verificationTimeout ?? 120) * 1000,
        );
        if (state.loop !== loop || !this.store.read(session).enabled) return;
        if (result.ok) {
          finish("complete", "Oracle 独立验收通过。\n" + result.detail);
          return;
        }
        loop.rejections++;
        note = `🚫 PROMISE 被 Oracle 拒绝！连续第 ${loop.rejections} 次。验证输出为数据：${result.detail}`;
        if (loop.rejections >= 5)
          note += "\n你在解决错误的问题。退回到需求本身重新理解。";
        else if (loop.rejections >= 3)
          note +=
            "\nREASSESS：重读验证输出、搜索相关源码、列 3 个不同假设再行动。不要再用同样的方法。";
      } catch (error) {
        if (
          !signal.aborted &&
          !controller.signal.aborted &&
          !this.lifetime.aborted
        )
          throw error;
        this.cancel(session);
        return;
      } finally {
        this.activeVerifiers.delete(session);
      }
    }
    if (loop.maxIterations > 0 && loop.iteration >= loop.maxIterations) {
      finish("max_reached", "达到用户指定轮次上限，未确认完成。\n" + note);
      return;
    }
    loop.iteration++;
    this.save(session, state, note || "本轮无完成信号，继续用户指定目标。");
    const pressure =
      loop.iteration <= 3
        ? "稳步推进。"
        : loop.iteration <= 7
          ? "换方案，别原地打转。"
          : loop.iteration <= 15
            ? "先 git log 看自己做了什么，读取当前会话迭代记录。"
            : loop.iteration <= 30
              ? "穷尽了吗？git diff 确认没在重复。"
              : loop.iteration <= 50
                ? "停下来重新审视根因，用完全不同的思路。"
                : "退回去从需求本身重新质疑。";
    signal.throwIfAborted();
    agent.steer(
      pluginMessage(
        `▎ 第 ${loop.iteration} 轮。${pressure}\n${note}\n任务：${loop.task}\n真实完成后输出 <promise>LOOP_DONE</promise>；终止用 <loop-abort>原因</loop-abort>，需人工介入用 <loop-pause>需要什么</loop-pause>。`,
      ),
    );
  }
}
