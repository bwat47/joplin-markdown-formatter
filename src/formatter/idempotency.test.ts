import { expectIdempotent } from './testUtils';
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
                        input: container.render(block.source, separator.source),
                        options: { indentation, listSpacing },
                    });
                }
            }
        }
    }
}

describe('generated formatter interactions', () => {
    // No combination may lose a rule to the structural safety check: a rule
    // that silently drops leaves the note half-formatted, and the stable
    // output that follows hides it from a plain idempotency check.
    test.each(interactionCases)('$name', ({ input, options }) => {
        expect(expectIdempotent(input, options).skippedRules).toEqual([]);
    });
});
