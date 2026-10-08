import { describe, expect, it } from "vitest";
import type { Alias, AliasEntry } from "@lib/schema";
import {
  buildAliasSharePayload,
  buildRolodexSharePayload,
  confirmedPublicLinks,
  isShareableAlias,
} from "@lib/share";
import { toVCard } from "@lib/vcard";

const owner = "Kaspars Greizis";
const site = "https://example.test/rolodex";

const aliases: Alias[] = [
  { id: "greyz", handle: "greyZ", confidence: "confirmed", public: true },
  { id: "k-greyz", handle: "k.greyZ", confidence: "probable", public: false },
  {
    id: "k-dot-greyz",
    handle: "k-dot-greyz",
    confidence: "confirmed",
    public: true,
  },
  {
    id: "greyzxmusic",
    handle: "greyZxMusic",
    confidence: "unconfirmed",
    public: false,
  },
  {
    id: "al-paca",
    handle: "al.paca",
    confidence: "unconfirmed",
    public: true,
  },
];

const entries: AliasEntry[] = [
  {
    handle: "k-dot-greyz",
    platform: "github",
    profileUrl: "https://github.com/k-dot-greyz",
    confidence: "confirmed",
    evidenceUrls: ["https://github.com/k-dot-greyz"],
    firstSeen: "2024-09-09T00:00:00Z",
    aliasId: "k-dot-greyz",
  },
  {
    handle: "greyzxmusic",
    platform: "soundcloud",
    profileUrl: "https://soundcloud.com/greyzxmusic",
    confidence: "unconfirmed",
    evidenceUrls: [],
    firstSeen: "2026-01-01T00:00:00Z",
    aliasId: "greyzxmusic",
  },
  {
    handle: "al.paca",
    platform: "instagram",
    profileUrl: "https://www.instagram.com/al.paca/",
    confidence: "probable",
    evidenceUrls: [],
    firstSeen: "2026-01-01T00:00:00Z",
    aliasId: "al-paca",
  },
];

describe("isShareableAlias", () => {
  it("shares confirmed aliases by default", () => {
    expect(isShareableAlias(aliases[0]!)).toBe(true);
  });

  it("excludes unconfirmed aliases unless public", () => {
    expect(isShareableAlias(aliases[3]!)).toBe(false);
    expect(isShareableAlias(aliases[4]!)).toBe(true);
  });

  it("excludes probable aliases without an explicit public flag", () => {
    expect(isShareableAlias(aliases[1]!)).toBe(false);
  });
});

describe("confirmedPublicLinks", () => {
  it("returns only confirmed URLs", () => {
    expect(confirmedPublicLinks(entries, "k-dot-greyz")).toEqual([
      {
        platform: "github",
        url: "https://github.com/k-dot-greyz",
        handle: "k-dot-greyz",
      },
    ]);
    expect(confirmedPublicLinks(entries, "greyzxmusic")).toEqual([]);
    expect(confirmedPublicLinks(entries, "al-paca")).toEqual([]);
  });
});

describe("buildAliasSharePayload", () => {
  it("builds a permalink payload for a confirmed alias", () => {
    const payload = buildAliasSharePayload({
      alias: aliases[2]!,
      entries,
      site,
      ownerDisplayName: owner,
    });
    expect(payload).not.toBeNull();
    expect(payload?.url).toBe("https://example.test/rolodex/a/k-dot-greyz");
    expect(payload?.links).toHaveLength(1);
    expect(payload?.text).toContain("https://github.com/k-dot-greyz");
  });

  it("returns null for an unconfirmed non-public alias", () => {
    expect(
      buildAliasSharePayload({
        alias: aliases[3]!,
        entries,
        site,
        ownerDisplayName: owner,
      }),
    ).toBeNull();
  });

  it("includes a public unconfirmed alias but still drops unconfirmed links", () => {
    const payload = buildAliasSharePayload({
      alias: aliases[4]!,
      entries,
      site,
      ownerDisplayName: owner,
    });
    expect(payload?.url).toBe("https://example.test/rolodex/a/al-paca");
    expect(payload?.links).toEqual([]);
    expect(payload?.text).toBe("al.paca");
  });
});

describe("buildRolodexSharePayload", () => {
  it("aggregates only shareable aliases and confirmed links", () => {
    const payload = buildRolodexSharePayload({
      aliases,
      entries,
      site,
      ownerDisplayName: owner,
      canonicalId: "human:k-dot-greyz",
    });
    expect(payload.url).toBe("https://example.test/rolodex");
    expect(payload.text).toContain("greyZ");
    expect(payload.text).toContain("k-dot-greyz");
    expect(payload.text).not.toContain("greyZxMusic");
    expect(payload.text).not.toContain("k.greyZ");
    expect(payload.links.map((l) => l.url)).toEqual([
      "https://github.com/k-dot-greyz",
    ]);
  });
});

describe("toVCard", () => {
  it("emits public URLs only — no email or tel", () => {
    const payload = buildAliasSharePayload({
      alias: aliases[2]!,
      entries,
      site,
      ownerDisplayName: owner,
    });
    const vcf = toVCard(payload!, {
      ownerDisplayName: owner,
      rev: "20261008T000000Z",
    });
    expect(vcf).toContain("BEGIN:VCARD");
    expect(vcf).toContain("FN:k-dot-greyz");
    expect(vcf).toContain("URL;TYPE=github:https://github.com/k-dot-greyz");
    expect(vcf).not.toMatch(/EMAIL|TEL|@/);
  });
});
