import { useState, useEffect } from "react";

function getTimePeriod(hour) {
  if (hour >= 5 && hour < 12) {
    return "아침";
  }
  if (hour >= 12 && hour < 18) {
    return "오후";
  }
  if (hour >= 18 && hour < 22) {
    return "저녁";
  }
  return "밤";
}

function getTimeParts(date) {
  const hour = date.getHours();

  return {
    timeLabel: date.toLocaleTimeString("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    timeShort: date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    period: getTimePeriod(hour),
  };
}

export function useCurrentTime(updateIntervalMs = 1000) {
  const [time, setTime] = useState(() => getTimeParts(new Date()));

  useEffect(() => {
    const syncTime = () => setTime(getTimeParts(new Date()));

    syncTime();
    const timer = setInterval(syncTime, updateIntervalMs);

    return () => clearInterval(timer);
  }, [updateIntervalMs]);

  return time;
}
