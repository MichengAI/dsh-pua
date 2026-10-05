import { type SessionSeq, type SurfaceOp } from '@deepseek-ai/dsh-session';
/** 按宿主格式构造替换范围；旧日志的版本迁移仍由宿主负责。 */
export declare function replacementSurface(startSeq: SessionSeq, endSeq: SessionSeq): SurfaceOp;
