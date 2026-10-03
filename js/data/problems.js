/* =====================================================================
   problems.js — shared helpers for sample problems and practice mode.
   Individual modules own their own sample lists & practice generators;
   this file just provides small utilities used across modules.
   ===================================================================== */
const Problems = (function () {
  const randInt = (a, b, step = 1) => a + step * Math.floor(Math.random() * ((b - a) / step + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  return { randInt, pick };
})();
if (typeof window !== 'undefined') window.Problems = Problems;
