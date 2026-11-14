// @noble/hashes (pure JS, exports ESM propres) et NON blake3-wasm : son build
// ESM est vide et casse le bundling Turbopack/Next. BLAKE3 est un standard —
// l'empreinte est identique à celle de blake3-wasm (vecteur spec : entrée vide
// → af1349b9f5f9a1a6...).
import { blake3 } from "@noble/hashes/blake3.js";
import { getSetting } from "./settings";

const CF_API = "https://api.cloudflare.com/client/v4";

const MIME: Record<string, string> = {
  html: "text/html", css: "text/css", js: "application/javascript", json: "application/json",
  txt: "text/plain", svg: "image/svg+xml", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", ico: "image/x-icon", xml: "application/xml", webmanifest: "application/manifest+json",
};

export function contentTypeOf(path: string): string {
  const ext = path.split(".").pop() ?? "";
  return MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

// Clé asset de Pages = blake3(base64(contenu) + extension_sans_point).hex()[:32]
// (exactement l'algo de wrangler — packages/deploy-helpers/hash.ts). Un hash
// différent de celui de CF ne renvoie PAS d'erreur mais les fichiers servent en
// 404, d'où l'importance du vecteur de test.
export function assetHash(contents: Buffer, path: string): string {
  const base64 = contents.toString("base64");
  const ext = (path.split(".").pop() ?? "").toLowerCase();
  return Buffer.from(blake3(Buffer.from(base64 + ext, "utf8"))).toString("hex").slice(0, 32);
}

export async function cfAccount(): Promise<{ token: string; accountId: string } | null> {
  const token = (await getSetting("CLOUDFLARE_TOKEN")) || process.env.CLOUDFLARE_TOKEN || "";
  if (!token) return null;
  let accountId = await getSetting("CLOUDFLARE_ACCOUNT_ID");
  if (!accountId) {
    const res = await fetch(`${CF_API}/accounts`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    const j = (await res.json()) as { result?: { id: string }[] };
    accountId = j.result?.[0]?.id ?? "";
  }
  if (!accountId) return null;
  return { token, accountId };
}

const h = (token: string) => ({ Authorization: `Bearer ${token}` });

async function cfOk<T>(res: Response, label: string): Promise<T> {
  const j = (await res.json().catch(() => null)) as { success?: boolean; result?: T; errors?: { code: number; message: string }[] } | null;
  if (!res.ok || !j?.success) {
    const err = j?.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`CF Pages ${label}: ${err}`);
  }
  return j.result as T;
}

// Crée le project Pages s'il n'existe pas (Direct Upload, branche prod "main").
async function ensureProject(accountId: string, token: string, projectName: string): Promise<void> {
  const base = `${CF_API}/accounts/${accountId}/pages/projects/${projectName}`;
  const get = await fetch(base, { headers: h(token), signal: AbortSignal.timeout(20000) });
  if (get.ok) return;
  await cfOk(await fetch(`${CF_API}/accounts/${accountId}/pages/projects`, {
    method: "POST", headers: { ...h(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name: projectName, production_branch: "main" }),
    signal: AbortSignal.timeout(20000),
  }), "create project");
}

// Upload du bundle (map chemin -> contenu) vers le project Pages et création
// du déploiement de production. Le flux Direct Upload : JWT -> check-missing ->
// upload des fichiers (base64, 1 batch suffit pour un site client) ->
// upsert-hashes -> manifest. Les fichiers déjà connus de CF sont réutilisés
// (content-addressed) : redéployer le même site est quasi instantané.
export async function deployToPages(projectName: string, bundle: Record<string, string | Buffer>): Promise<{ url: string; files: number }> {
  const acc = await cfAccount();
  if (!acc) throw new Error("Cloudflare Pages : CLOUDFLARE_TOKEN / CLOUDFLARE_ACCOUNT_ID requis (Réglages → Cloudflare).");
  const { token, accountId } = acc;
  await ensureProject(accountId, token, projectName);

  const files = Object.entries(bundle)
    .filter(([path]) => path !== "vercel.json" && path !== "_headers" && path !== "_redirects")
    .map(([path, content]) => {
      const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
      return { path, key: assetHash(buf, path), value: buf.toString("base64"), contentType: contentTypeOf(path) };
    });

  // 1) JWT d'upload (~5 min, scoped au project)
  const tk = await cfOk<{ jwt: string }>(await fetch(`${CF_API}/accounts/${accountId}/pages/projects/${projectName}/upload-token`, { method: "POST", headers: h(token), signal: AbortSignal.timeout(20000) }), "upload-token");
  const jh = { Authorization: `Bearer ${tk.jwt}`, "Content-Type": "application/json" };

  // 2) check-missing : saute ce que CF a déjà en magasin
  let missing = new Set<string>(files.map((f) => f.key));
  try {
    const cm = await cfOk<string[]>(await fetch(`${CF_API}/pages/assets/check-missing`, { method: "POST", headers: jh, body: JSON.stringify({ hashes: [...missing] }), signal: AbortSignal.timeout(20000) }), "check-missing");
    missing = new Set(cm);
  } catch { /* en cas de doute on ré-upload tout */ }

  // 3) upload des fichiers manquants (batch < 14 Mo, ≤ 500 fichiers)
  let batch: typeof files = [];
  let size = 0;
  for (const f of files) {
    if (!missing.has(f.key)) continue;
    if (batch.length >= 500 || (size + f.value.length > 14_000_000 && batch.length)) {
      await pushBatch(batch, jh);
      batch = []; size = 0;
    }
    batch.push(f); size += f.value.length;
  }
  if (batch.length) await pushBatch(batch, jh);

  // 4) upsert-hashes puis manifest (chemins préfixés de "/", branche prod "main")
  await fetch(`${CF_API}/pages/assets/upsert-hashes`, { method: "POST", headers: jh, body: JSON.stringify({ hashes: files.map((f) => f.key) }), signal: AbortSignal.timeout(20000) }).catch(() => {});

  const manifest = Object.fromEntries(files.map((f) => ["/" + f.path, f.key]));
  const fd = new FormData();
  fd.append("manifest", JSON.stringify(manifest));
  fd.append("branch", "main");
  await cfOk(await fetch(`${CF_API}/accounts/${accountId}/pages/projects/${projectName}/deployments`, { method: "POST", headers: h(token), body: fd, signal: AbortSignal.timeout(30000) }), "deployments");
  return { url: `https://${projectName}.pages.dev`, files: files.length };
}

async function pushBatch(batch: { key: string; value: string; contentType: string }[], jh: Record<string, string>): Promise<void> {
  const body = batch.map((f) => ({ key: f.key, value: f.value, metadata: { contentType: f.contentType }, base64: true }));
  await cfOk(await fetch(`${CF_API}/pages/assets/upload`, { method: "POST", headers: jh, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) }), "upload assets");
}

// Lie le sous-domaine de l'agence au project. La zone gosite.digital vit dans
// le même compte Cloudflare : le CNAME `<slug>.gosite.digital →
// <project>.pages.dev` est créé et vérifié automatiquement, le wildcard
// *.gosite.digital (Vercel) reste pour les projets qui y sont encore déployés.
export async function linkPagesDomain(projectName: string, domain: string): Promise<void> {
  const acc = await cfAccount();
  if (!acc) throw new Error("Cloudflare Pages : CLOUDFLARE_TOKEN / CLOUDFLARE_ACCOUNT_ID requis (Réglages → Cloudflare).");
  const base = `${CF_API}/accounts/${acc.accountId}/pages/projects/${projectName}/domains`;
  const res = await fetch(base, { method: "POST", headers: { ...h(acc.token), "Content-Type": "application/json" }, body: JSON.stringify({ name: domain }), signal: AbortSignal.timeout(20000) });
  // Déjà lié : pas une erreur.
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { success?: boolean; errors?: { message: string }[] } | null;
    const msg = j?.errors?.[0]?.message ?? `HTTP ${res.status}`;
    if (!/already|existe/i.test(msg)) throw new Error(`CF Pages domain ${domain}: ${msg}`);
  }
}
