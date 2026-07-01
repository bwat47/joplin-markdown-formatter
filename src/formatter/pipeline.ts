import type { FormatterOptions } from './types';
import { DEFAULT_OPTIONS } from './types';
import { parseMarkdown } from './parse';
import { applyEdits } from './edits';
import { rules } from './rules';

/**
 * Format a markdown document.
 *
 * Each enabled rule runs as its own parse -> analyze -> edit pass: the text
 * is re-parsed after every rule so byte offsets are always valid against the
 * current document. Notes are small, so the repeated parses are cheap and
 * buy us freedom from cross-rule offset bookkeeping.
 *
 * Throws if a rule produces invalid edits; callers should catch and keep the
 * original text.
 */
export function formatMarkdown(text: string, options: Partial<FormatterOptions> = {}): string {
    const resolved: FormatterOptions = { ...DEFAULT_OPTIONS, ...options };

    let current = text;
    for (const rule of rules) {
        if (!rule.isEnabled(resolved)) continue;
        const tree = parseMarkdown(current);
        const edits = rule.apply({ text: current, tree, options: resolved });
        if (edits.length > 0) {
            current = applyEdits(current, edits);
        }
    }
    return current;
}
