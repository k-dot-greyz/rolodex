import { describe, expect, it } from "vitest";
import {
  canReportFree,
  classifyProbe,
  countStatuses,
  toDisplayStatus,
} from "@lib/status";
import { classifyResponse } from "@lib/check/classify";
import type { AliasEntry, StatusResult } from "@lib/schema";

const claim: AliasEntry = {
  handle: "k-dot-greyz",
  platform: "github",
  profileUrl: "https://github.com/k-dot-greyz",
  confidence: "confirmed",
  evidenceUrls: ["https://github.com/k-dot-greyz"],
  firstSeen: "2024-09-09T00:00:00Z",
  aliasId: "k-dot-greyz",
};

function probe(partial: Partial<StatusResult>): StatusResult {
  return {
    platform: "github",
    handle: "k-dot-greyz",
    url: "https://github.com/k-dot-greyz",
    availability: "taken",
    httpStatus: 200,
    method: "github-api",
    checkedAt: "2026-10-08T00:00:00Z",
    reason: null,
    ...partial,
  };
}

describe("classifyProbe", () => {
  it("treats official-API 404 as free", () => {
    expect(classifyProbe({ httpStatus: 404, method: "github-api" })).toEqual({
      availability: "free",
      reason: "not-found",
    });
    expect(classifyProbe({ httpStatus: 404, method: "npm-registry" }).availability).toBe(
      "free",
    );
    expect(classifyProbe({ httpStatus: 404, method: "crates-api" }).availability).toBe(
      "free",
    );
    expect(classifyProbe({ httpStatus: 404, method: "pypi-json" }).availability).toBe(
      "free",
    );
    expect(classifyProbe({ httpStatus: 404, method: "rdap" }).availability).toBe(
      "free",
    );
  });

  it("never reports free from an HTTP profile 404", () => {
    expect(classifyProbe({ httpStatus: 404, method: "http-profile" })).toEqual({
      availability: "unknown",
      reason: "http-404-untrusted",
    });
    expect(canReportFree("http-profile")).toBe(false);
  });

  it("maps 200 to taken", () => {
    expect(classifyProbe({ httpStatus: 200, method: "github-api" }).availability).toBe(
      "taken",
    );
  });

  it("maps login walls, 429s and challenges to unknown with a reason", () => {
    expect(classifyProbe({ httpStatus: 200, method: "http-profile", loginWall: true })).toEqual({
      availability: "unknown",
      reason: "login-wall",
    });
    expect(classifyProbe({ httpStatus: 429, method: "http-profile" })).toEqual({
      availability: "unknown",
      reason: "rate-limited",
    });
    expect(
      classifyProbe({ httpStatus: 403, method: "http-profile", challenge: true }),
    ).toEqual({
      availability: "unknown",
      reason: "bot-challenge",
    });
  });
});

describe("classifyResponse", () => {
  it("detects cloudflare challenge copy", () => {
    const result = classifyResponse({
      httpStatus: 403,
      method: "http-profile",
      headers: { "cf-mitigated": "challenge" },
      bodySnippet: "Just a moment...",
    });
    expect(result).toEqual({ availability: "unknown", reason: "bot-challenge" });
  });

  it("does not treat GitHub's JSON `login` field as a login wall", () => {
    const result = classifyResponse({
      httpStatus: 200,
      method: "github-api",
      headers: { "content-type": "application/json" },
      bodySnippet: '{"login":"k-dot-greyz","id":1}',
    });
    expect(result.availability).toBe("taken");
  });
});

describe("toDisplayStatus", () => {
  it("keeps claimed URLs unknown until a probe verifies them", () => {
    const display = toDisplayStatus({ probe: undefined, claim });
    expect(display.status).toBe("unknown");
    expect(display.reason).toBe("claimed-unverified");
  });

  it("marks a verified confirmed claim as taken-by-him", () => {
    const display = toDisplayStatus({
      probe: probe({ availability: "taken" }),
      claim,
    });
    expect(display.status).toBe("taken-by-him");
  });

  it("marks a taken handle without a confirmed claim as taken-by-other", () => {
    const display = toDisplayStatus({
      probe: probe({
        handle: "greyz",
        url: "https://github.com/greyz",
        availability: "taken",
      }),
      claim: undefined,
    });
    expect(display.status).toBe("taken-by-other");
  });

  it("refuses free when the method cannot provide positive evidence", () => {
    const display = toDisplayStatus({
      probe: probe({
        method: "http-profile",
        availability: "free",
        httpStatus: 404,
      }),
      claim: undefined,
    });
    expect(display.status).toBe("unknown");
    expect(display.reason).toBe("free-without-positive-evidence");
  });

  it("counts pills", () => {
    expect(
      countStatuses(["taken-by-him", "free", "unknown", "taken-by-other", "unknown"]),
    ).toEqual({ him: 1, other: 1, free: 1, unknown: 2 });
  });
});
