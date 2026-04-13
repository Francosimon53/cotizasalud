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
    effectiveDate: "Effective Date: [INSERT DATE]",
    sections: [
      {
        id: "acceptance",
        title: "1. Acceptance of Terms",
        content: (
          <>
            <P>By accessing or using the EnrollSalud website and services (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not access or use the Service.</P>
            <P>We reserve the right to update or modify these Terms at any time. Changes become effective upon posting to this website. Your continued use of the Service after any changes constitutes acceptance of the revised Terms.</P>
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
    ],
  },
  es: {
    effectiveDate: "Fecha Efectiva: [INSERTAR FECHA]",
    sections: [
      {
        id: "acceptance",
        title: "1. Aceptación de Términos",
        content: (
          <>
            <P>Al acceder o utilizar el sitio web y los servicios de EnrollSalud (el "Servicio"), usted acepta quedar sujeto a estos Términos de Servicio ("Términos"). Si no está de acuerdo con estos Términos, no debe acceder ni utilizar el Servicio.</P>
            <P>Nos reservamos el derecho de actualizar o modificar estos Términos en cualquier momento. Los cambios entran en vigencia al publicarse en este sitio web. Su uso continuado del Servicio después de cualquier cambio constituye aceptación de los Términos revisados.</P>
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
    ],
  },
};

export default function TermsOfServicePage() {
  return (
    <LegalLayout titleEn="Terms of Service" titleEs="Términos de Servicio">
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
