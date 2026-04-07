"use client";

import { useEffect } from "react";
import Link from "next/link";
import "./landing.css";

export default function HomePage() {
  useEffect(() => {
    // Scroll nav effect
    const nav = document.querySelector(".es-nav");
    const handleScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);

    // Reveal on scroll
    const reveals = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => observer.observe(el));

    // FAQ toggles
    document.querySelectorAll(".faq-q").forEach((q) => {
      q.addEventListener("click", () => q.parentElement?.classList.toggle("open"));
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {/* NAV */}
      <nav className="es-nav scrolled">
        <div className="es-nav-inner">
          <Link href="/" className="es-nav-logo"><span className="icon">🏥</span> EnrollSalud</Link>
          <div className="es-nav-links">
            <a href="#como-funciona">Cómo Funciona</a>
            <a href="#beneficios">Beneficios</a>
            <Link href="/agentes">Para Agentes</Link>
            <a href="#precios">Precios</a>
            <Link href="/cotizar" className="es-nav-cta">Cotizar Ahora →</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-inner">
          <div>
            <div className="hero-badge"><span className="pulse" /> OEP 2026 — Primas subieron 26%</div>
            <h1>Seguro médico<br /><span className="accent">sin complicaciones</span></h1>
            <p className="hero-sub">Compara planes ACA del Marketplace con subsidios estimados en 2 minutos. Bilingüe. Gratis. Sin crear cuenta en HealthCare.gov.</p>
            <div className="hero-actions">
              <Link href="/cotizar" className="btn-primary">Cotiza Gratis en 2 Min →</Link>
              <Link href="/agentes" className="btn-secondary">🏢 Soy Agente</Link>
            </div>
            <div className="hero-stats">
              <div className="hero-stat"><div className="num">$0</div><div className="label">Costo para ti</div></div>
              <div className="hero-stat"><div className="num">2min</div><div className="label">Tiempo promedio</div></div>
              <div className="hero-stat"><div className="num">8+</div><div className="label">Planes comparados</div></div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-phone">
              <div className="hero-phone-screen">
                <div className="phone-header">
                  <h3>🏥 EnrollSalud</h3>
                  <p>Tu cotización gratis en 2 minutos</p>
                </div>
                <div className="phone-body">
                  <div className="phone-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span className="phone-badge" style={{ background: "#b45309" }}>ORO</span>
                        <div className="phone-plan-name" style={{ marginTop: 4 }}>Ambetter Gold</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: "#b0b0b0", textDecoration: "line-through" }}>$580/mes</div>
                        <div className="phone-plan-price">$141</div>
                        <div className="phone-plan-label">/mes</div>
                      </div>
                    </div>
                    <div className="phone-stats">
                      <div className="phone-stat"><div className="l">Deducible</div><div className="v">$1,163</div></div>
                      <div className="phone-stat"><div className="l">Máx. Bolsillo</div><div className="v">$7,000</div></div>
                    </div>
                  </div>
                  <div className="phone-card" style={{ opacity: 0.7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span className="phone-badge" style={{ background: "#6b7280" }}>PLATA</span>
                        <div className="phone-plan-name" style={{ marginTop: 4 }}>Molina Silver</div>
                      </div>
                      <div className="phone-plan-price" style={{ fontSize: 18 }}>$98<span className="phone-plan-label">/mes</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="float-badge b1">🇪🇸 Bilingüe nativo</div>
            <div className="float-badge b2">⚡ Sin cuenta HC.gov</div>
          </div>
        </div>
      </section>

      {/* URGENCY BAR */}
      <div className="urgency">
        ⚠️ Las primas ACA subieron <span>26%</span> para 2026 — Los subsidios mejorados EXPIRARON — Millones pagarán más sin orientación
      </div>

      {/* SOCIAL PROOF */}
      <div className="proof-bar">
        <div className="proof-bar-inner">
          <div className="proof-item"><span className="icon">🛡️</span> Datos del API oficial de CMS</div>
          <div className="proof-item"><span className="icon">🔒</span> Información encriptada</div>
          <div className="proof-item"><span className="icon">🇺🇸</span> Planes reales del Marketplace</div>
          <div className="proof-item"><span className="icon">⭐</span> Agentes licenciados NPN verificados</div>
        </div>
      </div>

      {/* PROBLEM */}
      <section className="problem" id="problema">
        <div className="section-inner">
          <div className="section-label reveal">⚠️ El Problema</div>
          <h2 className="section-title reveal">El sistema de salud en EE.UU.<br />es confuso por diseño</h2>
          <p className="section-sub reveal">Especialmente si tu idioma principal es español.</p>
          <div className="problem-grid">
            <div className="problem-card reveal"><div className="icon">📊</div><h3>Primas por las nubes</h3><p>Las primas ACA subieron un promedio de 26% para 2026 — el mayor aumento desde 2018.</p><div className="stat">+26%</div></div>
            <div className="problem-card reveal"><div className="icon">💸</div><h3>Subsidios eliminados</h3><p>Los subsidios mejorados del ARPA/IRA expiraron. Millones de familias pagarán el doble o más.</p><div className="stat">2x</div></div>
            <div className="problem-card reveal"><div className="icon">🌐</div><h3>Barrera del idioma</h3><p>HealthCare.gov tiene traducción parcial. Los formularios, copays, y deducibles son confusos incluso en inglés.</p><div className="stat">23M+</div></div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="solution" id="como-funciona">
        <div className="section-inner">
          <div className="section-label reveal">✨ Cómo Funciona</div>
          <h2 className="section-title reveal">Tu cotización en 4 pasos simples</h2>
          <p className="section-sub reveal">Sin crear cuenta. Sin número de seguro social. Sin compromisos.</p>
          <div className="steps">
            <div className="step reveal"><div className="step-num">1</div><div className="icon">📍</div><h3>Tu ubicación</h3><p>Ingresa tu código postal. Detectamos tu condado y planes disponibles.</p><span className="step-time">10 seg</span></div>
            <div className="step reveal"><div className="step-num">2</div><div className="icon">👨‍👩‍👧‍👦</div><h3>Tu hogar</h3><p>Agrega edades, género. Hasta 8 personas. Nada de SSN ni documentos.</p><span className="step-time">30 seg</span></div>
            <div className="step reveal"><div className="step-num">3</div><div className="icon">💰</div><h3>Tu ingreso</h3><p>Ingreso anual del hogar para calcular tu subsidio estimado (APTC).</p><span className="step-time">10 seg</span></div>
            <div className="step reveal"><div className="step-num">4</div><div className="icon">📋</div><h3>Tus planes</h3><p>Compara primas, deducibles, copays. Elige tu plan y un agente te contacta.</p><span className="step-time">60 seg</span></div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="benefits" id="beneficios">
        <div className="section-inner">
          <div className="section-label reveal">💚 Beneficios</div>
          <h2 className="section-title reveal">¿Por qué EnrollSalud?</h2>
          <p className="section-sub reveal">Diseñado para familias hispanas que merecen entender sus opciones.</p>
          <div className="benefits-grid">
            <div className="benefit reveal"><div className="icon">🇪🇸</div><h3>100% Bilingüe</h3><p>No es Google Translate. Es UX diseñada desde cero en español con terminología que entiendes.</p></div>
            <div className="benefit reveal"><div className="icon">⚡</div><h3>2 Minutos</h3><p>Sin crear cuentas, sin documentos, sin esperas. Resultados instantáneos con subsidios estimados.</p></div>
            <div className="benefit reveal"><div className="icon">🔒</div><h3>100% Privado</h3><p>No pedimos SSN ni documentos. Solo edad, ZIP e ingreso para calcular tu cotización.</p></div>
            <div className="benefit reveal"><div className="icon">📱</div><h3>WhatsApp Ready</h3><p>Tu agente te envía un link por WhatsApp con tu nombre y datos ya cargados. Solo toca ver planes.</p></div>
            <div className="benefit reveal"><div className="icon">💵</div><h3>Completamente Gratis</h3><p>EnrollSalud no te cobra nada. Los agentes licenciados ganan comisiones de los carriers, no de ti.</p></div>
            <div className="benefit reveal"><div className="icon">🤝</div><h3>Agente Real</h3><p>No eres un número. Un agente licenciado te contacta en tu idioma para ayudarte a inscribirte.</p></div>
          </div>
        </div>
      </section>

      {/* DUAL AUDIENCE */}
      <section className="audience" id="agentes-section">
        <div className="section-inner">
          <div className="section-label reveal">🎯 Para Ti</div>
          <h2 className="section-title reveal">Dos audiencias. Una plataforma.</h2>
          <div className="audience-grid">
            <div className="audience-card consumer reveal">
              <span className="tag">Para Familias</span>
              <h3>Busca tu seguro médico sin estrés</h3>
              <ul><li>Compara planes reales del Marketplace ACA</li><li>Ve tu subsidio estimado antes de inscribirte</li><li>Todo en español — sin traducción robótica</li><li>Un agente licenciado te ayuda gratis</li><li>Sin SSN, sin documentos, sin compromisos</li></ul>
              <Link href="/cotizar" className="cta">Cotizar Ahora →</Link>
            </div>
            <div className="audience-card agent reveal">
              <span className="tag">Para Agentes & Brokers</span>
              <h3>Tu cotizador con tu marca en minutos</h3>
              <ul><li>Etiqueta privada: tu logo, tu nombre, tus colores</li><li>Smart links para WhatsApp, SMS, email, redes</li><li>Captura leads automáticamente con notificaciones</li><li>Dashboard con analytics de conversión</li><li>Tú conservas 100% de tus comisiones</li></ul>
              <Link href="/agentes" className="cta">Ver Plataforma →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials">
        <div className="section-inner">
          <div className="section-label reveal">💬 Testimonios</div>
          <h2 className="section-title reveal">Lo que dicen nuestros usuarios</h2>
          <div className="testimonials-grid">
            <div className="testimonial reveal">
              <div className="stars">★★★★★</div>
              <p>Por fin entendí lo que estaba pagando. En HealthCare.gov me perdía. Aquí en 2 minutos vi mis opciones y el agente me llamó al día siguiente en español.</p>
              <div className="author"><div className="avatar">MG</div><div><div className="name">María G.</div><div className="role">Cape Coral, FL · Familia de 4</div></div></div>
            </div>
            <div className="testimonial reveal">
              <div className="stars">★★★★★</div>
              <p>Uso EnrollSalud como mi cotizador con mi marca. Envío el link por WhatsApp y el cliente ya tiene todo listo cuando me llama. Me ahorra horas.</p>
              <div className="author"><div className="avatar">RC</div><div><div className="name">Roberto C.</div><div className="role">Agente Licenciado · Miami, FL</div></div></div>
            </div>
            <div className="testimonial reveal">
              <div className="stars">★★★★★</div>
              <p>No sabía que calificaba para subsidio. EnrollSalud me mostró que podía tener seguro Gold por $85/mes en vez de $520. Increíble.</p>
              <div className="author"><div className="avatar">JS</div><div><div className="name">Jorge S.</div><div className="role">Orlando, FL · Individual</div></div></div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq" id="faq">
        <div className="section-inner">
          <div className="section-label reveal">❓ Preguntas Frecuentes</div>
          <h2 className="section-title reveal">Resolvemos tus dudas</h2>
          <div className="faq-list">
            <div className="faq-item reveal"><div className="faq-q">¿EnrollSalud es gratis para consumidores?</div><div className="faq-a">Sí, 100% gratis. Los agentes licenciados ganan comisiones de los carriers de seguros, nunca de ti.</div></div>
            <div className="faq-item reveal"><div className="faq-q">¿Necesito SSN o documentos para cotizar?</div><div className="faq-a">No. Solo necesitas tu código postal, edades de tu hogar e ingreso anual estimado.</div></div>
            <div className="faq-item reveal"><div className="faq-q">¿EnrollSalud me inscribe en un plan?</div><div className="faq-a">EnrollSalud te muestra planes y te conecta con un agente licenciado. La inscripción se hace a través de HealthCare.gov.</div></div>
            <div className="faq-item reveal"><div className="faq-q">¿Los datos de subsidio son exactos?</div><div className="faq-a">Son estimados basados en los parámetros del FPL y las fórmulas de APTC del IRS. Los montos finales se determinan al inscribirse.</div></div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta">
        <h2>¿Listo para simplificar<br />tu seguro médico?</h2>
        <p>Únete a miles de familias hispanas que encontraron cobertura accesible.</p>
        <Link href="/cotizar" className="btn-primary">Cotiza Gratis Ahora →</Link>
        <div className="trust">
          <span>🔒 Datos encriptados</span>
          <span>🛡️ API oficial de CMS</span>
          <span>🇺🇸 Planes reales del Marketplace</span>
          <span>📞 Agente licenciado en 24h</span>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="es-footer">
        <p>
          EnrollSalud · Datos del API del Mercado CMS<br />
          Solo estimados. Precios finales al inscribirse. Operado por agentes de seguros licenciados.<br />
          © 2026 EnrollSalud. Todos los derechos reservados. · <Link href="/privacy">Privacidad</Link> · <Link href="/terms">Términos</Link> · <Link href="/compliance">Cumplimiento</Link> · <Link href="/ai-disclaimer">Aviso IA</Link> · <Link href="/agentes/login">Portal Agentes</Link> · <a href="mailto:info@enrollsalud.com">Contacto</a>
        </p>
      </footer>
    </>
  );
}
