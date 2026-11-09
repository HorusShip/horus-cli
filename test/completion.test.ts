import { CATALOG } from "@horusship/sdk/catalog";
import { describe, expect, it } from "vitest";
import { buildCommandTree } from "../src/commands.js";
import { completionScript, wordTree } from "../src/completion.js";

const tree = buildCommandTree(CATALOG);
const builtins = ["login", "logout", "whoami", "stats", "api", "completion"];

describe("wordTree", () => {
    it("lists top-level words (resources, builtins and the orders alias) and each resource's direct children", () => {
        const { top, children } = wordTree(tree, builtins);
        expect(top).toContain("listings");
        expect(top).toContain("stats");
        expect(top).toContain("orders");
        expect(children.listings).toContain("list");
        expect(children.listings).toContain("get");
        expect(children.webhooks).toContain("verify");
    });
});

describe("completionScript", () => {
    const wt = wordTree(tree, builtins);

    it("generates a script per shell containing the top words", () => {
        for (const shell of ["bash", "zsh", "fish", "powershell"] as const) {
            const script = completionScript(shell, wt);
            expect(script).toContain("listings");
            expect(script).toContain("horus");
        }
    });

    it("rejects an unknown shell", () => {
        expect(() => completionScript("tcsh", wt)).toThrow(/Unknown shell/);
    });
});
