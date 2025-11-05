// Lightweight, browser-safe surface for IIFE global `xf`.
// Re-exports are intentionally narrow for hackathon console use.
// Both window.xf (canonical) and window.x402 (alias) are exposed.

import * as client from "../client";
import * as schemes from "../schemes";
import * as shared from "../shared";
import * as verifyUtils from "../verify";
import * as facilitatorUtils from "../facilitator";
import * as viemAdapter from "./viem-adapter";
import * as witness from "./witness";

type XF = {
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

function attachGlobal(): XF | undefined {
  const g =
    (globalThis as any) ??
    (typeof self !== "undefined" ? (self as any) : undefined) ??
    (typeof window !== "undefined" ? (window as any) : undefined);

  if (!g) return;

  const api: XF = {
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

  // If the banner already created g.xf, merge onto it (then footer freezes).
  if (!g.xf) {
    Object.defineProperty(g, "xf", { value: {}, configurable: true, writable: true });
  }
  Object.assign(g.xf, api);

  // Create x402 as a convenience alias pointing to the same object
  if (!g.x402) {
    Object.defineProperty(g, "x402", { value: g.xf, configurable: true, writable: true });
  }

  return api;
}

// When bundled as IIFE, this executes once and populates window.xf and window.x402
attachGlobal();

export type { XF };
export type X402 = XF; // Alias for backward compatibility
