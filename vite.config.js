import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths work with any GitHub Pages base URL
  base: "./",
  plugins: [
    {
      name: "copy-jsroot-umd",
      // buildStart fires for both `vite dev` and `vite build` in Vite 6+.
      // Copies jsroot's own pre-built UMD bundle into public/ so it can be
      // loaded via a <script> tag without going through Rollup's bundler.
      buildStart() {
        mkdirSync(fileURLToPath(new URL("./public", import.meta.url)), {
          recursive: true,
        });
        copyFileSync(
          fileURLToPath(
            new URL("./node_modules/jsroot/build/jsroot.min.js", import.meta.url),
          ),
          fileURLToPath(new URL("./public/jsroot.min.js", import.meta.url)),
        );
      },
    },
  ],
  resolve: {
    alias: {
      // @resvg/resvg-js is a Node.js native addon (.node binary) added as a
      // transitive dependency in jsroot 7.11.0. Without this alias the build
      // fails because Rollup cannot load a native binary as JavaScript.
      // This alias is the KEY trigger: it introduces a cross-package import
      // (node_modules/jsroot → src/shims/) that changes how Rollup splits
      // chunks, which alters the module evaluation order and exposes the
      // pre-existing circular dependency between core.mjs and ObjectPainter.mjs.
      "@resvg/resvg-js": fileURLToPath(
        new URL("./src/shims/resvg-js.js", import.meta.url),
      ),
    },
  },
});
