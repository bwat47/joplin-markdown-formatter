import type { Rule } from '../types';
import { listMarkers } from './listMarkers';
import { orderedListNumbers } from './orderedListNumbers';
import { emphasisStyle } from './emphasisStyle';
import { listSpacing } from './listSpacing';
import { listIndentation } from './listIndentation';
import { alignTables } from './alignTables';
import { collapseBlankLines } from './collapseBlankLines';
import { finalNewline } from './finalNewline';

/**
 * Rules in execution order: content normalization first, then list
 * structure, then layout, whitespace cleanup after, final newline last so
 * it sees the finished document. Each rule re-parses the text, so order
 * only matters semantically (e.g. indentation runs after renumbering may
 * have changed marker widths).
 */
export const rules: Rule[] = [
    listMarkers,
    orderedListNumbers,
    emphasisStyle,
    listSpacing,
    listIndentation,
    alignTables,
    collapseBlankLines,
    finalNewline,
];
