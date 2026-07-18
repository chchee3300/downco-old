// Extracted from sorai-toolkit-converter's and sorai-toolkit-downloader's
// own src/lib/rangeFill.js (byte-identical in both -- pure math, zero
// per-repo divergence, unlike e.g. useTranslation.js which needs `react`
// and can't live in a vanilla runtime global like this one). Computes the
// --range-fill CSS custom property .range-input's CSS reads
// (resources/styles.css) to paint the accent-colored "filled" portion of a
// slider track up to the current value, at rest -- not just on hover/drag.
(function (global) {
  function rangeFillStyle(value, min, max) {
    const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0
    return { '--range-fill': `${pct}%` }
  }

  global.EstellaLib = global.EstellaLib || {};
  global.EstellaLib.rangeFill = { rangeFillStyle };
})(window);
