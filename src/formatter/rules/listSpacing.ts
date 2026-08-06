import type { List, ListItem } from 'mdast';
import type { Node } from 'unist';
import type { Edit, Rule, RuleContext } from '../types';
import { walkWithAncestors } from '../walk';
import { computeLineStarts, isBlankLine, lineIndexOfOffset } from '../lines';

/**
 * The gap between each pair of adjacent nodes, as `[endOffset, startOffset]`.
 * Pairs where either position is missing are skipped.
 */
function* adjacentGaps(nodes: readonly Node[]): Generator<[number, number]> {
    for (let i = 0; i < nodes.length - 1; i++) {
        const from = nodes[i].position?.end?.offset;
        const to = nodes[i + 1].position?.start?.offset;
        if (from !== undefined && to !== undefined) yield [from, to];
    }
}

/**
 * Every gap a list's spacing is defined by: first the gaps between an item's
 * own blocks (paragraph -> nested list), then those between consecutive items.
 */
function* listGaps(items: readonly ListItem[]): Generator<[number, number]> {
    for (const item of items) yield* adjacentGaps(item.children);
    yield* adjacentGaps(items);
}

/**
 * True when no item holds block content after its first child other than a
 * trailing nested list — anything else needs its blank lines and renders loose.
 */
function isTightable(items: readonly ListItem[]): boolean {
    return items.every((item) => item.children.every((child, index) => index === 0 || child.type === 'list'));
}

/**
 * Force lists tight (no blank lines between items) or loose (one blank line
 * between items). Each list node is handled independently, so nested lists
 * are normalized too.
 *
 * Semantic mode keeps each list's authored meaning: per CommonMark a list is
 * loose when any blank line separates two items or two blocks within an item,
 * and it then renders loose everywhere. So a loose list with mixed spacing is
 * made consistently loose, and a tight list is left untouched — no edit ever
 * changes how the list renders.
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

        const insertedLineStarts = new Set<number>();
        const ensureBlankLineBetween = (fromOffset: number, toOffset: number): void => {
            if (hasBlankLineBetween(fromOffset, toOffset)) return;
            const nextLineStart = lineStarts[lineIndexOfOffset(lineStarts, toOffset)];
            if (insertedLineStarts.has(nextLineStart)) return;
            insertedLineStarts.add(nextLineStart);
            edits.push({ start: nextLineStart, end: nextLineStart, replacement: '\n' });
        };

        /**
         * CommonMark looseness, read from the text itself: a blank line
         * between two items or between two blocks within an item.
         */
        const isLooseList = (items: readonly ListItem[]): boolean => {
            for (const [from, to] of listGaps(items)) {
                if (hasBlankLineBetween(from, to)) return true;
            }
            return false;
        };

        walkWithAncestors(tree, (node: Node, ancestors: Node[]) => {
            if (node.type !== 'list') return;
            if (ancestors.some((ancestor) => ancestor.type === 'blockquote')) return;
            const items = (node as List).children;

            if (options.listSpacing === 'tight') {
                if (!isTightable(items)) return;
                for (const [from, to] of listGaps(items)) removeBlankLinesBetween(from, to);
                return;
            }

            // Semantic: tight lists have no blank lines to remove, so only
            // loose lists need work — make their spacing consistently loose.
            if (options.listSpacing === 'semantic' && !isLooseList(items)) return;

            for (const [from, to] of listGaps(items)) ensureBlankLineBetween(from, to);
        });

        return edits;
    },
};
