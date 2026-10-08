import type {
  AliasEntry,
  CheckMethod,
  DisplayStatus,
  ProbeAvailability,
  StatusResult,
} from "./schema";

const POSITIVE_FREE_METHODS: ReadonlySet<CheckMethod> = new Set([
  "github-api",
  "npm-registry",
  "crates-api",
  "pypi-json",
  "rdap",
]);

export type ProbeInput = {
  httpStatus: number | null;
  method: CheckMethod;
  loginWall?: boolean | undefined;
  challenge?: boolean | undefined;
  rateLimited?: boolean | undefined;
  error?: string | null | undefined;
};

export type ProbeClassification = {
  availability: ProbeAvailability;
  reason: string | null;
};

/**
 * Map a raw probe onto taken / free / unknown.
 * `free` is only allowed from official APIs / RDAP with a positive 404
 * (or equivalent not-found). HTTP profile checks never yield free.
 */
export function classifyProbe(input: ProbeInput): ProbeClassification {
  if (input.rateLimited || input.httpStatus === 429) {
    return { availability: "unknown", reason: "rate-limited" };
  }
  if (input.challenge) {
    return { availability: "unknown", reason: "bot-challenge" };
  }
  if (input.loginWall) {
    return { availability: "unknown", reason: "login-wall" };
  }
  if (input.error) {
    return { availability: "unknown", reason: input.error };
  }
  if (input.httpStatus === null) {
    return { availability: "unknown", reason: "no-response" };
  }

  if (input.httpStatus === 404) {
    if (POSITIVE_FREE_METHODS.has(input.method)) {
      return { availability: "free", reason: "not-found" };
    }
    return {
      availability: "unknown",
      reason: "http-404-untrusted",
    };
  }

  if (input.httpStatus === 200 || input.httpStatus === 301) {
    return { availability: "taken", reason: null };
  }

  if (input.httpStatus === 401 || input.httpStatus === 403) {
    return { availability: "unknown", reason: "forbidden" };
  }

  return {
    availability: "unknown",
    reason: `http-${input.httpStatus}`,
  };
}

export function canReportFree(method: CheckMethod): boolean {
  return POSITIVE_FREE_METHODS.has(method);
}

export type DisplayInput = {
  probe: StatusResult | undefined;
  claim: AliasEntry | undefined;
};

/**
 * UI status. Claimed URLs stay `unknown` until a probe verifies them.
 * A confirmed claim plus a `taken` probe on the same URL/handle → taken-by-him.
 */
export function toDisplayStatus(input: DisplayInput): {
  status: DisplayStatus;
  reason: string | null;
  method: CheckMethod | null;
  checkedAt: string | null;
} {
  const { probe, claim } = input;

  if (!probe) {
    return {
      status: "unknown",
      reason: claim?.profileUrl
        ? "claimed-unverified"
        : "not-checked",
      method: null,
      checkedAt: null,
    };
  }

  if (probe.availability === "unknown") {
    return {
      status: "unknown",
      reason: probe.reason,
      method: probe.method,
      checkedAt: probe.checkedAt,
    };
  }

  if (probe.availability === "free") {
    if (!canReportFree(probe.method)) {
      return {
        status: "unknown",
        reason: "free-without-positive-evidence",
        method: probe.method,
        checkedAt: probe.checkedAt,
      };
    }
    return {
      status: "free",
      reason: probe.reason,
      method: probe.method,
      checkedAt: probe.checkedAt,
    };
  }

  const him = isTakenByHim(probe, claim);
  return {
    status: him ? "taken-by-him" : "taken-by-other",
    reason: probe.reason,
    method: probe.method,
    checkedAt: probe.checkedAt,
  };
}

export function isTakenByHim(
  probe: StatusResult,
  claim: AliasEntry | undefined,
): boolean {
  if (!claim || claim.confidence !== "confirmed") return false;
  const probeUrl = normalizeUrl(probe.url);
  const claimUrl = normalizeUrl(claim.profileUrl ?? null);
  if (probeUrl && claimUrl && probeUrl === claimUrl) return true;
  return (
    claim.platform === probe.platform &&
    claim.handle.toLowerCase() === probe.handle.toLowerCase()
  );
}

export function statusKey(platform: string, handle: string): string {
  return `${platform.toLowerCase()}:${handle.toLowerCase()}`;
}

export function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.hash = "";
    let path = u.pathname;
    if (path.endsWith("/") && path.length > 1) {
      path = path.slice(0, -1);
    }
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return url;
  }
}

export type StatusCounts = {
  him: number;
  other: number;
  free: number;
  unknown: number;
};

export function countStatuses(statuses: DisplayStatus[]): StatusCounts {
  const counts: StatusCounts = { him: 0, other: 0, free: 0, unknown: 0 };
  for (const status of statuses) {
    if (status === "taken-by-him") counts.him += 1;
    else if (status === "taken-by-other") counts.other += 1;
    else if (status === "free") counts.free += 1;
    else counts.unknown += 1;
  }
  return counts;
}
