import type { Edit, QuoteStyle, Rule, RuleContext } from '../types';
import { walk } from '../walk';

/** Letter or number in any script. */
const isWordChar = (ch: string | undefined): boolean => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

const DOUBLE_OPEN = '“'; // “
const DOUBLE_CLOSE = '”'; // ”
const SINGLE_OPEN = '‘'; // ‘
const SINGLE_CLOSE = '’'; // ’

/**
 * Characters after which a straight quote reads as *opening*: whitespace,
 * opening brackets, dashes, and other opening quotes (`"'Nested,' he said"`).
 */
const OPENING_CONTEXT = /[\s([{–—‘“'"-]/;

/**
 * Convert quotes in prose between straight (`"` `'`) and smart (“ ” ‘ ’)
 * styles per `doubleQuoteStyle` / `singleQuoteStyle`. Only `text` nodes are
 * touched, so code, math, HTML, front matter, autolinks, and link titles
 * pass through untouched. All replacements swap a single character for a
 * single character, never changing text length.
 *
 * Toward smart, opening vs. closing is decided from the surrounding
 * characters (SmartyPants-style):
 * - after a letter/digit -> closing/apostrophe (`don't`, `word"`)
 * - `'` before a two-digit decade (`'90s`) -> apostrophe
 * - after whitespace/start/opening bracket/dash/opening quote -> opening
 *   when followed by a non-space, else closing
 * - anything else (e.g. after `.` or `,`) -> closing
 *
 * Backslash-escaped quotes (`\"`) are skipped: rewriting the quote would
 * turn the escape into a literal backslash and change the text.
 */
export const quoteStyle: Rule = {
    name: 'quoteStyle',

    isEnabled(options) {
        return options.doubleQuoteStyle !== 'preserve' || options.singleQuoteStyle !== 'preserve';
    },

    apply({ text, tree, options }: RuleContext): Edit[] {
        const edits: Edit[] = [];

        walk(tree, (node) => {
            if (node.type !== 'text') return;
            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (start === undefined || end === undefined) return;

            for (let i = start; i < end; i++) {
                const replacement = convertAt(text, i, options.doubleQuoteStyle, options.singleQuoteStyle);
                if (replacement === undefined || replacement === text[i]) continue;
                if (isEscaped(text, i)) continue;
                edits.push({ start: i, end: i + 1, replacement });
            }
        });

        return edits;
    },
};

function convertAt(text: string, i: number, double: QuoteStyle, single: QuoteStyle): string | undefined {
    switch (text[i]) {
        case '"':
            return double === 'smart' ? smartDouble(text, i) : undefined;
        case DOUBLE_OPEN:
        case DOUBLE_CLOSE:
            return double === 'straight' ? '"' : undefined;
        case "'":
            return single === 'smart' ? smartSingle(text, i) : undefined;
        case SINGLE_OPEN:
        case SINGLE_CLOSE:
            return single === 'straight' ? "'" : undefined;
        default:
            return undefined;
    }
}

function smartDouble(text: string, i: number): string {
    const prev = text[i - 1];
    const next = text[i + 1];
    if (isWordChar(prev)) return DOUBLE_CLOSE;
    if (prev === undefined || OPENING_CONTEXT.test(prev)) {
        return next !== undefined && !/\s/.test(next) ? DOUBLE_OPEN : DOUBLE_CLOSE;
    }
    return DOUBLE_CLOSE;
}

function smartSingle(text: string, i: number): string {
    const prev = text[i - 1];
    const next = text[i + 1];
    if (isWordChar(prev)) return SINGLE_CLOSE;
    if (/^\d\ds/.test(text.slice(i + 1, i + 4))) return SINGLE_CLOSE;
    if (prev === undefined || OPENING_CONTEXT.test(prev)) {
        return next !== undefined && !/\s/.test(next) ? SINGLE_OPEN : SINGLE_CLOSE;
    }
    return SINGLE_CLOSE;
}

/** True when the character at `i` is preceded by an odd run of backslashes. */
function isEscaped(text: string, i: number): boolean {
    let backslashes = 0;
    for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) backslashes++;
    return backslashes % 2 === 1;
}
