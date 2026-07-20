// Feature flags. No flag system existed before this module; env-var based
// per the OEP module spec. NEXT_PUBLIC_ so the same flag gates server routes,
// server components and client UI.

export function isCarteraEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_CARTERA === "1";
}
