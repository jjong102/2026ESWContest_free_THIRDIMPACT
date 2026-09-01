import { useEffect, useState } from "react";

import { fetchSttHealth } from "../services/sttTranscribe";

const INITIAL_STATUS = {
  tone: "wait",
  ready: false,
  label: "확인 중",
  detail: "음성 인식 서버를 확인하는 중…",
};

function describeSttStatus(payload) {
  if (!payload?.ok) {
    return {
      tone: "off",
      ready: false,
      label: "미연결",
      detail: "서버에 연결할 수 없어요",
    };
  }
  if (payload.ready) {
    return {
      tone: "on",
      ready: true,
      label: "연결됨",
      detail: payload.whisperModel
        ? `Whisper ${payload.whisperModel}`
        : "모델 준비됨",
    };
  }
  return {
    tone: "wait",
    ready: false,
    label: "준비 중",
    detail: payload.whisperError || "모델을 불러오는 중…",
  };
}

export function useSttHealth(pollMs = 5000) {
  const [status, setStatus] = useState(INITIAL_STATUS);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const payload = await fetchSttHealth();
        if (!cancelled) setStatus(describeSttStatus(payload));
      } catch {
        if (!cancelled) setStatus(describeSttStatus(null));
      }
    };

    load();
    const timer = window.setInterval(load, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pollMs]);

  return status;
}
