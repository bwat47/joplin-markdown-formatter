import type { Edit, Rule, RuleContext } from '../types';
import { computeLineStarts, lineIndexOfOffset } from '../lines';
import { walk } from '../walk';
import { addSpacingAbove, addSpacingBelow, createEditSink } from './blockSpacing';

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
        const { edits, addEdit } = createEditSink(text);
        const lineStarts = computeLineStarts(text);
        const lineEnd = (i: number): number => lineStarts[i + 1] ?? text.length;
        const marker = options.thematicBreakMarker;

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
