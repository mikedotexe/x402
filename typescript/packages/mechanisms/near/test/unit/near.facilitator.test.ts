import { describe, expect, it, vi } from "vitest";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { ExactNearScheme } from "../../src/exact/facilitator/scheme";
import { signDelegateActionB64 } from "./fixtures/near.fixture";

const NOW = 1000n;

function makeRequirements(amount = "1000000"): PaymentRequirements {
  return {
    scheme: "exact",
    network: "near:testnet",
    amount,
    asset: "usdc.testnet",
    payTo: "merchant.testnet",
    maxTimeoutSeconds: 60,
    extra: {
      relayerId: "facilitator.testnet",
    },
  };
}

function makePayload(requirements: PaymentRequirements, signedDelegateAction: string): PaymentPayload {
  return {
    x402Version: 2,
    resource: {
      url: "https://example.com/weather",
      description: "Weather data",
      mimeType: "application/json",
    },
    accepted: requirements,
    payload: {
      signedDelegateAction,
    },
  };
}

describe("near facilitator scheme", () => {
  it("verifies a valid near exact payload", async () => {
    const requirements = makeRequirements();

    const { signedDelegateAction } = signDelegateActionB64({
      sender_id: "alice.testnet",
      ft_contract: requirements.asset,
      receiver_id_in_args: requirements.payTo,
      amount: requirements.amount,
      nonce: 7n,
      max_block_height: 10_000n,
      privateKey32: new Uint8Array(32).fill(1),
      memo: null,
    });

    const signer = {
      getRelayerIds: vi.fn().mockReturnValue(["facilitator.testnet"]),
      getCurrentBlockHeight: vi.fn().mockResolvedValue(NOW),
      submitSignedDelegateAction: vi.fn().mockResolvedValue({ transaction: "tx-hash" }),
      isDelegateNonceUsed: vi.fn().mockResolvedValue(false),
    };

    const scheme = new ExactNearScheme(signer);
    const verify = await scheme.verify(makePayload(requirements, signedDelegateAction), requirements);

    expect(verify.isValid).toBe(true);
    expect(verify.payer).toBe("alice.testnet");
  });

  it("rejects mismatched transfer amount", async () => {
    const requirements = makeRequirements("1000000");

    const { signedDelegateAction } = signDelegateActionB64({
      sender_id: "alice.testnet",
      ft_contract: requirements.asset,
      receiver_id_in_args: requirements.payTo,
      amount: "999999",
      nonce: 8n,
      max_block_height: 10_000n,
      privateKey32: new Uint8Array(32).fill(2),
      memo: null,
    });

    const signer = {
      getRelayerIds: vi.fn().mockReturnValue(["facilitator.testnet"]),
      getCurrentBlockHeight: vi.fn().mockResolvedValue(NOW),
      submitSignedDelegateAction: vi.fn().mockResolvedValue({ transaction: "tx-hash" }),
      isDelegateNonceUsed: vi.fn().mockResolvedValue(false),
    };

    const scheme = new ExactNearScheme(signer);
    const verify = await scheme.verify(makePayload(requirements, signedDelegateAction), requirements);

    expect(verify.isValid).toBe(false);
    expect(verify.invalidReason).toBe("transfer_amount_mismatch");
  });

  it("returns deterministic failure response in settle when verification fails", async () => {
    const requirements = makeRequirements();
    const signer = {
      getRelayerIds: vi.fn().mockReturnValue(["facilitator.testnet"]),
      getCurrentBlockHeight: vi.fn().mockResolvedValue(NOW),
      submitSignedDelegateAction: vi.fn(),
      isDelegateNonceUsed: vi.fn().mockResolvedValue(false),
    };

    const scheme = new ExactNearScheme(signer);
    const settle = await scheme.settle(
      {
        x402Version: 2,
        accepted: requirements,
        payload: { signedDelegateAction: "not-a-valid-payload" },
      },
      requirements,
    );

    expect(settle.success).toBe(false);
    expect(settle.transaction).toBe("");
    expect(settle.errorReason).toBeDefined();
    expect(signer.submitSignedDelegateAction).not.toHaveBeenCalled();
  });
});
