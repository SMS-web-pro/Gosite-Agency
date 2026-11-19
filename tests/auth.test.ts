import {
  signSession,
  verifySession,
  shouldRenewSession,
  secureEqual,
  loginDecision,
  hashToken,
  SESSION_TTL_MS,
} from "./_lib/auth.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

async function main() {
  // sign/verify roundtrip
  const token = await signSession("sid-123");
  const p = await verifySession(token);
  check("roundtrip: sid conservé", p?.sid === "sid-123");
  check("roundtrip: ttl 24h", p !== null && p.exp - p.iat === SESSION_TTL_MS);

  // format : v1.payload.signature
  check("format: 3 parties v1", /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token));

  // signature modifiée → null
  // Corrompt un caractère AU MILIEU de la signature : le dernier caractère
  // base64url porte des bits de padding parfois ignorés au décodage (flaky).
  const sigParts = token.split(".");
  const sig = sigParts[2];
  const mid = Math.floor(sig.length / 2);
  const bad = `${sigParts[0]}.${sigParts[1]}.${sig.slice(0, mid)}${sig[mid] === "A" ? "B" : "A"}${sig.slice(mid + 1)}`;
  check("tamper: signature corrompue → null", (await verifySession(bad)) === null);

  // payload modifié → null
  const parts = token.split(".");
  const forged = `${parts[0]}.${btoa(JSON.stringify({ sid: "hack", iat: Date.now(), exp: Date.now() + 999999 })).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}.${parts[2]}`;
  check("forgery: payload substitué → null", (await verifySession(forged)) === null);

  // expiré → null
  const expired = await signSession("sid-2", Date.now() - SESSION_TTL_MS - 1000);
  check("expiry: token expiré → null", (await verifySession(expired)) === null);

  // renouvellement glissant : iat récent → non ; iat > 12h → oui
  const fresh = await signSession("sid-3");
  const fp = (await verifySession(fresh))!;
  check("renew: token frais → non", shouldRenewSession(fp) === false);
  const old = await signSession("sid-4", Date.now() - 13 * 3600 * 1000);
  const op = (await verifySession(old))!;
  check("renew: token de 13h → oui", shouldRenewSession(op) === true);

  // comparaison timing-safe
  check("secureEqual: égal", (await secureEqual("abc", "abc")) === true);
  check("secureEqual: différent", (await secureEqual("abc", "abd")) === false);
  check("secureEqual: longueurs différentes", (await secureEqual("abc", "abcd")) === false);
  check("secureEqual: vide", (await secureEqual("", "")) === true);

  // rate limit 5 / 15 min
  const now = 1_000_000_000_000;
  const d1 = loginDecision(0, null, now);
  check("rl: 1re tentative → autorisée, count 1", d1.allowed && d1.count === 1);
  const d2 = loginDecision(4, now - 1000, now);
  check("rl: 4 existantes → autorisée, count 5", d2.allowed && d2.count === 5);
  const d3 = loginDecision(5, now - 1000, now);
  check("rl: 5 existantes → refusée", d3.allowed === false && d3.count === 5);
  const d4 = loginDecision(5, now - 16 * 60 * 1000, now);
  check("rl: fenêtre expirée → reset autorisé", d4.allowed && d4.count === 1);
  const d5 = loginDecision(5, now - 14.9 * 60 * 1000, now);
  check("rl: fenêtre pas encore expirée → refusée", d5.allowed === false);

  // hash de token : stable, hex, 64 car
  const h1 = await hashToken("token-x");
  const h2 = await hashToken("token-x");
  check("hash: déterministe", h1 === h2 && /^[0-9a-f]{64}$/.test(h1));
}

main().then(() => {
  console.log(fail ? `\n${fail} échec(s)` : "\ntout est bon");
  process.exit(fail ? 1 : 0);
});
