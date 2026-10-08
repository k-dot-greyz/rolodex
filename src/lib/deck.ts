import aliasesJson from "@data/aliases.json";
import servicesJson from "@data/services.json";
import statusesJson from "@data/statuses.json";
import {
  deriveAliases,
  parseAliasIndex,
  parseServiceCatalog,
  parseStatusFile,
  type Alias,
  type AliasEntry,
  type AliasIndex,
  type DisplayStatus,
  type Service,
  type StatusFile,
  type StatusResult,
} from "./schema";
import { displayVariants, generateVariants, serviceHandle } from "./variants";
import {
  countStatuses,
  statusKey,
  toDisplayStatus,
  type StatusCounts,
} from "./status";
import {
  buildAliasSharePayload,
  buildRolodexSharePayload,
  isShareableAlias,
  type SharePayload,
} from "./share";

export type ServiceRow = {
  serviceId: string;
  label: string;
  kind: Service["kind"];
  handle: string | null;
  url: string | null;
  status: DisplayStatus;
  reason: string | null;
  method: string | null;
  checkedAt: string | null;
};

export type CardModel = {
  id: string;
  handle: string;
  confidence: Alias["confidence"];
  public: boolean;
  kind: Alias["kind"];
  shareable: boolean;
  variants: string[];
  services: ServiceRow[];
  stats: StatusCounts;
  share: SharePayload | null;
};

export type DeckModel = {
  canonicalId: string;
  ownerDisplayName: string;
  cards: CardModel[];
  share: SharePayload;
};

export function loadIndex(): AliasIndex {
  return parseAliasIndex(aliasesJson);
}

export function loadCatalog(): Service[] {
  return parseServiceCatalog(servicesJson).services;
}

export function loadStatuses(): StatusFile {
  return parseStatusFile(statusesJson);
}

export function buildDeck(
  site: string,
  index: AliasIndex = loadIndex(),
  services: Service[] = loadCatalog(),
  statuses: StatusFile = loadStatuses(),
): DeckModel {
  const aliases = deriveAliases(index);
  const ownerDisplayName = index.ownerDisplayName ?? "greyZ";
  const statusMap = new Map<string, StatusResult>();
  for (const result of statuses.results) {
    statusMap.set(statusKey(result.platform, result.handle), result);
  }

  const cards = aliases.map((alias) =>
    buildCard({ alias, index, services, statusMap, site, ownerDisplayName }),
  );

  return {
    canonicalId: index.canonicalId,
    ownerDisplayName,
    cards,
    share: buildRolodexSharePayload({
      aliases,
      entries: index.entries,
      site,
      ownerDisplayName,
      canonicalId: index.canonicalId,
    }),
  };
}

function buildCard(input: {
  alias: Alias;
  index: AliasIndex;
  services: Service[];
  statusMap: Map<string, StatusResult>;
  site: string;
  ownerDisplayName: string;
}): CardModel {
  const { alias, index, services, statusMap, site, ownerDisplayName } = input;
  const variants = displayVariants(generateVariants(alias.handle));
  const rows: ServiceRow[] = services.map((service) => {
    const claim = findClaim(index.entries, alias, service.id);
    const handle =
      claim?.handle ??
      serviceHandle(alias.handle, {
        forceLower: service.forceLower,
        handlePattern: service.handlePattern,
        kind: service.kind,
      });
    const url =
      claim?.profileUrl ??
      (handle ? fillTemplate(service.urlTemplate, handle) : null);
    const probe = handle
      ? statusMap.get(statusKey(service.id, handle))
      : undefined;
    const display = toDisplayStatus({ probe, claim });

    return {
      serviceId: service.id,
      label: service.label,
      kind: service.kind,
      handle,
      url,
      status: display.status,
      reason: display.reason,
      method: display.method,
      checkedAt: display.checkedAt,
    };
  });

  return {
    id: alias.id,
    handle: alias.handle,
    confidence: alias.confidence,
    public: alias.public === true,
    kind: alias.kind,
    shareable: isShareableAlias(alias),
    variants,
    services: rows,
    stats: countStatuses(rows.map((row) => row.status)),
    share: buildAliasSharePayload({
      alias,
      entries: index.entries,
      site,
      ownerDisplayName,
    }),
  };
}

function findClaim(
  entries: readonly AliasEntry[],
  alias: Alias,
  platform: string,
): AliasEntry | undefined {
  return entries.find((entry) => {
    if (entry.platform !== platform) return false;
    if (entry.aliasId) return entry.aliasId === alias.id;
    return entry.handle.toLowerCase() === alias.handle.toLowerCase();
  });
}

function fillTemplate(template: string, handle: string): string {
  return template.replaceAll("{handle}", encodeURIComponent(handle).replaceAll("%40", "@"));
}

export function findCard(deck: DeckModel, id: string): CardModel | undefined {
  return deck.cards.find((card) => card.id === id);
}
