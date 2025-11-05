const fs = require('fs');
const vm = require('vm');
const { TextEncoder, TextDecoder } = require('util');

// Load the IIFE
const iifeCode = fs.readFileSync('dist/umd/browser.global.js', 'utf8');

// Create a sandbox with browser-like globals
const sandbox = {
  globalThis: {},
  console: console,
  Object: Object,
  Array: Array,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Error: Error,
  TypeError: TypeError,
  TextEncoder: TextEncoder,
  TextDecoder: TextDecoder,
  Buffer: Buffer,
  process: { env: {} },
};

sandbox.globalThis.window = sandbox.globalThis;
sandbox.globalThis.TextEncoder = TextEncoder;
sandbox.globalThis.TextDecoder = TextDecoder;

try {
  // Execute IIFE in sandbox
  console.log('Loading IIFE (3.8MB)...');
  vm.runInNewContext(iifeCode, sandbox, { timeout: 10000 });

  const xf = sandbox.globalThis.xf;

  console.log('\n=== IIFE Global Structure Test ===\n');

  // Core structure
  console.log('✅ window.xf exists:', typeof xf !== 'undefined');
  console.log('✅ xf.version:', xf?.version);
  console.log('✅ xf.client exists:', typeof xf?.client === 'object');
  console.log('✅ xf.browser exists:', typeof xf?.browser === 'object');
  console.log('✅ xf.facilitator exists:', typeof xf?.facilitator === 'object');
  console.log('✅ xf.verify exists:', typeof xf?.verify === 'object');
  console.log('✅ xf.schemes exists:', typeof xf?.schemes === 'object');
  console.log('✅ xf.shared exists:', typeof xf?.shared === 'object');

  // Browser utilities
  console.log('\n=== Browser Utilities ===\n');
  console.log('✅ xf.browser.viemAdapter exists:', typeof xf?.browser?.viemAdapter === 'object');
  console.log('✅ xf.browser.witness exists:', typeof xf?.browser?.witness === 'object');

  // Key functions
  console.log('\n=== Key Functions ===\n');
  const viemAdapter = xf?.browser?.viemAdapter;
  console.log('✅ createViemClientFromProvider:', typeof viemAdapter?.createViemClientFromProvider === 'function');
  console.log('✅ getProviderChainId:', typeof viemAdapter?.getProviderChainId === 'function');
  console.log('✅ getProviderAccounts:', typeof viemAdapter?.getProviderAccounts === 'function');

  const witness = xf?.browser?.witness;
  console.log('✅ canonicalizeResource:', typeof witness?.canonicalizeResource === 'function');
  console.log('✅ makeEvmWitness:', typeof witness?.makeEvmWitness === 'function');
  console.log('✅ addWitnessToPaymentHeader:', typeof witness?.addWitnessToPaymentHeader === 'function');
  console.log('✅ extractWitnessFromPaymentHeader:', typeof witness?.extractWitnessFromPaymentHeader === 'function');

  // Security
  console.log('\n=== Security ===\n');
  console.log('✅ xf is frozen:', Object.isFrozen(xf));
  const descriptor = Object.getOwnPropertyDescriptor(sandbox.globalThis, 'xf');
  console.log('✅ xf is not configurable:', !descriptor?.configurable);
  console.log('✅ xf is not writable:', !descriptor?.writable);

  // Test canonicalization function
  console.log('\n=== Functional Test ===\n');
  const testUrl = 'https://Example.com:443/path?q=1#frag';
  const canonical = witness.canonicalizeResource(testUrl);
  const expected = 'https://example.com/path?q=1';
  console.log('Input:', testUrl);
  console.log('Output:', canonical);
  console.log('Expected:', expected);
  console.log('✅ Canonicalization works:', canonical === expected);

  console.log('\n=== All IIFE Tests Passed! ===\n');
  process.exit(0);

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
