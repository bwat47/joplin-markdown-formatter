/**
 * Line-level diff model for the preview dialog.
 *
 * Runs diff-match-patch in "line mode" (each unique line is mapped to a single
 * character, diffed, then rehydrated), then groups the result into unified-diff
 * style hunks so an otherwise untouched note does not render hundreds of
 * unchanged rows.
 *
 * Removed and added lines that look like edits of one another are then diffed
 * again at the character level, so the changed spans can be highlighted within
 * the line: most of this formatter's edits are a single character (`*` -> `-`,
 * one space after a heading marker, a quote character), which a plain line diff
 * would render as an indistinguishable remove/add pair.
 */

import {
    DIFF_DELETE,
    DIFF_EQUAL,
    DIFF_INSERT,
    type Diff,
    diffCharsToLines,
    diffCleanupSemantic,
    diffLinesToChars,
    diffMain,
} from 'diff-match-patch-es';

type DiffLineKind = 'context' | 'add' | 'remove';

/** A run of characters within a line, flagged when it differs from its counterpart line. */
interface DiffSegment {
    text: string;
    changed: boolean;
}

export interface DiffLine {
    kind: DiffLineKind;
    /** 1-based line number in the old text; null for added lines. */
    oldNumber: number | null;
    /** 1-based line number in the new text; null for removed lines. */
    newNumber: number | null;
    segments: DiffSegment[];
    /** True when this is the final line of its text and it carries no trailing newline. */
    missingFinalNewline: boolean;
}

export interface DiffHunk {
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: DiffLine[];
}

/** Rows of unchanged text kept on each side of a change. */
const DEFAULT_CONTEXT_LINES = 3;

/**
 * How much of a line must be shared before a remove/add pair counts as one
 * edited line rather than two unrelated ones. Below it, per-character
 * highlighting is confetti rather than signal.
 */
const MIN_LINE_SIMILARITY = 0.3;

/**
 * Global alignment compares every removed line with every added line, so both
 * the number of comparisons and their cost have to stay bounded: the preview is
 * built synchronously while the user waits for the dialog.
 *
 * Cells cover the per-comparison overhead that a run of very short lines would
 * otherwise multiply out.
 */
const MAX_GLOBAL_ALIGNMENT_CELLS = 4096;

/**
 * Work covers the length-dependent half. One character diff costs roughly the
 * product of the two line lengths, so a run's total is the product of each
 * side's character count. The worst case is a run whose lines are all mutually
 * dissimilar, since that is where `diffMain` does the most work; measured at
 * this budget it stays under 200ms, and beyond it the greedy fallback stays
 * linear. Without the bound, a 64-line replacement of 300-character paragraphs
 * spends over five seconds diffing 4,032 pairs it will never use.
 */
const MAX_GLOBAL_ALIGNMENT_WORK = 4_000_000;

/** Small preference for pairing a threshold-level match instead of leaving both lines unmatched. */
const PAIRING_BONUS = 0.001;

/** A diff line plus the position it occupies on the side that does not number it. */
interface AnchoredLine extends DiffLine {
    oldAnchor: number;
    newAnchor: number;
}

interface PairComparison {
    diffs: Diff[];
    score: number;
}

type PairComparisonGetter = (removedIndex: number, addedIndex: number) => PairComparison;
type AlignmentChoice = 'pair' | 'skipRemoved' | 'skipAdded';

interface AlignedPair {
    removedIndex: number;
    addedIndex: number;
}

export function computeLineDiff(
    oldText: string,
    newText: string,
    contextLines: number = DEFAULT_CONTEXT_LINES
): DiffHunk[] {
    const lines = toDiffLines(oldText, newText);
    const hunks = groupIntoHunks(lines, Math.max(0, contextLines));
    for (const hunk of hunks) {
        highlightReplacedLines(hunk.lines);
    }
    return hunks;
}

/**
 * Splits a chunk of concatenated lines. `diffLinesToChars` keeps each line's
 * trailing newline, so the flag distinguishes a genuine last line from one that
 * simply ends the chunk.
 */
function splitLines(chunk: string): Array<{ text: string; hasNewline: boolean }> {
    const lines: Array<{ text: string; hasNewline: boolean }> = [];
    let start = 0;
    while (start < chunk.length) {
        const newline = chunk.indexOf('\n', start);
        if (newline === -1) {
            lines.push({ text: chunk.slice(start), hasNewline: false });
            break;
        }
        lines.push({ text: chunk.slice(start, newline), hasNewline: true });
        start = newline + 1;
    }
    return lines;
}

function plainSegments(text: string): DiffSegment[] {
    return [{ text, changed: false }];
}

function toDiffLines(oldText: string, newText: string): AnchoredLine[] {
    const { chars1, chars2, lineArray } = diffLinesToChars(oldText, newText);
    // `false` disables the internal line-mode pass: the input is already one
    // character per line, so the speedup would only add work.
    const diffs = diffMain(chars1, chars2, undefined, false);
    diffCharsToLines(diffs, lineArray);

    const lines: AnchoredLine[] = [];
    let oldCount = 0;
    let newCount = 0;
    for (const [op, chunk] of diffs) {
        for (const { text, hasNewline } of splitLines(chunk)) {
            const missingFinalNewline = !hasNewline;
            if (op === DIFF_EQUAL) {
                oldCount += 1;
                newCount += 1;
                lines.push({
                    kind: 'context',
                    oldNumber: oldCount,
                    newNumber: newCount,
                    oldAnchor: oldCount,
                    newAnchor: newCount,
                    segments: plainSegments(text),
                    missingFinalNewline,
                });
            } else if (op === DIFF_DELETE) {
                oldCount += 1;
                lines.push({
                    kind: 'remove',
                    oldNumber: oldCount,
                    newNumber: null,
                    oldAnchor: oldCount,
                    newAnchor: newCount + 1,
                    segments: plainSegments(text),
                    missingFinalNewline,
                });
            } else {
                newCount += 1;
                lines.push({
                    kind: 'add',
                    oldNumber: null,
                    newNumber: newCount,
                    oldAnchor: oldCount + 1,
                    newAnchor: newCount,
                    segments: plainSegments(text),
                    missingFinalNewline,
                });
            }
        }
    }
    return lines;
}

/**
 * Collects changed lines into hunks padded with `contextLines` of unchanged
 * text. Two changes separated by no more than twice the context share a hunk,
 * which is what keeps their context blocks from overlapping.
 */
function groupIntoHunks(lines: AnchoredLine[], contextLines: number): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    let index = 0;
    while (index < lines.length) {
        if (lines[index].kind === 'context') {
            index += 1;
            continue;
        }

        const start = Math.max(0, index - contextLines);
        let lastChange = index;
        let cursor = index + 1;
        while (cursor < lines.length) {
            if (lines[cursor].kind !== 'context') {
                lastChange = cursor;
                cursor += 1;
                continue;
            }
            let run = 0;
            while (cursor + run < lines.length && lines[cursor + run].kind === 'context') run += 1;
            // A long run ends the hunk; so does a run that reaches the end of
            // the document, since there is no further change to absorb.
            if (run > contextLines * 2 || cursor + run >= lines.length) break;
            cursor += run;
        }

        const end = Math.min(lines.length, lastChange + 1 + contextLines);
        hunks.push(toHunk(lines.slice(start, end)));
        index = end;
    }
    return hunks;
}

function toHunk(lines: AnchoredLine[]): DiffHunk {
    const oldCount = lines.filter((line) => line.kind !== 'add').length;
    const newCount = lines.filter((line) => line.kind !== 'remove').length;
    return {
        // A side with no lines starts at the line it follows, per the unified
        // diff convention: a note formatted away to nothing is `+0,0`, not
        // `+1,0`. The anchors hold the position *after* that line, which is
        // what a non-empty side needs.
        oldStart: oldCount === 0 ? lines[0].oldAnchor - 1 : lines[0].oldAnchor,
        oldCount,
        newStart: newCount === 0 ? lines[0].newAnchor - 1 : lines[0].newAnchor,
        newCount,
        lines,
    };
}

/**
 * Highlights within-line edits for each run of removed lines followed by added
 * ones. The runs are rarely the same length — the spacing rules insert blank
 * lines among rewritten ones — so the two sides are aligned by similarity
 * rather than by index, leaving genuinely new or deleted lines unpaired.
 */
function highlightReplacedLines(lines: DiffLine[]): void {
    let index = 0;
    while (index < lines.length) {
        if (lines[index].kind !== 'remove') {
            index += 1;
            continue;
        }

        let removeEnd = index;
        while (removeEnd < lines.length && lines[removeEnd].kind === 'remove') removeEnd += 1;
        let addEnd = removeEnd;
        while (addEnd < lines.length && lines[addEnd].kind === 'add') addEnd += 1;

        alignRuns(lines.slice(index, removeEnd), lines.slice(removeEnd, addEnd));
        index = Math.max(addEnd, removeEnd);
    }
}

function alignRuns(removed: DiffLine[], added: DiffLine[]): void {
    const getComparison = createPairComparisonGetter(removed, added);
    if (affordsGlobalAlignment(removed, added)) {
        alignRunsGlobally(removed, added, getComparison);
        return;
    }

    alignRunsGreedily(removed, added, getComparison);
}

/** True when the full matrix fits both alignment budgets. */
function affordsGlobalAlignment(removed: DiffLine[], added: DiffLine[]): boolean {
    if (removed.length * added.length > MAX_GLOBAL_ALIGNMENT_CELLS) return false;
    return totalTextLength(removed) * totalTextLength(added) <= MAX_GLOBAL_ALIGNMENT_WORK;
}

function totalTextLength(lines: DiffLine[]): number {
    let total = 0;
    for (const line of lines) {
        for (const segment of line.segments) total += segment.text.length;
    }
    return total;
}

/**
 * Finds the highest-confidence order-preserving set of line pairs across both
 * runs. This avoids committing to an early weak match when a stronger match is
 * available later, and can skip any number of inserted or deleted lines.
 */
function alignRunsGlobally(removed: DiffLine[], added: DiffLine[], getComparison: PairComparisonGetter): void {
    const choices = buildAlignmentChoices(removed.length, added.length, getComparison);
    const pairs = traceAlignedPairs(choices, removed.length, added.length);
    for (const pair of pairs) {
        applySegments(
            removed[pair.removedIndex],
            added[pair.addedIndex],
            getComparison(pair.removedIndex, pair.addedIndex).diffs
        );
    }
}

/** Builds the dynamic-programming matrix used to select non-crossing pairs. */
function buildAlignmentChoices(
    removedCount: number,
    addedCount: number,
    getComparison: PairComparisonGetter
): Array<Array<AlignmentChoice | null>> {
    const scores = Array.from({ length: removedCount + 1 }, () => Array<number>(addedCount + 1).fill(0));
    const choices = Array.from({ length: removedCount + 1 }, () =>
        Array<AlignmentChoice | null>(addedCount + 1).fill(null)
    );

    for (let i = 1; i <= removedCount; i += 1) choices[i][0] = 'skipRemoved';
    for (let j = 1; j <= addedCount; j += 1) choices[0][j] = 'skipAdded';

    for (let i = 1; i <= removedCount; i += 1) {
        for (let j = 1; j <= addedCount; j += 1) {
            let bestScore = scores[i - 1][j];
            let choice: AlignmentChoice = 'skipRemoved';

            if (scores[i][j - 1] > bestScore) {
                bestScore = scores[i][j - 1];
                choice = 'skipAdded';
            }

            const comparison = getComparison(i - 1, j - 1);
            const weight = pairingWeight(comparison.score);
            if (weight !== null) {
                const pairedScore = scores[i - 1][j - 1] + weight;
                // Prefer a pair on a tie so equally good alignments retain the
                // most useful character-level highlighting.
                if (pairedScore >= bestScore) {
                    bestScore = pairedScore;
                    choice = 'pair';
                }
            }

            scores[i][j] = bestScore;
            choices[i][j] = choice;
        }
    }

    return choices;
}

/** Walks the completed matrix backwards and returns the chosen pairs in source order. */
function traceAlignedPairs(
    choices: Array<Array<AlignmentChoice | null>>,
    removedCount: number,
    addedCount: number
): AlignedPair[] {
    let i = removedCount;
    let j = addedCount;
    const pairs: AlignedPair[] = [];
    while (i > 0 || j > 0) {
        const choice = choices[i][j];
        if (choice === 'pair') {
            pairs.push({ removedIndex: i - 1, addedIndex: j - 1 });
            i -= 1;
            j -= 1;
        } else if (choice === 'skipRemoved') {
            i -= 1;
        } else {
            j -= 1;
        }
    }

    return pairs.reverse();
}

/**
 * Strong matches are deliberately worth much more than marginal ones. This
 * keeps several coincidental weak similarities from displacing an obvious
 * counterpart later in the run.
 */
function pairingWeight(score: number): number | null {
    if (score < MIN_LINE_SIMILARITY) return null;
    const confidence = (score - MIN_LINE_SIMILARITY) / (1 - MIN_LINE_SIMILARITY);
    return confidence * confidence + PAIRING_BONUS;
}

/** Linear fallback for replacement runs too large for the global matrix. */
function alignRunsGreedily(removed: DiffLine[], added: DiffLine[], getComparison: PairComparisonGetter): void {
    let i = 0;
    let j = 0;
    while (i < removed.length && j < added.length) {
        const pair = getComparison(i, j);
        if (pair.score >= MIN_LINE_SIMILARITY) {
            applySegments(removed[i], added[j], pair.diffs);
            i += 1;
            j += 1;
            continue;
        }

        const skipAdded = j + 1 < added.length ? getComparison(i, j + 1).score : 0;
        const skipRemoved = i + 1 < removed.length ? getComparison(i + 1, j).score : 0;
        if (skipAdded >= MIN_LINE_SIMILARITY && skipAdded >= skipRemoved) {
            j += 1; // added[j] is a genuinely new line.
        } else if (skipRemoved >= MIN_LINE_SIMILARITY) {
            i += 1; // removed[i] is a genuinely deleted line.
        } else {
            i += 1; // Neither side matches; treat them as unrelated.
            j += 1;
        }
    }
}

/** Memoizes character diffs because both alignment strategies may revisit a candidate pair. */
function createPairComparisonGetter(removed: DiffLine[], added: DiffLine[]): PairComparisonGetter {
    // Keep this sparse: the large-run fallback visits only a linear number of
    // candidates and must not allocate the global matrix it is meant to avoid.
    const cache = new Map<string, PairComparison>();
    return (removedIndex: number, addedIndex: number): PairComparison => {
        const key = `${removedIndex}:${addedIndex}`;
        const cached = cache.get(key);
        if (cached) return cached;

        const comparison = comparePair(removed[removedIndex], added[addedIndex]);
        cache.set(key, comparison);
        return comparison;
    };
}

/**
 * Diffs two lines and scores how much of the longer one survived unchanged.
 * The diff is returned alongside the score so an accepted pair does not have to
 * be diffed a second time.
 */
function comparePair(removeLine: DiffLine, addLine: DiffLine): PairComparison {
    const oldText = lineText(removeLine);
    const newText = lineText(addLine);

    const longest = Math.max(oldText.length, newText.length);
    if (longest === 0) return { diffs: [], score: 1 };

    // No more than the shorter line can survive, so a pair whose lengths are
    // too lopsided cannot reach the threshold and needs no character diff. The
    // reported score is 0 rather than the true sub-threshold value, which every
    // caller treats identically; the diff is the trivial one, and nothing reads
    // it below the threshold.
    if (Math.min(oldText.length, newText.length) / longest < MIN_LINE_SIMILARITY) {
        return {
            diffs: [
                [DIFF_DELETE, oldText],
                [DIFF_INSERT, newText],
            ],
            score: 0,
        };
    }

    const diffs = diffMain(oldText, newText);
    // Also drops coincidental equalities between unrelated lines, which would
    // otherwise inflate the score.
    diffCleanupSemantic(diffs);

    let equal = 0;
    for (const [op, text] of diffs) {
        if (op === DIFF_EQUAL) equal += text.length;
    }
    return { diffs, score: equal / longest };
}

function lineText(line: DiffLine): string {
    return line.segments.map((segment) => segment.text).join('');
}

/** Splits both lines into unchanged and changed spans, per their character diff. */
function applySegments(removeLine: DiffLine, addLine: DiffLine, diffs: Diff[]): void {
    removeLine.segments = mergeSegments(
        diffs.filter(([op]) => op !== DIFF_INSERT).map(([op, text]) => ({ text, changed: op === DIFF_DELETE }))
    );
    addLine.segments = mergeSegments(
        diffs.filter(([op]) => op !== DIFF_DELETE).map(([op, text]) => ({ text, changed: op === DIFF_INSERT }))
    );
}

/** Drops empty segments and joins neighbours that share a `changed` flag. */
function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
    const merged: DiffSegment[] = [];
    for (const segment of segments) {
        if (segment.text === '') continue;
        const last = merged[merged.length - 1];
        if (last && last.changed === segment.changed) {
            last.text += segment.text;
        } else {
            merged.push({ ...segment });
        }
    }
    return merged.length > 0 ? merged : plainSegments('');
}
