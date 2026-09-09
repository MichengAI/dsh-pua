import { resolveFlavor, type FlavorId } from './flavors.js';
import { MODES, type PuaMode } from './content.js';

export type Action =
  | { readonly kind: 'activate' | 'review'; readonly task: string }
  | { readonly kind: 'flavor'; readonly flavor: FlavorId | 'auto' }
  | { readonly kind: 'mode'; readonly mode: PuaMode; readonly task: string }
  | { readonly kind: 'loop'; readonly task: string; readonly maxIterations: number; readonly verify?: string }
  | { readonly kind: 'again' | 'done-check' | 'evidence' | 'kpi' | 'survey'; readonly task?: string }
  | { readonly kind: 'on' | 'off' | 'offline' | 'status' | 'help' | 'flavors' | 'cancel-pua-loop' | 'team-status' | 'reap-orphans' | 'teardown-all' };

/** 解析 /pua 后的文本；非法控制参数或超过 8 KiB 的输入抛出可展示错误。 */
export function parseArgs(raw: string): Action {
  if (Buffer.byteLength(raw, 'utf8') > 8192) throw new Error('输入超过 8 KiB，请缩短任务描述。');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(raw)) throw new Error('输入包含不支持的控制字符。');
  let input = raw.trim();
  // 兼容用户从帮助中再次粘贴 /pua，但不递归吞掉任意多个前缀。
  if (/^\/?pua(?::|\s|$)/i.test(input)) {
    input = input.replace(/^\/?pua(?::|\s+|$)/i, '').trim();
    if (!input || /^\/?pua(?::|\s|$)/i.test(input)) throw new Error('请只输入一次 /pua 前缀，例如 /pua flavor。');
  }
  if (!input) return { kind: 'activate', task: '' };
  const aliases: Record<string, Action> = {
    '换个方法': { kind: 'again' }, '再试试': { kind: 'again' },
    '证据呢': { kind: 'evidence' }, '数据在哪': { kind: 'evidence' },
    '没跑测试别说完成': { kind: 'done-check' }, '验收': { kind: 'done-check' },
  };
  if (Object.hasOwn(aliases, input)) return aliases[input]!;
  if (/^(?:你来)?(?:审查|评估|分析)(?:一下)?(?:这个|当前)?(?:项目|仓库|代码)[。！!?？]?$/u.test(input)) return { kind: 'review', task: input };
  const first = /^(\S+)(?:\s+([\s\S]*))?$/.exec(input)!;
  const command = first[1]!.toLowerCase();
  const rest = (first[2] ?? '').trim();
  if (command === '--') {
    if (!rest) throw new Error('-- 后需要任务描述。');
    return { kind: 'activate', task: rest };
  }
  if (command.startsWith('-')) throw new Error('不支持此选项。输入 /pua help 查看用法。');
  if (command === 'flavor' || command === '味道' || command === '风味') {
    if (!rest) return { kind: 'flavors' };
    if (rest === 'auto' || rest === '自动') return { kind: 'flavor', flavor: 'auto' };
    const flavor = resolveFlavor(rest);
    if (!flavor) throw new Error('未知风味。输入 /pua flavor 查看可用名称。');
    return { kind: 'flavor', flavor };
  }
  if (command === 'review') return { kind: 'review', task: rest || '审查当前项目' };
  if (['ding', '钉味', '置身钉内', '置身钉外', '每日一包', '薛定谔的用户', '病态敏捷', '望舒行动'].includes(command)) return { kind: 'mode', mode: 'pua', task: `使用钉内/钉外味。${rest}` };
  if (command === 'loop' || command === 'pua-loop') return parseLoop(rest);
  if (MODES.includes(command as PuaMode)) return { kind: 'mode', mode: command as PuaMode, task: rest };
  const typos: Record<string, string> = { in: 'on', onn: 'on', of: 'off', offn: 'off', flavour: 'flavor', flaver: 'flavor', falvor: 'flavor', stauts: 'status', stats: 'status', agian: 'again' };
  if (Object.hasOwn(typos, command) && (!rest || command.length >= 4)) throw new Error(`可能想输入 /pua ${typos[command]}。若确实要把原文作为任务，请使用 /pua -- ${input}。`);
  switch (command) {
    case 'again': case 'done-check': case 'evidence': case 'kpi': case 'survey':
      return rest ? { kind: command, task: rest } : { kind: command };
    case 'on': case 'off': case 'offline': case 'status': case 'help': case 'cancel-pua-loop': case 'team-status': case 'reap-orphans': case 'teardown-all':
      if (rest) throw new Error(`${command} 不接受额外参数；任务以此单词开头时请使用 /pua -- 任务描述。`);
      return { kind: command };
    default:
      return { kind: 'activate', task: input };
  }
}

/** 循环配置从用户原生命令读取，模型不能通过输出修改独立验证条件。 */
function parseLoop(input: string): Action {
  const tokens: string[] = [];
  const lexer = /\s*(?:"((?:\\"|[^"])*)"|'([^']*)'|([^\s"']+))(?=\s|$)/gyu;
  let offset = 0;
  while (offset < input.trimEnd().length) {
    lexer.lastIndex = offset;
    const match = lexer.exec(input);
    if (!match) throw new Error('Loop 参数引号未闭合或格式无效，请将任务和完整验证命令分别放在引号中。');
    tokens.push(match[1] !== undefined ? match[1].replaceAll('\\"', '"') : (match[2] ?? match[3])!);
    offset = lexer.lastIndex;
  }
  const seen = new Set<string>();
  let maxIterations = 0;
  let verify: string | undefined;
  const task: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token === '--max-iterations') {
      if (seen.has(token)) throw new Error('--max-iterations 不能重复。');
      seen.add(token);
      const value = tokens[++i];
      if (!value || !/^\d+$/.test(value) || Number(value) > 10000) throw new Error('--max-iterations 必须为 0–10000；0 表示按原版不限轮次。');
      maxIterations = Number(value);
    } else if (token === '--verify') {
      if (seen.has(token)) throw new Error('--verify 不能重复。');
      seen.add(token);
      const value = tokens[++i];
      if (!value || value.startsWith('--')) throw new Error('--verify 后需要带引号的验证命令。');
      verify = value;
      if (!verify.trim()) throw new Error('验证命令不能为空。');
    } else if (token.startsWith('--')) throw new Error(`不支持循环选项：${token}`);
    else task.push(token);
  }
  if (!task.join(' ').trim()) throw new Error('loop 需要任务描述，例如 /pua loop "修复测试" --verify "npm test" --max-iterations 10。');
  return { kind: 'loop', task: task.join(' '), maxIterations, ...(verify === undefined ? {} : { verify }) };
}
