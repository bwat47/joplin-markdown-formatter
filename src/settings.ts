/**
 * Joplin settings registration and typed access.
 *
 * Formatter setting keys are identical to the FormatterOptions property names
 * so loading is a straight copy with no mapping table to keep in sync.
 */

import joplin from 'api';
import { SettingItemType } from 'api/types';
import type { FormatterOptions } from './formatter';
import { DEFAULT_OPTIONS } from './formatter';

const SECTION = 'markdownFormatter';
const DISPLAY_TOAST_MESSAGES_KEY = 'displayToastMessages';
const LEGACY_ALIGN_TABLES_KEY = 'alignTables';

const OPTION_KEYS: Array<keyof FormatterOptions> = [
    'collapseBlankLines',
    'trimTrailingWhitespace',
    'ensureHeadingBlankLines',
    'normalizeHeadingMarkerSpacing',
    'removeHeadingIndentation',
    'ensureParagraphBlankLines',
    'ensureCodeBlockBlankLines',
    'setDefaultCodeBlockLanguage',
    'defaultCodeBlockLanguage',
    'ensureMathBlockBlankLines',
    'ensureTableBlankLines',
    'ensureBlockquoteBlankLines',
    'ensureListBlankLines',
    'ensureFrontmatterBlankLine',
    'normalizeHeadingLevels',
    'listSpacing',
    'indentation',
    'tableStyle',
    'emphasisMarker',
    'strongMarker',
    'doubleQuoteStyle',
    'singleQuoteStyle',
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
            options: { '-': '- (dash)', '*': '* (asterisk)', preserve: 'Preserve (leave markers unchanged)' },
            label: 'Unordered list marker',
            description:
                'Note: CommonMark treats adjacent lists with different bullets as separate lists; normalizing their markers merges them.',
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
        doubleQuoteStyle: {
            value: DEFAULT_OPTIONS.doubleQuoteStyle,
            type: SettingItemType.String,
            section: SECTION,
            public: true,
            isEnum: true,
            options: {
                preserve: 'Preserve (leave quotes unchanged)',
                straight: 'Straight ("quote")',
                smart: 'Smart (“quote”)',
            },
            label: 'Double quote style',
            description:
                'Convert double quotes in prose text. Code, math, HTML, front matter, and link titles are never changed.',
        },
        singleQuoteStyle: {
            value: DEFAULT_OPTIONS.singleQuoteStyle,
            type: SettingItemType.String,
            section: SECTION,
            public: true,
            isEnum: true,
            options: {
                preserve: 'Preserve (leave quotes unchanged)',
                straight: "Straight ('quote', don't)",
                smart: 'Smart (‘quote’, don’t)',
            },
            label: 'Single quote style',
            description:
                'Convert single quotes and apostrophes in prose text. Code, math, HTML, front matter, and link titles are never changed.',
        },
        listSpacing: {
            value: DEFAULT_OPTIONS.listSpacing,
            type: SettingItemType.String,
            section: SECTION,
            public: true,
            isEnum: true,
            options: {
                semantic: 'Semantic (keep tight/loose as authored, fix mixed spacing)',
                preserve: 'Preserve as written',
                tight: 'Tight (no blank lines between items)',
                loose: 'Loose (blank line between items)',
            },
            label: 'List spacing',
            description:
                'Semantic keeps each list tight or loose as authored and only makes mixed spacing consistent, so rendering never changes. Note: Tightening is skipped for a whole list when any item holds multi-block content (e.g. a second paragraph)',
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
        tableStyle: {
            value: DEFAULT_OPTIONS.tableStyle,
            type: SettingItemType.String,
            section: SECTION,
            public: true,
            isEnum: true,
            options: {
                preserve: 'Preserve (leave tables unchanged)',
                compact: 'Compact (one space of cell padding)',
                aligned: 'Aligned (pad cells so pipes line up)',
            },
            label: 'Table style',
            description: 'How to lay out table cells and delimiter rows.',
        },
        // Deprecated: replaced by tableStyle. Kept hidden so an existing
        // "align tables" choice can be migrated once, then reset.
        [LEGACY_ALIGN_TABLES_KEY]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION,
            public: false,
            label: 'Align table columns (deprecated)',
        },
        ensureHeadingBlankLines: {
            value: DEFAULT_OPTIONS.ensureHeadingBlankLines,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Ensure blank lines around headings',
            description: 'Add one blank line before and after headings when neighboring content exists.',
        },
        normalizeHeadingMarkerSpacing: {
            value: DEFAULT_OPTIONS.normalizeHeadingMarkerSpacing,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Normalize heading marker spacing',
            description:
                'Use one space between ATX heading markers and heading text, including optional closing markers.',
        },
        removeHeadingIndentation: {
            value: DEFAULT_OPTIONS.removeHeadingIndentation,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Remove heading indentation',
            description:
                'Move root-level ATX headings to the start of the line. Indented code and headings inside lists or blockquotes are unchanged.',
        },
        ensureParagraphBlankLines: {
            value: DEFAULT_OPTIONS.ensureParagraphBlankLines,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Ensure blank lines around paragraphs',
            description: 'Add one blank line before and after root-level paragraphs when neighboring content exists.',
        },
        ensureCodeBlockBlankLines: {
            value: DEFAULT_OPTIONS.ensureCodeBlockBlankLines,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Ensure blank lines around code blocks',
            description: 'Add one blank line before and after code blocks when neighboring content exists.',
        },
        setDefaultCodeBlockLanguage: {
            value: DEFAULT_OPTIONS.setDefaultCodeBlockLanguage,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Set default language on unlabeled code blocks',
            description:
                'Add the configured language to fenced code blocks that do not specify one. Indented code blocks are left unchanged.',
        },
        defaultCodeBlockLanguage: {
            value: DEFAULT_OPTIONS.defaultCodeBlockLanguage,
            type: SettingItemType.String,
            section: SECTION,
            public: true,
            label: 'Default code block language',
            description:
                'Language identifier to add when the default code block language rule is enabled, for example text, javascript, or bash.',
        },
        ensureMathBlockBlankLines: {
            value: DEFAULT_OPTIONS.ensureMathBlockBlankLines,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Ensure blank lines around math blocks',
            description: 'Add one blank line before and after math blocks when neighboring content exists.',
        },
        ensureTableBlankLines: {
            value: DEFAULT_OPTIONS.ensureTableBlankLines,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Ensure blank lines around tables',
            description: 'Add one blank line before and after tables when neighboring content exists.',
        },
        ensureBlockquoteBlankLines: {
            value: DEFAULT_OPTIONS.ensureBlockquoteBlankLines,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Ensure blank lines around blockquotes',
            description: 'Add one blank line before and after blockquotes when neighboring content exists.',
        },
        ensureListBlankLines: {
            value: DEFAULT_OPTIONS.ensureListBlankLines,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Ensure blank lines around lists',
            description: 'Add one blank line before and after root-level lists when neighboring content exists.',
        },
        ensureFrontmatterBlankLine: {
            value: DEFAULT_OPTIONS.ensureFrontmatterBlankLine,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Ensure blank line after front matter',
            description: 'Add one blank line between YAML front matter and following content.',
        },
        normalizeHeadingLevels: {
            value: DEFAULT_OPTIONS.normalizeHeadingLevels,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Normalize heading level increments',
            description: 'Lower skipped heading levels so headings increase by at most one level at a time.',
        },
        collapseBlankLines: {
            value: DEFAULT_OPTIONS.collapseBlankLines,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Collapse consecutive blank lines',
            description: 'Reduce runs of blank lines to a single blank line (outside code blocks).',
        },
        trimTrailingWhitespace: {
            value: DEFAULT_OPTIONS.trimTrailingWhitespace,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Trim trailing whitespace',
            description:
                'Remove trailing spaces and tabs outside protected content, preserving two-space hard line breaks.',
        },
        ensureFinalNewline: {
            value: DEFAULT_OPTIONS.ensureFinalNewline,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Ensure trailing newline',
            description: 'End the note with exactly one newline.',
        },
        [DISPLAY_TOAST_MESSAGES_KEY]: {
            value: true,
            type: SettingItemType.Bool,
            section: SECTION,
            public: true,
            label: 'Display toast messages',
            description: 'Show a toast after formatting with the number of characters added and removed.',
        },
    });

    await migrateLegacyAlignTables();
}

/** One-time migration: alignTables=true becomes tableStyle='aligned'. */
async function migrateLegacyAlignTables(): Promise<void> {
    if (await joplin.settings.value(LEGACY_ALIGN_TABLES_KEY)) {
        await joplin.settings.setValue('tableStyle', 'aligned');
        await joplin.settings.setValue(LEGACY_ALIGN_TABLES_KEY, false);
    }
}

export async function loadFormatterOptions(): Promise<FormatterOptions> {
    const values = await joplin.settings.values(OPTION_KEYS);
    return { ...DEFAULT_OPTIONS, ...(values as Partial<FormatterOptions>) };
}

export async function loadDisplayToastMessages(): Promise<boolean> {
    return Boolean(await joplin.settings.value(DISPLAY_TOAST_MESSAGES_KEY));
}
