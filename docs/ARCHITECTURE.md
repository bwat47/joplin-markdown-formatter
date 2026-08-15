# Architecture

Joplin Markdown Formatter normalizes the current note while preserving syntax it does not explicitly understand. It is split into a pure formatting core and a thin Joplin integration layer.

## System overview

```text
Joplin command
    |
    v
Read CodeMirror buffer ---> Load settings
    |                            |
    +-----------> Formatter <----+
                     |
              optional diff preview
                     |
                     v
            guarded CodeMirror update
```

The major areas are:

- [`src/index.ts`](../src/index.ts): coordinates the Joplin command, settings, preview, notifications, and error handling.
- [`src/contentScripts/`](../src/contentScripts/): reads and updates the live CodeMirror editor buffer.
- [`src/formatter/`](../src/formatter/): pure, Joplin-independent formatting engine.
- [`src/diffPreview/`](../src/diffPreview/): computes and renders the optional review dialog.
- [`src/settings.ts`](../src/settings.ts): registers settings and maps them to formatter options.

## Formatting model

The formatter parses Markdown for analysis but edits the original source. It does not serialize the syntax tree back to Markdown.

Each formatting rule:

1. Inspects an mdast tree with source positions.
2. Produces targeted text edits against the original source.
3. Lets the pipeline validate and apply those edits.
4. Has its result parsed and structurally verified before it is accepted.

This model preserves every byte that no rule intentionally changes, including unsupported or plugin-specific syntax. It also avoids broad reformatting caused by AST serialization.

### Rule pipeline

[`formatMarkdown`](../src/formatter/pipeline.ts) runs enabled rules in a fixed order. Rules are grouped broadly as:

- content normalization, such as list markers, emphasis, quotes, and link text;
- structural formatting, such as list indentation, heading levels, and table layout;
- block spacing around headings, lists, tables, code, math, and blockquotes;
- document cleanup, such as blank lines, trailing whitespace, and the final newline.

The current rule registry and execution order live in [`src/formatter/rules/index.ts`](../src/formatter/rules/index.ts). Each rule implements the small `Rule` interface defined in [`src/formatter/types.ts`](../src/formatter/types.ts).

The document is re-parsed after an accepted change, so every rule sees a tree whose positions match the current text. This favors correctness and simple rule implementations over minimizing parse calls; Joplin notes are small enough for that tradeoff.

## Safety boundaries

Two checks prevent unsafe writes:

- [`applyEdits`](../src/formatter/edits.ts) rejects overlapping or out-of-bounds edits.
- [`verify.ts`](../src/formatter/verify.ts) compares the syntax tree before and after each rule, ignoring only the structural differences that rule is allowed to introduce.

If structural verification fails, that rule's changes are discarded and its name is returned in `FormatResult.skippedRules`. If formatting throws, the Joplin layer leaves the note unchanged.

Literal content such as code, inline code, front matter, HTML, and math is represented by protected source ranges. Whitespace-oriented rules do not edit those ranges.

Some valid Markdown constructs are intentionally left unchanged when their whitespace carries structural meaning or cannot be rewritten safely in isolation. Examples include much of the content inside blockquotes, lists inside footnotes, same-line nested list markers, ragged table rows, setext heading markers, ambiguous emphasis or quote delimiters, and the indentation characters of code, HTML, and math blocks inside list items. These constraints are enforced near the relevant rules and covered by fixtures and unit tests rather than duplicated here in implementation-level detail.

## Joplin integration

The plugin registers the `formatMarkdownNote` command and exposes it in the Edit menu and editor toolbar. On each invocation it:

1. Reads the live editor text and current settings.
2. Runs the pure formatter.
3. Optionally asks the user to review a diff.
4. Writes only when the result changed and the editor still contains the text that was formatted.

Reads and writes go through the CodeMirror content script in [`src/contentScripts/codeMirror.ts`](../src/contentScripts/codeMirror.ts). Updates are applied as a single CodeMirror transaction using changed spans, which preserves undo history and keeps the cursor and scroll position anchored where possible. The source-text comparison prevents an in-flight formatting operation from overwriting newer user edits.

## Diff preview

The optional preview remains separate from the formatter:

- [`lineDiff.ts`](../src/diffPreview/lineDiff.ts) creates contextual line hunks and character-level highlights.
- [`render.ts`](../src/diffPreview/render.ts) renders static HTML.
- [`dialog.ts`](../src/diffPreview/dialog.ts) is the Joplin-facing dialog adapter.

Applying a previewed change uses the same guarded CodeMirror write path as formatting without a preview.

## Configuration

Joplin setting keys match the properties of `FormatterOptions`. [`loadFormatterOptions`](../src/settings.ts) merges saved values with `DEFAULT_OPTIONS` on every command invocation, so setting changes take effect immediately.

Rule-specific behavior and defaults belong with the option types, settings definitions, rule implementations, and user-facing documentation. The architecture depends only on every rule exposing `name`, `isEnabled`, and `apply`.

## Testing and packaging

The formatter and diff engine are pure modules and are tested without Joplin. Formatter fixtures under [`src/formatter/fixtures/`](../src/formatter/fixtures/) assert both expected output and idempotency; focused unit tests cover edit validation, structural verification, individual rules, editor integration, and diff rendering.

The generated Joplin webpack setup builds the plugin and copies runtime assets from `src/`. [`webpack.config.override.js`](../webpack.config.override.js) excludes test files and fixtures from the packaged plugin.

## Adding a formatter rule

New rules should remain focused and source-edit based:

1. Add a module under [`src/formatter/rules/`](../src/formatter/rules/).
2. Implement the `Rule` interface and register it in the intended execution order.
3. Protect literal or structurally ambiguous regions rather than guessing.
4. Extend structural verification only for semantic differences the rule intentionally permits.
5. Add fixtures for expected output, preservation, and idempotency.
