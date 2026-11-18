/** robots.txt — tout le site indexable + sitemap. */
export function generateRobots(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;
}
