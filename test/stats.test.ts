import { describe, expect, it } from "vitest";
import { NO_COLORS } from "../src/colors.js";
import { renderStats, statsJson } from "../src/stats.js";
import { json, KEY_ENV, makeCli } from "./helpers.js";

const snapshot = (over: Partial<{ desktopOnline: boolean; held: number; accountIssues: number }> = {}) => ({
    period: "day" as const,
    dashboard: {
        object: "dashboard" as const,
        period: "day" as const,
        range: null,
        revenue: { amount: 120, currency: "USD" },
        profit: { amount: 42.5, currency: "USD" },
        units_sold: 6,
        listings: 2,
        listing_value: { amount: 0, currency: "USD" },
        charts: { revenue: [], units_sold: [], listings: [], listing_value: [] },
    },
    activeListings: 248,
    moreListings: true,
    desktop: {
        object: "desktop_status" as const,
        paired: true,
        online: over.desktopOnline ?? true,
        last_seen_at: null,
        paired_at: null,
        version: "1.0.0",
        engine_status: "ready",
        engine_detail: null,
        engine_updated_at: null,
        account_automation_ready: true,
        held_sale_count: over.held ?? 0,
    },
    accountIssues: over.accountIssues ?? 0,
});

describe("renderStats", () => {
    it("shows the headline numbers and 'none' when there's nothing to fix", () => {
        const text = renderStats(snapshot(), NO_COLORS);
        expect(text).toContain("Revenue");
        expect(text).toContain("120.00 USD");
        expect(text).toContain("42.50 USD");
        expect(text).toContain("Active listings");
        expect(text).toContain("248+");
        expect(text).toContain("none");
    });

    it("lists issues: an offline desktop (with held sales) and accounts needing attention", () => {
        const text = renderStats(snapshot({ desktopOnline: false, held: 3, accountIssues: 2 }), NO_COLORS);
        expect(text).toContain("Horus Desktop is offline (3 sale(s) held)");
        expect(text).toContain("2 eBay accounts need attention");
    });
});

describe("statsJson", () => {
    it("is a plain object mirroring the snapshot, with issues spelled out", () => {
        const out = statsJson(snapshot({ accountIssues: 1 }));
        expect(out).toMatchObject({ object: "stats", period: "day", units_sold: 6, active_listings: 248, active_listings_at_least: true, accounts_with_issues: 1 });
        expect(out.issues).toEqual(["1 eBay account needs attention — `horus ebay accounts list`."]);
    });
});

describe("horus stats (end to end)", () => {
    it("combines the dashboard, listings, desktop and eBay accounts calls", async () => {
        const cli = makeCli((c) => {
            if (c.url.pathname === "/api/v1/analytics/dashboard") return json(200, snapshot().dashboard);
            if (c.url.pathname === "/api/v1/listings") return json(200, { object: "list", data: Array.from({ length: 5 }, (_, i) => ({ id: `l${i}` })), has_more: false, next_cursor: null });
            if (c.url.pathname === "/api/v1/desktop/status") return json(200, snapshot().desktop);
            if (c.url.pathname === "/api/v1/ebay/accounts") return json(200, { object: "list", data: [], has_more: false, next_cursor: null });
            return json(404, {});
        }, { env: KEY_ENV });
        expect(await cli.run("stats", "--json")).toBe(0);
        const out = JSON.parse(cli.out());
        expect(out).toMatchObject({ object: "stats", active_listings: 5, active_listings_at_least: false });
        expect(cli.calls.find((c) => c.url.pathname === "/api/v1/analytics/dashboard")?.url.searchParams.get("period")).toBe("day");
    });

    it("rejects a bad --period", async () => {
        const cli = makeCli(() => json(200, {}), { env: KEY_ENV });
        expect(await cli.run("stats", "--period", "yesterday")).toBe(2);
        expect(cli.err()).toContain("--period must be one of");
    });
});
