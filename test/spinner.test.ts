import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/argv.js";
import { withSpinner } from "../src/spinner.js";
import { makeCli } from "./helpers.js";

const args = (...t: string[]) => parseArgs(t, (n) => n === "json");

describe("withSpinner", () => {
    it("runs fn without writing anything when not a TTY", async () => {
        const cli = makeCli(() => new Response(null), { isTTY: false });
        const result = await withSpinner(cli.ctx, args(), "Loading…", async () => 42);
        expect(result).toBe(42);
        expect(cli.err()).toBe("");
    });

    it("skips the spinner with --json even on a TTY", async () => {
        const cli = makeCli(() => new Response(null), { isTTY: true });
        await withSpinner(cli.ctx, args("--json"), "Loading…", async () => 1);
        expect(cli.err()).toBe("");
    });

    it("animates on a TTY and clears the line afterwards, propagating the result", async () => {
        const cli = makeCli(() => new Response(null), { isTTY: true });
        const result = await withSpinner(cli.ctx, args(), "Loading…", async () => "done");
        expect(result).toBe("done");
        expect(cli.err()).toContain("Loading…");
        expect(cli.err().endsWith("\r")).toBe(true);
    });

    it("still clears the line when fn throws", async () => {
        const cli = makeCli(() => new Response(null), { isTTY: true });
        await expect(withSpinner(cli.ctx, args(), "Loading…", async () => {
            throw new Error("boom");
        })).rejects.toThrow("boom");
        expect(cli.err().endsWith("\r")).toBe(true);
    });
});
