import { resolveFlavor, type FlavorId } from './flavors.js';

export type Action =
  | { readonly kind: 'activate' | 'review'; readonly task: string }
  | { readonly kind: 'flavor'; readonly flavor: FlavorId }
  | { readonly kind: 'on' | 'off' | 'status' | 'help' | 'flavors' | 'again' | 'done-check' | 'evidence' };

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
    const flavor = resolveFlavor(rest);
    if (!flavor) throw new Error('未知风味。输入 /pua flavor 查看可用名称。');
    return { kind: 'flavor', flavor };
  }
  if (command === 'review') return { kind: 'review', task: rest || '审查当前项目' };
  const unsupported = new Set(['p7', 'p9', 'p10', 'pro', 'yes', 'mama', 'loop', 'cancel-pua-loop', 'offline', 'kpi', 'survey']);
  if (unsupported.has(command)) throw new Error(`本版尚未实现原版 ${command} 模式。输入 /pua help 查看当前能力；不会将它当作任务发送。`);
  const typos: Record<string, string> = { in: 'on', onn: 'on', of: 'off', offn: 'off', flavour: 'flavor', flaver: 'flavor', falvor: 'flavor', stauts: 'status', stats: 'status', agian: 'again' };
  if (Object.hasOwn(typos, command) && (!rest || command.length >= 4)) throw new Error(`可能想输入 /pua ${typos[command]}。若确实要把原文作为任务，请使用 /pua -- ${input}。`);
  switch (command) {
    case 'on': case 'off': case 'status': case 'help': case 'again': case 'done-check': case 'evidence':
      if (rest) throw new Error(`${command} 不接受额外参数；任务以此单词开头时请使用 /pua -- 任务描述。`);
      return { kind: command };
    default:
      return { kind: 'activate', task: input };
  }
}
