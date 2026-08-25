import type { Edit, Rule, RuleContext } from '../types';
import { trailingWhitespaceStart } from '../lines';
import { getProtectedRanges } from '../protectedRanges';

/**
 * Ensure the document ends with exactly one trailing newline: trailing
 * blank lines and whitespace are trimmed, and a newline is appended if
 * missing. A whitespace-only document becomes empty.
 *
 * Trailing whitespace inside a protected range (e.g. an unclosed code fence
 * running to EOF) is preserved.
 */
export const finalNewline: Rule = {
    name: 'finalNewline',

    isEnabled(options) {
        return options.ensureFinalNewline;
    },

    apply({ text, tree }: RuleContext): Edit[] {
        if (text.length === 0) return [];

        // Skips back over trailing spaces, tabs, and newlines at EOF, e.g. "text \n\n" -> "text".
        let cut = trailingWhitespaceStart(text, ' \t\r\n');

        if (cut === 0) {
            // Whitespace-only document: empty it rather than leave a lone newline.
            return [{ start: 0, end: text.length, replacement: '' }];
        }

        let protectedTrailingWhitespace = false;
        for (const range of getProtectedRanges(tree)) {
            if (range.end <= cut) continue;
            protectedTrailingWhitespace = true;
            cut = Math.min(range.end, text.length);
        }

        // An open literal block can own the whitespace all the way through
        // EOF. Once it already ends in a line break, attempting to collapse
        // that content or append another newline is both unnecessary and
        // structurally unsafe, so leave it at this clean fixed point.
        if (protectedTrailingWhitespace && text.endsWith('\n')) return [];
        if (text.slice(cut) === '\n') return [];
        return [{ start: cut, end: text.length, replacement: '\n' }];
    },
};
