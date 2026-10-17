#!/usr/bin/env node
// Mechanical half of the upstream sync runbook (docs/agents/upstream-sync.md).
// Offline by design: it reads local clones of the material upstream (tanweai/pua) and the
// plugin upstream (MichengAI/dsh-pua), reports drift against the recorded baseline, and with
// --write advances the pin fields in assets/pua/upstream.json. It never translates, fetches,
// commits, or tags. Policy: docs/adr/0003-upstream-sync-policy.md.
//
//   node scripts/sync-upstream.mjs --material <clone> [--plugin <clone>] [--check] [--json]
//   node scripts/sync-upstream.mjs --material <clone> --revision <sha> --version <v> --write
//   node scripts/sync-upstream.mjs --plugin <clone> --set-plugin-baseline <sha> --version <v> --write

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(ROOT, 'assets', 'pua', 'upstream.json');
const PLUGIN_REPOSITORY = 'https://github.com/MichengAI/dsh-pua';
const MAX_LIST = 25;

const VALUE_FLAGS = new Set(['material', 'revision', 'version', 'plugin', 'plugin-revision', 'set-plugin-baseline']);

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error('unexpected argument: ' + arg);
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (!VALUE_FLAGS.has(name)) { flags[name] = true; continue; }
    const value = eq === -1 ? argv[(i += 1)] : arg.slice(eq + 1);
    if (value === undefined) throw new Error('missing value for --' + name);
    flags[name] = value;
  }
  return flags;
}

function git(clone, args) {
  // stderr is dropped: probes legitimately ask for paths that do not exist in a revision.
  return execFileSync('git', ['-C', clone, ...args], { maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

function tryGit(clone, args) {
  try { return git(clone, args); } catch { return null; }
}

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

function lfBytes(bytes) { return Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'), 'utf8'); }

function readJsonAt(clone, revision, path) {
  const bytes = tryGit(clone, ['show', revision + ':' + path]);
  if (bytes === null) return null;
  try { return JSON.parse(bytes.toString('utf8')); } catch { return null; }
}

function upstreamVersion(clone, revision) {
  for (const path of ['plugin.json', '.claude-plugin/plugin.json', 'package.json']) {
    const data = readJsonAt(clone, revision, path);
    if (data && typeof data.version === 'string') return data.version;
  }
  return null;
}

function materialReport(manifest, clone, revision) {
  const rows = manifest.files.map(entry => {
    const bytes = tryGit(clone, ['cat-file', 'blob', revision + ':' + entry.source]);
    if (bytes === null) return { file: entry.file, source: entry.source, state: 'missing' };
    const sourceSha256 = sha256(bytes);
    const gitBlobSha256 = sha256(lfBytes(bytes));
    // gitBlobSha256 is the reproducible layer (LF-normalized upstream bytes), so it decides whether
    // the upstream content moved. sourceSha256 can differ while the content is identical: the legacy
    // duplicate assets recorded CRLF delivery bytes (docs/adr/0003, consequences).
    const state = gitBlobSha256 !== entry.gitBlobSha256
      ? 'modified'
      : sourceSha256 === entry.sourceSha256
        ? 'unchanged'
        : 'reconciled';
    return {
      file: entry.file,
      source: entry.source,
      state,
      sourceSha256,
      gitBlobSha256,
      translated: entry.contentSha256 !== entry.sourceSha256,
    };
  });
  const pinned = new Set(manifest.files.map(entry => entry.source));
  const prefixes = new Set(manifest.files.filter(entry => entry.file.startsWith('upstream/')).map(entry => entry.source.split('/')[0]));
  const tree = (tryGit(clone, ['ls-tree', '-r', '--name-only', revision]) || Buffer.from('')).toString('utf8').split('\n').filter(Boolean);
  const newCandidates = tree.filter(path => prefixes.has(path.split('/')[0]) && !pinned.has(path));
  return { revision, version: upstreamVersion(clone, revision), rows, newCandidates };
}

function pluginReport(manifest, clone, base, target) {
  const commits = (tryGit(clone, ['log', '--oneline', base + '..' + target]) || Buffer.from('')).toString('utf8').trim();
  const status = (tryGit(clone, ['diff', '--name-status', base, target]) || Buffer.from('')).toString('utf8').trim();
  return {
    repo: PLUGIN_REPOSITORY,
    base,
    target,
    version: upstreamVersion(clone, target),
    commits: commits ? commits.split('\n') : [],
    files: status ? status.split('\n') : [],
  };
}

function summarize(report) {
  const count = state => report.rows.filter(row => row.state === state).length;
  return { total: report.rows.length, unchanged: count('unchanged'), reconciled: count('reconciled'), modified: count('modified'), missing: count('missing'), newCandidates: report.newCandidates.length };
}

function printMaterial(manifest, report) {
  const stats = summarize(report);
  console.log('Material upstream (tanweai/pua)');
  console.log('  target revision: ' + report.revision + (report.version ? ' (v' + report.version + ')' : ''));
  console.log('  baseline: ' + manifest.revision + ' (v' + manifest.version + ')');
  console.log('  entries ' + stats.total + ': unchanged ' + stats.unchanged + ', hash-convention only ' + stats.reconciled + ', modified ' + stats.modified + ', missing ' + stats.missing + ', new upstream files ' + stats.newCandidates);
  for (const row of report.rows.filter(item => item.state === 'reconciled').slice(0, MAX_LIST)) console.log('  H ' + row.file + '  (upstream content identical; recorded sourceSha256 follows a different byte convention)');
  for (const row of report.rows.filter(item => item.state === 'modified').slice(0, MAX_LIST)) {
    console.log('  M ' + row.file + '  <- ' + row.source + (row.translated ? '  (English already changed; review the delta)' : '  (ships untranslated; contentSha256 must track sourceSha256)'));
  }
  for (const row of report.rows.filter(item => item.state === 'missing').slice(0, MAX_LIST)) console.log('  D ' + row.file + '  <- ' + row.source + '  (missing upstream: structural change, ask a human)');
  for (const path of report.newCandidates.slice(0, MAX_LIST)) console.log('  A ' + path + '  (new upstream material: structural change, ask a human)');
  if (report.newCandidates.length > MAX_LIST) console.log('  ... ' + (report.newCandidates.length - MAX_LIST) + ' more new files');
}

function printPlugin(manifest, report) {
  console.log('Plugin upstream (MichengAI/dsh-pua)');
  console.log('  target revision: ' + report.target + (report.version ? ' (v' + report.version + ')' : ''));
  console.log('  baseline: ' + manifest.pluginUpstream.revision + ' (v' + manifest.pluginUpstream.version + ')');
  console.log('  commits since baseline: ' + report.commits.length + ', files changed: ' + report.files.length);
  for (const line of report.commits.slice(0, MAX_LIST)) console.log('  c ' + line);
  for (const line of report.files.slice(0, MAX_LIST)) console.log('  f ' + line);
  if (report.files.length > MAX_LIST) console.log('  ... ' + (report.files.length - MAX_LIST) + ' more files');
}

function writeMaterial(manifest, report, versionFlag) {
  const missing = report.rows.filter(row => row.state === 'missing');
  if (missing.length > 0) throw new Error('refusing to write: ' + missing.length + ' pinned source(s) are missing upstream; that is a structural change (docs/adr/0003 decision 6)');
  const next = JSON.parse(JSON.stringify(manifest));
  next.revision = report.revision;
  if (report.version) next.version = report.version;
  if (versionFlag) next.version = versionFlag;
  for (const row of report.rows) {
    const entry = next.files.find(item => item.file === row.file);
    if (!row.translated) entry.contentSha256 = row.sourceSha256;
    entry.sourceSha256 = row.sourceSha256;
    entry.gitBlobSha256 = row.gitBlobSha256;
  }
  writeFileSync(MANIFEST_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log('manifest written: revision ' + next.revision + ', version ' + next.version + ', ' + report.rows.length + ' entries');
}

function writePluginBaseline(manifest, revision, version) {
  const next = JSON.parse(JSON.stringify(manifest));
  next.pluginUpstream = { repository: PLUGIN_REPOSITORY, revision, version: version || next.pluginUpstream.version };
  writeFileSync(MANIFEST_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log('manifest written: pluginUpstream ' + next.pluginUpstream.revision + ' (v' + next.pluginUpstream.version + ')');
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  if (!manifest.pluginUpstream) throw new Error('assets/pua/upstream.json has no pluginUpstream baseline');
  const result = { schemaVersion: manifest.schemaVersion, forkVersion: null, material: null, plugin: null, drift: false };
  if (flags['set-plugin-baseline']) {
    if (!flags.write) throw new Error('--set-plugin-baseline requires --write');
    writePluginBaseline(manifest, flags['set-plugin-baseline'], flags.version);
    return;
  }
  if (flags.material) {
    const revision = flags.revision || manifest.revision;
    const report = materialReport(manifest, flags.material, revision);
    result.material = { revision, version: report.version, summary: summarize(report), modified: report.rows.filter(row => row.state === 'modified').map(row => row.file), missing: report.rows.filter(row => row.state === 'missing').map(row => row.file), newCandidates: report.newCandidates };
    result.drift = result.drift || result.material.summary.modified > 0 || result.material.summary.missing > 0 || result.material.summary.newCandidates > 0;
    if (!flags.json) printMaterial(manifest, report);
    if (flags.write) writeMaterial(manifest, report, flags.version);
  }
  if (flags.plugin) {
    const base = flags['plugin-baseline'] || manifest.pluginUpstream.revision;
    const target = flags['plugin-revision'] || 'origin/main';
    const report = pluginReport(manifest, flags.plugin, base, target);
    result.plugin = { base, target, version: report.version, commits: report.commits.length, files: report.files };
    result.drift = result.drift || report.commits.length > 0;
    if (!flags.json) printPlugin(manifest, report);
  }
  if (!result.material && !result.plugin) throw new Error('nothing to do: pass --material <clone> and/or --plugin <clone>');
  if (flags.json) console.log(JSON.stringify(result, null, 2));
  else console.log(result.drift ? 'Drift detected: follow docs/agents/upstream-sync.md.' : 'No drift against the recorded baseline.');
  if (flags.check && result.drift) process.exitCode = 1;
}

main();
