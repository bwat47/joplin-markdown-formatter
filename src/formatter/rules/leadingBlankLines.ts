import type { Edit, Rule, RuleContext } from '../types';

/** A front matter opening fence line, e.g. "---\n" or "---  \r\n". */
const FRONTMATTER_FENCE = /^---[ \t]*(?:\r?\n|$)/;

/**
 * Remove blank lines at the start of the document so it begins with content
 * (or front matter).
 *
 * Only whole lines are removed: the cut ends at the last line break in the
 * leading whitespace run, so indentation on the first content line survives,
 * e.g. "\n \n    code" -> "    code" keeps the indented code block intact.
 *
 * A `---` line after the blank lines is left alone: front matter is only
 * recognized on the first line, so removing the blank lines would turn a
 * thematic break and the text after it into YAML front matter.
 */
export const leadingBlankLines: Rule = {
    name: 'leadingBlankLines',

    isEnabled(options) {
        return options.removeLeadingBlankLines;
    },

    apply({ text }: RuleContext): Edit[] {
        // End of the leading run of spaces, tabs, and newlines, e.g. "\n\n  text" -> 2 + 2.
        let runEnd = 0;
        while (runEnd < text.length && ' \t\r\n'.includes(text[runEnd])) runEnd++;

        const cut = text.lastIndexOf('\n', runEnd - 1) + 1;
        if (cut === 0 || FRONTMATTER_FENCE.test(text.slice(cut))) return [];
        return [{ start: 0, end: cut, replacement: '' }];
    },
};
