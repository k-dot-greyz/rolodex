import type { APIRoute } from "astro";
import { buildDeck, findCard } from "@lib/deck";
import { toVCard } from "@lib/vcard";

export function getStaticPaths() {
  const deck = buildDeck("https://k-dot-greyz.github.io/rolodex");
  return deck.cards
    .filter((card) => card.share)
    .map((card) => ({ params: { id: card.id } }));
}

export const GET: APIRoute = async ({ params }) => {
  const site = String(import.meta.env.SITE ?? "https://k-dot-greyz.github.io/rolodex").replace(
    /\/+$/,
    "",
  );
  const deck = buildDeck(site);
  const card = findCard(deck, params.id ?? "");
  if (!card?.share) {
    return new Response("Not shareable", { status: 404 });
  }
  const vcf = toVCard(card.share, {
    ownerDisplayName: deck.ownerDisplayName,
    rev: "20261008T000000Z",
  });
  return new Response(vcf, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${card.id}.vcf"`,
    },
  });
};
