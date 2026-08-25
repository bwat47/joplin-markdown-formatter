import { expect } from 'vitest';
import { formatMarkdown, type FormatResult } from './pipeline';
import type { FormatterOptions } from './types';

/** Format once and assert that the result is a clean fixed point on the next pass. */
export function expectIdempotent(input: string, options: Partial<FormatterOptions> = {}): FormatResult {
    const once = formatMarkdown(input, options);
    const twice = formatMarkdown(once.text, options);

    expect(twice).toEqual({ text: once.text, skippedRules: [] });
    return once;
}
