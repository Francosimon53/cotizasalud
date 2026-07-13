import Link from "next/link";
import { getArticleBySlug } from "../articles";

const SLUG = "elegibilidad-subsidio-aca-2027";
const article = getArticleBySlug(SLUG)!;

export const metadata = {
  alternates: {
    canonical: `/recursos/${SLUG}`,
  },
  title: article.title,
  description: article.description,
};

// Fija UTC para que la fecha ISO (sin hora) no se corra un día según el timezone del build.
function formatDateES(iso: string): string {
  return new Intl.DateTimeFormat("es-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: article.title,
  description: article.description,
  datePublished: article.publishedISO,
  dateModified: article.publishedISO,
  inLanguage: "es",
  author: { "@type": "Organization", name: "EnrollSalud" },
  publisher: { "@type": "Organization", name: "EnrollSalud", url: "https://enrollsalud.com" },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `https://enrollsalud.com/recursos/${SLUG}`,
  },
};

export default function ArticlePage() {
  return (
    <article className="rec-article">
      <div className="rec-article-meta">
        <span>{article.category}</span>
        <span>{formatDateES(article.publishedISO)}</span>
      </div>
      <h1>{article.title}</h1>
      <p className="rec-article-desc">{article.description}</p>

      <div className="rec-prose">
        <p>
          Si vendes planes ACA a la comunidad hispana, el cambio más importante de este ciclo no es
          el precio de las primas — es <strong>quién sigue calificando para subsidio en 2027</strong>.
          A partir del 1 de enero de 2027, la ley federal restringe qué inmigrantes legalmente
          presentes pueden recibir el crédito fiscal para primas (APTC). Para muchos de tus clientes,
          eso significa que el plan del Marketplace que este año les cuesta poco, el próximo año
          podría costar el precio completo.
        </p>

        <p>
          Esta guía te da la tabla exacta de quién mantiene y quién pierde el subsidio, qué hacer con
          cada tipo de cliente, y por qué en Florida el impacto es real pero más moderado que el
          promedio nacional.
        </p>

        <h2>Qué cambió, en una frase</h2>

        <p>
          Antes, casi cualquier inmigrante &quot;legalmente presente&quot; que no calificara para
          Medicaid podía recibir subsidios del Marketplace. La nueva ley reemplaza ese estándar
          amplio por una definición estrecha: solo residentes permanentes legales, ciertos entrantes
          cubanos y haitianos, y nacionales de los países del Pacto de Libre Asociación (COFA)
          siguen siendo elegibles. El resto de las categorías pierde el subsidio a partir del 1 de
          enero de 2027.
        </p>

        <blockquote>
          Este cambio afecta a cerca de 1.2 millones de inmigrantes legalmente presentes a nivel
          nacional que dejarán de calificar para el crédito fiscal en 2027, según estimaciones de
          HHS. No es una proyección lejana: aplica a la cobertura que tus clientes elijan durante el
          OEP de este otoño (1 de noviembre – 15 de diciembre de 2026).
        </blockquote>

        <h2>Quién mantiene el subsidio en 2027</h2>

        <p>
          Estas categorías siguen siendo elegibles para el crédito fiscal para primas después del 1
          de enero de 2027, igual que hoy:
        </p>

        <ul>
          <li>
            <strong>Ciudadanos de EE.UU.</strong> (sin cambios).
          </li>
          <li>
            <strong>Residentes permanentes legales (LPR / green card).</strong> Incluye a quienes
            están en sus primeros cinco años de residencia.
          </li>
          <li>
            <strong>Entrantes cubanos y haitianos</strong>, según la definición de la Refugee
            Education Assistance Act de 1980.
          </li>
          <li>
            <strong>Nacionales COFA</strong>: personas de Micronesia, las Islas Marshall y Palaos
            que residen legalmente en EE.UU.
          </li>
        </ul>

        <h2>Quién pierde el subsidio en 2027</h2>

        <p>
          Estas categorías son elegibles para subsidio en 2026, pero lo pierden a partir del 1 de
          enero de 2027. Siguen pudiendo comprar cobertura del Marketplace, pero a precio completo,
          sin crédito fiscal:
        </p>

        <ul>
          <li>
            <strong>TPS</strong> (Estatus de Protección Temporal).
          </li>
          <li>
            <strong>Asilados</strong> (tanto en trámite como con asilo aprobado).
          </li>
          <li>
            <strong>Refugiados.</strong>
          </li>
          <li>
            <strong>Personas con parole humanitario.</strong>
          </li>
          <li>
            Y otras categorías de inmigrantes legalmente presentes: sobrevivientes de violencia
            doméstica y de trata, entre otros.
          </li>
        </ul>

        <p>
          Un caso aparte: los beneficiarios de <strong>DACA</strong> ya perdieron el acceso a la
          cobertura del Marketplace (con o sin subsidio) a partir del 25 de agosto de 2025, por un
          cambio administrativo previo. Si tienes clientes con DACA, ya no pueden inscribirse en
          planes del Marketplace.
        </p>

        <h2>Por qué Florida es un caso especial</h2>

        <p>
          El impacto nacional es grande, pero tu cartera en Florida probablemente lo sienta menos
          que el promedio, por una razón demográfica: buena parte de la comunidad hispana del estado
          son ciudadanos, residentes permanentes o entrantes cubanos y haitianos — justo las
          categorías que <em>mantienen</em> el subsidio. Florida está entre los estados con mayor
          población de asilados del país, así que sí tendrás clientes afectados; pero la base cubana
          y de green card holders amortigua el golpe frente a estados con mayor proporción de
          refugiados y parolados recientes.
        </p>

        <p>
          La conclusión práctica: no asumas que todos tus clientes inmigrantes pierden el subsidio,
          ni que ninguno lo pierde. Hay que revisar caso por caso.
        </p>

        <h2>Qué hacer con cada cliente, antes del OEP</h2>

        <p>La ventana para actuar es ahora, no en noviembre. Esto es lo que conviene hacer con tu cartera:</p>

        <h3>1. Segmenta tu lista por estatus migratorio</h3>
        <p>
          Identifica qué clientes están en las categorías que pierden elegibilidad (TPS, asilados,
          refugiados, parolados). Son los que necesitan una conversación distinta este OEP.
        </p>

        <h3>2. Para quien mantiene el subsidio</h3>
        <p>
          Renovación normal, pero recuérdales verificar sus datos de ingreso durante el OEP — con
          las primas más altas de 2026, mantener el subsidio bien calculado importa más que nunca.
        </p>

        <h3>3. Para quien pierde el subsidio en 2027</h3>
        <p>
          No los pierdas como clientes. Aunque ya no califiquen para APTC, siguen necesitando
          cobertura, y ahí es donde tu asesoría vale: comparar el plan del Marketplace a precio
          completo contra alternativas fuera del Marketplace (planes privados / off-exchange), o
          evaluar Medicare si aplica por edad. Un cliente que pierde el subsidio y siente que lo
          acompañaste a encontrar la mejor alternativa es un cliente que se queda contigo.
        </p>

        <h2>Cómo EnrollSalud te ayuda con esto</h2>

        <p>
          El cotizador de EnrollSalud pre-clasifica a cada cliente por su estatus migratorio y marca
          en el lead si mantiene o pierde elegibilidad de subsidio a partir de 2027 — la señal
          aparece antes de que inviertas tiempo, para que priorices tu cartera y planees la
          estrategia con cada cliente desde el arranque. El lead que pierde subsidio no se descarta:
          queda etiquetado para canalizarlo a la alternativa correcta, sin perder el rastro.
        </p>

        <p>
          Es orientación para tu trabajo comercial, no una determinación legal de elegibilidad. La
          validación final siempre la hacen el agente y Healthcare.gov.
        </p>

        <p>
          <Link href="/agentes">Ver cómo funciona el triage de elegibilidad en EnrollSalud →</Link>
        </p>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </article>
  );
}
