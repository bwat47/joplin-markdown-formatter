import type { List, ListItem } from 'mdast';
import type { Node } from 'unist';
import type { Edit, Rule, RuleContext } from '../types';
import { walkWithAncestors } from '../walk';
import { computeLineStarts, isBlankLine, lineIndexOfOffset } from '../lines';

/**
 * Force lists tight (no blank lines between items) or loose (one blank line
 * between items). Each list node is handled independently, so nested lists
 * are normalized too.
 *
 * Tightening is skipped for a whole list when any item holds multi-block
 * content (e.g. a second paragraph) — such content needs its blank lines and
 * the list renders loose regardless. A trailing nested list inside an item
 * is fine; the gap before it is closed as well.
 *
 * Lists inside blockquotes are skipped: their blank lines need `>` prefixes.
 */
export const listSpacing: Rule = {
    name: 'listSpacing',

    isEnabled(options) {
        return options.listSpacing !== 'preserve';
    },

    apply({ text, tree, options }: RuleContext): Edit[] {
        const edits: Edit[] = [];
        const lineStarts = computeLineStarts(text);
        const lineEnd = (i: number): number => lineStarts[i + 1] ?? text.length;

        /** Delete every blank line lying strictly between the two offsets. */
        const removeBlankLinesBetween = (fromOffset: number, toOffset: number): void => {
            const firstLine = lineIndexOfOffset(lineStarts, fromOffset) + 1;
            const lastLine = lineIndexOfOffset(lineStarts, toOffset) - 1;
            for (let i = firstLine; i <= lastLine; i++) {
                if (isBlankLine(text, lineStarts[i], lineEnd(i))) {
                    edits.push({ start: lineStarts[i], end: lineEnd(i), replacement: '' });
                }
            }
        };

        /** True if a blank line lies strictly between the two offsets. */
        const hasBlankLineBetween = (fromOffset: number, toOffset: number): boolean => {
            const firstLine = lineIndexOfOffset(lineStarts, fromOffset) + 1;
            const lastLine = lineIndexOfOffset(lineStarts, toOffset) - 1;
            for (let i = firstLine; i <= lastLine; i++) {
                if (isBlankLine(text, lineStarts[i], lineEnd(i))) return true;
            }
            return false;
        };

        walkWithAncestors(tree, (node: Node, ancestors: Node[]) => {
            if (node.type !== 'list') return;
            if (ancestors.some((ancestor) => ancestor.type === 'blockquote')) return;
            const list = node as List;
            const items = list.children;

            if (options.listSpacing === 'tight') {
                // An item with block content after its first child (other than a
                // trailing nested list) cannot be tightened.
                const tightable = items.every((item: ListItem) =>
                    item.children.every((child, index) => index === 0 || child.type === 'list')
                );
                if (!tightable) return;

                for (const item of items) {
                    // Close gaps between an item's own blocks (paragraph -> nested list).
                    for (let i = 0; i < item.children.length - 1; i++) {
                        const from = item.children[i].position?.end?.offset;
                        const to = item.children[i + 1].position?.start?.offset;
                        if (from !== undefined && to !== undefined) removeBlankLinesBetween(from, to);
                    }
                }
                for (let i = 0; i < items.length - 1; i++) {
                    const from = items[i].position?.end?.offset;
                    const to = items[i + 1].position?.start?.offset;
                    if (from !== undefined && to !== undefined) removeBlankLinesBetween(from, to);
                }
            } else {
                // loose: ensure one blank line between consecutive items.
                for (let i = 0; i < items.length - 1; i++) {
                    const from = items[i].position?.end?.offset;
                    const to = items[i + 1].position?.start?.offset;
                    if (from === undefined || to === undefined) continue;
                    if (hasBlankLineBetween(from, to)) continue;
                    const nextLineStart = lineStarts[lineIndexOfOffset(lineStarts, to)];
                    edits.push({ start: nextLineStart, end: nextLineStart, replacement: '\n' });
                }
            }
        });

        return edits;
    },
};
