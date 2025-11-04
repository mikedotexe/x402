import { ed25519 } from "@noble/curves/ed25519";
import {
  buildDelegateActionExact,
  encodeDelegateAction,
  encodeSignedDelegateActionB64,
  SignedDelegateAction
} from "../src/facilitator/near/borsh";

/** Sign DelegateAction bytes with ed25519 private key (32-byte seed) */
export function signDelegateActionB64(params: {
  sender_id: string;
  ft_contract: string;
  receiver_id_in_args: string;
  amount: string;
  nonce: bigint;
  max_block_height: bigint;
  privKey32: Uint8Array;  // 32-byte ed25519 private key
  memo?: string | null;
}): { sda_b64: string; pubkey32: Uint8Array } {
  const pubkey32 = ed25519.getPublicKey(params.privKey32);
  const d = buildDelegateActionExact({
    sender_id: params.sender_id,
    ft_contract: params.ft_contract,
    pubkey32,
    nonce: params.nonce,
    max_block_height: params.max_block_height,
    receiver_id_in_args: params.receiver_id_in_args,
    amount: params.amount,
    memo: params.memo ?? null
  });
  const msg = encodeDelegateAction(d);               // sign raw DelegateAction bytes
  const sig = ed25519.sign(msg, params.privKey32);   // 64 bytes
  const sda: SignedDelegateAction = {
    delegate_action: d,
    signature: { keyType: 0, data: sig }
  };
  return { sda_b64: encodeSignedDelegateActionB64(sda), pubkey32 };
}
