import type { APIRoute } from "astro";
import { buildDeck } from "@lib/deck";
import { toVCard } from "@lib/vcard";

export const GET: APIRoute = async () => {
  const site = String(import.meta.env.SITE ?? "https://k-dot-greyz.github.io/rolodex").replace(
    /\/+$/,
    "",
  );
  const deck = buildDeck(site);
  const vcf = toVCard(deck.share, {
    ownerDisplayName: deck.ownerDisplayName,
    rev: "20261008T000000Z",
  });
  return new Response(vcf, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'attachment; filename="greyz-rolodex.vcf"',
    },
  });
};
