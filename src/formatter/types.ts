/**
 * Core types for the formatter.
 *
 * The formatter never re-prints the document from an AST. Instead, each rule
 * inspects the parsed tree (for context) and emits targeted string edits
 * against the original text, so any syntax a rule does not explicitly handle
 * passes through byte-for-byte.
 */

import type { Root } from 'mdast';

export type ListSpacing = 'semantic' | 'tight' | 'loose' | 'preserve';
export type Indentation = 'tabs' | 'spaces2' | 'spaces4';
export type EmphasisMarker = '*' | '_';
export type StrongMarker = '**' | '__';
export type UnorderedListMarker = '-' | '*';
export type ThematicBreakMarker = '---' | '- - -' | '***' | '* * *';

export interface FormatterOptions {
    /** Collapse runs of 2+ blank lines (outside code/front matter/HTML) to a single blank line. */
    collapseBlankLines: boolean;
    /** Trim trailing spaces/tabs outside protected ranges, preserving two-space hard line breaks. */
    trimTrailingWhitespace: boolean;
    /** Ensure headings have one blank line before and after neighboring content. */
    ensureHeadingBlankLines: boolean;
    /** Ensure code blocks have one blank line before and after neighboring content. */
    ensureCodeBlockBlankLines: boolean;
    /** Lower skipped heading levels so headings increase by at most one level at a time. */
    normalizeHeadingLevels: boolean;
    /**
     * Force lists tight or loose, keep each list's authored tight/loose
     * meaning while fixing mixed spacing (semantic), or leave spacing alone.
     */
    listSpacing: ListSpacing;
    /** Indentation unit for nested list content. */
    indentation: Indentation;
    /** Pad table cells so pipes line up. */
    alignTables: boolean;
    /** Marker used for emphasis (italics). */
    emphasisMarker: EmphasisMarker;
    /** Marker used for strong (bold). */
    strongMarker: StrongMarker;
    /** Marker used for unordered list items. */
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
    ensureCodeBlockBlankLines: true,
    normalizeHeadingLevels: true,
    listSpacing: 'semantic',
    indentation: 'tabs',
    alignTables: false,
    emphasisMarker: '*',
    strongMarker: '**',
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

/** Everything a rule gets to work with. `tree` is freshly parsed from `text`. */
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
