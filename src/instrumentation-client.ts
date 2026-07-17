import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

// Dark launch: without the publishable key, PostHog never initializes and the
// site behaves exactly as before (same pattern as Turnstile in Recinto).
if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/srx",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    session_recording: { maskAllInputs: true },
  });
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [Sentry.replayIntegration()],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
