import { beforeEach, describe, expect, it, vi } from "vitest";

const captured: { event: string; props: Record<string, unknown> }[] = [];

vi.mock("posthog-js", () => ({
  default: {
    capture: (event: string, props: Record<string, unknown>) => {
      captured.push({ event, props });
    },
    identify: vi.fn(),
  },
}));

import { captureCarteraImportada, captureCarteraVista } from "../analytics";

// Guardrail: cartera events must carry ONLY numeric counts. Any client field
// (name, phone, email, income, age, plan) in these payloads is a PII leak.
describe("analytics de cartera sin PII", () => {
  beforeEach(() => {
    captured.length = 0;
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  });

  it("cartera_importada sends only numeric counts", () => {
    captureCarteraImportada({ filas_totales: 100, filas_validas: 98, filas_con_error: 2 });
    expect(captured).toHaveLength(1);
    expect(captured[0].event).toBe("cartera_importada");
    expect(captured[0].props).toEqual({
      filas_totales: 100,
      filas_validas: 98,
      filas_con_error: 2,
    });
    for (const v of Object.values(captured[0].props)) {
      expect(typeof v).toBe("number");
    }
  });

  it("cartera_vista sends only numeric counts", () => {
    captureCarteraVista({ clientes_total: 100, criticos: 28, altos: 25 });
    expect(captured).toHaveLength(1);
    expect(captured[0].event).toBe("cartera_vista");
    expect(captured[0].props).toEqual({ clientes_total: 100, criticos: 28, altos: 25 });
    for (const v of Object.values(captured[0].props)) {
      expect(typeof v).toBe("number");
    }
  });

  it("both are no-ops without the PostHog key (dark launch)", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    captureCarteraImportada({ filas_totales: 1, filas_validas: 1, filas_con_error: 0 });
    captureCarteraVista({ clientes_total: 1, criticos: 0, altos: 0 });
    expect(captured).toHaveLength(0);
  });
});
