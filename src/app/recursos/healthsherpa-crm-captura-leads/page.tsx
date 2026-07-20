import Link from "next/link";
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
          Si vendes ACA, casi seguro usas <strong>HealthSherpa</strong> para inscribir — y con
          razón. Es la plataforma de enrollment más usada del mercado: cotiza, inscribe con Enhanced
          Direct Enrollment sin salir a Healthcare.gov, guarda tu cartera y hasta te da una página
          con tu marca para captar clientes. Es gratis y funciona. Este artículo no va de
          reemplazarla.
        </p>

        <p>
          Va de un hueco específico que casi todo agente hispano conoce:{" "}
          <strong>
            el lead que llega, pregunta, compara… y se enfría antes de estar listo para inscribirse
          </strong>
          . Ese cliente tibio, muchas veces hispanohablante, que aún no quiere dar el paso del
          enrollment pero que si lo acompañas en su idioma se convierte más adelante. Ahí es donde
          una capa de captura complementaria suma — sin duplicar lo que HealthSherpa ya hace bien.
        </p>

        <h2>Dónde brilla HealthSherpa</h2>

        <p>Seamos claros, porque el punto no es competir con lo que funciona:</p>

        <ul>
          <li>
            <strong>Enrollment rápido y compliant.</strong> EDE integrado con el Marketplace, sin
            rebotar a Healthcare.gov, con tu NPN aplicado automáticamente.
          </li>
          <li>
            <strong>Tu cartera en un solo lugar.</strong> Clientes, aplicaciones, estatus,
            renovaciones — todo el book of business organizado.
          </li>
          <li>
            <strong>Captura de leads propia.</strong> Tu página de enrollment con tu marca: el
            cliente cotiza y el lead cae en tu dashboard, listo para inscribir.
          </li>
        </ul>

        <p>
          Si el cliente ya está listo para inscribirse, HealthSherpa es difícil de superar. El hueco
          aparece <em>antes</em> de ese momento.
        </p>

        <h2>El hueco: el lead tibio hispano, antes del enrollment</h2>

        <p>
          El flujo de captura de HealthSherpa está diseñado para empujar al enrollment: el cliente
          cotiza y la ruta natural es inscribir. Eso es perfecto para el cliente decidido. Pero el
          mercado hispano tiene mucho lead que <strong>todavía no está ahí</strong>:
        </p>

        <ul>
          <li>
            El que llegó por un anuncio o un referido, tiene dudas, y quiere entender antes de
            comprometerse.
          </li>
          <li>
            El que prefiere que todo el intercambio — la cotización, las preguntas, el seguimiento —
            sea <strong>en español, de forma nativa</strong>, no como una traducción.
          </li>
          <li>
            El que vas a nutrir por <strong>WhatsApp</strong> durante días o semanas antes de que
            diga &quot;ok, inscríbeme&quot;.
          </li>
        </ul>

        <p>
          Ese lead, si lo metes directo a un flujo de enrollment, muchas veces se enfría. Lo que
          necesita primero es captura ligera, bilingüe y sin fricción — y una forma de que tú le des
          seguimiento en su idioma hasta que esté listo. Cuando lo esté, ahí sí: a HealthSherpa a
          inscribir.
        </p>

        <h2>Cómo encajan las dos herramientas</h2>

        <p>
          La forma sana de verlo no es &quot;una u otra&quot;, sino qué herramienta sirve mejor en
          cada etapa del recorrido del cliente:
        </p>

        <table>
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Qué necesita el cliente</th>
              <th>Dónde encaja mejor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Captar</strong> (lead tibio)
              </td>
              <td>Cotización bilingüe sin fricción, sin cuenta, sin compromiso</td>
              <td>Capa de captura (EnrollSalud)</td>
            </tr>
            <tr>
              <td>
                <strong>Nutrir</strong>
              </td>
              <td>Seguimiento en español por WhatsApp hasta que decida</td>
              <td>Capa de captura (EnrollSalud)</td>
            </tr>
            <tr>
              <td>
                <strong>Inscribir</strong>
              </td>
              <td>Aplicación EDE rápida y compliant, con NPN</td>
              <td>HealthSherpa</td>
            </tr>
            <tr>
              <td>
                <strong>Retener</strong>
              </td>
              <td>Renovaciones y gestión del book of business</td>
              <td>HealthSherpa</td>
            </tr>
          </tbody>
        </table>

        <p>
          No se pisan: una captura y calienta al lead hispano en su idioma; la otra inscribe y
          administra la cartera. El agente que usa las dos deja de perder al cliente que
          &quot;todavía lo estoy pensando&quot;.
        </p>

        <h2>Qué hace EnrollSalud en esa capa de captura</h2>

        <p>
          EnrollSalud es un cotizador bilingüe con la marca del agente pensado exactamente para ese
          momento previo al enrollment: el cliente cotiza en español en dos minutos, sin crear
          cuenta y sin dar su número de seguro social, y el lead entra a tu CRM con notificación
          para que le des seguimiento. Cotiza con los mismos planes de Healthcare.gov (API oficial
          del Marketplace de CMS), así que lo que el cliente ve es real. Cuando está listo para
          inscribirse, tú lo llevas a tu flujo de enrollment de siempre.
        </p>

        <p>
          Dicho de otra forma: EnrollSalud captura y calienta; tú inscribes donde ya inscribes. Sin
          duplicar, sin migrar tu cartera, sin pelear con lo que ya te funciona.
        </p>

        <p>
          Si quieres ver esa capa de captura en detalle — el link de cotización propio, el
          consentimiento CMS con firma digital, los recordatorios de renovación — aquí desglosamos{" "}
          <Link href="/crm-para-agentes-de-obamacare">
            qué hace distinto a un CRM para agentes de Obamacare
          </Link>
          .
        </p>

        <p>
          <Link href="/agentes">Ver cómo funciona EnrollSalud para agentes →</Link>
        </p>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </article>
  );
}
