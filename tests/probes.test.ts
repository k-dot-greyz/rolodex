import { describe, expect, it } from "vitest";
import { probeTarget } from "@lib/check/probes";
import type { FetchLike } from "@lib/check/client";

function jsonResponse(status: number, body = "{}"): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("probeTarget", () => {
  it("treats GitHub API 404 as free", async () => {
    const fetchImpl: FetchLike = async () => jsonResponse(404, '{"message":"Not Found"}');
    const result = await probeTarget(
      {
        platform: "github",
        handle: "definitely-not-this-user-xyz",
        url: "https://github.com/definitely-not-this-user-xyz",
        method: "github-api",
      },
      fetchImpl,
      () => "2026-10-08T00:00:00Z",
    );
    expect(result.availability).toBe("free");
    expect(result.method).toBe("github-api");
    expect(result.checkedAt).toBe("2026-10-08T00:00:00Z");
  });

  it("does not treat a profile HTTP 404 as free", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
    const result = await probeTarget(
      {
        platform: "instagram",
        handle: "greyZ",
        url: "https://www.instagram.com/greyZ/",
        method: "http-profile",
      },
      fetchImpl,
      () => "2026-10-08T00:00:00Z",
    );
    expect(result.availability).toBe("unknown");
    expect(result.reason).toBe("http-404-untrusted");
  });

  it("leaves Spotify as unknown with no-public-api", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("should not fetch");
    };
    const result = await probeTarget(
      {
        platform: "spotify",
        handle: "greyz",
        url: "https://open.spotify.com/search/greyz/artists",
        method: "manual",
      },
      fetchImpl,
      () => "2026-10-08T00:00:00Z",
    );
    expect(result).toMatchObject({
      availability: "unknown",
      reason: "no-public-api",
      method: "manual",
    });
  });
});
