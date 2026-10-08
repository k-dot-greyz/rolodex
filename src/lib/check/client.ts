export const CHECKER_UA =
  "RolodexChecker/0.1 (+https://github.com/k-dot-greyz/rolodex)";

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type RateLimitOptions = {
  minIntervalMs: number;
  timeoutMs: number;
  fetch?: FetchLike | undefined;
};

export function createPoliteFetcher(options: RateLimitOptions): FetchLike {
  let lastAt = 0;
  const fetchImpl = options.fetch ?? fetch;

  return async (input, init = {}) => {
    const wait = options.minIntervalMs - (Date.now() - lastAt);
    if (wait > 0) {
      await sleep(wait);
    }
    lastAt = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const headers = new Headers(init.headers);
      if (!headers.has("user-agent")) {
        headers.set("user-agent", CHECKER_UA);
      }
      headers.set("accept", headers.get("accept") ?? "application/json, text/html;q=0.8, */*;q=0.5");
      return await fetchImpl(input, {
        ...init,
        headers,
        redirect: init.redirect ?? "follow",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
