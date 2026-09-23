/** 0.1.7 由 schema 把并行上限解析成 volatile 引用；旧宿主继续用缺省数字。 */
export function resolveAgentLoopConfig(AgentLoop, agents = []) {
  const schema = AgentLoop.Config;
  if (typeof schema !== 'function') return { agents };
  const resolved = schema({ agents });
  const limit = resolved?.maxParallelToolCalls;
  if (limit && typeof limit.get === 'function') return resolved;
  return { agents };
}
