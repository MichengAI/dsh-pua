import { SESSION_FORMAT_VERSION, type SessionSeq, type SurfaceOp } from '@deepseek-ai/dsh-session';

/** Builds a replacement range for the host format; migrating old logs across versions remains the host's job. */
export function replacementSurface(startSeq: SessionSeq, endSeq: SessionSeq): SurfaceOp {
  if (SESSION_FORMAT_VERSION >= 3) return { op: 'replace', startSeq, endSeq };
  // Compatibility path for supported V2 hosts; the legacy declaration is contained only at this boundary — never write speculatively and retry on error.
  return { op: 'replace', start: startSeq, end: endSeq } as unknown as SurfaceOp;
}
