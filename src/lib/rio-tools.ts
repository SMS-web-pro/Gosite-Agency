// La boîte à outils de RIO — chaque outil est une action réelle sur l'agence.
// Utilisée en function-calling par le LLM, et par le parseur d'intentions de secours.

import { db } from "@/db";
import { agents, prospects, activities, objectives, leadNotes, scoutSchedules, serperKeys } from "@/db/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { logActivity } from "./activity";
import {
  runScoutMission, runBulkValidation, runFullPipeline, validateProspect, verifyProspectEmail,
  mapProspect, buildProspectSite, deployProspectSite, contactProspect, createPaymentLink, linkProspectDomain,
} from "./pipeline";
import { STAGE_META } from "./pipeline";

export type ToolResult = { ok: boolean; summary: string; data?: unknown };

/* ───────────── Schémas d'outils (format OpenAI tools) ───────────── */
export const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "get_dashboard",
      description: "Vue d'ensemble de l'agence : compteurs par étape du pipeline, KPIs, état des intégrations et des agents. À utiliser pour toute question sur l'état général, les chiffres, la performance.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_leads",
      description: "Liste les leads, filtrable par étape, ville ou recherche texte. Utiliser avant toute action sur un lead dont on ne connaît pas l'ID.",
      parameters: {
        type: "object",
        properties: {
          stage: { type: "string", description: "discovered|validated|email_verified|mapped|site_built|deployed|contacted|paid|domain_linked|rejected" },
          search: { type: "string", description: "recherche sur le nom du business ou la ville" },
          limit: { type: "number", description: "max 25, défaut 10" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_lead",
      description: "Fiche détaillée d'un lead : contact, note Google, étape, email vérifié, site généré, déploiement, paiement, notes internes.",
      parameters: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_leads",
      description: "Supprime définitivement un ou plusieurs leads. Peut aussi purger tous les leads rejetés avec purge_rejected=true.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "number" }, description: "IDs à supprimer" },
          purge_rejected: { type: "boolean", description: "supprime tous les leads au stade 'rejected'" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "scout",
      description: "Lance une mission de prospection Serper.dev sur une niche et une ville, puis qualifie automatiquement. Par défaut en mode essaim (3-5 requêtes complémentaires pour couvrir la ville).",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "ex: barbershop, restaurant, plombier, dentiste" },
          city: { type: "string" },
          max: { type: "number", description: "nombre de fiches cibles (essaim : 30-60)" },
          strategy: { type: "string", description: "swarm (défaut, essaim de requêtes) | precise (requête unique)" },
        },
        required: ["niche", "city"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "advance_lead",
      description: "Fait avancer un lead dans le pipeline. action='full' exécute tout le pipeline jusqu'à l'envoi de l'offre.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number" },
          action: { type: "string", description: "full|validate|verify|map|build|deploy|contact|payment|domain" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "validate_all",
      description: "Lance Validator sur tous les leads en attente de qualification.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "control_agent",
      description: "Met en pause ou réactive un agent de l'équipe (prospector, validator, emailor, mapper, coder, deployer, saler, paymer, domainner, support).",
      parameters: {
        type: "object",
        properties: { agent: { type: "string" }, action: { type: "string", description: "pause|resume" } },
        required: ["agent", "action"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "manage_schedule",
      description: "Gère les missions de prospection récurrentes de l'auto-pilote (lister, créer, supprimer).",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "list|create|delete" },
          niche: { type: "string" },
          city: { type: "string" },
          interval_hours: { type: "number", description: "fréquence en heures, défaut 6" },
          id: { type: "number", description: "pour delete" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_autopilot",
      description: "Déclenche immédiatement un cycle complet de l'auto-pilote (missions planifiées + avancement du pipeline).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_autopilot",
      description: "Active ou désactive l'auto-pilote 24/7.",
      parameters: { type: "object", properties: { enabled: { type: "boolean" } }, required: ["enabled"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "manage_objectives",
      description: "Gère les objectifs commerciaux de l'agence (lister, créer, clôturer). Métriques: leads, qualified, deployed, contacted, paid.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "list|create|complete" },
          title: { type: "string" },
          metric: { type: "string" },
          target: { type: "number" },
          id: { type: "number" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_note",
      description: "Ajoute une note interne sur un lead (contexte, décision, consigne pour l'équipe).",
      parameters: { type: "object", properties: { id: { type: "number" }, note: { type: "string" } }, required: ["id", "note"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_activity",
      description: "Derniers événements du journal d'opérations (qui a fait quoi, erreurs incluses). Utile pour diagnostiquer un problème.",
      parameters: { type: "object", properties: { limit: { type: "number" }, level: { type: "string", description: "info|success|warn|error" } }, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "manage_skills",
      description: "Gère les compétences (skills) du cerveau IA d'un agent : lister, enseigner une nouvelle compétence, activer/désactiver. Les skills sont injectées dans chaque réflexion de l'agent.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "list|teach|toggle" },
          agent: { type: "string", description: "prospector, validator, emailor, mapper, coder, deployer, saler, paymer, domainner, support" },
          title: { type: "string", description: "intitulé court de la compétence" },
          instruction: { type: "string", description: "consigne opérationnelle précise, à la 2e personne" },
          id: { type: "number" },
          active: { type: "boolean" },
        },
        required: ["action", "agent"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "evolve_agent",
      description: "Déclenche l'auto-amélioration d'un agent : il analyse son propre journal (succès/échecs), en tire des apprentissages et se crée de nouvelles compétences. Utiliser 'all' pour toute l'équipe.",
      parameters: { type: "object", properties: { agent: { type: "string", description: "clé de l'agent, ou 'all'" } }, required: ["agent"] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_diagnostics",
      description: "Diagnostic complet de la configuration : quelles intégrations sont LIVE, lesquelles manquent, crédits Serper restants, état webhook Telegram et auto-pilote.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
] as const;

/* ───────────── Implémentations ───────────── */

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    /* ── Vue d'ensemble ── */
    case "get_dashboard": {
      const all = await db.select().from(prospects);
      const counts: Record<string, number> = {};
      for (const p of all) counts[p.stage] = (counts[p.stage] ?? 0) + 1;
      const team = await db.select().from(agents);
      const paid = all.filter((p) => p.paymentStatus === "paid").length;
      const data = {
        total: all.length,
        parEtape: counts,
        sitesGeneres: all.filter((p) => p.siteHtml).length,
        enLigne: all.filter((p) => p.deployedUrl).length,
        offresEnvoyees: all.filter((p) => p.contactedAt).length,
        payes: paid,
        agentsEnPause: team.filter((a) => a.status === "paused").map((a) => a.name),
        agentsEnErreur: team.filter((a) => a.status === "error").map((a) => `${a.name}: ${a.lastError ?? "?"}`),
      };
      return { ok: true, summary: `Pipeline: ${all.length} leads, ${data.sitesGeneres} sites, ${data.enLigne} en ligne, ${data.offresEnvoyees} offres, ${paid} payés.`, data };
    }

    /* ── Leads ── */
    case "list_leads": {
      const stage = str(args.stage);
      const search = str(args.search);
      const limit = Math.min(num(args.limit, 10), 25);
      const conds = [];
      if (stage) conds.push(eq(prospects.stage, stage));
      if (search) conds.push(or(ilike(prospects.businessName, `%${search}%`), ilike(prospects.city, `%${search}%`))!);
      const rows = await db
        .select()
        .from(prospects)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(prospects.createdAt))
        .limit(limit);
      const data = rows.map((p) => ({
        id: p.id, nom: p.businessName, ville: p.city, type: p.businessType,
        note: p.rating, avis: p.reviewCount, etape: STAGE_META[p.stage]?.label ?? p.stage,
        email: p.email ?? "aucun", emailStatut: p.emailStatus, siteEnLigne: p.deployedUrl ?? null,
        motifRejet: p.rejectReason ?? null,
      }));
      return { ok: true, summary: `${rows.length} lead(s) trouvé(s).`, data };
    }

    case "get_lead": {
      const id = num(args.id, 0);
      const rows = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
      const p = rows[0];
      if (!p) return { ok: false, summary: `Lead #${id} introuvable.` };
      const notes = await db.select().from(leadNotes).where(eq(leadNotes.prospectId, id)).orderBy(desc(leadNotes.createdAt)).limit(5);
      return {
        ok: true,
        summary: `${p.businessName} (${p.city}) — étape ${STAGE_META[p.stage]?.label ?? p.stage}.`,
        data: {
          id: p.id, nom: p.businessName, type: p.businessType, ville: p.city, adresse: p.address,
          telephone: p.phone, email: p.email, emailStatut: p.emailStatus, emailDetail: p.emailDetail,
          note: p.rating, avis: p.reviewCount, aDejaUnSite: p.hasWebsite,
          etape: STAGE_META[p.stage]?.label ?? p.stage, motifRejet: p.rejectReason,
          ficheRemplie: Boolean(p.clientData), siteGenere: Boolean(p.siteHtml),
          urlDeployee: p.deployedUrl, statutDeploiement: p.deployStatus,
          offreEnvoyeeLe: p.contactedAt, statutPaiement: p.paymentStatus, lienPaiement: p.paymentUrl,
          domaine: p.domainUrl, source: p.source, cree: p.createdAt,
          notesInternes: notes.map((n) => `${n.author}: ${n.body}`),
        },
      };
    }

    case "delete_leads": {
      if (args.purge_rejected === true) {
        const rejected = await db.select({ id: prospects.id }).from(prospects).where(eq(prospects.stage, "rejected"));
        await db.delete(prospects).where(eq(prospects.stage, "rejected"));
        await logActivity({ agentKey: "rio", action: "purge_rejetes", message: `RIO a purgé ${rejected.length} leads rejetés.`, level: "warn" });
        return { ok: true, summary: `${rejected.length} leads rejetés supprimés.` };
      }
      const ids = Array.isArray(args.ids) ? (args.ids as unknown[]).map((v) => Number(v)).filter(Boolean) : [];
      if (ids.length === 0) return { ok: false, summary: "Aucun ID fourni. Précisez les leads à supprimer ou utilisez purge_rejected." };
      const names: string[] = [];
      for (const id of ids) {
        const rows = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
        if (rows[0]) names.push(`#${id} ${rows[0].businessName}`);
        await db.delete(prospects).where(eq(prospects.id, id));
      }
      await logActivity({ agentKey: "rio", action: "suppression_leads", message: `RIO a supprimé : ${names.join(", ") || ids.join(", ")}.`, level: "warn" });
      return { ok: true, summary: `${ids.length} lead(s) supprimé(s) : ${names.join(", ")}` };
    }

    /* ── Actions pipeline ── */
    case "scout": {
      const niche = str(args.niche), city = str(args.city);
      if (!niche || !city) return { ok: false, summary: "Il me faut une niche ET une ville." };
      const strategy = str(args.strategy) === "precise" ? "precise" as const : "swarm" as const;
      const max = num(args.max, strategy === "swarm" ? 40 : 12);
      try {
        const r = await runScoutMission(niche, city, Math.min(max, 60), { telegram: false, strategy });
        const v = await runBulkValidation();
        const perQ = (r.queries ?? []).map((q) => `«${q.query}» ${q.kept}`).join(" · ");
        return {
          ok: true,
          summary: `Mission "${niche} / ${city}" (${strategy === "swarm" ? "essaim" : "précise"}) : ${r.inserted} nouveaux leads (${r.duplicates} doublons). Validator : ${v.validated} qualifiés, ${v.rejected} rejetés.` + (perQ ? ` Rendement : ${perQ}.` : ""),
          data: { inserted: r.inserted, mode: r.mode, validated: v.validated, rejected: v.rejected, queries: r.queries },
        };
      } catch (err) {
        const msg = (err instanceof Error ? err.message : "erreur").replace(/^BLOCKED:/, "");
        return { ok: false, summary: `Mission bloquée : ${msg}` };
      }
    }

    case "advance_lead": {
      const id = num(args.id, 0);
      const action = str(args.action) || "full";
      const rows = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
      const p = rows[0];
      if (!p) return { ok: false, summary: `Lead #${id} introuvable.` };
      try {
        switch (action) {
          case "validate": { const r = await validateProspect(p); return { ok: r.ok, summary: r.ok ? `${p.businessName} qualifié.` : `${p.businessName} rejeté : ${r.reason}` }; }
          case "verify": { const r = await verifyProspectEmail(p); return { ok: r.ok, summary: `${p.businessName} — email : ${r.check.detail}` }; }
          case "map": { await mapProspect(p); return { ok: true, summary: `Fiche client complétée pour ${p.businessName}.` }; }
          case "build": { const r = await buildProspectSite(p); return { ok: true, summary: `Site généré pour ${p.businessName} (moteur ${r.engine}).` }; }
          case "deploy": { const r = await deployProspectSite(p); return { ok: true, summary: `Déployé : ${r.url}` }; }
          case "contact": { await contactProspect(p); return { ok: true, summary: `Offre envoyée à ${p.email}.` }; }
          case "payment": { const r = await createPaymentLink(p); return { ok: true, summary: `Lien de paiement : ${r.url}` }; }
          case "domain": { const r = await linkProspectDomain(p); return { ok: true, summary: `Domaine lié : ${r.url}` }; }
          default: {
            const r = await runFullPipeline(p, { telegram: false });
            return { ok: r.ok, summary: r.ok ? `${p.businessName} → étape ${STAGE_META[r.stage]?.label ?? r.stage}.${r.deployedUrl ? ` Site : ${r.deployedUrl}` : ""}` : `Arrêté à ${STAGE_META[r.stage]?.label ?? r.stage} : ${r.error}` };
          }
        }
      } catch (err) {
        return { ok: false, summary: `Échec : ${err instanceof Error ? err.message : "erreur"}` };
      }
    }

    case "validate_all": {
      const r = await runBulkValidation();
      return { ok: true, summary: `Validator : ${r.validated} qualifiés, ${r.rejected} rejetés sur ${r.checked} leads examinés.`, data: r };
    }

    case "control_agent": {
      const key = str(args.agent).toLowerCase();
      const action = str(args.action).toLowerCase();
      const rows = await db.select().from(agents).where(eq(agents.key, key)).limit(1);
      if (!rows[0]) return { ok: false, summary: `Agent "${key}" inconnu.` };
      const status = action === "pause" ? "paused" : "ready";
      await db.update(agents).set({ status, updatedAt: new Date() }).where(eq(agents.key, key));
      await logActivity({ agentKey: "rio", action: `agent_${action}`, message: `RIO a ${action === "pause" ? "mis en pause" : "réactivé"} ${rows[0].name}.`, level: "info" });
      return { ok: true, summary: `${rows[0].name} ${action === "pause" ? "mis en pause" : "réactivé"}.` };
    }

    /* ── Auto-pilote ── */
    case "manage_schedule": {
      const action = str(args.action) || "list";
      if (action === "create") {
        const niche = str(args.niche), city = str(args.city);
        if (!niche || !city) return { ok: false, summary: "Niche et ville requises pour planifier." };
        const hours = Math.min(Math.max(num(args.interval_hours, 6), 1), 168);
        const rows = await db.insert(scoutSchedules).values({ niche, city, intervalHours: hours, maxResults: 12 }).returning();
        return { ok: true, summary: `Mission récurrente créée : ${niche} à ${city}, toutes les ${hours}h.`, data: rows[0] };
      }
      if (action === "delete") {
        const id = num(args.id, 0);
        await db.delete(scoutSchedules).where(eq(scoutSchedules.id, id));
        return { ok: true, summary: `Planification #${id} supprimée.` };
      }
      const rows = await db.select().from(scoutSchedules);
      return {
        ok: true,
        summary: rows.length ? `${rows.length} mission(s) récurrente(s).` : "Aucune mission récurrente configurée.",
        data: rows.map((s) => ({ id: s.id, niche: s.niche, ville: s.city, toutesLes: `${s.intervalHours}h`, active: s.active, derniereExecution: s.lastRunAt })),
      };
    }

    case "run_autopilot": {
      const { runAutopilotTick } = await import("./autopilot");
      const s = await runAutopilotTick({ force: true });
      const moved = Object.values(s.advanced).reduce((a, b) => a + b, 0);
      return { ok: true, summary: `Cycle auto-pilote : ${s.missionsRun} mission(s), ${moved} lead(s) avancé(s)${s.errors.length ? `, ${s.errors.length} blocage(s) : ${s.errors.slice(0, 2).join(" | ")}` : ""}.`, data: s };
    }

    case "set_autopilot": {
      const { setSetting } = await import("./settings");
      const enabled = args.enabled === true;
      await setSetting("AUTOPILOT", enabled ? "true" : "false");
      return { ok: true, summary: `Auto-pilote 24/7 ${enabled ? "activé" : "désactivé"}.` };
    }

    /* ── Objectifs & notes ── */
    case "manage_objectives": {
      const action = str(args.action) || "list";
      if (action === "create") {
        const title = str(args.title);
        if (!title) return { ok: false, summary: "Donnez un intitulé à l'objectif." };
        const rows = await db.insert(objectives).values({
          title, metric: str(args.metric) || "paid", target: num(args.target, 10),
        }).returning();
        await logActivity({ agentKey: "rio", action: "objectif_cree", message: `Nouvel objectif : ${title} (${rows[0].target} ${rows[0].metric}).`, level: "success" });
        return { ok: true, summary: `Objectif enregistré : ${title} — cible ${rows[0].target} ${rows[0].metric}.`, data: rows[0] };
      }
      if (action === "complete") {
        const id = num(args.id, 0);
        await db.update(objectives).set({ status: "done" }).where(eq(objectives.id, id));
        return { ok: true, summary: `Objectif #${id} clôturé.` };
      }
      const rows = await db.select().from(objectives).where(eq(objectives.status, "active"));
      const all = await db.select().from(prospects);
      const progress = (m: string) => {
        if (m === "leads") return all.length;
        if (m === "qualified") return all.filter((p) => p.stage !== "discovered" && p.stage !== "rejected").length;
        if (m === "deployed") return all.filter((p) => p.deployedUrl).length;
        if (m === "contacted") return all.filter((p) => p.contactedAt).length;
        return all.filter((p) => p.paymentStatus === "paid").length;
      };
      return {
        ok: true,
        summary: rows.length ? `${rows.length} objectif(s) actif(s).` : "Aucun objectif actif.",
        data: rows.map((o) => ({ id: o.id, titre: o.title, cible: `${progress(o.metric)}/${o.target} ${o.metric}` })),
      };
    }

    case "add_note": {
      const id = num(args.id, 0);
      const note = str(args.note);
      const rows = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
      if (!rows[0]) return { ok: false, summary: `Lead #${id} introuvable.` };
      await db.insert(leadNotes).values({ prospectId: id, author: "RIO", body: note });
      await logActivity({ agentKey: "rio", action: "note_ajoutee", message: `Note sur ${rows[0].businessName} : ${note.slice(0, 80)}`, level: "info", prospectId: id });
      return { ok: true, summary: `Note ajoutée sur ${rows[0].businessName}.` };
    }

    /* ── Observabilité ── */
    case "get_activity": {
      const limit = Math.min(num(args.limit, 12), 30);
      const level = str(args.level);
      const rows = await db
        .select()
        .from(activities)
        .where(level ? eq(activities.level, level) : undefined)
        .orderBy(desc(activities.createdAt))
        .limit(limit);
      return {
        ok: true,
        summary: `${rows.length} événement(s).`,
        data: rows.map((a) => ({ agent: a.agentKey, action: a.action, message: a.message, niveau: a.level, quand: a.createdAt })),
      };
    }

    /* ── Cerveau IA des agents ── */
    case "manage_skills": {
      const { agentSkills, agentLearnings } = await import("@/db/schema");
      const { ensureCoreSkills } = await import("./agent-brain");
      await ensureCoreSkills();
      const agent = str(args.agent).toLowerCase();
      const action = str(args.action) || "list";

      if (action === "teach") {
        const title = str(args.title), instruction = str(args.instruction);
        if (!title || !instruction) return { ok: false, summary: "Il me faut un intitulé ET une instruction précise pour enseigner cette compétence." };
        await db.insert(agentSkills).values({ agentKey: agent, title: title.slice(0, 80), instruction: instruction.slice(0, 800), source: "user" });
        await logActivity({ agentKey: agent, action: "skill_ajoutee", message: `RIO a enseigné une compétence à ${agent} : « ${title} »`, level: "success" });
        return { ok: true, summary: `Compétence « ${title} » enseignée à ${agent}. Elle sera injectée dès sa prochaine réflexion.` };
      }
      if (action === "toggle") {
        const id = num(args.id, 0);
        await db.update(agentSkills).set({ active: args.active === true }).where(eq(agentSkills.id, id));
        return { ok: true, summary: `Compétence #${id} ${args.active === true ? "activée" : "désactivée"}.` };
      }
      const [skills, learnings] = await Promise.all([
        db.select().from(agentSkills).where(eq(agentSkills.agentKey, agent)),
        db.select().from(agentLearnings).where(eq(agentLearnings.agentKey, agent)).orderBy(desc(agentLearnings.createdAt)).limit(6),
      ]);
      return {
        ok: true,
        summary: `${agent} : ${skills.filter((s) => s.active).length} compétence(s) active(s), ${learnings.length} apprentissage(s).`,
        data: {
          competences: skills.map((s) => ({ id: s.id, titre: s.title, source: s.source, active: s.active, instruction: s.instruction })),
          apprentissages: learnings.map((l) => l.insight),
        },
      };
    }

    case "evolve_agent": {
      const { evolveAgent } = await import("./agent-brain");
      const target = str(args.agent).toLowerCase();
      if (target === "all" || target === "tous") {
        const roster = ["prospector", "validator", "emailor", "mapper", "coder", "deployer", "saler", "paymer", "domainner", "support"];
        const results: string[] = [];
        for (const a of roster) {
          const r = await evolveAgent(a);
          if (r.ok && (r.skills.length || r.learnings.length)) results.push(`${a}: ${r.skills.length} skill(s), ${r.learnings.length} leçon(s)`);
        }
        return { ok: true, summary: results.length ? `Évolution de l'équipe — ${results.join(" · ")}` : "Aucun agent n'avait assez d'expérience pour évoluer.", data: results };
      }
      const r = await evolveAgent(target);
      return { ok: r.ok, summary: r.ok ? `${target} a évolué — ${r.summary}` : r.summary, data: r };
    }

    case "get_diagnostics": {
      const { getAllSettings, allowSimulation, getSetting } = await import("./settings");
      const s = await getAllSettings();
      const keys = await db.select().from(serperKeys);
      const realActive = keys.filter((k) => k.status === "active" && !k.apiKey.startsWith("AUTO-POOL"));
      const data = {
        serper: realActive.length ? `LIVE — ${realActive.length} compte(s), ${realActive.reduce((a, k) => a + (k.creditLimit - k.creditsUsed), 0)} crédits restants` : "NON CONFIGURÉ",
        telegram: s.TELEGRAM_BOT_TOKEN && s.TELEGRAM_CHAT_ID ? "LIVE" : "NON CONFIGURÉ",
        llm: s.LLM_BASE_URL && s.LLM_API_KEY ? `LIVE (${s.LLM_MODEL})` : "NON CONFIGURÉ",
        brevo: s.BREVO_API_KEY && s.BREVO_SENDER_EMAIL ? "LIVE" : "NON CONFIGURÉ",
        vercel: s.VERCEL_TOKEN ? "LIVE" : "NON CONFIGURÉ",
        whop: s.WHOP_API_KEY && s.WHOP_PLAN_ID ? "LIVE" : "NON CONFIGURÉ",
        autoPilote: (await getSetting("AUTOPILOT")) === "true" ? "ACTIF 24/7" : "EN PAUSE",
        modeTest: (await allowSimulation()) ? "ACTIVÉ (données simulées autorisées)" : "DÉSACTIVÉ (production stricte)",
        domaineAgence: s.AGENCY_DOMAIN,
        offre: `${s.OFFER_PRICE} ${s.OFFER_CURRENCY}`,
      };
      const missing = Object.entries(data).filter(([, v]) => v === "NON CONFIGURÉ").map(([k]) => k);
      return {
        ok: true,
        summary: missing.length ? `À configurer : ${missing.join(", ")}.` : "Toutes les intégrations sont LIVE.",
        data,
      };
    }

    default:
      return { ok: false, summary: `Outil inconnu : ${name}` };
  }
}
