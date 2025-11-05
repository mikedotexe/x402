import { defineConfig } from "tsup";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";

const GLOBAL_NAME = "x402";
const GLOBAL_ALIAS = "xf"; // Convenience alias
const PKG_NAME = "x402";
const PKG_VERSION = "0.6.6"; // TODO: Import from package.json when tsup supports it

// Banner for builds
const banner = (format: string) =>
  `/* ${PKG_NAME} v${PKG_VERSION} - ${format} build */\n` +
  `/* https://github.com/coinbase/x402 */`;

// Footer to lock down the global and alias in IIFE
const footerRedefiningGlobal = `
// Freeze x402 global (canonical)
Object.defineProperty(globalThis, '${GLOBAL_NAME}', {
  value: ${GLOBAL_NAME},
  enumerable: true,
  configurable: false,
});
// Freeze xf alias (convenience)
Object.defineProperty(globalThis, '${GLOBAL_ALIAS}', {
  value: globalThis.${GLOBAL_NAME},
  enumerable: true,
  configurable: false,
});
`;

export default defineConfig([
  // ============================================================================
  // 1. CommonJS build for Node.js
  // ============================================================================
  {
    name: "cjs",
    entry: ["src/index.ts"],
    outDir: "dist/cjs",
    format: ["cjs"],
    bundle: false,
    splitting: false,
    dts: {
      resolve: true,
      entry: "src/index.ts",
    },
    sourcemap: true,
    minify: false,
    clean: true,
    keepNames: true,
    banner: { js: banner("CJS") },
  },

  // ============================================================================
  // 2. ESM build for modern bundlers
  // ============================================================================
  {
    name: "esm",
    entry: ["src/index.ts"],
    outDir: "dist/esm",
    format: ["esm"],
    shims: true,
    bundle: false,
    splitting: false,
    dts: {
      resolve: true,
      entry: "src/index.ts",
    },
    sourcemap: true,
    minify: false,
    clean: true,
    keepNames: true,
    banner: { js: banner("ESM") },
  },

  // ============================================================================
  // 3. Browser IIFE build with viem + browser utilities
  // ============================================================================
  {
    name: "browser-iife",
    entry: {
      browser: "src/browser/index.ts",
    },
    outDir: "dist/umd",
    format: ["iife"],
    globalName: GLOBAL_NAME,
    bundle: true,
    splitting: false,
    platform: "browser",
    target: ["es2020"],
    // Bundle everything for browsers
    noExternal: [/.*/],
    esbuildPlugins: [
      NodeModulesPolyfillPlugin(),
      NodeGlobalsPolyfillPlugin({ process: true, buffer: true }),
    ],
    esbuildOptions(options) {
      // Add initializer banner for global setup
      options.banner = {
        js: `
${banner("IIFE")}
(function(){
  const g = (typeof globalThis!=="undefined")?globalThis:
            (typeof self!=="undefined")?self:
            (typeof window!=="undefined")?window:undefined;
  if (!g) return;
  if (!Object.prototype.hasOwnProperty.call(g, "${GLOBAL_NAME}")) {
    Object.defineProperty(g, "${GLOBAL_NAME}", { value: {}, configurable: true, writable: true });
  }
})();`.trim(),
      };
    },
    dts: false, // No types needed for IIFE
    sourcemap: true,
    minify: false,
    clean: true,
    keepNames: true,
    footer: { js: footerRedefiningGlobal },
  },
]);
