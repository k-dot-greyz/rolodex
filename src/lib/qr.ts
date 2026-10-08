import { encode } from "uqr";

export function qrSvg(
  value: string,
  options: {
    size?: number | undefined;
    color?: string | undefined;
    background?: string | undefined;
  } = {},
): string {
  const { data, size } = encode(value, { ecc: "M" });
  const px = options.size ?? 128;
  const color = options.color ?? "#00fff9";
  const background = options.background ?? "#0A0A0A";
  const cell = px / size;
  const rects: string[] = [];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (data[y]?.[x]) {
        rects.push(
          `<rect x="${(x * cell).toFixed(3)}" y="${(y * cell).toFixed(3)}" width="${(cell + 0.02).toFixed(3)}" height="${(cell + 0.02).toFixed(3)}"/>`,
        );
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${px}" width="${px}" height="${px}" role="img" aria-label="QR code for ${escapeXml(value)}"><rect width="${px}" height="${px}" fill="${background}"/><g fill="${color}">${rects.join("")}</g></svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
