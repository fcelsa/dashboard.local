document.addEventListener("DOMContentLoaded", () => {
  try {
        // --- DOM ---
    const vfdDisplay = document.getElementById("vfd-display");
    const vfdStack = document.getElementById("vfd-stack");
    const paperTape = document.getElementById("paper-tape");
    const keys = document.querySelectorAll(".key-btn");
    const iconMem = document.getElementById("icon-mem");
    
    // Switch Elements
    const switchRO = document.getElementById("switch-ro");
    const switchDEC = document.getElementById("switch-dec");
    const switchACC = document.getElementById("switch-acc");
    const switchPRT = document.getElementById("switch-prt");

    // DEBUG CHECK
    if (!window.CalculatorEngine) {
        throw new Error("CalculatorEngine class not loaded"); 
    }

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
        if (!switchRO || !switchDEC) return { mode: 'none', decimals: 2, isFloat: false, accumulateGT: false };

        // RO: 0=Truncate, 1=5/4 (None/Standard), 2=Up
        const roIndex = parseInt(switchRO.value, 10);
        let mode = 'none'; // Default to standard rounding (5/4) which is 'none' in business.js
        if (roIndex === 0) mode = 'truncate';
        if (roIndex === 2) mode = 'up';

        // DEC: 0=0, 1=2, 2=4, 3=6, 4=F
        const decIndex = parseInt(switchDEC.value, 10);
        let decimals = 2;
        let isFloat = false;
        
        // Updated DEC Mapping (0, 2, 4, 6, F)
        switch (decIndex) {
            case 0: decimals = 0; break;
            case 1: decimals = 2; break;
            case 2: decimals = 4; break;
            case 3: decimals = 6; break;
            case 4: isFloat = true; break;
        }

        const accumulateGT = switchACC ? switchACC.checked : false;

        return { mode, decimals, isFloat, accumulateGT };
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

    // --- ENGINE ---
    // Ensure CalculatorEngine is loaded
    const EngineClass = window.CalculatorEngine;
    if (!EngineClass) {
        console.error("CalculatorEngine not found!");
        updateDisplay("ERR: ENGINE");
    }

    const engine = new EngineClass();

    // Bind Engine Callbacks
    engine.onDisplayUpdate = (val) => {
        updateDisplay(val);
    };

    engine.onTapePrint = (entry) => {
        renderSingleEntry(entry);
    };

    // Implements Full Refund (Clear & Redraw for Undo)
    engine.onTapeRefresh = (entries) => {
        if (!paperTape) return;
        paperTape.innerHTML = ''; // Clear
        entries.forEach(entry => renderSingleEntry(entry));
    };

    engine.onStatusUpdate = (status) => {
        const iconI = document.getElementById("icon-acc1");
        const iconII = document.getElementById("icon-acc2");
        const iconGT = document.getElementById("icon-gt");
        const iconE = document.getElementById("icon-error");
        const iconMinus = document.getElementById("icon-minus");

        if (iconI) iconI.className = status.acc1 ? "vfd-icon on" : "vfd-icon off";
        if (iconII) iconII.className = status.acc2 ? "vfd-icon on" : "vfd-icon off";
        if (iconGT) iconGT.className = status.gt ? "vfd-icon on" : "vfd-icon off";
        if (iconE) iconE.className = status.error ? "vfd-icon on" : "vfd-icon off";
        if (iconMinus) iconMinus.className = status.minus ? "vfd-icon on" : "vfd-icon off";
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
    function updateEngineSettings() {
        if (!engine) return;
        const s = getRoundingSettings();
        engine.updateSettings({
            roundingMode: s.mode,
            decimals: s.decimals,
            isFloat: s.isFloat,
            accumulateGT: s.accumulateGT,
            memoryMode: s.accumulateGT ? 'stack' : 'algebraic'
        });
    }

    // Hook settings change to engine
    [switchRO, switchDEC, switchACC].forEach(s => {
        if(s) s.addEventListener('change', updateEngineSettings);
    });
    // Init engine settings
    updateEngineSettings();

    // --- TAPE VIEW ---
    // Appends a single entry to the existing DOM tape
    function renderSingleEntry(entry) {
        if (!paperTape) return;
        
        const row = document.createElement("div");
        row.className = "tape-row";
        
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
        if (entry.symbol === '◇') {
            row.classList.add("align-right");
        } else if (['x', '÷', '=', 'CONST'].includes(entry.key) || entry.symbol === '=') {
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
        const isNeg = (!isNaN(valNum) && valNum < 0) || entry.symbol === '-' || entry.symbol === 'TAX-';
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
        
        valSpan.textContent = displayVal;

        const symSpan = document.createElement("span");
        symSpan.className = "tape-symbol";
        symSpan.textContent = entry.symbol || "";

        row.appendChild(valSpan);
        row.appendChild(symSpan);
        paperTape.appendChild(row);
        
        paperTape.scrollTop = paperTape.scrollHeight;
    }
    
    // Clear Tape UI
    function clearTapeUI() {
        if (paperTape) paperTape.innerHTML = "";
    }

    // --- UTILS ---

    // Standard JS uses decimal point. 
    function formatNumber(numStr) {
        if (numStr === null || numStr === undefined) return "";
        let s = String(numStr);
        
        // If there is a decimal point, split
        const parts = s.split(".");
        // Format the integer part with apostrophe (Olivetti VFD thousands separator)
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'"); 
        // Reconstruct with decimal comma
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
        } else if (key === "Backspace" || key === "CE") {
            textModeBuffer = textModeBuffer.slice(0, -1);
            updateDisplay(textModeBuffer || "#");
        } else {
            if (key.length === 1) { // Single char
                 textModeBuffer += key.toUpperCase();
                 updateDisplay(textModeBuffer);
            }
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
        } else if (key === 'C') {
             // Backup map for direct Clear All
             engineKey = 'CLEAR_ALL';
        }

        return engineKey;
    }

    function handleInput(key, isRealKeyboardInput = false) {
        playClickSound();

        // --- TEXT MODE MANAGEMENT (#) ---
        if (isTextMode) {
            handleTextModeInput(key);
            return;
        }

        if (key === '#') {
            isTextMode = true;
            textModeBuffer = "#";
            updateDisplay("#");
            return;
        }

        // --- MAP DOM KEY TO ENGINE KEY ---
        // (Adjustments for labels vs Engine expectations)
        const engineKey = applyUiSpecialCases(key);

        // --- DISPATCH TO ENGINE ---
        engine.pressKey(engineKey);
    }

    function mapKeyboardToAction(key) {
        if (key >= '0' && key <= '9') return key;
        if (key === '.' || key === ',') return '.';
        if (key === '+') return '+';
        if (key === '-') return '-';
        if (key === '*' || key.toLowerCase() === 'x') return 'x';
        if (key === '/') return '÷';
        if (key === 'Enter' || key === '=') return '=';
        if (key === 'Backspace') return 'BACKSPACE';
        if (key === 'Delete') return 'CLEAR_ALL';
        if (key === 'Escape') return 'CE';
        if (key.toLowerCase() === 'c') return 'CLEAR_ALL';
        if (key.toLowerCase() === 't') return 'T1';
        if (key.toLowerCase() === 'i') return 'S1';
        if (key.toLowerCase() === 'g') return 'GT';
        return null;
    }
    
    // --- EVENT LISTENERS ---
    
    function handleUiClick(buttonEl) {
        const action = buttonEl.getAttribute("data-key");
        if (action) handleInput(action);
    }

    function handleKeyboard(event) {
        const keyLower = event.key.toLowerCase();
        const isUndoCombo = (event.metaKey || event.ctrlKey) && !event.altKey && keyLower === 'z';
        const isRedoCombo = event.ctrlKey && !event.metaKey && !event.altKey && keyLower === 'y';
        const isSignToggle = (event.key === '-' && event.shiftKey) || event.key === '_';

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

        const action = mapKeyboardToAction(event.key);
        if (event.key === 'Enter' || event.key === '=') {
            event.preventDefault();
        }
        if (action) handleInput(action, true);
    }

    // 1. Mouse Click (Virtual Keys)
    keys.forEach(k => {
        k.addEventListener("click", () => handleUiClick(k));
    });

    // 2. Keyboard Input
    document.addEventListener("keydown", handleKeyboard);

  } catch (err) {
      console.error("Main initialization error:", err);
  }
});
