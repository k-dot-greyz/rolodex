import { z } from "zod";

export const ConfidenceSchema = z.enum([
  "confirmed",
  "probable",
  "unconfirmed",
]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const AliasKindSchema = z.enum([
  "handle",
  "legal-name",
  "artist",
  "phrase",
]);
export type AliasKind = z.infer<typeof AliasKindSchema>;

export const AliasSchema = z.looseObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  handle: z.string().min(1),
  confidence: ConfidenceSchema,
  public: z.boolean().default(false),
  kind: AliasKindSchema.optional(),
});
export type Alias = z.infer<typeof AliasSchema>;

const isoDate = z.string().min(1);

export const AliasEntrySchema = z.looseObject({
  handle: z.string().min(1),
  platform: z.string().min(1),
  profileUrl: z.url().nullable().optional(),
  confidence: ConfidenceSchema,
  evidenceUrls: z.array(z.string()),
  firstSeen: isoDate,
  aliasId: z.string().optional(),
});
export type AliasEntry = z.infer<typeof AliasEntrySchema>;

export const AliasIndexSchema = z.looseObject({
  canonicalId: z.string().min(1),
  ownerDisplayName: z.string().optional(),
  aliases: z.array(AliasSchema).optional(),
  entries: z.array(AliasEntrySchema),
});
export type AliasIndex = z.infer<typeof AliasIndexSchema>;

export const CheckMethodSchema = z.enum([
  "github-api",
  "npm-registry",
  "crates-api",
  "pypi-json",
  "rdap",
  "http-profile",
  "manual",
]);
export type CheckMethod = z.infer<typeof CheckMethodSchema>;

export const ProbeAvailabilitySchema = z.enum(["taken", "free", "unknown"]);
export type ProbeAvailability = z.infer<typeof ProbeAvailabilitySchema>;

export const StatusResultSchema = z.looseObject({
  platform: z.string().min(1),
  handle: z.string().min(1),
  url: z.string().nullable(),
  availability: ProbeAvailabilitySchema,
  httpStatus: z.number().int().nullable(),
  method: CheckMethodSchema,
  checkedAt: z.string().min(1),
  reason: z.string().nullable(),
});
export type StatusResult = z.infer<typeof StatusResultSchema>;

export const StatusFileSchema = z.looseObject({
  generatedAt: z.string().nullable(),
  checker: z.string().min(1),
  userAgent: z.string().optional(),
  results: z.array(StatusResultSchema),
});
export type StatusFile = z.infer<typeof StatusFileSchema>;

export const ServiceKindSchema = z.enum(["profile", "package", "domain"]);
export const ServiceSchema = z.looseObject({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: ServiceKindSchema,
  urlTemplate: z.string().min(1),
  check: CheckMethodSchema,
  handlePattern: z.string().min(1),
  forceLower: z.boolean().optional(),
  tld: z.string().optional(),
});
export type Service = z.infer<typeof ServiceSchema>;

export const ServiceCatalogSchema = z.object({
  version: z.number().int(),
  services: z.array(ServiceSchema).min(1),
});
export type ServiceCatalog = z.infer<typeof ServiceCatalogSchema>;

export const DisplayStatusSchema = z.enum([
  "taken-by-him",
  "taken-by-other",
  "free",
  "unknown",
]);
export type DisplayStatus = z.infer<typeof DisplayStatusSchema>;

export function parseAliasIndex(data: unknown): AliasIndex {
  return AliasIndexSchema.parse(data);
}

export function parseStatusFile(data: unknown): StatusFile {
  return StatusFileSchema.parse(data);
}

export function parseServiceCatalog(data: unknown): ServiceCatalog {
  return ServiceCatalogSchema.parse(data);
}

export function slugifyAliasId(handle: string): string {
  return handle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * If the sweep file has only `entries` (no `aliases` array), derive one card
 * per distinct handle so swapping aliases.json still produces a deck.
 */
export function deriveAliases(index: AliasIndex): Alias[] {
  if (index.aliases && index.aliases.length > 0) {
    return index.aliases;
  }

  const seen = new Map<string, Alias>();
  for (const entry of index.entries) {
    const id = entry.aliasId ?? slugifyAliasId(entry.handle);
    const existing = seen.get(id);
    if (!existing) {
      seen.set(id, {
        id,
        handle: entry.handle,
        confidence: entry.confidence,
        public: false,
      });
      continue;
    }
    existing.confidence = higherConfidence(
      existing.confidence,
      entry.confidence,
    );
  }
  return [...seen.values()];
}

const RANK: Record<Confidence, number> = {
  unconfirmed: 0,
  probable: 1,
  confirmed: 2,
};

function higherConfidence(a: Confidence, b: Confidence): Confidence {
  return RANK[a] >= RANK[b] ? a : b;
}
