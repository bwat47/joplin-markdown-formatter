import type { Edit, Rule, RuleContext } from '../types';

/** Move parsed root-level ATX headings to the physical start of their line. */
export const headingIndentation: Rule = {
    name: 'headingIndentation',

    isEnabled(options) {
        return options.removeHeadingIndentation;
    },

    apply({ text, tree }: RuleContext): Edit[] {
        const edits: Edit[] = [];

        for (const node of tree.children) {
            if (node.type !== 'heading') continue;

            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (start === undefined || end === undefined) continue;

            if (!/^#{1,6}(?:[\t ]|$)/.test(text.slice(start, end))) continue; // Setext heading.

            const lineStart = text.lastIndexOf('\n', start - 1) + 1;
            const leadingSpaces = text.slice(lineStart, start);
            if (!/^ {1,3}$/.test(leadingSpaces)) continue;

            edits.push({ start: lineStart, end: start, replacement: '' });
        }

        return edits;
    },
};
