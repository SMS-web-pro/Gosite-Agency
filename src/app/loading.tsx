export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg, #07090e)" }}>
      <div className="flex items-center gap-3" style={{ color: "var(--text-faint, #6b7688)" }}>
        <span className="inline-block w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent, #00e5a0)", borderTopColor: "transparent" }} />
        <span className="text-[13px]">Chargement…</span>
      </div>
    </div>
  );
}
