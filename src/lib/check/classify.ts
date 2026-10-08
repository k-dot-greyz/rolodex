import { classifyProbe, type ProbeInput } from "../status";
import type { CheckMethod } from "../schema";

const CHALLENGE_HINTS = [
  "cf-mitigated",
  "just a moment",
  "attention required",
  "enable javascript",
  "captcha",
  "challenges.cloudflare.com",
];

const LOGIN_HINTS = [
  "login",
  "log in",
  "sign in",
  "signin",
  "create an account",
];

export function hintsFromHeadersAndBody(
  headers: Headers | Record<string, string>,
  bodySnippet: string | null,
): Pick<ProbeInput, "challenge" | "loginWall" | "rateLimited"> {
  const joinedHeaders = headersToString(headers).toLowerCase();
  const body = (bodySnippet ?? "").toLowerCase();
  const haystack = `${joinedHeaders}\n${body}`;

  const challenge = CHALLENGE_HINTS.some((hint) => haystack.includes(hint));
  const loginWall = LOGIN_HINTS.some((hint) => haystack.includes(hint));
  const rateLimited =
    joinedHeaders.includes("retry-after") && haystack.includes("429");

  return { challenge, loginWall, rateLimited };
}

export function classifyResponse(input: {
  httpStatus: number | null;
  method: CheckMethod;
  headers?: Headers | Record<string, string> | undefined;
  bodySnippet?: string | null | undefined;
  error?: string | null | undefined;
}): ReturnType<typeof classifyProbe> {
  const htmlHints =
    input.method === "http-profile" && input.headers
      ? hintsFromHeadersAndBody(input.headers, input.bodySnippet ?? null)
      : {};
  const rateLimited =
    input.httpStatus === 429 ||
    (input.headers ? headersToString(input.headers).toLowerCase().includes("retry-after") && input.httpStatus === 403 : false);
  return classifyProbe({
    httpStatus: input.httpStatus,
    method: input.method,
    error: input.error,
    ...htmlHints,
    ...(rateLimited ? { rateLimited: true } : {}),
  });
}

function headersToString(headers: Headers | Record<string, string>): string {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const parts: string[] = [];
    headers.forEach((value, key) => {
      parts.push(`${key}: ${value}`);
    });
    return parts.join("\n");
  }
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}
