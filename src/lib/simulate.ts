// Simulated Serper results for sandbox mode (no API key configured yet).
// Generates realistic local-business fiches so the whole pipeline is demoable.

import { resolveMissionGeo } from "./geo";

export type RawPlace = {
  businessName: string;
  businessType: string;
  phone: string | null;
  email: string | null;
  address: string;
  city: string;
  zip: string;
  country: string;
  rating: number;
  reviewCount: number;
  hasWebsite: boolean;
  websiteUrl: string | null;
  mapsLink: string;
  lat: number;
  lng: number;
  hours: Record<string, string>;
  source: "serper" | "simulation";
  searchQuery: string;
};

const NAME_POOLS: Record<string, string[]> = {
  barbershop: ["Barber Club", "The Gentlemen's Cut", "Atlas Barber", "L'Art du Rasoir", "Fade Factory", "Old School Barbershop"],
  restaurant: ["Le Petit Bistrot", "Dar Tajine", "Chez Karim", "L'Olive Gourmande", "Saveurs d'Antan", "La Table d'Hôte"],
  plombier: ["Plomberie Express", "Aqua Services", "Dépannage Pro", "HydroFix", "Sanitaire Moderne"],
  dentiste: ["Cabinet Dentaire Sourire", "Centre Dentaire Moderne", "DentaCare", "Le Cabinet du Sourire"],
  "salle de sport": ["IronFit Club", "Atlas Fitness", "PowerHouse Gym", "Move Studio", "Oxygen Club"],
  gym: ["IronFit Club", "Atlas Fitness", "PowerHouse Gym", "Move Studio", "Oxygen Club"],
  spa: ["Institut Élégance", "Hammam & Spa Riad", "Pure Beauty Lounge", "Cocoon Spa"],
  beauté: ["Institut Élégance", "Hammam & Spa Riad", "Pure Beauty Lounge", "Cocoon Spa"],
  électricien: ["Élec Pro Services", "Lumière Électricité", "Volt Etanche", "Électro Dépannage 24/7"],
  electricien: ["Élec Pro Services", "Lumière Électricité", "Volt Etanche", "Électro Dépannage 24/7"],
  boulangerie: ["Au Pain Doré", "La Mie Croustillante", "Fournil des Artisans", "Boulangerie du Centre"],
  avocat: ["Cabinet Bennani & Associés", "Avocats Réunis", "Cabinet Juridique Atlas"],
  garage: ["Garage Auto Plus", "Méca Services", "Auto Précision", "Garage du Centre"],
  coiffeur: ["Studio Coiffure", "Hair Design Lounge", "Ciseaux d'Or"],
  restaurant_marocain: ["Riad Dar Zellige", "Palais des Saveurs", "Chez Fatima"],
};

const STREETS = [
  "Rue de la Liberté", "Boulevard Mohammed V", "Avenue Hassan II", "Rue des Fleurs",
  "Avenue Jean Jaurès", "Rue de la République", "Boulevard Zerktouni", "Rue Gauthier",
  "Avenue des FAR", "Rue de Paris", "Boulevard Anfa", "Rue Allal Ben Abdellah",
];

const MA_CITIES = ["casablanca", "rabat", "marrakech", "marrakech", "fès", "fes", "tanger", "agadir", "meknès", "meknes"];

const FR_SCHEDULES: Record<string, string>[] = [
  { weekday: "Lun–Ven 9h00 – 19h00", sat: "Sam 9h00 – 18h00", sun: "Dim Fermé" },
  { weekday: "Lun–Ven 8h30 – 20h00", sat: "Sam 9h00 – 19h00", sun: "Dim 10h00 – 14h00" },
  { weekday: "Lun–Ven 10h00 – 22h00", sat: "Sam 10h00 – 23h00", sun: "Dim 12h00 – 22h00" },
];

const DESCRIPTIONS: Record<string, string[]> = {
  barbershop: [
    "Salon de coiffure et barbier traditionnel. Coupes modernes, taille de barbe à l'ancienne et serviette chaude dans une ambiance détendue.",
    "Barbershop au cœur de la ville : dégradés précis, soins de la barbe et conseils personnalisés par une équipe passionnée.",
  ],
  restaurant: [
    "Restaurant familial proposant une cuisine de saison faite maison avec des produits frais du marché. Terrasse disponible dès les beaux jours.",
    "Cuisine authentique et généreuse dans un cadre chaleureux. Spécialités du terroir et plats du jour chaque midi.",
  ],
  default: [
    "Entreprise locale reconnue pour son sérieux, sa réactivité et la qualité de son accompagnement. Devis gratuit et intervention rapide.",
    "Une équipe expérimentée à votre service, avec un savoir-faire reconnu et des clients fidèles depuis des années.",
  ],
};

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 24);
}

function rnd(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function isMoroccanCity(city: string) {
  const c = city.toLowerCase().trim();
  return MA_CITIES.includes(c);
}

export function simulatePlaces(niche: string, city: string, count = 12): RawPlace[] {
  const nicheKey = niche.toLowerCase().trim();
  const pool = NAME_POOLS[nicheKey] ?? NAME_POOLS[nicheKey.replace(/é/g, "e")] ?? [
    `${niche.charAt(0).toUpperCase()}${niche.slice(1)} Express`,
    `Le Comptoir ${niche}`,
    `Atlas ${niche.charAt(0).toUpperCase()}${niche.slice(1)}`,
    `${niche.charAt(0).toUpperCase()}${niche.slice(1)} Pro Services`,
  ];
  const isMA = isMoroccanCity(city);
  // Pays cohérent avec le résolveur de mission (US/UK → données américaines/anglaises)
  const geo = resolveMissionGeo(city);
  const country = geo.country;
  const isUS = country === "United States";
  const isUK = country === "United Kingdom";
  const baseLat = isMA ? rnd(31.6, 34.0) : rnd(43.3, 48.9);
  const baseLng = isMA ? rnd(-8.0, -5.5) : rnd(2.3, 7.3);
  const usedNames = new Set<string>();
  const results: RawPlace[] = [];

  for (let i = 0; i < count; i++) {
    let name = pick(pool);
    if (usedNames.has(name)) name = `${name} ${city.charAt(0).toUpperCase()}${city.slice(1)}`;
    if (usedNames.has(name)) name = `${name} ${i + 1}`;
    usedNames.add(name);

    // Distribution: ~55% qualified (rating>=4, reviews>=10, no website), rest decoys
    const qualified = Math.random() < 0.55;
    const rating = qualified ? rnd(4.1, 4.9) : pick([rnd(3.2, 3.9), rnd(4.2, 4.8)]);
    const reviewCount = qualified ? Math.floor(rnd(12, 260)) : pick([Math.floor(rnd(2, 8)), Math.floor(rnd(15, 300))]);
    const hasWebsite = qualified ? false : Math.random() < 0.5;

    const street = `${Math.floor(rnd(1, 240))} ${pick(STREETS)}`;
    const lat = baseLat + rnd(-0.08, 0.08);
    const lng = baseLng + rnd(-0.08, 0.08);
    const zip = isUS ? `${Math.floor(rnd(10000, 95990))}` : isUK ? `${Math.floor(rnd(10, 99))}${pick(["AB", "BS", "E", "N", "SE", "SW", "W"])}` : isMA ? `${Math.floor(rnd(20000, 20600))}` : `${Math.floor(rnd(10000, 95990))}`;
    const phone = isUS
      ? `+1 ${Math.floor(rnd(200, 999))} ${Math.floor(rnd(100, 999))} ${Math.floor(rnd(1000, 9999))}`
      : isUK
        ? `+44 7${Math.floor(rnd(100, 999))} ${Math.floor(rnd(100000, 999999))}`
        : isMA
          ? `+212 6${Math.floor(rnd(10, 99))} ${Math.floor(rnd(100, 999))} ${Math.floor(rnd(10, 99))} ${Math.floor(rnd(10, 99))}`
          : `+33 ${Math.floor(rnd(1, 7))} ${Math.floor(rnd(10, 99))} ${Math.floor(rnd(10, 99))} ${Math.floor(rnd(10, 99))} ${Math.floor(rnd(10, 99))}`;

    // Emails: most qualified leads have one
    const hasEmail = qualified ? Math.random() < 0.8 : Math.random() < 0.4;
    const tlds = isUS ? ["gmail.com", "outlook.com", "yahoo.com"] : isUK ? ["gmail.com", "outlook.com", "yahoo.co.uk"] : isMA ? ["gmail.com", "outlook.com", "hotmail.fr"] : ["gmail.com", "outlook.fr", "hotmail.com", "yahoo.fr", "gmail.com"];
    const email = hasEmail
      ? `${slugify(name)}@${pick(tlds)}`
      : null;

    results.push({
      businessName: name,
      businessType: nicheKey,
      phone,
      email,
      address: street,
      city: city.charAt(0).toUpperCase() + city.slice(1),
      zip,
      country,
      rating: Math.round(rating * 10) / 10,
      reviewCount,
      hasWebsite,
      websiteUrl: hasWebsite ? `https://www.${slugify(name)}.${isUS || isUK ? "com" : isMA ? "ma" : "fr"}` : null,
      mapsLink: `https://www.google.com/maps?q=${lat.toFixed(5)},${lng.toFixed(5)}`,
      lat: +lat.toFixed(5),
      lng: +lng.toFixed(5),
      hours: pick(FR_SCHEDULES),
      source: "simulation",
      searchQuery: `${niche} ${city}`,
    });
  }
  return results;
}
