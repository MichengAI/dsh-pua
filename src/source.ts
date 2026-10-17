import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** Pinned original tree for a fixed Git commit; every path offered to the model must hit the allowlist. */
export class SourceCatalog {
  readonly revision: string;
  private readonly documents = new Map<string, string>();
  constructor() {
    const root = new URL('../assets/pua/', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('upstream.json', root), 'utf8')) as {
      revision: string; files: { file: string; source: string; contentSha256: string }[];
    };
    this.revision = manifest.revision;
    for (const entry of manifest.files.filter(entry => entry.file.startsWith('upstream/'))) {
      if (!/^(skills|commands|agents|hooks)\/[a-zA-Z0-9_./-]+$/.test(entry.source) || entry.source.split('/').includes('..') || entry.file !== `upstream/${entry.source}`) throw new Error('The original file manifest contains an invalid path.');
      const bytes = readFileSync(new URL(entry.file, root));
      if (createHash('sha256').update(bytes).digest('hex') !== entry.contentSha256) throw new Error(`Original file checksum mismatch: ${entry.source}`);
      this.documents.set(entry.source, bytes.toString('utf8'));
    }
    if (!this.documents.has('skills/pua/SKILL.md')) throw new Error('Missing the original PUA core file.');
  }
  list(): readonly string[] { return [...this.documents.keys()].filter(path => path.endsWith('.md')).sort(); }
  /** Returns the full original text; an unknown path fails instead of turning input into an arbitrary file path. */
  read(path: string): string {
    const text = this.documents.get(path);
    if (text === undefined) throw new Error(`This original material is not catalogued: ${path}`);
    return text;
  }
  body(path: string): string { return this.read(path).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, '').trim(); }
}
