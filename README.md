# jsroot 7.11.0 — circular dependency evaluation-order bug when bundled via Vite/Rollup

**Live demo**: https://grzanka.github.io/jsroot-7-11-issue/

---

## Upstream issue report

> Copy the section below as the body of a new issue at
> https://github.com/root-project/jsroot/issues

---

### Title

`TypeError: can't access property "jsroot" of undefined` (ObjectPainter.mjs:1828) — regression in 7.11.0 when bundled via Vite / Rollup

---

### Environment

| | |
|---|---|
| jsroot | **7.11.0** (worked in 7.10.3) |
| Bundler | Vite 6 / Rollup 4 (ESM bundling path) |
| Browsers | Chrome, Firefox — both affected |

---

### Symptom

After upgrading from 7.10.3 to 7.11.0, any Vite/Rollup project that bundles
jsroot via ESM gets this error on every call that touches jsroot:

```
TypeError: can't access property "jsroot" of undefined
    ObjectPainter.mjs:1828
```

The error is **permanent for the lifetime of the page** — retrying (even with
exponential backoff) always fails because the broken module state is cached by
the module system.

---

### Root cause

jsroot has a circular dependency between its own modules:

```
main.mjs → core.mjs
main.mjs → ObjectPainter.mjs → core.mjs   ← circular
```

At the **top level** of `ObjectPainter.mjs` (line 1828), module evaluation
code runs:

```js
// ObjectPainter.mjs — executes at module evaluation time, not at call time
Object.assign(internals.jsroot, { ObjectPainter, cleanup, resize });
```

`internals` is imported from `core.mjs`. When a bundler linearises the
circular dependency it must choose a module evaluation order. If it evaluates
`ObjectPainter.mjs` before `core.mjs` has had a chance to assign `internals`,
then `internals` is `undefined` at line 1828 and the assignment throws.

---

### Why 7.10.3 worked but 7.11.0 does not

The circular dependency was **always present**, but Rollup's evaluation order
happened to be correct in 7.10.3.

jsroot 7.11.0 added `import('@resvg/resvg-js')` in `BasePainter.mjs` for
Node.js PNG support. Since `@resvg/resvg-js` is a Node.js native addon
(a `.node` binary), any browser project **must** alias it to a browser-safe
stub — otherwise the build fails immediately:

```
[UNLOADABLE_DEPENDENCY] Could not load ...resvgjs.linux-x64-gnu.node
```

A typical alias:

```js
// vite.config.js
resolve: {
  alias: { "@resvg/resvg-js": "./src/shims/resvg-js.js" }
}
```

This alias introduces a **cross-package dynamic import**:
`node_modules/jsroot/…` → `src/shims/resvg-js.js`. Rollup treats this
boundary differently when splitting chunks, which **alters the module
evaluation order** of the static import graph. The altered order evaluates
`ObjectPainter.mjs` before `core.mjs`, exposing the latent circular dep.

**Nothing changed in `ObjectPainter.mjs` or `core.mjs` between 7.10.3 and
7.11.0.** The only change is the new `@resvg/resvg-js` import, which — by
forcing the alias — changes the bundler's chunk topology.

---

### Minimal reproduction

See the companion repository (link above / same repo as this README) for a
self-contained Vite 6 project with two side-by-side demos:

1. **Broken** — `import("jsroot")` via Vite/Rollup → `TypeError` at line 1828
2. **Fixed** — load `jsroot.min.js` via `<script>` tag → works correctly

**Key files:**

```
vite.config.js          ← @resvg/resvg-js alias (required; also the trigger)
src/esm-demo.js         ← broken approach
src/umd-demo.js         ← working workaround
src/shims/resvg-js.js   ← browser stub for @resvg/resvg-js
index.html              ← interactive comparison page
```

---

### Workaround (what we do today)

Load jsroot's own pre-built UMD bundle (`build/jsroot.min.js`) via a
`<script>` tag instead of `import("jsroot")`. jsroot's own Rollup build
bakes in the correct evaluation order. The browser evaluates the file
sequentially in a single scope — no circular dep linearisation issue.

```js
// Copy node_modules/jsroot/build/jsroot.min.js to your static folder,
// then load at runtime:
function loadJsroot() {
  if (window.JSROOT) return Promise.resolve(window.JSROOT);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/jsroot.min.js";
    s.onload = () => window.JSROOT ? resolve(window.JSROOT) : reject(new Error("JSROOT missing"));
    s.onerror = () => reject(new Error("Failed to load jsroot.min.js"));
    document.head.appendChild(s);
  });
}
```

---

### Suggested fix

The `Object.assign(internals.jsroot, …)` call runs at **module evaluation
time** (top-level code), making it fragile against any bundler that changes
chunk evaluation order. Deferring it to the first actual use would make jsroot
robust against any bundler topology:

```js
// Option A — lazy initialisation in core.mjs: ensure `internals` is
// fully assigned before any other module can read it, e.g. by restructuring
// the export so it is never used before the module finishes evaluating.

// Option B — defer the Object.assign to a function called explicitly after
// all modules have loaded, rather than at module evaluation time.

// Option C — document build/jsroot.min.js as the recommended browser
// integration path and note that direct ESM bundling has circular-dep
// caveats that are sensitive to bundler chunk-split decisions.
```

---

## Additional note: Rolldown (Vite 8)

Vite 8 replaced Rollup with **Rolldown** as the bundler. With Rolldown the
build-time error changes character: even a TypeScript **type-only** import
(`import type * as JSROOT from "jsroot"`) causes Rolldown to crawl the full
transitive dependency graph and attempt to load `resvgjs.linux-x64-gnu.node`
as UTF-8 JavaScript:

```
[UNLOADABLE_DEPENDENCY] Could not load resvgjs.linux-x64-gnu.node
 - stream did not contain valid UTF-8
```

The `@resvg/resvg-js` → stub alias is therefore required for **Vite 8** as
well, even when jsroot is only used for its TypeScript types.

---

## Run locally

```sh
npm install
npm run dev      # dev server — http://localhost:5173
npm run build    # production build → dist/
npm run preview  # serve dist/ locally
```

The Vite plugin in `vite.config.js` copies `jsroot.min.js` from
`node_modules/jsroot/build/` into `public/` automatically on startup.

## Deploy to GitHub Pages

Push to `main` — the included GitHub Actions workflow builds the project and
deploys `dist/` to GitHub Pages automatically. Enable Pages in the repository
settings (Settings → Pages → Source: GitHub Actions) before the first push.
