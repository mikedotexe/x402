/**
 * x402 – NEAR verifier (Skeleton)
 * TODO:
 *  - decode x402 header
 *  - ed25519 verify
 *  - RPC view_access_key (FullAccess)
 *  - (NEP-366 path) Borsh decode SignedDelegateAction
 */

export type NearNetwork = "near-mainnet" | "near-testnet";

export interface VerifyNearOptions {
  expectedRecipient?: string;
  expectedNonceB64?: string;
  rpcUrl?: string;
  finality?: "final" | "optimistic";
  allowFunctionCallKey?: boolean;
}

export type VerifyNearResult =
  | { ok: true; accountId: string; network: NearNetwork; publicKey: string; isFullAccess: boolean }
  | { ok: false; code: "FORMAT" | "SIG_INVALID" | "RPC_ERROR" | "KEY_NOT_FOUND" | "PERMISSION_MISMATCH"; reason: string };

export async function verifyNearHeader(headerString: string, _opts: VerifyNearOptions = {}): Promise<VerifyNearResult> {
  // TODO: implement real verification
  if (!headerString?.startsWith("x402:")) {
    return { ok: false, code: "FORMAT", reason: "missing x402 prefix" };
  }
  return { ok: true, accountId: "todo.testnet", network: "near-testnet", publicKey: "ed25519:TODO", isFullAccess: true };
}
