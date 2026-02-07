/**
 * Rounding and numeric utility helpers.
 * All functions are pure.
 * @module utils/number-utils
 */

/**
 * Round a value to a fixed number of decimals.
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
export function roundToDecimals(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(Number(value) * factor) / factor;
}

/**
 * Apply a rounding mode to a value.
 * @param {number} value
 * @param {'none'|'nearest5'|'up'|'truncate'} [mode='none']
 * @param {number} [decimals=2]
 * @returns {number}
 */
export function applyRounding(value, mode = 'none', decimals = 2) {
  value = Number(value);
  if (isNaN(value)) return NaN;
  if (mode === 'none') return roundToDecimals(value, decimals);

  if (mode === 'nearest5') {
    // Round to nearest 0.05, then to requested decimals
    const step = 0.05;
    const rounded = Math.round(value / step) * step;
    return roundToDecimals(rounded, decimals);
  }

  if (mode === 'up') {
    // Round up (ceiling) to given decimals
    const factor = Math.pow(10, decimals);
    return Math.ceil(value * factor) / factor;
  }

  if (mode === 'truncate') {
    // Truncate (cut off) to given decimals
    const factor = Math.pow(10, decimals);
    return Math.trunc(value * factor) / factor;
  }

  return roundToDecimals(value, decimals);
}
