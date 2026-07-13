import type { Table, TableRow } from 'mdast';
import type { AlignType } from 'mdast';
import type { Node } from 'unist';
import type { Edit, Rule, RuleContext } from '../types';
import { walkWithAncestors } from '../walk';
import { computeLineStarts, lineIndexOfOffset } from '../lines';

/**
 * Rebuild table rows in canonical `| a | b |` form, and the delimiter row to
 * match. Cell text is taken verbatim from the source (so inline code,
 * escaped pipes etc. survive). In `aligned` style cells are padded per
 * column alignment (right/center columns pad on the left/both sides) so the
 * pipes line up; in `compact` style cells keep a single space of padding and
 * delimiter cells always use three dashes. Alignment colons are preserved
 * in both styles.
 *
 * Rows are replaced from their own start offset, so tables indented inside
 * list items keep their indentation. Tables inside blockquotes are skipped
 * (the delimiter row has no AST node, and rewriting around `>` prefixes is
 * not worth the risk). Column widths count UTF-16 code units.
 */
export const tableStyle: Rule = {
    name: 'tableStyle',

    isEnabled(options) {
        return options.tableStyle !== 'preserve';
    },

    apply({ text, tree, options }: RuleContext): Edit[] {
        const edits: Edit[] = [];
        const lineStarts = computeLineStarts(text);
        const lineEnd = (i: number): number => lineStarts[i + 1] ?? text.length;

        walkWithAncestors(tree, (node: Node, ancestors: Node[]) => {
            if (node.type !== 'table') return;
            if (ancestors.some((ancestor) => ancestor.type === 'blockquote')) return;
            const table = node as Table;
            const rows = table.children;
            if (rows.length === 0) return;

            const cellTexts = rows.map((row) => row.children.map((cell) => extractCellText(text, cell)));
            // Excess cells beyond the header are kept by the parser; keep them here too.
            const columnCount = Math.max(table.align?.length ?? 0, ...cellTexts.map((cells) => cells.length));
            const align: AlignType[] = Array.from({ length: columnCount }, (_, i) => table.align?.[i] ?? null);

            // Compact style never pads cells (width 0 is a no-op for pad())
            // and always uses three dashes plus alignment colons.
            const compact = options.tableStyle === 'compact';
            const widths = align.map((_, col) =>
                compact ? 0 : Math.max(3, ...cellTexts.map((cells) => (cells[col] ?? '').length))
            );

            const renderRow = (cells: string[]): string =>
                '| ' + align.map((a, col) => pad(cells[col] ?? '', widths[col], a)).join(' | ') + ' |';

            // The delimiter row has no AST node; it is the line after the header row.
            const headerEnd = rows[0].position?.end?.offset;
            if (headerEnd === undefined) return;
            const delimiterLine = lineIndexOfOffset(lineStarts, headerEnd) + 1;
            const delimiterStart = lineStarts[delimiterLine];
            const delimiterText = text.slice(delimiterStart, lineEnd(delimiterLine));
            const delimiterMatch = /^([ \t]*)([|: \t-]+?)\r?\n?$/.exec(delimiterText);
            if (!delimiterMatch) return;

            for (const row of rows) {
                const start = row.position?.start?.offset;
                const end = row.position?.end?.offset;
                if (start === undefined || end === undefined) return;
                const replacement = renderRow(cellTexts[rows.indexOf(row)]);
                if (text.slice(start, end) !== replacement) {
                    edits.push({ start, end, replacement });
                }
            }

            const delimiterRow =
                '| ' +
                align.map((a, col) => (compact ? compactDelimiterCell(a) : delimiterCell(widths[col], a))).join(' | ') +
                ' |';
            const start = delimiterStart + delimiterMatch[1].length;
            const end = start + delimiterMatch[2].length;
            if (text.slice(start, end) !== delimiterRow) {
                edits.push({ start, end, replacement: delimiterRow });
            }
        });

        return edits;
    },
};

/** Cell source text with the boundary pipes and surrounding whitespace stripped. */
function extractCellText(text: string, cell: TableRow['children'][number]): string {
    const start = cell.position?.start?.offset;
    const end = cell.position?.end?.offset;
    if (start === undefined || end === undefined) return '';
    let raw = text.slice(start, end);
    if (raw.startsWith('|')) raw = raw.slice(1);
    // A last cell's range extends over trailing whitespace after the closing
    // pipe; drop it so an unescaped pipe is still recognized as a boundary.
    raw = raw.replace(/[ \t]+$/, '');
    if (raw.endsWith('|') && !isEscapedPipe(raw, raw.length - 1)) {
        raw = raw.slice(0, -1);
    }
    return raw.trim();
}

function isEscapedPipe(text: string, pipeIndex: number): boolean {
    let slashCount = 0;
    for (let i = pipeIndex - 1; i >= 0 && text[i] === '\\'; i--) {
        slashCount++;
    }
    return slashCount % 2 === 1;
}

function pad(value: string, width: number, align: AlignType): string {
    const total = Math.max(width - value.length, 0);
    if (align === 'right') return ' '.repeat(total) + value;
    if (align === 'center') {
        const left = Math.floor(total / 2);
        return ' '.repeat(left) + value + ' '.repeat(total - left);
    }
    return value + ' '.repeat(total);
}

function delimiterCell(width: number, align: AlignType): string {
    if (align === 'left') return ':' + '-'.repeat(width - 1);
    if (align === 'right') return '-'.repeat(width - 1) + ':';
    if (align === 'center') return ':' + '-'.repeat(width - 2) + ':';
    return '-'.repeat(width);
}

/** Compact delimiter cells always use three dashes, with alignment colons outside them. */
function compactDelimiterCell(align: AlignType): string {
    if (align === 'left') return ':---';
    if (align === 'right') return '---:';
    if (align === 'center') return ':---:';
    return '---';
}
