# Base Direct Facilitator Demo

**Direct facilitator integration using window.xf IIFE + optional EIP-191 witness binding**

## Overview

This demo shows how to integrate x402 payments directly with a facilitator, bypassing the need for an intermediate protected API. Perfect for:
- Static websites
- Client-side only applications
- Prototyping and demos
- Hackathons

## Features

- ✅ **Zero backend** - Pure client-side integration
- ✅ **Direct facilitator calls** - Client → Facilitator → Settlement
- ✅ **Optional witness binding** - EIP-191 resource integrity
- ✅ **window.xf IIFE** - Simple `<script>` tag integration
- ✅ **MetaMask integration** - EIP-712 + personal_sign
- ✅ **Base Sepolia & Mainnet** - Full network support

## Quick Start

### 1. Start a facilitator

You need a running facilitator that implements `/supported`, `/verify`, and `/settle`.

**Option A: Use existing facilitator**
```bash
# Point to production facilitator
FACILITATOR_URL=https://x402.org/facilitator
```

**Option B: Run local facilitator**
```bash
cd examples/typescript/facilitator-base
cp .env.example .env
# Edit .env with your settings
npm install
npm run dev
# Runs on http://localhost:8080
```

### 2. Serve the HTML

```bash
cd examples/html/base-iife-direct
python3 -m http.server 8080
```

Or use any static server:
```bash
npx serve -p 8080
```

### 3. Open in browser

Navigate to `http://localhost:8080/base-iife-direct.html`

## Configuration

Edit the demo HTML to configure:

```javascript
const CHAINS = {
  "base": {
    chainId: 8453,
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6
  },
  "base-sepolia": {
    chainId: 84532,
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6
  }
};
```

## How It Works

### 1. Check Facilitator Support

```javascript
const supported = await facSupported("http://localhost:8080");
// Returns: { kinds: [{ scheme: "exact", network: "base-sepolia", ... }] }
```

### 2. Build Payment Requirements

```javascript
const reqs = buildRequirements(
  "base-sepolia",     // network
  0.01,                // amount in USDC
  "0xRecipient...",   // payTo address
  "https://api.example.com/data" // resource URL
);
```

### 3. Create Payment Header

Uses the existing x402 API via window.xf:

```javascript
// Create viem client from MetaMask
const viemClient = xf.browser.viemAdapter.createViemClientFromProvider(
  window.ethereum,
  84532 // Base Sepolia chain ID
);

// Generate payment header (prompts MetaMask for EIP-712 signature)
const header = await xf.client.createPaymentHeader(
  viemClient,
  1, // x402Version
  reqs
);
```

### 4. Optional: Add Witness Binding

```javascript
if (witnessEnabled) {
  // Create EIP-191 witness binding resource to payment
  const witness = await xf.browser.witness.makeEvmWitness(
    window.ethereum,
    walletAddress,
    reqs.resource
  );

  // Attach witness to payment header
  header = xf.browser.witness.addWitnessToPaymentHeader(header, witness);
}
```

### 5. Verify Payment

```javascript
const verifyResult = await fetch("http://localhost:8080/verify", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    x402Version: 1,
    paymentHeader: header,
    paymentRequirements: reqs
  })
});

const { isValid, payer } = await verifyResult.json();
```

### 6. Settle Payment

```javascript
const settleResult = await fetch("http://localhost:8080/settle", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    x402Version: 1,
    paymentHeader: header,
    paymentRequirements: reqs
  })
});

const { success, transaction } = await settleResult.json();
// transaction = "0x..." (Base Sepolia tx hash)
```

## Witness Binding

The optional witness provides **resource integrity** without changing the EIP-3009 authorization.

### How It Works

1. **Canonicalize URL**: `https://Example.com:443/path#frag` → `https://example.com/path`
2. **Compute digest**: `keccak256("x402:resource:<canonical>")`
3. **Sign with personal_sign**: MetaMask prompts for signature
4. **Attach to header**: Added as `payload.witness`

### Verification (Facilitator)

The facilitator can optionally verify the witness:

```typescript
import { checkWitness } from 'x402';

// In /verify handler:
const witnessRequired = process.env.WITNESS_REQUIRED === "true";
checkWitness(paymentHeader, witnessRequired);
```

## window.xf API

The IIFE exposes a frozen global API:

```javascript
window.xf = {
  version: "iife",

  // Payment creation
  client: {
    createPaymentHeader(viemClient, x402Version, requirements),
    // ... other client methods
  },

  // Browser utilities
  browser: {
    viemAdapter: {
      createViemClientFromProvider(provider, chainId),
      getProviderChainId(provider),
      getProviderAccounts(provider),
    },
    witness: {
      canonicalizeResource(url),
      makeEvmWitness(provider, address, resource),
      addWitnessToPaymentHeader(header, witness),
      extractWitnessFromPaymentHeader(header),
    },
  },

  // Verification, schemes, etc.
  verify: { ... },
  facilitator: { ... },
  schemes: { ... },
  shared: { ... },
};
```

## Comparison: Direct vs Protected API

### Direct Facilitator (This Demo)

```
Client → Facilitator → Settlement
```

**Pros:**
- Simpler architecture
- No intermediate server needed
- Lower latency
- Easy to prototype

**Cons:**
- Facilitator URL exposed to client
- No 402 status code (not a "protected resource")
- Less flexible for complex flows

### Protected API Pattern

```
Client → Protected API → Facilitator → Settlement
```

**Pros:**
- True HTTP 402 flow
- Server controls payment requirements
- Can add custom business logic
- Resource protection

**Cons:**
- Requires backend server
- More moving parts
- Higher latency

## Testing Checklist

- [ ] HTML loads without errors
- [ ] window.xf is available in console
- [ ] `window.xf.browser` utilities exist
- [ ] MetaMask connects successfully
- [ ] Network switching works
- [ ] Facilitator `/supported` returns data
- [ ] Payment header creation prompts MetaMask
- [ ] EIP-712 signature is generated
- [ ] Witness creation works (if enabled)
- [ ] Facilitator `/verify` accepts payment
- [ ] Facilitator `/settle` executes transfer
- [ ] Transaction hash is returned
- [ ] Explorer link works

## Troubleshooting

### window.xf not found
- Check script path: `../../typescript/packages/x402/dist/umd/browser.global.js`
- Rebuild: `cd typescript/packages/x402 && pnpm build`

### Facilitator connection failed
- Verify facilitator is running: `curl http://localhost:8080/health`
- Check CORS settings
- Ensure correct URL in demo

### Payment verification fails
- Check wallet has USDC balance
- Verify USDC address matches network
- Check facilitator logs for details
- Ensure signature is valid

### Witness verification fails
- Check URL canonicalization matches
- Verify personal_sign signature
- Ensure facilitator supports witness (optional feature)

## DevTools Helper

Click "Expose helpers for DevTools" to access:

```javascript
// Available as window.demo
demo.xf                        // Full xf API
demo.buildRequirements(...)    // Build payment requirements
demo.facSupported(url)         // Check facilitator support
demo.facVerify(url, header, reqs)   // Verify payment
demo.facSettle(url, header, reqs)   // Settle payment
demo.runVerifyOnly()           // Run verification flow
demo.runVerifyAndSettle()      // Run full flow
```

## Network Configuration

### Base Sepolia (Testnet)

```javascript
{
  chainId: 84532,
  chainHex: "0x14A34",
  rpc: "https://sepolia.base.org",
  explorer: "https://sepolia.basescan.org",
  USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  decimals: 6
}
```

Get testnet USDC:
- Bridge from Sepolia ETH: https://bridge.base.org
- Faucet: https://faucet.circle.com

### Base Mainnet

```javascript
{
  chainId: 8453,
  chainHex: "0x2105",
  rpc: "https://mainnet.base.org",
  explorer: "https://basescan.org",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  decimals: 6
}
```

## Security Considerations

1. **Facilitator Trust**: Client directly calls facilitator - ensure it's trustworthy
2. **HTTPS**: Use HTTPS in production
3. **Rate Limiting**: Facilitator should rate limit
4. **Amount Validation**: Always verify maxAmountRequired
5. **Network Validation**: Ensure payment is on correct network
6. **Witness Optional**: Witnesses add integrity but are optional

## Resources

- [x402 Specification](https://github.com/coinbase/x402/blob/main/specs/x402-specification.md)
- [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009)
- [EIP-191](https://eips.ethereum.org/EIPS/eip-191)
- [Base Documentation](https://docs.base.org)
- [MetaMask Documentation](https://docs.metamask.io)

## License

Apache-2.0
