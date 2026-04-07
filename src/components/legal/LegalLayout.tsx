"use client";
import LangToggle, { useLangState } from "./LangToggle";

const LEGAL_NAV = [
  { href: "/terms", labelEn: "Terms of Service", labelEs: "Términos de Servicio" },
  { href: "/privacy", labelEn: "Privacy Policy", labelEs: "Política de Privacidad" },
  { href: "/ai-disclaimer", labelEn: "AI Disclaimer", labelEs: "Aviso Legal IA" },
  { href: "/compliance", labelEn: "Compliance", labelEs: "Cumplimiento" },
];

export default function LegalLayout({ children, titleEn, titleEs, lastUpdated = "February 2026" }: {
  children: ((lang: string) => React.ReactNode) | React.ReactNode;
  titleEn: string;
  titleEs: string;
  lastUpdated?: string;
}) {
  const [lang, setLang] = useLangState();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-sm">
                <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-slate-800 group-hover:text-teal-600 transition-colors">
                EnrollSalud
              </span>
            </a>
            <LangToggle lang={lang} setLang={setLang} />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
          {/* Sidebar Nav */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-semibold mb-3 px-3">
                {lang === "en" ? "Legal Pages" : "Páginas Legales"}
              </p>
              {LEGAL_NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2 text-sm rounded-lg text-slate-600 hover:text-teal-700 hover:bg-teal-50/60 transition-colors"
                >
                  {lang === "en" ? item.labelEn : item.labelEs}
                </a>
              ))}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <a
                  href="/"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-teal-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                  {lang === "en" ? "Back to Home" : "Volver al Inicio"}
                </a>
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="min-w-0">
            <div className="mb-8 pb-6 border-b border-slate-200/70">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {lang === "en" ? titleEn : titleEs}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {lang === "en"
                  ? `Last updated: ${lastUpdated}`
                  : `Última actualización: ${lastUpdated}`}
              </p>
            </div>

            <div className="mb-8 rounded-xl border border-amber-200/80 bg-amber-50/50 p-4">
              <div className="flex gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <p className="text-sm text-amber-800 leading-relaxed">
                  {lang === "en"
                    ? "EnrollSalud is NOT the Health Insurance Marketplace\u2122 website. We provide plan comparison for educational purposes only. For official enrollment, visit HealthCare.gov."
                    : "EnrollSalud NO es el sitio web del Mercado de Seguros M\u00e9dicos\u2122. Proporcionamos comparaci\u00f3n de planes con fines educativos solamente. Para inscripci\u00f3n oficial, visite CuidadoDeSalud.gov."}
                </p>
              </div>
            </div>

            {typeof children === "function" ? children(lang) : children}
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-slate-50/50 mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} EnrollSalud. All rights reserved.</p>
            <div className="flex gap-4 flex-wrap">
              {LEGAL_NAV.map((item) => (
                <a key={item.href} href={item.href} className="hover:text-teal-600 transition-colors">
                  {lang === "en" ? item.labelEn : item.labelEs}
                </a>
              ))}
              <a href="/agentes/login" className="hover:text-teal-600 transition-colors">
                {lang === "en" ? "Agent Portal" : "Portal Agentes"}
              </a>
              <a href="mailto:info@enrollsalud.com" className="hover:text-teal-600 transition-colors">
                {lang === "en" ? "Contact" : "Contacto"}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
