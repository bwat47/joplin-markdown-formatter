import type { Edit, Rule, RuleContext } from '../types';
import { computeLineStarts, isBlankLine } from '../lines';
import { getProtectedRanges, intersectsProtectedRange } from '../protectedRanges';

/**
 * Collapse runs of two or more blank lines into a single blank line.
 *
 * Runs that touch a protected range (fenced/indented code, front matter,
 * HTML blocks) are left alone, since blank lines are content there. A
 * collapsed run also loses any stray whitespace on the blank lines.
 */
export const collapseBlankLines: Rule = {
    name: 'collapseBlankLines',

    isEnabled(options) {
        return options.collapseBlankLines;
    },

    apply({ text, tree }: RuleContext): Edit[] {
        const edits: Edit[] = [];
        const protectedRanges = getProtectedRanges(tree);
        const lineStarts = computeLineStarts(text);
        const lineEnd = (i: number): number => lineStarts[i + 1] ?? text.length;

        let runStart = -1;
        const flushRun = (runEndLine: number): void => {
            // runEndLine is the first line index after the run.
            if (runStart === -1) return;
            const runLength = runEndLine - runStart;
            const start = lineStarts[runStart];
            const end = lineEnd(runEndLine - 1);
            runStart = -1;
            if (runLength < 2) return;
            if (intersectsProtectedRange(protectedRanges, start, end)) return;
            edits.push({ start, end, replacement: '\n' });
        };

        for (let i = 0; i < lineStarts.length; i++) {
            if (isBlankLine(text, lineStarts[i], lineEnd(i))) {
                if (runStart === -1) runStart = i;
            } else {
                flushRun(i);
            }
        }
        flushRun(lineStarts.length);

        return edits;
    },
};
