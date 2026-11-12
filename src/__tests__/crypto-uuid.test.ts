// @ts-nocheck
import fs from "node:fs";
import { CheckoutSessionService, setCheckoutRepository } from "../services/checkout.js";

describe("crypto UUID generation", () => {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  beforeEach(() => {
    setCheckoutRepository({
      create: async (session: any) => session,
      findById: async () => null,
      updateSession: async () => ({}),
    } as any);
  });

  it("creates checkout session ids using UUID v4", async () => {
    const session = await CheckoutSessionService.createSession({
      payment: { amount: 1000, currency: "USD", paymentMethod: "credit_card" },
      customer: { customerId: "customer-123", email: "user@example.com" },
    });

    expect(typeof session.id).toBe("string");
    expect(uuidV4Regex.test(session.id)).toBe(true);
  });

  it("does not use the old Math.random UUID helper in app.ts stubs", () => {
    const appSource = fs.readFileSync(new URL("../app.ts", import.meta.url), "utf8");

    expect(appSource).not.toMatch(/Math\.random\(|generateUUID\(/);
  });

  it("attests that services/checkout.ts uses secure UUID generation", () => {
    const checkoutSource = fs.readFileSync(new URL("../services/checkout.ts", import.meta.url), "utf8");

    expect(checkoutSource).toMatch(/import\s*\{[^}]*randomUUID[^}]*\}\s*from\s*["']crypto["']/);
    expect(checkoutSource).not.toMatch(/Math\.random\(/);
  });
});
