import type { Rule } from '../types';
import { listMarkers } from './listMarkers';
import { orderedListNumbers } from './orderedListNumbers';
import { thematicBreaks } from './thematicBreaks';
import { emphasisStyle } from './emphasisStyle';
import { quoteStyle } from './quoteStyle';
import { linkTextSpacing } from './linkTextSpacing';
import { codeBlockLanguage } from './codeBlockLanguage';
import { listSpacing } from './listSpacing';
import { listIndentation } from './listIndentation';
import { listBoundarySpacing } from './listBoundarySpacing';
import { tableStyle } from './tableStyle';
import { headingLevels } from './headingLevels';
import { headingIndentation } from './headingIndentation';
import { headingMarkerSpacing } from './headingMarkerSpacing';
import { headingSpacing } from './headingSpacing';
import { paragraphSpacing } from './paragraphSpacing';
import { codeBlockSpacing } from './codeBlockSpacing';
import { mathBlockSpacing } from './mathBlockSpacing';
import { tableSpacing } from './tableSpacing';
import { blockquoteSpacing } from './blockquoteSpacing';
import { frontmatterSpacing } from './frontmatterSpacing';
import { collapseBlankLines } from './collapseBlankLines';
import { trimTrailingWhitespace } from './trimTrailingWhitespace';
import { finalNewline } from './finalNewline';

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
    blockquoteSpacing,
    frontmatterSpacing,
    collapseBlankLines,
    trimTrailingWhitespace,
    finalNewline,
];
