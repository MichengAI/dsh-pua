import { build } from 'esbuild';
// 与专家插件使用相同的宿主模块加载入口，React 由宿主提供。
await build({ entryPoints: ['src/client.ts'], outfile: 'lib/client.js', bundle: true, platform: 'browser', format: 'cjs',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'], target: 'es2022', minify: true,
  banner: { js: 'window.__ModuleLoader__.load({id:"@michengai/dsh-pua",factory:(require)=>{var module={exports:{}};var exports=module.exports;' },
  footer: { js: 'return module.exports;}});' }, define: { 'process.env.NODE_ENV': '"production"' } });
