import { describe, expect, it, vi } from "vitest";
import type { PaymentRequirements } from "@x402/core/types";
import { ExactNearScheme } from "../../src/exact/client/scheme";

describe("near client scheme", () => {
  it("creates a payload using the signer callback", async () => {
    const signer = {
      createSignedDelegateAction: vi.fn().mockResolvedValue("signed-action-b64"),
    };

    const scheme = new ExactNearScheme(signer);

    const requirements: PaymentRequirements = {
      scheme: "exact",
      network: "near:testnet",
      amount: "1000000",
      asset: "usdc.testnet",
      payTo: "merchant.testnet",
      maxTimeoutSeconds: 60,
      extra: { relayerId: "facilitator.testnet" },
    };

    const result = await scheme.createPaymentPayload(2, requirements);

    expect(result.x402Version).toBe(2);
    expect(result.payload).toEqual({ signedDelegateAction: "signed-action-b64" });
    expect(signer.createSignedDelegateAction).toHaveBeenCalledWith({
      x402Version: 2,
      paymentRequirements: requirements,
    });
  });
});
