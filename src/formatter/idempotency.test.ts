import { formatMarkdown } from './pipeline';
import type { FormatterOptions, Indentation } from './types';

interface NamedSource {
    name: string;
    source: string;
}

interface Container {
    name: string;
    render(block: string, separator: string): string;
}

const blocks: NamedSource[] = [
    { name: 'heading', source: '###   Heading' },
    { name: 'fenced code', source: '```\nconst value = 1;\n```' },
    { name: 'math', source: '$$\nx + y\n$$' },
    { name: 'table', source: '| a|b |\n|---|:---:|\n| one|two |' },
    { name: 'blockquote', source: '>   quoted\n>>nested' },
    { name: 'unordered list', source: '* child\n* sibling' },
    { name: 'ordered list', source: '4. child\n9. sibling' },
    {
        name: 'multiline link paragraph',
        source: '[ **nested**  \n text ](https://example.com/) trailing text',
    },
];

function indent(source: string, prefix: string): string {
    return source
        .split('\n')
        .map((line) => (line.length > 0 ? `${prefix}${line}` : ''))
        .join('\n');
}

function quote(source: string): string {
    return source
        .split('\n')
        .map((line) => (line.length > 0 ? `> ${line}` : '>'))
        .join('\n');
}

const containers: Container[] = [
    {
        name: 'document root',
        render: (block, separator) => `Before${separator}${block}${separator}After`,
    },
    {
        name: 'blockquote',
        render: (block, separator) => quote(`Before${separator}${block}${separator}After`),
    },
    {
        name: 'list item',
        render: (block, separator) => `- Before${separator}${indent(block, '\t')}${separator}\tAfter\n- sibling item`,
    },
    {
        name: 'nested list item',
        render: (block, separator) =>
            `- outer\n\t- Before${separator}${indent(block, '\t\t')}${separator}\t\tAfter\n\t- sibling item`,
    },
];

const separators: NamedSource[] = [
    { name: 'adjacent lines', source: '\n' },
    { name: 'one blank line', source: '\n\n' },
    { name: 'extra blank lines', source: '\n\n\n' },
];

const indentationModes: Indentation[] = ['tabs', 'spaces2', 'spaces4'];
const listSpacingModes: FormatterOptions['listSpacing'][] = ['semantic', 'tight', 'loose', 'preserve'];

interface InteractionCase {
    name: string;
    container: string;
    block: string;
    separator: string;
    input: string;
    options: Pick<FormatterOptions, 'indentation' | 'listSpacing'>;
}

const interactionCases: InteractionCase[] = [];
for (const container of containers) {
    for (const block of blocks) {
        for (const separator of separators) {
            for (const indentation of indentationModes) {
                for (const listSpacing of listSpacingModes) {
                    interactionCases.push({
                        name: `${container.name} / ${block.name} / ${separator.name} / ${indentation} / ${listSpacing}`,
                        container: container.name,
                        block: block.name,
                        separator: separator.name,
                        input: container.render(block.source, separator.source),
                        options: { indentation, listSpacing },
                    });
                }
            }
        }
    }
}

/**
 * Rules these inputs are known to lose to the structural safety check.
 *
 * A nested unordered list separated from its item's paragraph by a blank line
 * makes `listIndentation` propose edits the check rejects in `spaces2` mode,
 * so the whole rule is dropped and the item keeps the indentation it was
 * written with. Output is still stable, which is why plain idempotency misses
 * it. Asserted as an exact set rather than ignored, so this fails loudly when
 * the gap is closed or when it spreads to another combination.
 */
function knownSkippedRules({ container, block, separator, options }: InteractionCase): string[] {
    const inListItem = container === 'list item' || container === 'nested list item';
    const blankLineSeparated = separator !== 'adjacent lines';

    if (inListItem && block === 'unordered list' && blankLineSeparated && options.indentation === 'spaces2') {
        return ['listIndentation'];
    }
    return [];
}

describe('generated formatter interactions', () => {
    test.each(interactionCases)('$name', (interaction) => {
        const { input, options } = interaction;
        const expectedSkips = knownSkippedRules(interaction);

        const once = formatMarkdown(input, options);
        const twice = formatMarkdown(once.text, options);

        expect(once.skippedRules).toEqual(expectedSkips);
        expect(twice).toEqual({ text: once.text, skippedRules: expectedSkips });
    });
});
