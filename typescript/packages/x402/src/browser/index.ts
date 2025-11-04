// IIFE browser exports - comprehensive API for window.xf
// Includes global setup, chain-specific helpers, and all core modules

// Keep existing browser exports, but ensure `global.ts` side-effect runs
export * from "./global";
export * from "../client";
export * from "../schemes";
export * from "../shared";

// Re-export with namespaces to avoid conflicts between verify and facilitator
export * as verifyUtils from "../verify";
export * as facilitatorUtils from "../facilitator";

// Browser-specific utilities (EVM-focused for IIFE)
export * from "./viem-adapter";
export * from "./witness";

// Chain-specific browser modules (namespace exports)
export * as evm from "./evm";
export * as svm from "./svm";
export * as near from "./near";
export * as near_delegate from "./near_delegate";

// Re-export safe types for browser usage
export type { PaymentRequirements } from "../types/verify";
export type { X402Config } from "../types/config";
