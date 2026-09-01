const PAYLOAD_RE = /^(.+?)\s*\(\s*(\d+(?:\.\d+)?)\s*%\s*\)\s*$/;
const WOODY_RE = /woody|우드/i;
const FRESH_RE = /fresh\s*air|fresh|clean|무취|청정/i;

export function parseAirQualityPayload(payload) {
  if (!payload || typeof payload !== "string") {
    return {
      raw: null,
      label: null,
      confidence: null,
      isWoody: false,
      tone: "unknown",
    };
  }

  const text = payload.trim();
  const match = PAYLOAD_RE.exec(text);

  let label = text;
  let confidence = null;

  if (match) {
    label = match[1].trim();
    const parsed = Number(match[2]);
    confidence = Number.isNaN(parsed) ? null : parsed;
  }

  let tone = "other";
  if (FRESH_RE.test(label)) tone = "fresh";
  else if (WOODY_RE.test(label)) tone = "woody";
  else if (/lavender|라벤더/i.test(label)) tone = "lavender";
  else if (/musk|머스크/i.test(label)) tone = "musk";

  return {
    raw: text,
    label,
    confidence,
    isWoody: tone === "woody",
    tone,
  };
}
