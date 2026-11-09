import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/argv.js";
import { makeColors, NO_COLORS, paintSigned, paintStatus, shouldColor } from "../src/colors.js";
import { makeCli } from "./helpers.js";

describe("makeColors", () => {
    it("wraps text with ANSI codes only when enabled", () => {
        const on = makeColors(true);
        const off = makeColors(false);
        expect(on.red("x")).toBe("\u001b[31mx\u001b[0m");
        expect(off.red("x")).toBe("x");
        expect(NO_COLORS.enabled).toBe(false);
    });
});

describe("paintStatus / paintSigned", () => {
    const colors = makeColors(true);

    it("colors known status words and leaves others alone", () => {
        expect(paintStatus(colors, "LISTED")).toContain("32m");
        expect(paintStatus(colors, "FAILED")).toContain("31m");
        expect(paintStatus(colors, "PENDING")).toContain("33m");
        expect(paintStatus(colors, "WEIRD")).toBe("WEIRD");
    });

    it("colors by sign", () => {
        expect(paintSigned(colors, 5, "5.00 USD")).toContain("32m");
        expect(paintSigned(colors, -5, "-5.00 USD")).toContain("31m");
    });
});

describe("shouldColor", () => {
    const args = (...t: string[]) => parseArgs(t, (n) => n === "json" || n === "no-color");

    it("needs a TTY, no --json, no --no-color, no NO_COLOR", () => {
        const cli = makeCli(() => new Response(null), { isTTY: true });
        expect(shouldColor(cli.ctx, args())).toBe(true);
        expect(shouldColor(cli.ctx, args("--json"))).toBe(false);
        expect(shouldColor(cli.ctx, args("--no-color"))).toBe(false);
    });

    it("off when not a TTY, or NO_COLOR is set", () => {
        const notty = makeCli(() => new Response(null), { isTTY: false });
        expect(shouldColor(notty.ctx, args())).toBe(false);
        const noColorEnv = makeCli(() => new Response(null), { isTTY: true, env: { NO_COLOR: "1" } });
        expect(shouldColor(noColorEnv.ctx, args())).toBe(false);
    });
});
