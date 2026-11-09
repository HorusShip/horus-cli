/**
 * Entry point: parse argv, route to a built-in or a generated operation,
 * print, and map failures to exit codes (0 ok, 1 API/runtime error, 2 usage).
 */
import { APIError, HorusError, SDK_VERSION } from "@horusship/sdk";
import { CATALOG, type OperationInfo } from "@horusship/sdk/catalog";
import { apiCommand, API_FLAGS } from "./api-command.js";
import { parseArgs, boolFlag, type ParsedArgs } from "./argv.js";
import { login, logout, LOGIN_BOOLEANS, whoami } from "./auth-commands.js";
import { completionScript, wordTree } from "./completion.js";
import { buildCommandTree, kebab, resolveCommand, TOP_LEVEL_ALIASES, type CommandNode } from "./commands.js";
import type { CliContext } from "./context.js";
import { errorHint } from "./error-hints.js";
import { GLOBAL_BOOLEANS, GLOBAL_FLAG_NAMES } from "./globals.js";
import { BUILTIN_HELP, groupHelp, operationHelp, rootHelp } from "./help.js";
import { OAuthError } from "./oauth.js";
import { toJson } from "./output.js";
import { flagName, flagParams, isBoolLike, UsageError } from "./params.js";
import { runOperation } from "./run-operation.js";
import { statsCommand, STATS_FLAGS } from "./stats.js";
import { closest } from "./suggest.js";
import { VERIFY_BOOLEANS, verifyCommand } from "./webhooks-verify.js";

export const CLI_VERSION = "0.2.0";
export const EXIT = { ok: 0, error: 1, usage: 2 } as const;

const TREE: CommandNode = buildCommandTree(CATALOG);

type Builtin = (ctx: CliContext, args: ParsedArgs, rest: readonly string[]) => Promise<number>;

const BUILTINS: Record<string, Builtin> = {
    login: (ctx, args) => login(ctx, args),
    logout: (ctx, args) => logout(ctx, args),
    whoami: (ctx, args) => whoami(ctx, args),
    stats: (ctx, args) => statsCommand(ctx, args),
    api: (ctx, args, rest) => apiCommand(ctx, args, rest),
    completion: (ctx, args, rest) => completionCommand(ctx, rest),
};

const BUILTIN_ALLOWED_FLAGS: Readonly<Record<string, ReadonlySet<string>>> = {
    login: new Set(["api-key", "scopes", "no-browser"]),
    api: API_FLAGS,
    stats: STATS_FLAGS,
};

async function completionCommand(ctx: CliContext, rest: readonly string[]): Promise<number> {
    const shell = rest[0];
    if (!shell) throw new UsageError(`Usage: horus completion <${"bash|zsh|fish|powershell"}>`);
    ctx.stdout(completionScript(shell, wordTree(TREE, Object.keys(BUILTINS))));
    return EXIT.ok;
}

const baseBooleans = (name: string): boolean => GLOBAL_BOOLEANS.has(name) || LOGIN_BOOLEANS.has(name) || VERIFY_BOOLEANS.has(name);

function opBooleans(op: OperationInfo): (name: string) => boolean {
    const bools = new Set(flagParams(op).filter(isBoolLike).map(flagName));
    return (name) => baseBooleans(name) || bools.has(name);
}

function checkFlags(args: ParsedArgs, allowed: ReadonlySet<string>, command: string): void {
    for (const name of args.flags.keys()) {
        if (!allowed.has(name) && !GLOBAL_FLAG_NAMES.has(name)) {
            const did = closest(name, [...allowed, ...GLOBAL_FLAG_NAMES]);
            throw new UsageError(`Unknown flag --${name} for ${command}.${did ? ` Did you mean --${did}?` : ""}`);
        }
    }
}

/** `horus listings search foo` → `horus listings list --search foo` (or `--q` — whichever field that resource's `list` actually has). */
function injectSearchPositional(op: OperationInfo, args: ParsedArgs, rest: readonly string[]): string[] {
    const [value, ...remaining] = rest;
    if (value === undefined) return remaining;
    const field = flagParams(op).find((p) => p.name === "search" || p.name === "q");
    if (!field) throw new UsageError(`${op.id} has no free-text search field.`);
    args.flags.set(flagName(field), [value]);
    return remaining;
}

async function runGenerated(argv: readonly string[], ctx: CliContext, first: ParsedArgs): Promise<number> {
    const { node, rest } = resolveCommand(TREE, first.positionals);
    if (node.op) {
        const args = parseArgs(argv, opBooleans(node.op));
        const again = resolveCommand(TREE, args.positionals);
        if (boolFlag(args, "help")) return print(ctx, operationHelp(node.op));
        const pathRest = again.aliasedVerb === "search" ? injectSearchPositional(node.op, args, again.rest) : again.rest;
        return runOperation(node.op, args, pathRest, ctx);
    }
    if (node.path.join(" ") === "webhooks" && rest[0] === "verify") {
        if (boolFlag(first, "help")) return print(ctx, BUILTIN_HELP["webhooks verify"] ?? "");
        return verifyCommand(ctx, first);
    }
    if (rest.length > 0) throw unknownCommand(node, rest[0] as string);
    return print(ctx, node.path.length === 0 ? rootHelp(TREE, CLI_VERSION) : groupHelp(node));
}

function unknownCommand(node: CommandNode, word: string): UsageError {
    const candidates = node.path.length === 0 ? [...node.children.keys(), ...Object.keys(BUILTINS), ...Object.keys(TOP_LEVEL_ALIASES)] : [...node.children.keys()];
    const suggestion = closest(kebab(word), candidates);
    const hint = ["horus", ...node.path, "--help"].join(" ");
    const did = suggestion ? ` Did you mean \`horus ${[...node.path, suggestion].join(" ")}\`?` : "";
    return new UsageError(`Unknown command "${[...node.path, word].join(" ")}". Run \`${hint}\`.${did}`);
}

function print(ctx: CliContext, text: string): number {
    ctx.stdout(text);
    return EXIT.ok;
}

async function dispatch(argv: readonly string[], ctx: CliContext): Promise<number> {
    const first = parseArgs(argv, baseBooleans);
    if (boolFlag(first, "version")) return print(ctx, `horus ${CLI_VERSION} (sdk ${SDK_VERSION})\n`);
    const [command, ...rest] = first.positionals;
    if (command === "help") return dispatch([...rest, "--help"], ctx);
    const builtin = command ? BUILTINS[command] : undefined;
    if (!builtin) return runGenerated(argv, ctx, first);
    if (boolFlag(first, "help")) return print(ctx, BUILTIN_HELP[command as string] ?? rootHelp(TREE, CLI_VERSION));
    checkFlags(first, BUILTIN_ALLOWED_FLAGS[command as string] ?? new Set(), `horus ${command}`);
    return builtin(ctx, first, rest);
}

function errorJson(e: unknown): Record<string, unknown> {
    if (e instanceof APIError) return { error: { status: e.status, type: e.type, code: e.code, message: e.message, details: e.details ?? null, request_id: e.requestId ?? null } };
    if (e instanceof UsageError) return { error: { type: "usage", code: "usage_error", message: e.message } };
    if (e instanceof OAuthError) return { error: { type: "authentication", code: e.code, message: e.message } };
    const name = e instanceof HorusError ? e.name : "Error";
    return { error: { type: "client", code: name, message: e instanceof Error ? e.message : String(e) } };
}

function errorText(e: unknown): string {
    if (e instanceof APIError) {
        const hint = errorHint(e);
        return `Error ${e.status} ${e.code}: ${e.message}${e.requestId ? ` (request ${e.requestId})` : ""}\n${hint ? `${hint}\n` : ""}`;
    }
    return `Error: ${e instanceof Error ? e.message : String(e)}\n`;
}

/** Run the CLI; returns the exit code. Errors go to stdout as JSON with --json, else to stderr. */
export async function run(argv: readonly string[], ctx: CliContext): Promise<number> {
    try {
        return await dispatch(argv, ctx);
    } catch (e) {
        if (argv.includes("--json")) ctx.stdout(toJson(errorJson(e)));
        else ctx.stderr(errorText(e));
        return e instanceof UsageError ? EXIT.usage : EXIT.error;
    }
}
