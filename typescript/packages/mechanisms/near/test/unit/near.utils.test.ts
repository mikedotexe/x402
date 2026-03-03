import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { decodeSignedDelegateActionB64, prettySignedDelegateAction } from "../../src/utils";
import { signDelegateActionB64 } from "./fixtures/near.fixture";

describe("near utils", () => {
  it("round-trips signed delegate actions", () => {
    const privateKey = ed25519.utils.randomSecretKey();
    const { signedDelegateAction, publicKey32 } = signDelegateActionB64({
      sender_id: "alice.testnet",
      ft_contract: "usdc.testnet",
      receiver_id_in_args: "merchant.testnet",
      amount: "1000000",
      nonce: 42n,
      max_block_height: 9_999_999n,
      privateKey32: privateKey,
      memo: "x402 payment",
    });

    const decoded = decodeSignedDelegateActionB64(signedDelegateAction);
    expect(decoded.delegate_action.public_key.data).toEqual(publicKey32);

    const summary = prettySignedDelegateAction(decoded);
    expect(summary.actions).toEqual(["FunctionCall"]);
    expect(summary.functionCall?.methodName).toBe("ft_transfer");
    expect(summary.functionCall?.deposit).toBe("1");
  });
});
