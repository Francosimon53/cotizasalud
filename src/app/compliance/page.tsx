"use client";
import LegalLayout from "@/components/legal/LegalLayout";

function Section({ id, children }) {
  return <section id={id} className="mb-10 scroll-mt-24">{children}</section>;
}
function H2({ children }) {
  return <h2 className="text-lg font-semibold text-slate-900 mb-3">{children}</h2>;
}
function H3({ children }) {
  return <h3 className="text-base font-medium text-slate-800 mb-2 mt-4">{children}</h3>;
}
function P({ children }) {
  return <p className="text-sm text-slate-600 leading-relaxed mb-3">{children}</p>;
}
function AlertBox({ type = "info", children }) {
  const styles = {
    info: "border-teal-200 bg-teal-50/50 text-teal-800",
    warning: "border-amber-200 bg-amber-50/50 text-amber-800",
    danger: "border-red-200 bg-red-50/50 text-red-800",
  };
  return (
    <div className={`rounded-xl border p-4 my-4 text-sm leading-relaxed ${styles[type]}`}>
      {children}
    </div>
  );
}
function ListItem({ bold, children }: { bold?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 mb-2 text-sm text-slate-600">
      <span className="text-teal-500 mt-1 flex-shrink-0">•</span>
      <span>{bold && <strong className="text-slate-700">{bold} </strong>}{children}</span>
    </div>
  );
}
function CodeBlock({ children }) {
  return (
    <div className="my-4 rounded-xl bg-slate-900 p-4 overflow-x-auto">
      <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{children}</pre>
    </div>
  );
}

const CONTENT = {
  en: [
    {
      id: "non-ffm",
      title: "1. Non-FFM Disclaimer (CMS Required)",
      content: (
        <>
          <AlertBox type="danger">
            <strong>Required by 45 CFR 155.220(c)(3)(vii)</strong> — This disclaimer must be prominently displayed on the landing page and plan selection page.
          </AlertBox>
          <div className="my-4 rounded-xl border-2 border-red-300 bg-red-50/30 p-5">
            <p className="text-sm text-slate-800 leading-relaxed">
              <strong className="text-red-700">ATTENTION:</strong> This website is operated by [EnrollSalud / Company Name] and is not the Health Insurance Marketplace™ website. In offering this website, [Company Name] is required to comply with all applicable federal law, including the standards established under 45 CFR 155.220(c) and (d) and standards established under 45 CFR 155.260 to protect the privacy and security of personally identifiable information. This website may not display all data on Qualified Health Plans being offered in your state through the Health Insurance Marketplace™ website. To see all available data on Qualified Health Plan options in your state, go to the Health Insurance Marketplace™ website at <a href="https://www.healthcare.gov" className="text-teal-600 underline">HealthCare.gov</a>.
            </p>
          </div>
        </>
      ),
    },
    {
      id: "plan-detail",
      title: "2. Plan Detail Disclaimer",
      content: (
        <>
          <P>If the platform does not display all plan information required under 45 CFR 155.205(b)(1), the following must be shown on plan detail pages:</P>
          <div className="my-4 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
            <p className="text-sm text-slate-700 italic leading-relaxed">
              This website may not display complete information about a Qualified Health Plan. For complete plan details, visit HealthCare.gov or contact the plan's insurance company directly.
            </p>
          </div>
        </>
      ),
    },
    {
      id: "display-requirements",
      title: "3. Prominent Display Requirements",
      content: (
        <>
          <P>Per CMS guidance, disclaimers are considered "prominently displayed" when they are:</P>
          <ListItem>Present on both the initial consumer landing page and on the plan selection/comparison page</ListItem>
          <ListItem>Viewable without requiring the user to click on an additional link</ListItem>
          <ListItem>Written in a font size no smaller than the majority of text on the webpage</ListItem>
          <ListItem>Displayed in the same non-English language as any language the platform supports (Spanish)</ListItem>
          <ListItem>Noticeable in context (font color contrasts with background)</ListItem>
        </>
      ),
    },
    {
      id: "consent",
      title: "4. Consumer Consent Requirements",
      content: (
        <>
          <P>If EnrollSalud collects any consumer information to facilitate agent connection, the platform must:</P>
          <ListItem>Obtain explicit consumer consent before sharing any PII with agents</ListItem>
          <ListItem>Clearly disclose which agent(s) or agency(ies) will receive the consumer's information</ListItem>
          <ListItem>Allow consumers to withdraw consent at any time</ListItem>
          <ListItem>Maintain consent records for a minimum of 10 years per 45 CFR 155.220(c)(3)(i)(E)</ListItem>
        </>
      ),
    },
    {
      id: "agent-compliance",
      title: "5. Agent/Broker Compliance on Platform",
      content: (
        <>
          <P>Agents using EnrollSalud must comply with CMS Marketplace compliance requirements:</P>
          <ListItem>Current FFM registration and training for the applicable plan year</ListItem>
          <ListItem>Valid state insurance license</ListItem>
          <ListItem>Proper documentation of consumer consent</ListItem>
          <ListItem>Adherence to CMS marketing guidelines and prohibited practices</ListItem>
          <ListItem>Reporting of suspected fraud to CMS at the Agent/Broker Email Help Desk</ListItem>
        </>
      ),
    },
    {
      id: "nondiscrimination",
      title: "6. Non-Discrimination & Accessibility",
      content: (
        <>
          <P>EnrollSalud does not discriminate on the basis of race, color, national origin, sex, age, disability, gender identity, or sexual orientation. The platform provides equal access to its services and complies with applicable federal and state civil rights laws, including Section 1557 of the Affordable Care Act.</P>
          <P>The platform is available in English and Spanish. We strive to maintain accessibility compliance with WCAG 2.1 Level AA standards.</P>
        </>
      ),
    },
    {
      id: "implementation",
      title: "7. Implementation Guide",
      content: (
        <>
          <H3>Footer Disclaimer</H3>
          <CodeBlock>{`EnrollSalud is not the Health Insurance Marketplace™ website. 
This website is operated by [Company Name] and provides 
health insurance plan comparison for educational purposes only. 
Plan details and pricing are subject to change. For official 
enrollment, visit HealthCare.gov or contact a licensed 
insurance agent. EnrollSalud does not sell insurance and 
is not a licensed agent or broker.`}</CodeBlock>

          <H3>AI Advisor Modal Disclaimer</H3>
          <CodeBlock>{`🤖 AI Plan Advisor — This explanation is generated by 
artificial intelligence for educational purposes only. 
It is NOT insurance advice, financial advice, or a plan 
recommendation. Information may contain errors. Always 
verify plan details at HealthCare.gov and consult a 
licensed insurance agent before making enrollment decisions.`}</CodeBlock>

          <H3>Subsidy Estimate Disclaimer</H3>
          <CodeBlock>{`⚠ Estimated costs and subsidies shown are approximations 
based on the information you provided. Actual premium tax 
credits (APTC) and final costs will be determined during 
the official enrollment process at HealthCare.gov. 
Individual results may vary.`}</CodeBlock>
        </>
      ),
    },
  ],
  es: [
    {
      id: "non-ffm",
      title: "1. Aviso Non-FFM (Requerido por CMS)",
      content: (
        <>
          <AlertBox type="danger">
            <strong>Requerido por 45 CFR 155.220(c)(3)(vii)</strong> — Este aviso debe mostrarse prominentemente en la página de inicio y en la página de selección de planes.
          </AlertBox>
          <div className="my-4 rounded-xl border-2 border-red-300 bg-red-50/30 p-5">
            <p className="text-sm text-slate-800 leading-relaxed">
              <strong className="text-red-700">ATENCIÓN:</strong> Este sitio web es operado por [EnrollSalud / Nombre de la Empresa] y no es el sitio web del Mercado de Seguros Médicos™. Al ofrecer este sitio web, [Nombre de la Empresa] está obligado a cumplir con todas las leyes federales aplicables, incluyendo los estándares establecidos bajo 45 CFR 155.220(c) y (d) y los estándares establecidos bajo 45 CFR 155.260 para proteger la privacidad y seguridad de la información de identificación personal. Este sitio web puede no mostrar todos los datos sobre los Planes de Salud Calificados que se ofrecen en su estado a través del sitio web del Mercado de Seguros Médicos™. Para ver todos los datos disponibles, visite <a href="https://www.cuidadodesalud.gov" className="text-teal-600 underline">CuidadoDeSalud.gov</a>.
            </p>
          </div>
        </>
      ),
    },
    {
      id: "plan-detail",
      title: "2. Aviso de Detalle de Plan",
      content: (
        <>
          <P>Si la plataforma no muestra toda la información del plan requerida bajo 45 CFR 155.205(b)(1), lo siguiente debe mostrarse en las páginas de detalle del plan:</P>
          <div className="my-4 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
            <p className="text-sm text-slate-700 italic leading-relaxed">
              Este sitio web puede no mostrar información completa sobre un Plan de Salud Calificado. Para detalles completos del plan, visite CuidadoDeSalud.gov o contacte directamente a la compañía de seguros del plan.
            </p>
          </div>
        </>
      ),
    },
    {
      id: "display-requirements",
      title: "3. Requisitos de Exhibición Prominente",
      content: (
        <>
          <P>Según la guía de CMS, los avisos se consideran "prominentemente exhibidos" cuando:</P>
          <ListItem>Están presentes tanto en la página de inicio como en la página de selección/comparación de planes</ListItem>
          <ListItem>Son visibles sin requerir que el usuario haga clic en un enlace adicional</ListItem>
          <ListItem>Están escritos en un tamaño de fuente no menor que la mayoría del texto en la página</ListItem>
          <ListItem>Se muestran en el mismo idioma no inglés que la plataforma soporte (español)</ListItem>
          <ListItem>Son notorios en contexto (color de fuente contrasta con el fondo)</ListItem>
        </>
      ),
    },
    {
      id: "consent",
      title: "4. Requisitos de Consentimiento del Consumidor",
      content: (
        <>
          <P>Si EnrollSalud recopila información del consumidor para facilitar la conexión con agentes, la plataforma debe:</P>
          <ListItem>Obtener consentimiento explícito del consumidor antes de compartir cualquier PII con agentes</ListItem>
          <ListItem>Divulgar claramente qué agente(s) o agencia(s) recibirán la información del consumidor</ListItem>
          <ListItem>Permitir que los consumidores retiren el consentimiento en cualquier momento</ListItem>
          <ListItem>Mantener registros de consentimiento por un mínimo de 10 años según 45 CFR 155.220(c)(3)(i)(E)</ListItem>
        </>
      ),
    },
    {
      id: "agent-compliance",
      title: "5. Cumplimiento de Agentes/Corredores en la Plataforma",
      content: (
        <>
          <P>Los agentes que usan EnrollSalud deben cumplir con los requisitos de cumplimiento del Marketplace de CMS:</P>
          <ListItem>Registro y capacitación FFM vigente para el año de plan aplicable</ListItem>
          <ListItem>Licencia de seguros estatal válida</ListItem>
          <ListItem>Documentación adecuada del consentimiento del consumidor</ListItem>
          <ListItem>Adherencia a las pautas de marketing de CMS y prácticas prohibidas</ListItem>
          <ListItem>Reporte de fraude sospechado a CMS en el Help Desk de correo para Agentes/Corredores</ListItem>
        </>
      ),
    },
    {
      id: "nondiscrimination",
      title: "6. No Discriminación y Accesibilidad",
      content: (
        <>
          <P>EnrollSalud no discrimina por motivos de raza, color, origen nacional, sexo, edad, discapacidad, identidad de género u orientación sexual. La plataforma proporciona acceso igualitario a sus servicios y cumple con las leyes federales y estatales de derechos civiles, incluyendo la Sección 1557 del Affordable Care Act.</P>
          <P>La plataforma está disponible en inglés y español. Nos esforzamos por mantener cumplimiento de accesibilidad con los estándares WCAG 2.1 Nivel AA.</P>
        </>
      ),
    },
    {
      id: "implementation",
      title: "7. Guía de Implementación",
      content: (
        <>
          <H3>Aviso del Pie de Página</H3>
          <CodeBlock>{`EnrollSalud no es el sitio web del Mercado de Seguros 
Médicos™. Este sitio web es operado por [Nombre de la 
Empresa] y proporciona comparación de planes de seguro 
médico con fines educativos solamente. Los detalles y 
precios de los planes están sujetos a cambios. Para 
inscripción oficial, visite CuidadoDeSalud.gov o contacte 
a un agente de seguros licenciado. EnrollSalud no vende 
seguros y no es un agente o corredor licenciado.`}</CodeBlock>

          <H3>Aviso del Modal del Asesor IA</H3>
          <CodeBlock>{`🤖 Asesor de Planes con IA — Esta explicación es generada 
por inteligencia artificial con fines educativos solamente. 
NO es asesoría de seguros, asesoría financiera, ni una 
recomendación de plan. La información puede contener 
errores. Siempre verifique los detalles del plan en 
CuidadoDeSalud.gov y consulte a un agente de seguros 
licenciado antes de tomar decisiones de inscripción.`}</CodeBlock>

          <H3>Aviso de Estimación de Subsidios</H3>
          <CodeBlock>{`⚠ Los costos estimados y subsidios mostrados son 
aproximaciones basadas en la información que proporcionó. 
Los créditos fiscales de prima reales (APTC) y los costos 
finales se determinarán durante el proceso de inscripción 
oficial en CuidadoDeSalud.gov. Los resultados individuales 
pueden variar.`}</CodeBlock>
        </>
      ),
    },
  ],
};

export default function CompliancePage() {
  return (
    <LegalLayout titleEn="CMS & Marketplace Compliance" titleEs="Cumplimiento CMS y Marketplace">
      {(lang) => (
        <div>
          {CONTENT[lang].map((section) => (
            <Section key={section.id} id={section.id}>
              {section.title && <H2>{section.title}</H2>}
              {section.content}
            </Section>
          ))}
        </div>
      )}
    </LegalLayout>
  );
}
