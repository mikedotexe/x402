/**
 * x402 – NEAR browser wrapper (Skeleton)
 * - NEP-413 header signing (client auth)
 * - Canonical payload builder
 *
 * NOTE: This is a compiling stub. Replace TODO blocks with real logic.
 */

export type NearNetwork = "near-mainnet" | "near-testnet";

export interface NearCanonicalPayload {
  v: number;
  scheme: "exact";
  network: NearNetwork;
  resource: string;
  payTo: string; // merchant accountId
  asset: { standard: "native" } | { standard: "nep141"; contractId: string };
  amount: string; // yoctoNEAR or FT base units
  description?: string;
  mimeType?: string;
  validUntil?: number;
}

export interface NearWalletLike {
  signMessage(input: {
    message: Uint8Array;
    recipient: string;
    nonce: Uint8Array;
    callbackUrl?: string;
  }): Promise<{
    accountId: string;
    publicKey: string;            // "ed25519:<base58>"
    signature: Uint8Array | string;
  }>;
}

export interface NearNep413Header {
  kind: "near/nep413";
  version: 1;
  network: NearNetwork;
  accountId: string;
  publicKey: string;
  recipient: string;
  nonce_b64: string;
  message_b64: string;
  signature_b64: string;
}

// ---- public API (stubs) -----------------------------------------------------

export function buildCanonicalMessageBytes(payload: NearCanonicalPayload): Uint8Array {
  // TODO: replace with deterministic key-sorted JSON bytes
  const enc = new TextEncoder();
  return enc.encode(JSON.stringify(payload));
}

export async function createNearPaymentHeaderWithWallet(
  _wallet: NearWalletLike,
  _opts: {
    network: NearNetwork;
    recipient: string;
    nonce32: Uint8Array;
    payload: Uint8Array;
    callbackUrl?: string;
  }
): Promise<string> {
  // TODO: call wallet.signMessage, normalize signature, encode header
  // Returning a placeholder header keeps the build green.
  const placeholder: NearNep413Header = {
    kind: "near/nep413",
    version: 1,
    network: _opts.network,
    accountId: "todo.testnet",
    publicKey: "ed25519:TODO",
    recipient: _opts.recipient,
    nonce_b64: "TODO",
    message_b64: "TODO",
    signature_b64: "TODO"
  };
  return encodeX402HeaderNear(placeholder);
}

export async function quickNearHeader(
  _wallet: NearWalletLike,
  _p: {
    network: NearNetwork;
    recipient: string;
    nonce32: Uint8Array;
    resource: string;
    payTo: string;
    amount: string;
    asset: NearCanonicalPayload["asset"];
    description?: string;
    mimeType?: string;
    validUntil?: number;
  }
): Promise<string> {
  // TODO: build payload -> createNearPaymentHeaderWithWallet
  return encodeX402HeaderNear({
    kind: "near/nep413",
    version: 1,
    network: _p.network,
    accountId: "todo.testnet",
    publicKey: "ed25519:TODO",
    recipient: _p.recipient,
    nonce_b64: "TODO",
    message_b64: "TODO",
    signature_b64: "TODO"
  });
}

// ---- utils (minimal, OK for skeleton) ---------------------------------------

export function encodeX402HeaderNear(h: NearNep413Header): string {
  const bytes = new TextEncoder().encode(JSON.stringify(h));
  const b64 = toBase64(bytes);
  const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `x402:${b64url}`;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  // @ts-ignore
  return btoa(s);
}
