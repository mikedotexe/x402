// Lightweight, browser-safe surface for IIFE global `x402`.
// Re-exports are intentionally narrow for hackathon console use.
// Both window.x402 (canonical) and window.xf (alias) are exposed.

import * as client from "../client";
import * as schemes from "../schemes";
import * as shared from "../shared";
import * as verifyUtils from "../verify";
import * as facilitatorUtils from "../facilitator";
import * as viemAdapter from "./viem-adapter";
import * as witness from "./witness";

type X402 = {
  version: string;
  client: typeof client;
  schemes: typeof schemes;
  shared: typeof shared;
  verify: typeof verifyUtils;
  facilitator: typeof facilitatorUtils;
  browser: {
    viemAdapter: typeof viemAdapter;
    witness: typeof witness;
  };
};

function attachGlobal(): X402 | undefined {
  const g =
    (globalThis as any) ??
    (typeof self !== "undefined" ? (self as any) : undefined) ??
    (typeof window !== "undefined" ? (window as any) : undefined);

  if (!g) return;

  const api: X402 = {
    version: "iife",
    client,
    schemes,
    shared,
    verify: verifyUtils,
    facilitator: facilitatorUtils,
    browser: {
      viemAdapter,
      witness,
    },
  };

  // If the banner already created g.x402, merge onto it (then footer freezes).
  if (!g.x402) {
    Object.defineProperty(g, "x402", { value: {}, configurable: true, writable: true });
  }
  Object.assign(g.x402, api);

  // Create xf as a convenience alias pointing to the same object
  if (!g.xf) {
    Object.defineProperty(g, "xf", { value: g.x402, configurable: true, writable: true });
  }

  return api;
}

// When bundled as IIFE, this executes once and populates window.x402 and window.xf
attachGlobal();

export type { X402 };
export type XF = X402; // Alias for backward compatibility
