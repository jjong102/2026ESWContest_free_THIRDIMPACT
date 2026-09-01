import { useCallback, useEffect, useRef, useState } from "react";

import { speakText, stopSpeaking } from "../services/ttsSpeak";

export default function useTtsSpeak() {
  const [speaking, setSpeaking] = useState(false);
  const aliveRef = useRef(true);
  const generationRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;

    return () => {
      aliveRef.current = false;
      generationRef.current += 1;
      stopSpeaking();
    };
  }, []);

  const speak = useCallback((text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed || !aliveRef.current) {
      return;
    }

    setSpeaking(true);
    speakText(trimmed).catch(() => {});
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    setSpeaking(false);
    return stopSpeaking();
  }, []);

  return { speaking, speak, stop };
}
