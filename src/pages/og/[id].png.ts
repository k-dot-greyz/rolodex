import type { APIRoute } from "astro";
import { buildDeck, findCard } from "@lib/deck";
import { ogForCard, ogForDeck, renderOgPng } from "@lib/og";

export function getStaticPaths() {
  const deck = buildDeck("https://k-dot-greyz.github.io/rolodex");
  return [
    { params: { id: "rolodex" } },
    ...deck.cards.map((card) => ({ params: { id: card.id } })),
  ];
}

export const GET: APIRoute = async ({ params }) => {
  const site = import.meta.env.SITE ?? "https://k-dot-greyz.github.io/rolodex";
  const deck = buildDeck(String(site).replace(/\/+$/, ""));
  const id = params.id ?? "rolodex";
  const payload =
    id === "rolodex"
      ? ogForDeck(deck)
      : (() => {
          const card = findCard(deck, id);
          if (!card) return ogForDeck(deck);
          return ogForCard(card, deck.ownerDisplayName);
        })();
  const png = await renderOgPng(payload);
  return new Response(Buffer.from(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
