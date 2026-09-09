export type StoryCampaign = {
  key: string;
  label: string;
  title: string;
  titleEn: string;
  scene: string;
  sceneEn: string;
  tension: string;
  tensionEn: string;
  turningPoint: string;
  turningPointEn: string;
  cta: string;
  ctaEn: string;
};

// Composite situations, not customer testimonials. Keep the protagonist as
// the consumer and avoid implying eligibility, savings, or a specific plan.
export const STORY_CAMPAIGNS: readonly StoryCampaign[] = [
  {
    key: "historia-carta-mesa-v1",
    label: "La carta sobre la mesa",
    title: "Hay cartas que uno deja cerradas sobre la mesa.",
    titleEn: "Some letters stay closed on the table.",
    scene: "No porque no importen, sino porque da miedo abrirlas y encontrar una cifra que cambie el presupuesto de la familia.",
    sceneEn: "Not because they do not matter, but because opening one might reveal a number that changes the family budget.",
    tension: "Cuando una decisión parece demasiado grande, muchas personas esperan hasta que ya no sienten que tienen margen.",
    tensionEn: "When a decision feels too large, many people wait until they no longer feel they have room to act.",
    turningPoint: "A veces el primer paso no es elegir. Es entender qué está pasando y qué preguntas vale la pena hacer.",
    turningPointEn: "Sometimes the first step is not choosing. It is understanding what is happening and which questions are worth asking.",
    cta: "Quiero entender mi situación",
    ctaEn: "I want to understand my situation",
  },
  {
    key: "historia-cita-pospuesta-v1",
    label: "La cita pospuesta",
    title: "La cita médica seguía en la agenda, mes tras mes.",
    titleEn: "The medical appointment stayed on the calendar, month after month.",
    scene: "Entre el trabajo, los niños y las cuentas, era fácil decir: la próxima semana.",
    sceneEn: "Between work, children, and bills, it was easy to say: next week.",
    tension: "Posponer una conversación sobre cobertura puede sentirse más sencillo que enfrentar una decisión sin respuestas claras.",
    tensionEn: "Putting off a coverage conversation can feel easier than facing a decision without clear answers.",
    turningPoint: "La tranquilidad empieza cuando alguien puede revisar su situación con calma, en su idioma y sin presión.",
    turningPointEn: "Peace of mind starts when someone can review their situation calmly, in their language, without pressure.",
    cta: "Quiero revisar mi situación",
    ctaEn: "I want to review my situation",
  },
  {
    key: "historia-cambio-trabajo-v1",
    label: "El cambio de trabajo",
    title: "Un cambio de trabajo también puede cambiar muchas otras cosas.",
    titleEn: "A change at work can change many other things too.",
    scene: "La familia estaba celebrando el nuevo comienzo, hasta que apareció la pregunta: ¿y ahora qué pasa con la cobertura?",
    sceneEn: "The family was celebrating a new beginning until the question appeared: what happens to our coverage now?",
    tension: "Los cambios importantes no siempre vienen con instrucciones sencillas.",
    tensionEn: "Important changes do not always come with simple instructions.",
    turningPoint: "Antes de correr a tomar una decisión, conviene ordenar las fechas, las personas y las preguntas que realmente importan.",
    turningPointEn: "Before rushing into a decision, it helps to organize the dates, the people, and the questions that truly matter.",
    cta: "Quiero ordenar mis opciones",
    ctaEn: "I want to organize my options",
  },
  {
    key: "historia-trabajo-independiente-v1",
    label: "Trabajar por cuenta propia",
    title: "Trabajar por cuenta propia da libertad, pero también preguntas.",
    titleEn: "Working for yourself brings freedom, but also questions.",
    scene: "Cada mes se ve distinto y proteger a la familia no debería depender de adivinar qué hacer.",
    sceneEn: "Every month looks different, and protecting your family should not depend on guessing what to do.",
    tension: "Cuando el ingreso cambia, una respuesta genérica no alcanza.",
    tensionEn: "When income changes, a generic answer is not enough.",
    turningPoint: "Una conversación clara puede convertir la incertidumbre en una lista concreta de próximos pasos.",
    turningPointEn: "A clear conversation can turn uncertainty into a concrete list of next steps.",
    cta: "Quiero empezar por entender",
    ctaEn: "I want to start by understanding",
  },
];

export function getStoryCampaign(key?: string | null): StoryCampaign {
  return STORY_CAMPAIGNS.find((story) => story.key === key) || STORY_CAMPAIGNS[0];
}
