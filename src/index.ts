import joplin from 'api';
import { ContentScriptType, MenuItemLocation } from 'api/types';
import { EDITOR_CONTENT_SCRIPT_ID, SET_NOTE_TEXT_COMMAND } from './constants';
import { formatMarkdown } from './formatter';
import logger from './logger';

joplin.plugins.register({
    onStart: async function () {
        await joplin.contentScripts.register(
            ContentScriptType.CodeMirrorPlugin,
            EDITOR_CONTENT_SCRIPT_ID,
            './contentScripts/codeMirror.js'
        );

        await joplin.commands.register({
            name: 'formatMarkdownNote',
            label: 'Format Markdown',
            execute: async () => {
                const note = await joplin.workspace.selectedNote();
                if (!note) {
                    logger.debug('No note selected; nothing to format.');
                    return;
                }

                try {
                    const formatted = formatMarkdown(note.body);
                    if (formatted === note.body) {
                        logger.debug('Note already formatted; no changes.');
                        return;
                    }
                    // Replace via the content script so the change is a normal
                    // CodeMirror transaction (undoable), not an editor reload.
                    await joplin.commands.execute('editor.execCommand', {
                        name: SET_NOTE_TEXT_COMMAND,
                        args: [formatted],
                    });
                } catch (error) {
                    logger.error('Formatting failed; note left unchanged.', error);
                }
            },
        });

        await joplin.views.menuItems.create('formatMarkdownNoteMenuItem', 'formatMarkdownNote', MenuItemLocation.Edit);

        logger.info('Plugin started.');
    },
});
