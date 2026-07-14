import type { Edit, Rule, RuleContext } from '../types';
import { walk } from '../walk';

/** Normalize separators inside ATX headings without reprinting their text. */
export const headingMarkerSpacing: Rule = {
    name: 'headingMarkerSpacing',

    isEnabled(options) {
        return options.normalizeHeadingMarkerSpacing;
    },

    apply({ text, tree }: RuleContext): Edit[] {
        const edits: Edit[] = [];

        walk(tree, (node) => {
            if (node.type !== 'heading') return;

            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (start === undefined || end === undefined) return;

            addAtxHeadingSpacingEdits(text, start, end, edits);
        });

        return edits;
    },
};

function addAtxHeadingSpacingEdits(text: string, start: number, end: number, edits: Edit[]): void {
    const source = text.slice(start, end);
    // Up to three leading spaces are valid before an ATX heading marker.
    const opening = /^( {0,3}#{1,6})([\t ]+)/.exec(source);
    if (!opening) return; // Setext heading.

    addSeparatorEdit(start + opening[1].length, opening[2], edits);

    const closing = /([\t ]+)(#{1,})[\t ]*$/.exec(source);
    if (closing) addSeparatorEdit(start + closing.index, closing[1], edits);
}

function addSeparatorEdit(start: number, separator: string, edits: Edit[]): void {
    if (separator === ' ') return;

    const end = start + separator.length;
    if (edits.some((edit) => edit.start === start && edit.end === end)) return;
    edits.push({ start, end, replacement: ' ' });
}
