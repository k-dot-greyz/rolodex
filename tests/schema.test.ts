import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  deriveAliases,
  parseAliasIndex,
  parseServiceCatalog,
  parseStatusFile,
  slugifyAliasId,
} from "@lib/schema";
import aliases from "@data/aliases.json";
import services from "@data/services.json";
import statuses from "@data/statuses.json";

describe("alias index schema", () => {
  it("accepts the seeded aliases.json", () => {
    const index = parseAliasIndex(aliases);
    expect(index.canonicalId).toBe("human:k-dot-greyz");
    expect(index.entries[0]?.profileUrl).toBe("https://github.com/k-dot-greyz");
    expect(index.aliases?.map((a) => a.handle)).toEqual([
      "greyZ",
      "k.greyZ",
      "k-dot-greyz",
      "Kaspars Greizis",
      "greyZxMusic",
      "damn.fractal",
      "al.paca",
      "glitched stardust",
    ]);
  });

  it("rejects invented empty handles", () => {
    expect(() =>
      parseAliasIndex({
        canonicalId: "human:k-dot-greyz",
        entries: [
          {
            handle: "",
            platform: "github",
            confidence: "confirmed",
            evidenceUrls: [],
            firstSeen: "2024-09-09T00:00:00Z",
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts a sweep-style file with only entries and derives cards", () => {
    const index = parseAliasIndex({
      canonicalId: "human:k-dot-greyz",
      entries: [
        {
          handle: "k-dot-greyz",
          platform: "github",
          profileUrl: "https://github.com/k-dot-greyz",
          confidence: "confirmed",
          evidenceUrls: ["https://github.com/k-dot-greyz"],
          firstSeen: "2024-09-09T00:00:00Z",
        },
        {
          handle: "greyZ",
          platform: "x",
          profileUrl: null,
          confidence: "unconfirmed",
          evidenceUrls: [],
          firstSeen: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const derived = deriveAliases(index);
    expect(derived.map((a) => a.id).sort()).toEqual(["greyz", "k-dot-greyz"]);
  });

  it("ignores extra sweep fields", () => {
    const parsed = parseAliasIndex({
      canonicalId: "human:k-dot-greyz",
      extra: { sweep: "v2" },
      entries: [
        {
          handle: "k-dot-greyz",
          platform: "github",
          profileUrl: "https://github.com/k-dot-greyz",
          confidence: "confirmed",
          evidenceUrls: ["https://github.com/k-dot-greyz"],
          firstSeen: "2024-09-09T00:00:00Z",
          source: "github-search",
        },
      ],
    });
    expect(parsed.canonicalId).toBe("human:k-dot-greyz");
  });

  it("does not embed emails in the seed file", () => {
    const raw = readFileSync(
      resolve(process.cwd(), "src/data/aliases.json"),
      "utf8",
    );
    expect(raw).not.toMatch(/@pm\.me|@gmail\.com|mailto:/i);
  });
});

describe("related schemas", () => {
  it("accepts the service catalog and status file", () => {
    expect(parseServiceCatalog(services).services.length).toBeGreaterThan(10);
    const file = parseStatusFile(statuses);
    expect(file.checker).toMatch(/rolodex-checker/);
    expect(Array.isArray(file.results)).toBe(true);
  });

  it("slugifies handles the way permalinks need", () => {
    expect(slugifyAliasId("glitched stardust")).toBe("glitched-stardust");
    expect(slugifyAliasId("k.greyZ")).toBe("k-greyz");
  });
});
