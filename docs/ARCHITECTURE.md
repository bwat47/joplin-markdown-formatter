# Architecture

A Joplin plugin that reformats/normalizes the markdown of the current note, similar to Prettier but with configurable behavior and a strict "don't touch what you don't understand" contract.

## Core principle: parse for analysis, edit the original text

The formatter never re-prints the document from an AST (the Prettier / remark-stringify model). Instead it follows the ESLint-fixer model:

1. Parse the markdown to an mdast tree **with source positions** (`mdast-util-from-markdown` + GFM + front matter + math extensions, with ambiguous single-dollar inline math disabled).
2. Each rule uses the tree only to *locate* things, then emits targeted string edits (`{ start, end, replacement }`) against the original source text.
3. Edits are validated (in-bounds, non-overlapping) and applied.

Bytes no rule explicitly touches survive verbatim. Syntax the parser doesn't recognize (`==highlight==`, plugin syntax, raw HTML) parses as plain text/paragraph nodes and passes through untouched — graceful degradation falls out of the architecture rather than needing per-syntax handling.

## Pipeline

`formatMarkdown(text, options)` in [src/formatter/pipeline.ts](../src/formatter/pipeline.ts) runs each enabled rule as its own **analyze → edit → apply → verify** pass. The text is re-parsed whenever a rule changes it, so byte offsets are always valid (the verification parse is reused as the next rule's tree, so each version of the text is parsed exactly once); notes are small, so repeated parsing is cheap and eliminates cross-rule offset-invalidation bugs. Within a rule, `applyEdits` rejects overlapping or out-of-bounds edits by throwing — the plugin shell catches and keeps the original note untouched.

**Structural safety check** ([src/formatter/verify.ts](../src/formatter/verify.ts)): every rule's output is re-parsed and compared to the tree it started from, after normalizing away the differences rules are *allowed* to make (positions, tight/loose `spread`, adjacent bullet lists merged by marker normalization, and rule-specific metadata such as a default code block language). If a rule changed what the document means, its edits are dropped and the rule name is reported in `FormatResult.skippedRules` — a rule bug degrades to a logged no-op, never a corrupted note.

## Layout

```txt
src/
  index.ts                  Joplin plugin shell: command registration, content-script editor bridge
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

Each rule implements `{ name, isEnabled(options), apply(context): Edit[] }`. Current rules, in execution order (content normalization → list structure → layout → whitespace cleanup → final newline):

| Rule                     | Option                                                   | Behavior                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listMarkers`            | `unorderedListMarker`                                    | Rewrite unordered bullets (`-`/`*`/`+`) to the configured one; `preserve` leaves them as written                                                               |
| `orderedListNumbers`     | `normalizeOrderedListNumbering`                          | Renumber ordered lists sequentially from the first item's number                                                                                               |
| `thematicBreaks`         | `thematicBreakMarker`                                    | Rewrite horizontal rules to the configured marker with one blank line around them                                                                              |
| `emphasisStyle`          | `emphasisMarker`/`strongMarker`                          | Normalize `*`/`_` and `**`/`__` delimiters (intraword-safe)                                                                                                    |
| `quoteStyle`             | `doubleQuoteStyle`/`singleQuoteStyle`                    | Convert quotes in prose text between straight and smart styles; `preserve` (default) leaves quotes as written                                                  |
| `codeBlockLanguage`      | `setDefaultCodeBlockLanguage`/`defaultCodeBlockLanguage` | Add the configured language to fenced code blocks with no info string; disabled by default                                                                     |
| `listSpacing`            | `listSpacing`                                            | Force lists tight or loose; `semantic` (default) keeps each list's authored tight/loose meaning, only fixing mixed spacing; `preserve` leaves lists as written |
| `listIndentation`        | `indentation`                                            | Tab/2/4-space indent per level before the marker, one space after it                                                                                           |
| `listBoundarySpacing`    | `ensureListBlankLines`                                   | Ensure root-level lists have one blank line before and after them                                                                                              |
| `tableStyle`             | `tableStyle`                                             | Rebuild table cells compact (one space of padding) or aligned (pipes line up, respecting column alignment); `preserve` (default) leaves tables as written      |
| `headingIndentation`     | `removeHeadingIndentation`                               | Move root-level ATX heading markers to the start of the line                                                                                                   |
| `headingLevels`          | `normalizeHeadingLevels`                                 | Lower skipped heading levels so headings increase by at most one level                                                                                         |
| `headingMarkerSpacing`   | `normalizeHeadingMarkerSpacing`                          | Use one space between ATX heading markers and text, including closing markers                                                                                   |
| `headingSpacing`         | `ensureHeadingBlankLines`                                | Ensure headings have one blank line before and after them                                                                                                      |
| `paragraphSpacing`       | `ensureParagraphBlankLines`                              | Ensure root-level paragraphs have one blank line before and after them                                                                                         |
| `codeBlockSpacing`       | `ensureCodeBlockBlankLines`                              | Ensure code blocks have one blank line before and after them                                                                                                   |
| `mathBlockSpacing`       | `ensureMathBlockBlankLines`                              | Ensure math blocks have one blank line before and after them                                                                                                   |
| `tableSpacing`           | `ensureTableBlankLines`                                  | Ensure tables have one blank line before and after them                                                                                                        |
| `blockquoteSpacing`      | `ensureBlockquoteBlankLines`                             | Ensure blockquotes have one blank line before and after them; quote interiors are never touched                                                                |
| `frontmatterSpacing`     | `ensureFrontmatterBlankLine`                             | Ensure YAML front matter has one blank line before following content                                                                                           |
| `collapseBlankLines`     | `collapseBlankLines`                                     | Collapse 2+ blank lines to one, outside protected ranges                                                                                                       |
| `trimTrailingWhitespace` | `trimTrailingWhitespace`                                 | Trim trailing spaces/tabs outside protected ranges, preserving two-space hard breaks                                                                           |
| `finalNewline`           | `ensureFinalNewline`                                     | Exactly one trailing newline at EOF                                                                                                                            |

"Protected ranges" (`protectedRanges.ts`) are the source spans of literal-content nodes — code blocks, inline code, YAML front matter, HTML blocks, and math. Whitespace-level rules skip anything overlapping them.

### Documented limitations

- Lists inside blockquotes are exempt from `listIndentation`, `listSpacing`, and `listBoundarySpacing` (the `>` prefix makes leading-whitespace rewriting ambiguous); marker and numbering normalization still apply there. Tables inside blockquotes are exempt from `tableStyle`. Heading, paragraph, code-block, math-block, table, and blockquote spacing are also skipped inside blockquotes, where ordinary blank lines would split the quote. `blockquoteSpacing` only spaces a quote's outer boundaries: nesting changes inside a quote (e.g. `>` jumping to `>>>`) and lazy continuation lines belong to the same blockquote node, and rewriting them would change rendering. Lists inside footnote definitions are not reindented or spaced around. Nested lists and list item paragraphs are not spaced around separately because those blank lines can change tight/loose rendering inside the parent list.
- Emphasis conversion toward `_` skips intraword delimiters and delimiters that would merge with adjacent runs — CommonMark forbids or reinterprets those; the nodes are left as written.
- Smart quote conversion decides opening vs. closing from adjacent characters (SmartyPants-style heuristics), which can pick the wrong direction in unusual constructs (e.g. a quotation opening with punctuation). Backslash-escaped quotes are left as written because rewriting the quote character would turn the escape into a literal backslash. Quotes in image alt text and link titles are not converted (they are node properties, not `text` nodes).

## Settings

[src/settings.ts](../src/settings.ts) registers one Joplin settings section whose keys are identical to the `FormatterOptions` property names; `loadFormatterOptions()` merges saved values over `DEFAULT_OPTIONS`. The command loads settings on every run, so changes apply immediately.

## Testing

Fixture-based: each directory under `src/formatter/fixtures/` holds `input.md`, `expected.md`, and an optional `options.json` (partial `FormatterOptions`). The harness (`fixtures.test.ts`) asserts `format(input) === expected` and **idempotency** (`format(expected) === expected`) for every case. `edits.test.ts` unit-tests edit application. Vitest runs the TypeScript/ESM test suite directly.

## Packaging

The generated Joplin webpack scaffold copies non-TypeScript files from `src/` into `dist/`, which is useful for real plugin assets such as `manifest.json` and content-script resources. Test-only assets are excluded by [webpack.config.override.js](../webpack.config.override.js), which appends ignore patterns for fixtures and test files to the generated `CopyPlugin` configuration. The main `webpack.config.js` only contains a small hook to load that override so framework updates are easier to re-apply.

## Joplin shell

The plugin registers a `formatMarkdownNote` command (Edit menu). It reads the live CodeMirror editor text through the content script, runs the pure formatter, and writes back only when the text actually changed (avoids dirtying `updated_time`). Any formatter error aborts the write-back.

The write-back goes through a CodeMirror 6 content script ([src/contentScripts/codeMirror.ts](../src/contentScripts/codeMirror.ts)) rather than the built-in `editor.setText` command: `setText` reloads the editor content, which wipes the undo history. The content script registers `markdownFormatter__getNoteText` and `markdownFormatter__setNoteText` editor commands (invoked from the main plugin via `editor.execCommand`). The setter receives the text that was formatted plus the replacement text and dispatches only if the editor still matches that source text, avoiding stale buffer overwrites if the user types while formatting is in flight. The replacement is a normal CodeMirror transaction — undoable with Ctrl+Z — and uses `diff-match-patch-es` to replace only the changed spans in a single dispatch, which also keeps the cursor and scroll position anchored to unchanged text.
