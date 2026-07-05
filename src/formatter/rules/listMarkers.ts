import type { List } from 'mdast';
import type { Edit, Rule, RuleContext } from '../types';
import { walk } from '../walk';

/**
 * Normalize unordered list bullets (-, *, +) to the configured marker.
 *
 * Each list item's position starts at its bullet character, so the edit is a
 * single-character replacement. The character is verified to actually be a
 * bullet before replacing, as a guard against position drift.
 *
 * Note: CommonMark treats adjacent lists with different bullets as separate
 * lists; normalizing their markers merges them, which is the intended
 * behavior for a normalizer.
 */
export const listMarkers: Rule = {
    name: 'listMarkers',

    isEnabled(options) {
        return options.unorderedListMarker !== 'preserve';
    },

    apply({ text, tree, options }: RuleContext): Edit[] {
        const edits: Edit[] = [];
        const marker = options.unorderedListMarker;

        walk(tree, (node) => {
            if (node.type !== 'list') return;
            const list = node as List;
            if (list.ordered) return;

            for (const item of list.children) {
                const offset = item.position?.start?.offset;
                if (offset === undefined) continue;
                const bullet = text[offset];
                if (bullet === marker || !/[-*+]/.test(bullet)) continue;
                edits.push({ start: offset, end: offset + 1, replacement: marker });
            }
        });

        return edits;
    },
};
