import type { Edit, Rule, RuleContext } from '../types';
import { computeLineStarts, isBlankLine, lineIndexOfOffset } from '../lines';
import { walk } from '../walk';

/**
 * Normalize horizontal rules (mdast `thematicBreak` nodes) to the configured
 * marker and exactly one blank line above/below it when neighboring content
 * exists. Parser positions start after allowed indentation and can include
 * trailing whitespace, so replacing that span preserves indentation while
 * trimming stray spaces after the marker.
 */
export const thematicBreaks: Rule = {
    name: 'thematicBreaks',

    isEnabled() {
        return true;
    },

    apply({ text, tree, options }: RuleContext): Edit[] {
        const edits: Edit[] = [];
        const editKeys = new Set<string>();
        const lineStarts = computeLineStarts(text);
        const lineEnd = (i: number): number => lineStarts[i + 1] ?? text.length;
        const marker = options.thematicBreakMarker;
        const addEdit = (edit: Edit): void => {
            if (text.slice(edit.start, edit.end) === edit.replacement) return;
            const key = `${edit.start}:${edit.end}:${edit.replacement}`;
            if (editKeys.has(key)) return;
            editKeys.add(key);
            edits.push(edit);
        };

        walk(tree, (node) => {
            if (node.type !== 'thematicBreak') return;
            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (start === undefined || end === undefined) return;

            const current = text.slice(start, end);
            if (current !== marker) addEdit({ start, end, replacement: marker });

            const lineIndex = lineIndexOfOffset(lineStarts, start);
            addSpacingAbove(text, lineStarts, lineEnd, lineIndex, addEdit);
            addSpacingBelow(text, lineStarts, lineEnd, lineIndex, addEdit);
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
