/**
 * Markdown parsing, isolated in one module so the rest of the formatter
 * depends only on the mdast tree shape, not on the parser choice.
 *
 * Extensions mirror what Joplin renders: GFM (tables, strikethrough, task
 * lists, footnotes, autolinks), YAML front matter, and display math. Syntax we
 * do not parse (e.g. ==highlight== or single-dollar inline math) lands in plain
 * text/paragraph nodes and is left untouched because rules only edit what they
 * explicitly recognize.
 */

import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { frontmatter } from 'micromark-extension-frontmatter';
import { mathFromMarkdown } from 'mdast-util-math';
import { math } from 'micromark-extension-math';
import type { Root } from 'mdast';

const mathOptions = {
    // Single-dollar inline math conflicts with ordinary price prose such as
    // `$5 *now* $10`, which should still expose emphasis and whitespace nodes.
    singleDollarTextMath: false,
};

export function parseMarkdown(text: string): Root {
    return fromMarkdown(text, {
        extensions: [gfm(), frontmatter(['yaml']), math(mathOptions)],
        mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(['yaml']), mathFromMarkdown()],
    });
}
