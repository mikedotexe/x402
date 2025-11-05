/**
 * IIFE Bundle Smoke Test
 *
 * Verifies that the browser IIFE bundle:
 * - Builds correctly with proper structure
 * - Contains expected code patterns
 * - Has proper globals and freeze logic
 *
 * Note: Full runtime testing requires a real browser environment.
 * This test focuses on build artifact validation.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, statSync } from "fs";
import { join } from "path";

describe("IIFE Bundle Smoke Tests", () => {
  let iifeCode: string;
  let iifePath: string;

  beforeAll(() => {
    // Load the IIFE bundle
    iifePath = join(__dirname, "../dist/x402.iife.global.js");
    iifeCode = readFileSync(iifePath, "utf-8");
  });

  it("bundle file exists and has reasonable size", () => {
    const stats = statSync(iifePath);
    expect(stats.size).toBeGreaterThan(500000); // Should be > 500KB (minified viem + x402)
    expect(stats.size).toBeLessThan(5000000); // Should be < 5MB (minified)
  });

  it("contains x402 banner", () => {
    expect(iifeCode).toContain("/* x402");
    expect(iifeCode).toContain("IIFE build */");
    expect(iifeCode).toContain("https://github.com/coinbase/x402");
  });

  it("creates xf global with Object.defineProperty", () => {
    expect(iifeCode).toContain("Object.defineProperty(globalThis, 'xf'");
    expect(iifeCode).toContain("configurable: false");
    expect(iifeCode).toContain("enumerable: true");
  });

  it("creates x402 alias with Object.defineProperty", () => {
    expect(iifeCode).toContain("Object.defineProperty(globalThis, 'x402'");
  });

  it("x402 alias points to xf global", () => {
    expect(iifeCode).toContain("value: globalThis.xf");
  });

  it("contains viem client factory", () => {
    expect(iifeCode).toContain("createWalletClient");
  });

  it("contains witness canonicalization logic", () => {
    expect(iifeCode).toContain("canonicalizeResource");
    // Check for URL canonicalization logic
    expect(iifeCode).toMatch(/hash.*=.*""/); // Removes fragment
    expect(iifeCode).toMatch(/toLowerCase/); // Lowercases host
  });

  it("contains witness creation logic", () => {
    expect(iifeCode).toContain("makeEvmWitness");
    expect(iifeCode).toContain("personal_sign");
  });

  it("contains payment header utilities", () => {
    expect(iifeCode).toContain("addWitnessToPaymentHeader");
    expect(iifeCode).toContain("extractWitnessFromPaymentHeader");
  });

  it("contains createPaymentHeader", () => {
    expect(iifeCode).toContain("createPaymentHeader");
  });

  it("contains viem adapter utilities", () => {
    expect(iifeCode).toContain("createViemClientFromProvider");
    expect(iifeCode).toContain("getProviderChainId");
    expect(iifeCode).toContain("getProviderAccounts");
  });

  it("contains EIP-712 signing logic", () => {
    expect(iifeCode).toContain("signTypedData");
  });

  it("bundles expected chains (Base, Sepolia)", () => {
    expect(iifeCode).toMatch(/base.*sepolia/i);
  });

  it("has IIFE wrapper structure", () => {
    // Modern build uses arrow function: var xf = (() => {
    expect(iifeCode).toMatch(/var xf\s*=\s*\(/);
  });
});
