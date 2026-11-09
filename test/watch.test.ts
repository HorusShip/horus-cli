import { describe, expect, it } from "vitest";
import { watchLoop } from "../src/watch.js";
import { makeCli } from "./helpers.js";

describe("watchLoop", () => {
    it("ticks immediately, then waits intervalMs between ticks, up to maxIterations", async () => {
        const cli = makeCli(() => new Response(null));
        const sleeps: number[] = [];
        cli.ctx.sleep = async (ms) => {
            sleeps.push(ms);
        };
        const ticks: number[] = [];
        let n = 0;
        await watchLoop(cli.ctx, { intervalMs: 1000, maxIterations: 3 }, async () => {
            ticks.push(n++);
        });
        expect(ticks).toEqual([0, 1, 2]);
        expect(sleeps).toEqual([1000, 1000]);
    });

    it("stops after exactly one tick when maxIterations is 1 (no sleep)", async () => {
        const cli = makeCli(() => new Response(null));
        const sleeps: number[] = [];
        cli.ctx.sleep = async (ms) => {
            sleeps.push(ms);
        };
        let calls = 0;
        await watchLoop(cli.ctx, { intervalMs: 500, maxIterations: 1 }, async () => {
            calls++;
        });
        expect(calls).toBe(1);
        expect(sleeps).toEqual([]);
    });
});
