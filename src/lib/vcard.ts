import type { SharePayload } from "./share";

/**
 * Public vCard only: FN / NICKNAME / URL. No EMAIL, no TEL, no private notes.
 */
export function toVCard(
  payload: SharePayload,
  options: { ownerDisplayName: string; rev?: string | undefined } = {
    ownerDisplayName: "Kaspars Greizis",
  },
): string {
  const fn =
    payload.kind === "rolodex" ? options.ownerDisplayName : payload.handle;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(fn)}`,
    `NICKNAME:${escapeVCard(payload.handle)}`,
  ];

  for (const link of payload.links) {
    lines.push(`URL;TYPE=${escapeVCard(link.platform)}:${link.url}`);
  }

  lines.push(`REV:${options.rev ?? defaultRev()}`);
  lines.push("END:VCARD");
  return `${lines.join("\r\n")}\r\n`;
}

export function vcardDataUrl(vcf: string): string {
  return `data:text/vcard;charset=utf-8,${encodeURIComponent(vcf)}`;
}

export function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function defaultRev(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
