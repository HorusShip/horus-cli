import { describe, expect, it } from "vitest";
import { closest, distance } from "../src/suggest.js";

describe("distance", () => {
    it("counts edits", () => {
        expect(distance("", "")).toBe(0);
        expect(distance("abc", "abc")).toBe(0);
        expect(distance("abc", "abd")).toBe(1);
        expect(distance("listing", "listings")).toBe(1);
        expect(distance("kitten", "sitting")).toBe(3);
    });
});

describe("closest", () => {
    it("finds a near match within the default threshold", () => {
        expect(closest("listing", ["listings", "leads", "sales"])).toBe("listings");
        expect(closest("statuss", ["status", "limit", "cursor"])).toBe("status");
    });

    it("returns undefined when nothing is close enough", () => {
        expect(closest("xyz", ["listings", "leads", "sales"])).toBeUndefined();
        expect(closest("a", [])).toBeUndefined();
    });

    it("honors an explicit max distance", () => {
        expect(closest("ab", ["abcdef"], 1)).toBeUndefined();
        expect(closest("ab", ["abcdef"], 4)).toBe("abcdef");
    });
});
