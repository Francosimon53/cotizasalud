import { getArticleBySlug } from "../articles";

const SLUG = "healthsherpa-crm-captura-leads";
const article = getArticleBySlug(SLUG)!;

export const metadata = {
  alternates: {
    canonical: `/recursos/${SLUG}`,
  },
  title: article.title,
  description: article.description,
};

// Placeholder Fase A — el cuerpo del artículo y su JSON-LD Article llegan en la Fase C.
export default function ArticlePage() {
  return (
    <article className="rec-article">
      <h1>{article.title}</h1>
      <p>Contenido en preparación.</p>
    </article>
  );
}
