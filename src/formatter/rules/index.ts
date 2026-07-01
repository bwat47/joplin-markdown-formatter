import type { Rule } from '../types';
import { listMarkers } from './listMarkers';
import { collapseBlankLines } from './collapseBlankLines';
import { finalNewline } from './finalNewline';

/**
 * Rules in execution order: content-level normalization first, whitespace
 * cleanup after, final-newline last so it sees the finished document.
 */
export const rules: Rule[] = [listMarkers, collapseBlankLines, finalNewline];
