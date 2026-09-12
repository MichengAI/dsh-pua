import { build } from 'esbuild';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
const dir = '.test-tmp/pua-ui-preview';
mkdirSync(dir, { recursive: true });
// 官方 primitives 的发布入口还包含代码高亮等组件；预览仅编译实际使用的官方源文件。
// 参数为匹配宿主版本的 ui-primitives/src 目录，生产包始终由宿主提供这些组件。
const primitivesSource = process.argv[2];
if (!primitivesSource) throw new Error('请传入官方 ui-primitives/src 目录：node scripts/preview-ui.mjs <目录>');
const { resolve } = await import('node:path');
const { createRequire } = await import('node:module');
const localRequire = createRequire(import.meta.url);
await build({ entryPoints: ['tests/ui-preview.ts'], bundle: true, format: 'esm', platform: 'browser', outfile: `${dir}/preview.js`,
  jsx: 'automatic', loader: { '.module.css': 'local-css' }, plugins: [{ name: 'official-controls-preview', setup(builder) {
    builder.onResolve({ filter: /^@deepseek-ai\/dsh-client-ui-primitives$/ }, () => ({ path: 'controls', namespace: 'official-controls' }));
    builder.onLoad({ filter: /.*/, namespace: 'official-controls' }, () => ({ contents:
      `export { Button } from ${JSON.stringify(resolve(primitivesSource, 'Button.tsx'))}; export { Menu } from ${JSON.stringify(resolve(primitivesSource, 'Menu.tsx'))}; export { Switch } from ${JSON.stringify(resolve(primitivesSource, 'Switch.tsx'))}; export { IconChevronDownOutline14 } from ${JSON.stringify(resolve(primitivesSource, 'icons/index.tsx'))};`, loader: 'ts', resolveDir: resolve('.') }));
    builder.onResolve({ filter: /^(react|react-dom|clsx)(\/.*)?$/ }, args => ({ path: localRequire.resolve(args.path) }));
  } }], define: { 'process.env.NODE_ENV': '"development"' } });

const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PUA 配置组件验收</title><link rel="stylesheet" href="/preview.css"><style>
:root{color-scheme:light;--dsw-alias-button-tool-bar-fill:#eceef1;--dsw-alias-button-tool-bar-hover:#dfe2e8;--dsw-alias-brand-primary:#365cc9;--dsw-alias-border-l3:#999;--dsw-specific-menu:#fff;--dsw-alias-bg-layer-3:#f5f6f8;--dsw-alias-border-l4:#dce0e6;--dsw-alias-label-dimmed:#999;--dsw-alias-label-tertiary:#626977;--dsw-alias-border-l1:#ddd;--dsw-elevation-prominent:0 4px 24px #0003;--dsw-alias-label-primary:#20242c;--dsw-alias-label-secondary:#626977;--dsw-alias-bg-layer-2:#fff;--dsw-alias-border-l2:#dce0e6;--dsw-alias-button-primary-fill:#365cc9;--dsw-alias-label-primary-foreground:#fff;--dsw-alias-interactive-bg-hover:#edf1f8}*{box-sizing:border-box}body{margin:0;background:#f5f6f8;font:14px system-ui;color:#20242c}main{max-width:900px;margin:32px auto;padding:0 20px}header{margin-bottom:20px}header strong{font-size:20px}header p,article>p{color:#626977}nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}nav button{padding:9px 12px;border:1px solid #dce0e6;border-radius:8px;background:white;cursor:pointer}nav button[aria-pressed=true]{background:#e9efff;color:#254ea8}article{background:#fff;border:1px solid #dce0e6;border-radius:12px;padding:24px}article>textarea{width:100%;resize:vertical;border:1px solid #dce0e6;border-radius:8px;padding:12px}.composer{display:flex;align-items:center;gap:12px;padding:14px 0 0}button:focus-visible{outline:2px solid #365cc9;outline-offset:2px}@media(max-width:500px){main{margin:16px auto;padding:0 12px}article{padding:16px}}
:root[data-theme=dark]{color-scheme:dark;--dsw-alias-button-tool-bar-fill:#363636;--dsw-alias-button-tool-bar-hover:#454545;--dsw-specific-menu:#333;--dsw-alias-bg-layer-2:#292929;--dsw-alias-bg-layer-3:#333;--dsw-alias-border-l4:#555;--dsw-alias-border-l2:#555;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#bbb;--dsw-alias-label-tertiary:#aaa;--dsw-alias-interactive-bg-hover:#444} :root[data-theme=dark] body,:root[data-theme=dark] article,:root[data-theme=dark] nav button{background:#292929;color:#eee;border-color:#555}</style><div id="root"></div><script type="module" src="/preview.js"></script></html>`;
createServer((request, response) => {
  if (request.url !== '/' && request.url !== '/preview.js' && request.url !== '/preview.css') { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', request.url === '/' ? 'text/html; charset=utf-8' : request.url === '/preview.css' ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8');
  response.end(request.url === '/' ? html : readFileSync(`${dir}${request.url}`));
}).listen(0, '127.0.0.1', function () { console.log(`PUA_UI_PREVIEW=http://127.0.0.1:${this.address().port}`); });
