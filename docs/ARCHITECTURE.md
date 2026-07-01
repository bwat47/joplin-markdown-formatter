# Architecture

A Joplin plugin that reformats/normalizes the markdown of the current note, similar to Prettier but with
configurable behavior and a strict "don't touch what you don't understand" contract.

## Core principle: parse for analysis, edit the original text

The formatter never re-prints the document from an AST (the Prettier / remark-stringify model). Instead it
follows the ESLint-fixer model:

1. Parse the markdown to an mdast tree **with source positions** (`mdast-util-from-markdown` + GFM +
   front matter extensions — matching Joplin's dialect).
2. Each rule uses the tree only to *locate* things, then emits targeted string edits
   (`{ start, end, replacement }`) against the original source text.
3. Edits are validated (in-bounds, non-overlapping) and applied.

Bytes no rule explicitly touches survive verbatim. Syntax the parser doesn't recognize (`==highlight==`,
plugin syntax, raw HTML, math) parses as plain text/paragraph nodes and passes through untouched — graceful
degradation falls out of the architecture rather than needing per-syntax handling.

## Pipeline

`formatMarkdown(text, options)` in [src/formatter/pipeline.ts](../src/formatter/pipeline.ts) runs each
enabled rule as its own **parse → analyze → edit → apply** pass. The text is re-parsed after every rule so
byte offsets are always valid; notes are small, so repeated parsing is cheap and eliminates cross-rule
offset-invalidation bugs. Within a rule, `applyEdits` rejects overlapping or out-of-bounds edits by
throwing — the plugin shell catches and keeps the original note untouched.

## Layout

```
src/
  index.ts                  Joplin plugin shell: command registration, editor.setText write-back
  logger.ts                 Prefixed console logger
  formatter/                Pure core - no Joplin imports, fully unit-testable
    index.ts                Public surface (formatMarkdown, options types)
    pipeline.ts             Rule runner
    parse.ts                Parser wrapper (isolates the mdast dependency)
    edits.ts                Edit validation + application
    types.ts                FormatterOptions, Edit, Rule interfaces
    walk.ts                 Minimal unist tree walker
    lines.ts                Line-offset helpers
    protectedRanges.ts      Source ranges of literal content (code, front matter, HTML)
    rules/                  One module per rule; ordered in rules/index.ts
    fixtures/               <case>/{input.md, expected.md, options.json?} test fixtures
```

## Rules

Each rule implements `{ name, isEnabled(options), apply(context): Edit[] }`. Current rules, in execution
order (content-level normalization first, whitespace cleanup after, final newline last):

| Rule                 | Option                  | Behavior                                                     |
| -------------------- | ----------------------- | ------------------------------------------------------------ |
| `listMarkers`        | `unorderedListMarker`   | Rewrite unordered bullets (`-`/`*`/`+`) to the configured one |
| `collapseBlankLines` | `collapseBlankLines`    | Collapse 2+ blank lines to one, outside protected ranges     |
| `finalNewline`       | `ensureFinalNewline`    | Exactly one trailing newline at EOF                          |

Planned (options already defined in `FormatterOptions`): list spacing (tight/loose/preserve), list
indentation (tabs/2/4 spaces), emphasis/strong markers, table alignment, ordered-list renumbering.

"Protected ranges" (`protectedRanges.ts`) are the source spans of literal-content nodes — fenced/indented
code, inline code, YAML front matter, HTML blocks. Whitespace-level rules skip anything overlapping them.

## Testing

Fixture-based: each directory under `src/formatter/fixtures/` holds `input.md`, `expected.md`, and an
optional `options.json` (partial `FormatterOptions`). The harness (`fixtures.test.ts`) asserts
`format(input) === expected` and **idempotency** (`format(expected) === expected`) for every case.
`edits.test.ts` unit-tests edit application. Jest runs in ESM mode (`NODE_OPTIONS=--experimental-vm-modules`)
because the mdast/micromark ecosystem is ESM-only.

## Joplin shell

The plugin registers a `formatMarkdownNote` command (Edit menu). It reads the selected note's body, runs
the pure formatter, and writes back via `joplin.commands.execute('editor.setText', ...)` only when the text
actually changed (avoids dirtying `updated_time`). Any formatter error aborts the write-back.
