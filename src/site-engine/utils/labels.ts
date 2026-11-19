// Libellés d'interface (navigation, formulaires, aria) localisés.
// Le contenu éditorial vient du SiteSpec ; seuls les micro-textes de chrome
// sont ici. Langues supportées : fr, en (repli en).

export type UiLabels = {
  navHome: string;
  navServices: string;
  navAbout: string;
  navReviews: string;
  navContact: string;
  call: string;
  whatsapp: string;
  menu: string;
  close: string;
  hours: string;
  formName: string;
  formEmail: string;
  formPhone: string;
  formMessage: string;
  formService: string;
  formChoose: string;
  formSend: string;
  privacy: string;
  terms: string;
  footerRights: string;
  mapTitle: string;
  starsOutOf: string;
  skip: string;
  legalNav: string;
  contactTitle: string;
  breadcrumb: string;
  relatedTitle: string;
  ctaTitle: string;
  ctaText: string;
  backHome: string;
  notFoundTitle: string;
  notFoundText: string;
  missionTitle: string;
  valuesTitle: string;
  legalUpdated: string;
};

const FR: UiLabels = {
  navHome: "Accueil",
  navServices: "Services",
  navAbout: "À propos",
  navReviews: "Avis",
  navContact: "Contact",
  call: "Appeler",
  whatsapp: "WhatsApp",
  menu: "Ouvrir le menu",
  close: "Fermer le menu",
  hours: "Horaires",
  formName: "Nom",
  formEmail: "Email",
  formPhone: "Téléphone",
  formMessage: "Message",
  formService: "Service souhaité",
  formChoose: "Choisir un service",
  formSend: "Envoyer la demande",
  privacy: "Confidentialité",
  terms: "Conditions",
  footerRights: "Tous droits réservés.",
  mapTitle: "Carte et localisation",
  starsOutOf: "sur 5",
  skip: "Aller au contenu",
  legalNav: "Informations légales",
  contactTitle: "Contact",
  breadcrumb: "Fil d'Ariane",
  relatedTitle: "Services liés",
  ctaTitle: "Besoin de ce service ?",
  ctaText: "Appelez-nous ou demandez un devis gratuit.",
  backHome: "Retour à l'accueil",
  notFoundTitle: "Page introuvable",
  notFoundText: "La page demandée n'existe pas ou a été déplacée.",
  missionTitle: "Notre mission",
  valuesTitle: "Nos valeurs",
  legalUpdated: "Dernière mise à jour",
};

const EN: UiLabels = {
  navHome: "Home",
  navServices: "Services",
  navAbout: "About",
  navReviews: "Reviews",
  navContact: "Contact",
  call: "Call",
  whatsapp: "WhatsApp",
  menu: "Open menu",
  close: "Close menu",
  hours: "Hours",
  formName: "Name",
  formEmail: "Email",
  formPhone: "Phone",
  formMessage: "Message",
  formService: "Requested service",
  formChoose: "Choose a service",
  formSend: "Send request",
  privacy: "Privacy",
  terms: "Terms",
  footerRights: "All rights reserved.",
  mapTitle: "Map and location",
  starsOutOf: "out of 5",
  skip: "Skip to content",
  legalNav: "Legal",
  contactTitle: "Contact",
  breadcrumb: "Breadcrumb",
  relatedTitle: "Related services",
  ctaTitle: "Need this service?",
  ctaText: "Call us or request a free quote.",
  backHome: "Back to home",
  notFoundTitle: "Page not found",
  notFoundText: "The requested page does not exist or has moved.",
  missionTitle: "Our mission",
  valuesTitle: "Our values",
  legalUpdated: "Last updated",
};

const AR: UiLabels = {
  navHome: "الرئيسية",
  navServices: "الخدمات",
  navAbout: "من نحن",
  navReviews: "التقييمات",
  navContact: "اتصل بنا",
  call: "اتصل",
  whatsapp: "واتساب",
  menu: "فتح القائمة",
  close: "إغلاق القائمة",
  hours: "ساعات العمل",
  formName: "الاسم",
  formEmail: "البريد الإلكتروني",
  formPhone: "الهاتف",
  formMessage: "الرسالة",
  formService: "الخدمة المطلوبة",
  formChoose: "اختر خدمة",
  formSend: "إرسال الطلب",
  privacy: "الخصوصية",
  terms: "الشروط",
  footerRights: "جميع الحقوق محفوظة.",
  mapTitle: "الخريطة والموقع",
  starsOutOf: "من 5",
  skip: "الانتقال إلى المحتوى",
  legalNav: "معلومات قانونية",
  contactTitle: "اتصل بنا",
  breadcrumb: "مسار التنقل",
  relatedTitle: "خدمات ذات صلة",
  ctaTitle: "هل تحتاج هذه الخدمة؟",
  ctaText: "اتصل بنا أو اطلب عرض سعر مجاني.",
  backHome: "العودة إلى الرئيسية",
  notFoundTitle: "الصفحة غير موجودة",
  notFoundText: "الصفحة المطلوبة غير موجودة أو تم نقلها.",
  missionTitle: "مهمتنا",
  valuesTitle: "قيمنا",
  legalUpdated: "آخر تحديث",
};

export function labels(lang: string | undefined): UiLabels {
  const l = (lang ?? "en").slice(0, 2).toLowerCase();
  return l === "fr" ? FR : l === "ar" ? AR : EN;
}
