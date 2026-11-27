import { MOTION_SCRIPT } from "./_lib/motion.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

check("motion: sans pin", !MOTION_SCRIPT.includes("pin:"));
check("motion: reduced motion", MOTION_SCRIPT.includes("prefers-reduced-motion"));
check("motion: ScrollTrigger", MOTION_SCRIPT.includes("ScrollTrigger.batch") && MOTION_SCRIPT.includes("registerPlugin"));
check("motion: fallback visible", MOTION_SCRIPT.includes("is-visible") && MOTION_SCRIPT.includes("has-js"));
check("motion: timeout anti-CDN lent", MOTION_SCRIPT.includes("setTimeout(revealAll") && MOTION_SCRIPT.includes("clearTimeout"));
check("motion: pas de double animation", MOTION_SCRIPT.includes(".service-card:not(.reveal)") && MOTION_SCRIPT.includes(".gallery-item:not(.reveal)"));
check("motion: lit data-motion", MOTION_SCRIPT.includes("data-motion"));
check("motion: attend le defer", MOTION_SCRIPT.includes("DOMContentLoaded"));
check("motion: sans ScrollSmoother", !MOTION_SCRIPT.includes("ScrollSmoother"));

process.exit(fail ? 1 : 0);
