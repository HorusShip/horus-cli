/**
 * Human-table rendering only cares about scalar top-level fields (see
 * `output.ts`'s `pickColumns`), so a few resources whose useful bit is
 * nested — a sale's profit, an eBay account's health — are invisible in
 * `--json`-free output today. This flattens exactly those onto synthetic
 * top-level fields before rendering. `--json` always bypasses it: the API
 * response goes out unmodified.
 */
import type { EbayAccount, Sale } from "@horusship/sdk";
import type { OperationInfo } from "@horusship/sdk/catalog";

type Row = Record<string, unknown>;

function isRecord(v: unknown): v is Row {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Issues a seller would want to fix on an eBay account, in order of severity. */
export function ebayAccountIssues(a: Pick<EbayAccount, "is_active" | "onboarding_required" | "missing_scopes" | "health">): string[] {
    const issues: string[] = [];
    if (!a.is_active) issues.push("inactive");
    if (a.onboarding_required) issues.push("onboarding required");
    if (!a.health.ship_from_ok) issues.push("ship-from address");
    if (!a.health.policies_ok) issues.push("business policies");
    if (a.missing_scopes.length > 0) issues.push("reconnect eBay");
    return issues;
}

function withHealth(a: EbayAccount): Row {
    const issues = ebayAccountIssues(a);
    return { ...a, health: issues.length === 0 ? "ok" : issues.join(", ") };
}

function withProfit(s: Sale): Row {
    return { ...s, profit: s.amounts.profit };
}

function hint(opId: string, row: Row): Row {
    if (opId === "ebay.accounts.list" || opId === "ebay.accounts.get") return withHealth(row as unknown as EbayAccount);
    if (opId === "sales.list" || opId === "sales.get") return withProfit(row as unknown as Sale);
    return row;
}

/** Apply `hint` to a single object or every item of a list response; anything else passes through untouched. */
export function applyRenderHints(op: OperationInfo, value: unknown): unknown {
    if (!isRecord(value)) return value;
    if (value.object === "list" && Array.isArray(value.data)) {
        return { ...value, data: value.data.map((row) => (isRecord(row) ? hint(op.id, row) : row)) };
    }
    return hint(op.id, value);
}
