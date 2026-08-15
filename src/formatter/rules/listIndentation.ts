import type { List, ListItem, Root } from 'mdast';
import type { Edit, Rule, RuleContext } from '../types';
import type { Indentation } from '../types';
import { computeLineStarts, isBlankLine, lineIndexOfOffset, columnWidth, indentBeyondColumn } from '../lines';

interface MarkerAction {
    kind: 'marker';
    /** Offset just past the marker's trailing whitespace (first content char, or EOL for empty items). */
    contentOffset: number;
    marker: string;
    indentCols: number;
    emptyItem: boolean;
}

interface ShiftAction {
    kind: 'shift';
    oldContentCol: number;
    newContentCol: number;
    /** Paragraph indentation is formatting, unlike content-internal indentation in other blocks. */
    normalizeWholePrefix: boolean;
}

type LineAction = MarkerAction | ShiftAction;

/** What one item's marker line and continuation lines need, once measured. */
interface ItemLayout {
    markerLine: number;
    lastLine: number;
    marker: MarkerAction;
    /** Item-wide part of every continuation line's shift; the per-line flag is added in `processList`. */
    shift: Omit<ShiftAction, 'normalizeWholePrefix'>;
    /** Content column of the rewritten item, i.e. where a nested list may start. */
    newContentCol: number;
}

interface ListContext {
    text: string;
    lineStarts: number[];
    /** Columns of indentation per nesting level. */
    unitCols: number;
    // Innermost assignment wins: parents fill their whole span first,
    // then recursion into nested lists overwrites the nested lines.
    actions: Map<number, LineAction>;
}

/**
 * Normalize list indentation: a configurable unit (tab / 2 spaces / 4
 * spaces) per nesting level *before* the marker, and exactly one space
 * *after* it.
 *
 * How it works: top-level lists are walked recursively, tracking each item's
 * old and new content column (tab stop = 4). The marker line gets its prefix
 * rewritten to `indent + marker + ' '`; every continuation line belonging to
 * the item (later paragraphs, fenced code, ...) has its leading whitespace
 * shifted to the new content column. Paragraph prefixes are normalized to the
 * configured style, while other blocks preserve columns beyond the old
 * content column verbatim so content-internal indentation survives.
 *
 * CommonMark guard: a child list's marker must sit at or beyond the parent
 * item's content column to stay nested (a 2-space unit under a `10. ` marker
 * would break out), so the computed indent is bumped up when needed.
 *
 * Limitations (documented in ARCHITECTURE.md): lists inside blockquotes or
 * footnote definitions are left untouched — only lists at the document root
 * are processed.
 */
export const listIndentation: Rule = {
    name: 'listIndentation',

    isEnabled() {
        return true;
    },

    apply({ text, tree, options }: RuleContext): Edit[] {
        const lineStarts = computeLineStarts(text);
        const actions = collectActions(text, lineStarts, tree, options.indentation === 'spaces2' ? 2 : 4);

        const edits: Edit[] = [];
        for (const [line, action] of actions) {
            const start = lineStarts[line];
            const end = lineStarts[line + 1] ?? text.length;
            const edit =
                action.kind === 'marker'
                    ? markerEdit(text, start, action, options.indentation)
                    : shiftEdit(text, start, end, action, options.indentation);
            if (edit) edits.push(edit);
        }
        return edits;
    },
};

/** Map every line of every root-level list to the rewrite it needs. */
function collectActions(text: string, lineStarts: number[], tree: Root, unitCols: number): Map<number, LineAction> {
    const ctx: ListContext = { text, lineStarts, unitCols, actions: new Map() };
    for (const child of tree.children) {
        if (child.type === 'list') processList(ctx, child, 0, 0);
    }
    return ctx.actions;
}

function processList(ctx: ListContext, list: List, depth: number, parentContentCol: number): void {
    // A nested list can open on the same line as the markers containing it
    // (`1. - - a`). Actions are keyed by line, so only the innermost marker's
    // rewrite would survive, and it replaces from the line start — wiping out
    // the markers before it. Such a list is left as written, descendants
    // included; the containing item's shift actions keep its later lines
    // aligned relative to the parent's content column.
    if (startsMidLine(ctx.text, ctx.lineStarts, list)) return;

    const indentCols = depth === 0 ? 0 : Math.max(ctx.unitCols * depth, parentContentCol);

    for (const item of list.children as ListItem[]) {
        const layout = measureItem(ctx, list, item, indentCols);
        if (!layout) continue;

        ctx.actions.set(layout.markerLine, layout.marker);
        const paragraphLines = directParagraphLines(ctx.lineStarts, item);
        for (let line = layout.markerLine + 1; line <= layout.lastLine; line++) {
            ctx.actions.set(line, { ...layout.shift, normalizeWholePrefix: paragraphLines.has(line) });
        }

        for (const child of item.children) {
            if (child.type === 'list') processList(ctx, child, depth + 1, layout.newContentCol);
        }
    }
}

/**
 * Measure one list item's marker and content columns. Returns null when the
 * item must be left as written (no position, no recognizable marker, or
 * marker spacing wide enough that the content is indented code).
 */
function measureItem(ctx: ListContext, list: List, item: ListItem, indentCols: number): ItemLayout | null {
    const { text, lineStarts } = ctx;
    const startOffset = item.position?.start?.offset;
    const endOffset = item.position?.end?.offset;
    if (startOffset === undefined || endOffset === undefined) return null;

    const marker = matchMarker(text, list, startOffset);
    if (marker === null) return null;

    const contentOffset = skipSpaces(text, startOffset + marker.length);
    const emptyItem = contentOffset >= text.length || text[contentOffset] === '\n' || text[contentOffset] === '\r';

    const markerLine = lineIndexOfOffset(lineStarts, startOffset);
    const markerEndCol = columnWidth(text.slice(lineStarts[markerLine], startOffset + marker.length));
    // An empty marker line's content column is markerEnd + 1 per CommonMark.
    const oldContentCol = emptyItem ? markerEndCol + 1 : columnWidth(text.slice(lineStarts[markerLine], contentOffset));
    // More than 4 columns after the marker means the item starts with
    // indented code; collapsing that spacing would change meaning.
    if (!emptyItem && oldContentCol - markerEndCol > 4) return null;
    const newContentCol = indentCols + marker.length + 1;

    return {
        markerLine,
        lastLine: lineIndexOfOffset(lineStarts, Math.max(endOffset - 1, startOffset)),
        marker: { kind: 'marker', contentOffset, marker, indentCols, emptyItem },
        shift: { kind: 'shift', oldContentCol, newContentCol },
        newContentCol,
    };
}

/** Lines belonging to paragraphs directly contained by this list item. */
function directParagraphLines(lineStarts: number[], item: ListItem): Set<number> {
    const lines = new Set<number>();
    for (const child of item.children) {
        if (child.type !== 'paragraph') continue;
        const startOffset = child.position?.start?.offset;
        const endOffset = child.position?.end?.offset;
        if (startOffset === undefined || endOffset === undefined) continue;

        const firstLine = lineIndexOfOffset(lineStarts, startOffset);
        const lastLine = lineIndexOfOffset(lineStarts, Math.max(endOffset - 1, startOffset));
        for (let line = firstLine; line <= lastLine; line++) lines.add(line);
    }
    return lines;
}

/** The item's list marker (`-`, `1.`, `2)`, ...) at `startOffset`, or null. */
function matchMarker(text: string, list: List, startOffset: number): string | null {
    const match = list.ordered
        ? /^\d{1,9}[.)]/.exec(text.slice(startOffset, startOffset + 11))
        : /^[-*+]/.exec(text.slice(startOffset, startOffset + 1));
    return match ? match[0] : null;
}

/** First offset at or after `offset` that is not a space or tab. */
function skipSpaces(text: string, offset: number): number {
    let i = offset;
    while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++;
    return i;
}

/** Rewrite a marker line's prefix to `indent + marker + ' '`. */
function markerEdit(text: string, start: number, action: MarkerAction, style: Indentation): Edit | null {
    const newPrefix = makeIndent(action.indentCols, style) + action.marker + (action.emptyItem ? '' : ' ');
    const oldPrefix = text.slice(start, action.contentOffset);
    if (oldPrefix === newPrefix) return null;
    return { start, end: action.contentOffset, replacement: newPrefix };
}

/** Shift a continuation line's leading whitespace to the new content column. */
function shiftEdit(text: string, start: number, end: number, action: ShiftAction, style: Indentation): Edit | null {
    if (isBlankLine(text, start, end)) return null;
    // Non-paragraph blocks can contain indentation that must remain verbatim.
    // When their container column did not move, tabs mode has nothing to do.
    if (style === 'tabs' && action.oldContentCol === action.newContentCol && !action.normalizeWholePrefix) return null;
    const ws = /^[ \t]*/.exec(text.slice(start, end))![0];
    const wsCols = columnWidth(ws);
    // Lazy continuation lines (indented less than the content column) stay as written.
    if (wsCols < action.oldContentCol) return null;
    // Paragraph leading whitespace is entirely indentation, so normalize its
    // shifted display width. Other blocks keep their content-internal tail.
    const newWs = action.normalizeWholePrefix
        ? makeIndent(wsCols - action.oldContentCol + action.newContentCol, style)
        : makeIndent(action.newContentCol, style) + indentBeyondColumn(ws, action.oldContentCol);
    if (newWs === ws) return null;
    return { start, end: start + ws.length, replacement: newWs };
}

/**
 * True when anything other than whitespace precedes the list on its opening
 * line — i.e. the list is nested directly after its parent's marker, as in
 * `1. - a`. Only a list's first item can start mid-line, so the list's own
 * start offset answers this for every item.
 */
function startsMidLine(text: string, lineStarts: number[], list: List): boolean {
    const startOffset = list.position?.start?.offset;
    if (startOffset === undefined) return false;
    const lineStart = lineStarts[lineIndexOfOffset(lineStarts, startOffset)];
    return /\S/.test(text.slice(lineStart, startOffset));
}

/**
 * Indentation string occupying exactly `columns` display columns: full tabs
 * plus space remainder for 'tabs', otherwise all spaces. Exact column
 * counts keep the rule idempotent.
 */
function makeIndent(columns: number, style: Indentation): string {
    if (style === 'tabs') {
        return '\t'.repeat(Math.floor(columns / 4)) + ' '.repeat(columns % 4);
    }
    return ' '.repeat(columns);
}
