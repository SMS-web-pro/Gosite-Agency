// Sessions d'administration — tokens signés HMAC-SHA256, sans état.
// Le cookie gsd_admin ne contient JAMAIS la clé admin : uniquement un token
// signé avec SESSION_SECRET (ou une clé dérivée d'ADMIN_KEY si SESSION_SECRET
// n'est pas définie). Vérifiable en edge (proxy.ts) comme en node : Web Crypto
// uniquement, zéro import node.
//
// Table `sessions` (src/db/schema.ts) : piste d'audit (hash du token, IP, UA)
// écrite à la connexion. Le fichier bootstrap.ts crée la table en prod jusqu'à
// la migration drizzle complète.

const SESSION_COOKIE = "gsd_admin";
const SESSION_VERSION = "v1";
export { SESSION_COOKIE };

/** Durée de vie d'une session (24 h). */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
/** Au-delà de cet âge, le proxy émet un token neuf (renouvellement glissant). */
export const SESSION_RENEW_AFTER_MS = 12 * 60 * 60 * 1000;

/** Tentatives de connexion maximales par IP par fenêtre. */
export const LOGIN_MAX_ATTEMPTS = 5;
/** Fenêtre de limitation des tentatives (15 min). */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export type SessionPayload = { sid: string; iat: number; exp: number };

let hmacKey: Promise<CryptoKey> | null = null;

function sessionKey(): Promise<CryptoKey> {
  if (!hmacKey) {
    const secret =
      process.env.SESSION_SECRET?.trim() ||
      `${process.env.ADMIN_KEY || ""}::gsd-session-${SESSION_VERSION}`;
    hmacKey = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return hmacKey;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function secretEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Signe une session : v1.<payload>.<signature>.
 * @param sid identifiant de session (crypto.randomUUID())
 * @param iat émission (ms) — injectable pour les tests
 * @param ttlMs durée de vie — injectable pour les tests
 */
export async function signSession(sid: string, iat = Date.now(), ttlMs = SESSION_TTL_MS): Promise<string> {
  const payload: SessionPayload = { sid, iat, exp: iat + ttlMs };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await sessionKey(), new TextEncoder().encode(body));
  return `${SESSION_VERSION}.${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** Vérifie signature + expiration. Renvoie null si invalide. */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== SESSION_VERSION) return null;
  const body = parts[1];
  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    sigBytes = b64urlDecode(parts[2]);
  } catch {
    return null;
  }
  const ok = await crypto.subtle.verify(
    "HMAC",
    await sessionKey(),
    sigBytes,
    new TextEncoder().encode(body),
  );
  if (!ok) return null;
  let payload: SessionPayload;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SessionPayload;
    if (typeof parsed.sid !== "string" || typeof parsed.iat !== "number" || typeof parsed.exp !== "number") return null;
    payload = parsed;
  } catch {
    return null;
  }
  if (payload.exp <= Date.now()) return null;
  return payload;
}

/** Renouvellement glissant : vrai si le token a plus de SESSION_RENEW_AFTER_MS. */
export function shouldRenewSession(p: SessionPayload, now = Date.now()): boolean {
  return now - p.iat > SESSION_RENEW_AFTER_MS;
}

/**
 * Comparaison à temps constant de deux secrets : les deux chaînes sont
 * passées en SHA-256 (longueur fixe 32 octets) puis XORées octet par octet.
 */
export async function secureEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const da = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(a)));
  const dbb = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(b)));
  return secretEqualBytes(da, dbb);
}

/** SHA-256 hex d'un token — la table sessions ne stocke JAMAIS le token brut. */
export async function hashToken(token: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Décision pure du rate-limit login : 5 tentatives / 15 min par IP. */
export function loginDecision(
  count: number,
  windowStart: number | null,
  now: number,
): { allowed: boolean; count: number; windowStart: number } {
  if (windowStart === null || now - windowStart > LOGIN_WINDOW_MS) {
    return { allowed: true, count: 1, windowStart: now };
  }
  if (count >= LOGIN_MAX_ATTEMPTS) return { allowed: false, count, windowStart };
  return { allowed: true, count: count + 1, windowStart };
}
