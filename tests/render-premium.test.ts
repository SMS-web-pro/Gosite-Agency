import { renderFullSite } from "./_lib/render.ts";
import { premiumSpecFixture, specFixture, specSheet } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const sheet = {
  ...specSheet,
  DOMAIN: "https://demo.gosite.digital",
  PHONE_LINK: "+1 (469) 555-3810",
  WHATSAPP_URL: "https://wa.me/14695553810",
  HERO_IMAGE_URL: "https://img.example.com/hero.jpg",
  ABOUT_IMAGE_URL: "https://img.example.com/about.jpg",
  GALLERY_IMAGE_URLS: "https://img.example.com/g1.jpg",
  NICHE_LABEL: "Plomberie",
};

const bundle = renderFullSite(premiumSpecFixture, sheet);
const home = bundle["index.html"] ?? "";

check("html data attrs", home.includes('data-guide="calendly-navy"') && home.includes('data-motion="balanced"'));
check("CSS guide unique", home.includes('html[data-guide="calendly-navy"]') && !home.includes('html[data-guide="ai-brutalist"]'));
check("palette guide", home.includes("--color-primary: #0B1F3A;") && !home.includes("--color-primary: #112233;"));
check("police guide", home.includes("Inter") && home.includes("Cabinet Grotesk"));
check("hero immersif", home.includes("hero-immersive") && home.includes('data-hero="immersive-full"') && home.includes("Plomberie premium"));
check("chips immersifs protégés des overrides guide", home.includes("html[data-guide] .hero-immersive .chips li,") && home.includes("html[data-guide] .hero-fullwidth .chips li{"));
const manifest = JSON.parse(bundle["site.webmanifest"] ?? "{}");
check("theme-color + manifest", home.includes('name="theme-color" content="#0B1F3A"') && manifest.theme_color === "#0B1F3A");
check("service page guide", (bundle["services/reparation-fuites.html"] ?? "").includes('data-guide="calendly-navy"'));
check("motion: CDN GSAP", home.includes("gsap.min.js") && home.includes("ScrollTrigger.min.js") && home.includes("@3.12.5") && home.includes('defer') && home.includes("cdn.jsdelivr.net"));
check("motion: script premium", home.includes("ScrollTrigger.batch") && !home.includes("IntersectionObserver"));

const brand = renderFullSite({ ...premiumSpecFixture, design: { ...premiumSpecFixture.design, paletteMode: "brand" as const } }, sheet);
check("mode brand", (brand["index.html"] ?? "").includes("--color-primary: #112233;"));

const legacy = renderFullSite(specFixture, sheet);
const legacyHome = legacy["index.html"] ?? "";
check("legacy sans guide", !legacyHome.includes("data-guide=") && !legacyHome.includes("html[data-guide="));
check("legacy: reveal fallback", legacyHome.includes("IntersectionObserver") && !legacyHome.includes("cdn.jsdelivr.net"));

process.exit(fail ? 1 : 0);
