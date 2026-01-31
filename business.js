// Business logic pure functions for calculator
// Exports: computeSell, computeCost, computeMargin, addTax, removeTax, applyRounding, roundToDecimals

function computeSell(cost, marginPercent) {
  const m = Number(marginPercent) / 100;
  if (isNaN(cost) || isNaN(m)) return NaN;
  const denom = 1 - m;
  if (denom === 0) throw new Error('DivisionByZero');
  if (denom < 0) throw new Error('InvalidMargin');
  return Number(cost) / denom;
}

function computeCost(sell, marginPercent) {
  const m = Number(marginPercent) / 100;
  if (isNaN(sell) || isNaN(m)) return NaN;
  return Number(sell) * (1 - m);
}

function computeMargin(cost, sell) {
  cost = Number(cost);
  sell = Number(sell);
  if (isNaN(cost) || isNaN(sell)) return NaN;
  if (sell === 0) throw new Error('DivisionByZero');
  return ((sell - cost) / sell) * 100;
}

function addTax(amount, ratePercent) {
  const r = Number(ratePercent) / 100;
  if (isNaN(amount) || isNaN(r)) return NaN;
  return Number(amount) * (1 + r);
}

function removeTax(amountWithTax, ratePercent) {
  const r = Number(ratePercent) / 100;
  if (isNaN(amountWithTax) || isNaN(r)) return NaN;
  const denom = 1 + r;
  if (denom === 0) throw new Error('DivisionByZero');
  return Number(amountWithTax) / denom;
}

// Rounding helpers
function roundToDecimals(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(Number(value) * factor) / factor;
}

// applyRounding modes:
// mode: 'none' | 'nearest5' | 'up'
// decimals: number of decimals to apply after rounding step
function applyRounding(value, mode = 'none', decimals = 2) {
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
    // Use Math.trunc for symmetric truncation towards zero
    return Math.trunc(value * factor) / factor;
  }

  return roundToDecimals(value, decimals);
}

module.exports = {
  computeSell,
  computeCost,
  computeMargin,
  addTax,
  removeTax,
  applyRounding,
  roundToDecimals,
};

// Also expose in browser global if available
try {
  if (typeof window !== 'undefined') {
    window.business = {
      computeSell,
      computeCost,
      computeMargin,
      addTax,
      removeTax,
      applyRounding,
      roundToDecimals,
    };
  }
} catch (e) {
  // ignore
}
