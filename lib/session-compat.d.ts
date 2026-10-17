import { type SessionSeq, type SurfaceOp } from '@deepseek-ai/dsh-session';
/** Builds a replacement range for the host format; migrating old logs across versions remains the host's job. */
export declare function replacementSurface(startSeq: SessionSeq, endSeq: SessionSeq): SurfaceOp;
