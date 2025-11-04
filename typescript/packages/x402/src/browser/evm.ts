
// Minimal browser helper for EVM using viem + window.ethereum (EIP-1193)
import { createWalletClient, custom } from "viem";
import type { Address } from "viem";
// Assuming these internal paths exist in the x402 project
import { createPaymentHeader } from "../client/createPaymentHeader";
import type { PaymentRequirements } from "../types/verify";
import type { X402Config } from "../types/config";
import type { Network } from "../types/shared";

/**
 * Use PaymentRequirements from your paywall server as-is.
 * IMPORTANT: This must come from the merchant/paywall; do not mint it client-side in production.
 */
export async function createPaymentHeaderFromWindowEvm(
  paymentRequirements: PaymentRequirements,
  config?: X402Config
): Promise<string> {
  const eth: any = (globalThis as any).ethereum;
  if (!eth) throw new Error("No EIP-1193 provider (window.ethereum) present.");
  await eth.request?.({ method: "eth_requestAccounts" });

  // Wrap injected provider with viem
  const wallet = createWalletClient({
    // NOTE: the network/chain is inferred inside x402 during header creation;
    // your PaymentRequirements.network drives correctness.
    transport: custom(eth),
  });

  // X402 v1 for now
  return createPaymentHeader(wallet as any, 1, paymentRequirements, config);
}

/**
 * Developer-only sugar for quick demos. Requires explicit payee and amount.
 * In production, always fetch PaymentRequirements from your server.
 */
export async function quickPay(opts: {
  payTo: Address;              // merchant/payee address (REQUIRED)
  maxAmountRequired: string;   // wei as a string (REQUIRED)
  network: Network;            // e.g. "base" | "base-sepolia" | ...
  asset?: string;              // ERC-20 address OR leave undefined for native
  resource?: string;           // default: window.location.href
  description?: string;        // default: document.title || "x402 payment"
  mimeType?: string;           // default: "text/plain"
  maxTimeoutSeconds?: number;  // default: 300
}): Promise<string> {
  const {
    payTo,
    maxAmountRequired,
    network,
    asset,
    resource = (typeof window !== "undefined" ? window.location.href : "about:blank"),
    description = (typeof document !== "undefined" ? document.title : "x402 payment"),
    mimeType = "text/plain",
    maxTimeoutSeconds = 300,
  } = opts;

  const paymentRequirements: PaymentRequirements = {
    scheme: "exact",
    network,
    maxAmountRequired,
    resource,
    description,
    mimeType,
    payTo,
    maxTimeoutSeconds,
    // For EVM exact scheme, asset is the token address;
    // native transfers typically omit or use a sentinel on the server side.
    asset: asset ?? "0x0000000000000000000000000000000000000000",
  };

  return createPaymentHeaderFromWindowEvm(paymentRequirements);
}
