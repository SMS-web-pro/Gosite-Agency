import { SiteSpecSchema } from "./_lib/site-spec.schema.ts";
import { specFixture } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const clone = () => JSON.parse(JSON.stringify(specFixture));

const ok = SiteSpecSchema.safeParse(clone());
check("fixture valide", ok.success);

const paths = (r: { success: false; error: { issues: { path: (string | number)[] }[] } } | { success: true }) =>
  r.success ? [] : r.error.issues.map((i) => i.path.join("."));
const fails = (n: string, mut: (o: ReturnType<typeof clone>) => void, path?: string) => {
  const o = clone();
  mut(o);
  const r = SiteSpecSchema.safeParse(o);
  const p = paths(r as never);
  check(n, !r.success && (!path || p.some((x) => x === path || x.startsWith(path + "."))));
  return p;
};

fails("couleur invalide rejetée", (o) => { o.palette.primary = "red"; }, "palette.primary");
fails("headline trop court rejeté", (o) => { o.homeSections[0].headline = "Court"; }, "homeSections.0.headline");
fails("section inconnue rejetée", (o) => { o.homeSections[0] = { type: "slider" }; }, "homeSections.0");
fails("homeSections < 5 rejeté", (o) => { o.homeSections = o.homeSections.slice(0, 4); }, "homeSections");
fails("businessModel inconnu rejeté", (o) => { o.businessModel = "gym"; }, "businessModel");
fails("servicePages < 3 rejeté", (o) => { o.servicePages = o.servicePages.slice(0, 2); }, "servicePages");
fails("metaTitle > 60 rejeté", (o) => { o.metaTitle = "x".repeat(61); }, "metaTitle");
fails("lang > 5 rejeté", (o) => { o.lang = "français"; }, "lang");
fails("slug service invalide rejeté", (o) => { o.servicePages[0].slug = "Réparation Fuites"; }, "servicePages.0.slug");
fails("page légale < 3 sections rejetée", (o) => { o.privacyPage.sections = o.privacyPage.sections.slice(0, 2); }, "privacyPage.sections");

const t = clone();
t.homeSections.push({
  type: "testimonials",
  title: "Avis clients",
  items: [
    { name: "Marie", role: "Cliente", text: "Intervention rapide et propre, je recommande.", rating: 5 },
    { name: "Paul", text: "Devis clair, travail sérieux.", rating: 3 },
  ],
});
const tr = SiteSpecSchema.safeParse(t);
check("section testimonials valide acceptée", tr.success);

const trBad = clone();
trBad.homeSections.push({
  type: "testimonials",
  title: "Avis clients",
  items: [
    { name: "Marie", text: "Intervention rapide et propre.", rating: 2 },
    { name: "Paul", text: "Devis clair, travail sérieux.", rating: 5 },
  ],
});
check("rating 2 rejeté", !SiteSpecSchema.safeParse(trBad).success);

const stripped = SiteSpecSchema.safeParse({ ...clone(), champInconnu: "x" });
check("champ inconnu ignoré (objet strippé)", stripped.success && !("champInconnu" in stripped.data));

// ── 5.1 — Contenu généré : cohérence métier et SEO ──────────────────────────
{
  const gym = clone();
  gym.businessModel = "membership";
  gym.homeSections[0] = {
    type: "hero" as const,
    headline: "Salle de sport à Marrakech pour toute la famille",
    subheadline: "Musculation, cardio et coaching personnalisé dans un espace moderne et accueillant.",
    primaryCta: { label: "Réserver une séance", action: "booking" as const },
    secondaryCta: { label: "Voir les formules", action: "scroll" as const },
    chips: ["Essai gratuit", "Coaching inclus", "Ouvert 7j/7"],
    style: "centered" as const,
  };
  gym.homeSections[1] = {
    type: "services" as const,
    title: "Nos formules",
    layout: "grid-3" as const,
    items: [
      { title: "Musculation", slug: "musculation", shortDesc: "Un plateau complet et des coachs disponibles.", icon: "dumbbell" },
      { title: "Coaching personnel", slug: "coaching-personnel", shortDesc: "Un programme sur mesure avec suivi hebdomadaire.", icon: "user" },
      { title: "Cours collectifs", slug: "cours-collectifs", shortDesc: "Yoga, danse et renforcement en petit groupe.", icon: "users" },
    ],
  };

  const r = SiteSpecSchema.safeParse(gym);
  check("5.1 gym: SiteSpec valide", r.success);
  check("5.1 gym: businessModel membership", r.success && r.data.businessModel === "membership");
  check("5.1 plombier: businessModel contractor", specFixture.businessModel === "contractor");
  check("5.1 slugs: kebab-case (pages + sections)", [
    ...gym.servicePages.map((s) => s.slug),
    ...(gym.homeSections.find((s) => s.type === "services") as { items: { slug: string }[] }).items.map((i) => i.slug),
  ].every((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)));
  check("5.1 seo: metaTitle < 60 et metaDescription < 160", gym.metaTitle.length < 60 && gym.metaDescription.length < 160);
  check("5.1 sections: hero + contact", gym.homeSections.some((s) => s.type === "hero") && gym.homeSections.some((s) => s.type === "contact"));

  const collect = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
    else if (v && typeof v === "object") Object.values(v).forEach((x) => collect(x, out));
    return out;
  };
  // On ignore les valeurs machine (actions "call"/"scroll"…) : on ne scanne
  // que les textes éditoriaux, hors URLs et identifiants techniques.
  const english = /\b(the|and|your|with|free|quote|get|our|you|we|are|request|now|trusted|local|today|quality|expert|welcome)\b/i;
  const offenders = collect(gym).filter((s) => !/^[a-z-]+$/.test(s) && english.test(s));
  check("5.1 gym FR: aucun mot anglais", offenders.length === 0 && gym.homeSections[0].type === "hero" && gym.homeSections[0].primaryCta.label === "Réserver une séance");
}

process.exit(fail ? 1 : 0);
