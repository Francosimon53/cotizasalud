"use client";
import LegalLayout from "@/components/legal/LegalLayout";

// Helper components for consistent styling
function Section({ id, children }) {
  return <section id={id} className="mb-10 scroll-mt-24">{children}</section>;
}
function H2({ children }) {
  return <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">{children}</h2>;
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

const CONTENT = {
  en: {
    effectiveDate: "Effective Date: April 30, 2026",
    sections: [
      {
        id: "acceptance",
        title: "1. Acceptance of Terms",
        content: (
          <>
            <P>By accessing or using the EnrollSalud website and services (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not access or use the Service.</P>
            <P>We reserve the right to update or modify these Terms at any time. Changes become effective upon posting to this website. Your continued use of the Service after any changes constitutes acceptance of the revised Terms. These Terms include additional provisions for licensed insurance agents who subscribe to EnrollSalud's paid services, set forth in Sections 10 through 13 below.</P>
          </>
        ),
      },
      {
        id: "description",
        title: "2. Description of Service",
        content: (
          <>
            <P>EnrollSalud is a bilingual (English/Spanish) health insurance quotation platform that provides:</P>
            <ListItem bold="Plan Comparison:">Display of Qualified Health Plans (QHPs) available in the State of Florida through the Health Insurance Marketplace.</ListItem>
            <ListItem bold="AI Plan Advisor:">An artificial intelligence-powered tool that provides general explanations of health insurance plans, financial strategies, and year-over-year comparisons in plain language.</ListItem>
            <ListItem bold="Agent Connection:">A platform for licensed insurance agents to connect with consumers seeking health insurance guidance.</ListItem>
            <AlertBox type="warning">
              <strong>Important:</strong> EnrollSalud is NOT the Health Insurance Marketplace (HealthCare.gov). We are an independent platform that displays publicly available plan information to help consumers compare options and connect with licensed agents.
            </AlertBox>
          </>
        ),
      },
      {
        id: "no-sales",
        title: "3. No Insurance Sales or Enrollment",
        content: (
          <>
            <P>EnrollSalud does NOT sell insurance, process applications, or enroll consumers in any health insurance plan. The Service is limited to providing plan comparison information and connecting consumers with licensed insurance agents.</P>
            <P>All enrollment in Qualified Health Plans must be completed through HealthCare.gov, the official Health Insurance Marketplace, or through a licensed and registered agent or broker.</P>
          </>
        ),
      },
      {
        id: "no-advice",
        title: "4. No Medical or Financial Advice",
        content: (
          <>
            <P>The information provided through the Service, including the AI Plan Advisor, is for educational and informational purposes only. It does NOT constitute:</P>
            <ListItem>Medical advice, diagnosis, or treatment recommendations</ListItem>
            <ListItem>Professional financial, tax, or investment advice</ListItem>
            <ListItem>Legal advice regarding insurance regulations or eligibility</ListItem>
            <ListItem>A guarantee of eligibility for any plan, subsidy, or tax credit</ListItem>
            <P>Users should consult with qualified healthcare providers, licensed insurance agents, tax professionals, or attorneys for personalized advice.</P>
          </>
        ),
      },
      {
        id: "accuracy",
        title: "5. Accuracy of Information",
        content: (
          <P>While we strive to display accurate and up-to-date plan information, EnrollSalud does not guarantee the accuracy, completeness, or timeliness of any information displayed on the platform. Plan details, premiums, deductibles, copayments, and provider networks are subject to change by insurance carriers and CMS. Users should verify all plan details directly with the insurance carrier or on HealthCare.gov before making enrollment decisions.</P>
        ),
      },
      {
        id: "data-collection",
        title: "6. Data Collection and Privacy",
        content: (
          <>
            <P>EnrollSalud collects demographic information (age, income, household composition, ZIP code, tobacco use, pregnancy status) solely for the purpose of generating health insurance quotes. This information is NOT Protected Health Information (PHI) under HIPAA as defined by 45 CFR 160.103, as EnrollSalud does not provide healthcare services, health plans, or healthcare clearinghouse functions.</P>
            <P>Your data is stored securely and is only shared with your assigned licensed insurance agent to facilitate enrollment. We do not sell your data to third parties.</P>
            <AlertBox type="info">
              <strong>Your Privacy:</strong> We collect only the minimum information necessary to generate accurate plan comparisons and connect you with a licensed agent. Your data is encrypted in transit and at rest.
            </AlertBox>
          </>
        ),
      },
      {
        id: "eligibility",
        title: "7. User Eligibility & Responsibilities",
        content: (
          <P>To use this Service, you must be at least 18 years of age and a resident of or seeking health insurance coverage in the State of Florida. You agree to provide accurate and truthful information when using the Service, and to use the Service only for lawful purposes.</P>
        ),
      },
      {
        id: "liability",
        title: "8. Limitation of Liability",
        content: (
          <>
            <AlertBox type="danger">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, ENROLLSALUD AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.
            </AlertBox>
            <P>This includes, but is not limited to, damages arising from: reliance on plan information displayed on the platform; decisions made based on AI Plan Advisor outputs; loss of coverage, missed enrollment periods, or incorrect subsidy estimates; or technical errors, outages, or data inaccuracies.</P>
          </>
        ),
      },
      {
        id: "governing-law",
        title: "9. Governing Law",
        content: (
          <P>These Terms shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of law provisions. Any disputes arising from these Terms shall be resolved in the courts of the State of Florida.</P>
        ),
      },
      {
        id: "agent-subscription",
        title: "10. Agent Subscription Services",
        content: (
          <>
            <H3>10.1 Eligibility</H3>
            <P>Agent Subscription Services are available only to insurance professionals who are (a) licensed health insurance agents in good standing in the State of Florida or other applicable U.S. jurisdictions, (b) registered with a valid National Producer Number (NPN) on the National Insurance Producer Registry (NIPR), and (c) at least 18 years of age. EnrollSalud reserves the right to verify agent credentials at any time and to suspend or terminate accounts that fail verification.</P>
            <H3>10.2 Subscription Plans</H3>
            <P>EnrollSalud offers tiered subscription plans (Básico, Pro, Avanzado) with monthly and annual billing options. Current pricing, plan limits, and features are displayed at enrollsalud.com/agentes and may be updated from time to time with at least thirty (30) days&apos; notice to active subscribers.</P>
            <H3>10.3 Free Trial</H3>
            <P>New agents receive a fourteen (14)-day free trial with the contact limits of the Pro plan. No credit card is required to start the trial. At the end of the trial period, agents must select a paid plan to continue using the Service.</P>
            <H3>10.4 Auto-Renewal</H3>
            <P>Paid subscriptions automatically renew at the end of each billing cycle (monthly or annual, as selected) until canceled. By subscribing, the agent authorizes EnrollSalud and its payment processor (Stripe, Inc.) to charge the payment method on file at the start of each renewal period.</P>
            <H3>10.5 Cancellation</H3>
            <P>Agents may cancel their subscription at any time through the Stripe Customer Portal accessible from their dashboard. Upon cancellation, access to paid features remains active until the end of the current billing period. No prorated refunds are issued for unused portions of a billing cycle, except where required by applicable law.</P>
            <H3>10.6 Failed Payments</H3>
            <P>If a payment fails, EnrollSalud will retry the charge up to three (3) times over seven (7) days. If all retries fail, the agent&apos;s account will be suspended until payment is updated. Data is retained for thirty (30) days after suspension before deletion.</P>
            <H3>10.7 Plan Limits</H3>
            <P>Each subscription plan includes a monthly contact (lead) cap. Once the cap is reached, the agent&apos;s public quote link will display an unavailability message until the next billing cycle resets, or until the agent upgrades to a higher plan. EnrollSalud does not charge overage fees.</P>
            <H3>10.8 Legacy Early Adopter Status</H3>
            <P>Agents who joined EnrollSalud prior to April 23, 2026 may have been granted Legacy Early Adopter status, which provides Pro-tier access at no cost until June 23, 2026. After that date, Legacy agents must select a paid plan or downgrade to a Free tier (if available) to continue using the Service.</P>
          </>
        ),
      },
      {
        id: "agent-communications",
        title: "11. Agent Communications and TCPA Compliance",
        content: (
          <>
            <H3>11.1 Agent&apos;s Own Channels</H3>
            <P>EnrollSalud is a software platform that provides agents with quoting tools, lead capture forms, and content templates (including suggested WhatsApp, SMS, and email messages). EnrollSalud does NOT send communications to end consumers on behalf of agents. All outbound communications from agents to their prospects, leads, or clients — by SMS, voice call, WhatsApp, email, or any other channel — are sent through the agent&apos;s own personal or business accounts and devices.</P>
            <H3>11.2 Sole Responsibility of the Agent</H3>
            <P>The agent is solely and exclusively responsible for:</P>
            <ListItem bold="(a)">Obtaining valid prior express written consent from each consumer before initiating any telemarketing or commercial solicitation by automated dialing system, prerecorded voice, SMS, or WhatsApp, in compliance with the Telephone Consumer Protection Act, 47 U.S.C. § 227 (TCPA) and its implementing regulations at 47 C.F.R. § 64.1200;</ListItem>
            <ListItem bold="(b)">Complying with the CAN-SPAM Act, 15 U.S.C. § 7701 et seq., for all email communications;</ListItem>
            <ListItem bold="(c)">Honoring all applicable Do-Not-Call (DNC) registries, including the federal DNC Registry maintained by the Federal Trade Commission and any state-level DNC registries;</ListItem>
            <ListItem bold="(d)">Complying with the Florida Telephone Solicitation Act (FTSA), Fla. Stat. § 501.059, including its consent and time-of-day restrictions;</ListItem>
            <ListItem bold="(e)">Maintaining auditable records of consent for the duration required by applicable law;</ListItem>
            <ListItem bold="(f)">Providing clear and conspicuous opt-out mechanisms in every commercial communication; and</ListItem>
            <ListItem bold="(g)">The content, accuracy, and legality of every message sent through the agent&apos;s own channels, including any content based on or derived from EnrollSalud templates.</ListItem>
            <H3>11.3 Templates Are Suggestions Only</H3>
            <P>Message templates provided by EnrollSalud (for WhatsApp, SMS, email, or other channels) are illustrative suggestions intended to assist agents. Use of these templates does NOT constitute legal advice and does NOT shift TCPA, CAN-SPAM, or DNC compliance responsibilities to EnrollSalud. The agent must independently evaluate each template&apos;s suitability for the agent&apos;s specific use case, audience, and jurisdiction, and must modify templates as necessary to remain compliant.</P>
            <H3>11.4 Indemnification</H3>
            <P>The agent agrees to indemnify, defend, and hold harmless EnrollSalud, FPI Enterprises, Inc., and their respective officers, directors, employees, and affiliates from and against any and all claims, damages, losses, liabilities, judgments, settlements, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or related to (a) any communication sent by the agent through the agent&apos;s own channels, (b) any TCPA, CAN-SPAM, FTSA, DNC, or analogous claim asserted by a consumer or regulator against the agent or EnrollSalud as a result of the agent&apos;s communication practices, or (c) any breach by the agent of this Section 11.</P>
          </>
        ),
      },
      {
        id: "acceptable-use",
        title: "12. Acceptable Use Policy",
        content: (
          <>
            <P>Agents agree NOT to:</P>
            <ListItem bold="(a)">Send unsolicited bulk messaging or spam through any channel, whether using EnrollSalud templates or otherwise;</ListItem>
            <ListItem bold="(b)">Scrape, harvest, or appropriate leads, contacts, or quote data belonging to other agents within the EnrollSalud platform;</ListItem>
            <ListItem bold="(c)">Resell, sublicense, transfer, or grant unauthorized third parties access to the agent&apos;s account or to any EnrollSalud feature;</ListItem>
            <ListItem bold="(d)">Use bots, scripts, or any form of automation to circumvent plan limits, abuse the platform, or generate fraudulent leads or conversions;</ListItem>
            <ListItem bold="(e)">Misrepresent themselves to consumers as representatives of HealthCare.gov, the Centers for Medicare &amp; Medicaid Services (CMS), the State of Florida, or any government entity;</ListItem>
            <ListItem bold="(f)">Submit false or misleading information to manipulate subsidy estimates, plan eligibility, or any other Service output;</ListItem>
            <ListItem bold="(g)">Reverse-engineer, decompile, copy, or attempt to derive the source code of the EnrollSalud platform, or build a competing service using EnrollSalud&apos;s interfaces or data; or</ListItem>
            <ListItem bold="(h)">Engage in any activity that violates applicable federal or state law, including the regulations of the Florida Office of Insurance Regulation.</ListItem>
            <P>Violation of this Acceptable Use Policy may result in immediate suspension or termination of the agent&apos;s account without refund and without prejudice to EnrollSalud&apos;s other legal remedies.</P>
          </>
        ),
      },
      {
        id: "billing-disputes",
        title: "13. Billing, Payments, and Disputes",
        content: (
          <>
            <H3>13.1 Payment Processor</H3>
            <P>All payments are processed by Stripe, Inc. By subscribing, the agent agrees to Stripe&apos;s Terms of Service and Privacy Policy, available at stripe.com/legal.</P>
            <H3>13.2 Currency</H3>
            <P>All charges are denominated and billed in United States Dollars (USD).</P>
            <H3>13.3 Invoices</H3>
            <P>Invoices are generated automatically and are accessible to the agent through the Stripe Customer Portal linked from the agent&apos;s dashboard.</P>
            <H3>13.4 Disputes Before Chargebacks</H3>
            <P>If the agent believes a charge is incorrect or unauthorized, the agent must contact EnrollSalud at <a href="mailto:info@enrollsalud.com" className="text-teal-600 hover:underline">info@enrollsalud.com</a> within thirty (30) days of the charge to seek resolution BEFORE initiating a chargeback or payment dispute through Stripe or the agent&apos;s bank or card issuer. Chargebacks initiated without prior contact may result in immediate account termination and reversal of any pending services.</P>
            <H3>13.5 Tax Responsibility</H3>
            <P>The agent is responsible for any sales, use, value-added, or other taxes, duties, or governmental fees applicable to the agent&apos;s subscription, except for taxes based on EnrollSalud&apos;s net income.</P>
          </>
        ),
      },
    ],
  },
  es: {
    effectiveDate: "Fecha de vigencia: 30 de abril de 2026",
    sections: [
      {
        id: "acceptance",
        title: "1. Aceptación de Términos",
        content: (
          <>
            <P>Al acceder o utilizar el sitio web y los servicios de EnrollSalud (el "Servicio"), usted acepta quedar sujeto a estos Términos de Servicio ("Términos"). Si no está de acuerdo con estos Términos, no debe acceder ni utilizar el Servicio.</P>
            <P>Nos reservamos el derecho de actualizar o modificar estos Términos en cualquier momento. Los cambios entran en vigencia al publicarse en este sitio web. Su uso continuado del Servicio después de cualquier cambio constituye aceptación de los Términos revisados. Estos Términos incluyen disposiciones adicionales para agentes de seguros licenciados que se suscriben a los servicios pagos de EnrollSalud, establecidas en las Secciones 10 a 13 a continuación.</P>
          </>
        ),
      },
      {
        id: "description",
        title: "2. Descripción del Servicio",
        content: (
          <>
            <P>EnrollSalud es una plataforma bilingüe (inglés/español) de cotización de seguros médicos que proporciona:</P>
            <ListItem bold="Comparación de Planes:">Muestra de Planes de Salud Calificados (QHPs) disponibles en el Estado de Florida a través del Mercado de Seguros Médicos.</ListItem>
            <ListItem bold="Asesor de Planes con IA:">Una herramienta impulsada por inteligencia artificial que proporciona explicaciones generales de planes de seguro médico, estrategias financieras y comparaciones año a año en lenguaje sencillo.</ListItem>
            <ListItem bold="Conexión con Agentes:">Una plataforma para que agentes de seguros licenciados se conecten con consumidores que buscan orientación sobre seguros médicos.</ListItem>
            <AlertBox type="warning">
              <strong>Importante:</strong> EnrollSalud NO es el Mercado de Seguros Médicos (CuidadoDeSalud.gov). Somos una plataforma independiente que muestra información de planes disponible públicamente para ayudar a los consumidores a comparar opciones y conectarse con agentes licenciados.
            </AlertBox>
          </>
        ),
      },
      {
        id: "no-sales",
        title: "3. Sin Venta ni Inscripción de Seguros",
        content: (
          <>
            <P>EnrollSalud NO vende seguros, procesa solicitudes ni inscribe consumidores en ningún plan de seguro médico. El Servicio se limita a proporcionar información comparativa de planes y conectar consumidores con agentes de seguros licenciados.</P>
            <P>Toda inscripción en Planes de Salud Calificados debe completarse a través de CuidadoDeSalud.gov, el Mercado de Seguros Médicos oficial, o a través de un agente o corredor licenciado y registrado.</P>
          </>
        ),
      },
      {
        id: "no-advice",
        title: "4. Sin Asesoría Médica ni Financiera",
        content: (
          <>
            <P>La información proporcionada a través del Servicio, incluyendo el Asesor de Planes con IA, es solo con fines educativos e informativos. NO constituye:</P>
            <ListItem>Asesoría médica, diagnóstico o recomendaciones de tratamiento</ListItem>
            <ListItem>Asesoría financiera, fiscal o de inversión profesional</ListItem>
            <ListItem>Asesoría legal sobre regulaciones de seguros o elegibilidad</ListItem>
            <ListItem>Una garantía de elegibilidad para cualquier plan, subsidio o crédito fiscal</ListItem>
            <P>Los usuarios deben consultar con profesionales de salud calificados, agentes de seguros licenciados, profesionales de impuestos o abogados para asesoría personalizada.</P>
          </>
        ),
      },
      {
        id: "accuracy",
        title: "5. Precisión de la Información",
        content: (
          <P>Aunque nos esforzamos por mostrar información precisa y actualizada, EnrollSalud no garantiza la exactitud, integridad u oportunidad de ninguna información mostrada en la plataforma. Los detalles de los planes, primas, deducibles, copagos y redes de proveedores están sujetos a cambios por parte de las aseguradoras y CMS. Los usuarios deben verificar todos los detalles del plan directamente con la aseguradora o en CuidadoDeSalud.gov antes de tomar decisiones de inscripción.</P>
        ),
      },
      {
        id: "data-collection",
        title: "6. Recopilación de Datos y Privacidad",
        content: (
          <>
            <P>EnrollSalud recopila información demográfica (edad, ingresos, composición del hogar, código postal, uso de tabaco, estado de embarazo) únicamente con el propósito de generar cotizaciones de seguros médicos. Esta información NO es Información de Salud Protegida (PHI) bajo HIPAA según lo definido por 45 CFR 160.103, ya que EnrollSalud no proporciona servicios de atención médica, planes de salud ni funciones de cámara de compensación de atención médica.</P>
            <P>Sus datos se almacenan de forma segura y solo se comparten con su agente de seguros licenciado asignado para facilitar la inscripción. No vendemos sus datos a terceros.</P>
            <AlertBox type="info">
              <strong>Su Privacidad:</strong> Recopilamos solo la información mínima necesaria para generar comparaciones precisas de planes y conectarlo con un agente licenciado. Sus datos están encriptados en tránsito y en reposo.
            </AlertBox>
          </>
        ),
      },
      {
        id: "eligibility",
        title: "7. Elegibilidad y Responsabilidades del Usuario",
        content: (
          <P>Para utilizar este Servicio, debe tener al menos 18 años de edad y ser residente del Estado de Florida o estar buscando cobertura de seguro médico en Florida. Usted acepta proporcionar información precisa y veraz al usar el Servicio, y usar el Servicio solo para fines legales.</P>
        ),
      },
      {
        id: "liability",
        title: "8. Limitación de Responsabilidad",
        content: (
          <>
            <AlertBox type="danger">
              EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, ENROLLSALUD Y SUS AFILIADOS, FUNCIONARIOS, EMPLEADOS Y AGENTES NO SERÁN RESPONSABLES POR DAÑOS INDIRECTOS, INCIDENTALES, ESPECIALES, CONSECUENTES O PUNITIVOS QUE SURJAN DE SU USO O INCAPACIDAD PARA USAR EL SERVICIO.
            </AlertBox>
            <P>Esto incluye, pero no se limita a, daños derivados de: la dependencia de la información de planes mostrada en la plataforma; decisiones tomadas basadas en resultados del Asesor de Planes con IA; pérdida de cobertura, períodos de inscripción perdidos o estimaciones de subsidios incorrectas; o errores técnicos, interrupciones o inexactitudes de datos.</P>
          </>
        ),
      },
      {
        id: "governing-law",
        title: "9. Ley Aplicable",
        content: (
          <P>Estos Términos se regirán e interpretarán de acuerdo con las leyes del Estado de Florida, sin tener en cuenta sus disposiciones sobre conflictos de leyes. Cualquier disputa que surja de estos Términos se resolverá en los tribunales del Estado de Florida.</P>
        ),
      },
      {
        id: "agent-subscription",
        title: "10. Servicios de Suscripción para Agentes",
        content: (
          <>
            <H3>10.1 Elegibilidad</H3>
            <P>Los Servicios de Suscripción para Agentes están disponibles únicamente para profesionales de seguros que sean (a) agentes de seguros médicos licenciados y en buen estado en el Estado de Florida u otras jurisdicciones aplicables de los Estados Unidos, (b) registrados con un Número Nacional de Productor (NPN) válido en el National Insurance Producer Registry (NIPR), y (c) mayores de 18 años. EnrollSalud se reserva el derecho de verificar las credenciales del agente en cualquier momento y de suspender o terminar las cuentas que no superen la verificación.</P>
            <H3>10.2 Planes de Suscripción</H3>
            <P>EnrollSalud ofrece planes de suscripción por niveles (Básico, Pro, Avanzado) con opciones de facturación mensual y anual. Los precios vigentes, límites de planes y funcionalidades se muestran en enrollsalud.com/agentes y pueden actualizarse periódicamente con al menos treinta (30) días de aviso previo a los suscriptores activos.</P>
            <H3>10.3 Prueba Gratuita</H3>
            <P>Los nuevos agentes reciben una prueba gratuita de catorce (14) días con los límites de contactos del plan Pro. No se requiere tarjeta de crédito para iniciar la prueba. Al finalizar el período de prueba, los agentes deben seleccionar un plan pago para continuar utilizando el Servicio.</P>
            <H3>10.4 Renovación Automática</H3>
            <P>Las suscripciones pagas se renuevan automáticamente al finalizar cada ciclo de facturación (mensual o anual, según se haya seleccionado) hasta su cancelación. Al suscribirse, el agente autoriza a EnrollSalud y a su procesador de pagos (Stripe, Inc.) a cobrar el método de pago registrado al inicio de cada período de renovación.</P>
            <H3>10.5 Cancelación</H3>
            <P>Los agentes pueden cancelar su suscripción en cualquier momento a través del Stripe Customer Portal accesible desde su dashboard. Al cancelar, el acceso a las funcionalidades pagas permanece activo hasta el final del período de facturación en curso. No se emiten reembolsos prorrateados por porciones no utilizadas de un ciclo de facturación, salvo cuando lo requiera la ley aplicable.</P>
            <H3>10.6 Pagos Fallidos</H3>
            <P>Si un pago falla, EnrollSalud reintentará el cobro hasta tres (3) veces durante siete (7) días. Si todos los reintentos fallan, la cuenta del agente será suspendida hasta que el pago se actualice. Los datos se conservan durante treinta (30) días posteriores a la suspensión antes de su eliminación.</P>
            <H3>10.7 Límites de Plan</H3>
            <P>Cada plan de suscripción incluye un límite mensual de contactos (leads). Una vez alcanzado el límite, el link público de cotización del agente mostrará un mensaje de no disponibilidad hasta que el siguiente ciclo de facturación se reinicie, o hasta que el agente actualice a un plan superior. EnrollSalud no cobra cargos por excedente.</P>
            <H3>10.8 Estado Legacy Early Adopter</H3>
            <P>Los agentes que se hayan unido a EnrollSalud antes del 23 de abril de 2026 pueden haber recibido el estado Legacy Early Adopter, que otorga acceso de nivel Pro sin costo hasta el 23 de junio de 2026. Después de esa fecha, los agentes Legacy deben seleccionar un plan pago o pasar a un nivel Gratuito (si está disponible) para continuar utilizando el Servicio.</P>
          </>
        ),
      },
      {
        id: "agent-communications",
        title: "11. Comunicaciones del Agente y Cumplimiento de TCPA",
        content: (
          <>
            <H3>11.1 Canales Propios del Agente</H3>
            <P>EnrollSalud es una plataforma de software que proporciona a los agentes herramientas de cotización, formularios de captura de contactos y plantillas de contenido (incluyendo mensajes sugeridos de WhatsApp, SMS y email). EnrollSalud NO envía comunicaciones a consumidores finales en nombre de los agentes. Todas las comunicaciones salientes del agente hacia sus prospectos, contactos o clientes — por SMS, llamada de voz, WhatsApp, email o cualquier otro canal — se envían a través de las cuentas y dispositivos personales o comerciales del propio agente.</P>
            <H3>11.2 Responsabilidad Exclusiva del Agente</H3>
            <P>El agente es única y exclusivamente responsable de:</P>
            <ListItem bold="(a)">Obtener consentimiento previo expreso por escrito y válido de cada consumidor antes de iniciar cualquier telemarketing o solicitación comercial mediante sistema de marcado automático, voz pregrabada, SMS o WhatsApp, en cumplimiento con el Telephone Consumer Protection Act, 47 U.S.C. § 227 (TCPA) y sus regulaciones de implementación en 47 C.F.R. § 64.1200;</ListItem>
            <ListItem bold="(b)">Cumplir con el CAN-SPAM Act, 15 U.S.C. § 7701 et seq., para todas las comunicaciones por email;</ListItem>
            <ListItem bold="(c)">Honrar todos los registros aplicables de No Llamar (DNC), incluyendo el DNC Registry federal mantenido por la Federal Trade Commission y cualquier registro DNC a nivel estatal;</ListItem>
            <ListItem bold="(d)">Cumplir con el Florida Telephone Solicitation Act (FTSA), Fla. Stat. § 501.059, incluyendo sus restricciones de consentimiento y horario;</ListItem>
            <ListItem bold="(e)">Mantener registros auditables de consentimiento durante el plazo requerido por la ley aplicable;</ListItem>
            <ListItem bold="(f)">Proporcionar mecanismos claros y conspicuos de exclusión (opt-out) en cada comunicación comercial; y</ListItem>
            <ListItem bold="(g)">El contenido, exactitud y legalidad de cada mensaje enviado a través de los canales propios del agente, incluyendo cualquier contenido basado en o derivado de plantillas de EnrollSalud.</ListItem>
            <H3>11.3 Las Plantillas Son Sólo Sugerencias</H3>
            <P>Las plantillas de mensajes proporcionadas por EnrollSalud (para WhatsApp, SMS, email u otros canales) son sugerencias ilustrativas destinadas a asistir a los agentes. El uso de estas plantillas NO constituye asesoría legal y NO transfiere las responsabilidades de cumplimiento de TCPA, CAN-SPAM o DNC a EnrollSalud. El agente debe evaluar de manera independiente la idoneidad de cada plantilla para su caso de uso, audiencia y jurisdicción específicos, y debe modificar las plantillas según sea necesario para mantener el cumplimiento.</P>
            <H3>11.4 Indemnización</H3>
            <P>El agente acepta indemnizar, defender y mantener indemnes a EnrollSalud, FPI Enterprises, Inc., y a sus respectivos funcionarios, directores, empleados y afiliados frente a cualquier reclamo, daño, pérdida, responsabilidad, sentencia, transacción, costo y gasto (incluyendo honorarios razonables de abogados) que surjan de o estén relacionados con (a) cualquier comunicación enviada por el agente a través de sus canales propios, (b) cualquier reclamo de TCPA, CAN-SPAM, FTSA, DNC o análogo presentado por un consumidor o regulador contra el agente o EnrollSalud como resultado de las prácticas de comunicación del agente, o (c) cualquier incumplimiento por parte del agente de esta Sección 11.</P>
          </>
        ),
      },
      {
        id: "acceptable-use",
        title: "12. Política de Uso Aceptable",
        content: (
          <>
            <P>Los agentes aceptan NO:</P>
            <ListItem bold="(a)">Enviar mensajería masiva no solicitada o spam a través de cualquier canal, ya sea utilizando plantillas de EnrollSalud o de otra manera;</ListItem>
            <ListItem bold="(b)">Extraer (scrape), recopilar o apropiarse de contactos, leads o datos de cotización pertenecientes a otros agentes dentro de la plataforma EnrollSalud;</ListItem>
            <ListItem bold="(c)">Revender, sublicenciar, transferir u otorgar a terceros no autorizados acceso a la cuenta del agente o a cualquier funcionalidad de EnrollSalud;</ListItem>
            <ListItem bold="(d)">Utilizar bots, scripts o cualquier forma de automatización para evadir los límites del plan, abusar de la plataforma, o generar leads o conversiones fraudulentas;</ListItem>
            <ListItem bold="(e)">Tergiversar su identidad ante consumidores como representantes de HealthCare.gov, los Centers for Medicare &amp; Medicaid Services (CMS), el Estado de Florida, o cualquier entidad gubernamental;</ListItem>
            <ListItem bold="(f)">Enviar información falsa o engañosa para manipular las estimaciones de subsidios, la elegibilidad de planes, o cualquier otro resultado del Servicio;</ListItem>
            <ListItem bold="(g)">Realizar ingeniería inversa, descompilar, copiar o intentar derivar el código fuente de la plataforma EnrollSalud, o construir un servicio competidor utilizando las interfaces o datos de EnrollSalud; o</ListItem>
            <ListItem bold="(h)">Participar en cualquier actividad que viole la ley federal o estatal aplicable, incluyendo las regulaciones de la Florida Office of Insurance Regulation.</ListItem>
            <P>La violación de esta Política de Uso Aceptable puede resultar en la suspensión o terminación inmediata de la cuenta del agente sin reembolso y sin perjuicio de los demás recursos legales de EnrollSalud.</P>
          </>
        ),
      },
      {
        id: "billing-disputes",
        title: "13. Facturación, Pagos y Disputas",
        content: (
          <>
            <H3>13.1 Procesador de Pagos</H3>
            <P>Todos los pagos son procesados por Stripe, Inc. Al suscribirse, el agente acepta los Términos de Servicio y la Política de Privacidad de Stripe, disponibles en stripe.com/legal.</P>
            <H3>13.2 Moneda</H3>
            <P>Todos los cargos están denominados y facturados en Dólares de los Estados Unidos (USD).</P>
            <H3>13.3 Facturas</H3>
            <P>Las facturas se generan automáticamente y son accesibles para el agente a través del Stripe Customer Portal vinculado desde el dashboard del agente.</P>
            <H3>13.4 Disputas Antes de Contracargos</H3>
            <P>Si el agente considera que un cargo es incorrecto o no autorizado, el agente debe contactar a EnrollSalud en <a href="mailto:info@enrollsalud.com" className="text-teal-600 hover:underline">info@enrollsalud.com</a> dentro de los treinta (30) días posteriores al cargo para buscar una resolución ANTES de iniciar un contracargo o disputa de pago a través de Stripe o del banco o emisor de tarjeta del agente. Los contracargos iniciados sin contacto previo pueden resultar en la terminación inmediata de la cuenta y la reversión de cualquier servicio pendiente.</P>
            <H3>13.5 Responsabilidad Tributaria</H3>
            <P>El agente es responsable por cualquier impuesto a las ventas, uso, valor agregado u otros impuestos, derechos o tasas gubernamentales aplicables a la suscripción del agente, excepto los impuestos basados en el ingreso neto de EnrollSalud.</P>
          </>
        ),
      },
    ],
  },
};

export default function TermsOfServicePage() {
  return (
    <LegalLayout titleEn="Terms of Service" titleEs="Términos de Servicio" lastUpdated="April 30, 2026">
      {(lang) => {
        const data = CONTENT[lang];
        return (
          <div>
            <p className="text-xs text-slate-400 mb-6 font-mono">{data.effectiveDate}</p>
            {data.sections.map((section) => (
              <Section key={section.id} id={section.id}>
                <H2>{section.title}</H2>
                {section.content}
              </Section>
            ))}
          </div>
        );
      }}
    </LegalLayout>
  );
}
