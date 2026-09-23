import { randomUUID } from 'node:crypto';
import { type Session, type UserMessage } from '@deepseek-ai/dsh-session';
import { replacementSurface } from './session-compat.js';
import { isPluginSource } from './message-source.js';

interface PendingCalls { cursor: Session['seq']; ids: Map<string, Session["surface"]["nodes"][number]> }
const calls = new WeakMap<Session, PendingCalls>();

/** V3 工具结果是带 tool-result 块的 user 消息；V4 提升为 tool 角色，调用号留在 source.callId。 */
function toolResultCallId(message: { role?: string; source?: { kind?: string; callId?: string }; content?: readonly { type?: string; toolCallId?: string }[] } | null | undefined): string | undefined {
  if (!message || message.source?.kind !== 'tool' || !message.source.callId) return undefined;
  if (message.role === 'tool') return message.source.callId;
  if (message.role !== 'user' || message.content?.length !== 1) return undefined;
  const block = message.content[0];
  return block?.type === 'tool-result' && block.toolCallId === message.source.callId ? message.source.callId : undefined;
}

/** 从原始日志增量检查整组调用；包含已声明但尚未派发的并行调用。 */
export function hasPendingToolCalls(session: Session): boolean {
  let pending = calls.get(session);
  if (!pending) {
    pending = { cursor: session.inheritedEventCount, ids: new Map() };
    calls.set(session, pending);
  }
  for (const event of session.snapshotEvents(pending.cursor)) {
    if (event.type === 'assistant/message' && event.surfaceOp === 'append') {
      for (const block of event.data.message.content) if (block.type === 'tool-call') pending.ids.set(block.id, event.seq);
    } else if (event.type === 'tool/result' && event.surfaceOp === 'append') {
      const callId = event.data.message.source.callId ?? ('toolCallId' in event.data.message ? event.data.message.toolCallId : undefined);
      if (callId) pending.ids.delete(callId);
    } else if (event.type === 'turn/end' || event.type === 'turn/start') {
      // 结束轮次的孤儿不再阻塞后续轮次，不伪造缺失结果。
      pending.ids.clear();
    }
  }
  pending.cursor = session.seq;
  const visible = new Set(session.surface.nodes);
  for (const [id, seq] of pending.ids) if (!visible.has(seq)) pending.ids.delete(id);
  return pending.ids.size !== 0;
}

/**
 * 兼容本插件打断的完整历史工具组。只追加模型上下文替换，不改写原始事件。
 * 原工具结果本来就是 user-role 消息；使用通用 user/message 投影保留其完整
 * id、tool 来源和 content，覆盖前置 PUA 节点与结果节点，避免伪造或重执行工具。
 */
export function repairPuaToolOrder(session: Session, plugin: string): void {
  const nodes = [...session.surface.nodes];
  for (let index = 0; index < nodes.length; index++) {
    const first = session.eventAt(nodes[index]!);
    if (!first) continue;
    const assistant = session.deriveEventMessage(first);
    if (assistant?.role !== 'assistant') continue;
    const ids = assistant.content.flatMap(block => block.type === 'tool-call' ? [block.id] : []);
    if (!ids.length || new Set(ids).size !== ids.length) continue;
    const pending = new Set<string>(ids);
    let gap: Session['surface']['nodes'][number][] = [];
    const replacements: { nodes: typeof gap; message: NonNullable<ReturnType<Session['deriveEventMessage']>> }[] = [];
    let next = index + 1;
    for (; next < nodes.length && pending.size; next++) {
      const seq = nodes[next]!;
      const event = session.eventAt(seq)!;
      const message = session.deriveEventMessage(event);
      if (event.type === 'user/message' && isPluginSource(message?.source, plugin)) {
        gap.push(seq);
        continue;
      }
      if (!message) break;
      const callId = toolResultCallId(message);
      if (!callId || !pending.delete(callId)) break;
      if (gap.length) replacements.push({ nodes: [...gap, seq], message });
      gap = [];
    }
    // 缺失结果或夹入其他来源消息时不猜测，也不进行半组修复。
    if (pending.size) continue;
    for (const replacement of replacements) {
      const toolRole = (replacement.message.role as string) === 'tool';
      const hidden = toolRole ? replacement.nodes.slice(0, -1) : replacement.nodes;
      const surface = {
        surfaceOp: replacementSurface(hidden[0]!, hidden.at(-1)!),
        sourceEventSeqs: hidden,
      };
      if (toolRole) {
        // V4 的 tool/result 替换只能改写一个结果节点。空系统消息盖住 PUA 记录且不进入模型请求，原工具结果留在表面上。
        session.append('system/message', {
          message: { id: randomUUID(), role: 'system', content: [], source: { kind: 'system-prompt' } },
        } as never, surface);
      } else {
        session.append('user/message', replacement.message as UserMessage, surface);
      }
    }
    index = next - 1;
  }
}
