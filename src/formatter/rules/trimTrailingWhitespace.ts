import type { Edit, Rule, RuleContext } from '../types';
import { computeLineStarts, isBlankLine } from '../lines';
import { getProtectedRanges, intersectsProtectedRange } from '../protectedRanges';

/**
 * Trim trailing spaces/tabs on each line, except for the two trailing spaces
 * that encode a Markdown hard line break on a non-blank line.
 */
export const trimTrailingWhitespace: Rule = {
    name: 'trimTrailingWhitespace',

    isEnabled(options) {
        return options.trimTrailingWhitespace;
    },

    apply({ text, tree }: RuleContext): Edit[] {
        const edits: Edit[] = [];
        const protectedRanges = getProtectedRanges(tree);
        const lineStarts = computeLineStarts(text);
        const lineEnd = (i: number): number => lineStarts[i + 1] ?? text.length;

        for (let i = 0; i < lineStarts.length; i++) {
            const start = lineStarts[i];
            const end = lineEnd(i);
            let contentEnd = end;
            if (text[contentEnd - 1] === '\n') contentEnd--;
            if (text[contentEnd - 1] === '\r') contentEnd--;

            const line = text.slice(start, contentEnd);
            const trailingWhitespace = /[ \t]+$/.exec(line);
            if (trailingWhitespace === null) continue;

            const trimStart = start + trailingWhitespace.index;
            const trimEnd = contentEnd;
            if (intersectsProtectedRange(protectedRanges, trimStart, trimEnd)) continue;

            const hasLineEnding = contentEnd < end;
            const preserveHardBreak =
                hasLineEnding && !isBlankLine(text, start, end) && trailingWhitespace[0].endsWith('  ');
            const replacement = preserveHardBreak ? '  ' : '';
            if (text.slice(trimStart, trimEnd) === replacement) continue;

            edits.push({ start: trimStart, end: trimEnd, replacement });
        }

        return edits;
    },
};
