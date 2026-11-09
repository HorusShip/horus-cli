/**
 * `horus stats`: a one-screen dashboard — today's sales, profit, active
 * listings and anything that needs attention. Combines `analytics.dashboard`
 * with a quick look at listings, the paired desktop and eBay account health,
 * none of which a single operation surfaces together.
 */
import type { Dashboard, DesktopStatus, Money } from "@horusship/sdk";
import { boolFlag, stringFlag, type ParsedArgs } from "./argv.js";
import { makeColors, paintSigned, shouldColor, type Colors } from "./colors.js";
import type { CliContext } from "./context.js";
import { sessionOptions } from "./globals.js";
import { toJson } from "./output.js";
import { UsageError } from "./params.js";
import { ebayAccountIssues } from "./render-hints.js";
import { openSession, type Session } from "./session.js";
import { withSpinner } from "./spinner.js";
import { watchLoop } from "./watch.js";

export const STATS_FLAGS: ReadonlySet<string> = new Set(["period", "watch-interval"]);

const PERIODS = ["day", "wtd", "mtd", "ytd", "all"] as const;
type Period = (typeof PERIODS)[number];
const DEFAULT_WATCH_S = 30;

function period(args: ParsedArgs): Period {
    const raw = stringFlag(args, "period") ?? "day";
    const found = PERIODS.find((p) => p === raw);
    if (!found) throw new UsageError(`--period must be one of: ${PERIODS.join(", ")}.`);
    return found;
}

interface Snapshot {
    period: Period;
    dashboard: Dashboard;
    activeListings: number;
    moreListings: boolean;
    desktop: DesktopStatus;
    accountIssues: number;
}

async function loadSnapshot(session: Session, p: Period): Promise<Snapshot> {
    const [dashboard, listed, desktop, accounts] = await Promise.all([
        session.horus.call("analytics.dashboard", {}, { period: p }),
        session.horus.call("listings.list", {}, { status: "LISTED", limit: 100 }),
        session.horus.call("desktop.status.get", {}, undefined),
        session.horus.call("ebay.accounts.list", {}, { limit: 100 }),
    ]);
    return {
        period: p,
        dashboard,
        activeListings: listed.data.length,
        moreListings: listed.has_more,
        desktop,
        accountIssues: accounts.data.filter((a) => ebayAccountIssues(a).length > 0).length,
    };
}

function money(m: Money): string {
    return m ? `${m.amount.toFixed(2)} ${m.currency}` : "-";
}

function issues(s: Snapshot): string[] {
    const out: string[] = [];
    if (!s.desktop.online) out.push(`Horus Desktop is offline${s.desktop.held_sale_count ? ` (${s.desktop.held_sale_count} sale(s) held)` : ""}.`);
    if (s.desktop.online && s.desktop.engine_status !== "ready") out.push(`Browser engine is ${s.desktop.engine_status}; source checkouts may not run.`);
    if (s.accountIssues > 0) out.push(`${s.accountIssues} eBay account${s.accountIssues === 1 ? " needs" : "s need"} attention — \`horus ebay accounts list\`.`);
    return out;
}

function label(p: Period): string {
    return p === "day" ? "today" : p === "all" ? "all time" : p;
}

export function renderStats(s: Snapshot, colors: Colors): string {
    const row = (name: string, value: string): string => `${name.padEnd(16)}${value}\n`;
    const its = issues(s);
    const lines = [
        `Horus — ${label(s.period)}\n`,
        row("Revenue", money(s.dashboard.revenue)),
        row("Profit", s.dashboard.profit ? paintSigned(colors, s.dashboard.profit.amount, money(s.dashboard.profit)) : money(s.dashboard.profit)),
        row("Units sold", String(s.dashboard.units_sold)),
        row("Active listings", `${s.activeListings}${s.moreListings ? "+" : ""}`),
        "\nIssues\n",
        its.length ? its.map((i) => `  - ${colors.enabled ? colors.yellow(i) : i}\n`).join("") : "  none\n",
    ];
    return lines.join("");
}

export function statsJson(s: Snapshot): Record<string, unknown> {
    return {
        object: "stats",
        period: s.period,
        revenue: s.dashboard.revenue,
        profit: s.dashboard.profit,
        units_sold: s.dashboard.units_sold,
        active_listings: s.activeListings,
        active_listings_at_least: s.moreListings,
        desktop_online: s.desktop.online,
        held_sales: s.desktop.held_sale_count,
        accounts_with_issues: s.accountIssues,
        issues: issues(s),
    };
}

export async function statsCommand(ctx: CliContext, args: ParsedArgs): Promise<number> {
    const p = period(args);
    const session = await openSession(ctx, sessionOptions(args));
    const json = boolFlag(args, "json");
    const colors = makeColors(shouldColor(ctx, args));
    const render = (snapshot: Snapshot): void => ctx.stdout(json ? toJson(statsJson(snapshot)) : renderStats(snapshot, colors));
    if (!boolFlag(args, "watch")) {
        render(await withSpinner(ctx, args, "Loading…", () => loadSnapshot(session, p)));
        return 0;
    }
    const seconds = Number(stringFlag(args, "watch-interval") ?? DEFAULT_WATCH_S);
    if (!Number.isFinite(seconds) || seconds <= 0) throw new UsageError("--watch-interval expects a number of seconds.");
    await watchLoop(ctx, { intervalMs: seconds * 1000 }, async () => {
        const snapshot = await loadSnapshot(session, p);
        if (ctx.isTTY) ctx.stdout("\u001b[2J\u001b[3J\u001b[H");
        render(snapshot);
        ctx.stderr(`\nWatching every ${seconds}s — Ctrl+C to stop.\n`);
    });
    return 0;
}
