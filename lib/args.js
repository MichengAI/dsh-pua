import { resolveFlavor } from './flavors.js';
import { MODES } from './content.js';
import { CONFIG_KEYS, loopStartSchema, parsePatch } from './configuration.js';
import { ARGS_COPY } from './i18n.js';
/** 解析 /pua 后的文本；普通命令限 8 KiB；结构化配置保留 128 KiB 传输上限并按字段校验。 */
export function parseArgs(raw, loopDefaults, lang = 'zh') {
    const copy = ARGS_COPY[lang] ?? ARGS_COPY.zh;
    if (Buffer.byteLength(raw, 'utf8') > (/^\s*(?:config|loop-json)\s/u.test(raw) ? 131072 : 8192)) {
        throw new Error(copy.inputTooLong);
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(raw)) {
        throw new Error(copy.invalidControlChar);
    }
    let input = raw.trim();
    // 兼容用户从帮助中再次粘贴 /pua，但不递归吞掉任意多个前缀。
    if (/^\/?pua(?::|\s|$)/i.test(input)) {
        input = input.replace(/^\/?pua(?::|\s+|$)/i, '').trim();
        if (!input || /^\/?pua(?::|\s|$)/i.test(input))
            throw new Error(copy.singlePrefix);
    }
    if (!input)
        return { kind: 'activate', task: '' };
    const aliases = {
        '换个方法': { kind: 'again' }, '再试试': { kind: 'again' },
        '证据呢': { kind: 'evidence' }, '数据在哪': { kind: 'evidence' },
        '没跑测试别说完成': { kind: 'done-check' }, '验收': { kind: 'done-check' },
    };
    if (Object.hasOwn(aliases, input))
        return aliases[input];
    if (/^(?:你来)?(?:审查|评估|分析)(?:一下)?(?:这个|当前)?(?:项目|仓库|代码)[。！!?？]?$/u.test(input))
        return { kind: 'review', task: input };
    const first = /^(\S+)(?:\s+([\s\S]*))?$/.exec(input);
    const command = first[1].toLowerCase();
    const rest = (first[2] ?? '').trim();
    if (command === 'loop-json') {
        const { verify, ...value } = loopStartSchema.parse(parseJson(rest, copy));
        return { kind: 'loop', ...value, ...(verify.trim() ? { verify } : {}) };
    }
    if (command === 'config')
        return { kind: 'configure', patch: parsePatch(parseJson(rest, copy)) };
    if (command === 'reset') {
        if (rest && !CONFIG_KEYS.includes(rest))
            throw new Error(copy.unknownConfigKey);
        return { kind: 'configure', patch: Object.fromEntries((rest ? [rest] : CONFIG_KEYS).map(key => [key, null])) };
    }
    if (command === '--') {
        if (!rest)
            throw new Error(copy.taskRequiredAfterDashDash);
        return { kind: 'activate', task: rest };
    }
    if (command.startsWith('-'))
        throw new Error(copy.unsupportedOption);
    if (command === 'flavor' || command === 'flavors' || command === '味道' || command === '风味') {
        if (!rest)
            return { kind: 'flavors' };
        if (rest === 'auto' || rest === '自动')
            return { kind: 'flavor', flavor: 'auto' };
        const flavor = resolveFlavor(rest);
        if (!flavor)
            throw new Error(copy.unknownFlavor);
        return { kind: 'flavor', flavor };
    }
    if (command === 'review')
        return { kind: 'review', task: rest || '审查当前项目' };
    if (['ding', '钉味', '置身钉内', '置身钉外', '每日一包', '薛定谔的用户', '病态敏捷', '望舒行动'].includes(command))
        return { kind: 'mode', mode: 'pua', task: `使用钉内/钉外味。${rest}` };
    if (command === 'loop' || command === 'pua-loop')
        return parseLoop(rest, loopDefaults, copy);
    if (MODES.includes(command))
        return { kind: 'mode', mode: command, task: rest };
    const typos = { in: 'on', onn: 'on', of: 'off', offn: 'off', flavour: 'flavor', flaver: 'flavor', falvor: 'flavor', stauts: 'status', stats: 'status', agian: 'again' };
    if (Object.hasOwn(typos, command) && (!rest || command.length >= 4))
        throw new Error(copy.didYouMean(typos[command], input));
    switch (command) {
        case 'again':
        case 'done-check':
        case 'evidence':
        case 'kpi':
        case 'survey':
            return rest ? { kind: command, task: rest } : { kind: command };
        case 'on':
        case 'off':
        case 'offline':
        case 'status':
        case 'help':
        case 'team-status':
        case 'reap-orphans':
        case 'teardown-all':
            if (rest)
                throw new Error(copy.noExtraArgs(command));
            return { kind: command };
        case 'cancel-pua-loop':
        case 'cancel-loop':
        case 'pua-cancel-loop':
            if (rest)
                throw new Error(copy.noExtraArgs(command));
            return { kind: 'cancel-pua-loop' };
        default:
            return { kind: 'activate', task: input };
    }
}
/** 循环配置从用户原生命令读取，模型不能通过输出修改独立验证条件。 */
function parseLoop(input, defaults, copy) {
    const tokens = [];
    const lexer = /\s*(?:"((?:\\\\"|[^"])*)"|'([^']*)'|([^\s"']+))(?=\s|$)/gyu;
    let offset = 0;
    while (offset < input.trimEnd().length) {
        lexer.lastIndex = offset;
        const match = lexer.exec(input);
        if (!match)
            throw new Error(copy.loopQuotesInvalid);
        tokens.push(match[1] !== undefined ? match[1].replaceAll('\\"', '"') : (match[2] ?? match[3]));
        offset = lexer.lastIndex;
    }
    const seen = new Set();
    let maxIterations = defaults?.maxIterations ?? 0;
    let verify = defaults?.verify.trim() || undefined;
    const task = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === '--max-iterations') {
            if (seen.has(token))
                throw new Error(copy.maxIterationsDuplicate);
            seen.add(token);
            const value = tokens[++i];
            if (!value || !/^\d+$/.test(value) || Number(value) > 10000)
                throw new Error(copy.maxIterationsInvalid);
            maxIterations = Number(value);
        }
        else if (token === '--verify') {
            if (seen.has(token))
                throw new Error(copy.verifyDuplicate);
            seen.add(token);
            const value = tokens[++i];
            if (value === undefined || value.startsWith('--'))
                throw new Error(copy.verifyQuotedRequired);
            verify = value;
            if (!verify.trim())
                throw new Error(copy.verifyNotEmpty);
        }
        else if (token.startsWith('--'))
            throw new Error(copy.unsupportedLoopOption(token));
        else
            task.push(token);
    }
    if (!task.join(' ').trim())
        throw new Error(copy.loopTaskRequired);
    return { kind: 'loop', task: task.join(' ').trim(), maxIterations, ...(verify === undefined ? {} : { verify }), ...(defaults ? { verificationTimeout: defaults.verificationTimeout } : {}) };
}
function parseJson(text, copy) {
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error(copy.invalidJson);
    }
}
//# sourceMappingURL=args.js.map