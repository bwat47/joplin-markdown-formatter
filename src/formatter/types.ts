/**
 * Core types for the formatter.
 *
 * The formatter never re-prints the document from an AST. Instead, each rule
 * inspects the parsed tree (for context) and emits targeted string edits
 * against the original text, so any syntax a rule does not explicitly handle
 * passes through byte-for-byte.
 */

import type { Root } from 'mdast';

type ListSpacing = 'semantic' | 'tight' | 'loose' | 'preserve';
export type Indentation = 'tabs' | 'spaces2' | 'spaces4';
type EmphasisMarker = '*' | '_';
type StrongMarker = '**' | '__';
type UnorderedListMarker = '-' | '*' | 'preserve';
type ThematicBreakMarker = '---' | '- - -' | '***' | '* * *';
export type QuoteStyle = 'preserve' | 'straight' | 'smart';
type TableStyle = 'preserve' | 'compact' | 'aligned';

export interface FormatterOptions {
    /** Collapse runs of 2+ blank lines (outside code/front matter/HTML) to a single blank line. */
    collapseBlankLines: boolean;
    /** Trim trailing spaces/tabs outside protected ranges, preserving two-space hard line breaks. */
    trimTrailingWhitespace: boolean;
    /** Ensure headings have one blank line before and after neighboring content. */
    ensureHeadingBlankLines: boolean;
    /** Ensure root-level paragraphs have one blank line before and after neighboring content. */
    ensureParagraphBlankLines: boolean;
    /** Ensure code blocks have one blank line before and after neighboring content. */
    ensureCodeBlockBlankLines: boolean;
    /** Ensure math blocks have one blank line before and after neighboring content. */
    ensureMathBlockBlankLines: boolean;
    /** Ensure tables have one blank line before and after neighboring content. */
    ensureTableBlankLines: boolean;
    /** Ensure blockquotes have one blank line before and after neighboring content. */
    ensureBlockquoteBlankLines: boolean;
    /** Ensure root-level lists have one blank line before and after neighboring content. */
    ensureListBlankLines: boolean;
    /** Ensure YAML front matter has one blank line before following content. */
    ensureFrontmatterBlankLine: boolean;
    /** Lower skipped heading levels so headings increase by at most one level at a time. */
    normalizeHeadingLevels: boolean;
    /**
     * Force lists tight or loose, keep each list's authored tight/loose
     * meaning while fixing mixed spacing (semantic), or leave spacing alone.
     */
    listSpacing: ListSpacing;
    /** Indentation unit for nested list content. */
    indentation: Indentation;
    /** Table layout: leave as written, single-space cell padding (compact), or pad cells so pipes line up (aligned). */
    tableStyle: TableStyle;
    /** Marker used for emphasis (italics). */
    emphasisMarker: EmphasisMarker;
    /** Marker used for strong (bold). */
    strongMarker: StrongMarker;
    /** Double quote style in prose text: leave as written, straight ("), or smart (“ ”). */
    doubleQuoteStyle: QuoteStyle;
    /** Single quote/apostrophe style in prose text: leave as written, straight ('), or smart (‘ ’). */
    singleQuoteStyle: QuoteStyle;
    /** Marker used for unordered list items, or preserve to leave markers as written. */
    unorderedListMarker: UnorderedListMarker;
    /** Marker used for horizontal rules / thematic breaks. */
    thematicBreakMarker: ThematicBreakMarker;
    /** Renumber ordered lists sequentially. */
    normalizeOrderedListNumbering: boolean;
    /** Ensure the document ends with exactly one trailing newline. */
    ensureFinalNewline: boolean;
}

export const DEFAULT_OPTIONS: FormatterOptions = {
    collapseBlankLines: true,
    trimTrailingWhitespace: true,
    ensureHeadingBlankLines: true,
    ensureParagraphBlankLines: true,
    ensureCodeBlockBlankLines: true,
    ensureMathBlockBlankLines: true,
    ensureTableBlankLines: true,
    ensureBlockquoteBlankLines: true,
    ensureListBlankLines: true,
    ensureFrontmatterBlankLine: true,
    normalizeHeadingLevels: true,
    listSpacing: 'semantic',
    indentation: 'tabs',
    tableStyle: 'preserve',
    emphasisMarker: '*',
    strongMarker: '**',
    doubleQuoteStyle: 'preserve',
    singleQuoteStyle: 'preserve',
    unorderedListMarker: '-',
    thematicBreakMarker: '* * *',
    normalizeOrderedListNumbering: true,
    ensureFinalNewline: true,
};

/** A replacement of the half-open character range [start, end) with `replacement`. */
export interface Edit {
    start: number;
    end: number;
    replacement: string;
}

/**
 * Everything a rule gets to work with. `tree` is parsed from `text` and is
 * shared across rules while the text is unchanged — rules must treat it as
 * read-only.
 */
export interface RuleContext {
    text: string;
    tree: Root;
    options: FormatterOptions;
}

export interface Rule {
    name: string;
    isEnabled(options: FormatterOptions): boolean;
    /** Return non-overlapping edits against `context.text`. Offsets must reference the current text. */
    apply(context: RuleContext): Edit[];
}
