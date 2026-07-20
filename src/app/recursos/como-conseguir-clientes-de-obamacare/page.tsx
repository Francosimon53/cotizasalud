import Link from "next/link";
import { getArticleBySlug } from "../articles";
import { ACA_STATS } from "@/lib/aca-stats";

const SLUG = "como-conseguir-clientes-de-obamacare";
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
          La licencia te enseñó lo que se puede y no se puede hacer. Tu FMO te dio contratos,
          productos y una tabla de comisiones. Pero hay una parte que nadie te enseñó en ningún
          curso: <strong>cómo conseguir a los clientes</strong>. Esa parte la pones tú — y si
          trabajas solo, como la mayoría de los agentes hispanos en Florida y en el resto del país,
          la aprendes a golpes: un OEP persiguiendo leads que no contestan, otro pagando por
          contactos que ya hablaron con tres agentes antes que tú.
        </p>

        <p>
          Y este año el margen de error se achicó. El OEP dura {ACA_STATS.oepDias} días, y tus
          clientes están pagando en promedio un {ACA_STATS.pagoNetoPct}% más de su bolsillo que
          antes. Eso significa más dudas, más miedo al precio y más gente que necesita a un agente
          que le explique en su idioma qué le conviene. La demanda existe. La pregunta es cómo hacer
          que esa demanda te encuentre <em>a ti</em> — y no al agente de al lado.
        </p>

        <p>
          Esta guía junta cinco tácticas que funcionan para el agente que trabaja solo, sin equipo
          de marketing y sin presupuesto grande. Ninguna es magia; todas son proceso. Puedes empezar
          cualquiera de ellas esta misma semana.
        </p>

        <h2>Táctica 1 · Referidos sistemáticos: tu cartera actual es el canal más barato</h2>

        <p>
          Antes de gastar un dólar en anuncios o en leads, mira tu propia cartera. Cada cliente
          contento conoce a familiares, compañeros de trabajo y vecinos que también necesitan
          seguro — y que confían más en la recomendación de alguien cercano que en cualquier
          publicidad. El problema no es que tus clientes no quieran referirte; es que casi nunca se
          lo pides, o se lo pides en el momento equivocado.
        </p>

        <p>
          El momento correcto tiene nombre: <strong>justo después de resolverle algo</strong>. Le
          confirmaste que su doctor está en la red. Le conseguiste un plan con mejor subsidio. Le
          resolviste el papeleo que lo traía dando vueltas. En ese instante el cliente siente
          gratitud concreta — y ahí es cuando una frase simple funciona: &quot;Me alegra que quedó
          resuelto. Si alguien de tu familia o tu trabajo necesita revisar su seguro, pásale mi
          número — con confianza.&quot;
        </p>

        <p>
          La diferencia entre el agente que recibe referidos &quot;de vez en cuando&quot; y el que
          los recibe todos los meses no es suerte: es proceso. Dos piezas, nada más — el{" "}
          <strong>momento</strong> (después de resolver, no en el saludo inicial ni en frío) y el{" "}
          <strong>mensaje</strong> (una frase tuya, natural, que uses siempre). Lleva un registro de
          quién te refirió a quién y agradécelo cada vez, aunque sea con un mensaje. El cliente que
          ve que su referido fue bien atendido, refiere de nuevo.
        </p>

        <h2>Táctica 2 · WhatsApp: el canal donde ya vive tu cliente</h2>

        <p>
          Tu cliente hispano no revisa el email todos los días — pero WhatsApp lo abre decenas de
          veces al día. Ahí viven las conversaciones de familia, los grupos de la iglesia, los
          grupos de venta del barrio. Para un agente ACA, eso significa tres cosas prácticas: tus{" "}
          <strong>estados</strong> son una vitrina gratuita que tus contactos ven sin que les
          escribas, los <strong>grupos comunitarios</strong> donde ya participas son lugares donde
          aportar valor (no spam), y la <strong>velocidad de respuesta</strong> — contestar en
          minutos, no en horas — es muchas veces lo que decide si el cliente cierra contigo o con
          el que le contestó primero.
        </p>

        <p>
          Regla de oro: <strong>con consentimiento y desde tu número</strong>. Escríbele a quien te
          dio su contacto o te lo pidió; preséntate con tu nombre; deja claro quién eres. Nada de
          blasting frío a números que no te conocen, nada de listas compradas. Además de los
          problemas legales que te puede traer, quema tu número y tu reputación en la misma
          comunidad de la que vives.
        </p>

        <p>
          Y hablemos con honestidad de los leads comprados o compartidos, porque casi todo agente
          los ha probado: llegan fríos, muchas veces revendidos, y cuando los llamas ya hablaron
          con varios agentes — o ni recuerdan haber pedido información. Compites por precio y por
          velocidad contra desconocidos. El lead que tú capturas con tus propios canales es otra
          historia: te conoce, llegó por confianza y <strong>es tuyo solo</strong>. Las tácticas de
          esta guía apuntan a eso: construir tu propia fuente de clientes en vez de alquilar la de
          otros.
        </p>

        <h2>Táctica 3 · Tu propio link de cotización, trabajando a cualquier hora</h2>

        <p>
          La pregunta que más recibes es siempre la misma: &quot;¿cuánto me sale?&quot;. Y cada vez
          que la respondes a mano — pedir código postal, edades, ingreso, armar la cotización,
          mandarla — se te van minutos que en temporada no tienes. Peor: el que pregunta a las 10
          de la noche y recibe respuesta al día siguiente, muchas veces ya se enfrió.
        </p>

        <p>
          La solución es tener <strong>tu propio link de cotización</strong>: una página con tu
          nombre donde el cliente cotiza solo, a la hora que sea. Con el link de EnrollSalud, el
          cliente pone su código postal, su familia y su ingreso, y ve planes reales del Marketplace
          con su subsidio estimado — un domingo a medianoche si quiere. Su contacto entra directo a
          tu pipeline, y a ti te llega un email al instante con sus datos y un botón de WhatsApp
          listo para escribirle. Tú te despiertas, tocas el botón y ya estás conversando con alguien
          que cotizó por su cuenta.
        </p>

        <p>
          Un link así rinde en todos los canales de esta guía: lo pones en tus estados de WhatsApp,
          se lo mandas al referido recién llegado, lo imprimes como <strong>código QR</strong> para
          la tarjeta o el local, y lo publicas en tus redes con los mensajes listos por canal que
          trae el kit de compartir. El punto es uno: que cotizar contigo no dependa de que tú estés
          disponible en ese momento.
        </p>

        <h2>Táctica 4 · Presencia local mínima: que te encuentren cuando te busquen</h2>

        <p>
          No necesitas ser influencer ni pagar campañas para existir donde tu comunidad busca. El
          mínimo viable son dos piezas. Primera: un <strong>perfil de Google Business</strong> con
          tu nombre, tu zona, tu horario y tu teléfono — gratis, y es lo que aparece cuando alguien
          de tu ciudad busca &quot;agente de seguros de salud cerca de mí&quot;. Pide a tus clientes
          contentos que te dejen una reseña; cada una trabaja para ti durante años.
        </p>

        <p>
          Segunda: <strong>una sola red social, pero activa</strong>. Elige la que tu comunidad use
          — Facebook e Instagram suelen ser las de la comunidad hispana adulta — y publica con
          constancia algo útil: fechas límite, qué documentos se necesitan, errores comunes al
          cotizar. En la comunidad hispana la confianza se construye viéndote aparecer semana tras
          semana, no con un anuncio de temporada. Constancia le gana a presupuesto.
        </p>

        <h2>Táctica 5 · El calendario es tu aliado: prepara la lista antes del OEP</h2>

        <p>
          El error más caro del agente que trabaja solo es empezar a buscar clientes cuando abre la
          inscripción. El OEP va del {ACA_STATS.oepInicio} al {ACA_STATS.oepFin} — y esos{" "}
          {ACA_STATS.oepDias} días son para <em>cerrar</em>, no para empezar a sembrar. La lista de
          gente a contactar se construye antes del {ACA_STATS.oepInicio}: los referidos que fuiste
          pidiendo, los contactos que cotizaron con tu link durante el año, los que te escribieron
          por un estado de WhatsApp y quedaron en &quot;lo pienso&quot;. Llegar al primer día con
          esa lista armada es la diferencia entre trabajar la temporada y padecerla.
        </p>

        <p>
          ¿Y el resto del año? No es tiempo muerto: es el <strong>SEP</strong>. Mudanzas,
          nacimientos, matrimonios, pérdida de cobertura del trabajo — cada evento calificado es
          una inscripción posible fuera de temporada, y cada una de esas personas es además un
          cliente que renovará contigo en noviembre. El año del agente no tiene meses vacíos; tiene
          meses de sembrar y {ACA_STATS.oepDias} días de cosechar.
        </p>

        <p>
          Una pieza más que casi nadie trata como adquisición: la <strong>renovación</strong>. El
          cliente cuya renovación acompañaste — tu panel te marca cada una con 60, 30 y 15 días de
          anticipación, para que no se entere en enero por una factura — es el cliente que te
          refiere al año siguiente.
          Retener bien no solo protege tu cartera: alimenta la Táctica 1. El ciclo completo se
          cierra ahí — el cliente bien atendido trae al próximo.
        </p>

        <h2>Por dónde empezar esta semana</h2>

        <p>
          No intentes las cinco tácticas a la vez. Elige dos: una que dependa solo de ti (la frase
          de referidos, el perfil de Google Business) y una de infraestructura (tu link de
          cotización funcionando y compartido en tus canales). En un mes evalúas qué te trajo
          conversaciones reales y doblas ahí.
        </p>

        <p>
          Y si quieres que la parte de infraestructura no dependa de tu memoria — el link que
          captura, el pipeline que avisa, las renovaciones que no se escapan — aquí desglosamos{" "}
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
