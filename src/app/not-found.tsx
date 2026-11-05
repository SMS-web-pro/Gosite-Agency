import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--bg, #07090e)" }}>
      <h1 className="text-xl font-semibold text-white">Introuvable</h1>
      <p className="text-[13px]" style={{ color: "var(--text-faint, #6b7688)" }}>Cette page n'existe pas (ou plus).</p>
      <Link href="/" className="btn-primary" style={{ textDecoration: "none" }}>Retour à la console</Link>
    </div>
  );
}
