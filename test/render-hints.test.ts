import { CATALOG, type OperationInfo } from "@horusship/sdk/catalog";
import { describe, expect, it } from "vitest";
import { applyRenderHints, ebayAccountIssues } from "../src/render-hints.js";

const op = (id: string): OperationInfo => {
    const found = CATALOG.find((o) => o.id === id);
    if (!found) throw new Error(id);
    return found;
};

const health = (over: Partial<{ ship_from_ok: boolean; policies_ok: boolean; is_active: boolean; onboarding_required: boolean }> = {}) => ({
    is_active: true,
    onboarding_required: false,
    missing_scopes: [] as string[],
    health: { ship_from_ok: true, policies_ok: true, is_active: true, onboarding_required: false, ...over },
});

describe("ebayAccountIssues", () => {
    it("is empty for a healthy account", () => {
        expect(ebayAccountIssues(health())).toEqual([]);
    });

    it("flags each problem", () => {
        expect(ebayAccountIssues({ ...health(), is_active: false })).toContain("inactive");
        expect(ebayAccountIssues({ ...health(), onboarding_required: true })).toContain("onboarding required");
        expect(ebayAccountIssues({ ...health({ ship_from_ok: false }) })).toContain("ship-from address");
        expect(ebayAccountIssues({ ...health({ policies_ok: false }) })).toContain("business policies");
        expect(ebayAccountIssues({ ...health(), missing_scopes: ["listings:write"] })).toContain("reconnect eBay");
    });
});

describe("applyRenderHints", () => {
    it("flattens a sale's profit onto a top-level field (list and single)", () => {
        const sale = { object: "sale", id: "s1", amounts: { profit: { amount: 4.5, currency: "USD" } } };
        expect(applyRenderHints(op("sales.get"), sale)).toMatchObject({ profit: { amount: 4.5, currency: "USD" } });
        const page = { object: "list", data: [sale], has_more: false, next_cursor: null };
        expect(applyRenderHints(op("sales.list"), page)).toMatchObject({ data: [{ profit: { amount: 4.5, currency: "USD" } }] });
    });

    it("flattens an eBay account's health onto a top-level field", () => {
        const account = { object: "ebay_account", id: "e1", ...health({ ship_from_ok: false }) };
        expect(applyRenderHints(op("ebay.accounts.get"), account)).toMatchObject({ health: "ship-from address" });
        const okAccount = { object: "ebay_account", id: "e2", ...health() };
        expect(applyRenderHints(op("ebay.accounts.get"), okAccount)).toMatchObject({ health: "ok" });
    });

    it("passes through anything else untouched", () => {
        const me = { object: "user", id: "u1" };
        expect(applyRenderHints(op("me.get"), me)).toEqual(me);
        expect(applyRenderHints(op("me.get"), undefined)).toBeUndefined();
        expect(applyRenderHints(op("me.get"), null)).toBeNull();
    });
});
