"use client";
import LegalLayout from "@/components/legal/LegalLayout";
import DataTable from "@/components/legal/DataTable";

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
          <H3>1.3 Agent Account Information</H3>
          <P>When a licensed insurance agent registers for a paid subscription, EnrollSalud collects additional account information beyond what is described in Sections 1.1 and 1.2:</P>
          <DataTable
            headers={["Data Type", "Purpose", "Required?"]}
            rows={[
              ["Full name and email address", "Account identification, login, support communication", "Yes"],
              ["Mobile phone number", "WhatsApp notifications about account activity (new contacts, plan limits, billing)", "Yes"],
              ["National Producer Number (NPN)", "Verification of licensure status", "Yes"],
              ["State(s) of license", "Regional plan availability and routing", "Yes"],
              ["Profile photo (optional)", "Display on the agent's public quote page", "No"],
              ["Stripe customer ID and payment method (last 4 digits, brand, expiration)", "Subscription billing", "Yes"],
              ["IP address and login timestamps", "Security monitoring and fraud prevention", "Auto"],
            ]}
          />
          <P>Payment card numbers and bank account details are NEVER stored by EnrollSalud. All payment data is collected and stored by Stripe, Inc., our PCI-DSS-compliant payment processor. EnrollSalud only receives a tokenized customer ID and metadata about the payment method.</P>
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
          <ListItem bold="Contact information:">Retained for the duration of the applicable enrollment period plus 3 years, unless you request earlier deletion.</ListItem>
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
          <P>To exercise these rights, contact us at <a href="mailto:info@enrollsalud.com" className="text-teal-600 hover:underline">info@enrollsalud.com</a>.</P>
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
      id: "subprocessors",
      title: "11. Subprocessors",
      content: (
        <>
          <P>EnrollSalud relies on the following third-party service providers (&quot;Subprocessors&quot;) to operate the platform. Each Subprocessor is contractually bound by confidentiality and data-protection obligations. The list below is current as of the &quot;Last Updated&quot; date and may change with at least thirty (30) days&apos; notice posted to this page.</P>
          <DataTable
            headers={["Subprocessor", "Purpose", "Data Categories", "Location"]}
            rows={[
              ["Vercel, Inc.", "Application hosting, CDN, edge functions", "All data in transit", "United States"],
              ["Supabase, Inc.", "Database, authentication, file storage", "Account data, lead data, consent records", "United States"],
              ["Stripe, Inc.", "Payment processing, billing portal", "Agent name, email, payment method", "United States"],
              ["Resend, Inc.", "Transactional email delivery", "Agent email, message content", "United States"],
              ["Twilio, Inc.", "WhatsApp notifications to agents", "Agent phone number, message content", "United States"],
              ["Anthropic, PBC", "AI Plan Advisor (Claude API)", "Anonymized cotizador inputs (no PII)", "United States"],
              ["Centers for Medicare & Medicaid Services (CMS)", "Real-time plan availability and pricing", "Anonymized household data (no PII)", "United States (Federal)"],
              ["HealthSherpa, Inc.", "Optional deep-link enrollment for licensed agents", "Agent NPN, lead consent record", "United States"],
            ]}
          />
          <P>EnrollSalud does NOT transfer agent or consumer personal data outside of the United States. EnrollSalud does NOT sell, rent, or share data with advertising networks, data brokers, marketing partners, or any third party not listed above.</P>
        </>
      ),
    },
    {
      id: "agents-capture",
      title: "12. Agents' Capture of Consumer Data",
      content: (
        <>
          <H3>12.1 Agent&apos;s Role</H3>
          <P>When a consumer cotizes through an agent&apos;s personalized link (e.g., enrollsalud.com/q/[agent-slug]), the agent becomes the primary recipient of the consumer&apos;s contact information and quote data. EnrollSalud acts as a service provider that hosts the platform and routes data on behalf of the agent.</P>
          <H3>12.2 Agent&apos;s Independent Communications</H3>
          <P>Once a consumer&apos;s contact data is captured, the agent may use the agent&apos;s own channels (personal WhatsApp, SMS, phone, email) to follow up with the consumer outside of the EnrollSalud platform. Communications sent through the agent&apos;s own channels are NOT processed, monitored, retained, or stored by EnrollSalud, and are governed by the agent&apos;s own privacy practices and applicable law.</P>
          <H3>12.3 Consumer Rights Toward the Agent</H3>
          <P>Consumers seeking to exercise data rights (access, deletion, correction, opt-out) regarding communications received from an agent should contact the agent directly. EnrollSalud will assist consumers in identifying the agent of record upon request, but cannot delete data held by the agent outside the platform.</P>
          <H3>12.4 Consumer Rights Toward EnrollSalud</H3>
          <P>Consumers may exercise data rights regarding data stored by EnrollSalud (cotizador inputs, consent records, lead history within the platform) at any time by contacting <a href="mailto:info@enrollsalud.com" className="text-teal-600 hover:underline">info@enrollsalud.com</a>. See Section 8 of this Policy.</P>
        </>
      ),
    },
    {
      id: "changes",
      title: "13. Changes to This Policy",
      content: (
        <P>We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements. The updated policy will be posted on this page with the revised date. We encourage you to review this page regularly.</P>
      ),
    },
    {
      id: "contact",
      title: "14. Contact Information",
      content: (
        <>
          <P>If you have questions about this Privacy Policy or wish to exercise your data rights, contact us:</P>
          <ListItem bold="Email:"><a href="mailto:info@enrollsalud.com" className="text-teal-600 hover:underline">info@enrollsalud.com</a></ListItem>
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
          <H3>1.3 Información de Cuenta del Agente</H3>
          <P>Cuando un agente de seguros licenciado se registra para una suscripción paga, EnrollSalud recopila información de cuenta adicional más allá de lo descrito en las Secciones 1.1 y 1.2:</P>
          <DataTable
            headers={["Tipo de Dato", "Propósito", "¿Requerido?"]}
            rows={[
              ["Nombre completo y dirección de email", "Identificación de cuenta, inicio de sesión, comunicación de soporte", "Sí"],
              ["Número de teléfono móvil", "Notificaciones de WhatsApp sobre actividad de la cuenta (nuevos contactos, límites de plan, facturación)", "Sí"],
              ["Número Nacional de Productor (NPN)", "Verificación del estado de licenciatura", "Sí"],
              ["Estado(s) de licencia", "Disponibilidad regional de planes y enrutamiento", "Sí"],
              ["Foto de perfil (opcional)", "Visualización en la página pública de cotización del agente", "No"],
              ["Stripe customer ID y método de pago (últimos 4 dígitos, marca, vencimiento)", "Facturación de suscripción", "Sí"],
              ["Dirección IP y marcas de tiempo de inicio de sesión", "Monitoreo de seguridad y prevención de fraude", "Auto"],
            ]}
          />
          <P>EnrollSalud NUNCA almacena números de tarjetas de pago ni detalles de cuentas bancarias. Todos los datos de pago son recopilados y almacenados por Stripe, Inc., nuestro procesador de pagos certificado PCI-DSS. EnrollSalud solo recibe un customer ID tokenizado y metadatos sobre el método de pago.</P>
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
          <ListItem bold="Información de contactos:">Retenida durante el período de inscripción aplicable más 3 años, a menos que solicite su eliminación anticipada.</ListItem>
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
          <P>Para ejercer estos derechos, contáctenos en <a href="mailto:info@enrollsalud.com" className="text-teal-600 hover:underline">info@enrollsalud.com</a>.</P>
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
      id: "subprocessors",
      title: "11. Subencargados del Tratamiento",
      content: (
        <>
          <P>EnrollSalud se apoya en los siguientes proveedores de servicios externos (&quot;Subencargados&quot;) para operar la plataforma. Cada Subencargado está contractualmente sujeto a obligaciones de confidencialidad y protección de datos. La lista siguiente está vigente a la fecha de &quot;Última actualización&quot; y puede modificarse con al menos treinta (30) días de aviso previo publicado en esta página.</P>
          <DataTable
            headers={["Subencargado", "Propósito", "Categorías de Datos", "Ubicación"]}
            rows={[
              ["Vercel, Inc.", "Alojamiento de la aplicación, CDN, edge functions", "Todos los datos en tránsito", "Estados Unidos"],
              ["Supabase, Inc.", "Base de datos, autenticación, almacenamiento de archivos", "Datos de cuenta, datos de contactos, registros de consentimiento", "Estados Unidos"],
              ["Stripe, Inc.", "Procesamiento de pagos, portal de facturación", "Nombre del agente, email, método de pago", "Estados Unidos"],
              ["Resend, Inc.", "Entrega de emails transaccionales", "Email del agente, contenido del mensaje", "Estados Unidos"],
              ["Twilio, Inc.", "Notificaciones de WhatsApp a agentes", "Número de teléfono del agente, contenido del mensaje", "Estados Unidos"],
              ["Anthropic, PBC", "Asesor de Planes con IA (API de Claude)", "Datos del cotizador anonimizados (sin PII)", "Estados Unidos"],
              ["Centers for Medicare & Medicaid Services (CMS)", "Disponibilidad y precios de planes en tiempo real", "Datos del hogar anonimizados (sin PII)", "Estados Unidos (Federal)"],
              ["HealthSherpa, Inc.", "Inscripción opcional vía deep-link para agentes licenciados", "NPN del agente, registro de consentimiento del contacto", "Estados Unidos"],
            ]}
          />
          <P>EnrollSalud NO transfiere datos personales del agente ni del consumidor fuera de los Estados Unidos. EnrollSalud NO vende, alquila ni comparte datos con redes publicitarias, data brokers, socios de marketing, ni con ningún tercero no listado anteriormente.</P>
        </>
      ),
    },
    {
      id: "agents-capture",
      title: "12. Captura de Datos del Consumidor por parte de Agentes",
      content: (
        <>
          <H3>12.1 Rol del Agente</H3>
          <P>Cuando un consumidor cotiza a través del link personalizado de un agente (por ejemplo, enrollsalud.com/q/[agent-slug]), el agente se convierte en el receptor primario de la información de contacto y los datos de cotización del consumidor. EnrollSalud actúa como un proveedor de servicios que aloja la plataforma y enruta los datos en nombre del agente.</P>
          <H3>12.2 Comunicaciones Independientes del Agente</H3>
          <P>Una vez capturados los datos de contacto del consumidor, el agente puede utilizar sus propios canales (WhatsApp personal, SMS, teléfono, email) para hacer seguimiento al consumidor fuera de la plataforma EnrollSalud. Las comunicaciones enviadas a través de los canales propios del agente NO son procesadas, monitoreadas, retenidas ni almacenadas por EnrollSalud, y se rigen por las prácticas de privacidad propias del agente y por la ley aplicable.</P>
          <H3>12.3 Derechos del Consumidor frente al Agente</H3>
          <P>Los consumidores que deseen ejercer derechos sobre sus datos (acceso, eliminación, corrección, exclusión) respecto de las comunicaciones recibidas de un agente deben contactar al agente directamente. EnrollSalud asistirá a los consumidores en la identificación del agente de registro a solicitud, pero no puede eliminar datos en posesión del agente fuera de la plataforma.</P>
          <H3>12.4 Derechos del Consumidor frente a EnrollSalud</H3>
          <P>Los consumidores pueden ejercer sus derechos respecto de los datos almacenados por EnrollSalud (datos del cotizador, registros de consentimiento, historial de contactos dentro de la plataforma) en cualquier momento contactando a <a href="mailto:info@enrollsalud.com" className="text-teal-600 hover:underline">info@enrollsalud.com</a>. Vea la Sección 8 de esta Política.</P>
        </>
      ),
    },
    {
      id: "changes",
      title: "13. Cambios a Esta Política",
      content: (
        <P>Podemos actualizar esta Política de Privacidad periódicamente para reflejar cambios en nuestras prácticas o requisitos legales. La política actualizada se publicará en esta página con la fecha revisada. Le recomendamos revisar esta página regularmente.</P>
      ),
    },
    {
      id: "contact",
      title: "14. Información de Contacto",
      content: (
        <>
          <P>Si tiene preguntas sobre esta Política de Privacidad o desea ejercer sus derechos de datos, contáctenos:</P>
          <ListItem bold="Email:"><a href="mailto:info@enrollsalud.com" className="text-teal-600 hover:underline">info@enrollsalud.com</a></ListItem>
          <ListItem bold="Entidad:">FPI Enterprises, Inc.</ListItem>
          <ListItem bold="Ubicación:">Ave María, FL</ListItem>
        </>
      ),
    },
  ],
};

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout titleEn="Privacy Policy" titleEs="Política de Privacidad" lastUpdated="April 30, 2026">
      {(lang) => (
        <div>
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
