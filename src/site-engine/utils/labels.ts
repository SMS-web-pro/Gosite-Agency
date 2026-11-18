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
};

export function labels(lang: string | undefined): UiLabels {
  return (lang ?? "en").slice(0, 2).toLowerCase() === "fr" ? FR : EN;
}
