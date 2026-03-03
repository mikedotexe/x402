/**
 * Input passed to client-side signer for creating a signed delegate action.
 */
export type NearSignedDelegateInput = {
  x402Version: number;
  paymentRequirements: {
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra: Record<string, unknown>;
  };
};

/**
 * Minimal client signer abstraction for NEAR exact payments.
 */
export type ClientNearSigner = {
  /**
   * Create a base64-encoded Borsh SignedDelegateAction for the selected requirement.
   */
  createSignedDelegateAction(input: NearSignedDelegateInput): Promise<string>;
};

/**
 * Minimal facilitator signer abstraction for relayer-sponsored settlement.
 */
export type FacilitatorNearSigner = {
  /**
   * Managed relayer account IDs.
   */
  getRelayerIds(): readonly string[];

  /**
   * Current block height for replay/expiry checks.
   */
  getCurrentBlockHeight(network: string): Promise<bigint>;

  /**
   * Optional nonce replay check.
   */
  isDelegateNonceUsed?(input: {
    senderId: string;
    publicKey: Uint8Array;
    nonce: bigint;
    network: string;
  }): Promise<boolean>;

  /**
   * Submit delegate action as relayer.
   */
  submitSignedDelegateAction(input: {
    network: string;
    relayerId: string;
    signedDelegateAction: string;
  }): Promise<{ transaction: string }>;
};
