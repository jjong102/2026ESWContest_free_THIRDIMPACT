const API_BASE = import.meta.env.VITE_MQTT_API ?? "";

export async function fetchMqttAirQuality() {
  const response = await fetch(`${API_BASE}/api/mqtt/air-quality`);

  if (!response.ok) {
    throw new Error(`mqtt air-quality failed (${response.status})`);
  }

  return response.json();
}

export async function fetchMqttHealth() {
  const response = await fetch(`${API_BASE}/api/mqtt/health`);
  if (!response.ok) {
    throw new Error(`mqtt health failed (${response.status})`);
  }
  return response.json();
}

export async function setLivingScentDemo(label, targetPercent) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE}/api/mqtt/demo-scent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label ?? null,
        target: targetPercent ?? null,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload.error || "시연 향 변경에 실패했습니다");
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}
