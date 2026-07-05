import type { Rule } from '../types';
import { listMarkers } from './listMarkers';
import { orderedListNumbers } from './orderedListNumbers';
import { thematicBreaks } from './thematicBreaks';
import { emphasisStyle } from './emphasisStyle';
import { quoteStyle } from './quoteStyle';
import { listSpacing } from './listSpacing';
import { listIndentation } from './listIndentation';
import { listBoundarySpacing } from './listBoundarySpacing';
import { tableStyle } from './tableStyle';
import { headingLevels } from './headingLevels';
import { headingSpacing } from './headingSpacing';
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
    listSpacing,
    listIndentation,
    listBoundarySpacing,
    tableStyle,
    headingLevels,
    headingSpacing,
    codeBlockSpacing,
    mathBlockSpacing,
    tableSpacing,
    blockquoteSpacing,
    frontmatterSpacing,
    collapseBlankLines,
    trimTrailingWhitespace,
    finalNewline,
];
