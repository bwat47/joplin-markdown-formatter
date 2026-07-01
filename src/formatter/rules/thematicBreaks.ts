import type { Edit, Rule, RuleContext } from '../types';
import { walk } from '../walk';

/**
 * Normalize horizontal rules (mdast `thematicBreak` nodes) to the configured
 * marker. Parser positions start after allowed indentation and can include
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
        const marker = options.thematicBreakMarker;

        walk(tree, (node) => {
            if (node.type !== 'thematicBreak') return;
            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (start === undefined || end === undefined) return;

            const current = text.slice(start, end);
            if (current === marker) return;
            edits.push({ start, end, replacement: marker });
        });

        return edits;
    },
};
