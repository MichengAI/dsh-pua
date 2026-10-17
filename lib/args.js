import { resolveFlavor } from './flavors.js';
import { MODES } from './content.js';
import { CONFIG_KEYS, loopStartSchema, parsePatch } from './configuration.js';
/** Parses the text after /pua; plain commands are capped at 8 KiB; structured configuration keeps the 128 KiB transport cap and is validated field by field. */
export function parseArgs(raw, loopDefaults) {
    if (Buffer.byteLength(raw, 'utf8') > (/^\s*(?:config|loop-json)\s/u.test(raw) ? 131072 : 8192))
        throw new Error('Input exceeds the length limit; shorten the task or the verification command.');
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(raw))
        throw new Error('Input contains unsupported control characters.');
    let input = raw.trim();
    // Tolerate a user pasting /pua again from the help text, but never swallow arbitrarily many prefixes recursively.
    if (/^\/?pua(?::|\s|$)/i.test(input)) {
        input = input.replace(/^\/?pua(?::|\s+|$)/i, '').trim();
        if (!input || /^\/?pua(?::|\s|$)/i.test(input))
            throw new Error('Enter the /pua prefix only once, e.g. /pua flavor.');
    }
    if (!input)
        return { kind: 'activate', task: '' };
    const aliases = {
        'another way': { kind: 'again' }, 'try again': { kind: 'again' },
        '换个方法': { kind: 'again' }, '再试试': { kind: 'again' },
        'show me the evidence': { kind: 'evidence' }, 'where is the data': { kind: 'evidence' },
        '证据呢': { kind: 'evidence' }, '数据在哪': { kind: 'evidence' },
        'no tests, no done': { kind: 'done-check' }, 'acceptance': { kind: 'done-check' },
        '没跑测试别说完成': { kind: 'done-check' }, '验收': { kind: 'done-check' },
    };
    if (Object.hasOwn(aliases, input))
        return aliases[input];
    if (/^(?:你来)?(?:审查|评估|分析)(?:一下)?(?:这个|当前)?(?:项目|仓库|代码)[。！!?？]?$/u.test(input))
        return { kind: 'review', task: input };
    if (/^(?:can you )?(?:review|assess|analyze)(?: this| the)?(?: project| repo| codebase)[.!?]?$/iu.test(input))
        return { kind: 'review', task: input };
    const first = /^(\S+)(?:\s+([\s\S]*))?$/.exec(input);
    const command = first[1].toLowerCase();
    const rest = (first[2] ?? '').trim();
    if (command === 'loop-json') {
        const { verify, ...value } = loopStartSchema.parse(parseJson(rest));
        return { kind: 'loop', ...value, ...(verify.trim() ? { verify } : {}) };
    }
    if (command === 'config')
        return { kind: 'configure', patch: parsePatch(parseJson(rest)) };
    if (command === 'reset') {
        if (rest && !CONFIG_KEYS.includes(rest))
            throw new Error('Unknown configuration key.');
        return { kind: 'configure', patch: Object.fromEntries((rest ? [rest] : CONFIG_KEYS).map(key => [key, null])) };
    }
    if (command === '--') {
        if (!rest)
            throw new Error('-- requires a task description.');
        return { kind: 'activate', task: rest };
    }
    if (command.startsWith('-'))
        throw new Error('Unsupported option. Run /pua help for usage.');
    if (command === 'flavor' || command === '味道' || command === '风味') {
        if (!rest)
            return { kind: 'flavors' };
        if (rest === 'auto' || rest === '自动')
            return { kind: 'flavor', flavor: 'auto' };
        const flavor = resolveFlavor(rest);
        if (!flavor)
            throw new Error('Unknown flavor. Run /pua flavor to list the available names.');
        return { kind: 'flavor', flavor };
    }
    if (command === 'review')
        return { kind: 'review', task: rest || 'review the current project' };
    if (['ding', 'ding-inside', 'ding-outside', 'daily-briefing-pack', 'schrodinger-user', 'pathological-agile', 'wangshu-operation', '钉味', '置身钉内', '置身钉外', '每日一包', '薛定谔的用户', '病态敏捷', '望舒行动'].includes(command))
        return { kind: 'mode', mode: 'pua', task: `Use the Ding-inside/Ding-outside flavor. ${rest}` };
    if (command === 'loop' || command === 'pua-loop')
        return parseLoop(rest, loopDefaults);
    if (MODES.includes(command))
        return { kind: 'mode', mode: command, task: rest };
    const typos = { in: 'on', onn: 'on', of: 'off', offn: 'off', flavour: 'flavor', flaver: 'flavor', falvor: 'flavor', stauts: 'status', stats: 'status', agian: 'again' };
    if (Object.hasOwn(typos, command) && (!rest || command.length >= 4))
        throw new Error(`Did you mean /pua ${typos[command]}? If you really want the original text as the task, use /pua -- ${input}.`);
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
                throw new Error(`${command} takes no extra arguments; if the task starts with this word, use /pua -- <task description>.`);
            return { kind: command };
        case 'cancel-pua-loop':
        case 'cancel-loop':
        case 'pua-cancel-loop':
            if (rest)
                throw new Error(`${command} takes no extra arguments; if the task starts with this word, use /pua -- <task description>.`);
            return { kind: 'cancel-pua-loop' };
        default:
            return { kind: 'activate', task: input };
    }
}
/** Loop configuration comes from the user's native command; the model cannot alter the independent verification conditions through its output. */
function parseLoop(input, defaults) {
    const tokens = [];
    const lexer = /\s*(?:"((?:\\"|[^"])*)"|'([^']*)'|([^\s"']+))(?=\s|$)/gyu;
    let offset = 0;
    while (offset < input.trimEnd().length) {
        lexer.lastIndex = offset;
        const match = lexer.exec(input);
        if (!match)
            throw new Error('The Loop argument quotes are unclosed or the format is invalid; put the task and the full verification command each in quotes.');
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
                throw new Error('--max-iterations may not be repeated.');
            seen.add(token);
            const value = tokens[++i];
            if (!value || !/^\d+$/.test(value) || Number(value) > 10000)
                throw new Error('--max-iterations must be 0–10000; 0 means unlimited iterations, as in the original.');
            maxIterations = Number(value);
        }
        else if (token === '--verify') {
            if (seen.has(token))
                throw new Error('--verify may not be repeated.');
            seen.add(token);
            const value = tokens[++i];
            if (value === undefined || value.startsWith('--'))
                throw new Error('--verify requires a quoted verification command.');
            verify = value;
            if (!verify.trim())
                throw new Error('The verification command cannot be empty.');
        }
        else if (token.startsWith('--'))
            throw new Error(`Unsupported loop option: ${token}`);
        else
            task.push(token);
    }
    if (!task.join(' ').trim())
        throw new Error('loop needs a task description, e.g. /pua loop "fix the tests" --verify "npm test" --max-iterations 10.');
    return { kind: 'loop', task: task.join(' ').trim(), maxIterations, ...(verify === undefined ? {} : { verify }), ...(defaults ? { verificationTimeout: defaults.verificationTimeout } : {}) };
}
function parseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error('The configuration JSON is invalid; check quotes, commas, and brackets.');
    }
}
//# sourceMappingURL=args.js.map