import PuaRemote from '../lib/remote.js';
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Context } from "@deepseek-ai/cordis";
import { AgentRegistry } from "@deepseek-ai/dsh-agent";
import { AgentLoop } from "@deepseek-ai/dsh-agent-loop";
import { CommandRuntime } from "@deepseek-ai/dsh-commands";
import {
  LlmAdapter,
  LlmRuntime,
  createUserMessage,
} from "@deepseek-ai/dsh-llm";
import { SessionStore, Session } from "@deepseek-ai/dsh-session";
import { LocalSubprocessRuntime } from "@deepseek-ai/dsh-subprocess-local";
import { SessionProjectionRegistry } from "@deepseek-ai/dsh-session-projection";
import { SystemPrompt } from "@deepseek-ai/dsh-system-prompt";
import { ToolRuntime } from "@deepseek-ai/dsh-tools";
import { installSettings } from "./settings-host.mjs";
import { resolveAgentLoopConfig } from "./agent-loop-config.mjs";
import { HookContent } from "../lib/hook-content.js";
import { SourceCatalog } from "../lib/source.js";
import { FLAVORS } from "../lib/flavors.js";
import { isTerminalFailure, pluginMessage, PuaRuntime, verifyLoop } from "../lib/runtime.js";
import { StateStore } from "../lib/state.js";
import { parseArgs } from "../lib/args.js";
import * as plugin from "../lib/index.js";
import { requestSystem } from "./request-context.mjs";

async function setup(t, reply = () => "离线测试回复", settings = false) {
  const requests = [];
  class OfflineAdapter extends LlmAdapter {
    async *stream(options) {
      requests.push(options);
      const text = await reply(requests.length, options);
      yield { type: "block-start", index: 0, blockType: "text" };
      yield { type: "text-delta", index: 0, text };
      yield { type: "block-end", index: 0, block: { type: "text", text } };
      yield { type: "finish", reason: { kind: "stop" } };
    }
  }
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  new SessionStore(ctx);
  new AgentRegistry(ctx);
  new SessionProjectionRegistry(ctx);
  new LlmRuntime(ctx);
  new SystemPrompt(ctx, { includeHarnessIdentity: false });
  new ToolRuntime(ctx);
  new CommandRuntime(ctx);
  new AgentLoop(ctx, resolveAgentLoopConfig(AgentLoop));
  const settingsHost = settings ? await installSettings(ctx) : undefined;
  ctx.llm.registerAdapter(["offline-pua-test"], new OfflineAdapter());
  const installed = ctx.plugin(plugin);
  await installed.await();
  settingsHost?.attach(installed.config);
  const create = async (id) => {
    const handle = await ctx.agents.create({
      sessionId: id,
      meta: { cwd: process.cwd() },
      agentOptions: { provider: "offline-pua-test", model: "fixed-response" },
    });
    t.after(() => handle.dispose());
    return handle.agent;
  };
  const agent = await create("runtime-test");
  const run = (line, target = agent) =>
    ctx.commands.execute(target, line, [], new AbortController().signal);
  const say = async (text, target = agent) => {
    target.followup(
      createUserMessage({
        content: [{ type: "text", text }],
        source: { kind: "user" },
      }),
    );
    await target.whenIdle();
  };
  return { ctx, agent, run, say, create, requests, installed };
}

test('Loop uses session defaults and freezes the startup snapshot; global changes do not alter active parameters', async t => {
  const { ctx, agent, run } = await setup(t, () => '等待用户补充', true);
  await ctx.settings.update('phucnd0604-pua-en', { maxIterations: 3, verificationTimeout: 8 });
  await run('/pua config {"maxIterations":2}');
  await run('/pua loop "测试快照"'); await agent.whenIdle();
  const runtime = ctx.puaConfiguration.runtime;
  assert.equal(runtime.read(agent.session).loop.maxIterations, 2);
  assert.equal(runtime.read(agent.session).loop.verificationTimeout, 8);
  await ctx.settings.update('phucnd0604-pua-en', { maxIterations: 7, verificationTimeout: 30 });
  assert.equal(runtime.read(agent.session).loop.maxIterations, 2);
  assert.equal(runtime.read(agent.session).loop.verificationTimeout, 8);
  assert.equal(ctx.puaConfiguration.store.configuration(agent.session).verificationTimeout, 30);
  const loop = runtime.read(agent.session).loop;
  loop.status = 'active';
  assert.equal(runtime.activity(agent.session).loop.verificationTimeout, 8);
  assert.equal(runtime.activity(agent.session).loop.maxIterations, 2);
  assert.equal(runtime.activity(agent.session).loop.verification, 'model');
  loop.verify = 'node check.js';
  assert.equal(runtime.activity(agent.session).loop.verification, 'command');
  loop.status = 'cancelled';
  assert.equal(runtime.activity(agent.session).loop, null);
});

test("Original hook four-level templates expand for all 15 flavors; candidates keep the conditional gate and locked boundaries", () => {
  const hooks = new HookContent(new SourceCatalog());
  for (const flavor of FLAVORS)
    for (const flavorLocked of [true, false]) {
      const state = { flavor: flavor.id, flavorLocked };
      assert.match(hooks.frustrationPrompt(state), /User Frustration Signal/);
      for (const count of [2, 3, 4, 5]) {
        const text = hooks.candidate(count, state);
        assert.match(text, /Candidate Only/);
        assert.match(text, /not a task\/sub-goal failure count/);
        assert.doesNotMatch(text, /\$\{/);
        if (flavorLocked) assert.match(text, /locked|user-selected|user lock/i);
      }
    }
  assert.match(
    hooks.frustrationPrompt({ flavor: "huawei", flavorLocked: true }),
    /First I make a written pledge/,
  );
});

test("Recognizes only real terminal failures, excluding forged text, nested exit codes, cancellation, and denial", () => {
  const ok = (value) => ({ isError: false, value, content: [] });
  for (const value of [
    { stdout: "exitCode: 1 error failed" },
    { nested: { exitCode: 1 } },
    { exitCode: 0 },
    { exitCode: "1" },
  ])
    assert.equal(isTerminalFailure(ok(value)), false);
  assert.equal(isTerminalFailure(ok({ exitCode: 1 })), true);
  assert.equal(isTerminalFailure({ isError: true, error: { message: "宿主未就绪" } }), false);
  for (const code of [
    "ABORTED",
    "ABORTED_BEFORE_DISPATCH",
    "PERMISSION_DENIED",
    "APPROVAL_DENIED",
  ])
    assert.equal(
      isTerminalFailure({
        isError: true,
        error: { message: "failed", info: { code } },
      }),
      false,
    );
});

test("Loop arguments preserve Windows paths and reject unclosed quotes and duplicate options", () => {
  const action = parseArgs(
    'loop "修复测试" --verify "node D:\\tools\\check.js" --max-iterations 5',
  );
  assert.equal(action.verify, "node D:\\tools\\check.js");
  for (const text of [
    'loop "任务',
    'loop task --verify "unclosed',
    "loop task --verify a --verify b",
    "loop task --max-iterations 1 --max-iterations 2",
  ])
    assert.throws(() => parseArgs(text));
});

test("settings defaults stay separate from session overrides; commands do not write global values, and uncovered items are inherited dynamically", async (t) => {
  const { ctx, agent, run, say, create, requests, installed } = await setup(
    t,
    undefined,
    true,
  );
  assert.equal(
    ctx.settings.describe().find((item) => item.ns === "phucnd0604-pua-en").value
      .alwaysOn,
    true,
  );
  await say("初始任务");
  assert.equal(ctx.puaConfiguration.store.read(agent.session).enabled, false);
  assert.doesNotMatch(JSON.stringify(requests.at(-1)), /Flavor not locked/);
  await run("/pua on");
  await say("开启后才注入");
  assert.match(requestSystem(requests.at(-1)), /Flavor not locked/);
  await run("/pua flavor huawei");
  assert.equal(ctx.settings.get("phucnd0604-pua-en").flavor, "auto");
  const second = await create("new-session");
  await say("另一个任务", second);
  assert.equal(ctx.puaConfiguration.store.read(second.session).enabled, false);
  assert.doesNotMatch(JSON.stringify(requests.at(-1)), /Flavor not locked/);
  await run("/pua on", second);
  await ctx.settings.update('phucnd0604-pua-en', { flavor: 'tencent', mode: 'p9' });
  await say('读取全局变化', second);
  assert.match(requestSystem(requests.at(-1)), /User-locked flavor: tencent/);
  await say('保留我的风味', agent);
  assert.match(requestSystem(requests.at(-1)), /User-locked flavor: huawei/);
  assert.match(requestSystem(requests.at(-1)), /Current DSH mode: p9/);
  await run('/pua reset flavor');
  await say('重新跟随全局', agent);
  assert.match(requestSystem(requests.at(-1)), /User-locked flavor: tencent/);
  await run("/pua off");
  assert.equal(ctx.settings.get('phucnd0604-pua-en').alwaysOn, true);
  await run('/pua offline');
  assert.equal(ctx.settings.get('phucnd0604-pua-en').offline, false);
  await ctx.settings.update("phucnd0604-pua-en", {
    alwaysOn: true,
    flavor: "auto",
  });
  await say("再试试", agent);
  assert.match(requestSystem(requests.at(-1)), /mode is off/);
  assert.doesNotMatch(
    JSON.stringify(requests.at(-1).messages.at(-1)),
    /User Frustration Signal/,
  );
  await installed.dispose();
  assert.equal(
    ctx.settings.describe().some((item) => item.ns === "phucnd0604-pua-en"),
    false,
  );
});

test("After a global shutdown, /pua cannot enable the current session and injects no prompt", async (t) => {
  const { ctx, agent, run, requests } = await setup(t, () => "普通回复", true);
  await ctx.settings.update("phucnd0604-pua-en", { alwaysOn: false });
  const blocked = await run("/pua 修复登录");
  assert.equal(blocked.result.kind, "error");
  assert.match(blocked.result.text, /Allow PUA/);
  assert.match(blocked.result.text, /Open @phucnd0604\/dsh-pua-en under Plugins/);
  assert.equal(requests.length, 0);
  assert.equal(ctx.puaConfiguration.store.read(agent.session).enabled, false);
  const status = await run("/pua status");
  assert.equal(status.result.kind, "success");
  assert.match(status.result.text, /off;/);
});

test("Reference tool is really registered, reads the full body, rejects scripts and out-of-range paths, and disappears after uninstall", async (t) => {
  const { ctx, agent, installed } = await setup(t);
  const execute = (path) =>
    ctx.tools.execute({
      name: "pua_reference",
      arguments: { path },
      agent,
      callId: path,
      signal: new AbortController().signal,
    });
  const full = await execute("skills/pua/SKILL.md");
  assert.equal(full.value, new SourceCatalog().read("skills/pua/SKILL.md"));
  for (const path of ["../../package.json", "hooks/failure-detector.sh"])
    assert.equal((await execute(path)).isError, true);
  await installed.dispose();
  assert.equal(ctx.tools.get("pua_reference"), undefined);
});

test("Candidate failures are injected only after enabling; calls are deduplicated, success resets the count, and stopping does not inject again", async (t) => {
  const { ctx, agent, run, say, requests } = await setup(t);
  ctx.tools.register({
    name: "bash",
    description: "测试终端",
    parameters: { type: "object" },
    output: {
      schema: {
        type: "object",
        properties: { exitCode: { type: "integer" } },
        required: ["exitCode"],
      },
      render: (_, value) => [{ type: "text", text: JSON.stringify(value) }],
    },
    execute: async (args) => args,
  });
  const execute = (callId, exitCode = 1) =>
    ctx.tools.execute({
      name: "bash",
      arguments: { exitCode },
      agent,
      callId,
      signal: new AbortController().signal,
    });
  await run("/pua on");
  await run("/pua flavor huawei");
  await execute("failure-1");
  await execute("failure-1");
  assert.match((await run("/pua status")).result.text, /Terminal failure observations: 1/);
  const unguard = ctx.tools.guard(() => 'the user rejected tool "bash"');
  const rejected = await execute('denied');
  assert.equal(rejected.isError, true);
  assert.equal(rejected.error.info, undefined);
  assert.equal(isTerminalFailure(rejected), false);
  assert.match((await run('/pua status')).result.text, /Terminal failure observations: 1/);
  unguard();
  await execute("success", 0);
  assert.match((await run("/pua status")).result.text, /Terminal failure observations: 0/);
  await execute("failure-2");
  await execute("failure-2b");
  await say("继续");
  assert.match(JSON.stringify(requests.at(-1)), /PUA Candidate L1/);
  assert.match(JSON.stringify(requests.at(-1)), /First I make a written pledge/);
  await run("/pua off");
  await execute("failure-3");
  assert.match((await run("/pua status")).result.text, /Terminal failure observations: 2/);
});

test("Real stop boundaries continue the Loop; after Oracle rejection a later acceptance passes and the record replays", {
  timeout: 10000,
}, async (t) => {
  const { ctx, agent, run, requests } = await setup(
    t,
    () => "<promise>LOOP_DONE</promise>",
  );
  let checks = 0;
  ctx.provide("subprocess", {
    spawn(spec) {
      checks++;
      assert.ok(
        spec.argv.includes(
          "npm test\nif (-not $?) { exit 1 }; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }",
        ) || spec.argv.some((arg) => arg.includes("npm test")),
      );
      return {
        done: Promise.resolve({ exitCode: checks === 1 ? 1 : 0, signal: null }),
        collected: {
          stdout: {
            readFrom: () => ({
              text: checks === 1 ? "真实测试失败" : "通过",
              lossy: false,
            }),
          },
        },
      };
    },
  });
  assert.equal(
    (await run('/pua loop "修复测试" --verify "npm test" --max-iterations 4'))
      .result.kind,
    "success",
  );
  await agent.whenIdle();
  assert.equal(checks, 2);
  assert.equal(requests.length, 2);
  assert.match(JSON.stringify(requests[1]), /PROMISE rejected by the Oracle/);
  for (const request of requests)
    assert.doesNotMatch(
      JSON.stringify(request.messages),
      /PUA_RUNTIME_V1|"failureCount"|"failures"/,
    );
  assert.match(
    JSON.stringify(requests[0].messages),
    /PUA_LOOP_START.*npm test/,
  );
  assert.match(
    (await run("/pua status")).result.text,
    /Loop: complete.*Oracle rejections 1/,
  );
  assert.ok(
    agent.session
      .snapshotEvents()
      .some(
        (event) =>
          event.type === "user/message" &&
          JSON.stringify(event.data).includes("Oracle independent acceptance passed"),
      ),
  );
  // Rebuilding the host context without the plugin keeps the replacement relation valid and the full state replayable.
  const restored = Session.create(
    "oracle-restored",
    JSON.parse(JSON.stringify(agent.session.snapshotEvents())),
  );
  assert.doesNotMatch(
    JSON.stringify(restored.deriveMessages()),
    /PUA_RUNTIME_V1/,
  );
});

test("Legacy RECORD is replaced before the next request, preserving user text with the same name and historical state", async (t) => {
  const { agent, say, run, requests } = await setup(t);
  const record =
    "PUA_RUNTIME_V1 " +
    JSON.stringify({ failureCount: 2, failures: ["legacy-call"] }) +
    "\n旧运行说明";
  agent.session.append("user/message", pluginMessage(record), { surfaceOp: "append" });
  await say("普通任务");
  assert.doesNotMatch(
    JSON.stringify(requests.at(-1).messages),
    /PUA_RUNTIME_V1|legacy-call/,
  );
  // Create a fresh runtime instance to verify compatible restore without relying on caches the current instance already initialized.
  const context = new Context();
  t.after(() => context.fiber.dispose());
  const runtime = new PuaRuntime(
    context,
    new StateStore(),
    new SourceCatalog(),
    new AbortController().signal,
  );
  assert.equal(runtime.read(agent.session).failureCount, 2);
  await say("PUA_RUNTIME_V1 是什么？");
  assert.match(
    JSON.stringify(requests.at(-1).messages),
    /PUA_RUNTIME_V1 是什么/,
  );
  assert.equal((await run("/pua status")).result.kind, "success");
});

test("Reports a clear error when the hook template structure changes; the first failure follows the original and injects nothing", () => {
  const catalog = new SourceCatalog();
  const state = { flavor: "alibaba", flavorLocked: false };
  assert.equal(new HookContent(catalog).candidate(1, state), "");
  for (const marker of [
    "EOF_GATE",
    "EOF_ROUTING",
    "EOF_OUTPUT",
    "FLAVOR_CONTEXT",
  ]) {
    const modified = {
      read: (path) =>
        catalog.read(path).replaceAll(marker, "REMOVED_" + marker),
    };
    assert.throws(
      () => new HookContent(modified).candidate(2, state),
      /Original failure-candidate template structure mismatch/,
    );
  }
});

test("Real Windows Oracle preserves double quotes, backticks, newlines, and paths with spaces", {
  skip: process.platform !== "win32",
  // Four independent PowerShell launches need a total budget; this does not change a single command's run timeout.
  timeout: 60000,
}, async (t) => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const subprocess = new LocalSubprocessRuntime(ctx);
  const cases = [
    ['Write-Output "a b"', "a b"],
    ['Write-Output "a`"b"', 'a"b'],
    ['Write-Output "a`nb"', "a\nb"],
    [
      'if (-not (Test-Path -LiteralPath "$env:ProgramFiles")) { exit 9 }; Write-Output "space path OK"',
      "space path OK",
    ],
  ];
  for (const [command, expected] of cases) {
    const result = await verifyLoop(
      subprocess,
      command,
      process.cwd(),
      new AbortController().signal,
    );
    assert.equal(result.ok, true, result.detail);
    // Only normalize line endings; do not use trim() to hide a BOM or real spaces in the output.
    assert.equal(
      JSON.parse(result.detail).stdout.replaceAll("\r\n", "\n"),
      expected + "\n",
      command,
    );
  }
});

test("Real Windows Oracle native quote validation reads a BOM-less file without relying on stdin", {
  skip: process.platform !== "win32",
  timeout: 15000,
}, async (t) => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const subprocess = new LocalSubprocessRuntime(ctx);
  const directory = mkdtempSync(join(tmpdir(), "dsh-pua-oracle-"));
  t.after(() => rmdirSync(directory));
  const file = join(directory, "quoted 'input file.txt");
  // Node's utf8 write adds no BOM, avoiding PowerShell 5.1's -Encoding utf8 difference.
  writeFileSync(file, "a\r\nb\r\na b\r\n", "utf8");
  try {
    const literalPath = "'" + file.replaceAll("'", "''") + "'";
    for (const [pattern, expectedCode, expectedOutput] of [
      ["a b", 0, "a b\n"],
      ["missing phrase", 1, ""],
    ]) {
      const command = `& "$env:SystemRoot\\System32\\findstr.exe" /c:"${pattern}" ${literalPath}`;
      const result = await verifyLoop(
        subprocess,
        command,
        process.cwd(),
        new AbortController().signal,
      );
      const detail = JSON.parse(result.detail);
      assert.equal(
        result.ok,
        expectedCode === 0,
        command + "\n" + result.detail,
      );
      assert.equal(detail.exitCode, expectedCode, command);
      assert.equal(
        detail.stdout.replaceAll("\r\n", "\n"),
        expectedOutput,
        command,
      );
      assert.equal(detail.stderr, "", command);
    }
  } finally {
    unlinkSync(file);
  }
});

test("Real Windows Oracle uses PowerShell pipeline matching and fails explicitly on no match", {
  skip: process.platform !== "win32",
  timeout: 15000,
}, async (t) => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const subprocess = new LocalSubprocessRuntime(ctx);
  for (const [pattern, expectedCode, expectedOutput] of [
    ["a b", 0, "a b\n"],
    ["missing", 1, ""],
  ]) {
    // Select-String does not return a failure exit code on no match, so the acceptance script must signal failure itself.
    const command = `$puaMatch = "a b" | Select-String -SimpleMatch -Pattern "${pattern}"; if ($null -eq $puaMatch) { exit 1 }; Write-Output $puaMatch.Line`;
    const result = await verifyLoop(
      subprocess,
      command,
      process.cwd(),
      new AbortController().signal,
    );
    const detail = JSON.parse(result.detail);
    assert.equal(result.ok, expectedCode === 0, command + "\n" + result.detail);
    assert.equal(detail.exitCode, expectedCode, command);
    assert.equal(
      detail.stdout.replaceAll("\r\n", "\n"),
      expectedOutput,
      command,
    );
    assert.equal(detail.stderr, "", command);
  }
});

test("Without an Oracle it honestly records the honor system; the iteration cap prevents endless continuation", async (t) => {
  const { agent, run, requests } = await setup(t, (number) =>
    number <= 2 ? "还没完成" : "<promise>LOOP_DONE</promise>",
  );
  await run('/pua loop "测试上限" --max-iterations 2');
  await agent.whenIdle();
  assert.equal(requests.length, 2);
  assert.match((await run("/pua status")).result.text, /max_reached/);
  await run('/pua loop "无 Oracle 测试"');
  await agent.whenIdle();
  assert.match((await run("/pua status")).result.text, /complete/);
  assert.ok(
    agent.session
      .snapshotEvents()
      .some(
        (event) =>
          event.type === "user/message" &&
          JSON.stringify(event.data).includes("not an independently verified pass"),
      ),
  );
});

test("Turning off while the Oracle waits cancels verification; no continuation and cancellation is not treated as failure", {
  timeout: 5000,
}, async (t) => {
  const { ctx, agent, run, requests } = await setup(
    t,
    () => "<promise>LOOP_DONE</promise>",
  );
  let entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  let verifierSignal;
  ctx.provide("subprocess", {
    spawn(spec) {
      verifierSignal = spec.signal;
      const done = new Promise((resolve) =>
        spec.signal.addEventListener(
          "abort",
          () => resolve({ exitCode: null, signal: "SIGTERM" }),
          { once: true },
        ),
      );
      entered();
      return { done, collected: {} };
    },
  });
  await run('/pua loop "测试取消" --verify "npm test"');
  await ready;
  await run("/pua off");
  await agent.whenIdle();
  assert.equal(verifierSignal.aborted, true);
  assert.equal(requests.length, 1);
  assert.match(
    (await run("/pua status")).result.text,
    /cancelled.*Oracle rejections 0/,
  );
});

test("Pause is replayable but does not auto-run across a fork; after the user follows up it resumes in the same session", async (t) => {
  const { agent, run, say, requests } = await setup(t, (number) =>
    number === 1
      ? "<loop-pause>需要配置</loop-pause>"
      : "<promise>LOOP_DONE</promise>",
  );
  await run('/pua loop "暂停恢复" --max-iterations 3');
  await agent.whenIdle();
  assert.match((await run("/pua status")).result.text, /paused/);
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const runtime = new PuaRuntime(
    ctx,
    new StateStore(),
    new SourceCatalog(),
    new AbortController().signal,
  );
  const events = JSON.parse(JSON.stringify(agent.session.snapshotEvents()));
  const restored = Session.create("restored", events, {
    ...agent.session.header,
    id: "restored",
  });
  const fork = Session.create(
    "fork",
    events,
    {
      ...agent.session.header,
      id: "fork",
      parentSession: agent.id,
      isSeeded: true,
    },
    events.length,
  );
  assert.equal(runtime.read(restored).loop.status, "paused");
  assert.equal(runtime.read(fork).loop, undefined);
  await say("配置已补充，继续");
  assert.equal(requests.length, 2);
  assert.match((await run("/pua status")).result.text, /complete/);
});

test("The cancel alias covers a Loop that has not started and cannot be revived by a queued old request", {
  timeout: 5000,
}, async (t) => {
  let entered, release;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const { agent, run, requests } = await setup(t, async (number) => {
    if (number === 1) {
      entered();
      await wait;
    }
    return "普通回复";
  });
  await run("/pua 普通任务");
  await ready;
  await run('/pua loop "排队任务" --max-iterations 5');
  await run("/pua-cancel-loop");
  release();
  await agent.whenIdle();
  assert.equal(requests.length, 2);
  assert.match((await run("/pua status")).result.text, /Loop: not started/);
  assert.match(requestSystem(requests[1]), /Current DSH mode: pua\./);
});

test("User cancellation and unload cancel the active Loop, and it is not restored on the next ordinary input", {
  timeout: 5000,
}, async (t) => {
  for (const mode of ["user", "unload"]) {
    let entered, release;
    const ready = new Promise((resolve) => {
      entered = resolve;
    });
    const wait = new Promise((resolve) => {
      release = resolve;
    });
    const { agent, run, requests, installed, ctx, say } = await setup(
      t,
      async (number) => {
        if (number === 1) {
          entered();
          await wait;
        }
        return "尚未完成";
      },
    );
    await run('/pua loop "取消测试" --max-iterations 5');
    await ready;
    if (mode === "user") agent.cancel({ kind: "user" });
    else await installed.dispose();
    release();
    await agent.whenIdle();
    assert.equal(requests.length, 1);
    if (mode === "unload") await ctx.plugin(plugin).await();
    await say("普通输入");
    assert.equal(requests.length, 2);
    assert.match(requestSystem(requests[1]), /Current DSH mode: pua\./);
    assert.match((await run("/pua status")).result.text, /cancelled/);
  }
});

test("Real Oracle: non-zero exit codes, a missing command, and a timeout are never mistaken for success", {
  timeout: 15000,
}, async (t) => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const subprocess = new LocalSubprocessRuntime(ctx);
  const signal = new AbortController().signal;
  assert.equal(
    (await verifyLoop(subprocess, "exit 0", process.cwd(), signal)).ok,
    true,
  );
  assert.equal(
    (await verifyLoop(subprocess, "exit 7", process.cwd(), signal)).ok,
    false,
  );
  assert.equal(
    (
      await verifyLoop(
        subprocess,
        "pua_nonexistent_command_for_test",
        process.cwd(),
        signal,
      )
    ).ok,
    false,
  );
  const timeout = await verifyLoop(
    subprocess,
    process.platform === "win32" ? "Start-Sleep -Seconds 30" : "sleep 30",
    process.cwd(),
    signal,
    100,
  );
  assert.equal(timeout.ok, false);
  assert.match(timeout.detail, /timedOut.*true/);
});

test("Feedback relies only on visible narration and does not wake the model; offline mode turns reminders off", async (t) => {
  const { ctx, agent, run, say, requests } = await setup(
    t,
    () => "[PUA-DIAGNOSIS] 可见诊断及交付",
    true,
  );
  await ctx.settings.update("phucnd0604-pua-en", { feedbackFrequency: 1 });
  await run("/pua on");
  await say("完成任务");
  const reminders = () =>
    agent.session
      .deriveMessages()
      .filter((message) =>
        JSON.stringify(message).includes("PUA local feedback (voluntary)"),
      );
  assert.equal(reminders().length, 1);
  assert.equal(requests.length, 1);
  await run("/pua offline");
  await say("另一个任务");
  assert.equal(reminders().length, 1);
  assert.equal(requests.length, 2);
});

async function seedTerminalFailure(ctx, agent, run, callId) {
  await run("/pua on");
  ctx.tools.register({
    name: "bash",
    description: "测试",
    parameters: { type: "object" },
    output: { schema: { type: "object" }, render: () => [] },
    execute: async () => ({ exitCode: 1 }),
  });
  await ctx.tools.execute({
    name: "bash",
    arguments: {},
    agent,
    callId,
    signal: new AbortController().signal,
  });
}

test("agent/created compaction keeps observations, clear resets the count and does not revive the old loop", async (t) => {
  const { ctx, agent, run } = await setup(t);
  await seedTerminalFailure(ctx, agent, run, "created-clear-failure");
  assert.match((await run("/pua status")).result.text, /Terminal failure observations: 1/);
  ctx.emit("agent/created", { agent, source: "compact" });
  assert.match((await run("/pua status")).result.text, /Terminal failure observations: 1/);
  ctx.emit("agent/created", { agent, source: "clear" });
  assert.match(
    (await run("/pua status")).result.text,
    /Terminal failure observations: 0.*not started/,
  );
});

test("agent/created without source does not change runtime observations", async (t) => {
  const { ctx, agent, run } = await setup(t);
  await seedTerminalFailure(ctx, agent, run, "created-nosource-failure");
  let injected = 0;
  const inject = agent.inject.bind(agent);
  agent.inject = (message) => {
    injected += 1;
    return inject(message);
  };
  ctx.emit("agent/created", { agent });
  assert.match((await run("/pua status")).result.text, /Terminal failure observations: 1/);
  assert.equal(injected, 0);
});

test("Session lifecycle handling failure only logs and does not throw outward", async (t) => {
  const { ctx, agent, run } = await setup(t);
  await run("/pua on");
  const warnings = [];
  const warn = ctx.logger.warn.bind(ctx.logger);
  ctx.logger.warn = (...args) => {
    warnings.push(args);
    return warn(...args);
  };
  agent.inject = () => {
    throw new Error("inject failed");
  };
  ctx.emit("agent/created", { agent, source: "compact" });
  assert.match(String(warnings.at(-1)), /host creation is unaffected/);
});

test("Consecutively queued Loops only let the newest command start the loop; old tasks do not restore old config", {
  timeout: 5000,
}, async (t) => {
  let entered, release;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const { agent, run, requests } = await setup(t, async (number) => {
    if (number === 1) {
      entered();
      await wait;
    }
    return "继续处理";
  });
  await run("/pua 普通任务");
  await ready;
  await run('/pua loop "旧任务" --max-iterations 2');
  await run("/pua-cancel-loop");
  await run('/pua loop "最新任务" --max-iterations 2');
  release();
  await agent.whenIdle();
  assert.equal(requests.length, 4);
  const starts = agent.session
    .snapshotEvents()
    .filter(
      (event) =>
        event.type === "user/message" &&
        event.surfaceOp === "append" &&
        JSON.stringify(event.data).includes(
          "Loop started explicitly; the verification config follows the user command.",
        ),
    );
  assert.equal(starts.length, 1);
  assert.match(JSON.stringify(starts[0]), /最新任务/);
});


test('Real host task start shows the running card, end hides it, and status reads append no session messages', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { ctx, agent, say, run } = await setup(t, async () => { await gate; return '任务完成'; }, true);
  const read = () => PuaRemote.prototype.getActivity.call({ ctx, agent: () => agent }, agent.id);
  await run('/pua on');
  assert.equal(read().visible, false);
  const task = say('运行卡片生命周期');
  assert.equal(agent.status, 'running');
  assert.equal(read().visible, true);
  const before = [...agent.session.ownEvents()].length;
  read(); read();
  assert.equal([...agent.session.ownEvents()].length, before);
  release(); await task;
  assert.equal(agent.status, 'idle');
  assert.equal(read().visible, false);
});
