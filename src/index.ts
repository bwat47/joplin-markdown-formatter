import joplin from 'api';
import { MenuItemLocation } from 'api/types';
import { formatMarkdown } from './formatter';
import logger from './logger';

joplin.plugins.register({
    onStart: async function () {
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
                    await joplin.commands.execute('editor.setText', formatted);
                } catch (error) {
                    logger.error('Formatting failed; note left unchanged.', error);
                }
            },
        });

        await joplin.views.menuItems.create('formatMarkdownNoteMenuItem', 'formatMarkdownNote', MenuItemLocation.Edit);

        logger.info('Plugin started.');
    },
});
