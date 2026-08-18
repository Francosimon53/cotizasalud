"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import "./agentes.css";
import PricingSection from "./PricingSection";

const ArrowIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
    <path d="M5 12h14m-6-6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
    <polygon points="5,3 19,12 5,21" fill="currentColor" opacity="0.8"/>
  </svg>
);

type Testimonio = { initials: string; name: string; role: string; quote: string };

// poblar con testimonios reales verificados
const testimonios: Testimonio[] = [];

type Faq = { q: string; a: string };

const faqs: Faq[] = [
  {
    q: "¿Qué es EnrollSalud?",
    a: "Es una plataforma para agentes de seguros de salud ACA hispanos. Incluye un cotizador bilingüe con los mismos planes de Healthcare.gov, un CRM de leads y consentimiento CMS con firma digital.",
  },
  {
    q: "¿EnrollSalud reemplaza a HealthSherpa?",
    a: "No. EnrollSalud captura y organiza tus leads antes del enrollment y te ayuda a retener clientes después. Tú sigues inscribiendo en HealthSherpa; EnrollSalud se conecta con un enlace directo.",
  },
  {
    q: "¿Los planes y precios que cotiza son reales?",
    a: "Sí. EnrollSalud cotiza con la API oficial del Marketplace de CMS. Son los mismos datos de Healthcare.gov y cuidadodesalud.gov.",
  },
  {
    q: "¿Cuánto cuesta EnrollSalud?",
    a: "Básico cuesta $29 al mes e incluye 50 leads. Pro cuesta $79 al mes e incluye 200 leads. Avanzado cuesta $149 al mes e incluye 500 leads.",
  },
  {
    q: "¿Cómo llegan los leads a mi cuenta?",
    a: "Cada agente tiene un enlace personal para compartir por WhatsApp, redes sociales o código QR. Cuando un cliente cotiza desde tu enlace, el lead entra a tu CRM y recibes una notificación.",
  },
  {
    q: "¿Qué es el triage de elegibilidad 2027?",
    a: "Desde el 1 de enero de 2027 cambian las reglas de elegibilidad de subsidio por estatus migratorio. EnrollSalud marca cada lead según si mantiene o pierde elegibilidad, para que priorices tu cartera antes del OEP.",
  },
  {
    q: "¿El consentimiento cumple los requisitos de CMS?",
    a: "Sí. El cliente firma digitalmente y el sistema guarda firma, IP y fecha/hora. Puedes descargar el PDF para tus registros.",
  },
  {
    q: "¿Funciona en español y en inglés?",
    a: "Sí. El cotizador que ve tu cliente es completamente bilingüe.",
  },
  {
    q: "¿Cómo empiezo?",
    a: "Regístrate en enrollsalud.com/agentes/registro, configura tu NPN y comparte tu enlace personal.",
  },
];

// El FAQPage debe reflejar 1:1 el contenido visible de la sección FAQ.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
    {
      "@type": "SoftwareApplication",
      name: "EnrollSalud",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://enrollsalud.com/agentes",
      description:
        "Plataforma para agentes de seguros de salud ACA hispanos con cotizador bilingüe de los mismos planes de Healthcare.gov, CRM de leads y consentimiento CMS con firma digital.",
      inLanguage: ["es", "en"],
      offers: [
        { "@type": "Offer", name: "Básico", price: "29", priceCurrency: "USD" },
        { "@type": "Offer", name: "Pro", price: "79", priceCurrency: "USD" },
        { "@type": "Offer", name: "Avanzado", price: "149", priceCurrency: "USD" },
      ],
    },
  ],
};

export default function AgentesPage() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Nav scroll morph
    const onScroll = () => {
      navRef.current?.classList.toggle("scrolled", window.scrollY > 60);
    };
    window.addEventListener("scroll", onScroll);

    // Scroll reveal
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".ag-reveal").forEach((el, i) => {
      (el as HTMLElement).style.transitionDelay = `${i * 0.05}s`;
      observer.observe(el);
    });

    // Counter animation
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const text = el.textContent || "";
            const match = text.match(/([\d.]+)/);
            if (match) {
              const target = parseFloat(match[1]);
              const isDecimal = text.includes(".");
              let current = 0;
              const duration = 1500;
              const steps = 60;
              const increment = target / steps;
              const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                  current = target;
                  clearInterval(timer);
                }
                const display = isDecimal ? current.toFixed(1) : String(Math.ceil(current));
                el.textContent = text.replace(match[0], display);
              }, duration / steps);
            }
            counterObserver.unobserve(el);
          }
        });
      },
      { threshold: 0.5 }
    );
    document.querySelectorAll(".ag-stat-value, .ag-roi-number").forEach((el) => {
      counterObserver.observe(el);
    });

    // Smooth scroll for hash links
    const handleHashClick = (e: Event) => {
      const anchor = (e.currentTarget as HTMLAnchorElement).getAttribute("href");
      if (anchor?.startsWith("#")) {
        e.preventDefault();
        const target = document.querySelector(anchor);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", handleHashClick);
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      counterObserver.disconnect();
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.removeEventListener("click", handleHashClick);
      });
    };
  }, []);

  return (
    <div className="ag-grain">
      {/* Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
        rel="stylesheet"
      />
      {/* CSS now imported via agentes.css */}

      {/* NAVIGATION */}
      <nav ref={navRef} className="ag-nav" id="ag-nav">
        <Link href="/" className="ag-nav-logo" aria-label="EnrollSalud — Inicio">
          <div className="ag-nav-logo-icon">ES</div>
          <span className="ag-nav-logo-text">EnrollSalud</span>
        </Link>
        <div className="ag-nav-links">
          <a href="#ai-advisor">AI Advisor</a>
          <a href="#features">Funciones</a>
          {testimonios.length > 0 && <a href="#testimonials">Testimonios</a>}
          <a href="#roi">ROI</a>
          <a href="#precios">Precios</a>
          <Link href="/agentes/login" className="ag-nav-login">Iniciar Sesión</Link>
          <Link href="/agentes/registro" className="ag-nav-cta">Crear Cuenta &rarr;</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="ag-hero">
        <div className="ag-hero-glow ag-hero-glow-1" />
        <div className="ag-hero-glow ag-hero-glow-2" />

        <div className="ag-hero-badge ag-reveal">
          <span className="ag-dot" />
          OEP 2027: abre 1 nov — 15 dic para cobertura en enero
        </div>

        <h1 className="ag-reveal">
          Deja de perder clientes<br /><em>por cotizar tarde</em>
        </h1>

        <p className="ag-hero-sub ag-reveal">
          Mientras armas la cotización a mano, otro agente ya le contestó a tu cliente.
          Con tu link de EnrollSalud, tu cliente ve planes reales del Marketplace en
          2 minutos — y el contacto cae en tu pipeline con aviso al instante.
        </p>

        <div className="ag-hero-actions ag-reveal">
          <Link href="/cotizar" className="ag-btn-primary">
            Empieza a cotizar gratis
            <ArrowIcon />
          </Link>
          <a href="#ai-advisor" className="ag-btn-secondary">
            <PlayIcon />
            Ver AI Advisor en acción
          </a>
        </div>
      </section>

      {/* STATS BAR */}
      <div className="ag-stats-bar ag-reveal">
        <div className="ag-stat">
          <div className="ag-stat-value">2 min</div>
          <div className="ag-stat-label">Cotización completa</div>
        </div>
        <div className="ag-stat">
          <div className="ag-stat-value">45</div>
          <div className="ag-stat-label">Días para cobertura en enero</div>
        </div>
        <div className="ag-stat">
          <div className="ag-stat-value">100%</div>
          <div className="ag-stat-label">Bilingüe ES/EN</div>
        </div>
        <div className="ag-stat">
          <div className="ag-stat-value">14 días</div>
          <div className="ag-stat-label">De prueba gratis</div>
        </div>
      </div>

      {/* AI ADVISOR SECTION */}
      <section className="ag-ai-section" id="ai-advisor">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="ag-section-label ag-reveal">AI Advisor</div>
          <h2 className="ag-reveal">Deja de explicar el mismo plan <em>veinte veces al día</em></h2>
          <p className="ag-section-desc ag-reveal">
            Tu cliente no compra lo que no entiende — y tú no tienes tiempo de dar una clase de seguros por cada cotización. El AI Advisor le explica cada plan como lo harías tú: qué cubre, cuánto cuesta en la vida real, qué cambió en 2026 y cómo pagar menos. En español simple, sin siglas.
          </p>

          <div className="ag-ai-grid">
            {/* Demo Chat */}
            <div className="ag-ai-demo ag-animated-border ag-reveal">
              <div className="ag-ai-demo-header">
                <div className="ag-ai-demo-avatar">🧠</div>
                <div>
                  <div className="ag-ai-demo-name">AI Plan Advisor</div>
                </div>
                <div className="ag-ai-demo-tag">● En vivo</div>
              </div>

              <div className="ag-ai-chat-msg user" style={{ animationDelay: "0.3s" }}>
                Mi cliente gana $65,000 al año, familia de 1. Explícame el plan Bronze HSA.
              </div>

              <div className="ag-ai-chat-msg ai" style={{ animationDelay: "0.8s" }}>
                <strong>Blue Cross Bronze HSA — Tu Guía Completa</strong><br /><br />
                Este plan es ideal si buscas la prima más baja: <strong>$254/mes</strong>. Funciona como una membresía de gym económica — pagas poco mensual, pero si necesitas algo grande, gastas más de tu bolsillo.<br /><br />
                <strong>📉 Lo que cambió en 2026:</strong> El año pasado, con tu mismo ingreso, hubieras pagado ~$80/mes porque el gobierno ayudaba a todos. Esa protección expiró. Ahora pagas $254 — son <strong>$174 más al mes</strong>, o sea <strong>$2,088 al año</strong>.<br /><br />
                <strong>💡 Pero hay buenas noticias:</strong> Este plan tiene cuenta de ahorros médicos. Si depositas $4,300, tu ingreso para el gobierno baja de $65,000 a $60,700 — debajo del límite de $62,600. <strong>Recuperas el descuento y tu prima podría bajar a ~$0/mes.</strong><br /><br />
                <strong>✅ Lo que te recomiendo:</strong> Elige este plan, abre una cuenta de ahorros médicos, y deposita $4,300. Te ahorras ~$3,048/año en primas + $946 en impuestos = <strong>$3,994 de ahorro total.</strong>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="ag-ai-features-list ag-reveal">
              <div className="ag-ai-feature-card">
                <h4>🧠 Un asesor, todo incluido</h4>
                <p>Plan de salud + situación financiera + estrategia de ahorro + comparación con el año pasado — todo en una sola explicación, sin necesidad de abrir 4 pantallas diferentes.</p>
              </div>
              <div className="ag-ai-feature-card">
                <h4>📉 Comparación 2025 vs 2026 automática</h4>
                <p>La IA le muestra a tu cliente exactamente cuánto más está pagando vs el año pasado y por qué. El gancho perfecto para que entienda la urgencia de actuar.</p>
              </div>
              <div className="ag-ai-feature-card">
                <h4>🗣️ Cero jerga, puro español</h4>
                <p>Nada de MAGI, FPL, APTC ni siglas. La IA habla como un amigo que sabe de seguros: &ldquo;el descuento del gobierno&rdquo;, &ldquo;tu cuenta de ahorros médicos&rdquo;. Tu cliente entiende todo a la primera.</p>
              </div>
              <div className="ag-ai-feature-card">
                <h4>💰 Estrategia financiera personalizada</h4>
                <p>Si tu cliente está cerca del límite o sobre él, la IA calcula exactamente cuánto depositar para recuperar el descuento del gobierno. Con sus números reales, no ejemplos genéricos.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO FEATURES */}
      <section className="ag-bento-section" id="features">
        <div className="ag-section-label ag-reveal">Tu flujo completo</div>
        <h2 className="ag-reveal">Menos noches cotizando, menos clientes que se enfrían</h2>

        <div className="ag-bento-grid">
          <div className="ag-bento-card wide ag-reveal">
            <div className="ag-bento-icon green">📋</div>
            <h3>Cotiza en 2 minutos, no en una noche</h3>
            <p>Tu cliente entra desde tu link, pone su código postal, su familia y su ingreso — y ve planes reales del Marketplace con el subsidio estimado ya aplicado. La cotización que antes te costaba una llamada de una hora ahora ocurre sola, incluso mientras duermes.</p>
          </div>
          <div className="ag-bento-card ag-reveal">
            <div className="ag-bento-icon cyan">✍️</div>
            <h3>El consent CMS, sin perseguir a nadie</h3>
            <p>¿Cuántas ventas se te han caído esperando una firma? Aquí el cliente firma digital justo después de elegir plan. Queda guardado con firma, IP y fecha — y puedes descargar el PDF cuando lo necesites.</p>
          </div>
          <div className="ag-bento-card ag-reveal">
            <div className="ag-bento-icon purple">🔗</div>
            <h3>Tu link trabaja cuando tú no puedes</h3>
            <p>Los leads se enfrían en horas. Comparte tu URL única por WhatsApp, redes o código QR: cuando alguien cotiza, el contacto entra a tu pipeline y te llega una notificación al instante — respondes mientras aún está caliente.</p>
          </div>
          <div className="ag-bento-card ag-reveal">
            <div className="ag-bento-icon amber">📊</div>
            <h3>Jubila el Excel como CRM</h3>
            <p>Nada de buscar en pestañas quién era el que faltaba por firmar. Ve quién cotizó, qué plan eligió y si firmó el consent, en un pipeline visual donde no se te escapa ningún prospecto.</p>
          </div>
          <div className="ag-bento-card wide ag-reveal">
            <div className="ag-bento-icon red">🧠</div>
            <h3>Las explicaciones, delegadas</h3>
            <p>El AI Advisor le explica a tu cliente el plan, su situación financiera, qué cambió en 2026 y qué le conviene hacer — con sus números reales, en español simple. Tú entras a la conversación cuando ya entendió, listo para cerrar.</p>
          </div>
        </div>
      </section>

      {/* IMMIGRATION ELIGIBILITY TRIAGE */}
      <section className="ag-triage-section" id="elegibilidad-2027">
        <div className="ag-section-label ag-reveal">Elegibilidad 2027</div>
        <h2 className="ag-reveal">Sabe qué clientes pierden subsidio en 2027 — antes de perder horas</h2>
        <p className="ag-triage-desc ag-reveal">
          El cotizador pre-clasifica a cada cliente por su estatus migratorio y marca el impacto en su
          elegibilidad de subsidio a partir del 1 de enero de 2027. Ves la señal en el lead antes de
          invertir tiempo, para planear tu estrategia con cada cliente desde el arranque.
        </p>

        <div className="ag-triage-cols">
          <div className="ag-triage-card keep ag-reveal">
            <h3><span className="ag-triage-dot green" /> Mantienen el subsidio</h3>
            <div className="ag-triage-tag">Elegibles en 2026 y en 2027</div>
            <ul className="ag-triage-list">
              <li>Ciudadanos de EE.UU.</li>
              <li>Residentes permanentes legales (LPR / green card)</li>
              <li>Entrantes cubanos y haitianos</li>
              <li>Nacionales COFA (Micronesia, Islas Marshall, Palaos)</li>
            </ul>
          </div>
          <div className="ag-triage-card lose ag-reveal">
            <h3><span className="ag-triage-dot amber" /> Pierden el subsidio en 2027</h3>
            <div className="ag-triage-tag">Elegibles en 2026 — sin subsidio desde el 1-ene-2027</div>
            <ul className="ag-triage-list">
              <li>TPS (Estatus de Protección Temporal)</li>
              <li>Asilados (en trámite y aprobados)</li>
              <li>Refugiados</li>
              <li>Parolados (parole humanitario)</li>
            </ul>
          </div>
        </div>

        <div className="ag-triage-value ag-reveal">
          El lead que pierde subsidio no se bota: el cotizador lo <strong>etiqueta</strong> para
          canalizarlo a un plan privado / off-exchange o a Medicare, según su caso. No se te pierde el
          rastro de ningún cliente — cada estatus queda registrado en tu pipeline con su señal de elegibilidad.
        </div>

        <div className="ag-triage-disclaimer ag-reveal">
          <span className="ag-triage-disclaimer-icon">⚠️</span>
          <span>
            Es orientación, no una determinación legal de elegibilidad. La validación final la hacen el
            agente y Healthcare.gov.
          </span>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {testimonios.length > 0 && (
        <section className="ag-social-section" id="testimonials">
          <div className="ag-section-label ag-reveal">Agentes que confían en nosotros</div>
          <h2 className="ag-reveal">Lo que dicen los agentes</h2>

          <div className="ag-testimonials-grid">
            {testimonios.map((tm, i) => (
              <div className="ag-testimonial ag-reveal" key={i}>
                <div className="ag-testimonial-stars">★★★★★</div>
                <p className="ag-testimonial-text">&ldquo;{tm.quote}&rdquo;</p>
                <div className="ag-testimonial-author">
                  <div className="ag-testimonial-avatar">{tm.initials}</div>
                  <div className="ag-testimonial-info">
                    <h4>{tm.name}</h4>
                    <p>{tm.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ROI SECTION */}
      <section className="ag-roi-section" id="roi">
        <div className="ag-section-label ag-reveal">Haz cuentas</div>
        <h2 className="ag-reveal">Lo que te cuesta seguir cotizando a mano</h2>

        <div className="ag-roi-cards">
          <div className="ag-roi-card ag-reveal">
            <div className="ag-roi-number">45</div>
            <h4>Días para cobertura en enero</h4>
            <p>El OEP 2027 abre el 1 de noviembre, pero quien no cierra antes del 15 de diciembre no tiene cobertura hasta el 1 de febrero. Son 45 días para asegurar el 1 de enero, y cada cotización que te toma una noche es un cliente que otro agente cierra primero.</p>
          </div>
          <div className="ag-roi-card ag-reveal">
            <div className="ag-roi-number">60/30/15</div>
            <h4>Renovaciones que no se escapan</h4>
            <p>¿Cuántas renovaciones se te fueron el año pasado sin darte cuenta? EnrollSalud te recuerda cada una 60, 30 y 15 días antes, automáticamente.</p>
          </div>
          <div className="ag-roi-card ag-reveal">
            <div className="ag-roi-number">$0</div>
            <h4>Para empezar</h4>
            <p>14 días de prueba gratis con los límites del plan Pro. Sin permanencia, sin sorpresas.</p>
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <PricingSection />

      {/* FAQ SECTION */}
      <section className="ag-faq-section" id="faq">
        <div className="ag-section-label ag-reveal">Preguntas frecuentes</div>
        <h2 className="ag-reveal">Lo que todo agente <em>quiere saber</em></h2>

        <div className="ag-faq-list">
          {faqs.map((faq, i) => (
            <details className="ag-faq-item ag-reveal" key={i}>
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

      {/* CTA SECTION */}
      <section className="ag-cta-section">
        <h2 className="ag-reveal">¿Cuántos clientes perdiste<br /><em>por cotizar tarde?</em></h2>
        <p className="ag-cta-desc ag-reveal">Que este OEP no te agarre cotizando a medianoche en Excel. Comparte tu link, deja que tus clientes coticen solos y dedica tu tiempo a cerrar.</p>
        <div className="ag-reveal">
          <Link href="/cotizar" className="ag-btn-primary" style={{ fontSize: 18, padding: "20px 48px" }}>
            Empieza a cotizar gratis
            <ArrowIcon />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ag-footer">
        <div className="ag-footer-left">
          <div className="ag-footer-logo-icon">ES</div>
          <span className="ag-footer-text">© 2026 EnrollSalud. Todos los derechos reservados.</span>
        </div>
        <div className="ag-footer-links">
          <a href="/crm-para-agentes-de-obamacare">CRM para agentes de Obamacare</a>
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
