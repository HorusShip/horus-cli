/** `horus <resource> <verb> …`: run one generated operation. */
import { ROUTES, type Job, type RequestOptions, type RouteId } from "@horusship/sdk";
import type { OperationInfo } from "@horusship/sdk/catalog";
import { boolFlag, stringFlag, type ParsedArgs } from "./argv.js";
import type { CliContext } from "./context.js";
import { GLOBAL_FLAG_NAMES, printResult, sessionOptions } from "./globals.js";
import { buildParams, loadData, missingRequired, pathParams, UsageError } from "./params.js";
import { openSession, type Session } from "./session.js";
import { withSpinner } from "./spinner.js";
import { watchLoop } from "./watch.js";

const DEFAULT_WAIT_S = 600;
const DEFAULT_WATCH_S = 5;
/** Clears the screen and homes the cursor (used between `--watch` refreshes on a TTY). */
const CLEAR_SCREEN = "\u001b[2J\u001b[3J\u001b[H";

function routeId(op: OperationInfo): RouteId {
    if (!(op.id in ROUTES)) throw new UsageError(`Unknown operation ${op.id}.`);
    return op.id as RouteId;
}

function isJob(v: unknown): v is Job {
    return typeof v === "object" && v !== null && (v as { object?: unknown }).object === "job" && typeof (v as { id?: unknown }).id === "string";
}

function requestOptions(args: ParsedArgs): RequestOptions {
    const key = stringFlag(args, "idempotency-key");
    return key ? { idempotencyKey: key } : {};
}

async function collectParams(op: OperationInfo, args: ParsedArgs, ctx: CliContext): Promise<Record<string, unknown> | undefined> {
    const raw = stringFlag(args, "data");
    const data = raw === undefined ? undefined : await loadData(raw, ctx);
    const params = buildParams(op, args, data, GLOBAL_FLAG_NAMES);
    const missing = missingRequired(op, params);
    if (missing.length) throw new UsageError(`Missing required ${missing.join(", ")}. Run with --help to see the flags.`);
    return params;
}

async function fetchResult(session: Session, op: OperationInfo, path: Record<string, string>, params: unknown, args: ParsedArgs): Promise<unknown> {
    const id = routeId(op);
    const options = requestOptions(args);
    if (op.paginated && boolFlag(args, "all")) {
        const data = await session.horus.paginate(id, path, params, options).toArray();
        return { object: "list", data, has_more: false, next_cursor: null };
    }
    return session.horus.call(id, path, params, options);
}

async function waitIfAsked(session: Session, result: unknown, args: ParsedArgs, ctx: CliContext): Promise<unknown> {
    if (!boolFlag(args, "wait") || !isJob(result)) return result;
    const seconds = Number(stringFlag(args, "wait-timeout") ?? DEFAULT_WAIT_S);
    if (!Number.isFinite(seconds) || seconds <= 0) throw new UsageError("--wait-timeout expects a number of seconds.");
    const interval = Number(stringFlag(args, "wait-interval") ?? 2);
    if (!Number.isFinite(interval) || interval <= 0) throw new UsageError("--wait-interval expects a number of seconds.");
    const quiet = boolFlag(args, "json");
    let last = "";
    return session.horus.jobs.wait(result.id, {
        timeoutMs: seconds * 1000,
        intervalMs: interval * 1000,
        onPoll: (job): void => {
            if (quiet || job.status === last) return;
            last = job.status;
            ctx.stderr(`job ${job.id}: ${job.status}\n`);
        },
    });
}

function positiveSeconds(args: ParsedArgs, flag: string, fallback: number): number {
    const raw = Number(stringFlag(args, flag) ?? fallback);
    if (!Number.isFinite(raw) || raw <= 0) throw new UsageError(`--${flag} expects a number of seconds.`);
    return raw;
}

function watchCount(args: ParsedArgs): number | undefined {
    const raw = stringFlag(args, "watch-count");
    if (raw === undefined) return undefined;
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) throw new UsageError("--watch-count expects a positive integer.");
    return n;
}

/** `--watch`: re-run a read-only operation on an interval until the process is stopped (Ctrl+C), like the Unix `watch` command. */
async function watchOperation(op: OperationInfo, path: Record<string, string>, params: unknown, args: ParsedArgs, ctx: CliContext, session: Session): Promise<number> {
    const seconds = positiveSeconds(args, "watch-interval", DEFAULT_WATCH_S);
    await watchLoop(ctx, { intervalMs: seconds * 1000, maxIterations: watchCount(args) }, async () => {
        const result = await fetchResult(session, op, path, params, args);
        if (ctx.isTTY) ctx.stdout(CLEAR_SCREEN);
        printResult(ctx, args, result, op);
        ctx.stderr(`\nWatching every ${seconds}s — Ctrl+C to stop.\n`);
    });
    return 0;
}

/** Exit status: 0, or 1 when a waited-for job did not succeed. */
export async function runOperation(op: OperationInfo, args: ParsedArgs, rest: readonly string[], ctx: CliContext): Promise<number> {
    const path = pathParams(op, rest, args);
    const params = await collectParams(op, args, ctx);
    const session = await openSession(ctx, sessionOptions(args));
    if (boolFlag(args, "watch")) {
        if (op.method !== "GET") throw new UsageError("--watch only works with read operations (a list or get).");
        return watchOperation(op, path, params, args, ctx, session);
    }
    const result = await waitIfAsked(session, await withSpinner(ctx, args, "Loading…", () => fetchResult(session, op, path, params, args)), args, ctx);
    printResult(ctx, args, result, op);
    return isJob(result) && boolFlag(args, "wait") && result.status !== "SUCCEEDED" ? 1 : 0;
}
