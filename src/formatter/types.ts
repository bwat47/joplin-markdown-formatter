/**
 * Core types for the formatter.
 *
 * The formatter never re-prints the document from an AST. Instead, each rule
 * inspects the parsed tree (for context) and emits targeted string edits
 * against the original text, so any syntax a rule does not explicitly handle
 * passes through byte-for-byte.
 */

import type { Root } from 'mdast';

export type ListSpacing = 'tight' | 'loose' | 'preserve';
export type Indentation = 'tabs' | 'spaces2' | 'spaces4';
export type EmphasisMarker = '*' | '_';
export type StrongMarker = '**' | '__';
export type UnorderedListMarker = '-' | '*';

export interface FormatterOptions {
    /** Collapse runs of 2+ blank lines (outside code/front matter/HTML) to a single blank line. */
    collapseBlankLines: boolean;
    /** Force lists tight or loose, or leave their spacing as authored. */
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
    /** Renumber ordered lists sequentially. */
    normalizeOrderedListNumbering: boolean;
    /** Ensure the document ends with exactly one trailing newline. */
    ensureFinalNewline: boolean;
}

export const DEFAULT_OPTIONS: FormatterOptions = {
    collapseBlankLines: true,
    listSpacing: 'preserve',
    indentation: 'tabs',
    alignTables: false,
    emphasisMarker: '*',
    strongMarker: '**',
    unorderedListMarker: '-',
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
