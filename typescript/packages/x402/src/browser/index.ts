// Keep existing browser exports, but ensure `global.ts` side-effect runs
export * from "./global";
export * from "../client";
export * from "../schemes";
export * from "../shared";

// Re-export with namespaces to avoid conflicts between verify and facilitator
export * as verifyUtils from "../verify";
export * as facilitatorUtils from "../facilitator";

// Browser-specific utilities
export * from "./viem-adapter";
export * from "./witness";
