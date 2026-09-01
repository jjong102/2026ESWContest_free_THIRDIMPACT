import {
  DEFAULT_SCREENSAVER_CHARACTER,
  SCREENSAVER_CHARACTERS,
} from "../data/screensaverCharacters";

const STORAGE_KEY = "air-scent-screensaver-character";
const IDLE_DISABLED_KEY = "air-scent-screensaver-idle-disabled";

export function loadScreensaverCharacterId() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (
      saved &&
      SCREENSAVER_CHARACTERS.some(
        (item) => item.id === saved && item.available
      )
    ) {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_SCREENSAVER_CHARACTER;
}

export function saveScreensaverCharacterId(id) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore storage errors
  }
}

export function loadScreensaverIdleDisabled() {
  try {
    return window.localStorage.getItem(IDLE_DISABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveScreensaverIdleDisabled(disabled) {
  try {
    window.localStorage.setItem(IDLE_DISABLED_KEY, disabled ? "1" : "0");
  } catch {
    // ignore storage errors
  }
}
