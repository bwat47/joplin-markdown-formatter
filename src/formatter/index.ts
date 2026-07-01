/**
 * Public surface of the formatter. Everything here is pure and free of
 * Joplin imports; the plugin shell (src/index.ts) is the only place that
 * talks to the Joplin API.
 */

export { formatMarkdown } from './pipeline';
export { DEFAULT_OPTIONS } from './types';
export type { FormatterOptions, ListSpacing, Indentation } from './types';
