/** `--watch`: re-run something on an interval, like the Unix `watch` command. */
import type { CliContext } from "./context.js";

export interface WatchOptions {
    intervalMs: number;
    /** Stop after this many ticks. Only ever set in tests — real usage runs until the process is stopped (Ctrl+C). */
    maxIterations?: number;
}

export async function watchLoop(ctx: CliContext, opts: WatchOptions, tick: () => Promise<void>): Promise<void> {
    for (let i = 0; opts.maxIterations === undefined || i < opts.maxIterations; i++) {
        await tick();
        if (opts.maxIterations !== undefined && i + 1 >= opts.maxIterations) return;
        await ctx.sleep(opts.intervalMs);
    }
}
