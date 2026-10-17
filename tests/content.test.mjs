import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { escapePromptLiteral, loadPrompts, renderOriginalPrompt, MAX_PROMPT_BYTES, MODES } from '../lib/content.js';
import { SourceCatalog } from '../lib/source.js';
import { FLAVORS } from '../lib/flavors.js';

test('All flavors render under the real host, stay within the size bound, and do not mix in other flavor chapters', () => {
  const prompts = loadPrompts();
  for (const flavor of FLAVORS) {
    const text = prompts.get(flavor.id);
    assert.ok(Buffer.byteLength(text, 'utf8') < MAX_PROMPT_BYTES);
    assert.equal((text.match(/^## \d+\. /gm) ?? []).length, 1, flavor.id);
    assert.equal(renderPrompt({ sections: [{ name: 'pua', text }], contexts: [], tools: [], variables: {} }), text);
  }
});

test('Third-party double braces are preserved as text and do not trigger strict host variable evaluation', () => {
  const text = escapePromptLiteral('例子：{{private_variable}}');
  assert.doesNotThrow(() => renderPrompt({ sections: [{ name: 'pua', text }], contexts: [], tools: [], variables: {} }));
});

test('The main mode keeps the original personality, display protocol, cognitive reframe, and Owner behavior; a summary does not replace the core', () => {
  const text = loadPrompts().get('alibaba');
  for (const literal of ['every sentence is spoken in the current flavor\'s tone', '## Cognitive reframe', '## Owner mindset (whoever feels the pain makes the change)', '## Gotchas (known traps', '# PUA Display Protocol', '┌─────────────┬']) {
    assert.ok(text.includes(literal), `Missing original content: ${literal}`);
  }
});

test('The DSH table override comes after the original box-table requirement and requires GFM pipe tables', () => {
  const text = loadPrompts().get('alibaba');
  const ban = text.indexOf('not markdown `| |` tables');
  const override = text.indexOf('## DSH table rendering (overrides the original box tables)');
  assert.ok(ban > 0, 'The original sentence banning pipe tables should still be in the material');
  assert.ok(override > ban, 'The DSH override must come after the original box-table requirement');
  assert.match(text.slice(override), /GFM pipe table/);
  assert.match(text.slice(override), /do not put it in a code block/);
  assert.match(text.slice(override), /\| --- \|/);
  assert.equal(text.includes('box panels and Owner'), false);
});

test('Every mode fully includes the original core and its skill body; material-tool input cannot read the disk arbitrarily', () => {
  const catalog = new SourceCatalog();
  for (const mode of MODES) {
    const prompt = renderOriginalPrompt(catalog, 'auto', mode);
    assert.ok(prompt.includes(escapePromptLiteral(catalog.body('skills/pua/SKILL.md'))), mode);
    assert.ok(prompt.includes(escapePromptLiteral(catalog.body(`skills/${mode}/SKILL.md`))), mode);
  }
  assert.throws(() => catalog.read('../../package.json'));
});
