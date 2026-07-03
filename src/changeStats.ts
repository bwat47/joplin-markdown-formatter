import { DIFF_DELETE, DIFF_INSERT, diffCleanupEfficiency, diffMain } from 'diff-match-patch-es';

export interface CharacterChangeStats {
    added: number;
    removed: number;
}

/** Counts inserted and deleted UTF-16 code units between two text snapshots. */
export function computeCharacterChangeStats(oldText: string, newText: string): CharacterChangeStats {
    const diffs = diffMain(oldText, newText);
    diffCleanupEfficiency(diffs);

    let added = 0;
    let removed = 0;
    for (const [op, text] of diffs) {
        if (op === DIFF_INSERT) {
            added += text.length;
        } else if (op === DIFF_DELETE) {
            removed += text.length;
        }
    }

    return { added, removed };
}

function pluralize(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function formatCharacterChangeStats(stats: CharacterChangeStats): string {
    return `${pluralize(stats.added, 'character')} added, ${pluralize(stats.removed, 'character')} removed`;
}
