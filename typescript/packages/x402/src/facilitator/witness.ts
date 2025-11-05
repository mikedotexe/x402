/**
 * EVM witness verification for TypeScript facilitators
 *
 * Verifies optional EIP-191 witnesses that bind payments to specific resources.
 * This is the TypeScript port of the Rust implementation in crates/x402-witness-verify.
 */

import { keccak256, verifyMessage } from "ethers";

/**
 * EVM witness structure (EIP-191 personal_sign)
 */
export interface EvmWitness {
  type: "eip191";
  algo: "keccak256";
  address: string; // Payer address (0x...)
  resource: string; // Canonical resource URL
  digest: string; // 0x-prefixed keccak256 hash
  signature: string; // 0x-prefixed 65-byte signature
}

/**
 * Witness verification result
 */
export enum WitnessCheck {
  Ok = "ok",
  Skipped = "skipped",
  Invalid = "invalid",
}

export interface WitnessCheckResult {
  status: WitnessCheck;
  reason?: string;
}

/**
 * Canonicalizes a resource URL using the same rules as the Rust implementation
 *
 * Rules:
 * 1. Remove fragment (#...)
 * 2. Remove credentials (user:pass@)
 * 3. Remove default ports (443 for https, 80 for http)
 * 4. Lowercase host
 *
 * @param urlString - Resource URL to canonicalize
 * @returns Canonical URL string
 */
export function canonicalizeResource(urlString: string): string {
  try {
    const url = new URL(urlString);

    // Remove fragment
    url.hash = "";

    // Remove credentials
    url.username = "";
    url.password = "";

    // Remove default ports
    if (
      (url.protocol === "https:" && url.port === "443") ||
      (url.protocol === "http:" && url.port === "80")
    ) {
      url.port = "";
    }

    // URL.toString() already lowercases host
    return url.toString();
  } catch {
    throw new Error("invalid_url");
  }
}

/**
 * Computes the digest for a resource
 *
 * @param canonicalResource - Canonicalized resource URL
 * @returns 0x-prefixed hex digest
 */
function computeResourceDigest(canonicalResource: string): string {
  const message = `x402:resource:${canonicalResource}`;
  return keccak256(Buffer.from(message, "utf8"));
}

/**
 * Verifies an EVM witness
 *
 * @param witness - EVM witness to verify
 * @returns void on success, throws on failure
 */
export function verifyEvmWitness(witness: EvmWitness): void {
  // Check type
  if (witness.type.toLowerCase() !== "eip191") {
    throw new Error("invalid_witness_type");
  }

  // Check algo
  if (witness.algo.toLowerCase() !== "keccak256") {
    throw new Error("invalid_witness_algo");
  }

  // Canonicalize resource and recompute digest
  const canonical = canonicalizeResource(witness.resource);
  const expectedDigest = computeResourceDigest(canonical);

  if (expectedDigest.toLowerCase() !== witness.digest.toLowerCase()) {
    throw new Error("digest_mismatch");
  }

  // Verify signature using ethers verifyMessage
  // verifyMessage handles the Ethereum Signed Message prefix automatically
  try {
    const recoveredAddress = verifyMessage(witness.digest, witness.signature);

    if (recoveredAddress.toLowerCase() !== witness.address.toLowerCase()) {
      throw new Error("address_mismatch");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "address_mismatch") {
      throw error;
    }
    throw new Error("invalid_signature");
  }
}

/**
 * Checks optional witness from a base64-encoded payment header
 *
 * @param headerBase64 - Base64-encoded payment header
 * @returns Witness check result
 */
export function checkOptionalWitnessFromHeaderB64(
  headerBase64: string
): WitnessCheckResult {
  try {
    // Decode base64
    const jsonString = Buffer.from(headerBase64, "base64").toString("utf8");

    // Parse header
    const header = JSON.parse(jsonString);

    // Check if witness exists
    if (!header.payload?.witness) {
      return { status: WitnessCheck.Skipped };
    }

    // Verify witness
    verifyEvmWitness(header.payload.witness);

    return { status: WitnessCheck.Ok };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_error";
    return { status: WitnessCheck.Invalid, reason };
  }
}

/**
 * Checks optional witness with environment-based enforcement
 *
 * @param headerBase64 - Base64-encoded payment header
 * @param required - Whether witness is required (default: false)
 * @returns void on success, throws on failure
 *
 * @example
 * ```typescript
 * // In facilitator /verify handler:
 * const witnessRequired = process.env.WITNESS_REQUIRED === "true";
 * checkWitness(paymentHeader, witnessRequired);
 * ```
 */
export function checkWitness(
  headerBase64: string,
  required: boolean = false
): void {
  const result = checkOptionalWitnessFromHeaderB64(headerBase64);

  switch (result.status) {
    case WitnessCheck.Ok:
      // Success
      return;

    case WitnessCheck.Skipped:
      if (required) {
        throw new Error("witness_required");
      }
      // Optional and not present - OK
      return;

    case WitnessCheck.Invalid:
      throw new Error(`invalid_witness: ${result.reason}`);
  }
}
