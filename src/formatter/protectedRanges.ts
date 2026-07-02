import type { Root } from 'mdast';
import { walk } from './walk';

/** Half-open character offset range [start, end). */
export interface OffsetRange {
    start: number;
    end: number;
}

/**
 * Node types whose raw source must never be rewritten by whitespace-level
 * rules: their content is literal, not markdown.
 */
const PROTECTED_TYPES = new Set(['code', 'inlineCode', 'yaml', 'toml', 'html', 'math', 'inlineMath']);

/** Collect the source ranges of all literal-content nodes in the tree. */
export function getProtectedRanges(tree: Root): OffsetRange[] {
    const ranges: OffsetRange[] = [];
    walk(tree, (node) => {
        if (!PROTECTED_TYPES.has(node.type)) return;
        const start = node.position?.start?.offset;
        const end = node.position?.end?.offset;
        if (start === undefined || end === undefined) return;
        ranges.push({ start, end });
    });
    return ranges;
}

/** True if [start, end) overlaps any protected range. */
export function intersectsProtectedRange(ranges: OffsetRange[], start: number, end: number): boolean {
    return ranges.some((range) => range.start < end && range.end > start);
}
