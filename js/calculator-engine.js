
// Business math helpers (kept local to the engine)
// Margin (%) is treated as a percent of sell price (gross margin).
function computeSell(cost, marginPercent) {
    const m = Number(marginPercent) / 100;
    if (isNaN(cost) || isNaN(m)) return NaN;
    const denom = 1 - m;
    if (denom === 0) throw new Error('DivisionByZero');
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

// Markup (%) = (profit / cost) * 100
function computeMarkup(cost, sell) {
    cost = Number(cost);
    sell = Number(sell);
    if (isNaN(cost) || isNaN(sell)) return NaN;
    if (cost === 0) throw new Error('DivisionByZero');
    return ((sell - cost) / cost) * 100;
}

function computeSellFromMarkup(cost, markupPercent) {
    const m = Number(markupPercent) / 100;
    if (isNaN(cost) || isNaN(m)) return NaN;
    return Number(cost) * (1 + m);
}

function computeCostFromMarkup(sell, markupPercent) {
    const m = Number(markupPercent) / 100;
    if (isNaN(sell) || isNaN(m)) return NaN;
    const denom = 1 + m;
    if (denom === 0) throw new Error('DivisionByZero');
    return Number(sell) / denom;
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
// mode: 'none' | 'nearest5' | 'up' | 'truncate'
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
        return Math.trunc(value * factor) / factor;
    }

    return roundToDecimals(value, decimals);
}

class CalculatorEngine {
    constructor(settings = {}) {
        // --- STATE ---
        this.entries = [];
        this.currentInput = "0";
        this.accumulator = 0;
        this.grandTotal = 0;
        
        this.pendingMultDivOp = null;
        this.multDivOperand = null;
        this.isReplaying = false; // Flag to prevent history duplication during recalculation
        
        // Input State
        this.isNewSequence = true;
        this.errorState = false;
        this.totalPendingState = { 1: false };
        this.lastOperation = null; // Stores { op: 'x', operand: 10 } for constant calc
        this.lastAddSubValue = null;
        this.lastAddSubOp = null;
        this.pendingAddSubOp = null;
        this.addSubOperand = null;
        this.awaitingAddSubTotal = false;
        this.addSubResults = [];
        this.addSubTotalPendingClear = false;
        // Add/Sub chaining state (make + and - behave like x/÷)
        this.pendingAddSubOp = null;
        this.addSubOperand = null;
        this.awaitingAddSubTotal = false;
        this.addSubResults = [];
        this.addSubTotalPendingClear = false;
        this.lastMultDivResult = null;
        this.awaitingMultDivTotal = false;
        this.multDivTotalPendingClear = false;
        this.multDivResults = [];
        this.gtPending = false;
        this.pendingDelta = null;
        this.pendingPowerBase = null;
        this.addModeBuffer = "";

        // Undo/Redo
        this.undoStack = [];
        this.redoStack = [];

        // Memory
        this.memoryRegister = 0;
        this.memoryStack = [];
        this.memoryMode = 'algebraic'; // 'algebraic' | 'stack'
        this.memoryMax = 8;

        // Business Logic State
        this.taxRate = 22; // Default
        this.marginPercent = 0;
        this.markupPercent = 0;
        this.costValue = null;
        this.sellValue = null;
        this.pricingMode = 'margin'; // 'margin' | 'markup'
        this.awaitingRate = false;
        this.constantK = null;
        this.awaitingK = false;
        this.kInitialValue = null;
        this.kInitialFromDisplay = false;

        // Settings (default)
        this.settings = {
            roundingMode: 'none',   // none, truncate, up
            decimals: 2,
            isFloat: false,
            addMode: false,
            accumulateGT: false, // Will be set by switch
            ...settings
        };
        
        // Callbacks for UI updates (to be assigned by UI)
        this.onDisplayUpdate = (val) => {};
        this.onStatusUpdate = (status) => {}; // New: { acc1: bool, acc2: bool, gt: bool, error: bool, minus: bool }
        this.onTapePrint = (entry) => {};
        this.onTapeRefresh = (entries) => {}; 
        this.onError = (msg) => {};
        this.onMemoryUpdate = (memory) => {};
        this.onRateUpdate = (rate) => {};
    }

    // --- SETTINGS ---
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        if (newSettings && typeof newSettings.memoryMode === 'string') {
            this.memoryMode = newSettings.memoryMode;
            this._emitMemoryUpdate();
        }
    }

    // --- UNDO / REDO ---
    _snapshotEntries(entries = this.entries) {
        return entries.map((entry) => ({ ...entry }));
    }

    _checkpoint() {
        if (this.isReplaying) return;
        this.undoStack.push(this._snapshotEntries());
        if (this.undoStack.length > 200) this.undoStack.shift();
        this.redoStack = [];
    }

    _restoreSnapshot(snapshot) {
        this.entries = this._snapshotEntries(snapshot || []);
        if (this.onTapeRefresh) {
            this.onTapeRefresh(this.entries);
        }
        this._recalculate();
    }

    undo() {
        if (this.undoStack.length === 0) return false;
        const snapshot = this.undoStack.pop();
        this.redoStack.push(this._snapshotEntries());
        this._restoreSnapshot(snapshot);
        return true;
    }

    redo() {
        if (this.redoStack.length === 0) return false;
        const snapshot = this.redoStack.pop();
        this.undoStack.push(this._snapshotEntries());
        this._restoreSnapshot(snapshot);
        return true;
    }

    _shouldCheckpoint(key) {
        const checkpointKeys = new Set([
            '+', '-', 'x', '÷', '=', 'Enter',
            'T', 'T1', 'S', 'S1', '%', 'Δ', '√', '^',
            'RATE', 'TAX+', 'TAX-', 'COST', 'SELL', 'MARGIN', 'MARKUP',
            'CLEAR_ALL', 'M+', 'M-', 'MR', 'MC'
        ]);
        return checkpointKeys.has(key);
    }

    _emitMemoryUpdate() {
        if (!this.onMemoryUpdate) return;
        const hasStack = this.memoryStack.length > 0;
        const hasRegister = this.memoryRegister !== 0;
        this.onMemoryUpdate({
            mode: this.memoryMode,
            stack: [...this.memoryStack],
            memory: this.memoryRegister,
            hasMemory: this.memoryMode === 'stack' ? hasStack : hasRegister,
        });
    }

    _accumulateGT(val) {
        if (val === null || typeof val === 'undefined' || isNaN(val)) return;
        this.grandTotal += Number(val);
        this.grandTotal = parseFloat(Number(this.grandTotal).toPrecision(15));
    }
    
    // --- STATUS ---
    _emitStatus() {
        if (this.onStatusUpdate) {
            this.onStatusUpdate({
                acc1: this.accumulator !== 0,
                acc2: false,
                gt: this.grandTotal !== 0,
                error: this.errorState,
                minus: parseFloat(this.currentInput) < 0 || (this.currentInput === '0' && this.accumulator < 0 && !this.isNewSequence), // Logic for minus sign? Usually just current displayed number
                k: this.constantK
            });
        }
    }
    
    // --- STATE RECALCULATION ---
    _recalculate() {
        // 1. Save and Clear
        const savedEntries = [...this.entries];
        this.entries = [];
        
        // 2. Reset State
        this.accumulator = 0;
        this.grandTotal = 0;
        this.pendingMultDivOp = null;
        this.multDivOperand = null;
        this.currentInput = "0";
        this.isNewSequence = true;
        this.totalPendingState = { 1: false };
        this.errorState = false;
        this.gtPending = false; // New state for GT key
        this.isReplaying = true;
        this.lastOperation = null;
        this.lastAddSubValue = null;
        this.lastAddSubOp = null;
        this.lastMultDivResult = null;
        this.awaitingMultDivTotal = false;
        this.multDivResults = [];
        this.multDivTotalPendingClear = false;
        this.pendingAddSubPercent = null;
        this.pendingDelta = null;
        this.pendingPowerBase = null;

        try {
            for (const entry of savedEntries) {
                if (entry.type === 'input') {
                    // Logic dispatch
                    if (entry.key === '%' && typeof entry.percentBase !== 'undefined' && typeof entry.percentValue !== 'undefined') {
                        const base = Number(entry.percentBase);
                        const signedPercentValue = Number(entry.percentValue);
                        const res = this._applyRounding(base + signedPercentValue);
                        this.accumulator = parseFloat(Number(res).toPrecision(15));
                        this.currentInput = "0";
                        this.isNewSequence = true;
                        this.lastAddSubValue = null;
                        this.lastAddSubOp = entry.percentOp || null;
                        this.pendingAddSubPercent = null;
                    } else if (entry.key === 'Δ') {
                        this._handleDelta(entry.val, 'first');
                    } else if (entry.key === 'Δ2') {
                        this._handleDelta(entry.val, 'second');
                    } else if (entry.key === '√') {
                        this._handleSqrt(entry.val);
                    } else if (entry.key === '^') {
                        this._handlePower(entry.val, 'first');
                    } else if (entry.key === 'POW2') {
                        this._handlePower(entry.val, 'second');
                    } else if (['+', '-'].includes(entry.key)) {
                        this._handleAddSub(entry.key, entry.val); 
                    } else if (['x', '÷'].includes(entry.key)) {
                        this._handleMultDiv(entry.key, entry.val);
                    } else if (entry.key === '=' || entry.key === 'Enter') {
                        this._handleEqual(entry.val);
                    } else if (entry.key === 'T' || entry.key === 'T1') {
                        this._handleTotal(1);
                    } else if (entry.key === 'S' || entry.key === 'S1') {
                        this._handleSubTotal(1);
                    } else if (entry.key === 'GT') {
                        this._handleGrandTotal();
                    }
                }
            }
        } catch (e) {
            console.error("Replay Error", e);
            this._triggerError("Error Recalc");
        } finally {
            this.isReplaying = false;
            // Restore Display
            if (this.pendingMultDivOp) {
                 this.onDisplayUpdate(this._formatResult(this.multDivOperand));
            } else if (this.accumulator !== 0) {
                 this.onDisplayUpdate(this._formatResult(this.accumulator));
            } else {
                 this.onDisplayUpdate(this.currentInput);
            }
        }
    }
    
    // --- INPUT DISPATCH ---
    // Main entry point for inputs
    pressKey(key) {
        if (this.errorState && key !== 'CLEAR_ALL' && key !== 'CE') return;

        if (this._shouldCheckpoint(key)) {
            this._checkpoint();
        }

        // Rate Confirmation Logic
        if (this.awaitingRate) {
             const isNumeric = (!isNaN(parseFloat(key)) || key === '00' || key === '000' || key === '.');
             if (key === '=' || key === 'Enter') {
                 const rateVal = parseFloat(this.currentInput);
                 if (!isNaN(rateVal)) {
                     this.taxRate = rateVal;
                     if (this.onRateUpdate) this.onRateUpdate(this.taxRate);
                 }
                 this.awaitingRate = false;
                 this._clearAll();
                 return;
             }
             if (!isNumeric) {
                 return;
             }
        }

        // K Confirmation Logic
        if (this.awaitingK) {
             const isNumeric = (!isNaN(parseFloat(key)) || key === '00' || key === '000' || key === '.');
             if (key === '=' || key === 'Enter') {
                 const kVal = parseFloat(this.currentInput);
                 if (!isNaN(kVal) && this.currentInput !== this.kInitialValue) {
                     this.constantK = kVal;
                 } else if (this.kInitialFromDisplay && !isNaN(kVal)) {
                     this.constantK = kVal;
                 } else {
                     this.constantK = 0;
                 }
                 this.awaitingK = false;
                 this.kInitialValue = null;
                 this.kInitialFromDisplay = false;
                 this._emitStatus();
                 this._clearAll();
                 return;
             }
             if (!isNumeric) {
                 return;
             }
        }

        // Numeric Input
        if (!isNaN(parseFloat(key)) || key === '00' || key === '000') {
            this._handleNumber(key);
            return;
        }
        if (key === '.') {
            this._handleDecimal();
            return;
        }

        // Operations
        switch(key) {
            case '+':
            case '-':
                this._handleAddSub(key);
                break;
            case 'x':
            case '÷':
                this._handleMultDiv(key);
                break;
            case '=':
            case 'Enter':
                this._handleEqual();
                break;
            case 'T':
            case 'T1':
                this._handleTotal(1);
                break;
            case 'S':
            case 'S1':
                this._handleSubTotal(1);
                break;
            case '%':
                this._handlePercent();
                break;
            case 'Δ':
                this._handleDelta();
                break;
            case '√':
                this._handleSqrt();
                break;
            case '^':
                this._handlePower();
                break;
            case 'GT':
                this._handleGrandTotal();
                break;

            // Business Keys
            case 'RATE':
            case 'K':
            case 'TAX+':
            case 'TAX-':
            case 'COST':
            case 'SELL':
            case 'MARGIN':
            case 'MARKUP':
                this._handleBusinessKey(key);
                break;
                
            // Clear handling needs to be coordinated with UI usually, 
            // but engine state part is here
            case 'CLEAR_ALL':
                this._clearAll();
                break;
            case 'CE':
                this._clearEntry();
                break;
            case 'BACKSPACE':
                this._handleBackspace();
                break;
            case '±':
                this._toggleSign();
                break;
            case 'M+':
            case 'M-':
            case 'MR':
            case 'MC':
                this._handleMemoryKey(key);
                break;
        }
    }

    // --- INPUT HANDLERS ---
    _handleNumber(digits) {
        if (this.settings.addMode) {
            if (this.isNewSequence || this.currentInput === "0") {
                this.addModeBuffer = "";
            }
            const addDigits = String(digits);
            const buffer = (this.addModeBuffer || "") + addDigits;
            if (buffer.length > 16) return;
            this.addModeBuffer = buffer;

            const raw = this.addModeBuffer || "0";
            let intPart = "0";
            let fracPart = "00";
            if (raw.length <= 2) {
                fracPart = raw.padStart(2, "0");
            } else {
                intPart = raw.slice(0, -2);
                fracPart = raw.slice(-2);
            }
            this.currentInput = `${intPart}.${fracPart}`;
            this.isNewSequence = false;
            if (!this.isReplaying) this.onDisplayUpdate(this.currentInput);
            return;
        }
        // Se stavamo attendendo un totale da catena mult/div e l'utente riprende a digitare, azzera lo stato catena
        if (this.awaitingMultDivTotal && this.isNewSequence && !this.pendingMultDivOp) {
            this.awaitingMultDivTotal = false;
            this.lastMultDivResult = null;
            this.multDivResults = [];
            this.multDivTotalPendingClear = false;
        }
        if (this.pendingAddSubPercent) {
            this.pendingAddSubPercent = null;
        }
        // Reset Total Pending State on numeric input
        this.totalPendingState[1] = false;

        if (this.currentInput === "0" || this.isNewSequence) {
            this.currentInput = digits;
            this.isNewSequence = false;
        } else {
            if (this.currentInput.replace('.', '').length < 16) {
                this.currentInput += digits;
            }
        }
        if (!this.isReplaying) this.onDisplayUpdate(this.currentInput);
    }

    _handleDecimal() {
        if (this.settings.addMode) {
            return;
        }
        if (this.awaitingMultDivTotal && this.isNewSequence && !this.pendingMultDivOp) {
            this.awaitingMultDivTotal = false;
            this.lastMultDivResult = null;
            this.multDivResults = [];
            this.multDivTotalPendingClear = false;
        }
        if (this.pendingAddSubPercent) {
            this.pendingAddSubPercent = null;
        }
        if (this.isNewSequence) {
            this.currentInput = "0.";
            this.isNewSequence = false;
        } else if (!this.currentInput.includes('.')) {
            this.currentInput += ".";
        }
        if (!this.isReplaying) this.onDisplayUpdate(this.currentInput);
    }

    _handleAddSub(op, explicitVal = null) {
        if (this.totalPendingState[1]) {
            this.totalPendingState[1] = false;
            this.accumulator = 0;
            this.lastAddSubValue = null;
        }
        if (this.pendingDelta !== null) {
            this.pendingDelta = null;
        }
        if (this.pendingPowerBase !== null) {
            this.pendingPowerBase = null;
        }
        if (this.pendingAddSubPercent) {
            const { base, percentInput } = this.pendingAddSubPercent;
            const percentValue = this._applyRounding(base * (percentInput / 100));
            const signedPercentValue = op === '-' ? -percentValue : percentValue;
            const res = this._applyRounding(base + signedPercentValue);

            this._addHistoryEntry({
                val: percentInput,
                symbol: '%',
                key: '%',
                type: 'input',
                percentValue: signedPercentValue,
                percentBase: base,
                percentOp: op
            });

            this._addHistoryEntry({
                val: this._formatResult(res),
                symbol: 'T',
                key: 'T',
                type: 'result'
            });

            if (!this.isReplaying) {
                this.onDisplayUpdate(this._formatResult(res));
            }

            this.accumulator = parseFloat(Number(res).toPrecision(15));
            this.currentInput = "0";
            this.isNewSequence = true;
            this.lastAddSubValue = null;
            this.lastAddSubOp = op;
            this.pendingAddSubPercent = null;
            this._emitStatus();
            return;
        }

        // If we're already waiting for the next operand (user pressed an operator
        // and didn't type the second operand yet), subsequent operator presses
        // should not emit a new tape entry. If the operator changes (from + to -
        // or viceversa), update the pending operator and refresh the tape UI.
        if (this.pendingAddSubOp && this.isNewSequence) {
            if (op === this.pendingAddSubOp) {
                return; // no effect
            }
            // change pending operator symbol in history if present
            for (let i = this.entries.length - 1; i >= 0; i--) {
                const e = this.entries[i];
                if (e && e.type === 'input' && (e.key === '+' || e.key === '-')) {
                    e.symbol = op;
                    e.key = op;
                    break;
                }
            }
            this.pendingAddSubOp = op;
            if (this.onTapeRefresh) this.onTapeRefresh(this.entries);
            this._emitStatus();
            return;
        }

        // Exiting mult/div chain: clear its state
        this.awaitingMultDivTotal = false;
        this.lastMultDivResult = null;
        this.multDivResults = [];
        this.pendingMultDivOp = null;
        this.multDivTotalPendingClear = false;

        // Also exit any previous add/sub chain if needed
        // (we will manage chaining for add/sub similarly to mult/div)

        let val;
        if (explicitVal !== null) {
            val = explicitVal;
        } else if (this.isNewSequence && this.lastAddSubValue !== null && this.currentInput === "0") {
            val = this.lastAddSubValue;
        } else {
            val = parseFloat(this.currentInput);
        }
        if (isNaN(val)) val = 0;

        // If there's already a pending add/sub operation, and the user typed a new operand,
        // compute the intermediate result first (chain behaviour), mirroring mult/div logic.
        if (!this.pendingAddSubOp) {
            // First term in add/sub chain
            this.addSubResults = [];
            this.addSubOperand = val;
        } else {
            if (!this.isNewSequence) {
                let interRes = 0;
                if (this.pendingAddSubOp === '+') {
                    interRes = this.addSubOperand + val;
                } else if (this.pendingAddSubOp === '-') {
                    interRes = this.addSubOperand - val;
                }

                interRes = this._applyRounding(interRes);
                this.addSubResults.push(interRes);
                this.addSubOperand = interRes;
                if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(interRes));
            } else {
                // If isNewSequence, keep operand as-is (user pressed op twice)
            }
        }

        this.pendingAddSubOp = op;
        this._addHistoryEntry({ val, symbol: op, key: op, type: 'input' });

        this.currentInput = "0";
        this.isNewSequence = true;
    }

    _handleMemoryKey(key) {
        if (this.memoryMode === 'stack') {
            this._handleStackMemory(key);
        } else {
            this._handleAlgebraicMemory(key);
        }
        this._emitMemoryUpdate();
    }

    _readInputValue() {
        const val = parseFloat(this.currentInput);
        return isNaN(val) ? null : val;
    }

    _resolveUnaryBaseValue() {
        const parsed = parseFloat(this.currentInput);
        const hasExplicitInput = !this.isNewSequence || this.currentInput !== "0";
        if (!isNaN(parsed) && hasExplicitInput) return parsed;
        if (this.pendingMultDivOp && this.multDivOperand !== null && this.isNewSequence) return this.multDivOperand;
        if (this.pendingAddSubOp && this.addSubOperand !== null && this.isNewSequence) return this.addSubOperand;
        if (this.accumulator !== 0 && this.isNewSequence) return this.accumulator;
        if (!isNaN(parsed)) return parsed;
        return null;
    }

    _handleAlgebraicMemory(key) {
        const val = this._readInputValue();
        if (key === 'M+') {
            if (val !== null) this.memoryRegister += val;
        } else if (key === 'M-') {
            if (val !== null) this.memoryRegister -= val;
        } else if (key === 'MR') {
            this.currentInput = String(this.memoryRegister);
            this.isNewSequence = true;
            if (!this.isReplaying) this.onDisplayUpdate(this.currentInput);
        } else if (key === 'MC') {
            this.memoryRegister = 0;
        }
    }

    _handleStackMemory(key) {
        const val = this._readInputValue();
        if (key === 'M+') {
            if (val !== null && val !== 0) {
                if (this.memoryStack.length >= this.memoryMax) {
                    this.memoryStack.shift();
                }
                this.memoryStack.push(val);
            }
        } else if (key === 'M-') {
            if (this.memoryStack.length === 0) return;
            if (val !== null) {
                const target = Math.round(val * 1000) / 1000;
                let idx = -1;
                for (let i = this.memoryStack.length - 1; i >= 0; i--) {
                    const candidate = Math.round(this.memoryStack[i] * 1000) / 1000;
                    if (candidate === target) {
                        idx = i;
                        break;
                    }
                }
                if (idx >= 0) {
                    this.memoryStack.splice(idx, 1);
                } else {
                    this.memoryStack.pop();
                }
            } else {
                this.memoryStack.pop();
            }
        } else if (key === 'MR') {
            if (this.memoryStack.length === 0) return;
            const top = this.memoryStack.pop();
            this.currentInput = String(top);
            this.isNewSequence = true;
            if (!this.isReplaying) this.onDisplayUpdate(this.currentInput);
        } else if (key === 'MC') {
            this.memoryStack = [];
        }
    }

    _handleMultDiv(op, explicitVal = null) {
        if (this.pendingDelta !== null) {
            this.pendingDelta = null;
        }
        if (this.pendingPowerBase !== null) {
            this.pendingPowerBase = null;
        }
        // Exiting any add/sub chain when starting mult/div
        this.pendingAddSubOp = null;
        this.addSubOperand = null;
        this.awaitingAddSubTotal = false;
        this.addSubResults = [];
        this.addSubTotalPendingClear = false;
        if (this.pendingMultDivOp && this.isNewSequence && this.currentInput === "0" && this.constantK !== null && this.constantK !== 0) {
            this._handleEqual(this.constantK);
            return;
        }
        let val;
        if (explicitVal !== null) {
            val = explicitVal;
        } else if (this.pendingMultDivOp && this.constantK !== null && this.isNewSequence && this.currentInput === "0") {
            val = this.constantK;
        } else {
            val = parseFloat(this.currentInput);
        }
        this.awaitingMultDivTotal = false;

        if (this.totalPendingState[1]) {
            this.totalPendingState[1] = false;
            this.accumulator = 0;
            this.lastAddSubValue = null;
        }

        // Nuova catena: reset elenco risultati
        if (!this.pendingMultDivOp) {
            this.multDivResults = [];
        }
        
        // --- CHAINING LOGIC ---
        // If there is already a pending operation (e.g. 10 x 5 x ...), 
        // we must execute the previous one first.
        if (this.pendingMultDivOp && !this.isNewSequence) {
             let interRes = 0;
             if (this.pendingMultDivOp === 'x') {
                 interRes = this.multDivOperand * val;
             } else if (this.pendingMultDivOp === '÷') {
                 if (val === 0 && !this.isReplaying) { this._triggerError("Error"); return; }
                 interRes = this.multDivOperand / val;
             }
             
             // Intermediate rounding? Usually yes on tape calcs
             interRes = this._applyRounding(interRes);

             this.multDivResults.push(interRes);
             
             // Let's adopt this: Update multDivOperand to the result.
             this.multDivOperand = interRes;
             if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(interRes));
             
             // Print the input value with the *previous* requested op? 
             // Or print just the input with the *new* op?
             // Standard:
             // 10 x
             // 5 x   (Meaning: 5 is factor, x is next op)
             // Result 50 is kept internal.
        } else {
             // First term in chain
             this.multDivOperand = val;
        }

        this.pendingMultDivOp = op;
        this._addHistoryEntry({ val, symbol: op, key: op, type: 'input' });
        
        this.currentInput = "0";
        this.isNewSequence = true;
    }

    _handlePercent() {
        if (this.pendingDelta !== null) {
            this.pendingDelta = null;
        }
        if (this.pendingPowerBase !== null) {
            this.pendingPowerBase = null;
        }
        const val = parseFloat(this.currentInput);
        if (isNaN(val)) return;
        // Logos: percentuale solo con x/÷; per somma/sottrazione usare il cambio segno
        if (!this.pendingMultDivOp) {
            if (this.accumulator === null || typeof this.accumulator === 'undefined') return;
            this.pendingAddSubPercent = {
                base: this.accumulator,
                percentInput: val
            };
            this.isNewSequence = true;
            if (!this.isReplaying) this.onDisplayUpdate(this.currentInput + "%");
            return;
        }

        if (!this.isReplaying) this.onDisplayUpdate(this.currentInput + "%");

        const base = this.multDivOperand;
        const percentValue = this._applyRounding(base * (val / 100));
        let res = percentValue;
        if (this.pendingMultDivOp === '÷') {
            if (val === 0 && !this.isReplaying) {
                this._triggerError("Error");
                return;
            }
            res = this._applyRounding(base / (val / 100));
        }

        // Stampa risultato dell'operazione
        const percentResRounded = this._applyRoundingWithFlag(res);
        res = percentResRounded.value;
        this._addHistoryEntry({
            val: this._formatResult(res),
            symbol: '%',
            key: '%',
            type: 'result',
            percentValue,
            roundingFlag: percentResRounded.roundingFlag
        });
        if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(res));

        this._accumulateGT(res);

        // Accumula il risultato nell'addizionatore
        this.accumulator += res;
        this.accumulator = parseFloat(Number(this.accumulator).toPrecision(15));

        this.lastMultDivResult = res;
        this.awaitingMultDivTotal = true;
        this.multDivResults.push(res);
        this.multDivTotalPendingClear = false;

        this.currentInput = String(res);
        this.isNewSequence = true;
        this.pendingMultDivOp = null;
        this._emitStatus();
    }

    _handleDelta(explicitVal = null, stage = null) {
        const val = explicitVal !== null
            ? explicitVal
            : (stage === 'second' ? parseFloat(this.currentInput) : this._resolveUnaryBaseValue());
        if (val === null || isNaN(val)) return;

        const hasPending = this.pendingDelta !== null && typeof this.pendingDelta !== 'undefined';

        if (!hasPending || stage === 'first') {
            this.pendingMultDivOp = null;
            this.multDivOperand = null;
            this.awaitingMultDivTotal = false;
            this.lastMultDivResult = null;
            this.multDivResults = [];
            this.multDivTotalPendingClear = false;
            this.pendingAddSubPercent = null;
            this.pendingDelta = val;
            this._addHistoryEntry({ val, symbol: 'Δ', key: 'Δ', type: 'input' });
            this.currentInput = "0";
            this.isNewSequence = true;
            return;
        }

        const base = val;
        const nuovoValore = this.pendingDelta;
        if (base === 0) {
            if (!this.isReplaying) this._triggerError("Error");
            return;
        }

        const diff = nuovoValore - base;
        const percentRounded = this._applyRoundingWithFlag((diff / base) * 100);
        const diffRounded = this._applyRoundingWithFlag(diff);

        this._addHistoryEntry({ val: base, symbol: '=', key: 'Δ2', type: 'input' });
        this._addHistoryEntry({
            val: this._formatResult(percentRounded.value),
            symbol: '%',
            key: 'Δ%',
            type: 'result',
            roundingFlag: percentRounded.roundingFlag
        });
        this._addHistoryEntry({
            val: this._formatResult(diffRounded.value),
            symbol: 'T',
            key: 'ΔT',
            type: 'result',
            roundingFlag: diffRounded.roundingFlag
        });

        this._accumulateGT(diffRounded.value);

        if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(diffRounded));

        this.accumulator = parseFloat(Number(diffRounded).toPrecision(15));
        this.currentInput = String(diffRounded.value);
        this.isNewSequence = true;
        this.pendingDelta = null;
        this._emitStatus();
    }

    _handleSqrt(explicitVal = null) {
        const val = explicitVal !== null ? explicitVal : this._resolveUnaryBaseValue();
        if (val === null || isNaN(val)) return;
        this.pendingMultDivOp = null;
        this.multDivOperand = null;
        this.awaitingMultDivTotal = false;
        this.lastMultDivResult = null;
        this.multDivResults = [];
        this.multDivTotalPendingClear = false;
        this.pendingAddSubPercent = null;
        if (val < 0) {
            if (!this.isReplaying) this._triggerError("Error");
            return;
        }
        const resRounded = this._applyRoundingWithFlag(Math.sqrt(val));
        const res = resRounded.value;
        this._addHistoryEntry({ val, symbol: '√', key: '√', type: 'input' });
        this._addHistoryEntry({
            val: this._formatResult(res),
            symbol: '',
            key: '=',
            type: 'result',
            roundingFlag: resRounded.roundingFlag
        });
        if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(res));

        this._accumulateGT(res);
        this.currentInput = String(res);
        this.isNewSequence = true;
        this.pendingPowerBase = null;
        this.pendingDelta = null;
        this._emitStatus();
    }

    _handlePower(explicitVal = null, stage = null) {
        const val = explicitVal !== null
            ? explicitVal
            : (stage === 'second' ? parseFloat(this.currentInput) : this._resolveUnaryBaseValue());
        if (val === null || isNaN(val)) return;

        const hasPending = this.pendingPowerBase !== null && typeof this.pendingPowerBase !== 'undefined';

        if (!hasPending || stage === 'first') {
            this.pendingMultDivOp = null;
            this.multDivOperand = null;
            this.awaitingMultDivTotal = false;
            this.lastMultDivResult = null;
            this.multDivResults = [];
            this.multDivTotalPendingClear = false;
            this.pendingAddSubPercent = null;
            this.pendingPowerBase = val;
            this._addHistoryEntry({ val, symbol: '^', key: '^', type: 'input' });
            this.currentInput = "0";
            this.isNewSequence = true;
            return;
        }

        const base = this.pendingPowerBase;
        const exp = val;
        const resRounded = this._applyRoundingWithFlag(Math.pow(base, exp));
        const res = resRounded.value;

        this._addHistoryEntry({ val: exp, symbol: '=', key: 'POW2', type: 'input' });
        this._addHistoryEntry({
            val: this._formatResult(res),
            symbol: '',
            key: '=',
            type: 'result',
            roundingFlag: resRounded.roundingFlag
        });
        if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(res));

        this._accumulateGT(res);

        this.currentInput = String(res);
        this.isNewSequence = true;
        this.pendingPowerBase = null;
        this.pendingDelta = null;
        this._emitStatus();
    }

    _handleEqual(explicitVal = null) {
        if (this.pendingDelta !== null) {
            this._handleDelta(explicitVal, 'second');
            return;
        }
        if (this.pendingPowerBase !== null) {
            this._handlePower(explicitVal, 'second');
            return;
        }
        // Special Case: If T was just pressed, = clears the accumulator
        if (this.totalPendingState[1]) {
            this.accumulator = 0;
            this.totalPendingState[1] = false;
            this._addHistoryEntry({ val: 0, symbol: '=', key: '=', type: 'input' });
            this._emitStatus();
            if (!this.isReplaying) this.onDisplayUpdate("0");
            return;
        }

        // --- SCENARIO A: Normal Calculation (A op B =) ---
        if (this.pendingAddSubOp) {
            // Handle pending add/sub chain
            let val = explicitVal !== null ? explicitVal : parseFloat(this.currentInput);

            let res = 0;
            if (this.pendingAddSubOp === '+') {
                res = this.addSubOperand + val;
            } else if (this.pendingAddSubOp === '-') {
                res = this.addSubOperand - val;
            }

            // Save constant state for repeat '=' behavior
            this.lastOperation = { op: this.pendingAddSubOp, operand: val };
            const resRounded = this._applyRoundingWithFlag(res);
            res = resRounded.value;

            // For add/sub we print only the Total line (T) aligned right, not an intermediate result
            // Accumulate into GT and accumulator
            this._accumulateGT(res);
            this.accumulator += res;
            this.accumulator = parseFloat(Number(this.accumulator).toPrecision(15));

            const accumRounded = this._applyRoundingWithFlag(this.accumulator);
            // Print Total with symbol 'T'
            this._addHistoryEntry({
                val: this._formatResult(accumRounded.value),
                symbol: 'T',
                key: 'T',
                type: 'result',
                roundingFlag: accumRounded.roundingFlag
            });
            if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(accumRounded.value));

            this.lastAddSubValue = val;
            this.lastAddSubOp = this.pendingAddSubOp;
            this.lastMultDivResult = null;
            this.awaitingAddSubTotal = true;
            this.addSubResults.push(res);
            this.addSubTotalPendingClear = false;

            this.currentInput = String(res);
            this.isNewSequence = true;
            this.pendingAddSubOp = null;
            this._emitStatus();
            return;
        }

        if (this.pendingMultDivOp) {
            let val = explicitVal !== null ? explicitVal : parseFloat(this.currentInput);
            
            // Print second operand
            this._addHistoryEntry({ val, symbol: '=', key: '=', type: 'input' });

            let res = 0;
            
            if (this.pendingMultDivOp === 'x') {
                res = this.multDivOperand * val;
            } else if (this.pendingMultDivOp === '÷') {
                if (val === 0 && !this.isReplaying) {
                    this._triggerError("Error");
                    return;
                }
                res = this.multDivOperand / val;
            }

            // Save Constant State (User wants to repeat op with stored operand)
            // Example: 2.4 x 112 = 268.8
            // stored: op='x', operand=112 (the second term)
            this.lastOperation = { op: this.pendingMultDivOp, operand: val };
            const resRounded = this._applyRoundingWithFlag(res);
            res = resRounded.value;

            // Stampa il risultato dell'operazione (riga sotto, senza simbolo)
            this._addHistoryEntry({
                val: this._formatResult(res),
                symbol: '',
                key: '=',
                type: 'result',
                roundingFlag: resRounded.roundingFlag
            });
            if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(res));

            this._accumulateGT(res);

            // Accumula il risultato nell'addizionatore e stampa il cumulato con S a destra
            this.accumulator += res;
            this.accumulator = parseFloat(Number(this.accumulator).toPrecision(15));
            const accumRounded = this._applyRoundingWithFlag(this.accumulator);
            this._addHistoryEntry({
                val: this._formatResult(accumRounded.value),
                symbol: 'S',
                key: 'S',
                type: 'result',
                roundingFlag: accumRounded.roundingFlag
            });

            this.lastMultDivResult = res;
            this.awaitingMultDivTotal = true;
            this.multDivResults.push(res);
            this.multDivTotalPendingClear = false;

            this.currentInput = String(res);
            this.isNewSequence = true; 
            this.pendingMultDivOp = null;
            this._emitStatus();
            
        }
        // --- SCENARIO A2: Move last mult/div result to adder via = ---
        else if (this.awaitingMultDivTotal && this.isNewSequence && this.lastMultDivResult !== null) {
            // Prima pressione di = mostra il totale accumulato; seconda pressione azzera il totalizzatore
            if (!this.multDivTotalPendingClear) {
                const total = this._applyRoundingWithFlag(this.accumulator);
                this.currentInput = String(total.value);
                this.isNewSequence = true;
                this.multDivTotalPendingClear = true;

                this._addHistoryEntry({
                    val: this._formatResult(total.value),
                    symbol: 'T',
                    key: 'T',
                    type: 'result',
                    roundingFlag: total.roundingFlag
                });
                if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(total.value));
                this._emitStatus();
                return;
            }

            // Seconda pressione: azzera totalizzatore
            this.accumulator = 0;
            this.accumulator = parseFloat(Number(this.accumulator).toPrecision(15));
            const total = this._applyRoundingWithFlag(this.accumulator);
            this.currentInput = String(total.value);
            this.isNewSequence = true;
            this.multDivTotalPendingClear = false;
            this.awaitingMultDivTotal = false;
            this.lastMultDivResult = null;
            this.multDivResults = [];

            this._addHistoryEntry({
                val: this._formatResult(total.value),
                symbol: 'T',
                key: 'T',
                type: 'result',
                roundingFlag: total.roundingFlag
            });
            if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(total.value));
            this._emitStatus();
            return;
        }
        // --- SCENARIO B: Add/Sub Total via = ---
        else if (this.lastAddSubValue !== null || this.accumulator !== 0) {
            this._handleTotal(1);
            return;
        }
        // --- SCENARIO C: Constant Calculation (C =) ---
        else if (this.lastOperation) {
            // Check if we should clear the stack (Double Press of =)
            // "se viene premuto uan seconda volta... azzera quello stack"
            
            if (this.isNewSequence) {
                // User pressed = immediately after a result. CLEAR STACK.
                this.lastOperation = null;
                return;
            }

            // User typed a new value (e.g. 2.2) and pressed =
            // Execute: NewVal [op] [StoredOperand]
            let val = explicitVal !== null ? explicitVal : parseFloat(this.currentInput);
            
            // 1. Print input (The new "constant" base)
            this._addHistoryEntry({ val, symbol: '', key: '=', type: 'input' });

            // 2. Print the Constant Factor being applied (Visual Feed)
            // Marked as 'info' so Replay doesn't try to processing it as input
            this._addHistoryEntry({ 
                val: this.lastOperation.operand, 
                symbol: this.lastOperation.op, 
                key: 'CONST', 
                type: 'info' 
            });

            let res = 0;
            if (this.lastOperation.op === 'x') {
                res = val * this.lastOperation.operand;
            } else if (this.lastOperation.op === '÷') {
                if (this.lastOperation.operand === 0 && !this.isReplaying) {
                     this._triggerError("Error"); return;
                }
                res = val / this.lastOperation.operand;
            }

            const resRounded = this._applyRoundingWithFlag(res);
            res = resRounded.value;

            // Print Result
            this._addHistoryEntry({
                val: this._formatResult(res),
                symbol: '',
                key: '=',
                roundingFlag: resRounded.roundingFlag
            }); 
            if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(res));

            this.accumulator += res;
            this.accumulator = parseFloat(Number(this.accumulator).toPrecision(15));
            
            this._accumulateGT(res);

            this.currentInput = String(res);
            this.isNewSequence = true;
            this._emitStatus();
            
            // Do NOT clear lastOperation. User can chain multiple constants: 2.2 =, 3.5 =, etc.
            
        }
        else {
            // No pending op, No constant.
            if (this.lastAddSubValue !== null || this.accumulator !== 0) {
                this._handleTotal(1);
                return;
            }
            // If we just finished a sequence (e.g. just printed a result), do NOT repeat print.
            if (this.isNewSequence) return;
        }
    }

    _toggleSign() {
        if (this.isNewSequence && this.currentInput === "0") return;
        const val = parseFloat(this.currentInput);
        if (isNaN(val) || val === 0) {
            this.currentInput = "0";
        } else {
            this.currentInput = String(-val);
        }
        this.isNewSequence = false;
        if (!this.isReplaying) this.onDisplayUpdate(this.currentInput);
    }

    _handleTotal(accIndex = 1) {
        // Chiusura catena mult/div: azzera stato catena
        this.awaitingMultDivTotal = false;
        this.lastMultDivResult = null;
        this.multDivResults = [];
        this.pendingMultDivOp = null;
        this.multDivTotalPendingClear = false;

        // GT Logic Override (If GT key was pressed before T)
        // Only trigger special GT behavior if ACC switch is active? 
        // User says: "se, e solo se lo switch ACC è su on la logica prevede un accumulatore speciale... quindi questo tasto va premuto prima..."
        // This implies the KEY works this way if SWITCH is ON. 
        // If Switch is OFF, maybe GT key does nothing?
        // Let's assume switch controls accumulation, but key logic is always available to read the register if something is there.
        if (this.gtPending && accIndex === 1) { 
            this.gtPending = false;
            // Print GT Total (GT*) e Clear
            let val = this.grandTotal;
            const gtRounded = this._applyRoundingWithFlag(val);
            val = gtRounded.value;
            
            // Format symbol usually GT* for Total
            this._addHistoryEntry({
                val: this._formatResult(val),
                symbol: 'GT*',
                key: 'GT',
                type: 'input',
                roundingFlag: gtRounded.roundingFlag
            }); 
            if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(val));
            
            // Clear GT
            this.grandTotal = 0;
            this.currentInput = String(val);
            this.isNewSequence = true;
            this._emitStatus();
            return;
        }

        // Acc 1
        let val = this.accumulator;
        const totalRounded = this._applyRoundingWithFlag(val);
        val = totalRounded.value;
        
        // Logic:
        // 1st press: Print Total (looks like Total), do NOT clear. Set Pending State.
        // 2nd press (or if Pending State is true): Print Total (Symbol *), Clear Accumulator, Add to GT.
        
        const isSecondPress = this.totalPendingState[accIndex];
        
        // Symbol: User interface usually distinguishes S (diamond) vs T (*). 
        // But requested logic is "First T prints result... only second T clears".
        // Let's use 'S' symbol for first press (Subtotal concept) and '*' for second (Total).
        const sym = (isSecondPress ? '*' : '◇');
        
        // Tag as input so it replays (clears accumulators correctly)
        this._addHistoryEntry({
            val: this._formatResult(val),
            symbol: sym,
            key: 'T' + accIndex,
            type: 'input',
            roundingFlag: totalRounded.roundingFlag
        });
        if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(val));
        
        if (isSecondPress) {
            // Finalize: Clear & Add to GT
            // Do not accumulate here to avoid double add
            this.accumulator = 0;
            // Reset state
            this.totalPendingState[accIndex] = false;
        } else {
            // First press: Hold state
            this.totalPendingState[accIndex] = true;
            this._accumulateGT(val);
        }
        
        // "questo risultato ... sarà il primo operando"
        // We ensure currentInput holds the total value so it can be picked up by next op.
        this.currentInput = String(val);
        this.isNewSequence = true;
        this._emitStatus();
    }
    
    _handleSubTotal(accIndex = 1) {
        this.awaitingMultDivTotal = false;
        this.lastMultDivResult = null;
        this.multDivResults = [];
        this.pendingMultDivOp = null;
        this.multDivTotalPendingClear = false;

        // GT Logic Override (If GT key was pressed before S)
        if (this.gtPending && accIndex === 1) {
             this.gtPending = false;
             // Print GT Subtotal (GT) - No Clear
             let val = this.grandTotal;
             const gtRounded = this._applyRoundingWithFlag(val);
             val = gtRounded.value;
             
             this._addHistoryEntry({
                 val: this._formatResult(val),
                 symbol: 'GT',
                 key: 'GT',
                 type: 'input',
                 roundingFlag: gtRounded.roundingFlag
             });
             if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(val));
             
             this.currentInput = String(val);
             this.isNewSequence = true;
             // Do NOT clear GT
             this._emitStatus();
             return;
        }

        let val = this.accumulator;
        const subtotalRounded = this._applyRoundingWithFlag(val);
        val = subtotalRounded.value;
        
        const sym = 'S';
        
        this._addHistoryEntry({
            val: this._formatResult(val),
            symbol: sym,
            key: 'S' + accIndex,
            type: 'input',
            roundingFlag: subtotalRounded.roundingFlag
        });
        if (!this.isReplaying) this.onDisplayUpdate(this._formatResult(val));
        
        // Do NOT clear accumulator
        this.currentInput = "0";
        this.isNewSequence = true;
    }
    
    _handleGrandTotal() {
        // Toggle GT Pending State
        this.gtPending = !this.gtPending;
    }

    _handleBackspace() {
          // If we are editing a number, standard backspace
          if (!this.isNewSequence && this.currentInput !== "0") {
             if (this.currentInput.length > 1) {
                this.currentInput = this.currentInput.slice(0, -1);
             } else {
                this.currentInput = "0";
             }
             if (!this.isReplaying) this.onDisplayUpdate(this.currentInput);
             return;
        }

        // Undo the last committed operation in the chain
        this.undo();
    }

    // --- CLEAR / EDIT ---
    _clearAll() {
        this.accumulator = 0;
        this.grandTotal = 0;
        this.currentInput = "0";
        this.pendingMultDivOp = null;
        this.errorState = false;
        this.lastAddSubValue = null;
        this.lastAddSubOp = null;
        this.pendingAddSubOp = null;
        this.addSubOperand = null;
        this.awaitingAddSubTotal = false;
        this.addSubResults = [];
        this.addSubTotalPendingClear = false;
        this.lastMultDivResult = null;
        this.awaitingMultDivTotal = false;
        this.multDivResults = [];
        this.multDivTotalPendingClear = false;
        this.pendingAddSubPercent = null;
        this.pendingDelta = null;
        this.pendingPowerBase = null;
        this.awaitingRate = false;
        this.awaitingK = false;
        this.kInitialValue = null;
        this.kInitialFromDisplay = false;
        this.costValue = null;
        this.sellValue = null;
        this.markupPercent = 0;
        this.pricingMode = 'margin';
        this.lastOperation = null;
        this.gtPending = false;
        this.addModeBuffer = "";
        
        this.entries = []; // Clear history
        
        // Notify UI
        this.onDisplayUpdate("0");
        if (this.onTapeRefresh) this.onTapeRefresh([]);
        this.onTapePrint({ val: 0, symbol: "C", key: "C", type: "input" });
        this._emitStatus();
    }

    _clearEntry() {
        this.currentInput = "0";
        this.pendingAddSubPercent = null;
        this.pendingDelta = null;
        this.pendingPowerBase = null;
        this.addModeBuffer = "";
        this.onDisplayUpdate("0");
    }

    // --- BUSINESS KEYS ---
    _handleBusinessKey(key) {
        if (key === 'RATE') {
            this.awaitingRate = true;
            this.currentInput = String(this.taxRate);
            this.isNewSequence = true;
            this.onDisplayUpdate(this.currentInput);
            return;
        }

        if (key === 'K') {
            const displayVal = parseFloat(this.currentInput);
            if (!isNaN(displayVal) && this.currentInput !== "0") {
                this.kInitialValue = String(displayVal);
                this.kInitialFromDisplay = true;
            } else {
                this.kInitialValue = this.constantK !== null ? String(this.constantK) : "0";
                this.kInitialFromDisplay = false;
            }
            this.currentInput = this.kInitialValue;
            this.isNewSequence = true;
            this.awaitingK = true;
            this.onDisplayUpdate(this.currentInput);
            return;
        }

        // For other keys, we need a numeric input
        let val = parseFloat(this.currentInput);
        if (isNaN(val) || (this.isNewSequence && this.currentInput === "0")) {
            const resolved = this._resolveUnaryBaseValue();
            if (resolved !== null && !isNaN(resolved)) {
                val = resolved;
            }
        }
        if (isNaN(val)) {
            this._triggerError("Error");
            return;
        }

            // Business keys operate on a positive input when used as unary on the
            // waiting-first-operand state. Accept the absolute value to match
            // expected behaviour (user indicated "purché positivo").
            if (val < 0 && ['COST','SELL','MARGIN','MARKUP','TAX+','TAX-'].includes(key)) {
                val = Math.abs(val);
            }

        try {
            let res;
            if (key === 'MARGIN') {
                // If cost and sell are present, compute margin
                if (this.isNewSequence && this.currentInput === "0" && this.costValue !== null && this.sellValue !== null) {
                    res = computeMargin(this.costValue, this.sellValue);
                    res = this._applyRounding(res);
                    this.marginPercent = res;
                    this.pricingMode = 'margin';
                    this._addHistoryEntry({
                        val: res,
                        symbol: 'MARGIN',
                        key: 'MARGIN',
                        type: 'result',
                        percentSuffix: true,
                        leadSymbol: '='
                    });
                    this.onDisplayUpdate(String(res));
                    this.currentInput = String(res);
                    this.isNewSequence = true;
                    return;
                }

                // Store margin
                this.marginPercent = val;
                this.pricingMode = 'margin';
                this._addHistoryEntry({ val, symbol: 'MARGIN', key: 'MARGIN', type: 'input', percentSuffix: true });
                this.onDisplayUpdate(String(val));
                this.currentInput = "0";
                this.isNewSequence = true;
                return;
            }

            if (key === 'MARKUP') {
                // If cost and sell are present, compute markup
                if (this.isNewSequence && this.currentInput === "0" && this.costValue !== null && this.sellValue !== null) {
                    res = computeMarkup(this.costValue, this.sellValue);
                    res = this._applyRounding(res);
                    this.markupPercent = res;
                    this.pricingMode = 'markup';
                    this._addHistoryEntry({
                        val: res,
                        symbol: 'MARKUP',
                        key: 'MARKUP',
                        type: 'result',
                        percentSuffix: true,
                        leadSymbol: '='
                    });
                    this.onDisplayUpdate(String(res));
                    this.currentInput = String(res);
                    this.isNewSequence = true;
                    return;
                }

                // Store markup
                this.markupPercent = val;
                this.pricingMode = 'markup';
                this._addHistoryEntry({ val, symbol: 'MARKUP', key: 'MARKUP', type: 'input', percentSuffix: true });
                this.onDisplayUpdate(String(val));
                this.currentInput = "0";
                this.isNewSequence = true;
                return;
            }

            // Calculations
            if (key === 'TAX+') res = addTax(val, this.taxRate);
            else if (key === 'TAX-') res = removeTax(val, this.taxRate);
            else if (key === 'COST') {
                if (this.isNewSequence && this.currentInput === "0" && this.sellValue !== null) {
                    if (this.pricingMode === 'markup') {
                        res = computeCostFromMarkup(this.sellValue, this.markupPercent);
                    } else {
                        res = computeCost(this.sellValue, this.marginPercent);
                    }
                } else {
                    this.costValue = val;
                    this._addHistoryEntry({ val, symbol: 'COST', key: 'COST', type: 'input' });
                    this.onDisplayUpdate(String(val));
                    this.currentInput = "0";
                    this.isNewSequence = true;
                    return;
                }
            }
            else if (key === 'SELL') {
                if (this.isNewSequence && this.currentInput === "0" && this.costValue !== null) {
                    if (this.pricingMode === 'markup') {
                        res = computeSellFromMarkup(this.costValue, this.markupPercent);
                    } else {
                        res = computeSell(this.costValue, this.marginPercent);
                    }
                } else {
                    this.sellValue = val;
                    this._addHistoryEntry({ val, symbol: 'SELL', key: 'SELL', type: 'input' });
                    this.onDisplayUpdate(String(val));
                    this.currentInput = "0";
                    this.isNewSequence = true;
                    return;
                }
            }
            
            // Apply Rounding
            if (res !== undefined) {
                const rounded = this._applyRoundingWithFlag(res);
                res = rounded.value;
                const isBusinessResult = key === 'COST' || key === 'SELL' || key === 'MARGIN' || key === 'MARKUP';
                this._addHistoryEntry({
                    val: res,
                    symbol: key,
                    key: key,
                    type: 'result',
                    leadSymbol: isBusinessResult ? '=' : undefined,
                    percentSuffix: key === 'MARGIN' || key === 'MARKUP',
                    roundingFlag: rounded.roundingFlag
                });
                this.onDisplayUpdate(String(res));
                this.currentInput = String(res);
                this.isNewSequence = true;
                if (key === 'COST') this.costValue = res;
                if (key === 'SELL') this.sellValue = res;
            }

        } catch (e) {
            this._triggerError("Error"); // DivisionByZero etc
        }
    }

    // --- FORMATTING / MATH ---
    _applyRounding(val) {
        // First fix tiny floating point errors (e.g. 2.2+2.2+2.2 = 6.6000000000000005)
        val = parseFloat(Number(val).toPrecision(15));
        
        if (this.settings.isFloat) return val;
        return applyRounding(val, this.settings.roundingMode, this.settings.decimals);
    }

    _applyRoundingWithFlag(val) {
        const raw = parseFloat(Number(val).toPrecision(15));
        if (this.settings.isFloat) {
            return { value: raw, roundingFlag: null };
        }
        const rounded = applyRounding(raw, this.settings.roundingMode, this.settings.decimals);
        let roundingFlag = null;
        if (rounded > raw) roundingFlag = 'up';
        else if (rounded < raw) roundingFlag = 'down';
        return { value: rounded, roundingFlag };
    }

    _formatResult(val) {
        if (this.settings.isFloat) return String(val);
        // Force fixed decimals string representation
        return Number(val).toFixed(this.settings.decimals);
    }

    // --- HISTORY / TAPE ---
    _addHistoryEntry(entry) {
        // Enforce validations
        if (entry.val === undefined || isNaN(entry.val)) return;
        
        // Enrich entry
        if (!entry.timestamp) entry.timestamp = Date.now();
        this.entries.push(entry);
        
        if (!this.isReplaying) {
            this.onTapePrint(entry);
        }
    }
    
    // --- ERROR ---
    _triggerError(msg) {
        this.errorState = true;
        this.onError(msg);
        this.onDisplayUpdate(msg);
    }
}

// Support for both Node (tests) and Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CalculatorEngine;
} else {
    window.CalculatorEngine = CalculatorEngine;
}
