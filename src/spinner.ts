/** A spinner on stderr for slow calls — only on a TTY, and never with `--json` (machines don't want control characters). */
import { boolFlag, type ParsedArgs } from "./argv.js";
import type { CliContext } from "./context.js";

const FRAMES = ["-", "\\", "|", "/"];
const INTERVAL_MS = 80;

export async function withSpinner<T>(ctx: CliContext, args: ParsedArgs, label: string, fn: () => Promise<T>): Promise<T> {
    if (!ctx.isTTY || boolFlag(args, "json")) return fn();
    let frame = 0;
    const tick = (): void => {
        ctx.stderr(`\r${FRAMES[frame % FRAMES.length]} ${label}`);
        frame++;
    };
    tick();
    const timer = setInterval(tick, INTERVAL_MS);
    try {
        return await fn();
    } finally {
        clearInterval(timer);
        ctx.stderr(`\r${" ".repeat(label.length + 2)}\r`);
    }
}
