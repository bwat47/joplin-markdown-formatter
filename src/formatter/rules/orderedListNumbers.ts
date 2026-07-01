import type { List } from 'mdast';
import type { Edit, Rule, RuleContext } from '../types';
import { walk } from '../walk';

/**
 * Renumber ordered lists sequentially, starting from the first item's
 * number (an intentional non-1 start is preserved). Nested ordered lists
 * are separate list nodes and renumber independently. The `.` vs `)`
 * delimiter is untouched — mixed delimiters parse as separate lists, so
 * preservation is automatic.
 */
export const orderedListNumbers: Rule = {
    name: 'orderedListNumbers',

    isEnabled(options) {
        return options.normalizeOrderedListNumbering;
    },

    apply({ text, tree }: RuleContext): Edit[] {
        const edits: Edit[] = [];

        walk(tree, (node) => {
            if (node.type !== 'list') return;
            const list = node as List;
            if (!list.ordered) return;

            const start = list.start ?? 1;
            // CommonMark caps ordered markers at 9 digits.
            if (start + list.children.length - 1 > 999999999) return;

            list.children.forEach((item, index) => {
                const offset = item.position?.start?.offset;
                if (offset === undefined) return;
                // Marker digits, e.g. "12" of "12. item"; guards against position drift.
                const match = /^\d{1,9}(?=[.)])/.exec(text.slice(offset, offset + 10));
                if (!match) return;
                const desired = String(start + index);
                if (match[0] === desired) return;
                edits.push({ start: offset, end: offset + match[0].length, replacement: desired });
            });
        });

        return edits;
    },
};
