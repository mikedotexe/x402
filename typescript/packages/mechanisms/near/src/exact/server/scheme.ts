import type {
  AssetAmount,
  Money,
  MoneyParser,
  Network,
  PaymentRequirements,
  Price,
  SchemeNetworkServer,
} from "@x402/core/types";
import { DEFAULT_ASSET_BY_NETWORK, DEFAULT_TOKEN_DECIMALS, isNearNetwork } from "../../constants";

/**
 * Server-side NEAR exact-scheme implementation.
 */
export class ExactNearScheme implements SchemeNetworkServer {
  readonly scheme = "exact";
  private readonly moneyParsers: MoneyParser[] = [];

  /**
   * Registers a custom money parser in front of default conversion.
   *
   * @param parser - Parser that can return an AssetAmount or null to continue chain
   * @returns Scheme instance for chaining
   */
  registerMoneyParser(parser: MoneyParser): ExactNearScheme {
    this.moneyParsers.push(parser);
    return this;
  }

  /**
   * Converts a configured route price to amount/asset for NEAR.
   *
   * @param price - Price configuration
   * @param network - Target network
   * @returns Parsed asset amount
   */
  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    if (!isNearNetwork(network)) {
      throw new Error(`Unsupported NEAR network: ${network}`);
    }

    if (typeof price === "object" && price !== null && "amount" in price) {
      if (!price.asset) {
        throw new Error("Asset is required when specifying amount explicitly");
      }
      return {
        amount: price.amount,
        asset: price.asset,
        extra: price.extra || {},
      };
    }

    const decimal = this.parseMoneyToDecimal(price as Money);

    for (const parser of this.moneyParsers) {
      const parsed = await parser(decimal, network);
      if (parsed !== null) {
        return parsed;
      }
    }

    const tokenAmount = this.convertToAtomic(decimal.toString(), DEFAULT_TOKEN_DECIMALS);
    const asset = this.defaultAssetForNetwork(network);

    return {
      amount: tokenAmount,
      asset,
      extra: {},
    };
  }

  /**
   * Adds relayer metadata from facilitator supported kind to requirements.
   *
   * @param paymentRequirements - Base requirements
   * @param supportedKind - Matching supported kind
   * @param extensionKeys - Facilitator extension keys (unused)
   * @returns Enhanced requirements
   */
  enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      x402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    extensionKeys: string[],
  ): Promise<PaymentRequirements> {
    void extensionKeys;

    const extra: Record<string, unknown> = { ...paymentRequirements.extra };
    if (typeof supportedKind.extra?.relayerId === "string") {
      extra.relayerId = supportedKind.extra.relayerId;
    }

    return Promise.resolve({
      ...paymentRequirements,
      extra,
    });
  }

  /**
   * Parses money-like value into decimal number.
   *
   * @param money - Money value
   * @returns Decimal amount
   */
  private parseMoneyToDecimal(money: Money): number {
    if (typeof money === "number") {
      return money;
    }

    const clean = money.replace(/^\$/, "").trim();
    const value = parseFloat(clean);
    if (Number.isNaN(value)) {
      throw new Error(`Invalid money format: ${money}`);
    }

    return value;
  }

  /**
   * Converts decimal string to atomic amount string.
   *
   * @param amount - Decimal amount string
   * @param decimals - Token decimals
   * @returns Atomic amount string
   */
  private convertToAtomic(amount: string, decimals: number): string {
    const parts = amount.split(".");
    const whole = parts[0] || "0";
    const fraction = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
    return BigInt(whole + fraction).toString();
  }

  /**
   * Resolves default asset for known NEAR networks.
   *
   * @param network - Network identifier
   * @returns Default NEP-141 asset id
   */
  private defaultAssetForNetwork(network: Network): string {
    if (network === "near:mainnet") {
      return DEFAULT_ASSET_BY_NETWORK["near:mainnet"];
    }
    if (network === "near:testnet") {
      return DEFAULT_ASSET_BY_NETWORK["near:testnet"];
    }
    throw new Error(`No default NEAR asset configured for network: ${network}`);
  }
}
