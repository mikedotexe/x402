# x402 TypeScript Facilitator

Production-ready facilitator for x402 payments on EVM (Base/Base Sepolia) and SVM (Solana Devnet).

## Features

- ✅ **Multi-chain support**: Base, Base Sepolia, Solana Devnet
- ✅ **CORS enabled**: Works with browser apps (configurable)
- ✅ **Witness verification**: Optional EIP-191 resource binding
- ✅ **Structured logging**: JSON logs with transaction details
- ✅ **Health checks**: `/health` and `/version` endpoints
- ✅ **Type-safe**: Full TypeScript with Zod validation

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Add your private key to .env
# EVM_PRIVATE_KEY=0x...your-key-here

# Start the facilitator
pnpm dev
```

The facilitator will start on `http://localhost:3000`.

## Environment Variables

### Required

```bash
# At least one chain is required
EVM_PRIVATE_KEY=0x...    # For Base/Base Sepolia
SVM_PRIVATE_KEY=...       # For Solana Devnet (optional)
```

### Optional

```bash
# Custom RPC endpoints
SVM_RPC_URL=https://api.devnet.solana.com

# Witness verification
WITNESS_REQUIRED=false    # Set to "true" to require witness on all payments

# Server
PORT=3000
NODE_ENV=development
```

## API Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1704067200000
}
```

### GET /version

Version and configuration info.

**Response:**
```json
{
  "version": "0.1.0",
  "networks": ["base", "base-sepolia", "solana-devnet"],
  "witnessRequired": false
}
```

### GET /supported

Returns supported payment kinds.

**Response:**
```json
{
  "kinds": [
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "base-sepolia"
    }
  ]
}
```

### POST /verify

Verifies a payment header without executing it.

**Request Body:**
```json
{
  "x402Version": 1,
  "paymentHeader": "base64-encoded-header",
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base-sepolia",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "amount": "10000",
    "payTo": "0xRecipientAddress",
    "resource": "https://example.com/api/data"
  }
}
```

**Response (Success):**
```json
{
  "isValid": true
}
```

**Response (Failure):**
```json
{
  "isValid": false,
  "invalidReason": "witness_error: digest_mismatch"
}
```

### POST /settle

Executes the payment on-chain.

**Request Body:** Same as `/verify`

**Response:**
```json
{
  "transaction": "0x1234...abcd",
  "networkId": "base-sepolia"
}
```

## Witness Verification

Enable witness verification to bind payments to specific resources.

```bash
# .env
WITNESS_REQUIRED=true
```

## Testing

See [Quickstart Guide](../../../docs/quickstart-html.md) for end-to-end testing with the HTML demo.

## License

Apache-2.0
