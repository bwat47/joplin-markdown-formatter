import { computeCharacterChangeStats, formatCharacterChangeStats } from './changeStats';
import { formatMarkdown } from './formatter';
import type { FormatterOptions } from './formatter';

interface CommandLogger {
    debug(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}

interface CommandToast {
    message: string;
    type: 'info' | 'success';
}

export interface FormatNoteCommandDependencies {
    readEditorText(): Promise<unknown>;
    writeEditorText(expectedText: string, formattedText: string): Promise<unknown>;
    loadFormatterOptions(): Promise<FormatterOptions>;
    loadDisplayToastMessages(): Promise<boolean>;
    loadShowDiffPreview(): Promise<boolean>;
    confirmChanges(oldText: string, newText: string, skippedRules: string[]): Promise<boolean>;
    showToast(toast: CommandToast): Promise<void>;
    logger: CommandLogger;
}

/** Format the live editor text and apply it only if the editor still matches. */
export async function executeFormatMarkdownNote(dependencies: FormatNoteCommandDependencies): Promise<void> {
    const {
        readEditorText,
        writeEditorText,
        loadFormatterOptions,
        loadDisplayToastMessages,
        loadShowDiffPreview,
        confirmChanges,
        showToast,
        logger,
    } = dependencies;

    try {
        const currentText = await readEditorText();
        if (typeof currentText !== 'string') {
            logger.warn('Could not read editor text; formatting skipped.');
            return;
        }

        const [options, displayToastMessages, showDiffPreview] = await Promise.all([
            loadFormatterOptions(),
            loadDisplayToastMessages(),
            loadShowDiffPreview(),
        ]);
        const result = formatMarkdown(currentText, options);
        if (result.skippedRules.length > 0) {
            logger.warn('Rules skipped by the structural safety check:', result.skippedRules.join(', '));
        }
        if (result.text === currentText) {
            logger.debug('Note already formatted; no changes.');
            if (displayToastMessages) {
                await showToast({ message: 'No formatting changes needed.', type: 'info' });
            }
            return;
        }
        if (showDiffPreview) {
            const confirmed = await confirmChanges(currentText, result.text, result.skippedRules);
            if (!confirmed) {
                logger.debug('Formatting cancelled from the diff preview.');
                return;
            }
        }

        const didUpdate = await writeEditorText(currentText, result.text);
        if (didUpdate !== true) {
            logger.warn('Editor text changed before formatted text could be applied; write skipped.');
            return;
        }
        if (displayToastMessages) {
            const stats = computeCharacterChangeStats(currentText, result.text);
            await showToast({
                message: `Markdown formatted. ${formatCharacterChangeStats(stats)}.`,
                type: 'success',
            });
        }
    } catch (error) {
        logger.error('Formatting failed; note left unchanged.', error);
    }
}
