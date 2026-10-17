import { build } from 'esbuild';
// Uses the same host module loading entry as the expert plugin; React is provided by the host.
await build({ entryPoints: ['src/client.ts'], outfile: 'lib/client.js', bundle: true, platform: 'browser', format: 'cjs',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'], target: 'es2022', minify: true, sourcemap: true,
  banner: { js: 'window.__ModuleLoader__.load({id:"@phucnd0604/dsh-pua-en",factory:(require)=>{var module={exports:{}};var exports=module.exports;' },
  footer: { js: 'return module.exports;}});' }, define: { 'process.env.NODE_ENV': '"production"' } });
