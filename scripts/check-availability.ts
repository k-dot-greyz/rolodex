#!/usr/bin/env npx tsx
/**
 * Build-time / scheduled availability checker.
 *
 * Runs outside the browser (no CORS). Writes src/data/statuses.json for the
 * static site to read. Official APIs + RDAP + public HTTP status only.
 *
 *   npx tsx scripts/check-availability.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAliasIndex, parseServiceCatalog, type StatusFile } from "../src/lib/schema";
import { deriveAliases } from "../src/lib/schema";
import { serviceHandle } from "../src/lib/variants";
import { CHECKER_UA, createPoliteFetcher } from "../src/lib/check/client";
import { probeTarget, type ProbeTarget } from "../src/lib/check/probes";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const aliasesPath = resolve(root, "src/data/aliases.json");
const servicesPath = resolve(root, "src/data/services.json");
const outPath = resolve(root, "src/data/statuses.json");
const cachePath = resolve(root, ".cache/checks.json");

const CACHE_TTL_MS = 20 * 60 * 60 * 1000;

type CacheFile = { results: StatusFile["results"] };

async function main(): Promise<void> {
  const index = parseAliasIndex(JSON.parse(await readFile(aliasesPath, "utf8")));
  const catalog = parseServiceCatalog(
    JSON.parse(await readFile(servicesPath, "utf8")),
  );
  const aliases = deriveAliases(index);
  const cache = await readCache();
  const fetchImpl = createPoliteFetcher({
    minIntervalMs: 350,
    timeoutMs: 8000,
  });

  const targets: ProbeTarget[] = [];
  for (const alias of aliases) {
    for (const service of catalog.services) {
      const claim = index.entries.find(
        (entry) =>
          entry.platform === service.id &&
          (entry.aliasId === alias.id ||
            entry.handle.toLowerCase() === alias.handle.toLowerCase()),
      );
      const handle =
        claim?.handle ??
        serviceHandle(alias.handle, {
          forceLower: service.forceLower,
          handlePattern: service.handlePattern,
          kind: service.kind,
        });
      if (!handle) continue;
      const url =
        claim?.profileUrl ??
        service.urlTemplate.replaceAll("{handle}", encodeURIComponent(handle));
      targets.push({
        platform: service.id,
        handle,
        url,
        method: service.check,
        ...(service.tld ? { tld: service.tld } : {}),
      });
    }
  }

  const unique = dedupe(targets);
  const results: StatusFile["results"] = [];
  const now = Date.now();

  for (const target of unique) {
    const cached = cache.results.find(
      (row) =>
        row.platform === target.platform &&
        row.handle.toLowerCase() === target.handle.toLowerCase() &&
        Date.parse(row.checkedAt) > now - CACHE_TTL_MS,
    );
    if (cached) {
      results.push(cached);
      continue;
    }
    const probed = await probeTarget(target, fetchImpl);
    results.push(probed);
    process.stderr.write(
      `${target.platform}:${target.handle} → ${probed.availability}${probed.reason ? ` (${probed.reason})` : ""}\n`,
    );
  }

  const file: StatusFile = {
    generatedAt: new Date().toISOString(),
    checker: "rolodex-checker/0.1",
    userAgent: CHECKER_UA,
    results,
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(file, null, 2)}\n`);
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify({ results }, null, 2)}\n`);
}

function dedupe(targets: ProbeTarget[]): ProbeTarget[] {
  const seen = new Set<string>();
  const out: ProbeTarget[] = [];
  for (const target of targets) {
    const key = `${target.platform}:${target.handle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(target);
  }
  return out;
}

async function readCache(): Promise<CacheFile> {
  try {
    return JSON.parse(await readFile(cachePath, "utf8")) as CacheFile;
  } catch {
    return { results: [] };
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
