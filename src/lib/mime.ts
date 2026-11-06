// Parsing du MIME brut reçu du Worker Cloudflare (postal-mime côté serveur).
// Le Worker n'importe plus rien : il POST le raw en base64 + les champs
// d'enveloppe. Ici on parse, et en cas d'échec on retombe sur les champs
// fallback fournis par l'enveloppe (message.from, headers Cloudflare).
import PostalMime from "postal-mime";
import type { InboundHeaders } from "./inbound";

export type ParsedEmail = {
  messageId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string | undefined>;
};

const MAX_RAW_B64 = 4 * 1024 * 1024; // 3 Mo de MIME ≈ 4 Mo de base64

export async function parseRawEmail(rawB64: string | undefined, fallback: ParsedEmail): Promise<ParsedEmail> {
  if (!rawB64 || rawB64.length > MAX_RAW_B64) return fallback;
  try {
    const buf = Buffer.from(rawB64, "base64");
    if (buf.length === 0) return fallback;
    const mime = await PostalMime.parse(buf);
    const h: Record<string, string | undefined> = {};
    for (const item of mime.headers ?? []) {
      h[item.key] = typeof item.value === "string" ? item.value : undefined;
    }
    const fromAddress = typeof mime.from?.address === "string" ? mime.from.address : "";
    return {
      messageId: mime.messageId || fallback.messageId || "",
      fromEmail: fromAddress || fallback.fromEmail || "",
      fromName: typeof mime.from?.name === "string" ? mime.from.name : fallback.fromName || "",
      subject: typeof mime.subject === "string" ? mime.subject : fallback.subject || "",
      text: typeof mime.text === "string" ? mime.text : "",
      html: typeof mime.html === "string" ? mime.html : "",
      headers: {
        ...fallback.headers,
        ...h,
        autoSubmitted: h["auto-submitted"] ?? fallback.headers.autoSubmitted,
        precedence: h["precedence"] ?? fallback.headers.precedence,
        autoReplySuppressed: h["x-auto-response-suppress"] ?? fallback.headers.autoReplySuppressed,
        autorespond: h["x-autorespond"] ?? fallback.headers.autorespond,
        listId: h["list-id"] ?? fallback.headers.listId,
        contentType: h["content-type"] ?? fallback.headers.contentType,
        xFailedRecipients: h["x-failed-recipients"] ?? fallback.headers.xFailedRecipients,
        inReplyTo: mime.inReplyTo || h["in-reply-to"] || fallback.headers.inReplyTo,
        references: mime.references || h["references"] || fallback.headers.references,
      } as InboundHeaders,
    };
  } catch {
    return fallback;
  }
}
