import type { List, ListItem } from 'mdast';
import type { Edit, Rule, RuleContext } from '../types';
import type { Indentation } from '../types';
import { computeLineStarts, isBlankLine, lineIndexOfOffset, columnWidth, indentBeyondColumn } from '../lines';

/**
 * Normalize list indentation: a configurable unit (tab / 2 spaces / 4
 * spaces) per nesting level *before* the marker, and exactly one space
 * *after* it.
 *
 * How it works: top-level lists are walked recursively, tracking each item's
 * old and new content column (tab stop = 4). The marker line gets its prefix
 * rewritten to `indent + marker + ' '`; every continuation line belonging to
 * the item (later paragraphs, fenced code, ...) has its leading whitespace
 * shifted to the new content column, with columns beyond the old content
 * column preserved verbatim so content-internal indentation survives.
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
        const lineEnd = (i: number): number => lineStarts[i + 1] ?? text.length;
        const unitCols = options.indentation === 'spaces2' ? 2 : 4;

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
        }
        // Innermost assignment wins: parents fill their whole span first,
        // then recursion into nested lists overwrites the nested lines.
        const actions = new Map<number, MarkerAction | ShiftAction>();

        const processList = (list: List, depth: number, parentContentCol: number): void => {
            const indentCols = depth === 0 ? 0 : Math.max(unitCols * depth, parentContentCol);

            for (const item of list.children as ListItem[]) {
                const startOffset = item.position?.start?.offset;
                const endOffset = item.position?.end?.offset;
                if (startOffset === undefined || endOffset === undefined) continue;

                const markerMatch = list.ordered
                    ? /^\d{1,9}[.)]/.exec(text.slice(startOffset, startOffset + 11))
                    : /^[-*+]/.exec(text.slice(startOffset, startOffset + 1));
                if (!markerMatch) continue;
                const marker = markerMatch[0];

                let contentOffset = startOffset + marker.length;
                while (contentOffset < text.length && (text[contentOffset] === ' ' || text[contentOffset] === '\t')) {
                    contentOffset++;
                }
                const emptyItem =
                    contentOffset >= text.length || text[contentOffset] === '\n' || text[contentOffset] === '\r';

                const markerLine = lineIndexOfOffset(lineStarts, startOffset);
                const markerEndCol = columnWidth(text.slice(lineStarts[markerLine], startOffset + marker.length));
                // An empty marker line's content column is markerEnd + 1 per CommonMark.
                const oldContentCol = emptyItem
                    ? markerEndCol + 1
                    : columnWidth(text.slice(lineStarts[markerLine], contentOffset));
                // More than 4 columns after the marker means the item starts with
                // indented code; collapsing that spacing would change meaning.
                if (!emptyItem && oldContentCol - markerEndCol > 4) continue;
                const newContentCol = indentCols + marker.length + 1;

                actions.set(markerLine, { kind: 'marker', contentOffset, marker, indentCols, emptyItem });

                const lastLine = lineIndexOfOffset(lineStarts, Math.max(endOffset - 1, startOffset));
                for (let line = markerLine + 1; line <= lastLine; line++) {
                    actions.set(line, { kind: 'shift', oldContentCol, newContentCol });
                }

                for (const child of item.children) {
                    if (child.type === 'list') processList(child, depth + 1, newContentCol);
                }
            }
        };

        for (const child of tree.children) {
            if (child.type === 'list') processList(child, 0, 0);
        }

        const edits: Edit[] = [];
        for (const [line, action] of actions) {
            const start = lineStarts[line];
            const end = lineEnd(line);

            if (action.kind === 'marker') {
                const newPrefix =
                    makeIndent(action.indentCols, options.indentation) + action.marker + (action.emptyItem ? '' : ' ');
                const oldPrefix = text.slice(start, action.contentOffset);
                if (oldPrefix !== newPrefix) {
                    edits.push({ start, end: action.contentOffset, replacement: newPrefix });
                }
            } else {
                if (isBlankLine(text, start, end)) continue;
                const ws = /^[ \t]*/.exec(text.slice(start, end))![0];
                const wsCols = columnWidth(ws);
                // Lazy continuation lines (indented less than the content column) stay as written.
                if (wsCols < action.oldContentCol) continue;
                const newWs =
                    makeIndent(action.newContentCol, options.indentation) +
                    indentBeyondColumn(ws, action.oldContentCol);
                if (newWs !== ws) {
                    edits.push({ start, end: start + ws.length, replacement: newWs });
                }
            }
        }
        return edits;
    },
};

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
