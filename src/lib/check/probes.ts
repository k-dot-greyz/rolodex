import type { CheckMethod, StatusResult } from "../schema";
import { classifyResponse } from "./classify";
import type { FetchLike } from "./client";
import { CHECKER_UA } from "./client";

export type ProbeTarget = {
  platform: string;
  handle: string;
  url: string | null;
  method: CheckMethod;
  tld?: string | undefined;
};

export async function probeTarget(
  target: ProbeTarget,
  fetchImpl: FetchLike,
  now: () => string = () => new Date().toISOString(),
): Promise<StatusResult> {
  try {
    switch (target.method) {
      case "github-api":
        return await probeJson({
          target,
          fetchImpl,
          now,
          endpoint: `https://api.github.com/users/${encodeURIComponent(target.handle)}`,
        });
      case "npm-registry":
        return await probeJson({
          target,
          fetchImpl,
          now,
          endpoint: `https://registry.npmjs.org/${encodeURIComponent(target.handle)}`,
        });
      case "crates-api":
        return await probeJson({
          target,
          fetchImpl,
          now,
          endpoint: `https://crates.io/api/v1/crates/${encodeURIComponent(target.handle)}`,
        });
      case "pypi-json":
        return await probeJson({
          target,
          fetchImpl,
          now,
          endpoint: `https://pypi.org/pypi/${encodeURIComponent(target.handle)}/json`,
        });
      case "rdap": {
        const domain = target.tld
          ? `${target.handle}.${target.tld}`
          : target.handle;
        return await probeJson({
          target,
          fetchImpl,
          now,
          endpoint: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
        });
      }
      case "http-profile":
        return await probeHttpProfile(target, fetchImpl, now);
      case "manual":
        return unknownResult(target, now(), "no-public-api");
      default: {
        const _never: never = target.method;
        return unknownResult(target, now(), "unsupported-method", _never);
      }
    }
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "timeout"
        : error instanceof Error
          ? error.message
          : "probe-failed";
    return unknownResult(target, now(), reason);
  }
}

async function probeJson(input: {
  target: ProbeTarget;
  fetchImpl: FetchLike;
  now: () => string;
  endpoint: string;
}): Promise<StatusResult> {
  const response = await input.fetchImpl(input.endpoint, {
    method: "GET",
    headers: {
      "user-agent": CHECKER_UA,
      accept: "application/json",
    },
  });
  const snippet = await readSnippet(response);
  const classified = classifyResponse({
    httpStatus: response.status,
    method: input.target.method,
    headers: response.headers,
    bodySnippet: snippet,
  });
  return {
    platform: input.target.platform,
    handle: input.target.handle,
    url: input.target.url,
    availability: classified.availability,
    httpStatus: response.status,
    method: input.target.method,
    checkedAt: input.now(),
    reason: classified.reason,
  };
}

async function probeHttpProfile(
  target: ProbeTarget,
  fetchImpl: FetchLike,
  now: () => string,
): Promise<StatusResult> {
  if (!target.url) {
    return unknownResult(target, now(), "missing-url");
  }
  const response = await fetchImpl(target.url, {
    method: "GET",
    headers: {
      "user-agent": CHECKER_UA,
      accept: "text/html,application/xhtml+xml",
    },
  });
  const snippet = await readSnippet(response);
  const classified = classifyResponse({
    httpStatus: response.status,
    method: "http-profile",
    headers: response.headers,
    bodySnippet: snippet,
  });
  return {
    platform: target.platform,
    handle: target.handle,
    url: target.url,
    availability: classified.availability,
    httpStatus: response.status,
    method: "http-profile",
    checkedAt: now(),
    reason: classified.reason,
  };
}

async function readSnippet(response: Response): Promise<string | null> {
  try {
    const text = await response.clone().text();
    return text.slice(0, 1500);
  } catch {
    return null;
  }
}

function unknownResult(
  target: ProbeTarget,
  checkedAt: string,
  reason: string,
  _unused?: never,
): StatusResult {
  void _unused;
  return {
    platform: target.platform,
    handle: target.handle,
    url: target.url,
    availability: "unknown",
    httpStatus: null,
    method: target.method,
    checkedAt,
    reason,
  };
}
