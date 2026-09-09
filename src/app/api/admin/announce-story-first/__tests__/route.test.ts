import { describe, expect, it, vi, beforeEach } from "vitest";

const sendEmail = vi.fn();
const getUser = vi.fn();
const from = vi.fn();

vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/supabase-auth", () => ({ createServerAuthClient: () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase", () => ({ createServiceClient: () => ({ from }) }));

describe("POST /api/admin/announce-story-first", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "admin-user" } } });
    from.mockImplementation((table: string) => {
      expect(table).toBe("agents");
      return {
        select: () => ({
          eq: (field: string, value: unknown) => field === "auth_user_id"
            ? { single: async () => ({ data: { slug: "simon-dev" } }) }
            : { then: undefined },
        }),
      };
    });
  });

  it("requires the admin profile", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await import("../route");
    const response = await POST();
    expect(response.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
