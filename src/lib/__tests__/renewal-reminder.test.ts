import { describe, expect, it } from "vitest";

import { mensajeRenovacion, ventanaEnero } from "../renewal-reminder";

// 14:00 UTC = 10:00 en Florida, la hora del cron.
const at = (isoDate: string) => new Date(`${isoDate}T14:00:00Z`);

describe("ventanaEnero", () => {
  it.each([
    ["2026-10-31", null],
    ["2027-01-16", null],
    ["2027-06-01", null],
  ])("%s → fuera de la ventana", (date) => {
    expect(ventanaEnero(at(date))).toBeNull();
  });

  it("1-nov: año 2027, antes del límite, solo el primero", () => {
    expect(ventanaEnero(at("2026-11-01"))).toEqual({
      anioRenovacion: 2027,
      antesDelLimite: true,
      desdeSegundo: false,
      desdeTercero: false,
      diasAlLimite: null,
    });
  });

  it("1-dic: desde el segundo, faltan 14 días", () => {
    const v = ventanaEnero(at("2026-12-01"))!;
    expect(v.desdeSegundo).toBe(true);
    expect(v.desdeTercero).toBe(false);
    expect(v.diasAlLimite).toBe(14);
  });

  it("10-dic: desde el tercero, faltan 5 días", () => {
    const v = ventanaEnero(at("2026-12-10"))!;
    expect(v.desdeTercero).toBe(true);
    expect(v.diasAlLimite).toBe(5);
  });

  it("15-dic sigue antes del límite; 16-dic ya no", () => {
    expect(ventanaEnero(at("2026-12-15"))!.antesDelLimite).toBe(true);
    expect(ventanaEnero(at("2026-12-16"))!.antesDelLimite).toBe(false);
  });

  it("15-ene: año 2027, después del límite", () => {
    expect(ventanaEnero(at("2027-01-15"))).toMatchObject({ anioRenovacion: 2027, antesDelLimite: false });
  });
});

describe("mensajeRenovacion", () => {
  it("es el texto aprobado, sin precio ni plan", () => {
    const msg = mensajeRenovacion({ nombre: "Ana", agente: "Alice", telefono: "2395551111", anio: 2027 });
    expect(msg).toBe(
      "Hola Ana, soy Alice, tu agente de seguro médico. Ya abrió la inscripción para 2027. Este año HealthSherpa te va a mandar un mensaje o un correo para que me autorices a renovar tu plan: ábrelo tú desde tu teléfono. Si quieres que tu plan empiece el 1 de enero, el límite es el 15 de diciembre. Cualquier duda, llámame al 2395551111."
    );
    expect(msg).not.toContain("$?");
    expect(msg).not.toContain("Vi que te interesa");
  });
});
