//! EVM witness verification for x402: binds a resource URL to a payment.
//! Witness format (JSON):
//! {
//!   "type": "eip191",
//!   "algo": "keccak256",
//!   "address": "0x...payer",
//!   "resource": "https://example.com/protected",
//!   "digest": "0x<32 bytes>",
//!   "signature": "0x<65 bytes r||s||v>"
//! }
//! The digest is keccak256("x402:resource:<canonical-resource>").
//! The signature is personal_sign over the raw digest bytes (with the
//! Ethereum Signed Message prefix applied by the wallet).

use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};
use std::fmt;

#[derive(Debug)]
pub enum VerifyError {
    InvalidUrl,
    InvalidDigestHex,
    InvalidSigHex,
    InvalidSigLen,
    DigestMismatch,
    RecoverFailed,
    AddressMismatch,
}

impl fmt::Display for VerifyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        use VerifyError::*;
        let s = match self {
            InvalidUrl => "invalid_url",
            InvalidDigestHex => "invalid_digest_hex",
            InvalidSigHex => "invalid_signature_hex",
            InvalidSigLen => "invalid_signature_len",
            DigestMismatch => "digest_mismatch",
            RecoverFailed => "recover_failed",
            AddressMismatch => "address_mismatch",
        };
        write!(f, "{s}")
    }
}

#[cfg(feature = "wasm")]
mod wasm {
    use super::*;
    use wasm_bindgen::prelude::*;

    /// Verify witness from a JSON string. Returns true on success.
    #[wasm_bindgen]
    pub fn verify_evm_witness_json(witness_json: &str) -> bool {
        match serde_json::from_str::<EvmWitness>(witness_json)
            .map_err(|_| VerifyError::InvalidSigHex)
            .and_then(|w| verify_evm_witness(&w))
        {
            Ok(()) => true,
            Err(_) => false,
        }
    }

    /// Canonicalize a resource URL with the same rules used for digest.
    #[wasm_bindgen]
    pub fn canonicalize_resource(u: &str) -> String {
        super::canonicalize_resource(u).unwrap_or_default()
    }

    /// Compute the digest hex ("0x..") for a resource (after canonicalization).
    #[wasm_bindgen]
    pub fn digest_for_resource(u: &str) -> String {
        match super::canonicalize_resource(u) {
            Ok(c) => super::digest_hex(&c),
            Err(_) => String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmWitness {
    #[serde(rename = "type")]
    pub type_: String, // "eip191"
    pub algo: String,  // "keccak256"
    pub address: String,
    pub resource: String,
    pub digest: String,    // 0x-prefixed 32 bytes
    pub signature: String, // 0x-prefixed 65 bytes
}

pub fn verify_evm_witness(w: &EvmWitness) -> Result<(), VerifyError> {
    // Basic header checks
    if w.type_.to_lowercase() != "eip191" {
        return Err(VerifyError::RecoverFailed);
    }
    if w.algo.to_lowercase() != "keccak256" {
        return Err(VerifyError::RecoverFailed);
    }

    // Canonicalize resource and recompute digest; must match provided digest
    let canon = canonicalize_resource(&w.resource)?;
    let want_digest = keccak256_bytes(format!("x402:resource:{canon}").as_bytes());
    let want_digest_hex = to_0x_hex(&want_digest);
    if !eq_hex_nocase(&w.digest, &want_digest_hex) {
        return Err(VerifyError::DigestMismatch);
    }

    // personal_sign verification: message is the raw digest bytes (32).
    // Hash = keccak256("\x19Ethereum Signed Message:\n32" || digest_bytes)
    let digest_bytes = from_0x_hex_bytes32(&w.digest).map_err(|_| VerifyError::InvalidDigestHex)?;
    let eth_msg_hash = ethereum_personal_message_hash(&digest_bytes);

    // Recover pubkey from signature and derive address
    let sig = from_0x_hex(&w.signature).map_err(|_| VerifyError::InvalidSigHex)?;
    if sig.len() != 65 {
        return Err(VerifyError::InvalidSigLen);
    }
    let rec_addr = recover_address(&eth_msg_hash, &sig).map_err(|_| VerifyError::RecoverFailed)?;

    // Compare (case-insensitive)
    let want_addr = normalize_addr_lower(&w.address);
    if rec_addr != want_addr {
        return Err(VerifyError::AddressMismatch);
    }

    Ok(())
}

// --- helpers ------------------------------------------------------------------------------------

fn canonicalize_resource(u: &str) -> Result<String, VerifyError> {
    let mut url = url::Url::parse(u).map_err(|_| VerifyError::InvalidUrl)?;
    url.set_fragment(None);
    url.set_username("").ok();
    url.set_password(None).ok();

    // Drop default ports
    let default = match url.scheme() {
        "https" => "443",
        "http" => "80",
        _ => "",
    };
    if url.port().map(|p| p.to_string()) == Some(default.to_string()) {
        url.set_port(None).ok();
    }
    Ok(url.to_string())
}

fn keccak256_bytes(data: &[u8]) -> [u8; 32] {
    let mut h = Keccak256::new();
    h.update(data);
    let out = h.finalize();
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&out);
    arr
}

fn digest_hex(url: &str) -> String {
    let canon = canonicalize_resource(url).unwrap_or_else(|_| url.to_string());
    to_0x_hex(&keccak256_bytes(format!("x402:resource:{canon}").as_bytes()))
}

fn to_0x_hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(2 + bytes.len() * 2);
    s.push_str("0x");
    s.push_str(&hex::encode(bytes));
    s
}

fn from_0x_hex(s: &str) -> Result<Vec<u8>, hex::FromHexError> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    hex::decode(s)
}

fn from_0x_hex_bytes32(s: &str) -> Result<[u8; 32], hex::FromHexError> {
    let v = from_0x_hex(s)?;
    if v.len() != 32 {
        return Err(hex::FromHexError::InvalidStringLength);
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&v);
    Ok(arr)
}

fn eq_hex_nocase(a: &str, b: &str) -> bool {
    a.trim().to_ascii_lowercase() == b.trim().to_ascii_lowercase()
}

fn normalize_addr_lower(addr: &str) -> String {
    let s = addr.trim();
    if s.starts_with("0x") {
        s.to_ascii_lowercase()
    } else {
        format!("0x{}", s.to_ascii_lowercase())
    }
}

/// keccak256("\x19Ethereum Signed Message:\n" + len(message) + message)
fn ethereum_personal_message_hash(message: &[u8]) -> [u8; 32] {
    let mut prefix = format!("\x19Ethereum Signed Message:\n{}", message.len()).into_bytes();
    prefix.extend_from_slice(message);
    keccak256_bytes(&prefix)
}

fn recover_address(msg_hash32: &[u8; 32], sig65: &[u8]) -> Result<String, ()> {
    use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};
    use k256::elliptic_curve::sec1::ToEncodedPoint;

    // Normalize v into {0,1}
    let v = sig65[64];
    let v_norm = match v {
        27 | 28 => v - 27,
        0 | 1 => v,
        // EIP-155 (>=35) should not appear for personal_sign; reduce if it does
        x if x >= 35 => (x - 35) % 2,
        _ => return Err(()),
    };

    // Extract r,s components (first 64 bytes)
    let signature = Signature::from_slice(&sig65[..64]).map_err(|_| ())?;

    // Create RecoveryId from normalized v
    let recid = RecoveryId::try_from(v_norm).map_err(|_| ())?;

    // Recover verifying key from prehashed message
    let vk = VerifyingKey::recover_from_prehash(&msg_hash32[..], &signature, recid)
        .map_err(|_| ())?;

    let uncompressed = vk.to_encoded_point(false);
    let pubkey = &uncompressed.as_bytes()[1..]; // skip 0x04
    let h = keccak256_bytes(pubkey);
    let addr = &h[12..]; // last 20 bytes
    Ok(to_0x_hex(addr))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canon_basic() {
        let u = canonicalize_resource("https://EXAMPLE.com:443/path?q=1#frag").unwrap();
        assert_eq!(u, "https://example.com/path?q=1");
    }

    #[test]
    fn digest_stable() {
        let d1 = digest_hex("https://example.com/path?q=1");
        let d2 = digest_hex("https://example.com/path?q=1#ignored");
        assert_eq!(d1, d2);
    }
}
