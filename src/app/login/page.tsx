"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Connexion refusée");
      }
      router.replace(params.get("next") || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg, #07090e)" }}>
      <form onSubmit={submit} className="w-full max-w-xs p-8 rounded-2xl border" style={{ borderColor: "var(--border, #1c2431)", background: "rgba(0,0,0,.35)" }}>
        <h1 className="text-lg font-semibold text-white mb-1">GoSite Digital</h1>
        <p className="text-[12.5px] mb-6" style={{ color: "var(--text-faint, #6b7688)" }}>Console privée — accès personnel.</p>
        <input
          className="input w-full mb-3"
          type="password"
          placeholder="Clé admin"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="text-[12.5px] mb-3" style={{ color: "var(--red, #f87171)" }}>{error}</p>}
        <button className="btn-primary w-full" type="submit" disabled={loading || !password}>
          {loading ? "…" : "Entrer"}
        </button>
      </form>
    </div>
  );
}
