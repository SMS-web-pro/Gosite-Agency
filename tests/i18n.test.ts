// Phase 12 (spec 5.3) — i18n : site FR (gym Marrakech) sans anglais ni CTA
// inadapté, site AR (Riyad) en rtl avec libellés arabes.

import { renderFullSite } from "./_lib/render.ts";
import { specFixture, specSheet } from "./spec-fixture.ts";
import type { SiteSpec } from "./_lib/site-spec.schema.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const sheet = { ...specSheet, DOMAIN: "https://demo.gosite.digital" };

// ── FR : gym à Marrakech ────────────────────────────────────────────────────
const gym = clone(specFixture) as SiteSpec;
gym.businessModel = "membership";
gym.metaTitle = "Atlas Gym — Salle de sport à Marrakech";
gym.metaDescription = "Salle de sport à Marrakech : musculation, cardio et coaching personnalisé pour tous les niveaux.";
gym.servicePages[0].metaDescription = "Musculation à Marrakech avec coach et programme personnalisé.";
gym.homeSections[0] = {
  type: "hero",
  headline: "Salle de sport à Marrakech pour toute la famille",
  subheadline: "Musculation, cardio et coaching personnalisé dans un espace moderne et accueillant.",
  primaryCta: { label: "Réserver une séance", action: "booking" },
  secondaryCta: { label: "Voir les formules", action: "scroll" },
  chips: ["Essai gratuit", "Coaching inclus", "Ouvert 7j/7"],
  style: "centered",
};
gym.homeSections[1] = {
  type: "services",
  title: "Nos formules",
  layout: "grid-3",
  items: [
    { title: "Musculation", slug: "musculation", shortDesc: "Un plateau complet et des coachs disponibles.", icon: "dumbbell" },
    { title: "Coaching personnel", slug: "coaching-personnel", shortDesc: "Un programme sur mesure avec suivi hebdomadaire.", icon: "user" },
    { title: "Cours collectifs", slug: "cours-collectifs", shortDesc: "Yoga, danse et renforcement en petit groupe.", icon: "users" },
  ],
};
const faqIdx = gym.homeSections.findIndex((s) => s.type === "faq");
if (faqIdx >= 0) {
  gym.homeSections[faqIdx] = {
    type: "faq",
    title: "Questions fréquentes",
    items: [
      { question: "Peut-on essayer avant de s'abonner ?", answer: "Oui, une séance d'essai gratuite est offerte sur simple demande." },
      { question: "Quels sont les horaires d'ouverture ?", answer: "Nous sommes ouverts tous les jours de 6h à 23h." },
      { question: "Un coach est-il inclus ?", answer: "Un accompagnement est inclus, avec option coaching personnalisé." },
      { question: "Les cours collectifs sont-ils mixtes ?", answer: "Oui, avec des créneaux dédiés selon les préférences." },
    ],
  };
}

const frBundle = renderFullSite(gym, sheet);
const frPages = Object.entries(frBundle).filter(([k]) => k.endsWith(".html"));

{
  const forbidden = ["Get a Free Quote", "What you can expect", "depending on your state", "We arrive on time", "Request a free quote", "All rights reserved", "Page not found", "Our mission", "Our values", "Need this service?", "Related services", "Last updated"];
  check("fr: aucune chaîne anglaise résiduelle", frPages.every(([, v]) => forbidden.every((f) => !v.includes(f))));
  const home = frBundle["index.html"] ?? "";
  check("fr: CTA adapté au gym", home.includes("Réserver une séance") && !home.includes("Demander un devis"));
  check("fr: privacy en français", (frBundle["privacy.html"] ?? "").includes("Politique de confidentialité") && (frBundle["privacy.html"] ?? "").includes("Dernière mise à jour"));
  check("fr: terms en français", (frBundle["terms.html"] ?? "").includes("Conditions générales"));
  check("fr: libellés UI français", home.includes("Accueil") && home.includes("Tous droits réservés"));
}

// ── AR : nœud de Riyad ──────────────────────────────────────────────────────
const ar = clone(specFixture) as SiteSpec;
ar.lang = "ar";
ar.dir = "rtl";
ar.businessModel = "membership";
ar.metaTitle = "نادي الرياض — لياقة وتدريب";
ar.metaDescription = "نادٍ رياضي في الرياض: أجهزة حديثة، حصص جماعية ومدربون معتمدون بأسعار واضحة.";
ar.ogDescription = "نادٍ رياضي حديث في الرياض مع أجهزة متكاملة ومدربين معتمدين.";
ar.homeSections[0] = {
  type: "hero",
  headline: "نادٍ رياضي حديث في قلب الرياض",
  subheadline: "أجهزة متكاملة وحصص جماعية متنوعة ومدربون معتمدون لمساعدتك على تحقيق أهدافك.",
  primaryCta: { label: "احجز حصة تجريبية", action: "booking" },
  secondaryCta: { label: "اكتشف البرامج", action: "scroll" },
  chips: ["تجربة مجانية", "مدربون معتمدون", "مفتوح طوال الأسبوع"],
  style: "split",
};
ar.homeSections[1] = {
  type: "services",
  title: "برامجنا",
  layout: "grid-3",
  items: [
    { title: "كمال الأجسام", slug: "musculation", shortDesc: "قاعة مجهزة بالكامل بإشراف مدربين معتمدين.", icon: "dumbbell" },
    { title: "تدريب شخصي", slug: "coaching-personnel", shortDesc: "برنامج تدريبي مخصص مع متابعة أسبوعية.", icon: "user" },
    { title: "حصص جماعية", slug: "cours-collectifs", shortDesc: "يوغا ورقص وتقوية في مجموعات صغيرة.", icon: "users" },
  ],
};
const arFaqIdx = ar.homeSections.findIndex((s) => s.type === "faq");
if (arFaqIdx >= 0) {
  ar.homeSections[arFaqIdx] = {
    type: "faq",
    title: "الأسئلة الشائعة",
    items: [
      { question: "هل يمكنني تجربة النادي قبل الاشتراك؟", answer: "نعم، نقدم حصة تجريبية مجانية عند الطلب." },
      { question: "ما هي أوقات العمل؟", answer: "نفتح أبوابنا كل يوم من السادسة صباحًا حتى الحادية عشرة مساءً." },
      { question: "هل يتوفر مدرب شخصي؟", answer: "نعم، يمكن حجز مدرب شخصي حسب الأهداف والمستوى." },
      { question: "هل توجد حصص للنساء؟", answer: "نعم، لدينا حصص مخصصة للنساء في أوقات محددة." },
    ],
  };
}
ar.servicePages[0].title = "إصلاح التسربات";
ar.servicePages[0].metaDescription = "إصلاح تسربات المياه في الرياض مع عرض سعر واضح وضمان.";
ar.servicePages[0].heroSubtitle = "هل لديك تسرب؟ نحدده ونصلحه في اليوم نفسه.";
ar.servicePages[0].paragraphs = ["التسربات غير المعالجة تسبب أضرارًا مكلفة.", "فريقنا يتدخل بسرعة وبشفافية."];
ar.servicePages[0].bullets = ["تدخل سريع", "عرض سعر مجاني", "عمل مضمون"];
ar.servicePages[0].cta = { label: "اتصل الآن", action: "call" };
ar.aboutPage.metaTitle = "من نحن — نادي الرياض";
ar.aboutPage.metaDescription = "تعرف على فريقنا ومدربينا المعتمدين في الرياض.";
ar.aboutPage.story = ["تأسس النادي في الرياض ليكون مساحة رياضية لكل أفراد العائلة.", "نطور برامجنا باستمرار وفق أحدث أساليب التدريب."];
ar.aboutPage.mission = "توفير تدريب آمن وفعّال في بيئة محفزة للجميع.";
ar.aboutPage.values = [
  { title: "الشفافية", desc: "أسعار واضحة دون مفاجآت." },
  { title: "الاحترافية", desc: "مدربون معتمدون ومتابعة دقيقة." },
  { title: "القرب", desc: "فريق محلي يستمع لاحتياجاتك." },
];
ar.privacyPage = {
  title: "سياسة الخصوصية",
  lastUpdated: "2026-11-18",
  sections: [
    { heading: "البيانات التي نجمعها", content: "نجمع فقط البيانات اللازمة للرد على طلبك." },
    { heading: "الاستخدام", content: "تُستخدم بياناتك فقط لمعالجة طلبك." },
    { heading: "الاحتفاظ", content: "نحتفظ ببياناتك للمدة اللازمة فقط." },
  ],
};
ar.termsPage = {
  title: "الشروط والأحكام",
  lastUpdated: "2026-11-18",
  sections: [
    { heading: "الخدمات", content: "تُقدَّم الخدمات حسب العرض المقبول من العميل." },
    { heading: "الأسعار", content: "جميع الأسعار معروضة بوضوح قبل الاشتراك." },
    { heading: "الضمان", content: "نلتزم بجودة الخدمة طوال مدة الاشتراك." },
  ],
};

const arBundle = renderFullSite(ar, { ...specSheet, LANG: "ar", LANG_DIR: "rtl", DOMAIN: "https://demo.gosite.digital" });

{
  const home = arBundle["index.html"] ?? "";
  const arPages = Object.entries(arBundle).filter(([k]) => k.endsWith(".html"));
  check("ar: html lang=ar dir=rtl", home.includes('<html lang="ar" dir="rtl">') && arPages.every(([, v]) => v.includes('<html lang="ar" dir="rtl">')));
  check("ar: headline arabe", home.includes("<h1>نادٍ رياضي حديث في قلب الرياض</h1>"));
  check("ar: libellés UI arabes", home.includes("الرئيسية") && home.includes("جميع الحقوق محفوظة"));
  check("ar: aucune chaîne FR résiduelle", home.includes("Accueil") === false && home.includes("Tous droits réservés") === false);
  check("ar: privacy arabe", (arBundle["privacy.html"] ?? "").includes("سياسة الخصوصية") && (arBundle["privacy.html"] ?? "").includes("آخر تحديث"));
  check("ar: service arabe", (arBundle["services/reparation-fuites.html"] ?? "").includes("إصلاح التسربات"));
}

process.exit(fail ? 1 : 0);
