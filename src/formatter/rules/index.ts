import type { Rule } from '../types';
import { blockquoteMarkerSpacing } from './blockquoteMarkerSpacing';
import { blockquoteSpacing } from './blockquoteSpacing';
import { codeBlockLanguage } from './codeBlockLanguage';
import { codeBlockSpacing } from './codeBlockSpacing';
import { collapseBlankLines } from './collapseBlankLines';
import { emphasisStyle } from './emphasisStyle';
import { finalNewline } from './finalNewline';
import { frontmatterSpacing } from './frontmatterSpacing';
import { headingIndentation } from './headingIndentation';
import { headingLevels } from './headingLevels';
import { headingMarkerSpacing } from './headingMarkerSpacing';
import { headingSpacing } from './headingSpacing';
import { leadingBlankLines } from './leadingBlankLines';
import { linkTextSpacing } from './linkTextSpacing';
import { listBoundarySpacing } from './listBoundarySpacing';
import { listIndentation } from './listIndentation';
import { listMarkers } from './listMarkers';
import { listSpacing } from './listSpacing';
import { mathBlockSpacing } from './mathBlockSpacing';
import { orderedListNumbers } from './orderedListNumbers';
import { paragraphSpacing } from './paragraphSpacing';
import { quoteStyle } from './quoteStyle';
import { tableSpacing } from './tableSpacing';
import { tableStyle } from './tableStyle';
import { thematicBreaks } from './thematicBreaks';
import { trimTrailingWhitespace } from './trimTrailingWhitespace';

/**
 * Rules in execution order: content normalization first, then list
 * structure, then layout, whitespace cleanup after, final newline last so
 * it sees the finished document. Each rule sees a tree parsed from the
 * current text, so order only matters semantically (e.g. indentation runs
 * after renumbering may have changed marker widths).
 */
export const rules: Rule[] = [
    listMarkers,
    orderedListNumbers,
    thematicBreaks,
    emphasisStyle,
    quoteStyle,
    linkTextSpacing,
    codeBlockLanguage,
    listSpacing,
    listIndentation,
    listBoundarySpacing,
    tableStyle,
    headingIndentation,
    headingLevels,
    headingMarkerSpacing,
    headingSpacing,
    paragraphSpacing,
    codeBlockSpacing,
    mathBlockSpacing,
    tableSpacing,
    blockquoteMarkerSpacing,
    blockquoteSpacing,
    frontmatterSpacing,
    leadingBlankLines,
    collapseBlankLines,
    trimTrailingWhitespace,
    finalNewline,
];
