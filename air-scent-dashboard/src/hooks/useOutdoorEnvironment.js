import { useEffect, useState } from "react";

import { fetchOutdoorEnvironment } from "../services/outdoorEnvironment";

/** 날씨·외부 공기질은 분 단위면 충분 */
const POLL_MS = 15 * 60 * 1000;

const initialState = {
  loading: true,
  error: null,
  place: null,
  temperature: null,
  humidity: null,
  weatherLabel: null,
  weatherCode: null,
  windSpeed: null,
  pm25: null,
  pm10: null,
  aqi: null,
  airStatus: null,
  airTone: "unknown",
  fetchedAt: null,
  hasData: false,
};

export default function useOutdoorEnvironment() {
  const [outdoor, setOutdoor] = useState(initialState);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchOutdoorEnvironment();

        if (cancelled) {
          return;
        }

        setOutdoor({
          loading: false,
          error: null,
          place: data.place,
          temperature: data.temperature,
          humidity: data.humidity,
          weatherLabel: data.weatherLabel,
          weatherCode: data.weatherCode,
          windSpeed: data.windSpeed,
          pm25: data.pm25,
          pm10: data.pm10,
          aqi: data.aqi,
          airStatus: data.airStatus,
          airTone: data.airTone,
          fetchedAt: data.fetchedAt,
          hasData: true,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setOutdoor((prev) => ({
          ...prev,
          loading: false,
          error: error.message ?? "외부 환경 조회 실패",
          hasData: prev.hasData,
        }));
      }
    };

    load();
    const timer = setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return outdoor;
}
