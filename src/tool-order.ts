import { randomUUID } from 'node:crypto';
import { type Session, type UserMessage } from '@deepseek-ai/dsh-session';
import { replacementSurface } from './session-compat.js';
import { isPluginSource } from './message-source.js';

interface PendingCalls { cursor: Session['seq']; ids: Map<string, Session["surface"]["nodes"][number]> }
const calls = new WeakMap<Session, PendingCalls>();

/** In V3 a tool result is a user message with a tool-result block; V4 promotes it to the tool role and leaves the call id in source.callId. */
function toolResultCallId(message: { role?: string; source?: { kind?: string; callId?: string }; content?: readonly { type?: string; toolCallId?: string }[] } | null | undefined): string | undefined {
  if (!message || message.source?.kind !== 'tool' || !message.source.callId) return undefined;
  if (message.role === 'tool') return message.source.callId;
  if (message.role !== 'user' || message.content?.length !== 1) return undefined;
  const block = message.content[0];
  return block?.type === 'tool-result' && block.toolCallId === message.source.callId ? message.source.callId : undefined;
}

/** Incrementally checks the whole call group from the raw log; includes parallel calls that are declared but not yet dispatched. */
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
      // Orphans from a finished turn no longer block later turns; missing results are not faked.
      pending.ids.clear();
    }
  }
  pending.cursor = session.seq;
  const visible = new Set(session.surface.nodes);
  for (const [id, seq] of pending.ids) if (!visible.has(seq)) pending.ids.delete(id);
  return pending.ids.size !== 0;
}

/**
 * Repairs the complete historical tool group that this plugin interrupted. Only model-context
 * replacements are appended; raw events are never rewritten. The original tool results were
 * user-role messages to begin with; the generic user/message projection preserves their full
 * id, tool source, and content while shadowing the preceding PUA node and the result node,
 * so tools are never faked or re-executed.
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
    // When a result is missing or a foreign-source message is interleaved, do not guess and do not half-repair the group.
    if (pending.size) continue;
    for (const replacement of replacements) {
      const toolRole = (replacement.message.role as string) === 'tool';
      const hidden = toolRole ? replacement.nodes.slice(0, -1) : replacement.nodes;
      const surface = {
        surfaceOp: replacementSurface(hidden[0]!, hidden.at(-1)!),
        sourceEventSeqs: hidden,
      };
      if (toolRole) {
        // A V4 tool/result replacement can only rewrite a single result node. An empty system message shadows the PUA record without entering the model request, and the original tool result stays on the surface.
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
