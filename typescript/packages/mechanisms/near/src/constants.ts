/**
 * CAIP-style network identifiers supported by the NEAR mechanism.
 */
export const NEAR_MAINNET_CAIP2 = "near:mainnet";
export const NEAR_TESTNET_CAIP2 = "near:testnet";

/**
 * List of canonical NEAR network identifiers.
 */
export const NEAR_NETWORKS = [NEAR_MAINNET_CAIP2, NEAR_TESTNET_CAIP2] as const;

/**
 * Default RPC endpoints for canonical NEAR networks.
 */
export const NEAR_RPC_URLS: Record<(typeof NEAR_NETWORKS)[number], string> = {
  [NEAR_MAINNET_CAIP2]: "https://rpc.mainnet.near.org",
  [NEAR_TESTNET_CAIP2]: "https://rpc.testnet.near.org",
};

/**
 * NEP-141 transfer method name.
 */
export const FT_TRANSFER_METHOD = "ft_transfer";

/**
 * NEP-141 requires exactly 1 yoctoNEAR attached to ft_transfer.
 */
export const ONE_YOCTO = 1n;

/**
 * Default gas for ft_transfer in yocto-gas units.
 */
export const DEFAULT_FT_TRANSFER_GAS = 30_000_000_000_000n;

/**
 * Conservative cap for sponsored gas to protect relayers.
 */
export const DEFAULT_MAX_SPONSORED_GAS = 100_000_000_000_000n;

/**
 * Default decimal precision used for money conversion in server parsePrice.
 */
export const DEFAULT_TOKEN_DECIMALS = 6;

/**
 * Default token contract fallback for simple money inputs.
 */
export const DEFAULT_ASSET_BY_NETWORK: Record<(typeof NEAR_NETWORKS)[number], string> = {
  [NEAR_MAINNET_CAIP2]: "usdc.near",
  [NEAR_TESTNET_CAIP2]: "usdc.testnet",
};

/**
 * Checks whether a network belongs to the NEAR CAIP family.
 *
 * @param network - The network identifier
 * @returns True when network uses the `near:` prefix
 */
export function isNearNetwork(network: string): boolean {
  return network.startsWith("near:");
}
