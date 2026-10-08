import { Resvg } from "@resvg/resvg-js";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import type { CardModel, DeckModel } from "./deck";

const WIDTH = 1200;
const HEIGHT = 630;

export async function renderOgPng(input: {
  title: string;
  subtitle: string;
  stats?: { him: number; other: number; free: number; unknown: number } | undefined;
  unconfirmed?: boolean | undefined;
}): Promise<Uint8Array> {
  const svg = ogSvg(input);
  const font = loadInterFont();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: font
      ? {
          fontFiles: [font],
          loadSystemFonts: true,
          defaultFontFamily: "Inter",
        }
      : { loadSystemFonts: true },
  });
  return resvg.render().asPng();
}

export function ogForCard(card: CardModel, owner: string): Parameters<typeof renderOgPng>[0] {
  return {
    title: card.handle,
    subtitle: `${owner} · rolodex`,
    stats: card.stats,
    unconfirmed: card.confidence === "unconfirmed",
  };
}

export function ogForDeck(deck: DeckModel): Parameters<typeof renderOgPng>[0] {
  const totals = deck.cards.reduce(
    (acc, card) => ({
      him: acc.him + card.stats.him,
      other: acc.other + card.stats.other,
      free: acc.free + card.stats.free,
      unknown: acc.unknown + card.stats.unknown,
    }),
    { him: 0, other: 0, free: 0, unknown: 0 },
  );
  return {
    title: "rolodex",
    subtitle: `${deck.ownerDisplayName} · ${deck.cards.length} aliases`,
    stats: totals,
  };
}

export function ogSvg(input: {
  title: string;
  subtitle: string;
  stats?: { him: number; other: number; free: number; unknown: number } | undefined;
  unconfirmed?: boolean | undefined;
}): string {
  const stats = input.stats;
  const statLine = stats
    ? `his ${stats.him}  ·  other ${stats.other}  ·  free ${stats.free}  ·  unknown ${stats.unknown}`
    : "";
  const badge = input.unconfirmed
    ? `<rect x="72" y="470" width="220" height="36" rx="4" fill="rgba(255,180,0,0.15)" /><text x="82" y="494" fill="#ffb400" font-size="18" font-family="Inter, DejaVu Sans, sans-serif" letter-spacing="0.12em">UNCONFIRMED</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0A0A0A"/>
  <defs>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="2" fill="rgba(0,255,249,0.035)"/>
    </pattern>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#00fff9"/>
      <stop offset="1" stop-color="#ff2d6f"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#scan)"/>
  <path d="M48 48 h80 v4 h-76 v76 h-4 z" fill="#00fff9"/>
  <path d="M1152 582 h-80 v-4 h76 v-76 h4 z" fill="#ff2d6f"/>
  <text x="72" y="140" fill="#ff2d6f" font-size="22" font-family="JetBrains Mono, Fira Code, DejaVu Sans Mono, monospace" letter-spacing="0.28em">// ROLODEX</text>
  <text x="74" y="268" fill="rgba(255,0,0,0.55)" font-size="72" font-family="Inter, DejaVu Sans, sans-serif" font-weight="600">${escapeXml(input.title)}</text>
  <text x="70" y="268" fill="rgba(0,255,255,0.55)" font-size="72" font-family="Inter, DejaVu Sans, sans-serif" font-weight="600">${escapeXml(input.title)}</text>
  <text x="72" y="268" fill="#F0F0F0" font-size="72" font-family="Inter, DejaVu Sans, sans-serif" font-weight="600">${escapeXml(input.title)}</text>
  <rect x="72" y="300" width="320" height="3" fill="url(#rule)"/>
  <text x="72" y="360" fill="#c4d4e8" font-size="28" font-family="Inter, DejaVu Sans, sans-serif">${escapeXml(input.subtitle)}</text>
  <text x="72" y="430" fill="#8b919a" font-size="22" font-family="JetBrains Mono, Fira Code, DejaVu Sans Mono, monospace">${escapeXml(statLine)}</text>
  ${badge}
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadInterFont(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require.resolve("@fontsource/inter/package.json");
    const woff = pkg.replace(/package\.json$/, "files/inter-latin-600-normal.woff");
    if (existsSync(woff)) return woff;
  } catch {
    // fall through to system fonts
  }
  const candidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ];
  return candidates.find((path) => {
    try {
      readFileSync(path);
      return true;
    } catch {
      return false;
    }
  });
}
