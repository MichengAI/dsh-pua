/** 0.2.0 起 AgentLoop 把并行上限解析成 volatile 引用。 */
export function resolveAgentLoopConfig(AgentLoop, agents = []) {
  const schema = AgentLoop.Config;
  if (typeof schema !== 'function') return { agents };
  return schema({ agents });
}
