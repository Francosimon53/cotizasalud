import Link from "next/link";
import "../agentes/agentes.css";
import PricingSection from "../agentes/PricingSection";
import { ACA_STATS } from "@/lib/aca-stats";

// Server component a propósito: sin JS de scroll-reveal, por eso ninguna
// sección usa la clase ag-reveal (quedaría invisible sin el observer de /agentes).

export const metadata = {
  alternates: {
    canonical: "/crm-para-agentes-de-obamacare",
  },
  title: "CRM para Agentes de Obamacare | EnrollSalud",
  description:
    "El OEP 2027 dura 45 días. Captura leads con tu propio link de cotización, documenta el consentimiento CMS y no pierdas renovaciones. Desde $29/mes.",
  openGraph: {
    title: "CRM para Agentes de Obamacare | EnrollSalud",
    description:
      "El OEP 2027 dura 45 días. Captura leads con tu propio link de cotización, documenta el consentimiento CMS y no pierdas renovaciones. Desde $29/mes.",
    url: "https://enrollsalud.com/crm-para-agentes-de-obamacare",
    siteName: "EnrollSalud",
    type: "website",
    locale: "es_US",
  },
  twitter: {
    card: "summary",
    title: "CRM para Agentes de Obamacare | EnrollSalud",
    description:
      "El OEP 2027 dura 45 días. Captura leads con tu propio link de cotización, documenta el consentimiento CMS y no pierdas renovaciones. Desde $29/mes.",
  },
};

type Faq = { q: string; a: string };

const faqs: Faq[] = [
  {
    q: "¿Qué diferencia a un CRM para agentes de Obamacare de un CRM genérico?",
    a: "Un CRM genérico organiza contactos; un CRM para agentes de Obamacare entiende el flujo del Marketplace. EnrollSalud incluye consentimiento CMS con firma digital, un pipeline que va de la cotización a la inscripción y recordatorios de renovación pensados para el OEP. Además funciona en español de forma nativa, no como una traducción.",
  },
  {
    q: "¿Cómo encaja EnrollSalud en mi flujo con HealthSherpa?",
    a: "EnrollSalud no reemplaza a HealthSherpa: la complementa. Captura y organiza tus leads antes del enrollment, documenta el consentimiento CMS y te ayuda a retener clientes después. La inscripción sigue haciéndose en HealthSherpa a través de un enlace directo.",
  },
  {
    q: "¿Cómo capturo leads con mi propio link de cotización?",
    a: "Cada agente tiene un enlace personal para compartir por WhatsApp, redes sociales o código QR. Cuando un cliente cotiza desde tu enlace, ve planes reales del Marketplace y su contacto entra automáticamente a tu pipeline. Recibes una notificación al instante para responder mientras el lead sigue caliente.",
  },
  {
    q: "¿El consentimiento CMS queda documentado?",
    a: "Sí. El cliente firma digitalmente y el sistema guarda la firma, la dirección IP y la fecha y hora. Puedes descargar el PDF para tus registros cuando lo necesites.",
  },
  {
    q: "¿Cuánto cuesta EnrollSalud?",
    a: "Básico cuesta $29 al mes e incluye 50 leads. Pro cuesta $79 al mes e incluye 200 leads. Avanzado cuesta $149 al mes e incluye 500 leads. Tu primera suscripción empieza con 14 días de prueba gratis.",
  },
  {
    q: "¿Funciona en español y en inglés?",
    a: "Sí. El cotizador que ve tu cliente es completamente bilingüe: tú compartes un solo enlace y tu cliente elige el idioma en el que se siente cómodo.",
  },
];

// El FAQPage debe reflejar 1:1 el contenido visible de la sección FAQ.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
};

const proseStyle = {
  fontSize: 17,
  color: "var(--text-secondary)",
  lineHeight: 1.7,
  maxWidth: 720,
  marginBottom: 20,
} as const;

export default function CrmParaAgentesDeObamacarePage() {
  return (
    <div className="ag-grain">
      {/* Fonts (mismas que /agentes) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Satoshi:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* NAV */}
      <nav className="ag-nav">
        <Link href="/" className="ag-nav-logo">
          <div className="ag-nav-logo-icon">ES</div>
          <span className="ag-nav-logo-text">EnrollSalud</span>
        </Link>
        <div className="ag-nav-links">
          <Link href="/agentes">Para agentes</Link>
          <Link href="/recursos">Recursos</Link>
          <a href="#precios">Precios</a>
          <Link href="/agentes/registro" className="ag-nav-cta">Crear cuenta &rarr;</Link>
        </div>
      </nav>

      {/* S1 · HERO */}
      <section className="ag-hero">
        <div className="ag-hero-glow ag-hero-glow-1" />
        <div className="ag-hero-glow ag-hero-glow-2" />

        <div className="ag-hero-badge">
          <span className="ag-dot" />
          OEP 2027: {ACA_STATS.oepInicio} al {ACA_STATS.oepFin} — solo {ACA_STATS.oepDias} días
        </div>

        <h1>
          CRM para agentes de Obamacare:<br />
          <em>deja de perder clientes en los dos frentes</em>
        </h1>

        <p className="ag-hero-sub">
          Pierdes leads antes de inscribir — el que cotizó, preguntó por WhatsApp y se enfrió — y
          pierdes clientes después de inscribir, cuando la renovación pasa sin que nadie lo llame.
          EnrollSalud trabaja en esos dos frentes: captura al que cotiza desde tu link y te avisa
          antes de cada renovación.
        </p>

        <p className="ag-hero-sub" style={{ marginTop: -24 }}>
          Y este año duele más: el OEP dura {ACA_STATS.oepDias} días y tus clientes están pagando en
          promedio {ACA_STATS.pagoNetoPct}% más de su bolsillo. Cada lead que se enfría es una venta
          que otro agente cierra.
        </p>

        <div className="ag-hero-actions">
          <Link href="/agentes/registro" className="ag-btn-primary">
            Empieza tu prueba gratis &rarr;
          </Link>
          <a href="#precios" className="ag-btn-secondary">
            Ver precios
          </a>
        </div>
      </section>

      {/* S2 · CATEGORÍA: CRM GENÉRICO VS CRM ACA */}
      <section className="ag-triage-section">
        <div className="ag-section-label">La diferencia de categoría</div>
        <h2>Un CRM genérico no sabe qué es el OEP</h2>
        <p className="ag-triage-desc">
          Los CRM generales están hechos para vender lo que sea a quien sea, todo el año. Tu negocio
          no funciona así: tu año se decide en {ACA_STATS.oepDias} días, cada venta necesita un
          consentimiento que CMS puede auditar, y tu cliente empieza &ldquo;viendo planes&rdquo; mucho
          antes de estar listo para inscribirse. Adaptar un CRM genérico a eso es trabajo tuyo, cada
          día, a mano.
        </p>

        <div className="ag-triage-cols">
          <div className="ag-triage-card lose">
            <h3><span className="ag-triage-dot amber" /> Un CRM genérico</h3>
            <div className="ag-triage-tag">Tú te adaptas a la herramienta</div>
            <ul className="ag-triage-list">
              <li>No sabe qué es un consentimiento CMS ni por qué necesitas guardarlo firmado</li>
              <li>Su pipeline es &ldquo;contactado / cerrado&rdquo; — no distingue quién cotizó, quién eligió plan y quién falta por firmar</li>
              <li>Sus recordatorios no entienden que tus renovaciones se concentran en una ventana de {ACA_STATS.oepDias} días</li>
              <li>El español, si existe, es una traducción — no el idioma en el que trabaja tu cliente</li>
            </ul>
          </div>
          <div className="ag-triage-card keep">
            <h3><span className="ag-triage-dot green" /> Un CRM para agentes ACA</h3>
            <div className="ag-triage-tag">La herramienta habla tu flujo</div>
            <ul className="ag-triage-list">
              <li>El consentimiento CMS con firma digital es un paso del flujo, no un PDF que persigues por email</li>
              <li>El pipeline refleja el recorrido real: cotizó &rarr; eligió plan &rarr; firmó &rarr; inscrito</li>
              <li>Las renovaciones se avisan solas, con la anticipación que exige un OEP corto</li>
              <li>Español nativo para ti y para tu cliente, con inglés disponible cuando lo pida</li>
            </ul>
          </div>
        </div>

        <div className="ag-triage-value">
          No se trata de tener &ldquo;un CRM&rdquo;. Se trata de tener uno que ya sepa cómo se vende
          un plan del Marketplace — para que tu tiempo se vaya en cerrar, no en configurar.
        </div>
      </section>

      {/* S3 · FEATURES → DOLOR */}
      <section className="ag-bento-section" id="funciones">
        <div className="ag-section-label">Qué resuelve, dolor por dolor</div>
        <h2>Cada función existe porque algo se te estaba escapando</h2>

        <div className="ag-bento-grid">
          <div className="ag-bento-card wide">
            <div className="ag-bento-icon green">🔗</div>
            <h3>Tu propio link de cotización que captura el lead</h3>
            <p>El lead que te escribe &ldquo;¿cuánto me sale?&rdquo; y espera tu respuesta hasta la noche, se enfría. Con tu enlace personal, cotiza solo: pone su código postal, su familia y su ingreso, y ve planes reales del Marketplace con subsidio estimado. Su contacto cae en tu pipeline al instante — aunque cotice un domingo a medianoche. Y si quieres tácticas para ponerlo a circular, aquí está la guía completa: <Link href="/recursos/como-conseguir-clientes-de-obamacare" style={{ color: "var(--accent-bright)" }}>cómo conseguir clientes de Obamacare</Link>.</p>
          </div>
          <div className="ag-bento-card">
            <div className="ag-bento-icon cyan">📊</div>
            <h3>Pipeline con alertas, no Excel con pestañas</h3>
            <p>¿Quién cotizó ayer y sigue sin respuesta? ¿Quién eligió plan pero no firmó? El pipeline te lo muestra de un vistazo y te notifica cuando entra un lead nuevo, para que nadie se te quede en el limbo.</p>
          </div>
          <div className="ag-bento-card">
            <div className="ag-bento-icon purple">✍️</div>
            <h3>Consentimiento CMS con firma digital y PDF</h3>
            <p>La venta que se cae esperando una firma, o el consentimiento que no aparece cuando lo piden. Aquí el cliente firma digital dentro del flujo; queda guardado con firma, IP y fecha, y descargas el PDF cuando lo necesites.</p>
          </div>
          <div className="ag-bento-card">
            <div className="ag-bento-icon amber">⏰</div>
            <h3>Renovaciones avisadas 60, 30 y 15 días antes</h3>
            <p>La renovación que nadie llamó es un cliente que otro agente saluda en enero. EnrollSalud te recuerda cada una a los 60, 30 y 15 días — automáticamente, sin que dependa de tu memoria en plena temporada.</p>
          </div>
          <div className="ag-bento-card">
            <div className="ag-bento-icon red">💬</div>
            <h3>Toolkit de WhatsApp para compartir tu link</h3>
            <p>Tu negocio ya vive en WhatsApp; tu herramienta debería alcanzarte ahí. El kit de distribución te da tu enlace, código QR y material listo para compartir en estados, grupos y redes — y en el plan Pro, notificaciones automáticas por WhatsApp.</p>
          </div>
          <div className="ag-bento-card">
            <div className="ag-bento-icon green">📥</div>
            <h3>Import y export CSV compatibles con tu cartera</h3>
            <p>Nadie empieza de cero: importa tus contactos existentes de forma masiva desde un CSV — como el que exporta HealthSherpa — y exporta tus leads cuando quieras. Tus datos son tuyos, de entrada y de salida.</p>
          </div>
        </div>
      </section>

      {/* S4 · CÓMO ENCAJA CON HEALTHSHERPA */}
      <section style={{ padding: "140px 40px", maxWidth: 1000, margin: "0 auto" }}>
        <div className="ag-section-label" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-2)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 20 }}>
          Sin pelear con tu flujo
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 24, maxWidth: 700 }}>
          Cómo encaja con HealthSherpa
        </h2>
        <p style={proseStyle}>
          Si inscribes en HealthSherpa, sigue inscribiendo en HealthSherpa. EnrollSalud no compite
          con tu herramienta de enrollment: trabaja en las etapas donde el enrollment todavía no
          ayuda. Antes de la inscripción, captura al lead que cotiza desde tu link, lo organiza en
          tu pipeline y documenta el consentimiento CMS con firma digital. Después de la
          inscripción, vigila las renovaciones para que ningún cliente se te vaya en silencio.
        </p>
        <p style={proseStyle}>
          Cuando el cliente está listo para inscribirse, un enlace directo te lleva a completar el
          enrollment donde siempre lo has hecho, con tu NPN y tu proceso de siempre. Sin migrar tu
          cartera, sin duplicar trabajo, sin cambiar lo que ya te funciona.
        </p>
        <p style={{ ...proseStyle, marginBottom: 0 }}>
          <Link href="/recursos/healthsherpa-crm-captura-leads" style={{ color: "var(--accent-bright)" }}>
            Lee el desglose completo: HealthSherpa + un CRM de captura &rarr;
          </Link>
        </p>
      </section>

      {/* S5 · CONTEXTO 2026–2027 */}
      <section style={{ padding: "100px 40px 60px", textAlign: "center" }}>
        <div className="ag-section-label" style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 20 }}>
          El contexto 2026–2027
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 24 }}>
          Nunca fue tan caro dejar enfriar un lead
        </h2>
        <p style={{ ...proseStyle, margin: "0 auto 40px" }}>
          Con la expiración de los subsidios mejorados, las aseguradoras subieron sus primas brutas
          ~{ACA_STATS.primaBrutaPct}% en promedio, el pago neto de bolsillo de los inscritos subió
          ~{ACA_STATS.pagoNetoPct}%, y quien mantiene su mismo plan puede llegar a pagar hasta
          ~{ACA_STATS.mismoPlanPct}% más ({ACA_STATS.fuente}). Tus clientes tienen más dudas, más
          miedo al precio y más razones para comparar — y tú tienes del {ACA_STATS.oepInicio} al{" "}
          {ACA_STATS.oepFin} para atenderlos a todos.
        </p>

        <div className="ag-stats-bar" style={{ marginBottom: 40 }}>
          <div className="ag-stat">
            <div className="ag-stat-value">+{ACA_STATS.primaBrutaPct}%</div>
            <div className="ag-stat-label">Prima bruta promedio 2026</div>
          </div>
          <div className="ag-stat">
            <div className="ag-stat-value">+{ACA_STATS.pagoNetoPct}%</div>
            <div className="ag-stat-label">Pago neto de bolsillo 2026</div>
          </div>
          <div className="ag-stat">
            <div className="ag-stat-value">+{ACA_STATS.mismoPlanPct}%</div>
            <div className="ag-stat-label">Manteniendo el mismo plan</div>
          </div>
          <div className="ag-stat">
            <div className="ag-stat-value">{ACA_STATS.oepDias}</div>
            <div className="ag-stat-label">Días de OEP 2027</div>
          </div>
        </div>

        <p style={{ fontSize: 15, color: "var(--text-muted)", maxWidth: 640, margin: "0 auto", lineHeight: 1.7 }}>
          Y desde el 1 de enero de 2027 cambian las reglas de elegibilidad de subsidio por estatus
          migratorio —{" "}
          <Link href="/recursos/elegibilidad-subsidio-aca-2027" style={{ color: "var(--accent-bright)" }}>
            aquí el desglose de quién mantiene y quién pierde el subsidio
          </Link>
          .
        </p>
      </section>

      {/* S6 · PRECIOS */}
      <p style={{ textAlign: "center", fontSize: 16, color: "var(--text-secondary)", padding: "0 24px", margin: "0 0 -40px", position: "relative", zIndex: 1 }}>
        14 días de prueba gratis en tu primera suscripción — no se te cobra nada hasta el día 15.
      </p>
      <PricingSection />

      {/* S7 · FAQ */}
      <section className="ag-faq-section" id="faq">
        <div className="ag-section-label">Preguntas frecuentes</div>
        <h2>Lo que preguntan los agentes <em>antes de empezar</em></h2>

        <div className="ag-faq-list">
          {faqs.map((faq, i) => (
            <details className="ag-faq-item" key={i}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      </section>

      {/* S8 · CTA FINAL */}
      <section className="ag-cta-section">
        <h2>
          Este OEP, que no se te enfríe<br /><em>ni un solo cliente</em>
        </h2>
        <p className="ag-cta-desc">
          Comparte tu link, deja que tus clientes coticen solos y dedica los {ACA_STATS.oepDias} días
          a cerrar — no a perseguir firmas ni a repasar pestañas de Excel.
        </p>
        <div>
          <Link href="/agentes/registro" className="ag-btn-primary" style={{ fontSize: 18, padding: "20px 48px" }}>
            Crea tu cuenta gratis &rarr;
          </Link>
        </div>
        <p style={{ marginTop: 24, fontSize: 15 }}>
          <Link href="/agentes" style={{ color: "var(--text-secondary)" }}>
            O conoce toda la plataforma para agentes &rarr;
          </Link>
        </p>
      </section>

      {/* FOOTER */}
      <footer className="ag-footer">
        <div className="ag-footer-left">
          <div className="ag-footer-logo-icon">ES</div>
          <span className="ag-footer-text">© 2026 EnrollSalud. Todos los derechos reservados.</span>
        </div>
        <div className="ag-footer-links">
          <a href="/agentes">Para agentes</a>
          <a href="/recursos">Recursos</a>
          <a href="/privacy">Privacidad</a>
          <a href="/terms">Términos</a>
          <a href="/compliance">Cumplimiento</a>
          <a href="/ai-disclaimer">Aviso IA</a>
          <a href="/agentes/login">Portal Agentes</a>
          <a href="mailto:info@enrollsalud.com">Contacto</a>
        </div>
      </footer>
    </div>
  );
}
