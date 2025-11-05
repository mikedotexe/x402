/**
 * EIP-191 witness binding for x402
 *
 * Witnesses bind a payment to a specific resource URL using personal_sign.
 * This provides resource integrity without modifying the EIP-3009 authorization.
 *
 * Flow:
 * 1. Canonicalize resource URL (same rules as server)
 * 2. Compute digest = keccak256("x402:resource:<canonical-url>")
 * 3. Sign digest with personal_sign (EIP-191)
 * 4. Attach witness to payment header as payload.witness
 *
 * Server verification:
 * - Recompute digest from canonical URL
 * - Recover address from signature
 * - Verify address matches payer
 */

import type { EIP1193Provider } from "./viem-adapter";

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
 * Canonicalizes a resource URL using the same rules as the server
 *
 * Rules:
 * 1. Remove fragment (#...)
 * 2. Remove credentials (user:pass@)
 * 3. Remove default ports (443 for https, 80 for http)
 * 4. Lowercase host
 *
 * @param urlString - Resource URL to canonicalize
 * @returns Canonical URL string
 *
 * @example
 * ```typescript
 * canonicalizeResource("https://Example.com:443/path?q=1#frag")
 * // Returns: "https://example.com/path?q=1"
 * ```
 */
export function canonicalizeResource(urlString: string): string {
  // Parse URL (throws if invalid)
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
}

/**
 * Computes keccak256 digest for a resource
 *
 * @param canonicalResource - Canonicalized resource URL
 * @returns 0x-prefixed hex digest
 */
function computeResourceDigest(canonicalResource: string): string {
  // Use ethers.js for keccak256 if available in browser
  // Otherwise, this will be provided by the ethers CDN
  const { keccak256, toUtf8Bytes } = (globalThis as any).ethers || {};

  if (!keccak256 || !toUtf8Bytes) {
    throw new Error(
      "ethers.js not found. Include ethers CDN: https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js"
    );
  }

  const message = `x402:resource:${canonicalResource}`;
  return keccak256(toUtf8Bytes(message));
}

/**
 * Creates an EVM witness binding a payment to a resource
 *
 * @param provider - EIP-1193 provider (window.ethereum)
 * @param address - Payer address
 * @param resource - Resource URL to bind
 * @returns EVM witness object
 *
 * @example
 * ```typescript
 * const witness = await makeEvmWitness(
 *   window.ethereum,
 *   "0x123...",
 *   "https://api.example.com/protected"
 * );
 *
 * // Attach to payment header:
 * const headerWithWitness = addWitnessToPaymentHeader(header, witness);
 * ```
 */
export async function makeEvmWitness(
  provider: EIP1193Provider,
  address: string,
  resource: string
): Promise<EvmWitness> {
  // Canonicalize resource (same algorithm as server)
  const canonical = canonicalizeResource(resource);

  // Compute digest = keccak256("x402:resource:<canonical>")
  const digest = computeResourceDigest(canonical);

  // Sign digest with personal_sign (EIP-191)
  // MetaMask adds "\x19Ethereum Signed Message:\n32" prefix automatically
  const signature = await provider.request({
    method: "personal_sign",
    params: [digest, address],
  });

  return {
    type: "eip191",
    algo: "keccak256",
    address: address.toLowerCase(),
    resource: canonical,
    digest,
    signature,
  };
}

/**
 * Adds a witness to a base64-encoded payment header
 *
 * @param headerBase64 - Base64-encoded payment header
 * @param witness - EVM witness to attach
 * @returns New base64-encoded header with witness
 *
 * @example
 * ```typescript
 * const header = await createPaymentHeader(...);
 * const witness = await makeEvmWitness(...);
 * const headerWithWitness = addWitnessToPaymentHeader(header, witness);
 * ```
 */
export function addWitnessToPaymentHeader(
  headerBase64: string,
  witness: EvmWitness
): string {
  // Decode base64 -> JSON
  const jsonString = atob(headerBase64);
  const header = JSON.parse(jsonString);

  // Ensure payload exists
  if (!header.payload) {
    header.payload = {};
  }

  // Attach witness
  header.payload.witness = witness;

  // Re-encode to base64
  return btoa(JSON.stringify(header));
}

/**
 * Extracts witness from a base64-encoded payment header (if present)
 *
 * @param headerBase64 - Base64-encoded payment header
 * @returns Witness object or null if not present
 */
export function extractWitnessFromPaymentHeader(
  headerBase64: string
): EvmWitness | null {
  try {
    const jsonString = atob(headerBase64);
    const header = JSON.parse(jsonString);
    return header.payload?.witness || null;
  } catch {
    return null;
  }
}
