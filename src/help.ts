/** Help text, generated from the operation catalog (summaries, descriptions, params). */
import type { OperationInfo, ParamInfo } from "@horusship/sdk/catalog";
import { kebab, opsUnder, type CommandNode } from "./commands.js";
import { flagName, flagParams, isBoolLike } from "./params.js";

export const GLOBAL_FLAGS: readonly [string, string][] = [
    ["--json", "Print the raw JSON response (stable, for scripts and agents)"],
    ["--all", "Follow every page of a list (with --json: one combined list)"],
    ["--wait", "For 202 job responses: poll until the job finishes"],
    ["--wait-timeout <s>", "Give up waiting after this many seconds (default 600)"],
    ["--wait-interval <s>", "Seconds between job polls (default 2)"],
    ["--watch", "Re-run a read command on an interval, like `watch` (Ctrl+C to stop)"],
    ["--watch-interval <s>", "Seconds between refreshes (default 5)"],
    ["--watch-count <n>", "Stop after this many refreshes (default: unbounded)"],
    ["--data <json|@file|->", "Request params/body as JSON (flags override fields)"],
    ["--idempotency-key <key>", "Use your own Idempotency-Key for a write"],
    ["--profile <name>", "Credentials profile (default: default, or HORUS_PROFILE)"],
    ["--base-url <url>", "API root (default https://horusship.com/api/v1, or HORUS_BASE_URL)"],
    ["--timeout <ms>", "Per-request timeout"],
    ["--no-color", "Disable colored output (also: NO_COLOR=1)"],
    ["-h, --help", "Show help"],
];

export const BUILTINS: readonly [string, string][] = [
    ["login", "Sign in (OAuth device flow) or save an API key (--api-key)"],
    ["logout", "Revoke and forget the stored credentials"],
    ["whoami", "Show the signed-in user and credential scopes"],
    ["stats", "A one-screen dashboard: today's sales, profit, listings, issues"],
    ["api <METHOD> <path>", "Call any endpoint: horus api GET /listings --query status=LISTED"],
    ["webhooks verify", "Check a webhook signature locally"],
    ["completion <shell>", "Print a completion script for bash, zsh, fish or powershell"],
];

/** Dedicated `--help` text for each built-in, instead of dumping the whole root help. */
export const BUILTIN_HELP: Readonly<Record<string, string>> = {
    login: `Sign in to Horus.

Usage
  horus login                         Device flow: shows a code + URL, opens your browser
  horus login --api-key ak_…          Save an API key instead (from Settings → API)
  horus login --api-key -             Read the key from stdin
  horus login --profile work          Keep several accounts side by side

Flags
  --api-key <key|->   Skip the browser; save this key (or read it from stdin)
  --scopes <list>     Space-separated OAuth scopes to request (device flow only)
  --no-browser        Print the sign-in URL instead of opening it
  --profile <name>    Which profile to save this credential as
`,
    logout: `Forget the stored credentials for a profile.

Usage
  horus logout                    Default profile
  horus logout --profile work     A named profile

Revokes the OAuth refresh token first (if there is one), then deletes the profile.
`,
    whoami: `Show who you're signed in as.

Usage
  horus whoami
  horus whoami --profile work
  horus whoami --json
`,
    stats: `A one-screen dashboard: revenue, profit, units sold, active listings and
anything that needs attention (an offline desktop, eBay accounts with issues).

Usage
  horus stats                         Today
  horus stats --period mtd            Month to date (day|wtd|mtd|ytd|all)
  horus stats --watch                 Refresh every 5s until Ctrl+C
  horus stats --watch --watch-interval 30
  horus stats --json
`,
    api: `Call any endpoint directly — the escape hatch for anything not (yet) built in.

Usage
  horus api GET /listings --query status=LISTED --query limit=5
  horus api POST /listings/validate --data '{"items":["B07ABC1234"]}'
  horus api PATCH /settings --data @settings.json

Flags
  --query k=v     Repeatable; a query string parameter
  --data <json|@file|->   The request body
`,
    "webhooks verify": `Check a webhook delivery's signature locally (no API call).

Usage
  horus webhooks verify --secret whsec_… --payload @body.json \\
    --id <webhook-id> --timestamp <webhook-timestamp> --signature "v1,…"

Flags
  --secret <whsec_…>          Endpoint secret (or HORUS_WEBHOOK_SECRET)
  --payload <@file|-|text>    The raw request body
  --header "name: value"      Any delivery header (repeatable)
  --id / --timestamp / --signature   Standard Webhooks headers
  --legacy-signature <sha256=…>      X-Horus-Signature (v1 endpoints)
  --tolerance <s>             Max timestamp skew (default 300)
  --ignore-timestamp          Skip the timestamp check (old captured deliveries)
  --json                      { "valid", "event" | "error" }
`,
    completion: `Print a shell completion script.

Usage
  eval "$(horus completion bash)"       # add to ~/.bashrc
  eval "$(horus completion zsh)"        # add to ~/.zshrc
  horus completion fish | source        # add to ~/.config/fish/config.fish
  horus completion powershell | Out-String | Invoke-Expression   # add to your profile

Completes top-level commands and each resource's direct subcommands.
`,
};

function table(rows: readonly (readonly [string, string])[], indent = "  "): string {
    const width = Math.min(34, Math.max(0, ...rows.map(([a]) => a.length)));
    return rows.map(([a, b]) => `${indent}${a.padEnd(width)}  ${b}`).join("\n");
}

function firstLine(s: string): string {
    return s.split("\n")[0] ?? s;
}

export function rootHelp(root: CommandNode, version: string): string {
    const resources = [...root.children.values()].sort((a, b) => a.name.localeCompare(b.name))
        .map((n): [string, string] => [n.name, `${opsUnder(n).length} command${opsUnder(n).length === 1 ? "" : "s"}`]);
    return `horus ${version}: the Horus API from your terminal

Usage
  horus <resource> <command> [args] [flags]
  horus api <METHOD> <path> [--query k=v] [--data …]

Getting started
${table(BUILTINS)}

Resources (horus <resource> --help)
${table(resources)}

Global flags
${table(GLOBAL_FLAGS)}

Auth: HORUS_API_KEY=ak_… overrides stored credentials. Docs: https://horusship.com/docs/api
`;
}

export function groupHelp(node: CommandNode): string {
    const rows: [string, string][] = [];
    for (const child of [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name))) {
        if (child.op) rows.push([child.name, firstLine(child.op.summary)]);
        else rows.push([`${child.name} …`, `${opsUnder(child).length} commands`]);
    }
    if (node.path.length === 1 && node.name === "webhooks") rows.push(["verify", "Check a webhook signature locally (no API call)"]);
    return `Usage: horus ${node.path.join(" ")} <command> [flags]

Commands
${table(rows)}

Run \`horus ${node.path.join(" ")} <command> --help\` for flags.
`;
}

function paramType(p: ParamInfo): string {
    if (p.enum) return p.enum.join("|");
    if (p.type === "array") return `${p.itemType ?? "value"},…`;
    if (p.type === "object" || p.type === "unknown") return "json";
    return p.type;
}

function flagRow(p: ParamInfo): [string, string] {
    const value = isBoolLike(p) ? "" : ` <${paramType(p)}>`;
    const notes = [p.required ? "required" : "", p.default !== undefined ? `default ${JSON.stringify(p.default)}` : ""].filter(Boolean).join(", ");
    const desc = [p.description ? firstLine(p.description) : "", notes ? `(${notes})` : ""].filter(Boolean).join(" ");
    return [`--${flagName(p)}${value}`, desc];
}

export function usageLine(op: OperationInfo): string {
    const words = op.id.split(".").map(kebab).join(" ");
    const args = op.pathParams.map((p) => `<${p.name}>`).join(" ");
    return `horus ${words}${args ? ` ${args}` : ""}${op.params === "none" ? "" : " [flags]"}`;
}

export function operationHelp(op: OperationInfo): string {
    const flags = flagParams(op).map(flagRow);
    const notes = [
        `${op.method} ${op.path}`,
        op.scopes.length ? `scopes: ${op.scopes.join(", ")}` : "",
        op.requiresDesktop ? "runs on your Horus Desktop (returns a job; add --wait)" : "",
        op.paginated ? "paginated: --limit, --cursor, or --all" : "",
    ].filter(Boolean);
    const sections = [
        `${op.summary}\n`,
        op.description ? `${op.description}\n` : "",
        `Usage\n  ${usageLine(op)}\n`,
        flags.length ? `Flags\n${table(flags)}\n` : "",
        `${notes.join(" · ")}\n`,
        `Global flags: --json, --all, --wait${op.method === "GET" ? ", --watch" : ""}, --data, --profile, --base-url (horus --help)\n`,
    ];
    return sections.filter(Boolean).join("\n");
}
