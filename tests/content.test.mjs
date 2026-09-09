import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { escapePromptLiteral, loadPrompts, renderOriginalPrompt, MAX_PROMPT_BYTES, MODES } from '../lib/content.js';
import { SourceCatalog } from '../lib/source.js';
import { FLAVORS } from '../lib/flavors.js';

test('所有风味可以被真实宿主渲染，体积有界且不混入其他风味章节', () => {
  const prompts = loadPrompts();
  for (const flavor of FLAVORS) {
    const text = prompts.get(flavor.id);
    assert.ok(Buffer.byteLength(text, 'utf8') < MAX_PROMPT_BYTES);
    assert.equal((text.match(/^## \d+\. /gm) ?? []).length, 1, flavor.id);
    assert.equal(renderPrompt({ sections: [{ name: 'pua', text }], contexts: [], tools: [], variables: {} }), text);
  }
});

test('第三方双花括号作为文本保留，不触发宿主严格变量求值', () => {
  const text = escapePromptLiteral('例子：{{private_variable}}');
  assert.doesNotThrow(() => renderPrompt({ sections: [{ name: 'pua', text }], contexts: [], tools: [], variables: {} }));
});

test('主模式保留原版人格、展示协议、认知换框和 Owner 行为，不以摘要代替核心', () => {
  const text = loadPrompts().get('alibaba');
  for (const literal of ['每一句话都用当前味道的语气在说话', '## 深层换框（Cognitive Reframe）', '## Owner 意识（谁痛苦谁改变）', '## Gotchas（已知陷阱', '# PUA 展示协议', '┌─────────┬']) {
    assert.ok(text.includes(literal), `缺失原版内容：${literal}`);
  }
});

test('所有模式完整包含原版核心及对应技能正文，资料工具输入不能任意读取磁盘', () => {
  const catalog = new SourceCatalog();
  for (const mode of MODES) {
    const prompt = renderOriginalPrompt(catalog, 'auto', mode);
    assert.ok(prompt.includes(escapePromptLiteral(catalog.body('skills/pua/SKILL.md'))), mode);
    assert.ok(prompt.includes(escapePromptLiteral(catalog.body(`skills/${mode}/SKILL.md`))), mode);
  }
  assert.throws(() => catalog.read('../../package.json'));
});
