/**
 * Joplin-facing half of the diff preview: owns the dialog view and turns a
 * before/after pair of note texts into an Apply/Cancel decision.
 */

import joplin from 'api';
import type { ViewHandle } from 'api/types';
import { computeCharacterChangeStats, formatCharacterChangeStats } from '../changeStats';
import logger from '../logger';
import { computeLineDiff } from './lineDiff';
import { renderDiffPreviewHtml } from './render';

const DIALOG_ID = 'markdownFormatterDiffPreview';
/** "ok" is one of Joplin's submit button IDs, so Enter applies and Escape cancels. */
const APPLY_BUTTON_ID = 'ok';

let dialogHandle: ViewHandle | null = null;

/**
 * Creates the (initially hidden) dialog view. Called once at plugin start
 * regardless of the setting, because view registration belongs to `onStart`.
 */
export async function registerDiffPreviewDialog(): Promise<void> {
    try {
        const handle = await joplin.views.dialogs.create(DIALOG_ID);
        await joplin.views.dialogs.addScript(handle, './diffPreview/styles.css');
        await joplin.views.dialogs.setButtons(handle, [
            { id: APPLY_BUTTON_ID, title: 'Apply' },
            { id: 'cancel', title: 'Cancel' },
        ]);
        // A diff needs room; fit-to-content would size the dialog to its first lines.
        await joplin.views.dialogs.setFitToContent(handle, false);
        dialogHandle = handle;
    } catch (error) {
        logger.error('Could not create the diff preview dialog.', error);
    }
}

/**
 * Shows the formatting changes and reports whether the user accepted them.
 * Throws if the dialog is unavailable, so the caller leaves the note untouched
 * rather than applying changes the user never got to review.
 */
export async function confirmFormattingChanges(
    oldText: string,
    newText: string,
    skippedRules: string[]
): Promise<boolean> {
    if (!dialogHandle) throw new Error('Diff preview dialog is not available.');

    const html = renderDiffPreviewHtml({
        hunks: computeLineDiff(oldText, newText),
        summary: formatCharacterChangeStats(computeCharacterChangeStats(oldText, newText)),
        skippedRules,
    });
    await joplin.views.dialogs.setHtml(dialogHandle, html);

    const result = await joplin.views.dialogs.open(dialogHandle);
    return result.id === APPLY_BUTTON_ID;
}
