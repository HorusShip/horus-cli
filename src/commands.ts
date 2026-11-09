/**
 * The command tree, generated from the SDK's operation catalog:
 * `accounts.jobs.create` → `horus accounts jobs create`, camelCase segments
 * become kebab-case (`listings.bulkDelete` → `horus listings bulk-delete`).
 */
import type { OperationInfo } from "@horusship/sdk/catalog";

export interface CommandNode {
    readonly name: string;
    readonly path: readonly string[];
    readonly children: Map<string, CommandNode>;
    op: OperationInfo | undefined;
}

export const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function node(path: string[]): CommandNode {
    return { name: path[path.length - 1] ?? "horus", path, children: new Map(), op: undefined };
}

export function buildCommandTree(ops: readonly OperationInfo[]): CommandNode {
    const root = node([]);
    for (const op of ops) {
        let cur = root;
        for (const seg of op.id.split(".").map(kebab)) {
            let next = cur.children.get(seg);
            if (!next) {
                next = node([...cur.path, seg]);
                cur.children.set(seg, next);
            }
            cur = next;
        }
        cur.op = op;
    }
    return root;
}

export interface Resolved {
    node: CommandNode;
    /** Positionals left after the command words (path params). */
    rest: string[];
    /** The friendlier verb actually typed, when it resolved via `VERB_ALIASES` (e.g. "show" for a `get`). */
    aliasedVerb?: string;
}

/** `horus orders …` reads as `horus sales …` (no such operation group as "orders", but it's what sellers call them). Only tried on the first word. */
export const TOP_LEVEL_ALIASES: Readonly<Record<string, string>> = { orders: "sales" };

/** A friendlier verb for an existing one, used wherever the resource doesn't already define that word itself. */
const VERB_ALIASES: Readonly<Record<string, string>> = { show: "get", recent: "list", search: "list" };

/** Walk command words; stops at the first operation or the first unknown word. */
export function resolveCommand(root: CommandNode, positionals: readonly string[]): Resolved {
    let cur = root;
    let i = 0;
    let aliasedVerb: string | undefined;
    while (i < positionals.length && !cur.op) {
        const word = kebab(positionals[i] ?? "");
        const top = cur === root ? TOP_LEVEL_ALIASES[word] : undefined;
        const alias = top ?? (!cur.children.has(word) ? VERB_ALIASES[word] : undefined);
        const next = cur.children.get(alias ?? word);
        if (!next) break;
        if (alias) aliasedVerb = word;
        cur = next;
        i++;
    }
    return { node: cur, rest: positionals.slice(i), ...(aliasedVerb ? { aliasedVerb } : {}) };
}

/** Every operation under a node, depth-first. */
export function opsUnder(n: CommandNode): OperationInfo[] {
    const out: OperationInfo[] = n.op ? [n.op] : [];
    for (const c of n.children.values()) out.push(...opsUnder(c));
    return out;
}
