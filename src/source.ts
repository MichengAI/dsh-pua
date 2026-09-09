import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** 固定 Git 提交的原版目录；提供给模型的路径必须命中白名单。 */
export class SourceCatalog {
  readonly revision: string;
  private readonly documents = new Map<string, string>();
  constructor() {
    const root = new URL('../assets/pua/', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('upstream.json', root), 'utf8')) as {
      revision: string; files: { file: string; source: string; sha256: string }[];
    };
    this.revision = manifest.revision;
    for (const entry of manifest.files.filter(entry => entry.file.startsWith('upstream/'))) {
      if (!/^(skills|commands|agents|hooks)\/[a-zA-Z0-9_./-]+$/.test(entry.source) || entry.source.split('/').includes('..') || entry.file !== `upstream/${entry.source}`) throw new Error('原版文件清单包含无效路径。');
      const bytes = readFileSync(new URL(entry.file, root));
      if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`原版文件指纹不匹配：${entry.source}`);
      this.documents.set(entry.source, bytes.toString('utf8'));
    }
    if (!this.documents.has('skills/pua/SKILL.md')) throw new Error('缺少原版 PUA 核心文件。');
  }
  list(): readonly string[] { return [...this.documents.keys()].filter(path => path.endsWith('.md')).sort(); }
  /** 返回完整原文；未知路径失败，不将输入转换为任意文件路径。 */
  read(path: string): string {
    const text = this.documents.get(path);
    if (text === undefined) throw new Error(`未收录此原版资料：${path}`);
    return text;
  }
  body(path: string): string { return this.read(path).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, '').trim(); }
}
