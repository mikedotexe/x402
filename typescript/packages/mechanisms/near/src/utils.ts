import { DEFAULT_FT_TRANSFER_GAS, FT_TRANSFER_METHOD, ONE_YOCTO } from "./constants";
import type { Action, DelegateAction, NearFtTransferArgs, PublicKey, Signature, SignedDelegateAction } from "./types";

const ACTION_TAGS = {
  FunctionCall: 2,
  Transfer: 3,
} as const;

/**
 * Borsh reader for decoding NEAR delegate-action payloads.
 */
class Reader {
  private offset = 0;

  /**
   * Creates a reader over bytes.
   *
   * @param bytes - Source bytes
   */
  constructor(private readonly bytes: Uint8Array) {}

  /**
   * Returns true when no bytes remain.
   *
   * @returns Whether reader has consumed all bytes
   */
  eof(): boolean {
    return this.offset >= this.bytes.length;
  }

  /**
   * Reads an unsigned 8-bit integer.
   *
   * @returns The decoded value
   */
  u8(): number {
    const value = this.bytes[this.offset];
    this.offset += 1;
    return value;
  }

  /**
   * Reads an unsigned 32-bit integer (little-endian).
   *
   * @returns The decoded value
   */
  u32(): number {
    const value =
      this.bytes[this.offset] |
      (this.bytes[this.offset + 1] << 8) |
      (this.bytes[this.offset + 2] << 16) |
      (this.bytes[this.offset + 3] << 24);
    this.offset += 4;
    return value >>> 0;
  }

  /**
   * Reads an unsigned 64-bit integer (little-endian).
   *
   * @returns The decoded bigint
   */
  u64(): bigint {
    let low = 0n;
    let high = 0n;
    for (let i = 0; i < 4; i++) {
      low |= BigInt(this.bytes[this.offset + i]) << (8n * BigInt(i));
      high |= BigInt(this.bytes[this.offset + 4 + i]) << (8n * BigInt(i));
    }
    this.offset += 8;
    return (high << 32n) | low;
  }

  /**
   * Reads an unsigned 128-bit integer (little-endian).
   *
   * @returns The decoded bigint
   */
  u128(): bigint {
    let value = 0n;
    for (let i = 0; i < 16; i++) {
      value |= BigInt(this.bytes[this.offset + i]) << (8n * BigInt(i));
    }
    this.offset += 16;
    return value;
  }

  /**
   * Reads raw bytes.
   *
   * @param count - Number of bytes to read
   * @returns Slice of bytes
   */
  bytesN(count: number): Uint8Array {
    const chunk = this.bytes.subarray(this.offset, this.offset + count);
    this.offset += count;
    return chunk;
  }

  /**
   * Reads a vector (length-prefixed array).
   *
   * @param decode - Decoder callback
   * @returns Decoded array
   */
  vec<T>(decode: () => T): T[] {
    const length = this.u32();
    const output: T[] = [];
    for (let i = 0; i < length; i++) {
      output.push(decode());
    }
    return output;
  }

  /**
   * Reads a Borsh UTF-8 string.
   *
   * @returns Decoded string
   */
  str(): string {
    const length = this.u32();
    const bytes = this.bytesN(length);
    return new TextDecoder().decode(bytes);
  }
}

/**
 * Borsh writer for encoding NEAR delegate-action payloads.
 */
class Writer {
  private readonly chunks: Uint8Array[] = [];

  /**
   * Writes an unsigned 8-bit integer.
   *
   * @param value - Number to write
   */
  u8(value: number): void {
    this.chunks.push(U8(value));
  }

  /**
   * Writes an unsigned 32-bit integer.
   *
   * @param value - Number to write
   */
  u32(value: number): void {
    this.chunks.push(U32(value));
  }

  /**
   * Writes an unsigned 64-bit integer.
   *
   * @param value - Bigint to write
   */
  u64(value: bigint): void {
    this.chunks.push(U64(value));
  }

  /**
   * Writes an unsigned 128-bit integer.
   *
   * @param value - Bigint to write
   */
  u128(value: bigint): void {
    this.chunks.push(U128(value));
  }

  /**
   * Writes raw bytes.
   *
   * @param bytes - Bytes to append
   */
  bytesN(bytes: Uint8Array): void {
    this.chunks.push(bytes);
  }

  /**
   * Writes a Borsh UTF-8 string.
   *
   * @param value - String to encode
   */
  str(value: string): void {
    const bytes = utf8(value);
    this.u32(bytes.length);
    this.bytesN(bytes);
  }

  /**
   * Writes a vector.
   *
   * @param items - Array to encode
   * @param encode - Encoder callback
   */
  vec<T>(items: T[], encode: (writer: Writer, item: T) => void): void {
    this.u32(items.length);
    for (const item of items) {
      encode(this, item);
    }
  }

  /**
   * Finalizes written bytes.
   *
   * @returns Concatenated bytes
   */
  finish(): Uint8Array {
    let total = 0;
    for (const chunk of this.chunks) {
      total += chunk.length;
    }

    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }
}

/**
 * Decodes a Borsh public key.
 *
 * @param reader - Reader over input bytes
 * @returns Decoded public key
 */
function decodePublicKey(reader: Reader): PublicKey {
  const keyType = reader.u8();
  const data = reader.bytesN(32);
  return { keyType, data };
}

/**
 * Decodes a Borsh signature.
 *
 * @param reader - Reader over input bytes
 * @returns Decoded signature
 */
function decodeSignature(reader: Reader): Signature {
  const keyType = reader.u8();
  const data = reader.bytesN(64);
  return { keyType, data };
}

/**
 * Decodes a Borsh action variant.
 *
 * @param reader - Reader over input bytes
 * @returns Decoded action
 */
function decodeAction(reader: Reader): Action {
  const tag = reader.u8();

  if (tag === ACTION_TAGS.FunctionCall) {
    const methodName = reader.str();
    const argsLength = reader.u32();
    const args = reader.bytesN(argsLength);
    const gas = reader.u64();
    const deposit = reader.u128();
    return {
      kind: "FunctionCall",
      data: {
        methodName,
        args,
        gas,
        deposit,
      },
    };
  }

  if (tag === ACTION_TAGS.Transfer) {
    return {
      kind: "Transfer",
      data: {
        deposit: reader.u128(),
      },
    };
  }

  return { kind: "Unsupported", tag };
}

/**
 * Decodes a Borsh delegate action.
 *
 * @param reader - Reader over input bytes
 * @returns Decoded delegate action
 */
function decodeDelegateAction(reader: Reader): DelegateAction {
  const sender_id = reader.str();
  const receiver_id = reader.str();
  const actions = reader.vec<Action>(() => decodeAction(reader));
  const nonce = reader.u64();
  const max_block_height = reader.u64();
  const public_key = decodePublicKey(reader);

  return {
    sender_id,
    receiver_id,
    actions,
    nonce,
    max_block_height,
    public_key,
  };
}

/**
 * Decodes a base64 SignedDelegateAction.
 *
 * @param encoded - Base64 Borsh string
 * @returns Parsed signed delegate action
 */
export function decodeSignedDelegateActionB64(encoded: string): SignedDelegateAction {
  const reader = new Reader(fromBase64(encoded));
  const delegate_action = decodeDelegateAction(reader);
  const signature = decodeSignature(reader);

  if (!reader.eof()) {
    throw new Error("Trailing bytes after SignedDelegateAction");
  }

  return { delegate_action, signature };
}

/**
 * Encodes a public key in Borsh format.
 *
 * @param publicKey - Key to encode
 * @returns Encoded bytes
 */
export function encodePublicKey(publicKey: PublicKey): Uint8Array {
  if (publicKey.keyType !== 0) {
    throw new Error("Only ED25519 public keys are supported");
  }
  if (publicKey.data.length !== 32) {
    throw new Error("Public key must be 32 bytes");
  }

  const writer = new Writer();
  writer.u8(publicKey.keyType);
  writer.bytesN(publicKey.data);
  return writer.finish();
}

/**
 * Encodes a signature in Borsh format.
 *
 * @param signature - Signature to encode
 * @returns Encoded bytes
 */
export function encodeSignature(signature: Signature): Uint8Array {
  if (signature.keyType !== 0) {
    throw new Error("Only ED25519 signatures are supported");
  }
  if (signature.data.length !== 64) {
    throw new Error("Signature must be 64 bytes");
  }

  const writer = new Writer();
  writer.u8(signature.keyType);
  writer.bytesN(signature.data);
  return writer.finish();
}

/**
 * Encodes an action in Borsh format.
 *
 * @param action - Action to encode
 * @returns Encoded bytes
 */
export function encodeAction(action: Action): Uint8Array {
  const writer = new Writer();

  if (action.kind === "FunctionCall") {
    writer.u8(ACTION_TAGS.FunctionCall);
    writer.str(action.data.methodName);
    writer.u32(action.data.args.length);
    writer.bytesN(action.data.args);
    writer.u64(action.data.gas);
    writer.u128(action.data.deposit);
    return writer.finish();
  }

  if (action.kind === "Transfer") {
    writer.u8(ACTION_TAGS.Transfer);
    writer.u128(action.data.deposit);
    return writer.finish();
  }

  throw new Error("Unsupported action cannot be encoded");
}

/**
 * Encodes a delegate action in Borsh format.
 *
 * @param delegateAction - Delegate action to encode
 * @returns Encoded bytes
 */
export function encodeDelegateAction(delegateAction: DelegateAction): Uint8Array {
  const writer = new Writer();
  writer.str(delegateAction.sender_id);
  writer.str(delegateAction.receiver_id);
  writer.vec(delegateAction.actions, (vectorWriter, action) => {
    vectorWriter.bytesN(encodeAction(action));
  });
  writer.u64(delegateAction.nonce);
  writer.u64(delegateAction.max_block_height);
  writer.bytesN(encodePublicKey(delegateAction.public_key));
  return writer.finish();
}

/**
 * Encodes a signed delegate action in Borsh format.
 *
 * @param signedDelegateAction - Signed delegate action to encode
 * @returns Encoded bytes
 */
export function encodeSignedDelegateAction(signedDelegateAction: SignedDelegateAction): Uint8Array {
  const writer = new Writer();
  writer.bytesN(encodeDelegateAction(signedDelegateAction.delegate_action));
  writer.bytesN(encodeSignature(signedDelegateAction.signature));
  return writer.finish();
}

/**
 * Encodes a signed delegate action to base64.
 *
 * @param signedDelegateAction - Signed delegate action to encode
 * @returns Base64 encoded Borsh bytes
 */
export function encodeSignedDelegateActionB64(signedDelegateAction: SignedDelegateAction): string {
  return toBase64(encodeSignedDelegateAction(signedDelegateAction));
}

/**
 * Builds a NEP-141 ft_transfer FunctionCall action.
 *
 * @param args - Transfer arguments
 * @returns FunctionCall action
 */
export function buildFtTransferAction(args: {
  receiver_id: string;
  amount: string;
  memo?: string | null;
  gas?: bigint;
  deposit?: bigint;
}): Action {
  const body: NearFtTransferArgs = {
    receiver_id: args.receiver_id,
    amount: args.amount,
  };

  if (args.memo != null) {
    body.memo = args.memo;
  }

  return {
    kind: "FunctionCall",
    data: {
      methodName: FT_TRANSFER_METHOD,
      args: utf8(JSON.stringify(body)),
      gas: args.gas ?? DEFAULT_FT_TRANSFER_GAS,
      deposit: args.deposit ?? ONE_YOCTO,
    },
  };
}

/**
 * Builds a delegate action for exact-token transfer flows.
 *
 * @param params - Delegate-action parameters
 * @returns Unsigned delegate action
 */
export function buildDelegateActionExact(params: {
  sender_id: string;
  ft_contract: string;
  receiver_id_in_args: string;
  amount: string;
  nonce: bigint;
  max_block_height: bigint;
  public_key_32: Uint8Array;
  memo?: string | null;
  gas?: bigint;
  deposit?: bigint;
}): DelegateAction {
  return {
    sender_id: params.sender_id,
    receiver_id: params.ft_contract,
    actions: [
      buildFtTransferAction({
        receiver_id: params.receiver_id_in_args,
        amount: params.amount,
        memo: params.memo ?? null,
        gas: params.gas,
        deposit: params.deposit,
      }),
    ],
    nonce: params.nonce,
    max_block_height: params.max_block_height,
    public_key: {
      keyType: 0,
      data: params.public_key_32,
    },
  };
}

/**
 * Parses and validates ft_transfer JSON args.
 *
 * @param args - Raw action args bytes
 * @returns Parsed transfer args
 */
export function parseFtTransferArgs(args: Uint8Array): NearFtTransferArgs {
  const decoded = JSON.parse(new TextDecoder().decode(args)) as NearFtTransferArgs;
  if (typeof decoded.receiver_id !== "string" || decoded.receiver_id.length === 0) {
    throw new Error("Invalid ft_transfer args: receiver_id");
  }
  if (typeof decoded.amount !== "string" || !/^\d+$/.test(decoded.amount)) {
    throw new Error("Invalid ft_transfer args: amount");
  }
  return decoded;
}

/**
 * Converts bytes to base64.
 *
 * @param bytes - Bytes to encode
 * @returns Base64 string
 */
export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let value = "";
  for (let i = 0; i < bytes.length; i++) {
    value += String.fromCharCode(bytes[i]);
  }
  return btoa(value);
}

/**
 * Converts base64 string to bytes.
 *
 * @param value - Base64 string
 * @returns Decoded bytes
 */
export function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }

  const decoded = atob(value);
  const result = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded.charCodeAt(i);
  }
  return result;
}

/**
 * Creates a compact debug summary for a signed delegate action.
 *
 * @param signedDelegateAction - Decoded action
 * @returns Summary object for assertions/logging
 */
export function prettySignedDelegateAction(signedDelegateAction: SignedDelegateAction): {
  sender: string;
  receiver: string;
  nonce: string;
  maxBlockHeight: string;
  actions: string[];
  functionCall: null | {
    methodName: string;
    gas: string;
    deposit: string;
    argsLength: number;
  };
} {
  const delegateAction = signedDelegateAction.delegate_action;
  const first = delegateAction.actions[0];

  return {
    sender: delegateAction.sender_id,
    receiver: delegateAction.receiver_id,
    nonce: delegateAction.nonce.toString(),
    maxBlockHeight: delegateAction.max_block_height.toString(),
    actions: delegateAction.actions.map(action => action.kind),
    functionCall:
      first?.kind === "FunctionCall"
        ? {
            methodName: first.data.methodName,
            gas: first.data.gas.toString(),
            deposit: first.data.deposit.toString(),
            argsLength: first.data.args.length,
          }
        : null,
  };
}

/**
 * Encodes string to UTF-8 bytes.
 *
 * @param value - String value
 * @returns UTF-8 bytes
 */
function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/**
 * Encodes number as u8.
 *
 * @param value - Number value
 * @returns Encoded bytes
 */
function U8(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff);
}

/**
 * Encodes number as u32 little-endian.
 *
 * @param value - Number value
 * @returns Encoded bytes
 */
function U32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  bytes[0] = value & 0xff;
  bytes[1] = (value >>> 8) & 0xff;
  bytes[2] = (value >>> 16) & 0xff;
  bytes[3] = (value >>> 24) & 0xff;
  return bytes;
}

/**
 * Encodes bigint as u64 little-endian.
 *
 * @param value - Bigint value
 * @returns Encoded bytes
 */
function U64(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  let working = value;
  for (let i = 0; i < 8; i++) {
    bytes[i] = Number(working & 0xffn);
    working >>= 8n;
  }
  return bytes;
}

/**
 * Encodes bigint as u128 little-endian.
 *
 * @param value - Bigint value
 * @returns Encoded bytes
 */
function U128(value: bigint): Uint8Array {
  const bytes = new Uint8Array(16);
  let working = value;
  for (let i = 0; i < 16; i++) {
    bytes[i] = Number(working & 0xffn);
    working >>= 8n;
  }
  return bytes;
}
