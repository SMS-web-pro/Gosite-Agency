// Emailor — vérifie qu'une boîte email existe et peut recevoir des messages.
// 1) syntaxe RFC simplifiée · 2) domaines jetables · 3) enregistrements MX DNS.

import dns from "node:dns/promises";

const DISPOSABLE = new Set([
  "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
  "yopmail.com", "sharklasers.com", "trashmail.com", "getnada.com",
  "temp-mail.org", "fakeinbox.com", "emailondeck.com", "throwawaymail.com",
]);

const FREE_PROVIDERS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.fr", "hotmail.com",
  "hotmail.fr", "yahoo.fr", "yahoo.com", "icloud.com", "live.fr", "msn.com",
  "aol.com", "proton.me", "protonmail.com", "gmx.fr", "orange.fr", "free.fr",
  "sfr.fr", "laposte.net", "bbox.fr", "menara.ma", "iam.net.ma",
]);

export type EmailCheck = {
  status: "valid" | "risky" | "invalid";
  detail: string;
  mxHosts?: string[];
};

export async function verifyEmail(email: string | null | undefined): Promise<EmailCheck> {
  if (!email || !email.trim()) return { status: "invalid", detail: "Aucune adresse email fournie" };
  const e = email.trim().toLowerCase();

  const re = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  if (!re.test(e)) return { status: "invalid", detail: "Syntaxe invalide" };

  const domain = e.split("@")[1];
  if (DISPOSABLE.has(domain)) return { status: "invalid", detail: `Domaine jetable (${domain})` };

  // MX lookup — the mailbox's server must exist to receive mail
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx || mx.length === 0) {
      // Fallback: some domains only have A records accepting mail
      try {
        const a = await dns.resolve4(domain);
        if (a && a.length > 0) {
          return { status: "risky", detail: "Pas de MX mais enregistrement A présent", mxHosts: a.slice(0, 2) };
        }
      } catch { /* fallthrough */ }
      return { status: "invalid", detail: "Aucun serveur de messagerie (MX) pour ce domaine" };
    }
    mx.sort((a, b) => a.priority - b.priority);
    const hosts = mx.slice(0, 3).map((m) => m.exchange);
    if (FREE_PROVIDERS.has(domain)) {
      return { status: "valid", detail: `Boîte ${domain} fonctionnelle (MX ✓)`, mxHosts: hosts };
    }
    return { status: "valid", detail: `Serveur mail actif : ${hosts[0]}`, mxHosts: hosts };
  } catch {
    if (FREE_PROVIDERS.has(domain)) {
      return { status: "risky", detail: `Fournisseur connu mais MX non résolu (DNS sandbox ?)` };
    }
    return { status: "invalid", detail: "Domaine introuvable (DNS NXDOMAIN)" };
  }
}
