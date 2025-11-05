# x402-witness-verify

EVM witness verification for x402 payment protocol. Binds payments to specific resource URLs using EIP-191 `personal_sign`.

## Overview

This crate verifies **optional** EVM witnesses that provide resource integrity for x402 payments without modifying the EIP-3009 transfer authorization.

### What is a Witness?

A witness binds a payment to a specific resource URL by:
1. Canonicalizing the resource URL (same rules client + server)
2. Computing `digest = keccak256("x402:resource:<canonical-url>")`
3. Signing the digest with `personal_sign` (EIP-191)
4. Attaching the witness to the payment header as `payload.witness`

### Why Use Witnesses?

- **Resource Integrity**: Prove the payer intended to pay for a specific resource
- **Non-Intrusive**: Doesn't change EIP-3009 authorization
- **Optional**: Works with or without witness
- **Future-Proof**: Can evolve to Permit2-style witnesses

## Features

- ✅ **Server-side verification** (Rust rlib)
- ✅ **Browser-side verification** (WebAssembly)
- ✅ **URL canonicalization** (identical to TypeScript implementation)
- ✅ **EIP-191 signature recovery** (personal_sign)
- ✅ **Zero-dependency core** (sha3, k256, hex, url)

## Usage

### Server-Side (Rust)

Add to your `Cargo.toml`:

```toml
[dependencies]
x402-witness-verify = { path = "../../crates/x402-witness-verify" }
```

Verify a witness:

```rust
use x402_witness_verify::{EvmWitness, verify_evm_witness};

let witness = EvmWitness {
    type_: "eip191".to_string(),
    algo: "keccak256".to_string(),
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb".to_string(),
    resource: "https://api.example.com/protected".to_string(),
    digest: "0x1234...".to_string(),
    signature: "0xabcd...".to_string(),
};

match verify_evm_witness(&witness) {
    Ok(()) => println!("Witness valid!"),
    Err(e) => println!("Witness invalid: {}", e),
}
```

### Integration with Facilitator

Extract and verify witness from payment header:

```rust
use serde::Deserialize;
use x402_witness_verify::{EvmWitness, verify_evm_witness};

#[derive(Deserialize)]
struct PaymentHeader {
    scheme: String,
    network: String,
    #[serde(default)]
    payload: serde_json::Value,
}

pub enum WitnessCheck {
    Ok,
    Skipped,
    Invalid(String),
}

pub fn check_optional_witness_from_header_b64(header_b64: &str) -> WitnessCheck {
    // Decode base64
    let Ok(json_bytes) = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        header_b64
    ) else {
        return WitnessCheck::Invalid("invalid_header_base64".into());
    };

    let Ok(json_str) = String::from_utf8(json_bytes) else {
        return WitnessCheck::Invalid("invalid_header_utf8".into());
    };

    // Parse header
    let Ok(header) = serde_json::from_str::<PaymentHeader>(&json_str) else {
        return WitnessCheck::Invalid("invalid_header_json".into());
    };

    // Extract witness (optional)
    let Some(w) = header.payload.get("witness") else {
        return WitnessCheck::Skipped;
    };

    let Ok(witness) = serde_json::from_value::<EvmWitness>(w.clone()) else {
        return WitnessCheck::Invalid("invalid_witness_shape".into());
    };

    // Verify witness
    match verify_evm_witness(&witness) {
        Ok(()) => WitnessCheck::Ok,
        Err(e) => WitnessCheck::Invalid(e.to_string()),
    }
}
```

Usage in `/verify` handler:

```rust
match check_optional_witness_from_header_b64(payment_header_b64) {
    WitnessCheck::Ok | WitnessCheck::Skipped => {
        // Continue normal verify
    }
    WitnessCheck::Invalid(reason) => {
        return Err(anyhow::anyhow!("invalid_witness: {reason}"));
    }
}
```

### Browser-Side (WebAssembly)

Build for WebAssembly:

```bash
cd crates/x402-witness-verify
wasm-pack build --release --target web --features wasm
```

This creates `pkg/` directory with:
- `x402_witness_verify.js` - JS bindings
- `x402_witness_verify_bg.wasm` - WebAssembly module

Load in HTML:

```html
<script type="module">
  import init, { verify_evm_witness_json, canonicalize_resource, digest_for_resource }
    from "/pkg/x402_witness_verify.js";

  await init();

  // Example witness
  const witness = {
    type: "eip191",
    algo: "keccak256",
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    resource: "https://api.example.com/protected",
    digest: "0x1234...",
    signature: "0xabcd..."
  };

  // Verify
  const ok = verify_evm_witness_json(JSON.stringify(witness));
  console.log({ ok });

  // Helpers
  const canonical = canonicalize_resource("https://Example.com:443/path#frag");
  // Returns: "https://example.com/path"

  const digest = digest_for_resource("https://api.example.com/protected");
  // Returns: "0x..." (keccak256 hash)
</script>
```

## API Reference

### Rust API

#### `verify_evm_witness(witness: &EvmWitness) -> Result<(), VerifyError>`

Verifies an EVM witness:
1. Checks `type` is "eip191"
2. Checks `algo` is "keccak256"
3. Canonicalizes resource URL
4. Recomputes digest and compares
5. Recovers address from signature
6. Verifies address matches witness

Returns `Ok(())` on success, `Err(VerifyError)` on failure.

#### `canonicalize_resource(url: &str) -> Result<String, VerifyError>`

Canonicalizes a resource URL:
- Removes fragment (`#...`)
- Removes credentials (`user:pass@`)
- Removes default ports (443 for https, 80 for http)
- Lowercases host

### WebAssembly API (feature = "wasm")

#### `verify_evm_witness_json(witness_json: &str) -> bool`

Verifies a witness from JSON string. Returns `true` if valid, `false` otherwise.

#### `canonicalize_resource(url: &str) -> String`

Canonicalizes a resource URL. Returns empty string on error.

#### `digest_for_resource(url: &str) -> String`

Computes the keccak256 digest for a resource. Returns 0x-prefixed hex string.

## URL Canonicalization

The canonicalization algorithm ensures identical digest computation on client and server:

```rust
fn canonicalize_resource(u: &str) -> Result<String, VerifyError> {
    let mut url = url::Url::parse(u)?;

    // Remove fragment
    url.set_fragment(None);

    // Remove credentials
    url.set_username("").ok();
    url.set_password(None).ok();

    // Remove default ports
    if (url.scheme() == "https" && url.port() == Some(443)) ||
       (url.scheme() == "http" && url.port() == Some(80)) {
        url.set_port(None).ok();
    }

    // Host is automatically lowercased by url::Url
    Ok(url.to_string())
}
```

### Examples

| Input | Canonical Output |
|-------|-----------------|
| `https://Example.com:443/path?q=1#frag` | `https://example.com/path?q=1` |
| `http://API.com:80/data` | `http://api.com/data` |
| `https://api.com:8443/path` | `https://api.com:8443/path` |

## Signature Verification

The witness uses EIP-191 `personal_sign`:

1. **Message**: Raw digest bytes (32 bytes)
2. **Prefix**: `\x19Ethereum Signed Message:\n32`
3. **Hash**: `keccak256(prefix + message)`
4. **Signature**: `r || s || v` (65 bytes)
5. **Recovery**: Recover public key from (hash, signature)
6. **Address**: Last 20 bytes of `keccak256(pubkey)`

### v Value Normalization

The recovery ID `v` is normalized to {0, 1}:
- `27` → `0`
- `28` → `1`
- `>=35` → `(v - 35) % 2` (EIP-155, rare for personal_sign)

## Error Types

```rust
pub enum VerifyError {
    InvalidUrl,          // URL parsing failed
    InvalidDigestHex,    // Digest is not valid hex
    InvalidSigHex,       // Signature is not valid hex
    InvalidSigLen,       // Signature is not 65 bytes
    DigestMismatch,      // Recomputed digest doesn't match
    RecoverFailed,       // Signature recovery failed
    AddressMismatch,     // Recovered address doesn't match
}
```

## Testing

Run tests:

```bash
cargo test
```

Tests include:
- URL canonicalization
- Digest stability (same canonical URL = same digest)

## Optional Enforcement

Witnesses are **optional**. Facilitators can:

1. **Ignore witnesses** - Continue normal verification
2. **Validate when present** - Fail if witness is invalid
3. **Require witnesses** - Fail if witness is missing

Environment-based enforcement:

```rust
const WITNESS_REQUIRED: bool = std::env::var("WITNESS_REQUIRED")
    .unwrap_or_default() == "true";

match check_optional_witness_from_header_b64(header_b64) {
    WitnessCheck::Ok => { /* continue */ }
    WitnessCheck::Skipped if !WITNESS_REQUIRED => { /* continue */ }
    WitnessCheck::Skipped => return Err(anyhow!("witness_required")),
    WitnessCheck::Invalid(reason) => return Err(anyhow!("invalid_witness: {}", reason)),
}
```

## Relationship to EIP-3009

The witness is **orthogonal** to EIP-3009:

- **EIP-3009**: Authorizes token transfer (who, what, when)
- **Witness**: Binds payment to resource (why)

The witness does NOT change the EIP-3009 authorization. It's a separate signature over a resource digest that proves intent.

### Future: Permit2 Witness

The witness format can evolve to EIP-712 with witness data inside the typed structure (like Permit2). The current approach keeps the witness separate for backward compatibility.

## Dependencies

- `sha3` - Keccak256 hashing
- `k256` - ECDSA signature recovery
- `hex` - Hex encoding/decoding
- `url` - URL parsing and canonicalization
- `serde` / `serde_json` - JSON serialization
- `wasm-bindgen` (optional) - WebAssembly bindings

## License

Apache-2.0

## See Also

- [x402 Specification](https://github.com/coinbase/x402/blob/main/specs/x402-specification.md)
- [EIP-191: Signed Data Standard](https://eips.ethereum.org/EIPS/eip-191)
- [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [TypeScript witness utilities](../../typescript/packages/x402/src/browser/witness.ts)
