// Résolution géographique des missions de prospection.
// Module neutre (sans imports) pour éviter tout cycle serper ↔ simulate.

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const US_CITIES = [
  "new york", "newyork", "new york city", "nyc", "los angeles", "chicago", "houston", "phoenix",
  "philadelphia", "san antonio", "san diego", "dallas", "san jose", "austin", "jacksonville",
  "san francisco", "columbus", "indianapolis", "fort worth", "charlotte", "seattle", "denver",
  "washington", "boston", "el paso", "detroit", "nashville", "portland", "las vegas", "memphis",
  "louisville", "baltimore", "milwaukee", "miami", "raleigh", "omaha", "minneapolis", "albuquerque",
  "tucson", "fresno", "sacramento", "kansas city", "atlanta", "orlando", "tampa", "pittsburgh",
  "cincinnati", "cleveland", "salt lake city", "new orleans", "hartford", "buffalo", "newark",
];
const UK_CITIES = [
  "london", "manchester", "birmingham", "glasgow", "liverpool", "leeds", "bristol", "sheffield",
  "edinburgh", "cardiff", "belfast", "newcastle", "nottingham", "leicester", "coventry", "bradford",
  "brighton", "portsmouth", "york", "oxford", "cambridge",
];
const MA_CITIES = [
  "casablanca", "marrakech", "marrakesh", "rabat", "fes", "fez", "tanger", "tangier", "agadir",
  "meknes", "oujda", "kenitra", "tetouan", "safi", "el jadida", "essaouira", "ouarzazate",
  "nador", "beni mellal", "mohammedia", "laayoune", "dakhla", "taza", "settat", "berkane",
];

export type MissionGeo = { country: string; gl: string; hl: string; lang: "fr" | "en" };

/** Pays/langue d'une mission : override explicite > villes connues > France. */
export function resolveMissionGeo(city: string, countryOverride?: string): MissionGeo {
  if (countryOverride) {
    const c = countryOverride.trim().toLowerCase();
    if (/\b(usa|us|united states|america|etats-unis|états-unis)\b/.test(c)) return { country: "United States", gl: "us", hl: "en", lang: "en" };
    if (/\b(uk|united kingdom|england|great britain|gb|royaume-uni|royaume uni)\b/.test(c)) return { country: "United Kingdom", gl: "gb", hl: "en", lang: "en" };
    if (/\b(morocco|maroc)\b/.test(c)) return { country: "Maroc", gl: "ma", hl: "fr", lang: "fr" };
    if (/\b(france)\b/.test(c)) return { country: "France", gl: "fr", hl: "fr", lang: "fr" };
  }
  const cityNorm = norm(city).trim();
  const has = (list: string[]) => list.some((v) => cityNorm === norm(v) || cityNorm.includes(norm(v)));
  if (has(US_CITIES)) return { country: "United States", gl: "us", hl: "en", lang: "en" };
  if (has(UK_CITIES)) return { country: "United Kingdom", gl: "gb", hl: "en", lang: "en" };
  if (has(MA_CITIES)) return { country: "Maroc", gl: "ma", hl: "fr", lang: "fr" };
  return { country: "France", gl: "fr", hl: "fr", lang: "fr" };
}
