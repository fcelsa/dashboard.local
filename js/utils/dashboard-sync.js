/**
 * Dashboard State Synchronization with GitHub Gist
 * Syncs ALL dashboard data (calculator, calc-sheet, calendar, etc) to GitHub Gist
 */

import { getCookie } from './cookies.js';

const GIST_TOKEN_COOKIE_KEY = 'githubGistToken';
const GIST_DATA_FILENAME = 'dashboard-state.json';
const GITHUB_API = 'https://api.github.com';

/**
 * Get GitHub Gist token from cookies
 */
function getGistToken() {
  const key = getCookie(GIST_TOKEN_COOKIE_KEY);
  return key ? key.trim() : null;
}

/**
 * Extract all calculator data from IndexedDB
 * Includes: user snapshots, history snapshots, current state
 */
export async function getCalculatorState() {
  try {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('CalculatorDB');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const state = {
          userSnapshots: [],
          historySnapshots: [],
          currentState: null
        };
        
        let completed = 0;
        let total = 3;

        // Load user snapshots
        const userTx = db.transaction(['userSnapshots'], 'readonly');
        const userStore = userTx.objectStore('userSnapshots');
        const userReq = userStore.getAll();
        userReq.onsuccess = () => {
          state.userSnapshots = userReq.result || [];
          if (++completed === total) {
            db.close();
            resolve(state);
          }
        };
        userReq.onerror = () => {
          console.warn('Error loading user snapshots');
          if (++completed === total) {
            db.close();
            resolve(state);
          }
        };

        // Load history snapshots
        const historyTx = db.transaction(['history'], 'readonly');
        const historyStore = historyTx.objectStore('history');
        const historyReq = historyStore.getAll();
        historyReq.onsuccess = () => {
          state.historySnapshots = historyReq.result || [];
          if (++completed === total) {
            db.close();
            resolve(state);
          }
        };
        historyReq.onerror = () => {
          console.warn('Error loading history snapshots');
          if (++completed === total) {
            db.close();
            resolve(state);
          }
        };

        // Load current state
        const currentTx = db.transaction(['current'], 'readonly');
        const currentStore = currentTx.objectStore('current');
        const currentReq = currentStore.get('current');
        currentReq.onsuccess = () => {
          state.currentState = currentReq.result || null;
          if (++completed === total) {
            db.close();
            resolve(state);
          }
        };
        currentReq.onerror = () => {
          console.warn('Error loading current state');
          if (++completed === total) {
            db.close();
            resolve(state);
          }
        };
      };
    });
  } catch (err) {
    console.error('Error getting calculator state:', err);
    return { userSnapshots: [], historySnapshots: [], currentState: null };
  }
}

/**
 * Extract all calc-sheet data from IndexedDB
 */
export async function getCalcSheetState() {
  try {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('calc-sheet-db');
      req.onerror = () => {
        console.warn('Calc-sheet DB not found');
        resolve(null);
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['sheet'], 'readonly');
        const store = tx.objectStore('sheet');
        const dataReq = store.get('default');
        
        dataReq.onsuccess = () => {
          const data = dataReq.result || null;
          db.close();
          resolve(data);
        };
        
        dataReq.onerror = () => {
          db.close();
          resolve(null);
        };
      };
    });
  } catch (err) {
    console.error('Error getting calc-sheet state:', err);
    return null;
  }
}

/**
 * Restore all calculator data to IndexedDB
 */
export async function restoreCalculatorState(state) {
  if (!state) return false;

  try {
    return new Promise((resolve) => {
      const req = indexedDB.open('CalculatorDB');
      req.onsuccess = () => {
        const db = req.result;
        let completed = 0;
        let total = 3;

        // Save user snapshots
        if (state.userSnapshots && state.userSnapshots.length > 0) {
          const userTx = db.transaction(['userSnapshots'], 'readwrite');
          const userStore = userTx.objectStore('userSnapshots');
          userStore.clear();
          state.userSnapshots.forEach(snap => {
            userStore.add(snap);
          });
          userTx.oncomplete = () => {
            if (++completed === total) {
              db.close();
              resolve(true);
            }
          };
          userTx.onerror = () => {
            if (++completed === total) {
              db.close();
              resolve(false);
            }
          };
        } else {
          if (++completed === total) {
            db.close();
            resolve(true);
          }
        }

        // Save history snapshots
        if (state.historySnapshots && state.historySnapshots.length > 0) {
          const historyTx = db.transaction(['history'], 'readwrite');
          const historyStore = historyTx.objectStore('history');
          historyStore.clear();
          state.historySnapshots.forEach(snap => {
            historyStore.add(snap);
          });
          historyTx.oncomplete = () => {
            if (++completed === total) {
              db.close();
              resolve(true);
            }
          };
          historyTx.onerror = () => {
            if (++completed === total) {
              db.close();
              resolve(false);
            }
          };
        } else {
          if (++completed === total) {
            db.close();
            resolve(true);
          }
        }

        // Save current state
        if (state.currentState) {
          const currentTx = db.transaction(['current'], 'readwrite');
          const currentStore = currentTx.objectStore('current');
          currentStore.put(state.currentState, 'current');
          currentTx.oncomplete = () => {
            if (++completed === total) {
              db.close();
              resolve(true);
            }
          };
          currentTx.onerror = () => {
            if (++completed === total) {
              db.close();
              resolve(false);
            }
          };
        } else {
          if (++completed === total) {
            db.close();
            resolve(true);
          }
        }
      };
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.error('Error restoring calculator state:', err);
    return false;
  }
}

/**
 * Restore calc-sheet data to IndexedDB
 */
export async function restoreCalcSheetState(sheetData) {
  if (!sheetData) return false;

  try {
    return new Promise((resolve) => {
      const req = indexedDB.open('calc-sheet-db');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['sheet'], 'readwrite');
        const store = tx.objectStore('sheet');
        store.put(sheetData, 'default');
        
        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        
        tx.onerror = () => {
          db.close();
          resolve(false);
        };
      };
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.error('Error restoring calc-sheet state:', err);
    return false;
  }
}

/**
 * Get complete dashboard state
 */
export async function getDashboardState() {
  const calculatorState = await getCalculatorState();
  const calcSheetState = await getCalcSheetState();

  return {
    version: 1,
    dashboard: {
      calculator: calculatorState,
      calcSheet: calcSheetState,
      // Placeholder for future data (calendar, etc)
      calendar: null
    },
    syncedAt: Date.now(),
    syncedFrom: 'calculator-app'
  };
}

/**
 * Restore complete dashboard state
 */
export async function restoreDashboardState(data) {
  if (!data || !data.dashboard) return false;

  const calcResult = await restoreCalculatorState(data.dashboard.calculator);
  const sheetResult = await restoreCalcSheetState(data.dashboard.calcSheet);

  return calcResult && sheetResult;
}

/**
 * Find existing dashboard gist
 */
export async function findDashboardGist() {
  const token = getGistToken();
  if (!token) return null;

  try {
    const response = await fetch(`${GITHUB_API}/user/gists?per_page=100`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) return null;

    const gists = await response.json();
    const dashboardGist = gists.find(g => g.description === 'Dashboard State Backup');
    return dashboardGist ? dashboardGist.id : null;
  } catch (err) {
    console.error('Error finding dashboard gist:', err);
    return null;
  }
}

/**
 * Create new dashboard gist
 */
export async function createDashboardGist(state) {
  const token = getGistToken();
  if (!token) return null;

  try {
    const response = await fetch(`${GITHUB_API}/gists`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: 'Dashboard State Backup',
        public: false,
        files: {
          [GIST_DATA_FILENAME]: {
            content: JSON.stringify(state, null, 2)
          }
        }
      })
    });

    if (!response.ok) return null;

    const gist = await response.json();
    return gist.id;
  } catch (err) {
    console.error('Error creating dashboard gist:', err);
    return null;
  }
}

/**
 * Update existing dashboard gist
 */
export async function updateDashboardGist(gistId, state) {
  const token = getGistToken();
  if (!token) return false;

  try {
    const response = await fetch(`${GITHUB_API}/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: 'Dashboard State Backup',
        files: {
          [GIST_DATA_FILENAME]: {
            content: JSON.stringify(state, null, 2)
          }
        }
      })
    });

    return response.ok;
  } catch (err) {
    console.error('Error updating dashboard gist:', err);
    return false;
  }
}

/**
 * Download dashboard state from gist
 */
export async function downloadDashboardGist(gistId) {
  const token = getGistToken();
  if (!token) return null;

  try {
    const response = await fetch(`${GITHUB_API}/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) return null;

    const gist = await response.json();
    const fileContent = gist.files[GIST_DATA_FILENAME];
    if (!fileContent) return null;

    return JSON.parse(fileContent.content);
  } catch (err) {
    console.error('Error downloading dashboard gist:', err);
    return null;
  }
}

/**
 * Sync dashboard state TO GitHub Gist
 */
export async function syncDashboardToGist() {
  const token = getGistToken();
  if (!token) {
    return {
      success: false,
      message: 'GitHub token non configurato'
    };
  }

  try {
    const state = await getDashboardState();
    let gistId = await findDashboardGist();

    if (!gistId) {
      gistId = await createDashboardGist(state);
      if (!gistId) {
        return {
          success: false,
          message: 'Errore nella creazione del backup'
        };
      }
      return {
        success: true,
        message: 'Backup creato su GitHub Gist'
      };
    } else {
      const success = await updateDashboardGist(gistId, state);
      if (!success) {
        return {
          success: false,
          message: 'Errore aggiornamento backup'
        };
      }
      return {
        success: true,
        message: 'Backup sincronizzato con GitHub Gist'
      };
    }
  } catch (err) {
    return {
      success: false,
      message: `Errore: ${err.message}`
    };
  }
}

/**
 * Sync dashboard state FROM GitHub Gist
 */
export async function syncDashboardFromGist() {
  const token = getGistToken();
  if (!token) {
    return {
      success: false,
      message: 'GitHub token non configurato'
    };
  }

  try {
    const gistId = await findDashboardGist();
    if (!gistId) {
      return {
        success: false,
        message: 'Nessun backup trovato su GitHub Gist'
      };
    }

    const remoteState = await downloadDashboardGist(gistId);
    if (!remoteState) {
      return {
        success: false,
        message: 'Errore download del backup'
      };
    }

    const restored = await restoreDashboardState(remoteState);
    if (!restored) {
      return {
        success: false,
        message: 'Errore ripristino dello stato'
      };
    }

    return {
      success: true,
      message: 'Dashboard ripristinato da GitHub Gist',
      requiresReload: true
    };
  } catch (err) {
    return {
      success: false,
      message: `Errore: ${err.message}`
    };
  }
}

/**
 * Compare timestamps between local and remote states
 */
export function compareStates(localState, remoteState) {
  if (!localState || !remoteState) return 'different';
  
  const localTime = localState.syncedAt || 0;
  const remoteTime = remoteState.syncedAt || 0;
  
  if (localTime > remoteTime) return 'local';
  if (remoteTime > localTime) return 'remote';
  return 'same';
}
