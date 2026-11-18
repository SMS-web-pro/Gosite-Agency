import { escapeHtml } from "../utils/escape";

/** sitemap.xml — URLs propres (cleanUrls), base sans slash final. */
export function generateSitemap(baseUrl: string, pages: string[]): string {
  const base = baseUrl.replace(/\/+$/, "");
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const p of pages) {
    const path = p.replace(/^\/+|\/+$/g, "");
    if (seen.has(path)) continue;
    seen.add(path);
    urls.push(path ? `${base}/${path}` : `${base}/`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`).join("\n")}
</urlset>
`;
}
