// Slugs con permisos de administración de plataforma.
//
// Fuente única de verdad. Antes esta lista estaba duplicada en tres sitios
// (el dashboard, la página de equipo y la API de toggle), y el botón "Equipo"
// se decidía con un prop `isAdmin` que solo una de las seis páginas del
// dashboard llegaba a pasar — por eso desaparecía al navegar fuera del panel
// principal. Cualquier consumidor nuevo debe importar de aquí.
export const ADMIN_SLUGS = ["simon-dev", "delbert"] as const;

export function isAdminSlug(slug: string | null | undefined): boolean {
  return !!slug && (ADMIN_SLUGS as readonly string[]).includes(slug);
}
