// Logique pure des entrants email : filtres anti-boucle/anti-backscatter,
// extraction du texte nouveau, coercition de la décision LLM. Aucun import :
// ce module est copié tel quel par le runner de tests.

export type InboundHeaders = {
  autoSubmitted?: string;
  precedence?: string;
  autoReplySuppressed?: string;
  autorespond?: string;
  listId?: string;
  contentType?: string;
  xFailedRecipients?: string;
  inReplyTo?: string;
  references?: string;
};

export const RATE_PER_ADDRESS_24H = 2;
const SHORT_UNMATCHED_MAX = 20;
const REPLY_MAX_CHARS = 2000;

const LOCAL_PARTS_AUTO = ["mailer-daemon", "postmaster", "noreply", "no-reply"];

// Les auto-répondeurs citent presque toujours nos footers (« Répondez STOP… ») :
// toute vérification d'opt-out ou d'intention porte sur le texte NOUVEAU
// uniquement — coupé au premier marqueur de citation.
const QUOTE_MARKERS: RegExp[] = [
  /^>/,
  /^De\s*:/i,
  /^From:/i,
  /^-{3,}\s*(original message|message d'origine)/i,
  /^Le .+ a écrit/i,
  /^On .+ wrote/i,
];

// Notre footer cité n'arrive pas toujours en début de ligne (email html-only
// aplati en une seule ligne) : coupe pleine-ligne en plus des marqueurs ancrés.
const INLINE_FOOTER = /r[ée]pon[dt](ez|s)?\s*(«\s*)?stop|pour ne plus (être|etre) contact/i;

export function extractNewText(body: string): string {
  const raw = body ?? "";
  const footerCut = raw.search(INLINE_FOOTER);
  const bounded = footerCut > 0 ? raw.slice(0, footerCut) : raw;
  const kept: string[] = [];
  for (const line of bounded.split("\n")) {
    const t = line.trim();
    if (QUOTE_MARKERS.some((m) => m.test(t))) break;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

export function stripHtml(html: string): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const truthy = (v: string | undefined) => {
  const t = (v ?? "").trim().toLowerCase();
  return t !== "" && t !== "no" && t !== "false";
};

export function isAutoReply(h: InboundHeaders, fromEmail: string): boolean {
  if (truthy(h.autoSubmitted)) return true;
  if (truthy(h.autoReplySuppressed)) return true;
  if (truthy(h.autorespond)) return true;
  if ((h.listId ?? "").trim() !== "") return true;
  const prec = (h.precedence ?? "").trim().toLowerCase();
  if (["bulk", "junk", "list"].includes(prec)) return true;
  const local = (fromEmail ?? "").split("@")[0]?.toLowerCase() ?? "";
  return LOCAL_PARTS_AUTO.includes(local);
}

export function isDeliveryStatus(h: InboundHeaders, subject: string): boolean {
  if ((h.contentType ?? "").toLowerCase().includes("report-type=delivery-status")) return true;
  if ((h.xFailedRecipients ?? "").trim() !== "") return true;
  const s = (subject ?? "").toLowerCase();
  return s.includes("undelivered") || s.includes("mail delivery") || s.includes("échec de remise");
}

export function isOwnAddress(fromEmail: string, ownAddresses: string[]): boolean {
  const from = (fromEmail ?? "").trim().toLowerCase();
  return ownAddresses.some((a) => a && a.trim().toLowerCase() === from);
}

export function normalizeMessageIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\s+/)
    .map((id) => id.replace(/^</, "").replace(/>$/, "").trim().toLowerCase())
    .filter(Boolean)
    .filter((id, i, arr) => arr.indexOf(id) === i);
}

const AGENTS = ["saler", "paymer", "support"] as const;
export type InboundAgent = (typeof AGENTS)[number];

export function coerceInboundDecision(
  raw: unknown,
): { agent: InboundAgent; reply: string; needsHuman: boolean } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const agentRaw = typeof o.agent === "string" ? o.agent.toLowerCase().trim() : "";
  if (!AGENTS.includes(agentRaw as InboundAgent)) return null;
  const agent = agentRaw as InboundAgent;
  const reply = typeof o.reply === "string" ? o.reply.trim() : "";
  if (!reply) return null;
  return { agent, reply, needsHuman: o.needsHuman === true };
}

export function sanitizeReplyUrls(reply: string, allowedUrls: string[]): string {
  const allowed = allowedUrls.filter(Boolean);
  let out = (reply ?? "").replace(/https?:\/\/\S+/gi, (url) => {
    const bare = url.replace(/[.,;:!?)\]]+$/, "");
    return allowed.some((a) => bare.toLowerCase().startsWith(a.toLowerCase())) ? url : "";
  }).replace(/\s{2,}/g, " ").trim();
  if (out.length > REPLY_MAX_CHARS) out = out.slice(0, REPLY_MAX_CHARS);
  return out;
}

// Un client rattaché n'est jamais ignoré pour cause de message court (« Oui »).
// Le seuil ne sert qu'à écarter le bruit des adresses inconnues.
export function shouldIgnoreShortUnmatched(text: string, matched: boolean): boolean {
  if (matched) return false;
  return (text ?? "").trim().length < SHORT_UNMATCHED_MAX;
}
