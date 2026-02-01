(() => {
  const COLS = 11;
  const ROWS = 32;
  const DB_NAME = "calc-sheet-db";
  const STORE_NAME = "sheet";
  const SHEET_KEY = "default";
  const columnLabels = Array.from({ length: COLS }, (_, i) => String.fromCharCode(65 + i));
  const cellData = new Map();
  const cellElements = new Map();

  const sheetRoot = document.querySelector("[data-calc-sheet]");
  const toolbar = document.querySelector("[data-calc-sheet-toolbar]");
  const formulaBar = document.querySelector("[data-sheet-formula]");
  const saveIndicator = document.querySelector("[data-sheet-save]");
  if (!sheetRoot) return;

  sheetRoot.innerHTML = "";

  let activeCellId = null;
  let saveTimer = null;
  let hasPendingSave = false;

  const corner = document.createElement("div");
  corner.className = "calc-sheet-cell header corner";
  sheetRoot.appendChild(corner);

  columnLabels.forEach((label) => {
    const cell = document.createElement("div");
    cell.className = "calc-sheet-cell header";
    cell.textContent = label;
    sheetRoot.appendChild(cell);
  });

  for (let row = 1; row <= ROWS; row += 1) {
    const rowHeader = document.createElement("div");
    rowHeader.className = "calc-sheet-cell header";
    rowHeader.textContent = row;
    sheetRoot.appendChild(rowHeader);

    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement("div");
      cell.className = "calc-sheet-cell";
      cell.dataset.cell = `${columnLabels[col]}${row}`;
      cell.dataset.editable = "true";
      cell.contentEditable = "true";
      cell.spellcheck = false;
      cell.setAttribute("role", "textbox");
      cell.setAttribute("aria-label", `Cella ${cell.dataset.cell}`);
      cell.classList.add("is-view");
      attachCellHandlers(cell);
      cellElements.set(cell.dataset.cell, cell);
      sheetRoot.appendChild(cell);
    }
  }

  loadSheetState().then(() => {
    refreshAllCells();
  });

  if (toolbar) {
    toolbar.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sheet-action]");
      if (!button || !activeCellId) return;
      const action = button.dataset.sheetAction;
      const entry = getCellEntry(activeCellId);

      if (action === "bold") {
        entry.bold = !entry.bold;
      }

      if (action === "color") {
        const color = button.dataset.color || "black";
        entry.color = color;
      }

      setCellEntry(activeCellId, entry);
      refreshAllCells();
      const activeCell = cellElements.get(activeCellId);
      if (activeCell) applyCellStyle(activeCell, entry);
      updateToolbarState();
    });
  }

  function attachCellHandlers(cell) {
    cell.addEventListener("focus", () => {
      activeCellId = cell.dataset.cell;
      setActiveCell(cell);
      cell.classList.add("is-view");
      cell.textContent = formatDisplayValue(getRawValue(activeCellId));
      applyCellStyle(cell, getCellEntry(activeCellId));
      updateToolbarState();
      updateFormulaBar(activeCellId);
    });

    cell.addEventListener("blur", () => {
      const raw = cell.textContent ?? "";
      if (!cell.classList.contains("is-view")) {
        setRawValue(cell.dataset.cell, raw.trim());
      }
      activeCellId = null;
      clearActiveCell();
      cell.classList.remove("is-view");
      refreshAllCells();
    });

    cell.addEventListener("keydown", (event) => {
      handleKeydown(event, cell);
    });
  }

  function handleKeydown(event, cell) {
    const isViewMode = cell.classList.contains("is-view");
    const key = event.key;

    if (isViewMode) {
      if (key === "Enter") {
        event.preventDefault();
        enterEditMode(cell);
        return;
      }

      if (key === "Backspace") {
        event.preventDefault();
        const raw = getRawValue(cell.dataset.cell);
        enterEditMode(cell);
        if (raw.length > 0) {
          cell.textContent = raw.slice(0, -1);
        }
        placeCaretAtEnd(cell);
        return;
      }

      if (key === "Delete") {
        event.preventDefault();
        setRawValue(cell.dataset.cell, "");
        refreshAllCells();
        return;
      }

      if (key === "Tab") {
        event.preventDefault();
        moveSelection(cell, event.shiftKey ? "left" : "right");
        return;
      }

      if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
        event.preventDefault();
        moveSelection(cell, arrowToDirection(key));
        return;
      }

      if (isPrintableKey(event)) {
        event.preventDefault();
        enterEditMode(cell, key);
      }

      return;
    }

    if (key === "Enter") {
      event.preventDefault();
      commitEdit(cell);
      moveSelection(cell, "down");
      return;
    }

    if (key === "Tab") {
      event.preventDefault();
      commitEdit(cell);
      moveSelection(cell, event.shiftKey ? "left" : "right");
      return;
    }

    if (key === "Escape") {
      event.preventDefault();
      cell.textContent = formatDisplayValue(getRawValue(cell.dataset.cell));
      cell.classList.add("is-view");
      return;
    }

    if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
      if (event.ctrlKey || event.metaKey) {
        return;
      }
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        return;
      }
    }
  }

  function enterEditMode(cell, initialChar) {
    cell.classList.remove("is-view");
    cell.textContent = getRawValue(cell.dataset.cell);
    if (typeof initialChar === "string") {
      cell.textContent = initialChar;
    }
    placeCaretAtEnd(cell);
  }

  function commitEdit(cell) {
    const raw = cell.textContent ?? "";
    setRawValue(cell.dataset.cell, raw.trim());
    cell.classList.add("is-view");
    refreshAllCells();
  }

  function arrowToDirection(key) {
    switch (key) {
      case "ArrowUp":
        return "up";
      case "ArrowDown":
        return "down";
      case "ArrowLeft":
        return "left";
      default:
        return "right";
    }
  }

  function moveSelection(cell, direction) {
    const cellId = cell.dataset.cell;
    const position = parseCellId(cellId);
    if (!position) return;
    let { row, col } = position;

    if (direction === "up") row -= 1;
    if (direction === "down") row += 1;
    if (direction === "left") col -= 1;
    if (direction === "right") col += 1;

    row = Math.min(Math.max(row, 1), ROWS);
    col = Math.min(Math.max(col, 0), COLS - 1);

    const nextId = `${columnLabels[col]}${row}`;
    const nextCell = cellElements.get(nextId);
    if (nextCell) {
      nextCell.focus();
    }
  }

  function setActiveCell(cell) {
    cellElements.forEach((item) => item.classList.remove("is-active"));
    cell.classList.add("is-active");
  }

  function clearActiveCell() {
    cellElements.forEach((item) => item.classList.remove("is-active"));
  }

  function parseCellId(cellId) {
    const match = /^([A-K])(\d{1,2})$/.exec(cellId);
    if (!match) return null;
    const col = columnLabels.indexOf(match[1]);
    const row = Number.parseInt(match[2], 10);
    if (Number.isNaN(row) || col < 0) return null;
    return { row, col };
  }

  function isPrintableKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    return event.key.length === 1;
  }

  function placeCaretAtEnd(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function getRawValue(cellId) {
    return getCellEntry(cellId).raw ?? "";
  }

  function setRawValue(cellId, value) {
    const entry = getCellEntry(cellId);
    entry.raw = value;
    setCellEntry(cellId, entry);
  }

  function getCellEntry(cellId) {
    return cellData.get(cellId) ?? { raw: "", bold: false, color: "black" };
  }

  function setCellEntry(cellId, entry) {
    cellData.set(cellId, entry);
    scheduleSave();
  }

  function refreshAllCells() {
    const cells = sheetRoot.querySelectorAll(".calc-sheet-cell[data-editable='true']");
    cells.forEach((cell) => {
      const entry = getCellEntry(cell.dataset.cell);
      applyCellStyle(cell, entry);
      cell.classList.toggle("has-formula", entry.raw.startsWith("="));
      cell.classList.toggle("is-numeric", isNumericDisplay(entry.raw));
      if (cell.dataset.cell === activeCellId && !cell.classList.contains("is-view")) return;
      cell.textContent = formatDisplayValue(entry.raw);
    });
  }

  function scheduleSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    hasPendingSave = true;
    updateSaveIndicator();
    saveTimer = setTimeout(() => {
      saveSheetState();
    }, 1000);
  }

  function formatDisplayValue(raw) {
    if (!raw) return "";
    if (raw.startsWith("=")) {
      const result = evaluateFormula(raw.slice(1));
      return Number.isFinite(result) ? formatNumber(result) : "ERR";
    }
    if (isNumericString(raw)) {
      const value = Number.parseFloat(normalizeDecimal(raw));
      return formatNumber(value);
    }
    return raw;
  }

  function isNumericDisplay(raw) {
    if (!raw) return false;
    if (raw.startsWith("=")) {
      const result = evaluateFormula(raw.slice(1));
      return Number.isFinite(result);
    }
    return isNumericString(raw);
  }

  function evaluateFormula(expression, stack = []) {
    if (!expression) return NaN;

    const withValues = expression.replace(/\b([A-K])([1-9]|[12][0-9]|3[0-2])\b/g, (match, col, row) => {
      const cellId = `${col}${row}`;
      const value = getNumericValue(cellId, stack);
      return Number.isFinite(value) ? String(value) : "NaN";
    });

    if (/[^0-9+\-*/().\s]/.test(withValues)) {
      return NaN;
    }

    try {
      const result = Function(`"use strict"; return (${withValues});`)();
      return typeof result === "number" ? round3(result) : NaN;
    } catch {
      return NaN;
    }
  }

  function getNumericValue(cellId, stack) {
    if (stack.includes(cellId)) return NaN;
    const raw = getRawValue(cellId);
    if (!raw) return 0;
    if (raw.startsWith("=")) {
      return evaluateFormula(raw.slice(1), [...stack, cellId]);
    }
    const value = Number.parseFloat(normalizeDecimal(raw));
    return Number.isFinite(value) ? round3(value) : 0;
  }

  function isNumericString(value) {
    return /^[-+]?((\d+([.,]\d*)?)|(\d*[.,]\d+))$/.test(value.trim());
  }

  function round3(value) {
    return Math.round(value * 1000) / 1000;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "ERR";
    return value.toFixed(3).replace(".", ",");
  }

  function normalizeDecimal(value) {
    return value.replace(/\./g, ",").replace(",", ".");
  }

  function colorToValue(color) {
    if (color === "blue") return "#1f4aa8";
    if (color === "red") return "#b7261d";
    return "#2d2a20";
  }

  function applyCellStyle(cell, entry) {
    cell.style.fontWeight = entry.bold ? "700" : "400";
    cell.style.color = colorToValue(entry.color);
  }

  function updateToolbarState() {
    if (!toolbar || !activeCellId) return;
    const entry = getCellEntry(activeCellId);
    const buttons = toolbar.querySelectorAll("[data-sheet-action]");
    buttons.forEach((button) => {
      const action = button.dataset.sheetAction;
      if (action === "bold") {
        button.classList.toggle("is-active", entry.bold);
        button.setAttribute("aria-pressed", entry.bold ? "true" : "false");
      }
      if (action === "color") {
        const isActive = entry.color === button.dataset.color;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      }
    });
  }

  function updateFormulaBar(cellId) {
    if (!formulaBar) return;
    const raw = getRawValue(cellId);
    if (raw.startsWith("=")) {
      formulaBar.textContent = raw;
      formulaBar.classList.remove("is-empty");
    } else {
      formulaBar.textContent = "fx";
      formulaBar.classList.add("is-empty");
    }
  }

  refreshAllCells();

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadSheetState() {
    if (!("indexedDB" in window)) return;
    try {
      const db = await openDb();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(SHEET_KEY);
      const data = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (data && typeof data === "object") {
        Object.entries(data).forEach(([cellId, entry]) => {
          if (cellElements.has(cellId)) {
            cellData.set(cellId, entry);
          }
        });
      }
      db.close();
    } catch {
      // ignore persistence errors
    }
  }

  async function saveSheetState() {
    if (!("indexedDB" in window)) return;
    try {
      const db = await openDb();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const payload = {};
      cellData.forEach((entry, cellId) => {
        payload[cellId] = entry;
      });
      store.put(payload, SHEET_KEY);
      transaction.oncomplete = () => {
        db.close();
        hasPendingSave = false;
        updateSaveIndicator();
      };
      transaction.onerror = () => {
        db.close();
        hasPendingSave = false;
        updateSaveIndicator();
      };
    } catch {
      // ignore persistence errors
      hasPendingSave = false;
      updateSaveIndicator();
    }
  }

  function updateSaveIndicator() {
    if (!saveIndicator) return;
    saveIndicator.classList.toggle("is-active", hasPendingSave);
  }
})();
