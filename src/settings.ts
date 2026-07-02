/**
 * Joplin settings registration and typed access.
 *
 * Setting keys are identical to the FormatterOptions property names so
 * loading is a straight copy with no mapping table to keep in sync.
 */

import joplin from 'api';
import { SettingItemType } from 'api/types';
import type { FormatterOptions } from './formatter';
import { DEFAULT_OPTIONS } from './formatter';

const SECTION = 'markdownFormatter';

const OPTION_KEYS: Array<keyof FormatterOptions> = [
    'collapseBlankLines',
    'ensureHeadingBlankLines',
    'listSpacing',
    'indentation',
    'alignTables',
    'emphasisMarker',
    'strongMarker',
    'unorderedListMarker',
    'thematicBreakMarker',
    'normalizeOrderedListNumbering',
    'ensureFinalNewline',
];

export async function registerSettings(): Promise<void> {
    await joplin.settings.registerSection(SECTION, {
        label: 'Markdown Formatter',
        iconName: 'fas fa-align-left',
        description: 'Formatting applied by the "Format Markdown" command.',
    });

    await joplin.settings.registerSettings({
        unorderedListMarker: {
            value: DEFAULT_OPTIONS.unorderedListMarker,
            type: SettingItemType.String,
            section: SECTION,
            public: true,
            isEnum: true,
            options: { '-': '- (dash)', '*': '* (asterisk)' },
            label: 'Unordered list marker',
        },
        normalizeOrderedListNumbering: {
            value: DEFAULT_OPTIONS.normalizeOrderedListNumbering,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Normalize ordered list numbering',
            description: 'Renumber ordered lists sequentially, keeping the first item’s number.',
        },
        thematicBreakMarker: {
            value: DEFAULT_OPTIONS.thematicBreakMarker,
            type: SettingItemType.String,
            section: SECTION,
            public: true,
            isEnum: true,
            options: {
                '---': '---',
                '- - -': '- - -',
                '***': '***',
                '* * *': '* * *',
            },
            label: 'Horizontal rule marker',
            description: 'Marker used for horizontal rules.',
        },
        emphasisMarker: {
            value: DEFAULT_OPTIONS.emphasisMarker,
            type: SettingItemType.String,
            section: SECTION,
            public: true,
            isEnum: true,
            options: { '*': '*emphasis*', _: '_emphasis_' },
            label: 'Emphasis (italic) marker',
        },
        strongMarker: {
            value: DEFAULT_OPTIONS.strongMarker,
            type: SettingItemType.String,
            section: SECTION,
            public: true,
            isEnum: true,
            options: { '**': '**bold**', __: '__bold__' },
            label: 'Bold marker',
        },
        listSpacing: {
            value: DEFAULT_OPTIONS.listSpacing,
            type: SettingItemType.String,
            section: SECTION,
            public: true,
            isEnum: true,
            options: {
                preserve: 'Preserve as written',
                tight: 'Tight (no blank lines between items)',
                loose: 'Loose (blank line between items)',
            },
            label: 'List spacing',
            description:
                'Note: Tightening is skipped for a whole list when any item holds multi-block content (e.g. a second paragraph)',
        },
        indentation: {
            value: DEFAULT_OPTIONS.indentation,
            type: SettingItemType.String,
            section: SECTION,
            public: true,
            isEnum: true,
            options: { tabs: 'Tabs', spaces2: '2 spaces', spaces4: '4 spaces' },
            label: 'List indentation',
            description: 'Indentation used for nested list content, applied before the list marker.',
        },
        alignTables: {
            value: DEFAULT_OPTIONS.alignTables,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Align table columns',
            description: 'Pad table cells so the pipes line up.',
        },
        ensureHeadingBlankLines: {
            value: DEFAULT_OPTIONS.ensureHeadingBlankLines,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Ensure blank lines around headings',
            description: 'Add one blank line before and after headings when neighboring content exists.',
        },
        collapseBlankLines: {
            value: DEFAULT_OPTIONS.collapseBlankLines,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Collapse consecutive blank lines',
            description: 'Reduce runs of blank lines to a single blank line (outside code blocks).',
        },
        ensureFinalNewline: {
            value: DEFAULT_OPTIONS.ensureFinalNewline,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Ensure trailing newline',
            description: 'End the note with exactly one newline.',
        },
    });
}

export async function loadFormatterOptions(): Promise<FormatterOptions> {
    const values = await joplin.settings.values(OPTION_KEYS);
    return { ...DEFAULT_OPTIONS, ...(values as Partial<FormatterOptions>) };
}
