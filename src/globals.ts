/** Flags every command understands, and the shared output step. */
import type { OperationInfo } from "@horusship/sdk/catalog";
import { boolFlag, stringFlag, type ParsedArgs } from "./argv.js";
import { makeColors, shouldColor } from "./colors.js";
import type { CliContext } from "./context.js";
import { renderHuman, toJson } from "./output.js";
import { UsageError } from "./params.js";
import { applyRenderHints } from "./render-hints.js";
import type { SessionOptions } from "./session.js";

export const GLOBAL_BOOLEANS: ReadonlySet<string> = new Set(["json", "all", "wait", "watch", "help", "version", "no-color"]);
export const GLOBAL_FLAG_NAMES: ReadonlySet<string> = new Set([
    ...GLOBAL_BOOLEANS, "wait-timeout", "wait-interval", "watch-interval", "watch-count", "data", "idempotency-key", "profile", "base-url", "timeout",
]);

export function sessionOptions(args: ParsedArgs): SessionOptions {
    const opts: SessionOptions = {};
    const profile = stringFlag(args, "profile");
    const baseUrl = stringFlag(args, "base-url");
    const timeout = stringFlag(args, "timeout");
    if (profile) opts.profile = profile;
    if (baseUrl) opts.baseUrl = baseUrl;
    if (timeout !== undefined) {
        const ms = Number(timeout);
        if (!Number.isInteger(ms) || ms <= 0) throw new UsageError("--timeout expects milliseconds.");
        opts.timeoutMs = ms;
    }
    return opts;
}

/** `op` lets a few resources (a sale's profit, an eBay account's health) surface a nested field as a plain column; see `render-hints.ts`. */
export function printResult(ctx: CliContext, args: ParsedArgs, result: unknown, op?: OperationInfo): void {
    if (boolFlag(args, "json")) {
        ctx.stdout(toJson(result));
        return;
    }
    const shown = op ? applyRenderHints(op, result) : result;
    ctx.stdout(renderHuman(shown, makeColors(shouldColor(ctx, args))));
}
