/**
 * Markdown parsing, isolated in one module so the rest of the formatter
 * depends only on the mdast tree shape, not on the parser choice.
 *
 * Extensions mirror what Joplin renders: GFM (tables, strikethrough, task
 * lists, footnotes, autolinks), YAML front matter, and display math. Syntax we
 * do not parse (e.g. ==highlight== or single-dollar inline math) lands in plain
 * text/paragraph nodes and is left untouched because rules only edit what they
 * explicitly recognize.
 *
 * A few syntax details have no mdast node at all, such as the `>` markers of
 * a blockquote or a table's delimiter row. Those are collected from the
 * parser's tokens during the same parse and returned as plain source ranges,
 * so rules never re-derive them from the text and never see a parser token.
 */

import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { frontmatter } from 'micromark-extension-frontmatter';
import { mathFromMarkdown } from 'mdast-util-math';
import { math } from 'micromark-extension-math';
// Type-only: loads the GFM table token names (`tableDelimiterRow`, ...) into
// micromark's token type map. micromark-extension-gfm bundles the table syntax
// at runtime but does not load these typings.
import type {} from 'micromark-extension-gfm-table';
import type { Root } from 'mdast';
import type { OffsetRange } from './protectedRanges';

const mathOptions = {
    // Single-dollar inline math conflicts with ordinary price prose such as
    // `$5 *now* $10`, which should still expose emphasis and whitespace nodes.
    singleDollarTextMath: false,
};

export interface ParsedMarkdown {
    tree: Root;
    /** Every `>` the parser matched as a blockquote marker, in source order. */
    blockquoteMarkers: OffsetRange[];
    /**
     * Every table delimiter row (`| --- | :-: |`), in source order: its own
     * indentation and trailing whitespace included, container prefixes
     * (list item indent) excluded.
     */
    tableDelimiterRows: OffsetRange[];
}

export function parseMarkdown(text: string): ParsedMarkdown {
    const blockquoteMarkers: OffsetRange[] = [];
    const tableDelimiterRows: OffsetRange[] = [];
    const tree = fromMarkdown(text, {
        extensions: [gfm(), frontmatter(['yaml']), math(mathOptions)],
        mdastExtensions: [
            gfmFromMarkdown(),
            frontmatterFromMarkdown(['yaml']),
            mathFromMarkdown(),
            {
                // A listener observes every token without changing how the
                // tree is built (mdast-util-from-markdown >= 2.1.0).
                afterExit(token) {
                    const range = { start: token.start.offset, end: token.end.offset };
                    if (token.type === 'blockQuoteMarker') blockquoteMarkers.push(range);
                    else if (token.type === 'tableDelimiterRow') tableDelimiterRows.push(range);
                },
            },
        ],
    });
    return { tree, blockquoteMarkers, tableDelimiterRows };
}
