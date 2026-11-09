/**
 * Minimal ANSI colors. No dependency: a handful of codes is simpler than a
 * library, and `enabled` is threaded through explicitly (never a global)
 * so output stays pure and testable.
 */
import { boolFlag, type ParsedArgs } from "./argv.js";
import type { CliContext } from "./context.js";

export interface Colors {
    readonly enabled: boolean;
    red(s: string): string;
    green(s: string): string;
    yellow(s: string): string;
    cyan(s: string): string;
    gray(s: string): string;
    bold(s: string): string;
}

const CODES = { red: 31, green: 32, yellow: 33, cyan: 36, gray: 90, bold: 1 } as const;

function paint(code: number, enabled: boolean): (s: string) => string {
    return enabled ? (s) => `\u001b[${code}m${s}\u001b[0m` : (s) => s;
}

export function makeColors(enabled: boolean): Colors {
    return {
        enabled,
        red: paint(CODES.red, enabled),
        green: paint(CODES.green, enabled),
        yellow: paint(CODES.yellow, enabled),
        cyan: paint(CODES.cyan, enabled),
        gray: paint(CODES.gray, enabled),
        bold: paint(CODES.bold, enabled),
    };
}

export const NO_COLORS: Colors = makeColors(false);

/** TTY, no `NO_COLOR`/`--no-color`, and never for `--json` (machines don't want escape codes). */
export function shouldColor(ctx: CliContext, args: ParsedArgs): boolean {
    if (boolFlag(args, "json")) return false;
    if (boolFlag(args, "no-color")) return false;
    if (ctx.env.NO_COLOR !== undefined && ctx.env.NO_COLOR !== "") return false;
    return ctx.isTTY;
}

const GOOD = new Set(["LISTED", "PAID", "DELIVERED", "SUCCEEDED", "COMPLETED", "ACTIVE", "OK", "true"]);
const BAD = new Set(["FAILED", "CANCELLED", "REFUNDED", "DELISTED", "ERROR", "INACTIVE", "false"]);
const WARN = new Set(["PENDING", "PURCHASED", "SHIPPED", "QUEUED", "RUNNING", "CLAIMED", "ASSIGNED", "DISMISSED"]);

/** Color a status-like word (job/sale/listing/lead status, booleans, "ok"/"error"). */
export function paintStatus(colors: Colors, value: string): string {
    const v = value.toUpperCase();
    if (GOOD.has(v) || GOOD.has(value)) return colors.green(value);
    if (BAD.has(v) || BAD.has(value)) return colors.red(value);
    if (WARN.has(v)) return colors.yellow(value);
    return value;
}

/** Color a profit/spread-like amount: green when non-negative, red when it eats margin. */
export function paintSigned(colors: Colors, amount: number, text: string): string {
    return amount < 0 ? colors.red(text) : colors.green(text);
}
