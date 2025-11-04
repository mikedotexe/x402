/**
 * Browser-side NEP-366 builder for SignedDelegateAction (zero deps).
 * Uses wallet.signMessage(...) to sign the Borsh-encoded DelegateAction bytes.
 *
 * Works with wallets that implement NEP-413-style `signMessage({ message, recipient, nonce })`
 * and return a raw 64B ed25519 signature (Uint8Array | base64 | "ed25519:<base58>").
 *
 * If your wallet supports secp256k1 keys, see the NOTE at the bottom.
 */

export type NearNetwork = "near-mainnet" | "near-testnet";

export interface NearWalletLike {
  signMessage(input: {
    message: Uint8Array;   // bytes to sign (DelegateAction Borsh bytes)
    recipient: string;     // facilitator/relayer account (for wallet UX)
    nonce: Uint8Array;     // 32 bytes (server-issued in production)
    callbackUrl?: string;
  }): Promise<{
    accountId: string;
    publicKey: string;     // "ed25519:<base58>" or "secp256k1:<hex/b58>" (wallet-dependent)
    signature: Uint8Array | string;
  }>;
}

/* ---------- Public API ---------- */

export async function buildSignedDelegateActionB64WithWallet(opts: {
  wallet: NearWalletLike;
  recipientForWallet: string;             // facilitator account (wallet UX)
  nonce32: Uint8Array;                    // 32B, server-issued in prod
  delegate: {
    sender_id: string;                    // user account
    ft_contract: string;                  // token contract (receiver_id at tx layer)
    receiver_id_in_args: string;          // payTo merchant
    amount_base_units: string;            // token base units string
    memo?: string | null;
    nonce: bigint;                        // u64
    max_block_height: bigint;             // u64
    pubkey32?: Uint8Array;                // optional: if you already know it
  };
}): Promise<{ sda_b64: string; accountId: string; publicKey: string }> {
  const d = buildDelegateActionExact({
    sender_id: opts.delegate.sender_id,
    ft_contract: opts.delegate.ft_contract,
    pubkey32: opts.delegate.pubkey32 ?? new Uint8Array(32), // filled after sign if wallet exposes pk separately
    nonce: opts.delegate.nonce,
    max_block_height: opts.delegate.max_block_height,
    receiver_id_in_args: opts.delegate.receiver_id_in_args,
    amount: opts.delegate.amount_base_units,
    memo: opts.delegate.memo ?? null,
  });

  // If we don't know the raw 32B pk yet, sign with placeholder, then replace with actual pk and re-sign:
  let msg = encodeDelegateAction(d);

  const res = await opts.wallet.signMessage({
    message: msg,
    recipient: opts.recipientForWallet,
    nonce: opts.nonce32,
  });

  // Normalize public key (ed25519 only for v1)
  const pkInfo = parseNearPublicKey(res.publicKey);
  if (pkInfo.keyType !== 0) {
    throw new Error("Only ed25519 keys supported in v1 (secp256k1 planned)");
  }
  // If we had a placeholder pk, rebuild DelegateAction with the real pk and re-sign for correctness:
  if (!opts.delegate.pubkey32 || !equalBytes(d.public_key.data, pkInfo.raw32)) {
    d.public_key = { keyType: 0, data: pkInfo.raw32 };
    msg = encodeDelegateAction(d);
    const again = await opts.wallet.signMessage({
      message: msg,
      recipient: opts.recipientForWallet,
      nonce: opts.nonce32,
    });
    const sigBytes = normalizeSigBytes(again.signature);
    const sda = encodeSignedDelegateActionB64({
      delegate_action: d,
      signature: { keyType: 0, data: sigBytes },
    });
    return { sda_b64: sda, accountId: again.accountId, publicKey: again.publicKey };
  }

  const sigBytes = normalizeSigBytes(res.signature);
  const sda = encodeSignedDelegateActionB64({
    delegate_action: d,
    signature: { keyType: 0, data: sigBytes },
  });
  return { sda_b64: sda, accountId: res.accountId, publicKey: res.publicKey };
}

/* ---------- Minimal Borsh encoders (mirror of facilitator) ---------- */

type PublicKey = { keyType: number; data: Uint8Array };
type Signature = { keyType: number; data: Uint8Array };
type Action =
  | { kind: "FunctionCall"; data: { methodName: string; args: Uint8Array; gas: bigint; deposit: bigint } };

type DelegateAction = {
  sender_id: string;
  receiver_id: string;
  actions: Action[];
  nonce: bigint;
  max_block_height: bigint;
  public_key: PublicKey;
};

type SignedDelegateAction = { delegate_action: DelegateAction; signature: Signature };

const ACTION_TAGS = { FunctionCall: 2 } as const;

class Writer {
  chunks: Uint8Array[] = [];
  u8(v: number) { this.chunks.push(U8(v)); }
  u32(v: number) { this.chunks.push(U32(v)); }
  u64(v: bigint) { this.chunks.push(U64(v)); }
  u128(v: bigint) { this.chunks.push(U128(v)); }
  bytes(b: Uint8Array) { this.chunks.push(b); }
  str(s: string) { const b = enc(s); this.u32(b.length); this.bytes(b); }
  vec<T>(arr: T[], f: (w: Writer, x: T) => void) { this.u32(arr.length); for (const x of arr) f(this, x); }
  finish(): Uint8Array { let len=0; for (const c of this.chunks) len+=c.length; const out=new Uint8Array(len); let o=0; for (const c of this.chunks){out.set(c,o);o+=c.length;} return out; }
}
const enc = (s: string) => new TextEncoder().encode(s);
const U8 = (v: number) => Uint8Array.of(v & 0xff);
const U32 = (v: number) => new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]);
const U64 = (v: bigint) => { const b=new Uint8Array(8); let x=v; for(let i=0;i<8;i++){b[i]=Number(x&0xffn); x>>=8n;} return b; };
const U128 = (v: bigint) => { const b=new Uint8Array(16); let x=v; for(let i=0;i<16;i++){b[i]=Number(x&0xffn); x>>=8n;} return b; };

function encodeAction(a: Action): Uint8Array {
  const w = new Writer();
  w.u8(ACTION_TAGS.FunctionCall);
  w.str(a.data.methodName);
  w.u32(a.data.args.length); w.bytes(a.data.args);
  w.u64(a.data.gas);
  w.u128(a.data.deposit);
  return w.finish();
}

function encodePublicKey(pk: PublicKey): Uint8Array { if (pk.keyType!==0) throw new Error("ed25519 only"); if (pk.data.length!==32) throw new Error("pk 32B"); const w=new Writer(); w.u8(0); w.bytes(pk.data); return w.finish(); }
function encodeSignature(sig: Signature): Uint8Array { if (sig.keyType!==0) throw new Error("ed25519 only"); if (sig.data.length!==64) throw new Error("sig 64B"); const w=new Writer(); w.u8(0); w.bytes(sig.data); return w.finish(); }

function encodeDelegateAction(d: DelegateAction): Uint8Array {
  const w = new Writer();
  w.str(d.sender_id);
  w.str(d.receiver_id);
  w.vec(d.actions, (w2, act) => w2.bytes(encodeAction(act)));
  w.u64(d.nonce);
  w.u64(d.max_block_height);
  w.bytes(encodePublicKey(d.public_key));
  return w.finish();
}

function encodeSignedDelegateAction(sda: SignedDelegateAction): Uint8Array {
  const w = new Writer();
  w.bytes(encodeDelegateAction(sda.delegate_action));
  w.bytes(encodeSignature(sda.signature));
  return w.finish();
}

function encodeSignedDelegateActionB64(sda: SignedDelegateAction): string { return toB64(encodeSignedDelegateAction(sda)); }
function toB64(u8: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(u8).toString("base64");
  let s = ""; for (let i=0;i<u8.length;i++) s += String.fromCharCode(u8[i]);
  // @ts-ignore
  return btoa(s);
}

/* ---------- helpers ---------- */

function buildFtTransferAction(args: { receiver_id: string; amount: string; memo?: string | null; }): Action {
  const gas = 30_000_000_000_000n; // 30 Tgas
  const deposit = 1n;              // 1 yocto (required)
  const body: any = { receiver_id: args.receiver_id, amount: args.amount };
  if (args.memo != null) body.memo = args.memo;
  const json = enc(JSON.stringify(body));
  return { kind: "FunctionCall", data: { methodName: "ft_transfer", args: json, gas, deposit } };
}

function buildDelegateActionExact(p: {
  sender_id: string; ft_contract: string; pubkey32: Uint8Array;
  nonce: bigint; max_block_height: bigint; receiver_id_in_args: string; amount: string; memo?: string | null;
}): DelegateAction {
  return {
    sender_id: p.sender_id,
    receiver_id: p.ft_contract,
    actions: [ buildFtTransferAction({ receiver_id: p.receiver_id_in_args, amount: p.amount, memo: p.memo ?? null }) ],
    nonce: p.nonce,
    max_block_height: p.max_block_height,
    public_key: { keyType: 0, data: p.pubkey32 }
  };
}

function normalizeSigBytes(sig: Uint8Array | string): Uint8Array {
  if (sig instanceof Uint8Array) return sig;
  if (typeof sig !== "string") throw new Error("invalid signature type");
  if (sig.startsWith("ed25519:")) return bs58decode(sig.slice(8));
  // assume base64
  return fromB64(sig);
}
function fromB64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  // @ts-ignore
  const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out;
}
function bs58decode(s: string): Uint8Array {
  const A="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; const M:Record<string,number>={}; for (let i=0;i<A.length;i++) M[A[i]]=i;
  let n=0n; for (const c of s){ const v=M[c]; if (v===undefined) throw new Error("bad base58"); n = n*58n + BigInt(v); }
  const bytes:number[]=[]; while(n>0n){ bytes.push(Number(n%256n)); n/=256n; } bytes.reverse();
  let lead=0; for (const c of s){ if (c==='1') lead++; else break; }
  const out=new Uint8Array(lead+bytes.length); out.set(bytes, lead); return out;
}
function parseNearPublicKey(pk: string): { keyType: 0 | 1; raw32: Uint8Array } {
  const [kind, body] = pk.split(":");
  if (kind === "ed25519") return { keyType: 0, raw32: bs58decode(body) };
  if (kind === "secp256k1") return { keyType: 1, raw32: hexOrB58(body) }; // Placeholder handling (v1 rejects later)
  throw new Error("Unsupported publicKey format");
}
function hexOrB58(s: string): Uint8Array {
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) {
    const out = new Uint8Array(s.length/2);
    for (let i=0;i<out.length;i++) out[i] = parseInt(s.slice(2*i,2*i+2),16);
    return out;
  }
  return bs58decode(s);
}
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length!==b.length) return false;
  for (let i=0;i<a.length;i++) if (a[i]!==b[i]) return false;
  return true;
}

/* NOTE on secp256k1:
 * NEAR supports secp256k1 keys, but signature format & digesting rules differ from ed25519.
 * This builder locks to ed25519 in v1 for safety (keyType==0). You can extend it after confirming:
 *  - signature length/format (64/65 bytes), and
 *  - whether wallets sign raw bytes or a digest (e.g., sha256(msg)).
 */
