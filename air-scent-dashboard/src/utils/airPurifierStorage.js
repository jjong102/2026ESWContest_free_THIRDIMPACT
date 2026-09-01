const STORAGE_KEY = "air-scent-air-purifier-status";

const DEFAULT_STATUS = {
  on: false,
  mode: 1,
};

function normalizeMode(mode) {
  const value = Number(mode);
  return value >= 1 && value <= 3 ? value : 1;
}

export function loadAirPurifierStatus() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return DEFAULT_STATUS;
    }

    const parsed = JSON.parse(saved);
    return {
      on: Boolean(parsed?.on),
      mode: normalizeMode(parsed?.mode),
    };
  } catch {
    return DEFAULT_STATUS;
  }
}

export function saveAirPurifierStatus({ on, mode }) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        on: Boolean(on),
        mode: normalizeMode(mode),
      }),
    );
  } catch {
    // ignore storage errors
  }
}
