import type { Code } from 'mdast';
import type { Edit, Rule, RuleContext } from '../types';
import { computeLineStarts, lineIndexOfOffset } from '../lines';
import { walk } from '../walk';

/**
 * Add a default language to fenced code blocks with an empty info string.
 * Indented code blocks are left alone because adding a language would require
 * changing the block style, not just filling in missing fence metadata.
 */
export const codeBlockLanguage: Rule = {
    name: 'codeBlockLanguage',

    isEnabled(options) {
        return options.setDefaultCodeBlockLanguage && normalizeLanguage(options.defaultCodeBlockLanguage) !== '';
    },

    apply({ text, tree, options }: RuleContext): Edit[] {
        const language = normalizeLanguage(options.defaultCodeBlockLanguage);
        if (language === '') return [];

        const edits: Edit[] = [];
        const lineStarts = computeLineStarts(text);
        const lineEnd = (i: number): number => lineStarts[i + 1] ?? text.length;

        walk(tree, (node) => {
            if (node.type !== 'code') return;

            const code = node as Code;
            if (code.lang) return;

            const start = code.position?.start?.offset;
            if (start === undefined) return;

            const lineIndex = lineIndexOfOffset(lineStarts, start);
            const openingLine = text.slice(start, lineEnd(lineIndex));
            const match = /^([ \t]{0,3})(`{3,}|~{3,})([ \t]*)(\r?\n|$)/.exec(openingLine);
            if (!match) return;

            const fenceEnd = start + match[1].length + match[2].length;
            const infoEnd = fenceEnd + match[3].length;
            edits.push({ start: fenceEnd, end: infoEnd, replacement: language });
        });

        return edits;
    },
};

function normalizeLanguage(language: string): string {
    const trimmed = language.trim();
    if (/[\s`]/.test(trimmed)) return '';
    return trimmed;
}
