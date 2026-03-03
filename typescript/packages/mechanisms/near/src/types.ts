/**
 * Payload shape used by x402 `exact` payments on NEAR.
 */
export type ExactNearPayload = {
  signedDelegateAction: string;
};

/**
 * Decoded NEP-141 transfer arguments from function-call bytes.
 */
export type NearFtTransferArgs = {
  receiver_id: string;
  amount: string;
  memo?: string;
};

/**
 * NEAR public key representation used in delegate actions.
 */
export interface PublicKey {
  keyType: number;
  data: Uint8Array;
}

/**
 * NEAR signature representation used in signed delegate actions.
 */
export interface Signature {
  keyType: number;
  data: Uint8Array;
}

/**
 * FunctionCall action payload.
 */
export interface FunctionCallAction {
  methodName: string;
  args: Uint8Array;
  gas: bigint;
  deposit: bigint;
}

/**
 * Transfer action payload.
 */
export interface TransferAction {
  deposit: bigint;
}

/**
 * Supported action variants while decoding NEAR delegate actions.
 */
export type Action =
  | { kind: "FunctionCall"; data: FunctionCallAction }
  | { kind: "Transfer"; data: TransferAction }
  | { kind: "Unsupported"; tag: number };

/**
 * Delegate action body signed by the client.
 */
export interface DelegateAction {
  sender_id: string;
  receiver_id: string;
  actions: Action[];
  nonce: bigint;
  max_block_height: bigint;
  public_key: PublicKey;
}

/**
 * Full signed delegate action transmitted in `PaymentPayload.payload`.
 */
export interface SignedDelegateAction {
  delegate_action: DelegateAction;
  signature: Signature;
}
