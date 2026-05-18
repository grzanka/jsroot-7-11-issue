// ESM import attempt — demonstrates the broken evaluation order.
//
// Rollup bundles jsroot into a chunk. When the chunk first loads, the
// top-level code in ObjectPainter.mjs runs:
//
//   Object.assign(internals.jsroot, { ObjectPainter, cleanup, resize });
//
// Because Rollup evaluated ObjectPainter.mjs *before* core.mjs finished
// setting up `internals`, the value is undefined → TypeError.
export async function tryEsm(statusEl, plotEl) {
  statusEl.textContent = "Loading jsroot via ESM import() …";
  statusEl.className = "status pending";
  plotEl.innerHTML = "";

  try {
    const JSROOT = await import("jsroot");

    const hist = JSROOT.createHistogram("TH1F", 20);
    hist.fTitle = "ESM import";
    hist.fXaxis.fTitle = "x";
    hist.fYaxis.fTitle = "Counts";
    hist.fMinimum = 0;
    hist.fMaximum = 100;
    // Fill with dummy data so there is something to see if it works
    for (let i = 1; i <= 20; i++) hist.setBinContent(i, i * 5);

    await JSROOT.draw(plotEl, hist, "");
    statusEl.textContent =
      "✓ Success — this version of jsroot has no evaluation-order bug.";
    statusEl.className = "status ok";
  } catch (err) {
    statusEl.textContent = `✗ ${err.message}`;
    statusEl.className = "status error";
    plotEl.innerHTML = `<pre class="stack">${err.stack}</pre>`;
    console.error("[ESM] jsroot failed:", err);
  }
}
