import assert from 'node:assert/strict';

/** V2 单独传 system；V3 将系统消息放入 messages，取最后一个有效快照。 */
export function requestSystem(request) {
  if (typeof request.system === 'string') return request.system;
  const messages = request.messages.filter(message => message.role === 'system');
  const text = messages.map(message => message.content.filter(block => block.type === 'text').map(block => block.text).join('\n')).filter(Boolean).at(-1);
  assert.equal(typeof text, 'string', '请求必须包含有效系统提示词');
  return text;
}
