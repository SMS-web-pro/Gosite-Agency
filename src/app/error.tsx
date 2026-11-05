"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--bg, #07090e)" }}>
      <h1 className="text-xl font-semibold text-white">Un problème est survenu</h1>
      <p className="text-[13px] max-w-md text-center" style={{ color: "var(--text-faint, #6b7688)" }}>
        {error.message || "Erreur inconnue"} — réessaie, ou consulte le journal si le problème persiste.
      </p>
      <button className="btn-primary" onClick={reset}>Réessayer</button>
    </div>
  );
}
