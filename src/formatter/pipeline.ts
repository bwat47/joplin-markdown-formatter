import type { FormatterOptions } from './types';
import { DEFAULT_OPTIONS } from './types';
import { parseMarkdown } from './parse';
import { applyEdits } from './edits';
import { isStructurallyEqual } from './verify';
import { rules } from './rules';

export interface FormatResult {
    text: string;
    /** Rules whose output failed structural verification and were dropped. */
    skippedRules: string[];
}

/**
 * Format a markdown document.
 *
 * Each enabled rule runs as its own analyze -> edit pass against a tree that
 * always matches the current text: the text is re-parsed whenever a rule
 * changes it, so byte offsets are always valid against the current document.
 * Notes are small, so the repeated parses are cheap and buy us freedom from
 * cross-rule offset bookkeeping.
 *
 * Every rule's output is structurally verified before being accepted: if a
 * rule changed what the document *means* (beyond the normalizations rules
 * are allowed to make), its edits are dropped and the rule is reported in
 * `skippedRules` — a rule bug degrades to a no-op, never a corrupted note.
 *
 * Throws if a rule produces invalid (overlapping/out-of-bounds) edits;
 * callers should catch and keep the original text.
 */
export function formatMarkdown(text: string, options: Partial<FormatterOptions> = {}): FormatResult {
    const resolved: FormatterOptions = { ...DEFAULT_OPTIONS, ...options };

    let current = text;
    // The tree is reused across rules while the text is unchanged, and the
    // verification parse becomes the next rule's tree when an edit is
    // accepted, so each version of the text is parsed exactly once.
    let tree = parseMarkdown(current);
    const skippedRules: string[] = [];
    for (const rule of rules) {
        if (!rule.isEnabled(resolved)) continue;
        const edits = rule.apply({ text: current, tree, options: resolved });
        if (edits.length === 0) continue;
        const next = applyEdits(current, edits);
        if (next === current) continue;
        const nextTree = parseMarkdown(next);
        if (!isStructurallyEqual(tree, nextTree)) {
            skippedRules.push(rule.name);
            continue;
        }
        current = next;
        tree = nextTree;
    }
    return { text: current, skippedRules };
}
