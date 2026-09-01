const STT_BASE = "/api/stt";

export async function fetchSttHealth() {
  const response = await fetch(`${STT_BASE}/health`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "STT health check failed");
  }
  return payload;
}

export async function transcribeAudio(audioBlob) {
  let response;
  try {
    response = await fetch(`${STT_BASE}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": audioBlob.type || "audio/wav" },
      body: audioBlob,
    });
  } catch {
    throw new Error("stt-unavailable");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "stt-unavailable");
  }

  return payload;
}
