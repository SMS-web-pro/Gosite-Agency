import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";

export const AGENT_DEFINITIONS = [
  {
    key: "prospector",
    name: "Prospector",
    roleTitle: "Scout — Prospection",
    description:
      "Trouve des entreprises locales via Serper.dev. Tourne avec les 2500 crédits gratuits par compte, détecte l'épuisement du quota et provisionne automatiquement un nouveau compte de remplacement.",
    icon: "Radar",
    color: "#22D3EE",
    sortOrder: 1,
  },
  {
    key: "validator",
    name: "Validator",
    roleTitle: "Qualification GMB",
    description:
      "Qualifie les fiches Google : note ≥ 4,0 étoiles, ≥ 10 avis, AUCUN site web existant, et une adresse email de contact exploitable.",
    icon: "BadgeCheck",
    color: "#34D399",
    sortOrder: 2,
  },
  {
    key: "emailor",
    name: "Emailor",
    roleTitle: "Vérification Email",
    description:
      "Vérifie que la boîte email existe et peut recevoir des messages : syntaxe, domaines jetables, enregistrements MX, score de délivrabilité.",
    icon: "MailCheck",
    color: "#A78BFA",
    sortOrder: 3,
  },
  {
    key: "mapper",
    name: "Mapper",
    roleTitle: "Fiche Client",
    description:
      "Remplit et valide la fiche client complète : identité, coordonnées, horaires, palette couleurs sectorielle, Schema.org, langue et direction.",
    icon: "ClipboardList",
    color: "#FBBF24",
    sortOrder: 4,
  },
  {
    key: "coder",
    name: "Coder",
    roleTitle: "VibeCoder — Création du site",
    description:
      "Développeur full-stack senior : livre un fichier HTML unique, live-ready, au niveau d'un expert humain. 16 sections, animations, SEO local, zéro placeholder.",
    icon: "Code2",
    color: "#F472B6",
    sortOrder: 5,
  },
  {
    key: "deployer",
    name: "Deployer",
    roleTitle: "Déploiement Vercel",
    description:
      "Déploie le site sur Vercel via token : sous-domaine {clientId}.{domaine-agence}. Fallback vers une prévisualisation sandbox si aucun token n'est configuré.",
    icon: "Rocket",
    color: "#60A5FA",
    sortOrder: 6,
  },
  {
    key: "saler",
    name: "Saler",
    roleTitle: "Agent Commercial",
    description:
      "Envoie l'offre par email professionnel et personnalisé via Brevo SMTP : lien de prévisualisation du site créé pour eux + proposition commerciale claire.",
    icon: "Send",
    color: "#FB923C",
    sortOrder: 7,
  },
  {
    key: "paymer",
    name: "Paymer",
    roleTitle: "Paiement Whop",
    description:
      "Génère le lien de paiement Whop et suit l'encaissement. Notifie RIO sur Telegram dès qu'un client paie.",
    icon: "CreditCard",
    color: "#4ADE80",
    sortOrder: 8,
  },
  {
    key: "domainner",
    name: "Domainner",
    roleTitle: "Gestion Domaines",
    description:
      "Lie le domaine personnalisé du client (ou son sous-domaine agence) au déploiement Vercel, configure les DNS.",
    icon: "Globe",
    color: "#38BDF8",
    sortOrder: 9,
  },
  {
    key: "support",
    name: "Support",
    roleTitle: "Support Client",
    description:
      "Répond aux clients et applique les modifications demandées sur le site (contenu, horaires, couleurs) puis redéploie.",
    icon: "LifeBuoy",
    color: "#E879F9",
    sortOrder: 10,
  },
] as const;

export type AgentKey = (typeof AGENT_DEFINITIONS)[number]["key"];

export async function ensureAgentsSeeded() {
  const { ensureSchema } = await import("@/db/bootstrap");
  await ensureSchema();
  for (const def of AGENT_DEFINITIONS) {
    const existing = await db.select().from(agents).where(eq(agents.key, def.key)).limit(1);
    if (existing.length === 0) {
      await db.insert(agents).values({
        key: def.key,
        name: def.name,
        roleTitle: def.roleTitle,
        description: def.description,
        icon: def.icon,
        color: def.color,
        sortOrder: def.sortOrder,
        status: "ready",
      });
    }
  }
}

export async function markAgentRunStart(key: AgentKey) {
  await db
    .update(agents)
    .set({ status: "running", lastRunAt: new Date(), updatedAt: new Date() })
    .where(eq(agents.key, key));
}

export async function markAgentRunEnd(key: AgentKey, ok: boolean, error?: string) {
  const rows = await db.select().from(agents).where(eq(agents.key, key)).limit(1);
  const row = rows[0];
  if (!row) return;
  const s = row.stats ?? { runs: 0, successes: 0, failures: 0 };
  await db
    .update(agents)
    .set({
      status: ok ? "ready" : "error",
      lastError: ok ? null : (error ?? "Erreur inconnue"),
      stats: {
        runs: s.runs + 1,
        successes: s.successes + (ok ? 1 : 0),
        failures: s.failures + (ok ? 0 : 1),
      },
      updatedAt: new Date(),
    })
    .where(eq(agents.key, key));
}
