import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { captureExceptionSpy } = vi.hoisted(() => ({
  captureExceptionSpy: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionSpy,
}));

import { postLeadWrite, saveConsent, savePlanSelection } from "../save-lead";

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("postLeadWrite", () => {
  it("returns ok on first success without retrying or reporting", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse(200, { success: true }));
    vi.stubGlobal("fetch", fetchSpy);

    const res = await postLeadWrite("/api/plan-select", { a: 1 });

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(captureExceptionSpy).not.toHaveBeenCalled();
  });

  it("retries once after 2s and succeeds on the second attempt", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { error: "boom" }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));
    vi.stubGlobal("fetch", fetchSpy);

    const promise = postLeadWrite("/api/plan-select", { a: 1 });
    await vi.advanceTimersByTimeAsync(2000);
    const res = await promise;

    expect(res.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(captureExceptionSpy).not.toHaveBeenCalled();
  });

  it("reports to Sentry with endpoint/leadId/status context when both attempts fail", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse(400, { error: "Invalid lead reference" }));
    vi.stubGlobal("fetch", fetchSpy);

    const promise = postLeadWrite("/api/plan-select", { a: 1 }, { leadId: "lead-1" });
    await vi.advanceTimersByTimeAsync(2000);
    const res = await promise;

    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(captureExceptionSpy).toHaveBeenCalledTimes(1);
    expect(captureExceptionSpy.mock.calls[0][1]).toMatchObject({
      extra: {
        endpoint: "/api/plan-select",
        leadId: "lead-1",
        status: 400,
        responseError: "Invalid lead reference",
      },
    });
  });

  it("treats network errors as failed attempts and never throws", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const promise = postLeadWrite("/api/consents", { a: 1 });
    await vi.advanceTimersByTimeAsync(2000);
    const res = await promise;

    expect(res).toEqual({ ok: false, status: 0, json: null });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(captureExceptionSpy).toHaveBeenCalledTimes(1);
  });

  it("sends the x-lead-token header when a token is provided", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse(200));
    vi.stubGlobal("fetch", fetchSpy);

    await postLeadWrite("/api/plan-select", { a: 1 }, { leadToken: "tok-123" });

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-lead-token"]).toBe("tok-123");
  });

  it("omits the x-lead-token header when no token is provided", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse(200));
    vi.stubGlobal("fetch", fetchSpy);

    await postLeadWrite("/api/leads", { a: 1 });

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers as Record<string, string>).not.toHaveProperty("x-lead-token");
  });
});

describe("savePlanSelection", () => {
  it("returns false (instead of swallowing) when the endpoint rejects", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse(400, { error: "Invalid lead reference" }));
    vi.stubGlobal("fetch", fetchSpy);

    const promise = savePlanSelection("lead-1", { name: "X" }, "tok-123");
    await vi.advanceTimersByTimeAsync(2000);

    expect(await promise).toBe(false);
    expect(captureExceptionSpy).toHaveBeenCalledTimes(1);
  });
});

describe("saveConsent", () => {
  it("sends the token only when the consent is linked to a lead", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse(200, { consentId: "c1" }));
    vi.stubGlobal("fetch", fetchSpy);

    await saveConsent(
      { consumerName: "Maria", typedSignature: "Maria", consentDate: "d", agentName: "A" },
      "tok-123"
    );
    const [, standaloneInit] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(standaloneInit.headers as Record<string, string>).not.toHaveProperty("x-lead-token");

    await saveConsent(
      {
        leadId: "lead-1",
        consumerName: "Maria",
        typedSignature: "Maria",
        consentDate: "d",
        agentName: "A",
      },
      "tok-123"
    );
    const [, linkedInit] = fetchSpy.mock.calls[1] as unknown as [string, RequestInit];
    expect((linkedInit.headers as Record<string, string>)["x-lead-token"]).toBe("tok-123");
  });
});
