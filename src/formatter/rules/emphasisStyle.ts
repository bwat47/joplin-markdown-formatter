import type { Edit, Rule, RuleContext } from '../types';
import { walk } from '../walk';

/** Letter or number in any script — used for CommonMark intraword checks. */
const isWordChar = (ch: string | undefined): boolean => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

/**
 * Normalize emphasis (`*`/`_`) and strong (`**`/`__`) delimiters to the
 * configured markers. Markers sit at the node's boundary offsets (1 char for
 * emphasis, 2 for strong); nested cases like `***both***` yield
 * non-overlapping boundary edits.
 *
 * Skipped conversions (node left as written):
 * - Toward underscore when the delimiter is intraword (`a*b*c`): CommonMark
 *   forbids intraword `_`, so converting would break rendering.
 * - When a character adjacent to a delimiter already equals the target
 *   marker char: the runs would merge (e.g. `*_x_*` -> `__x__` turns nested
 *   emphasis into strong).
 */
export const emphasisStyle: Rule = {
    name: 'emphasisStyle',

    isEnabled() {
        return true;
    },

    apply({ text, tree, options }: RuleContext): Edit[] {
        const edits: Edit[] = [];

        walk(tree, (node) => {
            if (node.type !== 'emphasis' && node.type !== 'strong') return;
            const target = node.type === 'strong' ? options.strongMarker : options.emphasisMarker;
            const width = target.length;
            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (start === undefined || end === undefined) return;

            const opening = text.slice(start, start + width);
            const closing = text.slice(end - width, end);
            if (!/^[*_]+$/.test(opening) || !/^[*_]+$/.test(closing)) return;
            if (opening === target && closing === target) return;

            const targetChar = target[0];
            if (targetChar === '_' && (isWordChar(text[start - 1]) || isWordChar(text[end]))) return;

            const adjacent = [text[start - 1], text[start + width], text[end - width - 1], text[end]];
            if (adjacent.includes(targetChar)) return;

            if (opening !== target) edits.push({ start, end: start + width, replacement: target });
            if (closing !== target) edits.push({ start: end - width, end, replacement: target });
        });

        return edits;
    },
};
