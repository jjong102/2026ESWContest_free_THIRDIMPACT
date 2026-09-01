const API_BASE = import.meta.env.VITE_FRAGRANCE_API ?? "";
const FETCH_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function sendFragranceCommands(commands, state) {
  const response = await fetchWithTimeout(`${API_BASE}/api/fragrance/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands, state }),
  });

  if (!response.ok) {
    throw new Error(`fragrance command failed (${response.status})`);
  }

  return response.json();
}

export async function fetchFragranceHealth() {
  const response = await fetchWithTimeout(`${API_BASE}/api/fragrance/health`);

  if (!response.ok) {
    throw new Error(`fragrance health failed (${response.status})`);
  }

  return response.json();
}

export async function fetchDeviceState() {
  const response = await fetchWithTimeout(`${API_BASE}/api/fragrance/state`);

  if (!response.ok) {
    throw new Error(`fragrance state failed (${response.status})`);
  }

  return response.json();
}

export async function reconnectFragrance() {
  const response = await fetchWithTimeout(`${API_BASE}/api/fragrance/reconnect`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`fragrance reconnect failed (${response.status})`);
  }

  return response.json();
}

export async function putDeviceState(state) {
  const response = await fetchWithTimeout(`${API_BASE}/api/fragrance/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });

  if (!response.ok) {
    throw new Error(`fragrance state put failed (${response.status})`);
  }

  return response.json();
}
