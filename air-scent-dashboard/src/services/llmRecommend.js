const LLM_BASE = "/api/llm";

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || payload.validation?.errors?.join(", ") || "요청 실패");
  }

  return payload;
}

export async function fetchLlmHealth() {
  const response = await fetch(`${LLM_BASE}/health`);
  return parseResponse(response);
}

export async function fetchScentRecipes() {
  const response = await fetch(`${LLM_BASE}/recipes`);
  return parseResponse(response);
}

/**
 * @param {object} params
 * @param {{ currentMood: string, desiredState: string, scentPreference: string, intensityPreference: number }} params.userInput
 * @param {object} params.bme688
 * @param {object} params.mqtt
 * @param {string} [params.timePeriod]
 */
export async function requestScentRecommendation(params) {
  const response = await fetch(`${LLM_BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  return parseResponse(response);
}

export async function validateDispenseRequest(params) {
  const response = await fetch(`${LLM_BASE}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  return parseResponse(response);
}

export async function confirmAndDispense(params) {
  const response = await fetch(`${LLM_BASE}/dispense`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  return parseResponse(response);
}
