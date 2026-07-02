import type { Edit, Rule, RuleContext } from '../types';
import { computeLineStarts, isBlankLine, lineIndexOfOffset } from '../lines';
import { walkWithAncestors } from '../walk';

/**
 * Ensure headings have exactly one blank line around them when neighboring
 * content exists. Blockquote headings are left alone because inserting
 * ordinary blank lines there splits the quote into separate blockquotes.
 */
export const headingSpacing: Rule = {
    name: 'headingSpacing',

    isEnabled(options) {
        return options.ensureHeadingBlankLines;
    },

    apply({ text, tree }: RuleContext): Edit[] {
        const edits: Edit[] = [];
        const editKeys = new Set<string>();
        const lineStarts = computeLineStarts(text);
        const lineEnd = (i: number): number => lineStarts[i + 1] ?? text.length;
        const addEdit = (edit: Edit): void => {
            if (text.slice(edit.start, edit.end) === edit.replacement) return;
            const key = `${edit.start}:${edit.end}:${edit.replacement}`;
            if (editKeys.has(key)) return;
            editKeys.add(key);
            edits.push(edit);
        };

        walkWithAncestors(tree, (node, ancestors) => {
            if (node.type !== 'heading') return;
            if (ancestors.some((ancestor) => ancestor.type === 'blockquote')) return;
            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (start === undefined || end === undefined) return;

            const firstLine = lineIndexOfOffset(lineStarts, start);
            const lastLine = lineIndexOfOffset(lineStarts, Math.max(start, end - 1));
            addSpacingAbove(text, lineStarts, lineEnd, firstLine, addEdit);
            addSpacingBelow(text, lineStarts, lineEnd, lastLine, addEdit);
        });

        return edits;
    },
};

function addSpacingAbove(
    text: string,
    lineStarts: number[],
    lineEnd: (i: number) => number,
    lineIndex: number,
    addEdit: (edit: Edit) => void
): void {
    if (lineIndex === 0) return;

    const previous = lineIndex - 1;
    if (!isBlankLine(text, lineStarts[previous], lineEnd(previous))) {
        addEdit({ start: lineStarts[lineIndex], end: lineStarts[lineIndex], replacement: '\n' });
        return;
    }

    let runStart = previous;
    while (runStart > 0 && isBlankLine(text, lineStarts[runStart - 1], lineEnd(runStart - 1))) {
        runStart--;
    }
    if (runStart === 0) return;

    addEdit({ start: lineStarts[runStart], end: lineStarts[lineIndex], replacement: '\n' });
}

function addSpacingBelow(
    text: string,
    lineStarts: number[],
    lineEnd: (i: number) => number,
    lineIndex: number,
    addEdit: (edit: Edit) => void
): void {
    const next = lineIndex + 1;
    if (next >= lineStarts.length) return;

    if (!isBlankLine(text, lineStarts[next], lineEnd(next))) {
        const insertAt = lineEnd(lineIndex);
        addEdit({ start: insertAt, end: insertAt, replacement: '\n' });
        return;
    }

    let runEnd = next + 1;
    while (runEnd < lineStarts.length && isBlankLine(text, lineStarts[runEnd], lineEnd(runEnd))) {
        runEnd++;
    }
    if (runEnd === lineStarts.length) return;

    addEdit({ start: lineStarts[next], end: lineStarts[runEnd], replacement: '\n' });
}
