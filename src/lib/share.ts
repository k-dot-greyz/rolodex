import type { AliasEntry, Confidence } from "./schema";

export type ShareLink = {
  platform: string;
  url: string;
  handle: string;
};

export type SharePayload = {
  kind: "alias" | "rolodex";
  id: string;
  handle: string;
  title: string;
  text: string;
  url: string;
  links: ShareLink[];
};

export type ShareableAlias = {
  id: string;
  handle: string;
  confidence: Confidence;
  public?: boolean | undefined;
};

/**
 * Unconfirmed aliases are excluded unless `public: true`.
 * Confirmed aliases share by default. Probable needs an explicit public flag.
 */
export function isShareableAlias(alias: ShareableAlias): boolean {
  if (alias.public === true) return true;
  if (alias.public === false) return false;
  return alias.confidence === "confirmed";
}

export function confirmedPublicLinks(
  entries: readonly AliasEntry[],
  aliasId?: string,
): ShareLink[] {
  const links: ShareLink[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (entry.confidence !== "confirmed") continue;
    if (!entry.profileUrl) continue;
    if (aliasId && entry.aliasId && entry.aliasId !== aliasId) continue;
    if (aliasId && !entry.aliasId && !handleMatches(entry.handle, aliasId)) {
      continue;
    }
    const url = entry.profileUrl;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({
      platform: entry.platform,
      url,
      handle: entry.handle,
    });
  }

  return links;
}

export function buildAliasSharePayload(input: {
  alias: ShareableAlias;
  entries: readonly AliasEntry[];
  site: string;
  ownerDisplayName: string;
}): SharePayload | null {
  if (!isShareableAlias(input.alias)) return null;

  const links = confirmedPublicLinks(input.entries, input.alias.id);
  const url = canonicalAliasUrl(input.site, input.alias.id);
  const text = formatShareText(input.alias.handle, links);

  return {
    kind: "alias",
    id: input.alias.id,
    handle: input.alias.handle,
    title: `${input.alias.handle} · ${input.ownerDisplayName} rolodex`,
    text,
    url,
    links,
  };
}

export function buildRolodexSharePayload(input: {
  aliases: readonly ShareableAlias[];
  entries: readonly AliasEntry[];
  site: string;
  ownerDisplayName: string;
  canonicalId: string;
}): SharePayload {
  const shareable = input.aliases.filter(isShareableAlias);
  const ids = new Set(shareable.map((a) => a.id));
  const links = confirmedPublicLinks(input.entries).filter((link) => {
    const entry = input.entries.find(
      (e) => e.profileUrl === link.url && e.confidence === "confirmed",
    );
    if (!entry) return false;
    if (entry.aliasId) return ids.has(entry.aliasId);
    return shareable.some(
      (a) =>
        a.handle.toLowerCase() === entry.handle.toLowerCase() ||
        handleMatches(entry.handle, a.id),
    );
  });

  const unique = uniqueLinks(links);
  const names = shareable.map((a) => a.handle).join(", ");

  return {
    kind: "rolodex",
    id: "rolodex",
    handle: input.ownerDisplayName,
    title: `${input.ownerDisplayName} · rolodex`,
    text:
      unique.length > 0
        ? `${names} — ${unique.map((l) => l.url).join(" · ")}`
        : names,
    url: canonicalSiteUrl(input.site),
    links: unique,
  };
}

export function canonicalSiteUrl(site: string): string {
  return site.replace(/\/+$/, "");
}

export function canonicalAliasUrl(site: string, id: string): string {
  return `${canonicalSiteUrl(site)}/a/${id}`;
}

export function formatShareText(handle: string, links: readonly ShareLink[]): string {
  if (links.length === 0) return handle;
  return `${handle} — ${links.map((l) => l.url).join(" · ")}`;
}

function uniqueLinks(links: readonly ShareLink[]): ShareLink[] {
  const seen = new Set<string>();
  const out: ShareLink[] = [];
  for (const link of links) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    out.push(link);
  }
  return out;
}

function handleMatches(handle: string, aliasId: string): boolean {
  const slug = handle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === aliasId;
}

export function confidenceLabel(confidence: Confidence): string {
  return confidence;
}
