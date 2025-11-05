/* eslint-env node */
import { config } from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import { verify, settle, checkWitness } from "x402/facilitator";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  createConnectedClient,
  createSigner,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
  Signer,
  ConnectedClient,
  SupportedPaymentKind,
  isSvmSignerWallet,
  type X402Config,
} from "x402/types";

config();

const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || "";
const SVM_PRIVATE_KEY = process.env.SVM_PRIVATE_KEY || "";
const SVM_RPC_URL = process.env.SVM_RPC_URL || "";
const WITNESS_REQUIRED = process.env.WITNESS_REQUIRED === "true";
const PORT = process.env.PORT || 3000;
const VERSION = "0.1.0";

if (!EVM_PRIVATE_KEY && !SVM_PRIVATE_KEY) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// Create X402 config with custom RPC URL if provided
const x402Config: X402Config | undefined = SVM_RPC_URL
  ? { svmConfig: { rpcUrl: SVM_RPC_URL } }
  : undefined;

const app = express();

// CORS middleware - permissive by default for hackathon demos
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type", "x-payment"],
    exposedHeaders: ["x-payment-response"],
  })
);

// Configure express to parse JSON bodies
app.use(express.json());

type VerifyRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

type SettleRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
  });
});

// Version endpoint
app.get("/version", (req: Request, res: Response) => {
  res.json({
    version: VERSION,
    networks: [
      ...(EVM_PRIVATE_KEY ? ["base", "base-sepolia"] : []),
      ...(SVM_PRIVATE_KEY ? ["solana-devnet"] : []),
    ],
    witnessRequired: WITNESS_REQUIRED,
  });
});

app.get("/verify", (req: Request, res: Response) => {
  res.json({
    endpoint: "/verify",
    description: "POST to verify x402 payments",
    body: {
      paymentPayload: "PaymentPayload",
      paymentRequirements: "PaymentRequirements",
    },
  });
});

app.post("/verify", async (req: Request, res: Response) => {
  try {
    const body: any = req.body;
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);

    // Support both paymentHeader (base64 string from HTML demo) and paymentPayload (decoded object)
    let paymentPayload: PaymentPayload;
    if (body.paymentHeader && typeof body.paymentHeader === "string") {
      // Check witness before parsing if required
      try {
        checkWitness(body.paymentHeader, WITNESS_REQUIRED);
      } catch (error: any) {
        return res.status(400).json({
          isValid: false,
          invalidReason: `witness_error: ${error.message}`,
        });
      }

      // Decode base64 header to get payload
      const headerJson = Buffer.from(body.paymentHeader, "base64").toString("utf-8");
      const header = JSON.parse(headerJson);
      paymentPayload = PaymentPayloadSchema.parse(header.payload);
    } else {
      paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);
    }

    // use the correct client/signer based on the requested network
    // svm verify requires a Signer because it signs & simulates the txn
    let client: Signer | ConnectedClient;
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      client = createConnectedClient(paymentRequirements.network);
    } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      client = await createSigner(paymentRequirements.network, SVM_PRIVATE_KEY);
    } else {
      throw new Error("Invalid network");
    }

    // verify
    const valid = await verify(client, paymentPayload, paymentRequirements, x402Config);
    res.json(valid);
  } catch (error) {
    console.error("error", error);
    res.status(400).json({ error: "Invalid request" });
  }
});

app.get("/settle", (req: Request, res: Response) => {
  res.json({
    endpoint: "/settle",
    description: "POST to settle x402 payments",
    body: {
      paymentPayload: "PaymentPayload",
      paymentRequirements: "PaymentRequirements",
    },
  });
});

app.get("/supported", async (req: Request, res: Response) => {
  let kinds: SupportedPaymentKind[] = [];

  // evm
  if (EVM_PRIVATE_KEY) {
    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
    });
  }

  // svm
  if (SVM_PRIVATE_KEY) {
    const signer = await createSigner("solana-devnet", SVM_PRIVATE_KEY);
    const feePayer = isSvmSignerWallet(signer) ? signer.address : undefined;

    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "solana-devnet",
      extra: {
        feePayer,
      },
    });
  }
  res.json({
    kinds,
  });
});

app.post("/settle", async (req: Request, res: Response) => {
  try {
    const body: any = req.body;
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);

    // Support both paymentHeader (base64) and paymentPayload (object)
    let paymentPayload: PaymentPayload;
    if (body.paymentHeader && typeof body.paymentHeader === "string") {
      const headerJson = Buffer.from(body.paymentHeader, "base64").toString("utf-8");
      const header = JSON.parse(headerJson);
      paymentPayload = PaymentPayloadSchema.parse(header.payload);
    } else {
      paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);
    }

    // use the correct private key based on the requested network
    let signer: Signer;
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      signer = await createSigner(paymentRequirements.network, EVM_PRIVATE_KEY);
    } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      signer = await createSigner(paymentRequirements.network, SVM_PRIVATE_KEY);
    } else {
      throw new Error("Invalid network");
    }

    // settle
    const response = await settle(signer, paymentPayload, paymentRequirements, x402Config);

    // Structured logging for successful settlements
    if (response.transaction) {
      const explorerUrls: Record<string, string> = {
        "base": "https://basescan.org",
        "base-sepolia": "https://sepolia.basescan.org",
        "solana-devnet": "https://explorer.solana.com/?cluster=devnet",
      };
      const explorerUrl = explorerUrls[paymentRequirements.network];
      const txUrl = explorerUrl ? `${explorerUrl}/tx/${response.transaction}` : null;

      console.log(
        JSON.stringify({
          event: "settlement_success",
          network: paymentRequirements.network,
          txHash: response.transaction,
          payTo: paymentRequirements.payTo,
          amount: paymentRequirements.amount?.toString(),
          asset: paymentRequirements.asset,
          explorerUrl: txUrl,
          timestamp: new Date().toISOString(),
        })
      );
    }

    res.json(response);
  } catch (error) {
    console.error("error", error);
    res.status(400).json({ error: `Invalid request: ${error}` });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  console.log(`Witness verification: ${WITNESS_REQUIRED ? "REQUIRED" : "optional"}`);
  console.log(`Available endpoints: /health, /version, /supported, /verify, /settle`);
});
