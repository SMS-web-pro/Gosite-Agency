// Conversion du markdown léger produit par le LLM vers du HTML sûr.

function escapeHtml(s: string): string {
  // Quotes incluses : empêche le breakout d'attribut (href, style) dans le HTML généré.
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Rendu pour l'interface web (gras, italique, code, puces, liens cliquables)
export function markdownToHtml(input: string): string {
  let s = escapeHtml(input);
  // Tableaux markdown → lignes à puces lisibles
  s = s
    .split("\n")
    .filter((line) => !/^\s*\|[\s:|-]+\|\s*$/.test(line))
    .map((line) =>
      /^\s*\|.*\|\s*$/.test(line)
        ? "• " + line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim()).filter(Boolean).join(" · ")
        : line,
    )
    .join("\n");
  s = s.replace(/^#{1,6}\s*/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<i>$2</i>");
  s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,.08);padding:1px 5px;border-radius:5px;font-size:.92em">$1</code>');
  s = s.replace(/^\s*[-*]\s+/gm, "• ");
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline">$1</a>');
  return s;
}

// Rendu pour Telegram (sous-ensemble HTML autorisé : b, i, code, a)
export function markdownToTelegram(input: string): string {
  let s = escapeHtml(input);
  s = s
    .split("\n")
    .filter((line) => !/^\s*\|[\s:|-]+\|\s*$/.test(line))
    .map((line) =>
      /^\s*\|.*\|\s*$/.test(line)
        ? "• " + line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim()).filter(Boolean).join(" · ")
        : line,
    )
    .join("\n");
  s = s.replace(/^#{1,6}\s*/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<i>$2</i>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/^\s*[-*]\s+/gm, "• ");
  // Telegram limite à 4096 caractères
  return s.length > 3900 ? `${s.slice(0, 3900)}…` : s;
}
