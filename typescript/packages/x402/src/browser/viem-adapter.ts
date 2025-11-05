/**
 * Viem adapter for browser wallets (MetaMask, Coinbase Wallet, etc.)
 *
 * Converts EIP-1193 providers (window.ethereum) to viem WalletClient
 * for use with x402 payment creation APIs.
 */

import { createWalletClient, custom, type WalletClient, type Chain } from "viem";
import { base, baseSepolia, mainnet, sepolia } from "viem/chains";

/**
 * EIP-1193 Provider interface (window.ethereum)
 */
export interface EIP1193Provider {
  request(args: { method: string; params?: any[] }): Promise<any>;
  on?(event: string, handler: (...args: any[]) => void): void;
  removeListener?(event: string, handler: (...args: any[]) => void): void;
}

/**
 * Supported chain configurations
 */
const CHAIN_MAP: Record<number, Chain> = {
  // Ethereum
  1: mainnet,
  11155111: sepolia,

  // Base
  8453: base,
  84532: baseSepolia,
};

/**
 * Creates a viem WalletClient from an EIP-1193 provider
 *
 * @param provider - EIP-1193 provider (e.g., window.ethereum)
 * @param chainId - Chain ID to connect to
 * @returns Viem WalletClient ready for x402 payment operations
 *
 * @example
 * ```typescript
 * const client = createViemClientFromProvider(window.ethereum, 84532);
 * const header = await createPaymentHeader(client, 1, paymentRequirements);
 * ```
 */
export function createViemClientFromProvider(
  provider: EIP1193Provider,
  chainId: number
): WalletClient {
  const chain = CHAIN_MAP[chainId];

  if (!chain) {
    throw new Error(
      `Unsupported chain ID: ${chainId}. Supported: ${Object.keys(CHAIN_MAP).join(", ")}`
    );
  }

  return createWalletClient({
    chain,
    transport: custom(provider),
  });
}

/**
 * Gets the current chain ID from the provider
 *
 * @param provider - EIP-1193 provider
 * @returns Current chain ID as number
 */
export async function getProviderChainId(provider: EIP1193Provider): Promise<number> {
  const chainIdHex = await provider.request({ method: "eth_chainId" });
  return parseInt(chainIdHex, 16);
}

/**
 * Gets connected accounts from the provider
 *
 * @param provider - EIP-1193 provider
 * @returns Array of connected account addresses
 */
export async function getProviderAccounts(provider: EIP1193Provider): Promise<string[]> {
  return provider.request({ method: "eth_accounts" });
}
