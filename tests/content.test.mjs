import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { escapePromptLiteral, loadPrompts } from '../lib/content.js';
import { FLAVORS } from '../lib/flavors.js';

test('所有风味可以被真实宿主渲染，体积有界且不混入其他风味章节', () => {
  const prompts = loadPrompts();
  for (const flavor of FLAVORS) {
    const text = prompts.get(flavor.id);
    assert.ok(Buffer.byteLength(text, 'utf8') < 32768);
    assert.equal((text.match(/^## \d+\. /gm) ?? []).length, 1, flavor.id);
    assert.equal(renderPrompt({ sections: [{ name: 'pua', text }], contexts: [], tools: [], variables: {} }), text);
  }
});

test('第三方双花括号作为文本保留，不触发宿主严格变量求值', () => {
  const text = escapePromptLiteral('例子：{{private_variable}}');
  assert.doesNotThrow(() => renderPrompt({ sections: [{ name: 'pua', text }], contexts: [], tools: [], variables: {} }));
});
