import { createServer } from "node:http";
import {
  buildHealthReport,
  classifyProbe,
  describeKind,
  pickHealthyUrl,
  planRepair,
  probeWebhook,
  type ProbeResult,
} from "./_lib/telegram-health.ts";

let fail = 0;
const check = (n: string, c: boolean) => {
  if (!c) {
    fail++;
    console.log("FAIL", n);
  } else console.log("ok  ", n);
};

// ── classifyProbe ──
check("200 JSON = healthy", classifyProbe(200, '{"ok":true}') === "healthy");
check("200 HTML = protection", classifyProbe(200, "<!DOCTYPE html><html>") === "protection");
check("402 = platform", classifyProbe(402, "Payment Required") === "platform");
check("401 Protected deployment = protection", classifyProbe(401, '{"error":{"code":"401","message":"Protected deployment"}}') === "protection");
check("403 simple = auth", classifyProbe(403, '{"ok":false}') === "auth");
check("404 = notfound", classifyProbe(404, "Not Found") === "notfound");
check("500 = server", classifyProbe(500, "boom") === "server");
check("0 = network", classifyProbe(0, "") === "network");

check("describeKind platform explicite", describeKind("platform").includes("402"));
check("describeKind network explicite", describeKind("network").includes("injoignable"));

// ── pickHealthyUrl ──
const probes: ProbeResult[] = [
  { url: "https://a", status: 402, kind: "platform", detail: "x" },
  { url: "https://b", status: 200, kind: "healthy", detail: "endpoint OK" },
  { url: "https://c", status: 200, kind: "healthy", detail: "endpoint OK" },
];
check("pickHealthyUrl prend le 1er sain", pickHealthyUrl(probes) === "https://b");
check("pickHealthyUrl null si aucun sain", pickHealthyUrl([probes[0]]) === null);

// ── planRepair : les pannes qu'on ne peut pas réparer doivent être vues ──
const DOMAIN = "https://gosite.digital/api/telegram/webhook";
const OLD = "https://old.vercel.app/api/telegram/webhook";

// 1) Tout va bien : URL enregistrée = URL canonique → rien à réparer.
const okPlan = planRepair({
  registeredUrl: DOMAIN,
  candidateUrls: [DOMAIN],
  probes: [{ url: DOMAIN, status: 200, kind: "healthy", detail: "endpoint OK" }],
});
check("canal sain => pas de réparation", okPlan.needsRepair === false);
check("canal sain => cible = URL enregistrée", okPlan.target === DOMAIN);

// 2) URL enregistrée MORTE (402 plateforme) + domaine vivant → on ré-enregistre.
const deadReg = planRepair({
  registeredUrl: OLD,
  candidateUrls: [DOMAIN],
  probes: [
    { url: OLD, status: 402, kind: "platform", detail: "compte bloqué" },
    { url: DOMAIN, status: 200, kind: "healthy", detail: "endpoint OK" },
  ],
});
check("URL enregistrée morte => réparation vers le domaine", deadReg.needsRepair === true && deadReg.target === DOMAIN);

// 3) TOUT mort (compte bloqué) → aucune cible : panne plateforme, pas de register futile.
const allDead = planRepair({
  registeredUrl: OLD,
  candidateUrls: [DOMAIN],
  probes: [
    { url: OLD, status: 402, kind: "platform", detail: "compte bloqué" },
    { url: DOMAIN, status: 402, kind: "platform", detail: "compte bloqué" },
  ],
});
check("tout mort => aucune cible", allDead.target === null && allDead.needsRepair === false);

// 4) URL enregistrée vivante mais alias périmé + domaine vivant → canonicalisation.
const alias = planRepair({
  registeredUrl: OLD,
  candidateUrls: [DOMAIN],
  probes: [
    { url: OLD, status: 200, kind: "healthy", detail: "endpoint OK" },
    { url: DOMAIN, status: 200, kind: "healthy", detail: "endpoint OK" },
  ],
});
check("alias dérangé => on canonise vers le domaine", alias.needsRepair === true && alias.target === DOMAIN);

// 5) URL enregistrée vivante, domaine mort → on garde ce qui marche.
const keepWorking = planRepair({
  registeredUrl: OLD,
  candidateUrls: [DOMAIN],
  probes: [
    { url: OLD, status: 200, kind: "healthy", detail: "endpoint OK" },
    { url: DOMAIN, status: 0, kind: "network", detail: "injoignable" },
  ],
});
check("canonisation impossible => on garde l'URL vivante", keepWorking.needsRepair === false && keepWorking.target === OLD);

// 6) Secret divergent (403) → ré-enregistrement sur la MÊME URL pour réaligner
//    le secret Telegram (sans ça, le canal reste muet pour toujours).
const badSecret = planRepair({
  registeredUrl: DOMAIN,
  candidateUrls: [DOMAIN],
  probes: [{ url: DOMAIN, status: 403, kind: "auth", detail: "secret refusé" }],
});
check("secret divergent => ré-enregistrement sur la même URL", badSecret.needsRepair === true && badSecret.target === DOMAIN);

// 7) Protection Vercel (401 « Protected deployment ») → AUCUNE réparation
//    automatique possible : c'est un réglage de plateforme, pas de code.
const protectedDeploy = planRepair({
  registeredUrl: DOMAIN,
  candidateUrls: [DOMAIN],
  probes: [{ url: DOMAIN, status: 401, kind: "protection", detail: "Protected deployment" }],
});
check("protection plateforme => pas de réparation automatique", protectedDeploy.needsRepair === false && protectedDeploy.target === null);

// ── buildHealthReport ──
const NOW = Date.UTC(2026, 10, 15, 13, 0, 0);

// Endpoint vivant + Telegram garde une vieille erreur → « stale », pas en panne.
const healthyStale = buildHealthReport({
  registeredUrl: "https://gosite.digital/api/telegram/webhook",
  telegramError: "Wrong response from the webhook: 402 Payment Required",
  telegramErrorDate: Math.floor(Date.UTC(2026, 10, 14, 21, 57, 3) / 1000),
  probes: [{ url: "https://gosite.digital/api/telegram/webhook", status: 200, kind: "healthy", detail: "endpoint OK" }],
  repaired: false,
  repairedUrl: null,
  now: NOW,
});
check("endpoint sain => healthy", healthyStale.healthy === true);
check("erreur Telegram périmée => stale", healthyStale.staleTelegramError === true);
check("âge de l'erreur en heures", healthyStale.telegramErrorAgeHours === 15);
check("le détail cite l'endpoint vivant", healthyStale.detail.includes("200"));
check("le détail rappelle l'erreur périmée", healthyStale.detail.includes("402 Payment Required"));

// Endpoint mort (plateforme 402) → panne active, pas « stale ».
const broken = buildHealthReport({
  registeredUrl: "https://gosite.digital/api/telegram/webhook",
  telegramError: "Wrong response from the webhook: 402 Payment Required",
  telegramErrorDate: Math.floor(Date.UTC(2026, 10, 14, 21, 57, 3) / 1000),
  probes: [{ url: "https://gosite.digital/api/telegram/webhook", status: 402, kind: "platform", detail: "compte bloqué" }],
  repaired: false,
  repairedUrl: null,
  now: NOW,
});
check("endpoint mort => pas healthy", broken.healthy === false);
check("endpoint mort => kind platform", broken.kind === "platform");
check("endpoint mort => pas stale", broken.staleTelegramError === false);
check("endpoint mort => le détail nomme la panne", broken.detail.includes("402 Payment Required"));

// Réparation enregistrée → propagée dans le rapport.
const repaired = buildHealthReport({
  registeredUrl: "https://old.vercel.app/api/telegram/webhook",
  telegramError: null,
  telegramErrorDate: null,
  probes: [{ url: "https://gosite.digital/api/telegram/webhook", status: 200, kind: "healthy", detail: "endpoint OK" }],
  repaired: true,
  repairedUrl: "https://gosite.digital/api/telegram/webhook",
  now: NOW,
});
check("réparation propagée", repaired.repaired === true && repaired.repairedUrl === "https://gosite.digital/api/telegram/webhook");
check("réparation citée dans le détail", repaired.detail.includes("ré-enregistré"));

// Après réparation, l'URL neuve fait foi — pas l'ancienne (morte).
const afterRepair = buildHealthReport({
  registeredUrl: "https://old.vercel.app/api/telegram/webhook",
  telegramError: null,
  telegramErrorDate: null,
  probes: [
    { url: "https://old.vercel.app/api/telegram/webhook", status: 402, kind: "platform", detail: "compte bloqué" },
    { url: "https://gosite.digital/api/telegram/webhook", status: 200, kind: "healthy", detail: "endpoint OK" },
  ],
  repaired: true,
  repairedUrl: "https://gosite.digital/api/telegram/webhook",
  now: NOW,
});
check("après réparation, l'URL neuve est active", afterRepair.activeUrl === "https://gosite.digital/api/telegram/webhook");
check("après réparation, canal sain", afterRepair.healthy === true);

// ── probeWebhook : vrai serveur HTTP local ──
async function withServer(handler: (req: any, res: any) => void, fn: (base: string) => Promise<void>) {
  const srv = createServer(handler);
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  const port = (srv.address() as any).port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((r) => srv.close(() => r()));
  }
}

await withServer(
  (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"ok":true}');
  },
  async (base) => {
    const p = await probeWebhook(`${base}/api/telegram/webhook`, "gsd-secret");
    check("sonde: 200 + ack => healthy", p.kind === "healthy" && p.status === 200);
    check("sonde: détail OK", p.detail === "endpoint OK");
  },
);

await withServer(
  (_req, res) => {
    res.writeHead(402, { "Content-Type": "text/plain" });
    res.end("Payment Required");
  },
  async (base) => {
    const p = await probeWebhook(`${base}/api/telegram/webhook`, "gsd-secret");
    check("sonde: 402 => platform", p.kind === "platform" && p.status === 402);
    check("sonde: 402 pas healthy", p.kind !== "healthy");
  },
);

await withServer(
  (_req, res) => {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end('{"ok":false}');
  },
  async (base) => {
    const p = await probeWebhook(`${base}/api/telegram/webhook`, "gsd-secret");
    check("sonde: 403 => auth", p.kind === "auth");
  },
);

// En-tête secret transmis (comme Telegram) + corps vide côté update.
let sawSecret = "";
let sawBody = "";
await withServer(
  (req, res) => {
    sawSecret = (req.headers["x-telegram-bot-api-secret-token"] as string) || "";
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      sawBody = Buffer.concat(chunks).toString();
      const ok = sawSecret === "gsd-secret" && sawBody.includes('"update_id"') && !sawBody.includes('"text"');
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok }));
    });
  },
  async (base) => {
    const p = await probeWebhook(`${base}/api/telegram/webhook`, "gsd-secret");
    check("sonde: secret transmis à Telegram", sawSecret === "gsd-secret");
    check("sonde: update vide (pas de message)", sawBody.includes('"update_id"') && !sawBody.includes('"text"'));
    check("sonde: acquittement reconnu", p.detail === "endpoint OK");
  },
);

// Serveur injoignable → network.
const dead = await probeWebhook("http://127.0.0.1:1/api/telegram/webhook", "s", 2000);
check("sonde: port fermé => network", dead.kind === "network" && dead.status === 0);

process.exit(fail ? 1 : 0);
