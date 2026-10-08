import { describe, expect, it } from "vitest";
import { generateVariants, tokenize, serviceHandle } from "@lib/variants";

describe("tokenize", () => {
  it("keeps a single token", () => {
    expect(tokenize("greyZ")).toEqual(["grey", "Z"]);
  });

  it("splits dots, dashes, underscores and spaces", () => {
    expect(tokenize("k.greyZ")).toEqual(["k", "grey", "Z"]);
    expect(tokenize("k-dot-greyz")).toEqual(["k", "dot", "greyz"]);
    expect(tokenize("glitched stardust")).toEqual(["glitched", "stardust"]);
    expect(tokenize("al.paca")).toEqual(["al", "paca"]);
  });

  it("splits x-joins like greyZxMusic", () => {
    expect(tokenize("greyZxMusic")).toEqual(["grey", "Z", "Music"]);
  });
});

describe("generateVariants", () => {
  it("is deterministic and puts the original first", () => {
    const a = generateVariants("greyZ");
    const b = generateVariants("greyZ");
    expect(a).toEqual(b);
    expect(a[0]).toBe("greyZ");
  });

  it("emits dots, underscores, dashes, case folds and x joins", () => {
    const variants = generateVariants("greyZ");
    expect(variants).toContain("greyz");
    expect(variants).toContain("GREYZ");
    expect(variants).toContain("grey-z");
    expect(variants).toContain("grey_z");
    expect(variants).toContain("grey.z");
    expect(variants).toContain("greyz");
    expect(variants).toContain("greyxz");
    expect(variants).toContain("grey-x-z");
  });

  it("handles multi-word phrases", () => {
    const variants = generateVariants("glitched stardust");
    expect(variants[0]).toBe("glitched stardust");
    expect(variants).toContain("glitched-stardust");
    expect(variants).toContain("glitched_stardust");
    expect(variants).toContain("glitched.stardust");
    expect(variants).toContain("glitchedstardust");
    expect(variants).toContain("glitchedxstardust");
  });

  it("handles k-dot-greyz without inventing punctuation soup beyond the join set", () => {
    const variants = generateVariants("k-dot-greyz");
    expect(variants[0]).toBe("k-dot-greyz");
    expect(variants).toContain("k.dot.greyz");
    expect(variants).toContain("k_dot_greyz");
    expect(variants).toContain("kdotgreyz");
  });

  it("does not explode past the cap", () => {
    expect(generateVariants("greyZxMusic").length).toBeLessThanOrEqual(48);
  });
});

describe("serviceHandle", () => {
  it("prefers the original spelling when it already fits the platform", () => {
    expect(
      serviceHandle("greyZ", {
        handlePattern: "^[A-Za-z0-9-]{1,39}$",
      }),
    ).toBe("greyZ");
    expect(
      serviceHandle("k-dot-greyz", {
        handlePattern: "^[A-Za-z0-9-]{1,39}$",
      }),
    ).toBe("k-dot-greyz");
  });

  it("collapses domains to LDH", () => {
    expect(
      serviceHandle("greyZ", {
        kind: "domain",
        forceLower: true,
        handlePattern: "^[a-z0-9-]{1,63}$",
      }),
    ).toBe("greyz");
  });

  it("returns null when the pattern cannot be satisfied", () => {
    expect(
      serviceHandle("!!", {
        handlePattern: "^[A-Za-z0-9-]{1,39}$",
      }),
    ).toBeNull();
  });
});
