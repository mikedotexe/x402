# Quickstart: Static HTML + x402 (90 Seconds)

Accept payments in your web app with **zero build tools**. Just load x402 from CDN and start accepting USDC payments on Base.

## Prerequisites

- MetaMask (or any EIP-1193 wallet)
- A facilitator (we'll run one locally)
- Some testnet USDC on Base Sepolia ([faucet](https://faucet.circle.com/))

## Step 1: Start the Facilitator (30 seconds)

The facilitator handles payment verification and settlement.

```bash
# Clone the repo (if you haven't)
git clone https://github.com/coinbase/x402
cd x402

# Option A: Run TypeScript facilitator
cd examples/typescript/facilitator
cp .env.example .env
# Edit .env and add your EVM_PRIVATE_KEY
pnpm install
pnpm dev

# Option B: Run Rust facilitator (coming soon)
# docker run -p 8080:8080 ghcr.io/x402-rs/x402-facilitator
```

The facilitator will start on `http://localhost:3000` with these endpoints:
- `GET /health` - Health check
- `GET /version` - Version + supported networks
- `GET /supported` - Payment kinds supported
- `POST /verify` - Verify payment headers
- `POST /settle` - Execute payment

## Step 2: Create Your HTML Page (30 seconds)

Create `payment.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>x402 Payment Demo</title>

  <!-- Load x402 from CDN (or local build) -->
  <script src="https://unpkg.com/@coinbase/x402/dist/x402.iife.global.js"></script>
  <!-- or use local: -->
  <!-- <script src="../../typescript/packages/x402/dist/x402.iife.global.js"></script> -->
</head>
<body>
  <h1>Pay with USDC</h1>
  <button id="payBtn">Pay $0.01 USDC</button>
  <div id="status"></div>

  <script>
    const facilitatorUrl = "http://localhost:3000";

    async function pay() {
      const status = document.getElementById("status");
      status.textContent = "Connecting wallet...";

      // Get user's wallet
      const chainId = 84532; // Base Sepolia
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });
      const account = accounts[0];

      // Create viem client from MetaMask
      const viemClient = window.xf.browser.viemAdapter.createViemClientFromProvider(
        window.ethereum,
        chainId
      );

      // Define payment requirements
      const requirements = {
        scheme: "exact",
        network: "base-sepolia",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
        amount: "10000", // 0.01 USDC (6 decimals)
        payTo: "0xYourRecipientAddress", // Replace with your address
        resource: window.location.href,
      };

      // Create payment header (prompts MetaMask signature)
      status.textContent = "Creating payment (sign in MetaMask)...";
      let header = await window.xf.client.createPaymentHeader(
        viemClient,
        1, // x402Version
        requirements
      );

      // Convert to base64 for facilitator
      const headerB64 = btoa(JSON.stringify(header));

      // Verify payment
      status.textContent = "Verifying payment...";
      const verifyResp = await fetch(`${facilitatorUrl}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x402Version: 1,
          paymentHeader: headerB64,
          paymentRequirements: requirements,
        }),
      });
      const verified = await verifyResp.json();

      if (!verified.isValid) {
        status.textContent = `Verification failed: ${verified.invalidReason}`;
        return;
      }

      // Settle payment
      status.textContent = "Settling payment on-chain...";
      const settleResp = await fetch(`${facilitatorUrl}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x402Version: 1,
          paymentHeader: headerB64,
          paymentRequirements: requirements,
        }),
      });
      const settled = await settleResp.json();

      if (settled.transaction) {
        const explorerUrl = `https://sepolia.basescan.org/tx/${settled.transaction}`;
        status.innerHTML = `✅ Payment successful!<br><a href="${explorerUrl}" target="_blank">View transaction</a>`;
      } else {
        status.textContent = `Settlement failed: ${settled.error}`;
      }
    }

    document.getElementById("payBtn").onclick = pay;

    // Check if x402 loaded
    if (typeof window.xf === "undefined") {
      document.getElementById("status").textContent = "ERROR: xf not loaded!";
    } else {
      console.log("xf loaded! Version:", window.xf.version);
      console.log("window.x402 is an alias:", window.x402 === window.xf);
    }
  </script>
</body>
</html>
```

## Step 3: Open and Test (30 seconds)

```bash
# Serve the HTML file
python3 -m http.server 8080
# or: npx http-server -p 8080

# Open in browser
open http://localhost:8080/payment.html
```

Click **"Pay $0.01 USDC"** and:
1. MetaMask will prompt to sign the payment
2. Facilitator verifies the payment
3. Facilitator settles on-chain
4. You'll see a transaction link!

## What Just Happened?

1. **Browser** created a payment header using EIP-712 signature
2. **Facilitator** verified the signature matches requirements
3. **Facilitator** executed the transfer using EIP-3009 (gasless for payer!)
4. **You** received USDC without the payer paying gas ✨

## Optional: Add Witness Binding

Witness binding proves the payment was created for a specific resource (prevents replay attacks).

```javascript
// After creating payment header, add witness:
const witness = await window.xf.browser.witness.makeEvmWitness(
  window.ethereum,
  account,
  requirements.resource
);
header = window.xf.browser.witness.addWitnessToPaymentHeader(header, witness);
```

Enable witness verification in your facilitator:

```bash
# In facilitator .env
WITNESS_REQUIRED=true
```

## Troubleshooting

### "xf not loaded"
- Check CDN URL or local path
- Open DevTools Console → should see `window.xf`

### "User rejected signature"
- User cancelled MetaMask prompt
- Try again and click "Sign"

### "Insufficient funds"
- Get testnet USDC: https://faucet.circle.com/
- Select "USDC on Base Sepolia"

### "Wrong network"
- MetaMask must be on Base Sepolia (chainId 84532)
- Facilitator must support base-sepolia (check `/supported`)

### "CORS error"
- Facilitator must allow your origin
- Check `Access-Control-Allow-Origin` header
- Our example facilitator has permissive CORS for demos

### "Invalid signature"
- Make sure `payTo`, `amount`, `asset` match exactly
- Check that `network` is "base-sepolia" (not "base")
- Verify `asset` is the correct USDC address

## Next Steps

- **Production**: Use a hosted facilitator or deploy your own
- **Mainnet**: Change `network` to `"base"` and use mainnet USDC
- **Witness**: Add resource binding for stronger security
- **Custom UI**: Style the payment flow to match your brand
- **Server Integration**: Call facilitator from your backend instead

## API Reference

### window.xf (and window.x402 alias)

```typescript
window.xf = {
  version: "iife",

  client: {
    createPaymentHeader(viemClient, x402Version, requirements),
    // ... other client methods
  },

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
};
```

### Facilitator Endpoints

```
GET  /health          → { status: "ok", timestamp: number }
GET  /version         → { version, networks[], witnessRequired }
GET  /supported       → { kinds: PaymentKind[] }
POST /verify          → { isValid, invalidReason? }
POST /settle          → { transaction, networkId }
```

## Resources

- [Full HTML Demo](../examples/html/base-iife-direct.html)
- [Facilitator Setup](../examples/typescript/facilitator/README.md)
- [Witness Specification](../IIFE_AND_WITNESS.md)
- [GitHub](https://github.com/coinbase/x402)

---

**That's it!** You're now accepting payments with zero build tools. Welcome to HTTP 402 🚀
