import { defineConfig } from "tsup";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";

// Base configuration for ESM/CJS builds (Node.js and Bundlers)
const baseConfig = {
  entry: {
    index: "src/index.ts",
    "shared/index": "src/shared/index.ts",
    "shared/evm/index": "src/shared/evm/index.ts",
    "schemes/index": "src/schemes/index.ts",
    "client/index": "src/client/index.ts",
    "verify/index": "src/verify/index.ts",
    "facilitator/index": "src/facilitator/index.ts",
    "types/index": "src/types/index.ts",
    // CRITICAL: Include the browser index for ESM/CJS consumption via 'x402/browser' export
    "browser/index": "src/browser/index.ts",
  },
  dts: { resolve: true },
  sourcemap: true,
  target: "es2020",
  outExtension: ({ format }) => ({
    js: ".js",
    dts: ".d.ts",
  }),
};

// NEW: Browser/IIFE configuration (Static HTML <script> tag)
const browserIifeConfig = {
  entry: {
    // This entry point creates the IIFE bundle that sets the global variable
    "browser/global": "src/browser/global.ts",
  },
  format: "iife" as const,
  platform: "browser" as const,
  // globalName helps tsup optimize, though global.ts defines the actual window properties.
  globalName: "X402",
  outDir: "dist/iife",
  target: "es2020",
  sourcemap: true,
  minify: true,
  treeshake: true,
  // Bundle browser-friendly deps (critical for IIFE)
  noExternal: ["viem", "@noble/curves", "@noble/hashes"],
  esbuildPlugins: [
    NodeModulesPolyfillPlugin(),
    NodeGlobalsPolyfillPlugin({ process: true, buffer: true }),
  ],
  banner: {
    js: `/* x402 Browser Build v${require('./package.json').version} */\n` +
        `/* https://github.com/coinbase/x402 */`
  },
  footer: {
    js: `/* Global: window.X402, Shorthand: window.$pay */`
  }
};

export default defineConfig([
  // ESM (existing)
  {
    ...baseConfig,
    format: "esm",
    outDir: "dist/esm",
    clean: true, // Clean only on the first build
  },
  // CJS (existing)
  {
    ...baseConfig,
    format: "cjs",
    outDir: "dist/cjs",
    clean: false,
  },
  // IIFE (new browser build)
  {
    ...browserIifeConfig,
    clean: false,
  },
]);
