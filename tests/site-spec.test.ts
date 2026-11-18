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

process.exit(fail ? 1 : 0);
