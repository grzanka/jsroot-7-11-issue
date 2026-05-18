// UMD script-tag approach — demonstrates the working workaround.
//
// jsroot's own pre-built UMD bundle (build/jsroot.min.js) was compiled by
// jsroot's own Rollup build with the correct evaluation order. Loading it
// via a <script> tag bypasses the bundler entirely — the browser evaluates
// the file sequentially in a single scope, so the circular dep is resolved
// by jsroot's own internal ordering.
let _umdPromise = null;

function loadUmdBundle(base) {
  if (window.JSROOT) return Promise.resolve(window.JSROOT);
  if (_umdPromise) return _umdPromise;
  _umdPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${base}jsroot.min.js`;
    script.onload = () => {
      window.JSROOT
        ? resolve(window.JSROOT)
        : reject(new Error("JSROOT not found in global scope after load"));
    };
    script.onerror = () => reject(new Error("Failed to load jsroot.min.js"));
    document.head.appendChild(script);
  });
  return _umdPromise;
}

export async function tryUmd(statusEl, plotEl, base = "./") {
  statusEl.textContent = "Loading jsroot UMD bundle via <script> tag …";
  statusEl.className = "status pending";
  plotEl.innerHTML = "";

  try {
    const JSROOT = await loadUmdBundle(base);

    const hist = JSROOT.createHistogram("TH1F", 20);
    hist.fTitle = "UMD bundle";
    hist.fXaxis.fTitle = "x";
    hist.fYaxis.fTitle = "Counts";
    hist.fMinimum = 0;
    hist.fMaximum = 100;
    for (let i = 1; i <= 20; i++) hist.setBinContent(i, i * 5);

    await JSROOT.draw(plotEl, hist, "");
    statusEl.textContent =
      "✓ Success — jsroot UMD bundle evaluates modules in the correct order.";
    statusEl.className = "status ok";
  } catch (err) {
    statusEl.textContent = `✗ ${err.message}`;
    statusEl.className = "status error";
    plotEl.innerHTML = `<pre class="stack">${err.stack}</pre>`;
    console.error("[UMD] jsroot failed:", err);
  }
}
