// Lightweight, browser-safe surface for IIFE global `xf`.
// Re-exports are intentionally narrow for hackathon console use.

import * as client from "../client";
import * as schemes from "../schemes";
import * as shared from "../shared";
import * as verify from "../verify";
import * as facilitator from "../facilitator";

type XF = {
  version: string;
  client: typeof client;
  schemes: typeof schemes;
  shared: typeof shared;
  verify: typeof verify;
  facilitator: typeof facilitator;
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
    verify,
    facilitator,
  };

  // If the banner already created g.xf, merge onto it (then footer freezes).
  if (!g.xf) {
    Object.defineProperty(g, "xf", { value: {}, configurable: true, writable: true });
  }
  Object.assign(g.xf, api);
  return api;
}

// When bundled as IIFE, this executes once and populates window.xf
attachGlobal();

export type { XF };
