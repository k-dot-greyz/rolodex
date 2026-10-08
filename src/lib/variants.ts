/**
 * Deterministic spelling variants for an alias.
 *
 * Tokens come from whitespace, `.` `_` `-`, camelCase, and `x` used as a join
 * (greyZxMusic → greyZ + Music). Rejoin with dots, underscores, dashes, case
 * folds and `x` joins. Original spelling is always first.
 */

const MAX_VARIANTS = 48;

export type VariantSet = {
  original: string;
  variants: string[];
};

export function generateVariants(handle: string): string[] {
  return buildVariantSet(handle).variants;
}

export function buildVariantSet(handle: string): VariantSet {
  const original = handle.trim();
  if (!original) {
    return { original, variants: [] };
  }

  const tokens = tokenize(original);
  const out = new Set<string>();
  out.add(original);

  const casedTokenLists = [
    tokens,
    tokens.map((t) => t.toLowerCase()),
    tokens.map((t) => t.toUpperCase()),
    tokens.map(titleCase),
  ];

  const separators = [".", "-", "_", ""] as const;
  for (const list of casedTokenLists) {
    for (const sep of separators) {
      out.add(list.join(sep));
    }
  }

  if (tokens.length >= 2) {
    const lower = tokens.map((t) => t.toLowerCase());
    const xJoins = ["x", "X", "-x-", "_x_", ".x."] as const;
    for (const join of xJoins) {
      out.add(lower.join(join));
    }
  }

  const collapsed = original.replace(/[^A-Za-z0-9]/g, "");
  if (collapsed) {
    out.add(collapsed);
    out.add(collapsed.toLowerCase());
    out.add(collapsed.toUpperCase());
  }

  const sorted = [...out].filter((v) => v.length > 0);
  sorted.sort((a, b) => {
    if (a === original) return -1;
    if (b === original) return 1;
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });

  return {
    original,
    variants: sorted.slice(0, MAX_VARIANTS),
  };
}

export function tokenize(handle: string): string[] {
  const trimmed = handle.trim();
  if (!trimmed) return [];

  const withXSplit = trimmed.replace(
    /(?<=[A-Za-z0-9])[xX](?=[A-Z])/g,
    "\u0000",
  );
  const withCamel = withXSplit.replace(/([a-z0-9])([A-Z])/g, "$1\u0000$2");
  const parts = withCamel.split(/[\s._\-\u0000]+/g).filter(Boolean);
  return parts.length > 0 ? parts : [trimmed];
}

export function serviceHandle(
  aliasHandle: string,
  options: {
    forceLower?: boolean | undefined;
    handlePattern?: string | undefined;
    kind?: "profile" | "package" | "domain" | undefined;
  } = {},
): string | null {
  const tokens = tokenize(aliasHandle);
  const candidates: string[] = [];
  const original = aliasHandle.trim().replace(/\s+/g, "");
  if (original) candidates.push(options.forceLower ? original.toLowerCase() : original);
  const joined =
    options.kind === "domain" || options.kind === "package"
      ? tokens.join("").toLowerCase()
      : tokens.join("-");
  if (joined) candidates.push(options.forceLower ? joined.toLowerCase() : joined);
  candidates.push(tokens.join("").toLowerCase());

  const unique = [...new Set(candidates.filter(Boolean))];
  if (!options.handlePattern) {
    return unique[0] ?? null;
  }
  try {
    const re = new RegExp(options.handlePattern);
    return unique.find((candidate) => re.test(candidate)) ?? null;
  } catch {
    return unique[0] ?? null;
  }
}

function titleCase(token: string): string {
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}
