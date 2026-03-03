import { ed25519 } from "@noble/curves/ed25519.js";
import {
  buildDelegateActionExact,
  encodeDelegateAction,
  encodeSignedDelegateActionB64,
} from "../../../src/utils";
import type { SignedDelegateAction } from "../../../src/types";

/**
 * Builds a signed delegate action fixture encoded as base64.
 *
 * @param params - Fixture parameters
 * @returns Base64 payload and signer public key bytes
 */
export function signDelegateActionB64(params: {
  sender_id: string;
  ft_contract: string;
  receiver_id_in_args: string;
  amount: string;
  nonce: bigint;
  max_block_height: bigint;
  privateKey32: Uint8Array;
  memo?: string | null;
}): { signedDelegateAction: string; publicKey32: Uint8Array } {
  const publicKey32 = ed25519.getPublicKey(params.privateKey32);
  const delegateAction = buildDelegateActionExact({
    sender_id: params.sender_id,
    ft_contract: params.ft_contract,
    receiver_id_in_args: params.receiver_id_in_args,
    amount: params.amount,
    nonce: params.nonce,
    max_block_height: params.max_block_height,
    public_key_32: publicKey32,
    memo: params.memo ?? null,
  });

  const message = encodeDelegateAction(delegateAction);
  const signature = ed25519.sign(message, params.privateKey32);

  const signed: SignedDelegateAction = {
    delegate_action: delegateAction,
    signature: {
      keyType: 0,
      data: signature,
    },
  };

  return {
    signedDelegateAction: encodeSignedDelegateActionB64(signed),
    publicKey32,
  };
}
