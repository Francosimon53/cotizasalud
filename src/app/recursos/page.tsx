import Link from "next/link";
import { articles } from "./articles";

// Fija UTC para que la fecha ISO (sin hora) no se corra un día según el timezone del build.
function formatDateES(iso: string): string {
  return new Intl.DateTimeFormat("es-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export default function RecursosPage() {
  return (
    <main className="rec-index">
      <header className="rec-hero">
        <div className="rec-hero-label">Blog · EnrollSalud</div>
        <h1>Recursos para agentes ACA</h1>
        <p>Guías en español sobre elegibilidad, subsidios y herramientas para hacer crecer tu cartera hispana — escritas para el agente, no para el consumidor.</p>
      </header>
      <div className="rec-card-list">
        {articles.map((a) => (
          <Link key={a.slug} href={`/recursos/${a.slug}`} className="rec-card">
            <div className="rec-card-meta">
              <span className="rec-card-category">{a.category}</span>
              <span className="rec-card-date">{formatDateES(a.publishedISO)}</span>
            </div>
            <h2>{a.title}</h2>
            <p>{a.description}</p>
            <span className="rec-card-more">Leer guía →</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
