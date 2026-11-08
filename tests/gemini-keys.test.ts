import {
  parseKeys,
  pickKeyOrder,
  nextPacificMidnight,
} from "./_lib/gemini-keys.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

// ── parseKeys ──
check("virgules + espaces", JSON.stringify(parseKeys(" k1 , k2,  k3 ")) === '["k1","k2","k3"]');
check("retours à la ligne acceptés", JSON.stringify(parseKeys("k1\nk2\nk3")) === '["k1","k2","k3"]');
check("doublons dédupliqués", JSON.stringify(parseKeys("k1,k1,k2")) === '["k1","k2"]');
check("chaîne vide -> []", JSON.stringify(parseKeys("  , , ")) === "[]");
check("null -> []", JSON.stringify(parseKeys(null)) === "[]");

// ── nextPacificMidnight (DST 2026 : PDT UTC-7 depuis le 08/03, PST UTC-8 depuis le 01/11) ──
check("mi-novembre (PST) -> 08:00Z le lendemain", nextPacificMidnight(Date.UTC(2026, 10, 8, 18, 43)) === Date.UTC(2026, 10, 9, 8, 0));
check("mi-juillet (PDT) -> 07:00Z le lendemain", nextPacificMidnight(Date.UTC(2026, 6, 15, 10, 43)) === Date.UTC(2026, 6, 16, 7, 0));
check("mi-janvier (PST) -> 08:00Z le lendemain", nextPacificMidnight(Date.UTC(2026, 0, 15, 10, 43)) === Date.UTC(2026, 0, 16, 8, 0));
check("exactement minuit -> ce même minuit", nextPacificMidnight(Date.UTC(2026, 6, 16, 7, 0)) === Date.UTC(2026, 6, 16, 7, 0));
check("résultat toujours dans les 24h", nextPacificMidnight(Date.UTC(2026, 10, 8, 0, 0)) - Date.UTC(2026, 10, 8, 0, 0) <= 24 * 3600_000);

// ── pickKeyOrder (rotation + quarantine) ──
const K = ["a@a1", "b@b2", "c@c3"];
check("toutes dispo, ordre de départ 0", JSON.stringify(pickKeyOrder(K, {}, Date.now(), 0)) === JSON.stringify(K));
check("rotation départ 1", JSON.stringify(pickKeyOrder(K, {}, 0, 1)) === '["b@b2","c@c3","a@a1"]');
check("clé en quarantine écartée", JSON.stringify(pickKeyOrder(K, { "a@a1": Date.now() + 99999 }, Date.now(), 0)) === '["b@b2","c@c3"]');
check("quarantine expirée réintégrée", JSON.stringify(pickKeyOrder(K, { "a@a1": Date.now() - 1 }, Date.now(), 0)) === JSON.stringify(K));
check("toutes en quarantine -> []", JSON.stringify(pickKeyOrder(K, { "a@a1": Date.now() + 1, "b@b2": Date.now() + 1, "c@c3": Date.now() + 1 }, Date.now(), 0)) === "[]");
check("liste vide -> []", JSON.stringify(pickKeyOrder([], {}, Date.now(), 0)) === "[]");

process.exit(fail ? 1 : 0);
