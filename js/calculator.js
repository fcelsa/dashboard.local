import { CalculatorEngine } from './calculator-engine.js';
import { getCookie, setCookie } from './utils/cookies.js';

document.addEventListener("DOMContentLoaded", () => {
  try {
        // --- DOM ---
    const vfdDisplay = document.getElementById("vfd-display");
    const vfdDisplayWrap = document.querySelector(".vfd-display");
    const vfdStack = document.getElementById("vfd-stack");
    const calculatorWrapper = document.querySelector(".calculator-wrapper");
    const paperTape = document.getElementById("paper-tape");
    const keys = document.querySelectorAll(".key-btn");
    const iconMem = document.getElementById("icon-mem");
    const iconGT = document.getElementById("icon-gt");
    const iconGTValue = document.getElementById("icon-gt-value");
    const iconK = document.getElementById("icon-k");
    const iconKValue = document.getElementById("icon-k-value");
    const iconTapeCount = document.getElementById("icon-tape-count");
    const iconOperator = document.getElementById("icon-operator");
    const iconBusiness = document.getElementById("icon-business");
    const keyButtonsMap = new Map();
    
    // Switch Elements
    const switchRO = document.getElementById("switch-ro");
    const switchDEC = document.getElementById("switch-dec");
    const switchACC = document.getElementById("switch-acc");
    const switchPRT = document.getElementById("switch-prt");

    // --- SETTINGS ---
    // Loading (Persistence)
    function loadSettings() {
        if (!switchRO || !switchDEC || !switchACC || !switchPRT) return;

        const storedRO = localStorage.getItem("logos_RO");
        const storedDEC = localStorage.getItem("logos_DEC");
        const storedACC = localStorage.getItem("logos_ACC");
        const storedPRT = localStorage.getItem("logos_PRT");

        if (storedRO !== null) switchRO.value = storedRO;
        if (storedDEC !== null) switchDEC.value = storedDEC;
        if (storedACC !== null) switchACC.checked = (storedACC === "true");
        if (storedPRT !== null) switchPRT.checked = (storedPRT === "true");
    }

    // Save settings on change
    function saveSettings() {
        if (!switchRO || !switchDEC || !switchACC || !switchPRT) return;
        
        localStorage.setItem("logos_RO", switchRO.value);
        localStorage.setItem("logos_DEC", switchDEC.value);
        localStorage.setItem("logos_ACC", switchACC.checked);
        localStorage.setItem("logos_PRT", switchPRT.checked);
    }

    // Helper to read current rounding settings
    function getRoundingSettings() {
        if (!switchRO || !switchDEC) return { mode: 'none', decimals: 2, isFloat: false, addMode: false, accumulateGT: false };

        // RO: 0=Truncate, 1=5/4 (None/Standard), 2=Up
        const roIndex = parseInt(switchRO.value, 10);
        let mode = 'none'; // Default to standard rounding (5/4) which is 'none' in business.js
        if (roIndex === 0) mode = 'truncate';
        if (roIndex === 2) mode = 'up';

        // DEC: 0=+, 1=0, 2=2, 3=3, 4=4, 5=6, 6=F
        const decIndex = parseInt(switchDEC.value, 10);
        let decimals = 2;
        let isFloat = false;
        let addMode = false;
        
        // Updated DEC Mapping (+, 0, 2, 3, 4, 6, F)
        switch (decIndex) {
            case 0: addMode = true; decimals = 2; break;
            case 1: decimals = 0; break;
            case 2: decimals = 2; break;
            case 3: decimals = 3; break;
            case 4: decimals = 4; break;
            case 5: decimals = 6; break;
            case 6: isFloat = true; break;
        }

        const accumulateGT = switchACC ? switchACC.checked : false;

        return { mode, decimals, isFloat, addMode, accumulateGT };
    }

    // --- SETTINGS LISTENERS ---
    if (switchRO) switchRO.addEventListener("change", saveSettings);
    if (switchDEC) switchDEC.addEventListener("change", saveSettings);
    if (switchACC) switchACC.addEventListener("change", saveSettings);
    if (switchPRT) switchPRT.addEventListener("change", saveSettings);

    // Init Logic
    loadSettings();

    // --- UI STATE ---
    let isTextMode = false; 
    let textModeBuffer = ""; 
    let lastCETime = 0;
    let errorState = false;
    let vfdOffTimeout = null;
    let paperResetTimeout = null;
    let suppressClearPrint = false;
    let pendingMemoryChord = false;
    let pendingMemoryTimeout = null;
    let pendingGTChord = false;
    let pendingGTTimeout = null;
    let pendingRateInput = false;
    let pendingRateTimeout = null;
    let pendingKInput = false;
    let pendingKTimeout = null;
    // --- FOCUS STATE ---
    const isCalculatorFocused = () => Boolean(
        calculatorWrapper && (calculatorWrapper.matches(':hover') || calculatorWrapper.matches(':focus-within'))
    );

    // --- ENGINE ---
    const engine = new CalculatorEngine();

    // Bind Engine Callbacks
    engine.onDisplayUpdate = (val) => {
        updateDisplay(val);
    };

    engine.onTapePrint = (entry) => {
        if (suppressClearPrint && entry?.symbol === "C" && entry?.key === "C") {
            return;
        }
        // Index is the last position in the engine entries array
        renderSingleEntry(entry, engine.entries.length - 1);
    };

    // Implements Full Refund (Clear & Redraw for Undo / Edit)
    engine.onTapeRefresh = (entries) => {
        if (!paperTape) return;
        paperTape.innerHTML = ''; // Clear
        entries.forEach((entry, idx) => renderSingleEntry(entry, idx));
        updateTapeCount();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry?.type === 'result') {
            updateOperatorIndicator('=');
            setBusinessIndicator(businessKeys.has(lastEntry.key));
        } else if (lastEntry?.symbol) {
            updateOperatorIndicator(lastEntry.symbol);
            setBusinessIndicator(false);
        }
    };

    engine.onStatusUpdate = (status) => {
        const iconMinus = document.getElementById("icon-minus");
        if (iconGT) {
            iconGT.classList.toggle("on", status.gt);
            iconGT.classList.toggle("off", !status.gt);
        }
        if (iconGTValue) {
            const gtValue = engine?.grandTotal ?? 0;
            iconGTValue.textContent = status.gt ? formatNumber(gtValue) : "";
        }
        if (iconMinus) iconMinus.className = status.minus ? "vfd-icon on" : "vfd-icon off";
        if (iconK) {
            const hasKValue = status.k !== null && status.k !== 0;
            iconK.classList.toggle("on", hasKValue);
            iconK.classList.toggle("off", !hasKValue);
        }
        if (iconKValue) {
            iconKValue.textContent = status.k !== null && status.k !== 0 ? "= " + formatNumber(status.k) : "";
        }
    };
    function formatStackValue(value) {
        const rounded = Math.round(Number(value) * 1000) / 1000;
        let text = rounded
            .toFixed(3)
            .replace(/\.0+$/, "")
            .replace(/(\.[0-9]*?)0+$/, "$1");
        if (text.endsWith('.')) text = text.slice(0, -1);
        const parts = text.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
        return parts.join(',');
    }

    engine.onMemoryUpdate = (memory) => {
        if (iconMem) iconMem.className = memory.hasMemory ? "vfd-icon on" : "vfd-icon off";
        if (!vfdStack) return;
        if (memory.mode === 'stack' && memory.stack.length > 0) {
            const items = memory.stack.slice(-8).map(formatStackValue);
            vfdStack.textContent = items.join(' · ');
        } else {
            vfdStack.textContent = '';
        }
    };

    engine.onError = (msg) => {
        updateDisplay(msg);
        // Play error sound?
    };

    // --- ENGINE SETTINGS SYNC ---
    let displaySettings = getRoundingSettings();

    function updateEngineSettings() {
        if (!engine) return;
        const s = getRoundingSettings();
        displaySettings = s;
        engine.updateSettings({
            roundingMode: s.mode,
            decimals: s.decimals,
            isFloat: s.isFloat,
            addMode: s.addMode,
            accumulateGT: s.accumulateGT,
            memoryMode: s.accumulateGT ? 'stack' : 'algebric'
        });
    }

    // Hook settings change to engine
    [switchRO, switchDEC, switchACC].forEach(s => {
        if(s) s.addEventListener('change', updateEngineSettings);
    });
    // Init engine settings
    updateEngineSettings();

    const rateCookieKey = "logos_TAX_RATE";
    const storedRate = parseFloat(getCookie(rateCookieKey));
    if (!isNaN(storedRate)) {
        engine.taxRate = storedRate;
    } else {
        engine.taxRate = 22;
    }

    engine.onRateUpdate = (rate) => {
        const ONE_YEAR = 60 * 60 * 24 * 365;
        setCookie(rateCookieKey, rate, ONE_YEAR);
        pendingRateInput = false;
        if (pendingRateTimeout) clearTimeout(pendingRateTimeout);
        pendingRateTimeout = null;
        if (vfdDisplayWrap) vfdDisplayWrap.classList.remove("is-blink");
    };

    // --- TAPE VIEW ---
    keys.forEach((btn) => {
        const dataKey = btn.getAttribute("data-key");
        if (!dataKey) return;
        if (!keyButtonsMap.has(dataKey)) keyButtonsMap.set(dataKey, []);
        keyButtonsMap.get(dataKey).push(btn);
    });

    function setKeyActive(action, active) {
        if (!action) return;
        const buttons = keyButtonsMap.get(action);
        if (!buttons) return;
        buttons.forEach((btn) => btn.classList.toggle("active", active));
    }

    const businessKeys = new Set(['COST', 'SELL', 'MARGIN', 'MARKUP', 'TAX+', 'TAX-']);
    const nonOperandKeys = new Set(['RATE', 'GT', '#', 'CE', 'C', 'CLEAR_ALL', 'T', 'T1']);
    const operatorDisplayMap = new Map([
        ['+', '+'],
        ['-', '-'],
        ['x', 'x'],
        ['÷', '÷'],
        ['%', '%'],
        ['Δ', 'Δ'],
        ['^', '^'],
        ['=', '='],
        ['S1', 'S'],
        ['T1', 'T']
    ]);

    const updateTapeCount = () => {
        if (!iconTapeCount || !paperTape) return;
            const count = paperTape.querySelectorAll('.tape-row.tape-operand').length;
        iconTapeCount.textContent = String(count);
    };

    const updateOperatorIndicator = (value) => {
        if (!iconOperator) return;
        iconOperator.textContent = value || '';
    };

    const setBusinessIndicator = (isOn) => {
        if (!iconBusiness) return;
        iconBusiness.className = isOn ? 'vfd-icon on' : 'vfd-icon off';
    };

    // Keys whose tape entries should NOT be editable
    const nonEditableKeys = new Set([
        'T1', 'S1', 'GT', 'C', 'CLEAR_ALL', 'CONST', 'RATE', 'K', '#'
    ]);

    /**
     * Check whether a tape entry is user-editable.
     * @param {Object} entry
     * @returns {boolean}
     */
    const isEntryEditable = (entry) => {
        if (!entry || entry.type !== 'input') return false;
        if (entry.type === 'info') return false;
        return !nonEditableKeys.has(entry.key);
    };

    /**
     * Turn a tape value span into an inline editor.
     * On commit the engine recalculates the full tape.
     * @param {HTMLElement} valSpan
     * @param {number} entryIndex - position in engine.entries
     */
    function startTapeEdit(valSpan, entryIndex) {
        if (entryIndex < 0) return;
        const entry = engine.entries[entryIndex];
        if (!entry) return;

        const input = document.createElement("input");
        input.type = "text";
        input.className = "tape-edit-input";
        // Show the raw numeric value so the user can edit the actual number
        input.value = String(entry.val);

        valSpan.textContent = "";
        valSpan.appendChild(input);
        input.focus();
        input.select();

        let committed = false;
        const commitEdit = () => {
            if (committed) return;
            committed = true;
            const rawVal = input.value.replace(',', '.');
            const newVal = parseFloat(rawVal);
            if (!isNaN(newVal) && newVal !== entry.val) {
                engine.editEntry(entryIndex, newVal);
            } else {
                // Restore current tape (cancel or same value)
                if (engine.onTapeRefresh) {
                    engine.onTapeRefresh(engine.entries);
                }
            }
        };

        input.addEventListener("blur", commitEdit, { once: true });
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                input.blur(); // triggers commitEdit via blur
            } else if (e.key === "Escape") {
                committed = true;
                // Restore without changes
                if (engine.onTapeRefresh) {
                    engine.onTapeRefresh(engine.entries);
                }
            }
        });
    }

    // Appends a single entry to the existing DOM tape
    function renderSingleEntry(entry, entryIndex) {
        if (!paperTape) return;
        
        const row = document.createElement("div");
        row.className = "tape-row";
        const entryValue = entry?.val;
        const entryNumber = Number(String(entryValue).replace(',', '.'));
        const isZeroValue = !Number.isNaN(entryNumber) && entryNumber === 0;
        if (entry?.type === 'input' && !nonOperandKeys.has(entry.key) && !isZeroValue) {
            row.classList.add("tape-operand");
        }
        
        // Alignment
        /* 
           Logic update: 
           - Operations (x, /, =) are LEFT aligned (input operand + symbol)
           - Results (no symbol but key is =) are LEFT aligned (actually usually Right aligned?) 
             Mult:
             10 x   (Left)
             5 =    (Left)
             50     (Right - Result)
             
             If key is x, ÷, = OR symbol is =, align LEFT.
             CONST entry has key='CONST'.
        */
        // Special case: when printing the second operand as an input with symbol '='
        // for an add/sub chain, we want it right-aligned so the symbol stays to the
        // right of the number (matches user expectation). Detect this by looking
        // at the last rendered row's symbol (if any).
        let forcedAlignRightForEquals = false;
        if (entry.key === '=' && entry.type === 'input') {
            const lastRow = paperTape?.querySelector?.('.tape-row:last-child');
            const lastSym = lastRow?.querySelector('.tape-symbol')?.textContent?.trim();
            if (lastSym === '+' || lastSym === '-') {
                forcedAlignRightForEquals = true;
            }
        }

        if (entry.symbol === '◇' || entry.symbol === 'S' || entry.symbol === 'T' || forcedAlignRightForEquals) {
            row.classList.add("align-right");
        } else if (['x', '÷', 'CONST'].includes(entry.key) || entry.symbol === '=') {
            // Keep multiplication/division and explicit '=' result markers left aligned
            row.classList.add("align-left");
        } else {
            row.classList.add("align-right");
        }

        // Visual Separation for Result Blocks (Empty symbol with = key)
        if (entry.symbol === '◇' || (entry.key === '=' && entry.symbol === '' && entry.type !== 'input') || entry.type === 'result') {
            row.classList.add("result-row");
        }

        // Negative Color
        const valNum = parseFloat(entry.val);
        const pctNum = typeof entry.percentValue !== "undefined" ? parseFloat(entry.percentValue) : NaN;
        const isNeg = (!isNaN(valNum) && valNum < 0) || (!isNaN(pctNum) && pctNum < 0) || entry.symbol === '-' || entry.symbol === 'TAX-';
        if (isNeg) {
            row.classList.add("negative");
        }

        const valSpan = document.createElement("span");
        valSpan.className = "tape-val";
        
        let displayVal = entry.val;
        // If it's a number, format it
        if (typeof entry.val === 'number') {
             displayVal = formatNumber(entry.val);
        } else if (!isNaN(parseFloat(entry.val)) && entry.key !== '#') {
             displayVal = formatNumber(entry.val);
        }
        
        if (entry.percentSuffix) {
            displayVal = `${displayVal}%`;
        }
        if (entry.roundingFlag === 'up') {
            displayVal = `${displayVal} ↑`;
        } else if (entry.roundingFlag === 'down') {
            displayVal = `${displayVal} ↓`;
        }
        valSpan.textContent = displayVal;

        // Make editable entries respond to double-click
        if (isEntryEditable(entry) && typeof entryIndex === 'number' && entryIndex >= 0) {
            valSpan.classList.add("tape-editable");
            const idx = entryIndex; // capture for closure
            valSpan.addEventListener("dblclick", () => startTapeEdit(valSpan, idx));
        }

        const symSpan = document.createElement("span");
        symSpan.className = "tape-symbol";
        const lead = entry.leadSymbol ? `${entry.leadSymbol} ` : "";
        symSpan.textContent = `${lead}${entry.symbol || ""}`;
        if (entry.symbol === 'S' || entry.symbol === 'T') {
            symSpan.classList.add("tape-symbol-small");
        }

        // Append value then symbol (symbols stay to the right of the number)
        row.appendChild(valSpan);
        row.appendChild(symSpan);

        if (typeof entry.percentValue !== "undefined") {
            const percentSpan = document.createElement("span");
            percentSpan.className = "tape-percent";
            const formatted = formatNumber(entry.percentValue);
            percentSpan.textContent = ` | ${formatted}`;
            row.appendChild(percentSpan);
        }
        paperTape.appendChild(row);
        
        paperTape.scrollTop = paperTape.scrollHeight;
        updateTapeCount();
        if (entry?.type === 'result') {
            updateOperatorIndicator('=');
            setBusinessIndicator(businessKeys.has(entry.key));
        } else if (entry?.symbol) {
            updateOperatorIndicator(entry.symbol);
        }
    }
    
    // Clear Tape UI
    function clearTapeUI() {
        if (paperTape) paperTape.innerHTML = "";
        updateTapeCount();
        updateOperatorIndicator('');
        setBusinessIndicator(false);
    }

    function isTapeAtZeroClear() {
        if (!paperTape) return false;
        const lastRow = paperTape.querySelector(".tape-row:last-child");
        if (!lastRow) return false;
        const valText = lastRow.querySelector(".tape-val")?.textContent?.trim();
        const symText = lastRow.querySelector(".tape-symbol")?.textContent?.trim();
        return valText === "0" && symText === "C";
    }

    function triggerClearFeedback(forcePaperReset) {
        if (vfdDisplayWrap) {
            vfdDisplayWrap.classList.add("is-off");
            if (vfdOffTimeout) clearTimeout(vfdOffTimeout);
            vfdOffTimeout = setTimeout(() => {
                vfdDisplayWrap.classList.remove("is-off");
            }, 800);
        }

        if (forcePaperReset) {
            suppressClearPrint = true;
            clearTapeUI();
            if (paperResetTimeout) clearTimeout(paperResetTimeout);
            paperResetTimeout = setTimeout(() => {
                suppressClearPrint = false;
                renderSingleEntry({ val: 0, symbol: "C", key: "C", type: "input" });
            }, 500);
        } else {
            suppressClearPrint = false;
        }
    }

    // --- UTILS ---

    // Standard JS uses decimal point. 
    function formatNumber(numStr) {
        if (numStr === null || numStr === undefined) return "";
        const s = String(numStr);
        const n = Number(s.replace(',', '.'));
        if (Number.isNaN(n)) return s;

        let formatted = s;
        if (!displaySettings?.isFloat) {
            const dec = displaySettings?.decimals ?? 2;
            formatted = n.toFixed(dec);
        }

        const parts = formatted.split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
        return parts.join(",");
    }

    // Play sound (optional simulation)
    function playClickSound() {
        // Future implementation
    }

    // --- DISPLAY (VFD) ---
    // Update VFD
    function updateDisplay(val) {
        if (!vfdDisplay) return;
        // Clear error state on next normal update if value is not 'Error'
        if (errorState && val !== 'Error') errorState = false;
        if (isTextMode) {
            vfdDisplay.textContent = val;
        } else {
            // Format number for display
            vfdDisplay.textContent = formatNumber(val);
        }
    }

    // --- INPUT HANDLING ---
    function handleTextModeInput(key) {
        if (key === "Enter" || key === "=") {
            // Confirm and print
            renderSingleEntry({ val: textModeBuffer, symbol: '#' }); // Fabricated entry
            textModeBuffer = "";
            isTextMode = false;
            updateDisplay("0"); // Exit text mode
            return;
        }

        if (key === "Backspace" || key === "CE") {
            if (textModeBuffer.length > 0) {
                textModeBuffer = textModeBuffer.slice(0, -1);
            }
            updateDisplay(textModeBuffer || "#");
            return;
        }

        if (key === '#') return;

        if (key.length === 1 && textModeBuffer.length < 21) { // Single char
            textModeBuffer += key.toUpperCase();
            updateDisplay(textModeBuffer);
        }
    }

    function applyUiSpecialCases(key) {
        let engineKey = key;

        // --- SPECIAL UI LOGIC: Clear Entry / Clear All ---
        if (key === 'CE') {
             const now = Date.now();
             if (now - lastCETime < 500) {
                 // Double Click -> Clear All
                 engineKey = 'CLEAR_ALL';
                 lastCETime = 0; 
             } else {
                 engineKey = 'CE';
                 lastCETime = now;
             }
           }

        return engineKey;
    }

    function handleInput(key, isRealKeyboardInput = false) {
        playClickSound();


        if (pendingGTChord && key !== 'S1' && key !== 'T1') {
            pendingGTChord = false;
            if (pendingGTTimeout) clearTimeout(pendingGTTimeout);
            pendingGTTimeout = null;
            if (iconGT) iconGT.classList.remove("mem-pending");
            engine.pressKey('GT');
        }

        if (pendingGTChord && (key === 'S1' || key === 'T1')) {
            pendingGTChord = false;
            if (pendingGTTimeout) clearTimeout(pendingGTTimeout);
            pendingGTTimeout = null;
            if (iconGT) iconGT.classList.remove("mem-pending");
        }

        // --- TEXT MODE MANAGEMENT (#) ---
        if (isTextMode) {
            handleTextModeInput(key);
            return;
        }

        if (key === '#') {
            isTextMode = true;
            textModeBuffer = "";
            updateDisplay("#");
            return;
        }

        // --- MAP DOM KEY TO ENGINE KEY ---
        // (Adjustments for labels vs Engine expectations)
        const engineKey = applyUiSpecialCases(key);

        const opDisplay = operatorDisplayMap.get(engineKey) || operatorDisplayMap.get(key);
        if (opDisplay) updateOperatorIndicator(opDisplay);
        if (!businessKeys.has(engineKey) && !businessKeys.has(key)) {
            setBusinessIndicator(false);
        }

        if (pendingKInput && (engineKey === '=' || engineKey === 'Enter' || engineKey === 'CLEAR_ALL' || engineKey === 'CE')) {
            pendingKInput = false;
            if (pendingKTimeout) clearTimeout(pendingKTimeout);
            pendingKTimeout = null;
            if (iconK) iconK.classList.remove("blink");
        }

        if (engineKey === "CLEAR_ALL") {
            const forcePaperReset = isTapeAtZeroClear();
            triggerClearFeedback(forcePaperReset);
        }

        if (key === 'RATE') {
            if (vfdDisplay && vfdDisplay.textContent.trim() !== '0') {
                engine.pressKey('CLEAR_ALL');
            }
            pendingRateInput = true;
            if (pendingRateTimeout) clearTimeout(pendingRateTimeout);
            pendingRateTimeout = setTimeout(() => {
                pendingRateInput = false;
                pendingRateTimeout = null;
                if (vfdDisplayWrap) vfdDisplayWrap.classList.remove("is-blink");
                engine.pressKey('CLEAR_ALL');
            }, 5000);
            if (vfdDisplayWrap) vfdDisplayWrap.classList.add("is-blink");
            if (engine?.taxRate !== undefined && engine?.taxRate !== null) {
                updateDisplay(String(engine.taxRate));
            }
            engine.pressKey('RATE');
            return;
        }

        if (key === 'K') {
            pendingKInput = true;
            if (pendingKTimeout) clearTimeout(pendingKTimeout);
            pendingKTimeout = setTimeout(() => {
                if (!pendingKInput) return;
                pendingKInput = false;
                pendingKTimeout = null;
                if (iconK) iconK.classList.remove("blink");
                engine.pressKey('=');
            }, 5000);
            if (iconK) iconK.classList.add("blink");
            engine.pressKey('K');
            return;
        }

        if (key === 'GT') {
            pendingGTChord = true;
            if (pendingGTTimeout) clearTimeout(pendingGTTimeout);
            pendingGTTimeout = setTimeout(() => {
                pendingGTChord = false;
                pendingGTTimeout = null;
                if (iconGT) iconGT.classList.remove("mem-pending");
                engine.pressKey('GT');
            }, 5000);
            if (iconGT) iconGT.classList.add("mem-pending");
            engine.pressKey('GT');
            return;
        }

        // --- DISPATCH TO ENGINE ---
        engine.pressKey(engineKey);
    }

    function mapKeyboardToAction(eventOrKey) {
        const key = typeof eventOrKey === "string" ? eventOrKey : eventOrKey.key;
        const isEvent = typeof eventOrKey !== "string";
        if (isEvent && key === '0') {
            if (eventOrKey.ctrlKey) return '00';
            if (eventOrKey.altKey) return '000';
        }
        if (key === '#') return '#';
        if (key >= '0' && key <= '9') return key;
        if (key === '.' || key === ',') return '.';
        if (key === '+') return '+';
        if (key === '-') return '-';
        if (key === '%') return '%';
        if (key === '*' || key.toLowerCase() === 'x') return 'x';
        if (key === '/') return '÷';
        if (key === 'Enter' || key === '=') return '=';
        if (key === '^') return '^';
        if (key === 'Backspace') return 'BACKSPACE';
        if (key === 'Delete') return 'CE';
        if (key === 'Escape') return 'CE';
        if (key.toLowerCase() === 't') return 'T1';
        if (key.toLowerCase() === 's' || key.toLowerCase() === 'i') return 'S1';
        if (key.toLowerCase() === 'g') return 'GT';
        if (key.toLowerCase() === 'd') return 'Δ';
        if (key.toLowerCase() === 'r') return '√';
        if (key.toLowerCase() === 'p') return '^';
        if (key.toLowerCase() === 'k') return 'K';
        return null;
    }
    
    // --- EVENT LISTENERS ---
    
    function handleUiClick(buttonEl) {
        const action = buttonEl.getAttribute("data-key");
        if (action) handleInput(action);
    }

    function handleKeyboard(event) {
        const target = event.target;
        if (target) {
            const tagName = target.tagName;
            const isFormField = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
            const inSheet = typeof target.closest === 'function' &&
                (target.closest('[data-calc-sheet]') || target.closest('[data-calc-sheet-toolbar]'));
            if (isFormField || target.isContentEditable || inSheet) {
                return;
            }
        }
        if (isCalculatorFocused() && paperTape && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault();
            const delta = event.key === 'ArrowUp' ? -40 : 40;
            paperTape.scrollTop += delta;
            return;
        }
        if (isTextMode) {
            event.preventDefault();
            handleInput(event.key, true);
            return;
        }
        const keyLower = event.key.toLowerCase();
        const isUndoCombo = (event.metaKey || event.ctrlKey) && !event.altKey && keyLower === 'z';
        const isRedoCombo = event.ctrlKey && !event.metaKey && !event.altKey && keyLower === 'y';
        const isSignToggle = (event.key === '-' && event.shiftKey) || event.key === '_';

        if (pendingMemoryChord) {
            if (keyLower === '+') {
                event.preventDefault();
                pendingMemoryChord = false;
                if (pendingMemoryTimeout) clearTimeout(pendingMemoryTimeout);
                pendingMemoryTimeout = null;
                if (iconMem) iconMem.classList.remove("mem-pending");
                setKeyActive('M+', true);
                handleInput('M+', true);
                setTimeout(() => setKeyActive('M+', false), 80);
                return;
            }
            if (keyLower === '-') {
                event.preventDefault();
                pendingMemoryChord = false;
                if (pendingMemoryTimeout) clearTimeout(pendingMemoryTimeout);
                pendingMemoryTimeout = null;
                if (iconMem) iconMem.classList.remove("mem-pending");
                setKeyActive('M-', true);
                handleInput('M-', true);
                setTimeout(() => setKeyActive('M-', false), 80);
                return;
            }
            if (keyLower === 'r') {
                event.preventDefault();
                pendingMemoryChord = false;
                if (pendingMemoryTimeout) clearTimeout(pendingMemoryTimeout);
                pendingMemoryTimeout = null;
                if (iconMem) iconMem.classList.remove("mem-pending");
                setKeyActive('MR', true);
                handleInput('MR', true);
                setTimeout(() => setKeyActive('MR', false), 80);
                return;
            }
            if (keyLower === 'c') {
                event.preventDefault();
                pendingMemoryChord = false;
                if (pendingMemoryTimeout) clearTimeout(pendingMemoryTimeout);
                pendingMemoryTimeout = null;
                if (iconMem) iconMem.classList.remove("mem-pending");
                setKeyActive('MC', true);
                handleInput('MC', true);
                setTimeout(() => setKeyActive('MC', false), 80);
                return;
            }

            // any other key cancels the chord
            pendingMemoryChord = false;
            if (pendingMemoryTimeout) clearTimeout(pendingMemoryTimeout);
            pendingMemoryTimeout = null;
            if (iconMem) iconMem.classList.remove("mem-pending");
            event.preventDefault();
            return;
        }

        if (pendingGTChord) {
            if (keyLower === 's') {
                event.preventDefault();
                pendingGTChord = false;
                if (pendingGTTimeout) clearTimeout(pendingGTTimeout);
                pendingGTTimeout = null;
                if (iconGT) iconGT.classList.remove("mem-pending");
                setKeyActive('S1', true);
                handleInput('S1', true);
                setTimeout(() => setKeyActive('S1', false), 80);
                return;
            }
            if (keyLower === 't') {
                event.preventDefault();
                pendingGTChord = false;
                if (pendingGTTimeout) clearTimeout(pendingGTTimeout);
                pendingGTTimeout = null;
                if (iconGT) iconGT.classList.remove("mem-pending");
                setKeyActive('T1', true);
                handleInput('T1', true);
                setTimeout(() => setKeyActive('T1', false), 80);
                return;
            }
            pendingGTChord = false;
            if (pendingGTTimeout) clearTimeout(pendingGTTimeout);
            pendingGTTimeout = null;
            if (iconGT) iconGT.classList.remove("mem-pending");
            handleInput('GT', true);
        }

        if (keyLower === 'm') {
            pendingMemoryChord = true;
            if (pendingMemoryTimeout) clearTimeout(pendingMemoryTimeout);
            pendingMemoryTimeout = setTimeout(() => {
                pendingMemoryChord = false;
                pendingMemoryTimeout = null;
                if (iconMem) iconMem.classList.remove("mem-pending");
            }, 5000);
            if (iconMem) iconMem.classList.add("mem-pending");
            event.preventDefault();
            return;
        }

        if (isUndoCombo) {
            event.preventDefault();
            if (event.shiftKey) {
                if (engine.redo) engine.redo();
            } else {
                if (engine.undo) engine.undo();
            }
            return;
        }

        if (isRedoCombo) {
            event.preventDefault();
            if (engine.redo) engine.redo();
            return;
        }

        if (isSignToggle) {
            event.preventDefault();
            handleInput('±', true);
            return;
        }

        const action = mapKeyboardToAction(event);
        if (event.key === 'Enter' || event.key === '=') {
            event.preventDefault();
        }
        if (event.key === '0' && (event.ctrlKey || event.altKey)) {
            event.preventDefault();
        }
        setKeyActive(action, true);
        if (action) handleInput(action, true);
    }

    function handleKeyboardUp(event) {
        const target = event.target;
        if (target) {
            const tagName = target.tagName;
            const isFormField = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
            const inSheet = typeof target.closest === 'function' &&
                (target.closest('[data-calc-sheet]') || target.closest('[data-calc-sheet-toolbar]'));
            if (isFormField || target.isContentEditable || inSheet) {
                return;
            }
        }
        const action = mapKeyboardToAction(event);
        setKeyActive(action, false);
    }

    // 1. Mouse Click (Virtual Keys)
    keys.forEach(k => {
        k.addEventListener("click", () => handleUiClick(k));
    });

    // 2. Keyboard Input
    document.addEventListener("keydown", handleKeyboard);
    document.addEventListener("keyup", handleKeyboardUp);
    } catch (err) {
        console.error("Main initialization error:", err);
    }
});
