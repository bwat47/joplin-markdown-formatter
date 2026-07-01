import type { Edit, Rule, RuleContext } from '../types';
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

        // Matches trailing spaces, tabs, and newlines at EOF, e.g. "text \n\n" -> "text".
        const trailingWhitespace = /[ \t\r\n]+$/.exec(text);
        let cut = trailingWhitespace ? trailingWhitespace.index : text.length;

        if (cut === 0) {
            // Whitespace-only document: empty it rather than leave a lone newline.
            return [{ start: 0, end: text.length, replacement: '' }];
        }

        for (const range of getProtectedRanges(tree)) {
            if (range.end > cut) cut = Math.min(range.end, text.length);
        }

        if (text.slice(cut) === '\n') return [];
        return [{ start: cut, end: text.length, replacement: '\n' }];
    },
};
