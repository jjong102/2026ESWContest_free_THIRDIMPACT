/** Open-Meteo — API 키 불필요 (비영리, CC BY 4.0 출처 표기) */

/** 인천대학교 송도캠퍼스 (아카데미로 119) */
const DEFAULT_LAT = Number(import.meta.env.VITE_OUTDOOR_LAT ?? 37.3755);
const DEFAULT_LON = Number(import.meta.env.VITE_OUTDOOR_LON ?? 126.6333);
const DEFAULT_PLACE = import.meta.env.VITE_OUTDOOR_PLACE ?? "인천대학교";

const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

/** WMO Weather interpretation codes */
export function weatherCodeLabel(code) {
  if (code == null) return "—";
  if (code === 0) return "맑음";
  if (code <= 3) return "구름 조금";
  if (code <= 48) return "안개";
  if (code <= 57) return "이슬비";
  if (code <= 67) return "비";
  if (code <= 77) return "눈";
  if (code <= 82) return "소나기";
  if (code <= 86) return "눈 소나기";
  if (code <= 99) return "뇌우";
  return "날씨 정보";
}

/** 국내 PM2.5 기준 (μg/m³) */
export function koreanPm25Status(pm25) {
  if (pm25 == null || Number.isNaN(pm25)) {
    return { label: "측정 대기", tone: "unknown" };
  }

  if (pm25 <= 15) return { label: "공기 좋음", tone: "good" };
  if (pm25 <= 35) return { label: "공기 보통", tone: "moderate" };
  if (pm25 <= 75) return { label: "공기 나쁨", tone: "bad" };
  return { label: "매우 나쁨", tone: "very-bad" };
}

function round1(value) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

export async function fetchOutdoorEnvironment({
  latitude = DEFAULT_LAT,
  longitude = DEFAULT_LON,
  place = DEFAULT_PLACE,
} = {}) {
  const weatherParams = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    timezone: "Asia/Seoul",
  });

  const airParams = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "european_aqi,us_aqi,pm2_5,pm10",
    timezone: "Asia/Seoul",
  });

  const [weatherRes, airRes] = await Promise.all([
    fetch(`${WEATHER_URL}?${weatherParams}`),
    fetch(`${AIR_URL}?${airParams}`),
  ]);

  if (!weatherRes.ok) {
    throw new Error(`weather failed (${weatherRes.status})`);
  }

  if (!airRes.ok) {
    throw new Error(`air-quality failed (${airRes.status})`);
  }

  const weather = await weatherRes.json();
  const air = await airRes.json();

  const temperature = round1(weather.current?.temperature_2m);
  const humidity = weather.current?.relative_humidity_2m ?? null;
  const weatherCode = weather.current?.weather_code ?? null;
  const windSpeed = round1(weather.current?.wind_speed_10m);
  const pm25 = round1(air.current?.pm2_5);
  const pm10 = round1(air.current?.pm10);
  const usAqi = air.current?.us_aqi ?? null;
  const europeanAqi = air.current?.european_aqi ?? null;
  const airStatus = koreanPm25Status(pm25);

  return {
    place,
    latitude,
    longitude,
    temperature,
    humidity,
    weatherCode,
    weatherLabel: weatherCodeLabel(weatherCode),
    windSpeed,
    pm25,
    pm10,
    aqi: usAqi ?? europeanAqi,
    aqiSource: usAqi != null ? "US" : "EU",
    airStatus: airStatus.label,
    airTone: airStatus.tone,
    fetchedAt: new Date().toISOString(),
    attribution: "Open-Meteo",
  };
}
