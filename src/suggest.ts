/** "Did you mean …?" for a mistyped command or flag. */

/** Levenshtein edit distance. */
export function distance(a: string, b: string): number {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let prevDiag = row[0] ?? 0;
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const temp = row[j] ?? 0;
            row[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, temp, row[j - 1] ?? 0);
            prevDiag = temp;
        }
    }
    return row[b.length] ?? 0;
}

/** The closest candidate to `word`, if any is within `maxDistance` edits (default: generous for short words, strict for long ones). */
export function closest(word: string, candidates: readonly string[], maxDistance = Math.max(1, Math.floor(word.length / 3))): string | undefined {
    let best: string | undefined;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
        const d = distance(word, candidate);
        if (d < bestDistance) {
            bestDistance = d;
            best = candidate;
        }
    }
    return bestDistance <= maxDistance ? best : undefined;
}
