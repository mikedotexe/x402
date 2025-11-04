import { defineConfig } from "tsup";

const GLOBAL = "xf";

export default defineConfig((opts) => ({
  entry: ["src/index.ts"],
  format: ["esm", "cjs", "iife"],
  globalName: GLOBAL,
  dts: true,
  sourcemap: true,
  clean: !opts.watch,
  minify: !opts.watch,
  splitting: false,
  treeshake: true,
  target: ["es2020"],
  outDir: "dist",
  skipNodeModulesBundle: true,

  esbuildOptions(options, ctx) {
    if (ctx.format === "iife") {
      options.banner = {
        js: `
(function(){
  const g = (typeof globalThis!=="undefined")?globalThis:
            (typeof self!=="undefined")?self:
            (typeof window!=="undefined")?window:undefined;
  if (!g) return;
  if (!Object.prototype.hasOwnProperty.call(g, "${GLOBAL}")) {
    Object.defineProperty(g, "${GLOBAL}", { value: {}, configurable: true, writable: true });
  }
})();`.trim(),
      };
      options.footer = {
        js: `
(function(){
  try {
    const g = (typeof globalThis!=="undefined")?globalThis:
              (typeof self!=="undefined")?self:
              (typeof window!=="undefined")?window:undefined;
    if (!g || !g.${GLOBAL}) return;
    const seal = (o)=>{ try {
      Object.freeze(o);
      for (const k of Object.getOwnPropertyNames(o)) {
        const v = o[k];
        if (v && (typeof v==="object"||typeof v==="function") && !Object.isFrozen(v)) seal(v);
      }
      return o;
    } catch(_){} };
    seal(g.${GLOBAL});
    try { Object.defineProperty(g, "${GLOBAL}", { configurable:false, writable:false }); } catch(_){}
  } catch (_){}
})();`.trim(),
      };
    }
  },
}));
