import { SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session';
/** 按宿主格式构造替换范围；旧日志的版本迁移仍由宿主负责。 */
export function replacementSurface(startSeq, endSeq) {
    if (SESSION_FORMAT_VERSION >= 3)
        return { op: 'replace', startSeq, endSeq };
    // 兼容受支持的 V2 宿主；只在此边界收容旧声明，不能试写后捕获错误重试。
    return { op: 'replace', start: startSeq, end: endSeq };
}
//# sourceMappingURL=session-compat.js.map