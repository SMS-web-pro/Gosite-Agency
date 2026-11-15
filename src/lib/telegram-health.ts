// Santé du canal Telegram entrant — module PUR (aucun import DB, aucune
// dépendance framework) pour rester testable et réutilisable.
//
// Pourquoi : une panne « plateforme » (compte d'hébergement bloqué → 402,
// protection d'accès → 401, alias mort → 404) ne se corrige pas dans le code.
// Elle doit être DÉTECTÉE, distinguée d'une simple erreur de code, et signalée.
// Telegram, lui, ne conserve que la DERNIÈRE erreur : un 402 vieux de 48 h
// reste affiché indéfiniment tant qu'aucune livraison n'a réussi — d'où le
// besoin de sonder l'endpoint nous-mêmes pour savoir si le canal vit encore.

export type ProbeKind =
  | "healthy" // 2xx + acquittement JSON du webhook → l'app répond
  | "platform" // 402 → compte d'hébergement bloqué (paiement / quota)
  | "protection" // 401/403 « Protected deployment » → protection Vercel
  | "auth" // 401/403 autrement → secret de webhook divergent
  | "notfound" // 404 → l'URL enregistrée ne pointe plus vers l'app
  | "server" // 5xx
  | "network"; // DNS / TLS / délai dépassé (status 0)

export type ProbeResult = {
  url: string;
  status: number;
  kind: ProbeKind;
  detail: string;
};

const ACK_RE = /"ok"\s*:\s*true/;

export function classifyProbe(status: number, body: string): ProbeKind {
  if (status >= 200 && status < 300) {
    // Un 200 qui renvoie du HTML n'est pas notre webhook : c'est une page
    // d'authentification ou de redirection servie par la plateforme.
    const trimmed = (body ?? "").trim();
    if (trimmed.startsWith("<")) return "protection";
    return "healthy";
  }
  if (status === 402) return "platform";
  if (status === 401 || status === 403) {
    const b = (body ?? "").toLowerCase();
    if (b.includes("protected deployment") || b.includes("vercel_auth") || b.includes("sso")) return "protection";
    return "auth";
  }
  if (status === 404 || status === 410) return "notfound";
  if (status === 0) return "network";
  if (status >= 500) return "server";
  if (status === 429) return "server";
  return "server";
}

export function describeKind(kind: ProbeKind): string {
  switch (kind) {
    case "healthy":
      return "endpoint OK";
    case "platform":
      return "compte d'hébergement bloqué (402 Payment Required)";
    case "protection":
      return "déploiement protégé par l'authentification Vercel";
    case "auth":
      return "secret de webhook refusé";
    case "notfound":
      return "URL enregistrée introuvable";
    case "server":
      return "erreur du serveur";
    case "network":
      return "endpoint injoignable (DNS, TLS ou délai dépassé)";
  }
}

/**
 * Sonde l'endpoint webhook exactement comme Telegram le fait : POST + en-tête
 * `x-telegram-bot-api-secret-token`. Le corps est volontairement vide
 * ({update_id}) pour que l'app accuse réception sans traiter d'update ni
 * répondre dans le chat.
 */
export async function probeWebhook(url: string, secret: string, timeoutMs = 12_000): Promise<ProbeResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": secret,
      },
      body: JSON.stringify({ update_id: 0 }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.text();
    const kind = classifyProbe(res.status, body);
    const ack = ACK_RE.test(body ?? "");
    return {
      url,
      status: res.status,
      kind,
      detail:
        kind === "healthy"
          ? ack
            ? "endpoint OK"
            : "endpoint OK (acquittement inattendu)"
          : `${describeKind(kind)}${res.status ? ` (HTTP ${res.status})` : ""}`,
    };
  } catch (err) {
    return {
      url,
      status: 0,
      kind: "network",
      detail: `endpoint injoignable (${err instanceof Error ? err.message : "erreur réseau"})`,
    };
  }
}

/** Première URL candidate qui répond — l'ordre d'appel fait foi (canonical d'abord). */
export function pickHealthyUrl(probes: ProbeResult[]): string | null {
  const hit = probes.find((p) => p.kind === "healthy");
  return hit ? hit.url : null;
}

export type RepairPlan = {
  /** URL webhook cible (null = rien à ré-enregistrer possible). */
  target: string | null;
  canonicalHealthy: string | null;
  registeredHealthy: boolean;
  needsRepair: boolean;
};

/**
 * Décide de la réparation : on vise le premier candidat canonique qui répond,
 * sinon l'URL enregistrée si elle répond encore (ne jamais casser un canal qui
 * marche). Sans cible, la panne est « plateforme » : seul l'opérateur peut la
 * traiter (compte bloqué, protection, DNS).
 *
 * Cas particulier : un 403 « secret refusé » se répare en ré-enregistrant le
 * MÊME URL — c'est le secret du webhook qui a divergé côté Telegram, le
 * ré-enregistrement le réaligne.
 */
export function planRepair(input: {
  registeredUrl: string;
  candidateUrls: string[];
  probes: ProbeResult[];
}): RepairPlan {
  const isHealthy = (url: string) => input.probes.some((p) => p.url === url && p.kind === "healthy");
  const canonicalHealthy = input.candidateUrls.find(isHealthy) ?? null;
  const registeredHealthy = Boolean(input.registeredUrl) && isHealthy(input.registeredUrl);
  const registeredProbe = input.probes.find((p) => p.url === input.registeredUrl);
  const secretMismatch = registeredProbe?.kind === "auth";
  const target =
    canonicalHealthy ??
    (registeredHealthy || secretMismatch ? input.registeredUrl : null);
  return {
    target,
    canonicalHealthy,
    registeredHealthy,
    needsRepair: Boolean(target) && (target !== input.registeredUrl || secretMismatch),
  };
}

export type HealthInput = {
  registeredUrl: string; // URL enregistrée chez Telegram
  telegramError: string | null; // last_error_message
  telegramErrorDate: number | null; // last_error_date (secondes Unix)
  probes: ProbeResult[];
  repaired: boolean;
  repairedUrl: string | null;
  now?: number; // ms
};

export type HealthReport = {
  healthy: boolean;
  activeUrl: string;
  registeredUrl: string;
  staleTelegramError: boolean; // l'endpoint répond mais Telegram garde une erreur ancienne
  telegramError: string | null;
  telegramErrorDate: number | null;
  telegramErrorAgeHours: number | null;
  repaired: boolean;
  repairedUrl: string | null;
  kind: ProbeKind;
  detail: string;
};

export function buildHealthReport(input: HealthInput): HealthReport {
  const now = input.now ?? Date.now();
  // Après une réparation, l'URL qui fait foi est la nouvelle : on ne doit pas
  // garder l'ancienne (morte) comme « active ».
  const repairedHealthy =
    input.repairedUrl && input.probes.some((p) => p.url === input.repairedUrl && p.kind === "healthy")
      ? input.repairedUrl
      : null;
  const activeUrl = repairedHealthy ?? pickHealthyUrl(input.probes) ?? "";
  const healthy = Boolean(activeUrl);
  const kind: ProbeKind = healthy
    ? "healthy"
    : (input.probes.find((p) => p.kind !== "healthy")?.kind ?? "network");
  const ageHours =
    input.telegramErrorDate && input.telegramError
      ? Math.max(0, Math.round((now / 1000 - input.telegramErrorDate) / 3600))
      : null;

  let detail: string;
  if (healthy) {
    detail = `Webhook actif — l'endpoint répond 200 (${activeUrl}).`;
    if (input.telegramError) {
      detail +=
        ` Telegram conserve une erreur enregistrée ${ageHours !== null ? `il y a ${ageHours} h` : "récemment"} ` +
        `(${input.telegramError}) : elle date d'une livraison échouée, pas de l'état actuel — ` +
        `elle disparaît au prochain message réussi.`;
    }
    if (input.repaired) detail += ` Webhook ré-enregistré sur ${input.repairedUrl}.`;
  } else {
    const failed = input.probes.find((p) => p.kind !== "healthy");
    detail = `Webhook muet — ${failed ? `${failed.detail} sur ${failed.url}` : "aucune URL candidate joignable"}.`;
    if (input.telegramError) detail += ` Telegram a échoué sur : ${input.telegramError}.`;
    if (input.repaired) detail += ` Ré-enregistrement tenté sur ${input.repairedUrl}.`;
  }

  return {
    healthy,
    activeUrl,
    registeredUrl: input.registeredUrl,
    staleTelegramError: healthy && Boolean(input.telegramError),
    telegramError: input.telegramError,
    telegramErrorDate: input.telegramErrorDate,
    telegramErrorAgeHours: ageHours,
    repaired: input.repaired,
    repairedUrl: input.repairedUrl,
    kind,
    detail,
  };
}
