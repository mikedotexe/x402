
// Create a stable global for IIFE builds: window.X402 and $pay (demo sugar)
import * as X402 from "./index";

try {
  // Freeze a stable global and make it enumerable but not reconfigurable
  Object.defineProperty(globalThis as any, "X402", {
    value: X402,
    enumerable: true,
    configurable: false,
    writable: false,
  });
  // Add convenience shorthand
  (globalThis as any).$pay = X402.evm.quickPay;
} catch (error) {
  // Best-effort fallback
  (globalThis as any).X402 = X402;
  (globalThis as any).$pay = (X402 as any).evm.quickPay;
}

export default X402;
