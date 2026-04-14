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
function DataTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-slate-50">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-left font-medium text-slate-700 border-b border-slate-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-slate-600 border-b border-slate-100">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CONTENT = {
  en: [
    {
      id: "info-collect",
      title: "1. Information We Collect",
      content: (
        <>
          <H3>1.1 Information You Provide</H3>
          <P>When using EnrollSalud, you may provide us with:</P>
          <DataTable
            headers={["Data Type", "Purpose", "Required?"]}
            rows={[
              ["ZIP code & county", "Plan availability", "Yes"],
              ["Household size, ages, relationships", "Household composition for quotes", "Yes"],
              ["Annual income", "Subsidy estimation (APTC)", "Yes"],
              ["Gender", "Premium calculation", "Yes"],
              ["Tobacco use, pregnancy status", "Premium calculation & eligibility", "Yes"],
              ["Contact info (name, phone, email)", "Connect with licensed agent", "Yes (to receive quotes)"],
              ["Language preference", "UI personalization", "Auto-detected"],
            ]}
          />
          <H3>1.2 Information Collected Automatically</H3>
          <P>We automatically collect device type, browser, operating system, IP address and approximate location, pages visited and features used, and cookies for platform functionality and analytics.</P>
        </>
      ),
    },
    {
      id: "how-we-use",
      title: "2. How We Use Your Information",
      content: (
        <>
          <P>We use the information we collect to:</P>
          <ListItem>Display relevant health insurance plans for your area</ListItem>
          <ListItem>Calculate estimated premiums and subsidies</ListItem>
          <ListItem>Power the AI Plan Advisor with your anonymized inputs</ListItem>
          <ListItem>Connect you with licensed insurance agents upon your request</ListItem>
          <ListItem>Improve the platform and user experience</ListItem>
          <ListItem>Comply with applicable laws and regulations</ListItem>
        </>
      ),
    },
    {
      id: "sharing",
      title: "3. Information Sharing",
      content: (
        <>
          <AlertBox type="info">
            <strong>We do NOT sell your personal information.</strong> We may share information only in these limited circumstances:
          </AlertBox>
          <ListItem bold="Licensed Insurance Agents:">Your name, phone, email, and quote preferences — only when you request to be connected with an agent.</ListItem>
          <ListItem bold="CMS Marketplace API:">Anonymized household data (age, income, ZIP, tobacco status) to retrieve plan quotes. No personal identifiers (name, phone, email) are sent to CMS.</ListItem>
          <ListItem bold="Service Providers:">Third-party vendors who assist with platform operations (hosting, analytics), subject to confidentiality agreements.</ListItem>
          <ListItem>We do <strong>NOT</strong> sell your personal information to third parties.</ListItem>
          <ListItem>We do <strong>NOT</strong> share your data with advertisers.</ListItem>
          <ListItem bold="Legal Requirements:">We may share data when required by law, regulation, or legal process.</ListItem>
        </>
      ),
    },
    {
      id: "security",
      title: "4. Data Security",
      content: (
        <>
          <P>We implement industry-standard security measures to protect your information:</P>
          <ListItem>Encryption in transit (TLS/SSL) and at rest</ListItem>
          <ListItem>Secure hosting on Vercel and Supabase infrastructure</ListItem>
          <ListItem>Role-based access controls and authentication</ListItem>
          <ListItem>Regular security assessments and monitoring</ListItem>
        </>
      ),
    },
    {
      id: "ai-data",
      title: "5. AI Plan Advisor Data Usage",
      content: (
        <AlertBox type="info">
          The AI Plan Advisor processes your inputs (zip code, household size, income, age) to generate personalized plan explanations. These inputs are processed in real-time and are <strong>NOT stored permanently</strong>. No personally identifiable information is sent to the AI model. Only anonymized, aggregated data is used to improve the AI service.
        </AlertBox>
      ),
    },
    {
      id: "cookies",
      title: "6. Cookies",
      content: (
        <P>EnrollSalud uses essential cookies for platform functionality. We may also use analytics cookies to understand how users interact with the Service. You can manage cookie preferences through your browser settings.</P>
      ),
    },
    {
      id: "data-retention",
      title: "7. Data Retention",
      content: (
        <>
          <P>We retain your personal information only for as long as necessary to fulfill the purposes described in this policy, or as required by law.</P>
          <ListItem bold="Consent records:">Retained for a minimum of 10 years per CMS requirements (45 CFR 155.220(c)(3)(i)(E)).</ListItem>
          <ListItem bold="Lead information:">Retained for the duration of the applicable enrollment period plus 3 years, unless you request earlier deletion.</ListItem>
          <ListItem bold="AI query logs:">Anonymized after 90 days; fully deleted after 1 year.</ListItem>
          <P>You may request deletion of your data at any time by contacting us (see Your Rights below).</P>
        </>
      ),
    },
    {
      id: "your-rights",
      title: "8. Your Rights",
      content: (
        <>
          <P>You have the right to:</P>
          <ListItem>Access the personal information we hold about you</ListItem>
          <ListItem>Request correction of inaccurate information</ListItem>
          <ListItem>Request deletion of your information</ListItem>
          <ListItem>Opt out of non-essential communications</ListItem>
          <ListItem>Withdraw consent for data processing at any time</ListItem>
          <P>To exercise these rights, contact us at <a href="mailto:francosimon@hotmail.com" className="text-teal-600 hover:underline">francosimon@hotmail.com</a>.</P>
        </>
      ),
    },
    {
      id: "children",
      title: "9. Children's Privacy",
      content: (
        <P>EnrollSalud is not directed at children under 18. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us immediately.</P>
      ),
    },
    {
      id: "hipaa",
      title: "10. HIPAA Disclaimer",
      content: (
        <AlertBox type="info">
          EnrollSalud collects demographic information (age, income, household composition, ZIP code, tobacco use, pregnancy status) solely for the purpose of generating health insurance quotes. This information is <strong>NOT Protected Health Information (PHI)</strong> under HIPAA as defined by 45 CFR 160.103, as EnrollSalud does not provide healthcare services, health plans, or healthcare clearinghouse functions. Your data is stored securely and is only shared with your assigned licensed insurance agent to facilitate enrollment. We do not sell your data to third parties.
        </AlertBox>
      ),
    },
    {
      id: "changes",
      title: "11. Changes to This Policy",
      content: (
        <P>We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements. The updated policy will be posted on this page with the revised date. We encourage you to review this page regularly.</P>
      ),
    },
    {
      id: "contact",
      title: "12. Contact Information",
      content: (
        <>
          <P>If you have questions about this Privacy Policy or wish to exercise your data rights, contact us:</P>
          <ListItem bold="Email:"><a href="mailto:francosimon@hotmail.com" className="text-teal-600 hover:underline">francosimon@hotmail.com</a></ListItem>
          <ListItem bold="Entity:">FPI Enterprises, Inc.</ListItem>
          <ListItem bold="Location:">Ave María, FL</ListItem>
        </>
      ),
    },
  ],
  es: [
    {
      id: "info-collect",
      title: "1. Información que Recopilamos",
      content: (
        <>
          <H3>1.1 Información que Usted Proporciona</H3>
          <P>Al usar EnrollSalud, puede proporcionarnos:</P>
          <DataTable
            headers={["Tipo de Dato", "Propósito", "¿Requerido?"]}
            rows={[
              ["Código postal y condado", "Disponibilidad de planes", "Sí"],
              ["Tamaño del hogar, edades, relaciones", "Composición del hogar para cotizaciones", "Sí"],
              ["Ingreso anual", "Estimación de subsidio (APTC)", "Sí"],
              ["Género", "Cálculo de primas", "Sí"],
              ["Uso de tabaco, estado de embarazo", "Cálculo de primas y elegibilidad", "Sí"],
              ["Info de contacto (nombre, teléfono, email)", "Conexión con agente licenciado", "Sí (para recibir cotizaciones)"],
              ["Preferencia de idioma", "Personalización", "Auto-detectado"],
            ]}
          />
          <H3>1.2 Información Recopilada Automáticamente</H3>
          <P>Recopilamos automáticamente tipo de dispositivo, navegador, sistema operativo, dirección IP y ubicación aproximada, páginas visitadas y funciones utilizadas, y cookies para funcionalidad y análisis de la plataforma.</P>
        </>
      ),
    },
    {
      id: "how-we-use",
      title: "2. Cómo Usamos Su Información",
      content: (
        <>
          <P>Usamos la información recopilada para:</P>
          <ListItem>Mostrar planes de seguro médico relevantes para su área</ListItem>
          <ListItem>Calcular primas y subsidios estimados</ListItem>
          <ListItem>Alimentar el Asesor de Planes con IA con sus datos anonimizados</ListItem>
          <ListItem>Conectarlo con agentes de seguros licenciados cuando lo solicite</ListItem>
          <ListItem>Mejorar la plataforma y la experiencia del usuario</ListItem>
          <ListItem>Cumplir con las leyes y regulaciones aplicables</ListItem>
        </>
      ),
    },
    {
      id: "sharing",
      title: "3. Compartir Información",
      content: (
        <>
          <AlertBox type="info">
            <strong>NO vendemos su información personal.</strong> Solo compartimos información en estas circunstancias limitadas:
          </AlertBox>
          <ListItem bold="Agentes de Seguros Licenciados:">Su nombre, teléfono, email y preferencias de cotización — solo cuando solicita conectarse con un agente.</ListItem>
          <ListItem bold="API del Mercado CMS:">Datos del hogar anonimizados (edad, ingreso, ZIP, tabaco) para obtener cotizaciones. No se envían identificadores personales (nombre, teléfono, email) al CMS.</ListItem>
          <ListItem bold="Proveedores de Servicios:">Proveedores externos que ayudan con las operaciones de la plataforma (alojamiento, análisis), sujetos a acuerdos de confidencialidad.</ListItem>
          <ListItem><strong>NO</strong> vendemos su información personal a terceros.</ListItem>
          <ListItem><strong>NO</strong> compartimos sus datos con anunciantes.</ListItem>
          <ListItem bold="Requisitos Legales:">Podemos compartir datos cuando lo requiera la ley, regulación o proceso legal.</ListItem>
        </>
      ),
    },
    {
      id: "security",
      title: "4. Seguridad de Datos",
      content: (
        <>
          <P>Implementamos medidas de seguridad estándar de la industria:</P>
          <ListItem>Encriptación en tránsito (TLS/SSL) y en reposo</ListItem>
          <ListItem>Alojamiento seguro en infraestructura Vercel y Supabase</ListItem>
          <ListItem>Controles de acceso basados en roles y autenticación</ListItem>
          <ListItem>Evaluaciones de seguridad regulares y monitoreo</ListItem>
        </>
      ),
    },
    {
      id: "ai-data",
      title: "5. Uso de Datos del Asesor IA",
      content: (
        <AlertBox type="info">
          El Asesor de Planes con IA procesa sus datos (código postal, tamaño del hogar, ingresos, edad) para generar explicaciones personalizadas. Estos datos se procesan en tiempo real y <strong>NO se almacenan permanentemente</strong>. No se envía información personal identificable al modelo de IA. Solo se usan datos anonimizados y agregados para mejorar el servicio.
        </AlertBox>
      ),
    },
    {
      id: "cookies",
      title: "6. Cookies",
      content: (
        <P>EnrollSalud usa cookies esenciales para la funcionalidad de la plataforma. También podemos usar cookies de análisis para entender cómo los usuarios interactúan con el Servicio. Puede gestionar las preferencias de cookies a través de la configuración de su navegador.</P>
      ),
    },
    {
      id: "data-retention",
      title: "7. Retención de Datos",
      content: (
        <>
          <P>Retenemos su información personal solo el tiempo necesario para cumplir con los propósitos descritos en esta política, o según lo requiera la ley.</P>
          <ListItem bold="Registros de consentimiento:">Retenidos por un mínimo de 10 años según requisitos de CMS (45 CFR 155.220(c)(3)(i)(E)).</ListItem>
          <ListItem bold="Información de leads:">Retenida durante el período de inscripción aplicable más 3 años, a menos que solicite su eliminación anticipada.</ListItem>
          <ListItem bold="Registros de consultas IA:">Anonimizados después de 90 días; eliminados completamente después de 1 año.</ListItem>
          <P>Puede solicitar la eliminación de sus datos en cualquier momento contactándonos (ver Sus Derechos a continuación).</P>
        </>
      ),
    },
    {
      id: "your-rights",
      title: "8. Sus Derechos",
      content: (
        <>
          <P>Usted tiene derecho a:</P>
          <ListItem>Acceder a la información personal que tenemos sobre usted</ListItem>
          <ListItem>Solicitar la corrección de información inexacta</ListItem>
          <ListItem>Solicitar la eliminación de su información</ListItem>
          <ListItem>Optar por no recibir comunicaciones no esenciales</ListItem>
          <ListItem>Retirar el consentimiento para el procesamiento de datos en cualquier momento</ListItem>
          <P>Para ejercer estos derechos, contáctenos en <a href="mailto:francosimon@hotmail.com" className="text-teal-600 hover:underline">francosimon@hotmail.com</a>.</P>
        </>
      ),
    },
    {
      id: "children",
      title: "9. Privacidad de Menores",
      content: (
        <P>EnrollSalud no está dirigido a menores de 18 años. No recopilamos conscientemente información personal de menores. Si cree que un menor nos ha proporcionado información personal, contáctenos inmediatamente.</P>
      ),
    },
    {
      id: "hipaa",
      title: "10. Aviso HIPAA",
      content: (
        <AlertBox type="info">
          EnrollSalud recopila información demográfica (edad, ingresos, composición del hogar, código postal, uso de tabaco, estado de embarazo) únicamente con el propósito de generar cotizaciones de seguros médicos. Esta información <strong>NO es Información de Salud Protegida (PHI)</strong> bajo HIPAA según lo definido por 45 CFR 160.103, ya que EnrollSalud no proporciona servicios de atención médica, planes de salud ni funciones de cámara de compensación. Sus datos se almacenan de forma segura y solo se comparten con su agente licenciado asignado. No vendemos sus datos a terceros.
        </AlertBox>
      ),
    },
    {
      id: "changes",
      title: "11. Cambios a Esta Política",
      content: (
        <P>Podemos actualizar esta Política de Privacidad periódicamente para reflejar cambios en nuestras prácticas o requisitos legales. La política actualizada se publicará en esta página con la fecha revisada. Le recomendamos revisar esta página regularmente.</P>
      ),
    },
    {
      id: "contact",
      title: "12. Información de Contacto",
      content: (
        <>
          <P>Si tiene preguntas sobre esta Política de Privacidad o desea ejercer sus derechos de datos, contáctenos:</P>
          <ListItem bold="Email:"><a href="mailto:francosimon@hotmail.com" className="text-teal-600 hover:underline">francosimon@hotmail.com</a></ListItem>
          <ListItem bold="Entidad:">FPI Enterprises, Inc.</ListItem>
          <ListItem bold="Ubicación:">Ave María, FL</ListItem>
        </>
      ),
    },
  ],
};

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout titleEn="Privacy Policy" titleEs="Política de Privacidad">
      {(lang) => (
        <div>
          <p className="text-xs text-slate-400 mb-6 font-mono">{lang === "en" ? "Last updated: April 13, 2026" : "Última actualización: 13 de abril de 2026"}</p>
          {CONTENT[lang].map((section) => (
            <Section key={section.id} id={section.id}>
              <H2>{section.title}</H2>
              {section.content}
            </Section>
          ))}
        </div>
      )}
    </LegalLayout>
  );
}
